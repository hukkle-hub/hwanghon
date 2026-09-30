"""Boss clip audit (docs/design/165): every clip of a boss body, posed at fixed fractions of its length on a grid
floor, shot from the side and the front, with the height of the feet / pelvis / head / hands and the lowest bone
written to a CSV. Measures what a still in the game only hints at (the fallen scarecrow with a leg in the air,
the lie/up clips a metre off the floor - 2026-09-30).

  UnrealEditor.exe <uproject> -ExecCmds="py Scripts/ue_boss_pose_audit.py" -HWMesh=<SkeletalMesh path>
      -HWClips=<folder of AnimSequences> -HWShots=<dir> [-HWYaw=0] [-HWScale=1] [-HWFracs=0,0.25,0.5,0.75,1]
"""
import csv
import os
import sys

import unreal


def arg(name, default=None):
    for a in sys.argv + unreal.SystemLibrary.get_command_line().split():
        if a.startswith(f"-{name}="):
            return a.split("=", 1)[1].strip('"')
    return default


def log(m):
    unreal.log(f"[HWPose] {m}")


eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
out = arg("HWShots")
os.makedirs(out, exist_ok=True)
FRACS = [float(v) for v in arg("HWFracs", "0,0.25,0.5,0.75,1").split(",")]
S = {"frames": 0, "stage": 0, "wait": 0, "jobs": [], "i": 0, "rows": []}


def rot(yaw=0.0, pitch=0.0, roll=0.0):
    return unreal.Rotator(roll=roll, pitch=pitch, yaw=yaw)


def setup():
    les.new_level("/Game/Heroes/_lookdev/PoseAudit_Temp", False)
    for a in list(eas.get_all_level_actors()):
        if a.get_class().get_name() not in ("WorldSettings", "WorldDataLayers", "Brush"):
            eas.destroy_actor(a)
    plane = unreal.load_asset("/Engine/BasicShapes/Plane.Plane")
    grid = unreal.load_asset("/Engine/EngineMaterials/WorldGridMaterial.WorldGridMaterial")
    floor = eas.spawn_actor_from_object(plane, unreal.Vector(0, 0, 0), rot())
    floor.set_actor_scale3d(unreal.Vector(12, 12, 1))
    floor.static_mesh_component.set_material(0, grid)
    back = eas.spawn_actor_from_object(plane, unreal.Vector(0, -300, 300), rot(roll=90))
    back.set_actor_scale3d(unreal.Vector(12, 6, 1))
    back.static_mesh_component.set_material(0, grid)
    d = eas.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 500), rot(yaw=45, pitch=-50))
    d.light_component.set_editor_property("intensity", 6.0)
    sky = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 500), rot())
    sky.light_component.set_editor_property("intensity", 1.0)
    ppv = eas.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 100), rot())
    ppv.set_editor_property("unbound", True)
    st = ppv.settings
    st.set_editor_property("override_auto_exposure_method", True)
    st.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    st.set_editor_property("override_auto_exposure_bias", True)
    st.set_editor_property("auto_exposure_bias", 11.0)
    ppv.set_editor_property("settings", st)

    mesh = unreal.load_asset(arg("HWMesh"))
    a = eas.spawn_actor_from_class(unreal.SkeletalMeshActor, unreal.Vector(0, 0, 0), rot(yaw=float(arg("HWYaw", "0"))))
    sc = float(arg("HWScale", "1"))
    a.set_actor_scale3d(unreal.Vector(sc, sc, sc))
    comp = a.skeletal_mesh_component
    comp.set_skinned_asset_and_update(mesh)
    try:
        comp.set_update_animation_in_editor(True)
    except Exception as e:
        log(f"update in editor: {e}")
    comp.set_animation_mode(unreal.AnimationMode.ANIMATION_SINGLE_NODE)
    names = [str(comp.get_bone_name(i)) for i in range(comp.get_num_bones())]
    log(f"{len(names)} bones: {', '.join(names[:80])}")

    def pick(*keys):
        return [n for n in names if any(k in n.lower() for k in keys)]
    watch = {}
    for label, keys in (("foot", ("foot",)), ("toe", ("toe",)), ("pelvis", ("pelvis", "hips")), ("head", ("head",)),
                        ("hand", ("hand",))):
        for n in pick(*keys):
            if "end" not in n.lower() and "twist" not in n.lower() and len(watch) < 16:
                watch[n] = label
    reg = unreal.AssetRegistryHelpers.get_asset_registry()
    seqs = []
    for dsc in reg.get_assets_by_path(arg("HWClips"), recursive=True):
        if str(dsc.asset_class_path.asset_name) == "AnimSequence":
            seqs.append(str(dsc.package_name))
    seqs.sort()
    log(f"{len(seqs)} clips")
    world = unreal.EditorLevelLibrary.get_editor_world()
    cap = eas.spawn_actor_from_class(unreal.SceneCapture2D, unreal.Vector(0, 0, 0), rot())
    cc = cap.capture_component2d
    rt = unreal.RenderingLibrary.create_render_target2d(world, 640, 640, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
    cc.texture_target = rt
    cc.capture_source = unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR
    for p in seqs:
        seq = unreal.load_asset(p)
        ln = seq.get_play_length()
        for fr in FRACS:
            S["jobs"].append((p.split("/")[-1], seq, min(ln, max(0.0, fr * ln)), fr, ln))
    S.update(actor=a, comp=comp, names=names, watch=watch, cap=cap, cc=cc, rt=rt, world=world)


def shoot(name):
    for view, loc in (("side", (650, 0, 170)), ("front", (0, 650, 170))):
        L = unreal.Vector(*loc)
        S["cap"].set_actor_location(L, False, False)
        S["cap"].set_actor_rotation(unreal.MathLibrary.find_look_at_rotation(L, unreal.Vector(0, 0, 150)), False)
        S["cc"].fov_angle = 40
        S["cc"].capture_scene()
        unreal.RenderingLibrary.export_render_target(S["world"], S["rt"], out, f"{name}_{view}.png")


def measure(clip, t, fr, ln):
    comp = S["comp"]
    row = {"clip": clip, "frac": fr, "t": round(t, 3), "len": round(ln, 3)}
    zs = []
    for n in S["names"]:
        zs.append(comp.get_socket_location(n).z)
    row["min_bone_z"] = round(min(zs), 1)
    row["max_bone_z"] = round(max(zs), 1)
    for n, label in S["watch"].items():
        row[n] = round(comp.get_socket_location(n).z, 1)
    S["rows"].append(row)


def tick(dt):
    S["frames"] += 1
    if S["stage"] == 0 and S["frames"] > 30:
        S["stage"] = 1
        setup()
        S["wait"] = 120   # shaders and textures
        return
    if S["stage"] != 1:
        return
    if S["wait"] > 0:
        S["wait"] -= 1
        return
    i = S["i"]
    if i >= len(S["jobs"]) * 2:
        with open(os.path.join(out, "pose_audit.csv"), "w", newline="", encoding="utf-8") as f:
            keys = []
            for r in S["rows"]:
                for k in r:
                    if k not in keys:
                        keys.append(k)
            w = csv.DictWriter(f, fieldnames=keys)
            w.writeheader()
            w.writerows(S["rows"])
        log(f"done {len(S['rows'])} poses")
        S["stage"] = 2
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()
        return
    clip, seq, t, fr, ln = S["jobs"][i // 2]
    if i % 2 == 0:
        # pose it, then give the component a few frames to evaluate
        S["comp"].set_animation(seq)
        S["comp"].set_position(t, False)
        S["comp"].set_play_rate(0.0)
        S["wait"] = 3
    else:
        name = f"{clip}_{int(fr * 100):03d}"
        measure(clip, t, fr, ln)
        shoot(name)
    S["i"] = i + 1


handle = unreal.register_slate_post_tick_callback(tick)
