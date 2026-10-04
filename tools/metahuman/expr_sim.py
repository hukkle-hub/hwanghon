"""Eyelid expressions checked in SIMULATE (doc 177 §7) - the editor world does not evaluate the face AnimBP, so the
eyelid joints never moved there (measured). N copies of BP_MH_<name> stand 3 m apart, each Face plays its own
one-pose curve animation (expr_lab.py made them: /Game/ExprLab/<tag>/AS_expr_<i>); a SceneCapture2D in front of each.
Simulate starts, the copies in the play world capture, the render targets are exported, simulate ends.
Env MH_NAME, MH_TAG, MH_COUNT. Shots shots/sim_<tag>_<i>.png, log expr_sim_log.txt
"""
import os
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
TAG = os.environ.get("MH_TAG", NAME)
COUNT = int(os.environ.get("MH_COUNT", "4"))
SHOTS = "C:/w/mhlab/shots"
LOG = "C:/w/mhlab/expr_sim_log.txt"
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
st = {"rts": []}
try:
    les.new_level("/Game/ExprSim")
    eas.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 300, 400), unreal.Rotator(pitch=-35, yaw=-110, roll=0))
    sky = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 300), unreal.Rotator())
    sky.light_component.set_editor_property("intensity", 1.5)
    sky.light_component.set_editor_property("source_type", unreal.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP)
    sky.light_component.set_editor_property("cubemap", unreal.load_asset("/Engine/MapTemplates/Sky/SunsetAmbientCubemap"))
    ppv = eas.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(), unreal.Rotator())
    ppv.set_editor_property("unbound", True)
    s = ppv.get_editor_property("settings")
    s.set_editor_property("override_auto_exposure_method", True)
    s.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    s.set_editor_property("override_auto_exposure_bias", True)
    s.set_editor_property("auto_exposure_bias", float(os.environ.get("MH_EV", "9.5")))
    ppv.set_editor_property("settings", s)
    bp = unreal.load_asset(f"/Game/Heroes/Built/{NAME}/MH_{NAME}/BP_MH_{NAME}")
    world = unreal.EditorLevelLibrary.get_editor_world()
    for i in range(COUNT):
        x = i * 300.0
        a = eas.spawn_actor_from_object(bp, unreal.Vector(x, 0, 0), unreal.Rotator())
        a.set_actor_label(f"Hero_{i}")
        face = next(c for c in a.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name() == "Face")
        seq = unreal.load_asset(f"/Game/ExprLab/{TAG}/AS_expr_{i}")
        face.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_SINGLE_NODE)
        pd = unreal.SingleAnimationPlayData()
        pd.set_editor_property("anim_to_play", seq)
        pd.set_editor_property("saved_looping", True)
        pd.set_editor_property("saved_playing", True)
        face.set_editor_property("animation_data", pd)
        rt = unreal.RenderingLibrary.create_render_target2d(world, 1024, 1024, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
        cap = eas.spawn_actor_from_class(unreal.SceneCapture2D, unreal.Vector(x, 55, 162), unreal.Rotator(pitch=-2, yaw=-90, roll=0))
        cap.set_actor_label(f"Cap_{i}")
        cc = cap.capture_component2d
        cc.set_editor_property("texture_target", rt)
        cc.set_editor_property("fov_angle", 26.0)
        cc.set_editor_property("capture_every_frame", False)
        cc.set_editor_property("capture_on_movement", False)
        cc.set_editor_property("capture_source", unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
        st["rts"].append(rt)
        log("hero", i, seq)
except Exception:
    log("ERROR setup", traceback.format_exc())

ticks = {"n": 0, "phase": "wait"}


def on_tick(dt):
    ticks["n"] += 1
    n = ticks["n"]
    if ticks.get("busy"):
        return
    ticks["busy"] = True
    try:
        if ticks["phase"] == "wait" and n > 900:
            les.editor_play_simulate()
            ticks["phase"], ticks["at"] = "sim", n + 2500
            log("simulate started")
        elif ticks["phase"] == "sim" and n > ticks["at"]:
            gw = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
            log("game world", gw)
            caps = unreal.GameplayStatics.get_all_actors_of_class(gw, unreal.SceneCapture2D)
            heroes = [a for a in unreal.GameplayStatics.get_all_actors_of_class(gw, unreal.Actor) if a.get_actor_label().startswith("Hero_")] if gw else []
            for h in heroes:
                f = next(c for c in h.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name() == "Face")
                lids = [b for b in f.get_all_socket_names() if "eyelidupper" in str(b).lower()][:2]
                log(h.get_actor_label(), "lid z", [round(f.get_socket_location(b).z, 3) for b in lids])
            for c in caps:
                c.capture_component2d.capture_scene()
            ticks["phase"], ticks["at"] = "export", n + 60
        elif ticks["phase"] == "export" and n > ticks["at"]:
            world = unreal.EditorLevelLibrary.get_editor_world()
            for i, rt in enumerate(st["rts"]):
                unreal.RenderingLibrary.export_render_target(world, rt, SHOTS, f"sim_{TAG}_{i}.png")
            log("exported")
            les.editor_request_end_play()
            ticks["phase"], ticks["at"] = "quit", n + 120
        elif ticks["phase"] == "quit" and n > ticks["at"]:
            log("done")
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
    except Exception:
        log("ERROR", ticks["phase"], traceback.format_exc())
        ticks["phase"], ticks["at"] = "quit", n + 10
    finally:
        ticks["busy"] = False


handle = unreal.register_slate_post_tick_callback(on_tick)
