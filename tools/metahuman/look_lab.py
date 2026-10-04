"""Look survey without a full build (doc 177 짠7): edits go through the PREVIEW collection (Epic's test flow:
preview collection -> slot selection -> on_edit_preview_collection -> assemble_for_preview -> instance parameters),
a preview actor is spawned and captured front + 3/4. One editor session tries several looks.
Env MH_NAME, MH_LOOKS = "hair1:melanin;hair2:melanin..." (melanin -1 = leave), MH_TAG.
Shots: shots/look_<tag>_<n>_{front,q}.png, log look_log.txt
"""
import os
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
TAG = os.environ.get("MH_TAG", NAME)
LOOKS = [x.split(":") for x in os.environ.get("MH_LOOKS", "WI_Hair_M_BobMessy:1").split(";") if x]
HAIR = "/MetaHumanCharacter/Optional/Grooms/Bindings/Hair"
SHOTS = "C:/w/mhlab/shots"
LOG = "C:/w/mhlab/look_log.txt"
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
st = {"actor": None}
try:
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).new_level("/Game/LookLab")
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


def apply_look(hair, melanin):
    char = st["char"]
    pc = sub.get_preview_collection(char)
    inst = pc.get_editor_property("default_instance")
    key = pc.try_add_item_from_wardrobe_item("Hair", unreal.load_asset(f"{HAIR}/{hair}"))
    inst.set_single_slot_selection("Hair", key)
    for slot in ("Eyebrows", "Beard", "Mustache", "Outfits"):
        try:
            inst.set_single_slot_selection(slot, unreal.MetaHumanPaletteItemKey())
        except Exception:  # noqa: BLE001
            pass
    sub.on_edit_preview_collection(char)
    sub.assemble_for_preview(char)
    if float(melanin) >= 0:
        params = inst.get_instance_parameters(unreal.MetaHumanPaletteItemPath(item_key=key))
        names = [str(p.name) for p in params]
        for p in params:
            n = str(p.name).lower()
            if n in ("melanin", "hairmelanin"):
                p.set_float(float(melanin))
            elif n in ("redness", "hairredness"):
                p.set_float(0.05 if float(melanin) > 0.5 else 0.0)
        log(hair, "params", names[:30])
        sub.on_edit_preview_collection(char)
        sub.assemble_for_preview(char)
    if st["actor"]:
        st["actor"].destroy_actor()
    st["actor"] = sub.spawn_meta_human_actor(char, True)
    st["actor"].set_actor_location(unreal.Vector(0, 0, 0), False, False)
    log(hair, "actor", st["actor"].get_name())


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
        if i >= len(LOOKS) * 2:
            log("done")
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
            return
        look = LOOKS[i // 2]
        if i % 2 == 0:
            apply_look(*look)
            ticks["at"] = n + int(os.environ.get("MH_WAIT", "900"))          # grooms bind and shaders compile late
        else:
            k = f"look_{TAG}_{i // 2}"
            capture(k + "_front", unreal.Vector(0, 80, 160), unreal.Rotator(pitch=-3, yaw=-90, roll=0), 30.0)
            capture(k + "_q", unreal.Vector(55, 62, 160), unreal.Rotator(pitch=-3, yaw=-130, roll=0), 30.0)
            log("shot", k, look)
            ticks["at"] = n + 30
        ticks["i"] = i + 1
    except Exception:
        log("ERROR", traceback.format_exc())
        ticks["i"] += 1
    finally:
        ticks["busy"] = False


handle = unreal.register_slate_post_tick_callback(on_tick)
