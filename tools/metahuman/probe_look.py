"""Why do skin tone / brow colour not show (doc 177)? Spawn the built BP, log the skin settings and the groom
materials actually on the components, and take eye close-ups with the brow groom on and off.
Env MH_NAME. Log probe_log.txt, shots probe_<name>_*.png. Run with -ExecCmds="py probe_look.py".
"""
import os
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
LOG = "C:/w/mhlab/probe_log.txt"
SHOTS = "C:/w/mhlab/shots"
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


L = unreal.MaterialEditingLibrary
st = {}
try:
    unreal.EditorLevelLibrary.new_level("/Game/ProbeEmpty")
    char = unreal.load_asset(f"/Game/Heroes/MH_{NAME}")
    sk = char.get_editor_property("skin_settings").get_editor_property("skin")
    log("skin u v", sk.get_editor_property("u"), sk.get_editor_property("v"), "underwear", sk.get_editor_property("show_top_underwear"))
    bp = unreal.load_asset(f"/Game/Heroes/Built/{NAME}/MH_{NAME}/BP_MH_{NAME}")
    actor = unreal.EditorLevelLibrary.spawn_actor_from_object(bp, unreal.Vector(0, 0, 0), unreal.Rotator(pitch=0, yaw=0, roll=0))
    st["actor"] = actor
    for comp in actor.get_components_by_class(unreal.PrimitiveComponent):
        if isinstance(comp, (unreal.GroomComponent, unreal.SkeletalMeshComponent)):
            mats = []
            for i in range(comp.get_num_materials()):
                m = comp.get_material(i)
                if m is None:
                    mats.append(None)
                    continue
                info = m.get_name()
                for pn in ("hairMelanin", "Melanin", "hairRedness"):
                    try:
                        v = m.get_scalar_parameter_value(pn)
                        info += f" {pn}={round(v, 3)}"
                    except Exception:  # noqa: BLE001
                        pass
                mats.append(info)
            log("comp", comp.get_name(), type(comp).__name__, "vis", comp.is_visible(), mats[:6])
    unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 300, 400), unreal.Rotator(pitch=-35, yaw=-110, roll=0))
    sky = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 300), unreal.Rotator(pitch=0, yaw=0, roll=0))
    sky.light_component.set_editor_property("source_type", unreal.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP)
    sky.light_component.set_editor_property("cubemap", unreal.load_asset("/Engine/MapTemplates/Sky/SunsetAmbientCubemap"))
    sky.light_component.recapture_sky()
    # fixed exposure so two shots compare
    ppv = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0), unreal.Rotator())
    ppv.set_editor_property("unbound", True)
    s = ppv.get_editor_property("settings")
    s.set_editor_property("override_auto_exposure_method", True)
    s.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    s.set_editor_property("override_auto_exposure_bias", True)
    s.set_editor_property("auto_exposure_bias", float(os.environ.get("MH_EV", "9")))
    ppv.set_editor_property("settings", s)
except Exception:
    log("ERROR", traceback.format_exc())

ticks = {"n": 0, "jobs": ["face", "face_nobrow", "face_close"]}


def capture(key, loc, rot, fov):
    world = unreal.EditorLevelLibrary.get_editor_world()
    rt = unreal.RenderingLibrary.create_render_target2d(world, 1024, 1024, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
    cap = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SceneCapture2D, loc, rot)
    cc = cap.capture_component2d
    cc.set_editor_property("texture_target", rt)
    cc.set_editor_property("fov_angle", fov)
    cc.set_editor_property("capture_source", unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
    cc.capture_scene()
    unreal.RenderingLibrary.export_render_target(world, rt, SHOTS, f"probe_{NAME}_{key}.png")
    log("shot", key)


def on_tick(dt):
    ticks["n"] += 1
    n = ticks["n"]
    if n < 1500 or n % 60:
        return
    try:
        a = st["actor"]
        if not ticks["jobs"]:
            log("done")
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
            return
        job = ticks["jobs"].pop(0)
        brow = next((c for c in a.get_components_by_class(unreal.GroomComponent) if "brow" in c.get_name().lower()), None)
        if brow:
            brow.set_visibility(job != "face_nobrow", False)
        if job == "face_close":
            capture(job, unreal.Vector(0, 55, 160), unreal.Rotator(pitch=-3, yaw=-90, roll=0), 30.0)
        else:
            capture(job, unreal.Vector(0, 80, 160), unreal.Rotator(pitch=-3, yaw=-90, roll=0), 30.0)
    except Exception:
        log("ERROR tick", traceback.format_exc())
        ticks["jobs"] = []


handle = unreal.register_slate_post_tick_callback(on_tick)
