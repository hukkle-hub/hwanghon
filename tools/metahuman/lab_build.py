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
    "Ain": {"preset": "Aera", "existing": os.environ.get("MH_EXISTING") == "1", "skin_uv": (0.0, 0.75), "height": 0, "hair": "WI_Hair_M_BobStraight", "brows": None, "lash": "WI_Eyelashes_S_Fine",
            "hair_params": {"hairmelanin": 1.0, "hairredness": 0.05, "desat": 0.0}},
    "Sera": {"preset": "Aera", "existing": os.environ.get("MH_EXISTING") == "1", "height": 0, "hair": "WI_Hair_L_Straight", "brows": None, "lash": "WI_Eyelashes_S_Fine",
             "skin_uv": (0.0, 0.75)},   # silver hair: changing the groom material hid the long groom - left at default for now
}
HEROES = {k: v for k, v in HEROES.items() if not os.environ.get("MH_ONLY") or k == os.environ["MH_ONLY"]}
for _k, _v in HEROES.items():
    if os.environ.get("MH_HAIR"):
        _v["hair"] = os.environ["MH_HAIR"]
    if os.environ.get("MH_HAIR_PARAMS"):     # "Melanin=1,Whiteness=0" - the groom item's instance parameters
        _v["groom_params"] = {a.split("=")[0]: float(a.split("=")[1]) for a in os.environ["MH_HAIR_PARAMS"].split(",")}
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
        # a dark scalp under the hair mesh: the gaps between its clumps showed the pale scalp as a light spot
        if os.environ.get("MH_SCALP_DARK") == "1":
            try:
                acc = skin.get_editor_property("accents")
                sr = acc.get_editor_property("scalp")
                sr.set_editor_property("lightness", 0.0)
                sr.set_editor_property("saturation", 0.0)
                acc.set_editor_property("scalp", sr)
                skin.set_editor_property("accents", acc)
            except Exception as e:  # noqa: BLE001
                log(name, "scalp err", e)
        # the design sheets: clean pale skin, no freckles
        try:
            fr = skin.get_editor_property("freckles")
            fr.set_editor_property("density", 0.0)
            skin.set_editor_property("freckles", fr)
        except Exception as e:  # noqa: BLE001
            log(name, "freckles err", e)
        # painted face base colour (brows from the design, doc 177 §14) as the official texture override
        if os.environ.get("MH_FACE_BC"):
            try:
                ti = unreal.AssetImportTask()
                for k, v in (("filename", os.environ["MH_FACE_BC"]), ("destination_path", f"/Game/FaceTex/{name}"), ("automated", True),
                             ("save", True), ("replace_existing", True)):
                    ti.set_editor_property(k, v)
                unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([ti])
                # by the file's own name: the folder keeps older paintings and the first one was picked (arched brows
                # came back after the straight ones were painted)
                want = os.path.splitext(os.path.basename(os.environ["MH_FACE_BC"]))[0]
                ftex = unreal.load_asset(f"/Game/FaceTex/{name}/{want}")
                tmo = skin.get_editor_property("texture_material_overrides")
                tmo.set_editor_property("enable_texture_overrides", True)
                tso = tmo.get_editor_property("texture_overrides")
                face_map = tso.get_editor_property("face")
                face_map[unreal.FaceTextureType.BASECOLOR] = ftex
                tso.set_editor_property("face", face_map)
                tmo.set_editor_property("texture_overrides", tso)
                skin.set_editor_property("texture_material_overrides", tmo)
                log(name, "face base colour override", ftex)
            except Exception:
                log(name, "FACE TEX ERROR", traceback.format_exc())
        sub.commit_skin_settings(char, skin)
        # iris colour from the design sheet (Ain: red eyes) - global tint + saturation on both eyes, smaller pupil
        if os.environ.get("MH_IRIS_TINT"):
            r_, g_, b_ = (float(x) for x in os.environ["MH_IRIS_TINT"].split(","))
            es = char.get_editor_property("eyes_settings")
            for side in ("eye_left", "eye_right"):
                e = es.get_editor_property(side)
                ir = e.get_editor_property("iris")
                ir.set_editor_property("global_tint", unreal.LinearColor(r_, g_, b_, 1.0))
                ir.set_editor_property("global_saturation", float(os.environ.get("MH_IRIS_SAT", "2.0")))
                if os.environ.get("MH_IRIS_UV"):
                    iu, iv = (float(x) for x in os.environ["MH_IRIS_UV"].split(","))
                    ir.set_editor_property("primary_color_u", iu)
                    ir.set_editor_property("primary_color_v", iv)
                e.set_editor_property("iris", ir)
                pu = e.get_editor_property("pupil")
                pu.set_editor_property("dilation", float(os.environ.get("MH_PUPIL", "0.95")))
                e.set_editor_property("pupil", pu)
                es.set_editor_property(side, e)
            sub.commit_eyes_settings(char, es)
            log(name, "iris tint", os.environ["MH_IRIS_TINT"])
        # grooms from the wardrobe
        coll = char.get_editor_property("internal_collection")
        log(name, "slots", [str(s) for s in coll.get_slot_names()])
        inst = coll.get_editor_property("default_instance")
        # brows None: no brow groom. Its strands render pale even at melanin 1 and hide the dark brows painted in the
        # skin texture (doc 177 probe) - the painted ones read like the design
        for slot, item in (("Hair", f"{HAIR}/{spec['hair']}"), ("Eyebrows", f"{BROWS}/{spec['brows']}" if spec.get("brows") else None), ("Eyelashes", f"{LASH}/{spec['lash']}")):
            if item is None:
                inst.set_single_slot_selection(slot, unreal.MetaHumanPaletteItemKey())
                log(name, "cleared", slot)
                continue
            wi = unreal.load_asset(item)
            key = coll.try_add_item_from_wardrobe_item(slot, wi)
            spec.setdefault("_keys", {})[slot] = key
            log(name, "add", slot, item.split("/")[-1], key)
            if key is not None:
                try:
                    inst.set_single_slot_selection(slot, key if not isinstance(key, tuple) else key[-1])
                except Exception as e:  # noqa: BLE001
                    log(name, "select err", slot, e)
        # hair colour the way Epic's test does it: the PREVIEW collection -> select -> on_edit_preview_collection ->
        # assemble_for_preview -> the groom item's instance parameters (Melanin, Redness, Whiteness, Lightness...) ->
        # on_edit_preview_collection again (the internal collection's parameters stayed empty from a script)
        if spec.get("groom_params"):
            try:
                pc = sub.get_preview_collection(char)
                pinst = pc.get_editor_property("default_instance")
                pkey = pc.try_add_item_from_wardrobe_item("Hair", unreal.load_asset(f"{HAIR}/{spec['hair']}"))
                pinst.set_single_slot_selection("Hair", pkey)
                # the preview collection still held the preset's brow groom, and on_edit_preview_collection copied it
                # back over the cleared slot (Eyebrows_L_Shaded came back over the painted brows)
                if not spec.get("brows"):
                    pinst.set_single_slot_selection("Eyebrows", unreal.MetaHumanPaletteItemKey())
                sub.on_edit_preview_collection(char)
                sub.assemble_for_preview(char)
                for pp in pinst.get_instance_parameters(unreal.MetaHumanPaletteItemPath(item_key=pkey)):
                    if str(pp.name) in spec["groom_params"]:
                        pp.set_float(spec["groom_params"][str(pp.name)])
                        log(name, "  groom param", pp.name, spec["groom_params"][str(pp.name)])
                sub.on_edit_preview_collection(char)
                inst = coll.get_editor_property("default_instance")
            except Exception:
                log(name, "GROOM PARAM ERROR", traceback.format_exc())
        # brows the same way (the brow groom rendered pale when its built materials were edited - doc 177 §4.1)
        if os.environ.get("MH_BROW"):
            try:
                pc = sub.get_preview_collection(char)
                pinst = pc.get_editor_property("default_instance")
                bkey = pc.try_add_item_from_wardrobe_item("Eyebrows", unreal.load_asset(f"{BROWS}/{os.environ['MH_BROW']}"))
                pinst.set_single_slot_selection("Eyebrows", bkey)
                sub.on_edit_preview_collection(char)
                sub.assemble_for_preview(char)
                bp_ = {a.split("=")[0]: float(a.split("=")[1]) for a in os.environ.get("MH_BROW_PARAMS", "Melanin=1").split(",")}
                for pp in pinst.get_instance_parameters(unreal.MetaHumanPaletteItemPath(item_key=bkey)):
                    if str(pp.name) in bp_:
                        pp.set_float(bp_[str(pp.name)])
                        log(name, "  brow param", pp.name, bp_[str(pp.name)])
                sub.on_edit_preview_collection(char)
            except Exception:
                log(name, "BROW PARAM ERROR", traceback.format_exc())
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
            bp.set_editor_property("pipeline_quality", getattr(unreal.MetaHumanQualityLevel, os.environ.get("MH_QUALITY", "MEDIUM")))
            bp.set_editor_property("absolute_build_path", f"/Game/Heroes/Built/{name}")
            bp.set_editor_property("common_folder_path", "/Game/Heroes/Built/Common")
            log(name, "can build (before rig)", sub.can_build_meta_human(char))
            try:
                rp = unreal.MetaHumanCharacterAutoRiggingRequestParams()
                rp.set_editor_property("rig_type", unreal.MetaHumanRigType.JOINTS_ONLY)
                rp.set_editor_property("blocking", True)
                rp.set_editor_property("report_progress", False)
                if os.environ.get("MH_SKIP_RIG") == "1":
                    log(name, "auto-rig skipped (whole-rig DNA)")
                else:
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
                if not isinstance(mi, unreal.MaterialInstanceConstant) or not any(t in a.split("/")[-1] for t in ("_Hair", "Eyebrow", "Brow")):
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
            # the painted face base colour over the BAKED head textures the build made (the skin texture override
            # did not reach the optimized build: the painted brows never showed, measured)
            if os.environ.get("MH_FACE_BC"):
                bdir = f"/Game/Heroes/Built/{name}/MH_{name}/Face/Baked"
                for lod in ("T_Head_LOD1_BC", "T_Head_LOD3_BC", "T_Head_LOD5to7_BC"):
                    if not eal.does_asset_exist(f"{bdir}/{lod}"):
                        continue
                    old = unreal.load_asset(f"{bdir}/{lod}")
                    srgb, comp = old.get_editor_property("srgb"), old.get_editor_property("compression_settings")
                    ti = unreal.AssetImportTask()
                    for k, v in (("filename", os.environ["MH_FACE_BC"]), ("destination_path", bdir), ("destination_name", lod),
                                 ("automated", True), ("save", True), ("replace_existing", True)):
                        ti.set_editor_property(k, v)
                    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([ti])
                    new = unreal.load_asset(f"{bdir}/{lod}")
                    new.set_editor_property("srgb", srgb)
                    new.set_editor_property("compression_settings", comp)
                    eal.save_loaded_asset(new)
                    log(name, "baked face texture replaced", lod, new.blueprint_get_size_x())
                    # re-point the skin material at the reimported object: in this session the MI kept drawing the old
                    # texture (a fresh session showed the painting, measured with a red test block)
                    new.set_force_mip_levels_to_be_resident(600.0, 0)   # shots: the painted brows read as a blur at low mips
                    mi_ = unreal.load_asset(f"/Game/Heroes/Built/{name}/MH_{name}/Face/Materials/MI_Face_Skin_Baked_{lod.split('_')[2]}")
                    if mi_:
                        unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mi_, "Basecolor Baked", new)
                        unreal.MaterialEditingLibrary.update_material_instance(mi_)
                        eal.save_loaded_asset(mi_)
            eal.save_directory("/Game/Heroes/Built", only_if_is_dirty=False, recursive=True)
            log(name, "built:", [a.split(".")[0] for a in eal.list_assets(f"/Game/Heroes/Built/{name}", recursive=True)][:40])
        except Exception:
            log(name, "BUILD ERROR", traceback.format_exc())
        bp_asset = unreal.load_asset(f"/Game/Heroes/Built/{name}/MH_{name}/BP_MH_{name}")
        actor = unreal.EditorLevelLibrary.spawn_actor_from_object(bp_asset, unreal.Vector(0, 0, 0), unreal.Rotator(pitch=0, yaw=0, roll=0)) if bp_asset else sub.spawn_meta_human_actor(char, True)
        actor.set_actor_location(unreal.Vector(200 * len(state["actors"]), 0, 0), False, False)
        # option 1 (doc 177): the Hi3D head itself on the MetaHuman. The MetaHuman's own face mesh is switched off
        # (its grooms - hair, brows - keep their binding), the Hi3D head goes on the head bone, crown on the face's crown.
        try:
            hm = unreal.load_asset(f"/Game/Conform/{name}/{name.lower()}_head/StaticMeshes/{name.lower()}_head") if os.environ.get("MH_OVERLAY") == "1" else None
            # the design's hair as a mesh (fit_hair.py + place_on_state.py), on the head bone; the groom slot is empty
            if os.environ.get("MH_HAIR_MESH"):
                # a fresh folder each time: with the cap the FBX holds two meshes, Interchange makes one asset per mesh,
                # and the old single asset was picked up again (the cap never showed)
                hdir = f"/Game/HairMesh/{name}"
                if eal.does_directory_exist(hdir):
                    eal.delete_directory(hdir)
                ML = unreal.MaterialEditingLibrary
                tools = unreal.AssetToolsHelpers.get_asset_tools()

                def import_file(path):
                    t = unreal.AssetImportTask()
                    for k, v in (("filename", path), ("destination_path", hdir), ("automated", True), ("save", True), ("replace_existing", True)):
                        t.set_editor_property(k, v)
                    tools.import_asset_tasks([t])

                def const_mat(nm, rgb, rough_):
                    m_ = tools.create_asset(nm, hdir, unreal.Material, unreal.MaterialFactoryNew())
                    c_ = ML.create_material_expression(m_, unreal.MaterialExpressionConstant3Vector, -400, 0)
                    c_.set_editor_property("constant", unreal.LinearColor(*rgb, 1))
                    ML.connect_material_property(c_, "", unreal.MaterialProperty.MP_BASE_COLOR)
                    r_ = ML.create_material_expression(m_, unreal.MaterialExpressionConstant, -400, 200)
                    r_.set_editor_property("r", rough_)
                    ML.connect_material_property(r_, "", unreal.MaterialProperty.MP_ROUGHNESS)
                    ML.recompile_material(m_)
                    eal.save_loaded_asset(m_)
                    return m_

                import_file(os.environ["MH_HAIR_MESH"])
                # the hair material from the Hi3D albedo (the FBX's embedded texture did not come through)
                mat = None
                base_ = os.path.splitext(os.environ["MH_HAIR_MESH"])[0]
                alb = base_ + "_albedo.png"
                brow_png = base_ + "_brows_albedo.png"
                if os.path.exists(brow_png):
                    import_file(brow_png)
                texs = [unreal.load_asset(x) for x in eal.list_assets(hdir, recursive=True) if isinstance(unreal.load_asset(x), unreal.Texture2D)]
                brow_mat = None
                btex = next((t_ for t_ in texs if "brows" in t_.get_name().lower()), None)
                if btex:
                    # brows decal: light skin transparent, the painted brow opaque (opacity = 1 - (lum - 0.18) * 3.5: softer edge - at x7 it read as a black bar)
                    brow_mat = tools.create_asset(f"M_{name}_Brows", hdir, unreal.Material, unreal.MaterialFactoryNew())
                    brow_mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_MASKED)
                    tsb = ML.create_material_expression(brow_mat, unreal.MaterialExpressionTextureSample, -800, 0)
                    tsb.set_editor_property("texture", btex)
                    lw = ML.create_material_expression(brow_mat, unreal.MaterialExpressionConstant3Vector, -800, 300)
                    lw.set_editor_property("constant", unreal.LinearColor(0.2126, 0.7152, 0.0722, 1))
                    dot = ML.create_material_expression(brow_mat, unreal.MaterialExpressionDotProduct, -600, 200)
                    ML.connect_material_expressions(tsb, "RGB", dot, "A")
                    ML.connect_material_expressions(lw, "", dot, "B")
                    sub_ = ML.create_material_expression(brow_mat, unreal.MaterialExpressionSubtract, -450, 200)
                    sub_.set_editor_property("const_b", 0.18)
                    ML.connect_material_expressions(dot, "", sub_, "A")
                    mul_ = ML.create_material_expression(brow_mat, unreal.MaterialExpressionMultiply, -300, 200)
                    mul_.set_editor_property("const_b", 3.5)
                    ML.connect_material_expressions(sub_, "", mul_, "A")
                    om_ = ML.create_material_expression(brow_mat, unreal.MaterialExpressionOneMinus, -150, 200)
                    ML.connect_material_expressions(mul_, "", om_, "")
                    sat_ = ML.create_material_expression(brow_mat, unreal.MaterialExpressionSaturate, -50, 200)
                    ML.connect_material_expressions(om_, "", sat_, "")
                    ML.connect_material_property(sat_, "", unreal.MaterialProperty.MP_OPACITY_MASK)
                    ML.connect_material_property(tsb, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
                    rb = ML.create_material_expression(brow_mat, unreal.MaterialExpressionConstant, -300, 400)
                    rb.set_editor_property("r", 0.8)
                    ML.connect_material_property(rb, "", unreal.MaterialProperty.MP_ROUGHNESS)
                    ML.recompile_material(brow_mat)
                    eal.save_loaded_asset(brow_mat)
                cards_tex = os.environ.get("MH_HAIR_TEX", "")
                if cards_tex:
                    alb = cards_tex                      # hair cards: strand texture with alpha (make_hair_cards.py)
                if os.path.exists(alb):
                    import_file(alb)
                    want_ = os.path.splitext(os.path.basename(alb))[0]
                    tex = unreal.load_asset(f"{hdir}/{want_}")
                    mat = tools.create_asset(f"M_{name}_HairMesh", hdir, unreal.Material, unreal.MaterialFactoryNew())
                    ts = ML.create_material_expression(mat, unreal.MaterialExpressionTextureSample, -400, 0)
                    ts.set_editor_property("texture", tex)
                    ML.connect_material_property(ts, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
                    if cards_tex:
                        mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_MASKED)
                        mat.set_editor_property("opacity_mask_clip_value", 0.35)
                        ML.connect_material_property(ts, "A", unreal.MaterialProperty.MP_OPACITY_MASK)
                    rough = ML.create_material_expression(mat, unreal.MaterialExpressionConstant, -400, 200)
                    rough.set_editor_property("r", float(os.environ.get("MH_HAIR_ROUGH", "0.75")))   # 0.42 read as plastic
                    ML.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
                    spec = ML.create_material_expression(mat, unreal.MaterialExpressionConstant, -400, 300)
                    spec.set_editor_property("r", float(os.environ.get("MH_HAIR_SPEC", "0.2")))
                    ML.connect_material_property(spec, "", unreal.MaterialProperty.MP_SPECULAR)
                    mat.set_editor_property("two_sided", True)
                    ML.recompile_material(mat)
                    eal.save_loaded_asset(mat)
                cap = const_mat(f"M_{name}_HairCap", tuple(float(x) for x in os.environ.get("MH_CAP_COLOR", "0.008,0.008,0.01").split(",")), 0.7)
                face = next((c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name() == "Face"), None)
                hsm = None
                for x in eal.list_assets(hdir, recursive=True):
                    sm_ = unreal.load_asset(x)
                    if not isinstance(sm_, unreal.StaticMesh):
                        continue
                    is_cap = "cap" in sm_.get_name().lower() or any("cap" in str(q.material_slot_name).lower() for q in sm_.static_materials)
                    is_brow = "brow" in sm_.get_name().lower()
                    for i_ in range(len(sm_.static_materials)):
                        sm_.set_material(i_, cap if is_cap else (brow_mat if (is_brow and brow_mat) else (mat or cap)))
                    eal.save_loaded_asset(sm_)
                    ha = unreal.EditorLevelLibrary.spawn_actor_from_object(sm_, actor.get_actor_location(), unreal.Rotator(pitch=0, yaw=0, roll=0))
                    ha.attach_to_component(face, "head", unreal.AttachmentRule.KEEP_WORLD, unreal.AttachmentRule.KEEP_WORLD, unreal.AttachmentRule.KEEP_WORLD, False)
                    log(name, "hair part", sm_.get_name(), "cap" if is_cap else ("brows" if is_brow else "hair"), "verts", sm_.get_num_vertices(0))
                    hsm = hsm or (None if (is_cap or is_brow) else sm_)
                for c in actor.get_components_by_class(unreal.GroomComponent):
                    if c.get_name() == "Hair" and os.environ.get("MH_KEEP_GROOM") != "1":
                        c.set_visibility(False, False)
                log(name, "hair mesh", hsm, "bounds", hsm.get_bounds().box_extent if hsm else None)
            face = next((c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name() == "Face"), None)
            if hm and face:
                fo, fe = face.get_editor_property("bounds").origin, face.get_editor_property("bounds").box_extent
                crown = fo.z + fe.z
                hbw = face.get_socket_location("head")
                hb = hm.get_bounds()
                top = hb.origin.z + hb.box_extent.z
                loc = unreal.Vector(hbw.x - hb.origin.x, hbw.y - hb.origin.y + 1.5, crown - top)
                ha = unreal.EditorLevelLibrary.spawn_actor_from_object(hm, loc, unreal.Rotator(pitch=0, yaw=0, roll=0))
                ha.attach_to_component(face, "head", unreal.AttachmentRule.KEEP_WORLD, unreal.AttachmentRule.KEEP_WORLD, unreal.AttachmentRule.KEEP_WORLD, False)
                face.set_visibility(False, False)
                log(name, "hi3d head on", "crown", round(crown, 1), "headbone", hbw, "loc", loc)
            # strand hair from the design shape (make_hair_groom.py -> Alembic) on the head bone, the built hair MI on it
            GROOM_FIX = []
            if os.environ.get("MH_GROOM_ABC"):
                ML = unreal.MaterialEditingLibrary
                tools = unreal.AssetToolsHelpers.get_asset_tools()
                gdir = f"/Game/GroomCustom/{name}"
                if eal.does_directory_exist(gdir):
                    eal.delete_directory(gdir)
                gt = unreal.AssetImportTask()
                for k, v in (("filename", os.environ["MH_GROOM_ABC"]), ("destination_path", gdir), ("automated", True), ("save", True), ("replace_existing", True)):
                    gt.set_editor_property(k, v)
                gopt = unreal.GroomImportOptions()
                cs = gopt.get_editor_property("conversion_settings")
                rx, sy = (float(x) for x in os.environ.get("MH_GROOM_CONV", "90,-1").split(","))
                cs.set_editor_property("rotation", unreal.Vector(rx, 0, 0))
                cs.set_editor_property("scale", unreal.Vector(100, 100 * sy, 100))
                gopt.set_editor_property("conversion_settings", cs)
                gt.set_editor_property("options", gopt)
                gt.set_editor_property("factory", unreal.HairStrandsFactory())   # else the Alembic static-mesh factory takes it
                unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([gt])
                gasset = next((unreal.load_asset(x) for x in eal.list_assets(gdir, recursive=True) if isinstance(unreal.load_asset(x), unreal.GroomAsset)), None)
                log(name, "groom asset", gasset)
                if gasset:
                    ga = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.GroomActor, actor.get_actor_location(), unreal.Rotator(pitch=0, yaw=0, roll=0))
                    gc = ga.get_editor_property("groom_component")
                    gc.set_editor_property("groom_asset", gasset)
                    hmi = None
                    for x in eal.list_assets(f"/Game/Heroes/Built/{name}/MH_{name}/Grooms", recursive=True):
                        nm_ = x.split("/")[-1].split(".")[0]
                        if nm_.startswith("MI_WI_Hair") and nm_.endswith("_Hair"):
                            hmi = unreal.load_asset(x)
                            break
                    if hmi:
                        # the built MI is the preset colour (the character's melanin etc. reach only its own groom
                        # components at runtime) -> a child MI with MH_HAIR_PARAMS baked in
                        names_ = [str(x) for x in ML.get_scalar_parameter_names(hmi)]
                        log(name, "groom MI scalars", names_)
                        cmi = tools.create_asset(f"MI_{name}_GroomCustom", gdir, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
                        ML.set_material_instance_parent(cmi, hmi)
                        for kv in os.environ.get("MH_HAIR_PARAMS", "").split(","):
                            if "=" in kv:
                                k_, v_ = kv.split("=")
                                k2 = {"melanin": "hairMelanin", "redness": "hairRedness", "whiteness": "WhiteAmount"}.get(k_.strip().lower(), k_.strip())
                                hit = [x for x in names_ if x.lower() == k2.lower()]
                                if hit:
                                    ML.set_material_instance_scalar_parameter_value(cmi, unreal.Name(hit[0]), float(v_))
                                log(name, "groom MI set", k_, v_, "found" if hit else "MISSING")
                        ML.update_material_instance(cmi)
                        eal.save_loaded_asset(cmi)        # unsaved, its overrides were lost after later imports (hair went blond)
                        gc.set_material(0, cmi)
                        GROOM_FIX.append((gc, cmi))
                    face_ = next((c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name() == "Face"), None)
                    ga.attach_to_component(face_, "head", unreal.AttachmentRule.KEEP_WORLD, unreal.AttachmentRule.KEEP_WORLD, unreal.AttachmentRule.KEEP_WORLD, False)
                    for c in actor.get_components_by_class(unreal.GroomComponent):
                        if c.get_name() == "Hair":
                            c.set_visibility(False, False)
                    o_, e_ = ga.get_actor_bounds(False)
                    log(name, "groom actor", ga.get_name(), "material", hmi, "bounds origin", o_, "extent", e_)
            # debug: paint chosen face material slots in flat colours to see which mesh is which (MH_DEBUG_SLOTS=a,b,c)
            face_d = next((c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name() == "Face"), None)
            if face_d:
                sl_names = [str(n_) for n_ in face_d.get_material_slot_names()]
                log(name, "face slots", sl_names)
                dbg = [x for x in os.environ.get("MH_DEBUG_SLOTS", "").split(",") if x]
                if dbg:
                    MLd = unreal.MaterialEditingLibrary
                    tld = unreal.AssetToolsHelpers.get_asset_tools()
                    cols = [(0, 1, 0), (0, 0.3, 1), (1, 0, 1), (1, 1, 0)]
                    for k_, key in enumerate(dbg):
                        md = tld.create_asset(f"M_dbg_{k_}", "/Game/Debug", unreal.Material, unreal.MaterialFactoryNew())
                        md.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
                        c_ = MLd.create_material_expression(md, unreal.MaterialExpressionConstant3Vector, -400, 0)
                        c_.set_editor_property("constant", unreal.LinearColor(*cols[k_ % 4], 1))
                        MLd.connect_material_property(c_, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
                        MLd.recompile_material(md)
                        for sn in sl_names:
                            if key.lower() in sn.lower():
                                face_d.set_material_by_name(unreal.Name(sn), md)
                                log(name, "debug slot", sn, "->", cols[k_ % 4])
            # design-sheet clothes (fit_outfit.py: skinned to the MetaHuman skeleton) following the body
            if os.environ.get("MH_OUTFIT_FBX"):
                odir = f"/Game/Outfit/{name}"
                if eal.does_directory_exist(odir):
                    eal.delete_directory(odir)
                body_c = next((c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name() == "Body"), None)
                skm_b = body_c.get_skeletal_mesh_asset() if body_c else None
                skel = skm_b.get_editor_property("skeleton") if skm_b else None
                log(name, "outfit body", skm_b, "skeleton", skel)
                unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX False")
                ot = unreal.AssetImportTask()
                for k, v in (("filename", os.environ["MH_OUTFIT_FBX"]), ("destination_path", odir), ("automated", True), ("save", True), ("replace_existing", True)):
                    ot.set_editor_property(k, v)
                ui = unreal.FbxImportUI()
                ui.set_editor_property("import_mesh", True)
                ui.set_editor_property("import_as_skeletal", True)
                ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_SKELETAL_MESH)
                ui.set_editor_property("skeleton", skel)
                ui.set_editor_property("import_materials", True)
                ui.set_editor_property("import_textures", True)
                ui.set_editor_property("import_animations", False)
                ui.set_editor_property("create_physics_asset", False)
                ui.skeletal_mesh_import_data.set_editor_property("import_morph_targets", False)
                ot.set_editor_property("options", ui)
                unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([ot])
                unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX True")
                oskm = next((unreal.load_asset(x) for x in eal.list_assets(odir, recursive=True) if isinstance(unreal.load_asset(x), unreal.SkeletalMesh)), None)
                log(name, "outfit mesh", oskm, [str(x).split(".")[-1] for x in eal.list_assets(odir, recursive=True)][:8])
                if oskm and body_c:
                    oa = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SkeletalMeshActor, actor.get_actor_location(), actor.get_actor_rotation())
                    oc = oa.get_editor_property("skeletal_mesh_component")
                    oc.set_skeletal_mesh_asset(oskm)
                    oa.attach_to_component(body_c, "", unreal.AttachmentRule.SNAP_TO_TARGET, unreal.AttachmentRule.SNAP_TO_TARGET, unreal.AttachmentRule.KEEP_WORLD, False)
                    if os.environ.get("MH_OUTFIT_NOLEADER") != "1":
                        oc.set_leader_pose_component(body_c)
                    # own materials: the FBX one came out washed grey; cloth texture -> base colour, rough leather
                    MLo = unreal.MaterialEditingLibrary
                    toolso = unreal.AssetToolsHelpers.get_asset_tools()

                    def mk_mat(nm, tex=None, rgb=(0.01, 0.01, 0.01), rough=0.55, spec=0.35):
                        m_ = toolso.create_asset(nm, odir, unreal.Material, unreal.MaterialFactoryNew())
                        if tex:
                            ts_ = MLo.create_material_expression(m_, unreal.MaterialExpressionTextureSample, -800, 0)
                            ts_.set_editor_property("texture", tex)
                            # MH_OUTFIT_GRADE=desat,gain: the old model's cloth reads brown in UE light; the design is black
                            ds_, gn_ = (float(x) for x in os.environ.get("MH_OUTFIT_GRADE", "0,1").split(","))
                            de_ = MLo.create_material_expression(m_, unreal.MaterialExpressionDesaturation, -600, 0)
                            fr_ = MLo.create_material_expression(m_, unreal.MaterialExpressionConstant, -800, 200)
                            fr_.set_editor_property("r", ds_)
                            MLo.connect_material_expressions(ts_, "RGB", de_, "")
                            MLo.connect_material_expressions(fr_, "", de_, "Fraction")
                            mu_ = MLo.create_material_expression(m_, unreal.MaterialExpressionMultiply, -400, 0)
                            mu_.set_editor_property("const_b", gn_)
                            MLo.connect_material_expressions(de_, "", mu_, "A")
                            MLo.connect_material_property(mu_, "", unreal.MaterialProperty.MP_BASE_COLOR)
                        else:
                            c_ = MLo.create_material_expression(m_, unreal.MaterialExpressionConstant3Vector, -400, 0)
                            c_.set_editor_property("constant", unreal.LinearColor(*rgb, 1))
                            MLo.connect_material_property(c_, "", unreal.MaterialProperty.MP_BASE_COLOR)
                        for prop_, val_, y_ in ((unreal.MaterialProperty.MP_ROUGHNESS, rough, 200), (unreal.MaterialProperty.MP_SPECULAR, spec, 300),
                                                (unreal.MaterialProperty.MP_METALLIC, 0.0, 400)):
                            k_ = MLo.create_material_expression(m_, unreal.MaterialExpressionConstant, -400, y_)
                            k_.set_editor_property("r", val_)
                            MLo.connect_material_property(k_, "", prop_)
                        MLo.recompile_material(m_)
                        eal.save_loaded_asset(m_)
                        return m_

                    otex = None
                    if os.environ.get("MH_OUTFIT_TEX"):            # the cloth albedo as its own file (the FBX-embedded one went missing)
                        tt_ = unreal.AssetImportTask()
                        for k, v in (("filename", os.environ["MH_OUTFIT_TEX"]), ("destination_path", odir), ("automated", True), ("save", True), ("replace_existing", True)):
                            tt_.set_editor_property(k, v)
                        unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([tt_])
                        otex = unreal.load_asset(f"{odir}/{os.path.splitext(os.path.basename(os.environ['MH_OUTFIT_TEX']))[0]}")
                    if otex is None:
                        otex = next((unreal.load_asset(x) for x in eal.list_assets(odir, recursive=True) if isinstance(unreal.load_asset(x), unreal.Texture2D)), None)
                    log(name, "outfit texture", otex)
                    for i_, sm_ in enumerate(oskm.get_editor_property("materials")):
                        sn_ = str(sm_.get_editor_property("material_slot_name"))
                        if "Collar" in sn_:
                            mm_ = mk_mat(f"M_{name}_OutfitCollar", rgb=(0.006, 0.006, 0.0065), rough=0.7, spec=0.15)
                            mm_.set_editor_property("two_sided", True)
                            unreal.MaterialEditingLibrary.recompile_material(mm_)
                        elif "Lining" in sn_:
                            mm_ = mk_mat(f"M_{name}_OutfitLining", rgb=(0.012, 0.011, 0.012), rough=0.6)
                        elif os.environ.get("MH_OUTFIT_PART_TEX") and sn_[-3:] in ("001", "002", "003"):
                            # a part merged into the outfit (merge_parts.py): its own albedo (_001 first part, _002 second)
                            ptex_ = os.environ[{"001": "MH_OUTFIT_PART_TEX", "002": "MH_OUTFIT_PART_TEX2", "003": "MH_OUTFIT_PART_TEX3"}[sn_[-3:]]]
                            tp_ = unreal.AssetImportTask()
                            for k, v in (("filename", ptex_), ("destination_path", odir), ("automated", True), ("save", True), ("replace_existing", True)):
                                tp_.set_editor_property(k, v)
                            unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([tp_])
                            ptx_ = unreal.load_asset(f"{odir}/{os.path.splitext(os.path.basename(ptex_))[0]}")
                            mm_ = mk_mat(f"M_{name}_OutfitPart{sn_[-1]}", tex=ptx_, rough=0.75 if sn_.endswith("001") else 0.35, spec=0.25 if sn_.endswith("001") else 0.5)
                            mm_.set_editor_property("two_sided", True)
                            unreal.MaterialEditingLibrary.recompile_material(mm_)
                        elif "Boots" in sn_:
                            mm_ = mk_mat(f"M_{name}_OutfitBoots", rgb=(0.01, 0.009, 0.009), rough=0.35, spec=0.5)
                        else:
                            mm_ = mk_mat(f"M_{name}_OutfitCloth", tex=otex, rough=float(os.environ.get("MH_OUTFIT_ROUGH", "0.55")))
                        oc.set_material(i_, mm_)
                        log(name, "outfit slot", i_, sn_, "->", mm_.get_name())
                    o_, e_ = oa.get_actor_bounds(False)
                    log(name, "outfit actor", oa.get_name(), "bounds", o_, e_)
            # separate equipment parts (fit_part.py), each its own skeletal mesh following the body: MH_PARTS=fbx|tex;fbx|tex
            for pi_, spec_ in enumerate([x for x in os.environ.get("MH_PARTS", "").split(";") if x]):
                pf_, ptex_ = (spec_.split("|") + [""])[:2]
                pdir = f"/Game/Parts/{name}/p{pi_}"
                if eal.does_directory_exist(pdir):
                    eal.delete_directory(pdir)
                body_p = next((c for c in actor.get_components_by_class(unreal.SkeletalMeshComponent) if c.get_name() == "Body"), None)
                skel_p = body_p.get_skeletal_mesh_asset().get_editor_property("skeleton")
                unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX False")
                pt = unreal.AssetImportTask()
                for k, v in (("filename", pf_), ("destination_path", pdir), ("automated", True), ("save", True), ("replace_existing", True)):
                    pt.set_editor_property(k, v)
                pui = unreal.FbxImportUI()
                pui.set_editor_property("import_mesh", True)
                pui.set_editor_property("import_as_skeletal", True)
                pui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_SKELETAL_MESH)
                pui.set_editor_property("skeleton", skel_p)
                pui.set_editor_property("import_materials", False)
                pui.set_editor_property("import_textures", False)
                pui.set_editor_property("import_animations", False)
                pui.set_editor_property("create_physics_asset", False)
                pt.set_editor_property("options", pui)
                unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([pt])
                unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX True")
                pskm = next((unreal.load_asset(x) for x in eal.list_assets(pdir, recursive=True) if isinstance(unreal.load_asset(x), unreal.SkeletalMesh)), None)
                if not pskm:
                    log(name, "part", pi_, "import failed", pf_)
                    continue
                MLp = unreal.MaterialEditingLibrary
                tlp = unreal.AssetToolsHelpers.get_asset_tools()
                pm_ = tlp.create_asset(f"M_{name}_Part{pi_}", pdir, unreal.Material, unreal.MaterialFactoryNew())
                pm_.set_editor_property("two_sided", True)
                if ptex_ and os.path.exists(ptex_):
                    tt_ = unreal.AssetImportTask()
                    for k, v in (("filename", ptex_), ("destination_path", pdir), ("automated", True), ("save", True), ("replace_existing", True)):
                        tt_.set_editor_property(k, v)
                    tlp.import_asset_tasks([tt_])
                    ptx = unreal.load_asset(f"{pdir}/{os.path.splitext(os.path.basename(ptex_))[0]}")
                    ts_ = MLp.create_material_expression(pm_, unreal.MaterialExpressionTextureSample, -400, 0)
                    ts_.set_editor_property("texture", ptx)
                    MLp.connect_material_property(ts_, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
                for prop_, val_, y_ in ((unreal.MaterialProperty.MP_ROUGHNESS, 0.75, 200), (unreal.MaterialProperty.MP_SPECULAR, 0.25, 300), (unreal.MaterialProperty.MP_METALLIC, 0.0, 400)):
                    k_ = MLp.create_material_expression(pm_, unreal.MaterialExpressionConstant, -400, y_)
                    k_.set_editor_property("r", val_)
                    MLp.connect_material_property(k_, "", prop_)
                MLp.recompile_material(pm_)
                pa = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SkeletalMeshActor, actor.get_actor_location(), actor.get_actor_rotation())
                pc_ = pa.get_editor_property("skeletal_mesh_component")
                pc_.set_skeletal_mesh_asset(pskm)
                for i_ in range(len(pskm.get_editor_property("materials"))):
                    pc_.set_material(i_, pm_)
                pa.attach_to_component(body_p, "", unreal.AttachmentRule.SNAP_TO_TARGET, unreal.AttachmentRule.SNAP_TO_TARGET, unreal.AttachmentRule.KEEP_WORLD, False)
                pc_.set_leader_pose_component(body_p)
                if os.environ.get("MH_PART_HIDE") == "1":
                    pc_.set_visibility(False, True)
                if os.environ.get("MH_PART_SHADOW", "1") == "0":
                    pc_.set_cast_shadow(False)
                log(name, "part", pi_, pskm.get_name(), "attached")
            for gc_, cmi_ in GROOM_FIX:          # set again after the outfit / part imports
                gc_.set_material(0, unreal.load_asset(cmi_.get_path_name()))
        except Exception:
            log(name, "HEAD ERROR", traceback.format_exc())
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
        for view, (loc, rot, fov) in {"full": (unreal.Vector(x, 420, 95), unreal.Rotator(pitch=0, yaw=-90, roll=0), 40.0),
                                      "head": (unreal.Vector(x, 80, 160), unreal.Rotator(pitch=-3, yaw=-90, roll=0), 30.0),
                                      # far and narrow, at eye level: the 80 cm / 30 deg shot stretched the lower face
                                      # (nose-chin read 0.76 of the eye width where the shape measures 0.63)
                                      "portrait": (unreal.Vector(x, 260, 163), unreal.Rotator(pitch=0, yaw=-90, roll=0), 8.5),
                                      "side": (unreal.Vector(x + 90, -330, 95), unreal.Rotator(pitch=0, yaw=75, roll=0), 40.0),
                                      "back": (unreal.Vector(x, -420, 95), unreal.Rotator(pitch=0, yaw=90, roll=0), 40.0)}.items():
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
    if n == 1500:
        # full-resolution face textures for the shots (low mips blurred the painted brows) - doc 177 §14
        for nm_ in state["actors"]:
            for t_ in eal.list_assets(f"/Game/Heroes/Built/{nm_}/MH_{nm_}/Face/Baked", recursive=False):
                tx_ = unreal.load_asset(t_)
                if isinstance(tx_, unreal.Texture2D):
                    tx_.set_force_mip_levels_to_be_resident(600.0, 0)
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
    # "late" in ticks, not its truthiness: with no hero built the list was empty and the editor waited forever
    if not ticks["queue"] and "late" in ticks and n > 3000:
        ticks["queue"] = ticks.pop("late")
        return
    if not ticks["queue"] and "late" not in ticks and n > 3000 + 40 * 10:
        log("done")
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()


handle = unreal.register_slate_post_tick_callback(on_tick)
