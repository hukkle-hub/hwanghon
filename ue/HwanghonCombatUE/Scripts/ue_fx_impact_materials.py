"""Materials for the code-driven impact layer (AHWImpactFx, docs/design/174 from the Crimson Desert study, doc 173).

- M_HW_Streak   additive, unlit: a thin line spark / needle / lens streak / ring arc on the engine plane or the arc mesh.
                width falloff 1-|2v-1|, head-to-tail fade u^Tail (Sym=1: symmetric, the lens streak), x Color x Glow
                x PerInstanceCustomData[0] (the instance's fade; 1 where the platform has no custom data).
- M_HW_Puff     translucent, unlit: a soft round puff (mist, dust), radial falloff x Alpha x custom data fade.
- M_HW_Flat     lit, two-sided: straw and chips in a flat colour.
- M_HW_CrackDecal deferred decal, translucent: T_HW_Crack (drawn by tools/3d/make_crack_texture.py), faded by Fade.
Also imports SM_HW_RingArc (art/fx/ring_arc.fbx from tools/3d/make_ring_arc.py): a 270 deg arc, radius 100 cm.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_fx_impact_materials.py" -unattended -nullrhi
"""
import os

import unreal

PATH = "/Game/Hwanghon/VFX"
lib = unreal.MaterialEditingLibrary
eal = unreal.EditorAssetLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()


def fresh(name):
    if eal.does_asset_exist(f"{PATH}/{name}"):
        eal.delete_asset(f"{PATH}/{name}")
    return tools.create_asset(name, PATH, unreal.Material, unreal.MaterialFactoryNew())


def node(m, cls, x, y, **props):
    e = lib.create_material_expression(m, cls, x, y)
    for k, v in props.items():
        e.set_editor_property(k, v)
    return e


def link(a, ao, b, bi):
    lib.connect_material_expressions(a, ao, b, bi)


def mul(m, a, b, x, y, ao="", bo=""):
    e = node(m, unreal.MaterialExpressionMultiply, x, y)
    link(a, ao, e, "A")
    link(b, bo, e, "B")
    return e


def fade(m, x, y):
    return node(m, unreal.MaterialExpressionPerInstanceCustomData, x, y, data_index=0, const_default_value=1.0)


def scalar(m, name, v, x, y):
    return node(m, unreal.MaterialExpressionScalarParameter, x, y, parameter_name=name, default_value=v)


def color(m, name, c, x, y):
    return node(m, unreal.MaterialExpressionVectorParameter, x, y, parameter_name=name, default_value=unreal.LinearColor(*c, 1.0))


def uv_channel(m, ch, x, y):
    tc = node(m, unreal.MaterialExpressionTextureCoordinate, x - 200, y)
    mk = node(m, unreal.MaterialExpressionComponentMask, x, y, r=(ch == "u"), g=(ch == "v"))
    link(tc, "", mk, "")
    return mk


def centre_falloff(m, src, x, y):
    """1 - |2s - 1|"""
    two = node(m, unreal.MaterialExpressionMultiply, x, y, const_b=2.0)
    link(src, "", two, "A")
    sub = node(m, unreal.MaterialExpressionSubtract, x + 120, y, const_b=1.0)
    link(two, "", sub, "A")
    ab = node(m, unreal.MaterialExpressionAbs, x + 240, y)
    link(sub, "", ab, "")
    om = node(m, unreal.MaterialExpressionOneMinus, x + 360, y)
    link(ab, "", om, "")
    return om


def finish(m, name):
    lib.recompile_material(m)
    eal.save_asset(f"{PATH}/{name}")


# ---- M_HW_Streak
m = fresh("M_HW_Streak")
m.set_editor_property("blend_mode", unreal.BlendMode.BLEND_ADDITIVE)
m.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
m.set_editor_property("two_sided", True)
m.set_editor_property("used_with_instanced_static_meshes", True)
v = uv_channel(m, "v", -1200, 200)
width = centre_falloff(m, v, -1000, 200)
wpow = node(m, unreal.MaterialExpressionPower, -560, 200, const_exponent=2.0)   # a thin bright core
link(width, "", wpow, "Base")
u = uv_channel(m, "u", -1200, 450)
tail = node(m, unreal.MaterialExpressionPower, -900, 450)
link(u, "", tail, "Base")
link(scalar(m, "Tail", 1.5, -1100, 600), "", tail, "Exp")
sym = centre_falloff(m, u, -1000, 750)
lerp = node(m, unreal.MaterialExpressionLinearInterpolate, -500, 500)
link(tail, "", lerp, "A")
link(sym, "", lerp, "B")
link(scalar(m, "Sym", 0.0, -700, 900), "", lerp, "Alpha")
shape = mul(m, wpow, lerp, -350, 300)
cg = mul(m, color(m, "Color", (1.0, 0.55, 0.15), -600, -100), scalar(m, "Glow", 8.0, -600, 50), -350, -50)
k = mul(m, shape, fade(m, -350, 600), -200, 400)
out = mul(m, cg, k, -50, 150)
lib.connect_material_property(out, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
finish(m, "M_HW_Streak")

# ---- M_HW_Puff
m = fresh("M_HW_Puff")
m.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
m.set_editor_property("shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
m.set_editor_property("two_sided", True)
m.set_editor_property("used_with_instanced_static_meshes", True)
tc = node(m, unreal.MaterialExpressionTextureCoordinate, -1100, 300)
half = node(m, unreal.MaterialExpressionConstant2Vector, -1100, 450, r=0.5, g=0.5)
d = node(m, unreal.MaterialExpressionDistance, -900, 350)
link(tc, "", d, "A")
link(half, "", d, "B")
r2 = node(m, unreal.MaterialExpressionMultiply, -760, 350, const_b=2.0)
link(d, "", r2, "A")
om = node(m, unreal.MaterialExpressionOneMinus, -640, 350)
link(r2, "", om, "")
sat = node(m, unreal.MaterialExpressionSaturate, -520, 350)
link(om, "", sat, "")
soft = node(m, unreal.MaterialExpressionPower, -400, 350, const_exponent=1.6)
link(sat, "", soft, "Base")
op = mul(m, mul(m, soft, scalar(m, "Alpha", 0.55, -400, 520), -250, 400), fade(m, -250, 600), -100, 450)
lib.connect_material_property(op, "", unreal.MaterialProperty.MP_OPACITY)
lib.connect_material_property(color(m, "Color", (0.75, 0.82, 0.9), -300, 0), "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
finish(m, "M_HW_Puff")

# ---- M_HW_Flat
m = fresh("M_HW_Flat")
m.set_editor_property("two_sided", True)
m.set_editor_property("used_with_instanced_static_meshes", True)
lib.connect_material_property(color(m, "Color", (0.62, 0.48, 0.22), -300, 0), "", unreal.MaterialProperty.MP_BASE_COLOR)
lib.connect_material_property(node(m, unreal.MaterialExpressionConstant, -300, 200, r=0.9), "", unreal.MaterialProperty.MP_ROUGHNESS)
finish(m, "M_HW_Flat")

# ---- M_HW_CrackDecal
# T_HW_Crack is drawn by tools/3d/make_crack_texture.py (art/fx/crack.png). Tried first: cracks out of a normal map
# (the whole decal box came out a grey square) and the Megascans "crack" sheet (a dirt patch, virtual-textured).
mega = unreal.load_asset("/Game/DerelictCorridor/Assets/Fab/Megascans/Decals/Ind_Decal_Concrete_Crack_20/T_Ind_Deca_Sheet_Glass_01_B-O")
if mega and not mega.get_editor_property("virtual_texture_streaming"):
    mega.set_editor_property("virtual_texture_streaming", True)   # put the pack back as it came
    eal.save_loaded_asset(mega)
png = os.path.normpath(os.path.join(unreal.Paths.project_dir(), "..", "..", "art", "fx", "crack.png"))
it = unreal.AssetImportTask()
for k, val in (("filename", png), ("destination_path", PATH), ("destination_name", "T_HW_Crack"),
               ("automated", True), ("save", True), ("replace_existing", True)):
    it.set_editor_property(k, val)
tools.import_asset_tasks([it])
crack_tex = unreal.load_asset(f"{PATH}/T_HW_Crack")
m = fresh("M_HW_CrackDecal")
m.set_editor_property("material_domain", unreal.MaterialDomain.MD_DEFERRED_DECAL)
m.set_editor_property("blend_mode", unreal.BlendMode.BLEND_TRANSLUCENT)
smp = node(m, unreal.MaterialExpressionTextureSample, -600, 200, texture=crack_tex)
op = mul(m, smp, scalar(m, "Fade", 1.0, -420, 380), -300, 300, ao="A")
lib.connect_material_property(op, "", unreal.MaterialProperty.MP_OPACITY)
lib.connect_material_property(smp, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
finish(m, "M_HW_CrackDecal")

# ---- SM_HW_RingArc
fbx = os.path.normpath(os.path.join(unreal.Paths.project_dir(), "..", "..", "art", "fx", "ring_arc.fbx"))
if os.path.isfile(fbx):
    unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX False")
    ui = unreal.FbxImportUI()
    ui.set_editor_property("import_mesh", True)
    ui.set_editor_property("import_as_skeletal", False)
    ui.set_editor_property("import_materials", False)
    ui.set_editor_property("import_textures", False)
    ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_STATIC_MESH)
    t = unreal.AssetImportTask()
    for k, val in (("filename", fbx), ("destination_path", PATH), ("destination_name", "SM_HW_RingArc"),
                   ("automated", True), ("save", True), ("replace_existing", True), ("options", ui)):
        t.set_editor_property(k, val)
    tools.import_asset_tasks([t])
