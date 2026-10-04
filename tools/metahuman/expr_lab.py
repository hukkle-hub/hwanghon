"""Half-lidded eyes by expression (doc 177 짠7): the face rig's eyelid control held at a constant value.
A one-pose AnimSequence on the face skeleton carries constant CTRL_expressions_* curves; the built BP's Face component
plays it (single node) - its post-process AnimBP (RigLogic) turns the curves into eyelid joints.
Env MH_NAME, MH_TAG, MH_EXPRS = json list of {curve: value}. Shots shots/expr_<tag>_<i>.png, log expr_log.txt
"""
import json
import os
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
TAG = os.environ.get("MH_TAG", NAME)
EXPRS = json.loads(os.environ.get("MH_EXPRS", '[{}, {"CTRL_expressions_eyeBlinkL": 0.3, "CTRL_expressions_eyeBlinkR": 0.3}]'))
SHOTS = "C:/w/mhlab/shots"
LOG = "C:/w/mhlab/expr_log.txt"
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
eal = unreal.EditorAssetLibrary
st = {}
try:
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).new_level("/Game/ExprLab")
    eas.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 300, 400), unreal.Rotator(pitch=-35, yaw=-110, roll=0))
    sky = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 300), unreal.Rotator())
    sky.light_component.set_editor_property("intensity", 1.5)
    sky.light_component.set_editor_property("source_type", unreal.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP)
    sky.light_component.set_editor_property("cubemap", unreal.load_asset("/Engine/MapTemplates/Sky/SunsetAmbientCubemap"))
    sky.light_component.recapture_sky()
    ppv = eas.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(), unreal.Rotator())
    ppv.set_editor_property("unbound", True)
    s = ppv.get_editor_property("settings")
    s.set_editor_property("override_auto_exposure_method", True)
    s.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    s.set_editor_property("override_auto_exposure_bias", True)
    s.set_editor_property("auto_exposure_bias", float(os.environ.get("MH_EV", "9.5")))
    ppv.set_editor_property("settings", s)
    bp = unreal.load_asset(f"/Game/Heroes/Built/{NAME}/MH_{NAME}/BP_MH_{NAME}")
    actor = eas.spawn_actor_from_object(bp, unreal.Vector(0, 0, 0), unreal.Rotator())
    face = next(c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name() == "Face")
    skel = face.get_skeletal_mesh_asset().get_editor_property("skeleton")
    log("face", face.get_skeletal_mesh_asset().get_name(), "skeleton", skel.get_name(),
        "anim class", face.get_editor_property("anim_class"), "post", face.get_skeletal_mesh_asset().get_editor_property("post_process_anim_blueprint"))
    st.update(actor=actor, face=face, skel=skel, seqs=[])
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    for i, ex in enumerate(EXPRS):
        path, nm = f"/Game/ExprLab/{TAG}", f"AS_expr_{i}"
        if eal.does_asset_exist(f"{path}/{nm}"):
            eal.delete_asset(f"{path}/{nm}")
        fac = unreal.AnimSequenceFactory()
        fac.set_editor_property("target_skeleton", skel)
        seq = tools.create_asset(nm, path, unreal.AnimSequence, fac)
        ctrl = seq.get_editor_property("controller")
        ctrl.set_number_of_frames(unreal.FrameNumber(30))
        for cname, val in ex.items():
            unreal.AnimationLibrary.add_curve(seq, cname, unreal.RawCurveTrackTypes.RCT_FLOAT, False)
            unreal.AnimationLibrary.add_float_curve_keys(seq, cname, [0.0, 1.0], [val, val])
        log("curves", [str(c) for c in unreal.AnimationLibrary.get_animation_curve_names(seq, unreal.RawCurveTrackTypes.RCT_FLOAT)])
        eal.save_loaded_asset(seq)
        st["seqs"].append(seq)
        log("seq", i, ex)
except Exception:
    log("ERROR setup", traceback.format_exc())


def capture(key, loc, rot, fov):
    world = unreal.EditorLevelLibrary.get_editor_world()
    rt = unreal.RenderingLibrary.create_render_target2d(world, 1024, 1024, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
    cap = eas.spawn_actor_from_class(unreal.SceneCapture2D, loc, rot)
    cc = cap.capture_component2d
    cc.set_editor_property("texture_target", rt)
    cc.set_editor_property("fov_angle", fov)
    cc.set_editor_property("capture_source", unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
    cc.capture_scene()
    unreal.RenderingLibrary.export_render_target(world, rt, SHOTS, f"{key}.png")
    cap.destroy_actor()


ticks = {"n": 0, "i": 0, "at": 3500}


def on_tick(dt):
    ticks["n"] += 1
    n = ticks["n"]
    if ticks.get("busy") or n < ticks["at"]:
        return
    ticks["busy"] = True
    try:
        i = ticks["i"]
        if i >= len(EXPRS) * 2:
            log("done")
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
            return
        if i % 2 == 0:
            face = st["face"]
            face.set_update_animation_in_editor(True)
            face.set_animation_mode(unreal.AnimationMode.ANIMATION_SINGLE_NODE)
            face.play_animation(st["seqs"][i // 2], True)
            st["pending_bones"] = True
            ticks["at"] = n + 120
        else:
            capture(f"expr_{TAG}_{i // 2}", unreal.Vector(0, 55, 162), unreal.Rotator(pitch=-2, yaw=-90, roll=0), 26.0)
            capture(f"expr_{TAG}_{i // 2}_head", unreal.Vector(0, 80, 160), unreal.Rotator(pitch=-3, yaw=-90, roll=0), 30.0)
            face = st["face"]
            lids = [b for b in face.get_all_socket_names() if "eyelidupper" in str(b).lower()][:4]
            log("shot", i // 2, EXPRS[i // 2], "lids z", [(str(b), round(face.get_socket_location(b).z, 3)) for b in lids])
            ticks["at"] = n + 30
        ticks["i"] = i + 1
    except Exception:
        log("ERROR", traceback.format_exc())
        ticks["i"] += 1
    finally:
        ticks["busy"] = False


handle = unreal.register_slate_post_tick_callback(on_tick)
