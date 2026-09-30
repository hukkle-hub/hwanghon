"""M_HW_GlyphOverlay (docs/design/167): the tell glow drawn over the boss body as an overlay material.

Additive, unlit: Color * Glow * (rim + base). A point light alone vanished in the white EP01 room; the overlay
reads on any background. Run headless: UnrealEditor-Cmd <uproject> -ExecutePythonScript=<this>.
"""
import unreal

PATH = "/Game/Hwanghon/VFX"
NAME = "M_HW_GlyphOverlay"
lib = unreal.MaterialEditingLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()

if unreal.EditorAssetLibrary.does_asset_exist(f"{PATH}/{NAME}"):
    unreal.EditorAssetLibrary.delete_asset(f"{PATH}/{NAME}")
mat = tools.create_asset(NAME, PATH, unreal.Material, unreal.MaterialFactoryNew())
mat.set_editor_property("blend_mode", unreal.BlendMode.BLEND_ADDITIVE)
mat.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
mat.set_editor_property("used_with_skeletal_mesh", True)   # else the game draws the default material

color = lib.create_material_expression(mat, unreal.MaterialExpressionVectorParameter, -800, 0)
color.set_editor_property("parameter_name", "Color")
color.set_editor_property("default_value", unreal.LinearColor(r=1.0, g=0.14, b=0.05, a=1.0))
glow = lib.create_material_expression(mat, unreal.MaterialExpressionScalarParameter, -800, 200)
glow.set_editor_property("parameter_name", "Glow")
glow.set_editor_property("default_value", 0.0)
fres = lib.create_material_expression(mat, unreal.MaterialExpressionFresnel, -800, 350)
fres.set_editor_property("exponent", 3.0)
base = lib.create_material_expression(mat, unreal.MaterialExpressionConstant, -800, 500)
base.set_editor_property("r", 0.03)
rim = lib.create_material_expression(mat, unreal.MaterialExpressionAdd, -550, 400)
lib.connect_material_expressions(fres, "", rim, "A")
lib.connect_material_expressions(base, "", rim, "B")
m1 = lib.create_material_expression(mat, unreal.MaterialExpressionMultiply, -400, 100)
lib.connect_material_expressions(color, "", m1, "A")
lib.connect_material_expressions(glow, "", m1, "B")
m2 = lib.create_material_expression(mat, unreal.MaterialExpressionMultiply, -200, 200)
lib.connect_material_expressions(m1, "", m2, "A")
lib.connect_material_expressions(rim, "", m2, "B")
lib.connect_material_property(m2, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
lib.recompile_material(mat)
unreal.EditorAssetLibrary.save_asset(f"{PATH}/{NAME}")
unreal.log("[HWFX] glyph overlay material saved")
