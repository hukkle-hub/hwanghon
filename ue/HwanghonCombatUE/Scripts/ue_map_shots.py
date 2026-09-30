"""Look at a map through its own cameras (docs/design/164): load it in the full editor, wait for shaders and texture
streaming, then capture every CameraActor (up to 8), and quit. Without placed cameras it walks the geometry's long
axis at eye height.

  UnrealEditor.exe <uproject> -ExecCmds="py Scripts/ue_map_shots.py" -HWMap=/Game/... -HWShots=<dir> [-HWWait=90]

The map is opened from the first editor tick, not at script start: during startup the editor opens its default map
after -ExecCmds runs, and the capture found an empty level (2026-09-30).
"""
import os
import sys

import unreal


def arg(name, default=None):
    for a in sys.argv + unreal.SystemLibrary.get_command_line().split():
        if a.startswith(f"-{name}="):
            return a.split("=", 1)[1].strip('"')
    return default


def log(m):
    unreal.log(f"[HWShots] {m}")


les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
out = arg("HWShots")
os.makedirs(out, exist_ok=True)
S = {"t": 0.0, "stage": 0, "views": [], "cap": None, "rt": None, "frames": 0}


def setup():
    les.load_level(arg("HWMap"))
    try:
        wp = unreal.WorldPartitionBlueprintLibrary
        descs = wp.get_actor_descs()
        if descs:
            wp.load_actors([d.guid for d in descs])
            log(f"loaded {len(descs)} partition actors")
    except Exception as e:
        log(f"not partitioned: {e}")
    actors = eas.get_all_level_actors()
    counts = {}
    for a in actors:
        counts[a.get_class().get_name()] = counts.get(a.get_class().get_name(), 0) + 1
    log("actors: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items(), key=lambda kv: -kv[1])[:14]))
    cams = [a for a in actors if isinstance(a, unreal.CameraActor)][:8]
    views = [(c.get_actor_label(), c.get_actor_location(), c.get_actor_rotation(), c.camera_component.field_of_view)
             for c in cams]
    if not views:
        pts = [a.get_actor_location() for a in actors if isinstance(a, unreal.StaticMeshActor)]
        if pts:
            xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
            lo, hi = unreal.Vector(min(xs), min(ys), min(zs)), unreal.Vector(max(xs), max(ys), max(zs))
            along_x = (hi.x - lo.x) >= (hi.y - lo.y)
            zc = sorted(zs)[len(zs) // 10] + 170
            for k in range(6):
                f = 0.1 + 0.8 * k / 5
                if along_x:
                    p, yaw = unreal.Vector(lo.x + (hi.x - lo.x) * f, (lo.y + hi.y) / 2, zc), (0 if k % 2 == 0 else 180)
                else:
                    p, yaw = unreal.Vector((lo.x + hi.x) / 2, lo.y + (hi.y - lo.y) * f, zc), (90 if k % 2 == 0 else -90)
                views.append((f"walk{k}", p, unreal.Rotator(roll=0, pitch=-5, yaw=yaw), 75.0))
    log(f"{len(views)} views")
    world = unreal.EditorLevelLibrary.get_editor_world()
    cap = eas.spawn_actor_from_class(unreal.SceneCapture2D, unreal.Vector(0, 0, 0))
    comp = cap.capture_component2d
    rt = unreal.RenderingLibrary.create_render_target2d(world, 1280, 720, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
    comp.texture_target = rt
    comp.capture_source = unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR
    unreal.SystemLibrary.execute_console_command(None, "r.Streaming.FullyLoadUsedTextures 1")
    S.update(views=views, cap=cap, rt=rt, world=world)


def shoot():
    cap, comp = S["cap"], S["cap"].capture_component2d
    for i, (name, loc, rot, fov) in enumerate(S["views"]):
        cap.set_actor_location(loc, False, False)
        cap.set_actor_rotation(rot, False)
        comp.fov_angle = fov
        comp.capture_scene()
        unreal.RenderingLibrary.export_render_target(S["world"], S["rt"], out, f"shot_{i}_{name}.png")
        log(f"shot {i} {name}")


def tick(dt):
    S["t"] += dt
    S["frames"] += 1
    if S["stage"] == 0 and S["frames"] > 30:
        S["stage"], S["t"] = 1, 0.0
        setup()
    elif S["stage"] == 1 and S["t"] >= float(arg("HWWait", "90")):
        S["stage"] = 2
        shoot()
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()


handle = unreal.register_slate_post_tick_callback(tick)
