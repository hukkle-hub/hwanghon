"""Phone hair for the heroes' MetaHumans (docs/design/184 §5): the ribbon meshes from tools/metahuman/groom_to_mesh.py
-> /Game/HairMobile/<Name>/SM_<name>_hair_mobile with a two-sided hair-coloured material; checks the mesh lands where
the strand groom lands (same character space) by comparing both bounds in an editor world.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_hair_mobile.py" -unattended -nullrhi
"""
import unreal

SRC = "C:/w/mhlab/hairmobile"
HEROES = {"Ain": ((0.012, 0.010, 0.010), 0.55), "Sera": ((0.62, 0.62, 0.66), 0.45)}   # colour (linear), roughness
lib = unreal.EditorAssetLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()
ML = unreal.MaterialEditingLibrary
unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX False")


def log(m):
    unreal.log(f"[HWHairMobile] {m}")


for name, (rgb, rough) in HEROES.items():
    d = f"/Game/HairMobile/{name}"
    if lib.does_directory_exist(d):
        lib.delete_directory(d)
    ui = unreal.FbxImportUI()
    ui.set_editor_property("import_mesh", True)
    ui.set_editor_property("import_as_skeletal", False)
    ui.set_editor_property("import_materials", False)
    ui.set_editor_property("import_textures", False)
    ui.static_mesh_import_data.set_editor_property("combine_meshes", True)
    ui.static_mesh_import_data.set_editor_property("generate_lightmap_u_vs", False)
    ui.static_mesh_import_data.set_editor_property("auto_generate_collision", False)
    t = unreal.AssetImportTask()
    for k, v in (("filename", f"{SRC}/{name.lower()}_hair_mobile.fbx"), ("destination_path", d), ("destination_name", f"SM_{name.lower()}_hair_mobile"),
                 ("automated", True), ("save", True), ("replace_existing", True), ("options", ui)):
        t.set_editor_property(k, v)
    tools.import_asset_tasks([t])
    sm = unreal.load_asset(f"{d}/SM_{name.lower()}_hair_mobile")
    m = tools.create_asset(f"M_{name}_HairMobile", d, unreal.Material, unreal.MaterialFactoryNew())
    m.set_editor_property("two_sided", True)
    c = ML.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -400, 0)
    c.set_editor_property("constant", unreal.LinearColor(rgb[0], rgb[1], rgb[2], 1.0))
    ML.connect_material_property(c, "", unreal.MaterialProperty.MP_BASE_COLOR)
    for prop, val, y in ((unreal.MaterialProperty.MP_ROUGHNESS, rough, 200), (unreal.MaterialProperty.MP_SPECULAR, 0.4, 300)):
        k_ = ML.create_material_expression(m, unreal.MaterialExpressionConstant, -400, y)
        k_.set_editor_property("r", val)
        ML.connect_material_property(k_, "", prop)
    ML.recompile_material(m)
    lib.save_loaded_asset(m)
    if sm:
        sm.set_material(0, m)
        lib.save_loaded_asset(sm)
    # where does it land, against the groom (both spawned at the origin, as the component does in character space)
    groom = unreal.load_asset(f"/Game/GroomCustom/{name}/{name.lower()}_groom")
    ma = unreal.EditorLevelLibrary.spawn_actor_from_object(sm, unreal.Vector(0, 0, 0), unreal.Rotator()) if sm else None
    ga = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.GroomActor, unreal.Vector(0, 0, 0), unreal.Rotator())
    if ga and groom:
        ga.get_editor_property("groom_component").set_editor_property("groom_asset", groom)
    mo, me = ma.get_actor_bounds(False) if ma else (None, None)
    go, ge = ga.get_actor_bounds(False) if ga else (None, None)
    log(f"{name}: mesh {sm.get_name() if sm else None} tris {sm.get_num_triangles(0) if sm else 0} bounds {mo} {me} | groom {go} {ge}")
log("done")
