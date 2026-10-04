"""Face look survey in the preview actor (doc 177 §7): eye makeup (liner), pupil, iris, skin tone variants on
MH_<name>, each captured close. The preview actor shows the face correctly (only grooms are missing there).
Env MH_NAME, MH_TAG, MH_FACEVARS = json list of dicts:
  {"liner": "THIN_LINER", "liner_opacity": 0.8, "liner_color": [0,0,0], "pupil": 0.7, "skin_u": 0.05, "skin_v": 0.2,
   "iris_u": 0.5, "iris_v": 0.5}
Shots shots/face_<tag>_<i>.png, log face_log.txt
"""
import json
import os
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
TAG = os.environ.get("MH_TAG", NAME)
VARS = json.loads(os.environ.get("MH_FACEVARS", "[{}]"))
SHOTS = "C:/w/mhlab/shots"
LOG = "C:/w/mhlab/face_log.txt"
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
st = {"actor": None}
try:
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).new_level("/Game/FaceLab")
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
    char = unreal.load_asset(f"/Game/Heroes/MH_{NAME}")
    log("edit", sub.try_add_object_to_edit(char))
    st["char"] = char
except Exception:
    log("ERROR setup", traceback.format_exc())


def apply(v):
    char = st["char"]
    # skin
    sk = char.get_editor_property("skin_settings")
    props = sk.get_editor_property("skin")
    if "skin_u" in v:
        props.set_editor_property("u", v["skin_u"])
    if "skin_v" in v:
        props.set_editor_property("v", v["skin_v"])
    sk.set_editor_property("skin", props)
    sub.commit_skin_settings(char, sk)
    # eye makeup
    mk = char.get_editor_property("makeup_settings")
    eyes_mk = mk.get_editor_property("eyes")
    eyes_mk.set_editor_property("type", getattr(unreal.MetaHumanCharacterEyeMakeupType, v.get("liner", "NONE")))
    if "liner_opacity" in v:
        eyes_mk.set_editor_property("opacity", v["liner_opacity"])
    if "liner_color" in v:
        eyes_mk.set_editor_property("primary_color", unreal.LinearColor(*v["liner_color"], 1.0))
    mk.set_editor_property("eyes", eyes_mk)
    sub.commit_makeup_settings(char, mk)
    # eyes
    es = char.get_editor_property("eyes_settings")
    for side in ("eye_left", "eye_right"):
        e = es.get_editor_property(side)
        if "pupil" in v:
            p = e.get_editor_property("pupil")
            p.set_editor_property("dilation", v["pupil"])
            e.set_editor_property("pupil", p)
        if "iris_u" in v or "iris_v" in v:
            ir = e.get_editor_property("iris")
            for k, prop in (("iris_u", "primary_color_u"), ("iris_v", "primary_color_v"), ("iris2_u", "secondary_color_u"), ("iris2_v", "secondary_color_v")):
                if k in v:
                    ir.set_editor_property(prop, v[k])
            e.set_editor_property("iris", ir)
        if "tint" in v or "sat" in v:
            ir = e.get_editor_property("iris")
            if "tint" in v:
                ir.set_editor_property("global_tint", unreal.LinearColor(*v["tint"], 1.0))
            if "sat" in v:
                ir.set_editor_property("global_saturation", v["sat"])
            e.set_editor_property("iris", ir)
        es.set_editor_property(side, e)
    sub.commit_eyes_settings(char, es)
    if st["actor"]:
        st["actor"].destroy_actor()
    st["actor"] = sub.spawn_meta_human_actor(char, True)
    st["actor"].set_actor_location(unreal.Vector(0, 0, 0), False, False)


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


ticks = {"n": 0, "i": 0, "at": 600}


def on_tick(dt):
    ticks["n"] += 1
    n = ticks["n"]
    if ticks.get("busy") or n < ticks["at"]:
        return
    ticks["busy"] = True
    try:
        i = ticks["i"]
        if i >= len(VARS) * 2:
            log("done")
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
            return
        v = VARS[i // 2]
        if i % 2 == 0:
            apply(v)
            ticks["at"] = n + 500
        else:
            capture(f"face_{TAG}_{i // 2}", unreal.Vector(0, 55, 162), unreal.Rotator(pitch=-2, yaw=-90, roll=0), 26.0)
            log("shot", i // 2, v)
            ticks["at"] = n + 30
        ticks["i"] = i + 1
    except Exception:
        log("ERROR", traceback.format_exc())
        ticks["i"] += 1
    finally:
        ticks["busy"] = False


handle = unreal.register_slate_post_tick_callback(on_tick)
