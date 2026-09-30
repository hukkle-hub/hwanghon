"""Ain as a MetaHuman - prototype step 1 (docs/design/164). Offline, no credits: body, hair, eyes, skin from the
director's sheet (docs/story/source/design/ain_design_sheet_9132.png: 19, 168 cm, 52 kg, black messy bob with bangs,
red eyes, pale skin). The face likeness, the cloud rig/textures and the build are later steps.

Full editor (the preview actor needs a renderer), from PowerShell:
  UnrealEditor.exe <uproject> -ExecCmds="py Scripts/mh_ain_proto.py" -HWMHShots=<dir>
It writes front / side / face close-up PNGs through a SceneCapture2D and quits.
"""
import os
import sys

import unreal

PRESET = "/MetaHumanCharacter/Optional/Presets/Aoi"   # a young East Asian woman to start the face from
DEST_DIR = "/Game/Heroes/Ain"
DEST = f"{DEST_DIR}/MHC_Ain"
HAIR = "/MetaHumanCharacter/Optional/Grooms/Bindings/Hair/WI_Hair_M_BobMessy.WI_Hair_M_BobMessy"
BROWS = "/MetaHumanCharacter/Optional/Grooms/Bindings/Eyebrows/WI_Eyebrows_M_Natural.WI_Eyebrows_M_Natural"
lib = unreal.EditorAssetLibrary
mhs = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)


def log(msg):
    unreal.log(f"[HWMH] {msg}")


def arg(name, default=None):
    for a in sys.argv + unreal.SystemLibrary.get_command_line().split():
        if a.startswith(f"-{name}="):
            return a.split("=", 1)[1].strip('"')
    return default


def character():
    if lib.does_asset_exist(DEST) and arg("HWMHReset") is None:
        return unreal.load_asset(DEST)
    if lib.does_asset_exist(DEST):
        lib.delete_asset(DEST)
    if lib.does_asset_exist(PRESET):
        c = lib.duplicate_asset(PRESET, DEST)
        if c:
            log(f"duplicated {PRESET}")
            return c
    log("preset duplicate failed - new character")
    return unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        asset_name="MHC_Ain", package_path=DEST_DIR, asset_class=unreal.MetaHumanCharacter,
        factory=unreal.MetaHumanCharacterFactoryNew())


def edit(c, fn):
    if not mhs.try_add_object_to_edit(c):
        raise RuntimeError("cannot edit MHC_Ain (open elsewhere?)")
    try:
        fn()
    finally:
        if mhs.is_object_added_for_editing(c):
            mhs.remove_object_to_edit(c)


def body(c):
    cons = {str(k.name).lower().replace(" ", "_"): k for k in mhs.get_body_constraints(c)}
    log("body constraints: " + ", ".join(sorted(cons)))
    # Only the height changes (168, sheet). The preset's own build is held so the solver does not fall back to
    # its neutral body (height alone gave Aoi a man's build, 2026-09-30).
    for name in ("masculine/feminine", "fat", "muscularity"):
        cons[name].is_active = True
        log(f"hold {name} = {cons[name].target_measurement:.2f}")
    cons["height"].is_active = True
    cons["height"].target_measurement = 168.0
    mhs.set_body_constraints(c, list(cons.values()))
    mhs.commit_body_state(c)
    log("height 168 cm")


def grooms(c):
    coll = c.internal_collection
    keys = {}
    for slot, path in (("Hair", HAIR), ("Eyebrows", BROWS)):
        item = unreal.load_asset(path)
        if not item:
            log(f"missing {path}")
            continue
        key = coll.try_add_item_from_wardrobe_item(slot, item)
        ok = coll.default_instance.try_add_slot_selection(unreal.MetaHumanPipelineSlotSelection(slot_name=slot, selected_item=key))
        log(f"{slot}: key {key} selected={ok}")
        keys[slot] = key
    log("slots: " + ", ".join(str(n) for n in coll.get_slot_names()))
    log("items: " + ", ".join(str(k) for k in coll.get_all_item_keys()))
    mhs.assemble_for_preview(character=c)
    for slot, key in keys.items():
        params = coll.default_instance.get_instance_parameters(item_path=unreal.MetaHumanPaletteItemPath(item_key=key))
        log(f"{slot} params: " + ", ".join(str(p.name) for p in params))
        for p in params:
            if str(p.name) == "Melanin":
                p.set_float(value=1.0)          # black (sheet)
            elif str(p.name) == "Redness":
                p.set_float(value=0.0)


def eyes(c):
    s = None
    for attr in ("eyes_settings",):
        try:
            s = c.get_editor_property(attr)
        except Exception as e:
            log(f"no {attr}: {e}")
    if s is None:
        s = unreal.MetaHumanCharacterEyesSettings()
    red = unreal.LinearColor(1.0, 0.08, 0.06, 1.0)   # «붉은 눈» - the sheet's crimson iris
    for side in ("eye_left", "eye_right"):
        eye = s.get_editor_property(side)
        iris = eye.get_editor_property("iris")
        iris.set_editor_property("global_tint", red)
        iris.set_editor_property("global_saturation", 2.5)
        eye.set_editor_property("iris", iris)
        s.set_editor_property(side, eye)
    mhs.commit_eyes_settings(c, s)
    log("red iris")


def skin(c):
    try:
        s = c.get_editor_property("skin_settings")
    except Exception as e:
        log(f"no skin_settings: {e}")
        return
    p = s.get_editor_property("skin")
    log(f"skin before u={p.u:.2f} v={p.v:.2f}")
    p.u = min(p.u, 0.25)     # pale (sheet)
    p.v = min(p.v, 0.45)
    s.set_editor_property("skin", p)
    mhs.commit_skin_settings(c, s)
    log(f"skin u={p.u:.2f} v={p.v:.2f}")


def shots(c, out):
    os.makedirs(out, exist_ok=True)
    aes = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)
    aes.open_editor_for_assets(assets=[c])
    actor = mhs.spawn_meta_human_actor(character=c)
    if not actor:
        log("no preview actor")
        return
    actor.set_actor_location(unreal.Vector(0, 0, 0), False, False)
    actor.set_actor_rotation(unreal.Rotator(0, 0, 90), False)   # faces -X... set so it faces the front camera (+X)
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    light = eas.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 500), unreal.Rotator(-40, 200, 0))
    cap = eas.spawn_actor_from_class(unreal.SceneCapture2D, unreal.Vector(0, 0, 0))
    comp = cap.capture_component2d
    rt = unreal.RenderingLibrary.create_render_target2d(unreal.EditorLevelLibrary.get_editor_world(), 1024, 1536,
                                                        unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
    comp.texture_target = rt
    comp.capture_source = unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR
    unreal.SystemLibrary.execute_console_command(None, "r.Streaming.FullyLoadUsedTextures 1")
    views = (
        ("front", (-330, 0, 95), (0, 0, 92), 35),
        ("side", (0, 330, 95), (0, 0, 92), 35),
        ("face", (-55, 0, 158), (0, 0, 156), 30),
        ("face34", (-42, 34, 158), (0, 0, 156), 30),
    )
    state = {"t": 0.0, "done": False}

    def tick(dt):
        # the first frames show checker placeholders while shaders compile and textures stream: wait, then shoot
        state["t"] += dt
        if state["done"] or state["t"] < float(arg("HWMHWait", "60")):
            return
        state["done"] = True
        for name, loc, look, fov in views:
            L = unreal.Vector(*loc)
            cap.set_actor_location(L, False, False)
            cap.set_actor_rotation(unreal.MathLibrary.find_look_at_rotation(L, unreal.Vector(*look)), False)
            comp.fov_angle = fov
            comp.capture_scene()
            unreal.RenderingLibrary.export_render_target(unreal.EditorLevelLibrary.get_editor_world(), rt, out, f"ain_mh_{name}.png")
            log(f"shot {name}")
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()

    handle = unreal.register_slate_post_tick_callback(tick)
    return True


def main():
    c = character()
    if not c:
        raise RuntimeError("no MHC_Ain")
    edit(c, lambda: body(c))
    edit(c, lambda: (grooms(c), eyes(c), skin(c)))
    lib.save_loaded_asset(c)
    log(f"saved {DEST}; can build now: {mhs.can_build_meta_human(c)}")
    out = arg("HWMHShots")
    return shots(c, out) if out else False


waiting = False
try:
    waiting = main()
except Exception as e:
    unreal.log_error(f"[HWMH] FAIL {e}")
if arg("HWMHShots") and not waiting:
    unreal.SystemLibrary.quit_editor()
