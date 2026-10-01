"""MetaHuman lab (docs/design/176): base body (underwear) + hair for Ain and Sera, rendered for review.
Runs in the full editor (rendering on): UnrealEditor MHLab.uproject -ExecutePythonScript=lab_build.py
Each step logs to lab_log.txt; on the editor's ticks it frames each character and takes a screenshot, then quits.
"""
import json
import os
import traceback

import unreal

LOG = r"C:/w/mhlab/lab_log.txt"
SHOTS = r"C:/w/mhlab/shots"
os.makedirs(SHOTS, exist_ok=True)
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


eal = unreal.EditorAssetLibrary
sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
PRESETS = "/MetaHumanCharacter/Optional/Presets"
HAIR = "/MetaHumanCharacter/Optional/Grooms/Bindings/Hair"
BROWS = "/MetaHumanCharacter/Optional/Grooms/Bindings/Eyebrows"
LASH = "/MetaHumanCharacter/Optional/Grooms/Bindings/Eyelashes"
# candidates (preset survey: Aoi is a male body, MF -0.59) - one bob each to compare faces; Sera long straight
HEROES = {
    "Ain": {"preset": "Aera", "existing": True, "height": 0, "hair": "WI_Hair_M_BobStraight", "brows": "WI_Eyebrows_M_Thick", "lash": "WI_Eyelashes_S_Fine",
            "hair_params": {"hairmelanin": 1.0, "hairredness": 0.05, "desat": 0.0}},
    "Sera": {"preset": "Tuya", "existing": True, "height": 0, "hair": "WI_Hair_L_Straight", "brows": "WI_Eyebrows_M_Fine", "lash": "WI_Eyelashes_S_Fine",
             "hair_params": {"hairmelanin": 0.2, "hairredness": 0.0}, "skin_uv": (0.3, 0.35)},
}
state = {"chars": {}, "actors": {}}

# an empty level: the template map's landscape and sky got in the way
unreal.EditorLevelLibrary.new_level("/Game/LabEmpty")
try:
    log("presets", [a.split("/")[-1].split(".")[0] for a in eal.list_assets(PRESETS, recursive=False)])
    for name, spec in HEROES.items():
        dst = f"/Game/Heroes/MH_{name}"
        if spec.get("existing") and eal.does_asset_exist(dst):
            char = unreal.load_asset(dst)     # keep the conformed face (conform.py)
        else:
            if eal.does_asset_exist(dst):
                eal.delete_asset(dst)
            char = eal.duplicate_asset(f"{PRESETS}/{spec['preset']}", dst)
        log(name, "dup", char)
        ok = sub.try_add_object_to_edit(char)
        log(name, "edit", ok)
        cons = sub.get_body_constraints(char)
        log(name, "constraints", [(str(c.name), round(c.target_measurement, 1)) for c in cons][:40])
        # every measurement held at the preset's own value, only the height moved: activating height alone let the
        # rest fall back to the parametric default (a masculine body)
        if spec.get("height"):
            for c in cons:
                # all held: height could not move (173 stayed 173); only height alone: a masculine default body.
                # hold the shape axes (sex, fat, muscle) and the girths, free the lengths so the height can move
                nm = str(c.name).lower()
                c.is_active = nm in ("height", "masculine/feminine", "fat", "muscularity", "chest", "waist", "hip", "underbust", "bust span")
                if nm == "height":
                    c.target_measurement = spec["height"]
            sub.set_body_constraints(char, cons)
            sub.commit_body_state(char)
            log(name, "height now", [round(c.target_measurement, 1) for c in sub.get_body_constraints(char) if str(c.name) == "Height"])
        # underwear on (top and bottom): the base for every outfit
        skin = char.get_editor_property("skin_settings")
        props = skin.get_editor_property("skin")
        props.set_editor_property("show_top_underwear", True)
        if spec.get("skin_uv"):
            props.set_editor_property("u", spec["skin_uv"][0])
            props.set_editor_property("v", spec["skin_uv"][1])
        skin.set_editor_property("skin", props)
        sub.commit_skin_settings(char, skin)
        # grooms from the wardrobe
        coll = char.get_editor_property("internal_collection")
        log(name, "slots", [str(s) for s in coll.get_slot_names()])
        inst = coll.get_editor_property("default_instance")
        for slot, item in (("Hair", f"{HAIR}/{spec['hair']}"), ("Eyebrows", f"{BROWS}/{spec['brows']}"), ("Eyelashes", f"{LASH}/{spec['lash']}")):
            wi = unreal.load_asset(item)
            key = coll.try_add_item_from_wardrobe_item(slot, wi)
            spec.setdefault("_keys", {})[slot] = key
            log(name, "add", slot, item.split("/")[-1], key)
            if key is not None:
                try:
                    inst.set_single_slot_selection(slot, key if not isinstance(key, tuple) else key[-1])
                except Exception as e:  # noqa: BLE001
                    log(name, "select err", slot, e)
        # underwear only: no garment, no beard or moustache from the template
        for slot in ("Outfits", "Top Garment", "Bottom Garment", "Beard", "Mustache"):
            try:
                inst.set_single_slot_selection(slot, unreal.MetaHumanPaletteItemKey())
            except Exception as e:  # noqa: BLE001
                log(name, "clear err", slot, e)
        try:
            for selx in inst.get_slot_selection_data():
                path = unreal.MetaHumanPipelineSlotSelectionBlueprintLibrary.get_selected_item_path(selx.selection)
                slot = unreal.MetaHumanPipelineSlotSelectionBlueprintLibrary.get_selected_slot_name(selx.selection)
                if str(slot) not in ("Hair", "Eyebrows"):
                    continue
                params = inst.get_instance_parameters(path)
                log(name, "params", slot, [(str(pp.name), str(pp.type)) for pp in params][:40])
                for pp in params:
                    pn = str(pp.name)
                    want = spec.get("hair_params", {}).get(pn)
                    if want is None:
                        continue
                    if isinstance(want, tuple):
                        pp.set_color(unreal.LinearColor(*want))
                    else:
                        pp.set_float(float(want))
                    log(name, "  set", slot, pn, want)
        except Exception:
            log(name, "PARAM ERROR", traceback.format_exc())
        sel = inst.get_slot_selection_data() if hasattr(inst, "get_slot_selection_data") else None
        log(name, "selections", sel)
        # the real output: an OPTIMIZED (game/mobile) build into /Game/Heroes/Built/<name>
        try:
            bp = unreal.MetaHumanCharacterEditorBuildParameters()
            bp.set_editor_property("pipeline_type", unreal.MetaHumanDefaultPipelineType.OPTIMIZED)
            bp.set_editor_property("pipeline_quality", unreal.MetaHumanQualityLevel.MEDIUM)
            bp.set_editor_property("absolute_build_path", f"/Game/Heroes/Built/{name}")
            bp.set_editor_property("common_folder_path", "/Game/Heroes/Built/Common")
            log(name, "can build (before rig)", sub.can_build_meta_human(char))
            try:
                rp = unreal.MetaHumanCharacterAutoRiggingRequestParams()
                rp.set_editor_property("rig_type", unreal.MetaHumanRigType.JOINTS_ONLY)
                rp.set_editor_property("blocking", True)
                rp.set_editor_property("report_progress", False)
                sub.request_auto_rigging(char, rp)
                log(name, "auto-rig requested")
            except Exception:
                log(name, "AUTORIG ERROR", traceback.format_exc())
            try:
                tp = unreal.MetaHumanCharacterTextureRequestParams()
                for k, v in (("blocking", True), ("report_progress", False)):
                    try:
                        tp.set_editor_property(k, v)
                    except Exception:
                        pass
                log(name, "texture params", tp.to_dict() if hasattr(tp, "to_dict") else tp)
                sub.request_texture_sources(char, tp)
                log(name, "texture sources requested")
            except Exception:
                log(name, "TEXTURE ERROR", traceback.format_exc())
            log(name, "can build", sub.can_build_meta_human(char))
            sub.build_meta_human(char, bp)
            # hair colour: the groom item's instance parameters - filled only after assemble_for_preview (Epic docs)
            sub.assemble_for_preview(char)
            changed = False
            paths = inst.get_instance_parameter_item_paths()
            log(name, "param item paths", [str(pth) for pth in paths][:20])
            for pth in paths:
                params = inst.get_instance_parameters(pth)
                log(name, "  path params", str(pth)[:120], [(str(pp.name), str(pp.type)) for pp in params][:30])
                log(name, "hair params after build", [(str(pp.name), str(pp.type)) for pp in params])
                for pp in params:
                    for key, val in spec.get("hair_params", {}).items():
                        if key in str(pp.name).lower() and str(pp.type).endswith("FLOAT"):
                            pp.set_float(val)
                            changed = True
                            log(name, "  hair", pp.name, val)
            if changed:
                sub.build_meta_human(char, bp)
                log(name, "rebuilt with hair colour")
            # hair colour on the built groom materials (the Creator's instance parameters are empty from a script)
            L = unreal.MaterialEditingLibrary
            for a in eal.list_assets(f"/Game/Heroes/Built/{name}/MH_{name}/Grooms", recursive=True):
                mi = unreal.load_asset(a)
                if not isinstance(mi, unreal.MaterialInstanceConstant) or "_Hair" not in a.split("/")[-1]:
                    continue
                par = mi.get_editor_property("parent")
                names = [str(x) for x in L.get_scalar_parameter_names(par)] if par else []
                if "Hair_M" in a or "Hair_L" in a or "Hair_S" in a:
                    log(name, "hair MI", a.split("/")[-1].split(".")[0], "parent", par.get_name() if par else None, names[:60])
                for key, val in spec.get("hair_params", {}).items():
                    for pn in names:
                        if pn.lower() == key or pn.lower().replace(" ", "") == key:
                            L.set_material_instance_scalar_parameter_value(mi, pn, val)
                            log(name, "  set", a.split("/")[-1].split(".")[0], pn, val)
                eal.save_loaded_asset(mi)
            eal.save_directory("/Game/Heroes/Built", only_if_is_dirty=False, recursive=True)
            log(name, "built:", [a.split(".")[0] for a in eal.list_assets(f"/Game/Heroes/Built/{name}", recursive=True)][:40])
        except Exception:
            log(name, "BUILD ERROR", traceback.format_exc())
        bp_asset = unreal.load_asset(f"/Game/Heroes/Built/{name}/MH_{name}/BP_MH_{name}")
        actor = unreal.EditorLevelLibrary.spawn_actor_from_object(bp_asset, unreal.Vector(0, 0, 0), unreal.Rotator(pitch=0, yaw=0, roll=0)) if bp_asset else sub.spawn_meta_human_actor(char, True)
        actor.set_actor_location(unreal.Vector(200 * len(state["actors"]), 0, 0), False, False)
        state["chars"][name] = char
        state["actors"][name] = actor
        log(name, "actor", actor.get_name(), "at", actor.get_actor_location(), "rot", actor.get_actor_rotation())
        for comp in actor.get_components_by_class(unreal.PrimitiveComponent):
            asset = None
            if isinstance(comp, unreal.SkeletalMeshComponent):
                asset = comp.get_skeletal_mesh_asset()
            elif isinstance(comp, unreal.GroomComponent):
                asset = comp.get_editor_property("groom_asset")
            log(name, "  comp", comp.get_name(), type(comp).__name__, asset.get_name() if asset else None, "vis", comp.is_visible())
        origin, extent = actor.get_actor_bounds(False)
        log(name, "  bounds", origin, extent)
        eal.save_loaded_asset(char)
except Exception:
    log("ERROR", traceback.format_exc())

# light + camera: a MetaHuman faces +Y, so the cameras stand on +Y looking back
try:
    unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 300, 400), unreal.Rotator(pitch=-35, yaw=-110, roll=0))
    sky = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 300), unreal.Rotator(pitch=0, yaw=0, roll=0))
    sky.light_component.set_editor_property("intensity", 1.5)
    sky.light_component.set_editor_property("source_type", unreal.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP)
    sky.light_component.set_editor_property("cubemap", unreal.load_asset("/Engine/MapTemplates/Sky/SunsetAmbientCubemap"))
    sky.light_component.recapture_sky()
    floor = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(100, 0, 0), unreal.Rotator(pitch=0, yaw=0, roll=0))
    floor.static_mesh_component.set_static_mesh(unreal.load_asset("/Engine/BasicShapes/Plane"))
    floor.set_actor_scale3d(unreal.Vector(10, 10, 1))
    cams = {}
    for i, name in enumerate(state["actors"]):
        x = 200 * i
        # NB unreal.Rotator(a, b, c) is (roll, pitch, yaw) positionally - always keywords. Built MetaHuman faces +Y? test both
        for view, (loc, rot, fov) in {"full": (unreal.Vector(x, -420, 95), unreal.Rotator(pitch=0, yaw=90, roll=0), 40.0),
                                      "head": (unreal.Vector(x, 80, 160), unreal.Rotator(pitch=-3, yaw=-90, roll=0), 30.0),
                                      "side": (unreal.Vector(x + 90, -330, 95), unreal.Rotator(pitch=0, yaw=75, roll=0), 40.0),
                                      "back": (unreal.Vector(x, 420, 95), unreal.Rotator(pitch=0, yaw=-90, roll=0), 40.0)}.items():
            cam = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.CameraActor, loc, rot)
            cam.camera_component.set_editor_property("field_of_view", fov)
            cams[f"{name}_{view}"] = cam
except Exception:
    log("ERROR scene", traceback.format_exc())

ticks = {"n": 0, "queue": list(cams.items()) if 'cams' in dir() else []}
# a second round much later: a changed hair material recompiles its shaders and the long groom stays invisible till then
ticks["late"] = [(k + "_late", c) for k, c in ticks["queue"]]


def on_tick(dt):
    ticks["n"] += 1
    n = ticks["n"]
    if n < 1500:          # let shaders, grooms and textures settle
        return
    if ticks["queue"] and n % 40 == 0:
        key, cam = ticks["queue"].pop(0)
        # a scene capture into a render target, exported as PNG (high-res screenshots need a game viewport)
        world = unreal.EditorLevelLibrary.get_editor_world()
        rt = unreal.RenderingLibrary.create_render_target2d(world, 1024, 1280 if key.endswith("full") else 1024,
                                                            unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
        cap = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SceneCapture2D, cam.get_actor_location(), cam.get_actor_rotation())
        cc = cap.capture_component2d
        cc.set_editor_property("texture_target", rt)
        cc.set_editor_property("fov_angle", cam.camera_component.field_of_view)
        cc.set_editor_property("capture_source", unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
        cc.capture_scene()
        unreal.RenderingLibrary.export_render_target(world, rt, SHOTS, f"{key}.png")
        log("shot", key)
    if not ticks["queue"] and ticks.get("late") and n > 3000:
        ticks["queue"] = ticks.pop("late")
        return
    if not ticks["queue"] and "late" not in ticks and n > 3000 + 40 * 10:
        log("done")
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()


handle = unreal.register_slate_post_tick_callback(on_tick)
