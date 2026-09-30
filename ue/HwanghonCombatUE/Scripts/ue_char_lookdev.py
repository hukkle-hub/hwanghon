"""Character look-dev shots (docs/design/165): one character in a neutral three-point-lit room, captured front / 3-4 /
side / back full body and face close-ups, then quit. For judging a hero against the design sheet - zoom, not a
full-body glance (CLAUDE.md §1).

  UnrealEditor.exe <uproject> -ExecCmds="py Scripts/ue_char_lookdev.py" -HWChar=<BP or SkeletalMesh path>
      -HWShots=<dir> [-HWYaw=0] [-HWWait=90] [-HWHead=160]
The level is opened from the first editor tick (the editor opens its default map after -ExecCmds, 2026-09-30).
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
    unreal.log(f"[HWLook] {m}")


eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
out = arg("HWShots")
os.makedirs(out, exist_ok=True)
S = {"frames": 0, "t": 0.0, "stage": 0}


def rot(yaw=0.0, pitch=0.0, roll=0.0):
    return unreal.Rotator(roll=roll, pitch=pitch, yaw=yaw)


def light(cls, loc, r, intensity, color=(255, 255, 255)):
    a = eas.spawn_actor_from_class(cls, unreal.Vector(*loc), r)
    c = a.get_component_by_class(unreal.LightComponent)
    c.set_editor_property("intensity", intensity)
    c.set_editor_property("light_color", unreal.Color(r=color[0], g=color[1], b=color[2], a=255))
    return a


def setup():
    les.new_level("/Game/Heroes/_lookdev/LookDev_Temp", False)
    for a in list(eas.get_all_level_actors()):
        if a.get_class().get_name() not in ("WorldSettings", "WorldDataLayers", "Brush"):
            eas.destroy_actor(a)
    floor = eas.spawn_actor_from_object(unreal.load_asset("/Engine/BasicShapes/Plane.Plane"), unreal.Vector(0, 0, 0), rot())
    floor.set_actor_scale3d(unreal.Vector(20, 20, 1))
    wall = eas.spawn_actor_from_object(unreal.load_asset("/Engine/BasicShapes/Plane.Plane"), unreal.Vector(-500, 0, 400),
                                       rot(pitch=90))
    wall.set_actor_scale3d(unreal.Vector(10, 20, 1))
    light(unreal.RectLight, (300, -250, 260), rot(yaw=140, pitch=-25), 40.0)          # key
    light(unreal.RectLight, (250, 300, 180), rot(yaw=-130, pitch=-10), 10.0)          # fill
    light(unreal.RectLight, (-250, 0, 300), rot(yaw=0, pitch=-30), 30.0, (255, 220, 200))  # rim
    sky = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 500), rot())
    sky.light_component.set_editor_property("intensity", 0.3)
    ppv = eas.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 100), rot())
    ppv.set_editor_property("unbound", True)
    st = ppv.settings
    st.set_editor_property("override_auto_exposure_method", True)
    st.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    st.set_editor_property("override_auto_exposure_bias", True)
    st.set_editor_property("auto_exposure_bias", float(arg("HWEV", "8")))
    ppv.set_editor_property("settings", st)
    path = arg("HWChar")
    asset = unreal.load_asset(path)
    yaw = float(arg("HWYaw", "0"))
    if isinstance(asset, unreal.SkeletalMesh):
        ch = eas.spawn_actor_from_class(unreal.SkeletalMeshActor, unreal.Vector(0, 0, 0), rot(yaw=yaw))
        ch.skeletal_mesh_component.set_skinned_asset_and_update(asset)
    else:
        cls = asset.generated_class() if hasattr(asset, "generated_class") else unreal.load_class(None, path + "_C")
        ch = eas.spawn_actor_from_class(cls, unreal.Vector(0, 0, 0), rot(yaw=yaw))
    comps = ch.get_components_by_class(unreal.PrimitiveComponent)
    log(f"spawned {ch.get_class().get_name()} with {len(comps)} primitive components: "
        + ", ".join(sorted({c.get_class().get_name() for c in comps})))
    o, e = ch.get_actor_bounds(False)
    log(f"bounds z {o.z - e.z:.0f}..{o.z + e.z:.0f} (height {2 * e.z:.0f} cm)")
    world = unreal.EditorLevelLibrary.get_editor_world()
    cap = eas.spawn_actor_from_class(unreal.SceneCapture2D, unreal.Vector(0, 0, 0), rot())
    comp = cap.capture_component2d
    rt = unreal.RenderingLibrary.create_render_target2d(world, 1024, 1024, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
    comp.texture_target = rt
    comp.capture_source = unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR
    unreal.SystemLibrary.execute_console_command(None, "r.Streaming.FullyLoadUsedTextures 1")
    unreal.SystemLibrary.execute_console_command(None, "r.HairStrands.Enable 1")
    top = o.z + e.z
    head = float(arg("HWHead", str(top - 12)))
    mid = top / 2
    S.update(cap=cap, comp=comp, rt=rt, world=world, views=[
        ("full_front", (340, 0, mid), (0, 0, mid), 36),
        ("full_34", (240, 240, mid), (0, 0, mid), 36),
        ("full_side", (0, 340, mid), (0, 0, mid), 36),
        ("full_back", (-340, 0, mid), (0, 0, mid), 36),
        ("face_front", (70, 0, head), (0, 0, head - 2), 30),
        ("face_34", (52, 46, head), (0, 0, head - 2), 30),
        ("face_side", (0, 70, head), (0, 0, head - 2), 30),
        ("torso", (160, 40, top * 0.72), (0, 0, top * 0.68), 34),
    ])


def shoot():
    for name, loc, look, fov in S["views"]:
        L = unreal.Vector(*loc)
        S["cap"].set_actor_location(L, False, False)
        S["cap"].set_actor_rotation(unreal.MathLibrary.find_look_at_rotation(L, unreal.Vector(*look)), False)
        S["comp"].fov_angle = fov
        S["comp"].capture_scene()
        unreal.RenderingLibrary.export_render_target(S["world"], S["rt"], out, f"{name}.png")
    log(f"shot {len(S['views'])}")


def tick(dt):
    S["frames"] += 1
    S["t"] += dt
    if S["stage"] == 0 and S["frames"] > 30:
        S["stage"], S["t"] = 1, 0.0
        setup()
    elif S["stage"] == 1 and S["t"] >= float(arg("HWWait", "90")):
        S["stage"] = 2
        shoot()
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()


handle = unreal.register_slate_post_tick_callback(tick)
