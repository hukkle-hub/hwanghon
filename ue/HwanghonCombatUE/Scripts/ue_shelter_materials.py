"""Gangnam bunker materials (docs/design/155): the textures from tools/shelter/make_textures.py on one master material.

M_HW_B1_Env - world-aligned: the texture is laid by world position (the dominant axis of the face normal picks the
plane), so a wall box scaled to 9 m does not stretch its texture. One sample per map (mobile-minded, work order P9):
BaseColor x Tint x low-frequency grime (breaks the repeat), Normal (strength), ORM (AO, roughness x mult, metal),
Emissive = BaseColor x EmissiveColor (screens, lamps).
MI_HW_B1_<name> for every surface the builder (Scripts/ue_shelter_b1.py) uses.

python tools/shelter/make_textures.py   (first: writes art/shelter/tex)
UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_shelter_materials.py" -unattended -nullrhi
"""
import os

import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(REPO, "art", "shelter", "tex")
TEX = "/Game/Hwanghon/Shelter/Textures"
MAT = "/Game/Hwanghon/Shelter/Materials"
lib = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()


def log(msg):
    unreal.log(f"[HWShelterMat] {msg}")


def import_textures():
    lib.make_directory(TEX)
    tasks = []
    for f in sorted(os.listdir(SRC)):
        if not f.endswith(".png"):
            continue
        t = unreal.AssetImportTask()
        t.filename = os.path.join(SRC, f)
        t.destination_path = TEX
        t.automated = True
        t.replace_existing = True
        t.save = False
        tasks.append(t)
    tools.import_asset_tasks(tasks)
    for t in tasks:
        name = os.path.splitext(os.path.basename(t.filename))[0]
        tex = unreal.load_asset(f"{TEX}/{name}")
        if name.endswith("_N"):
            tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_NORMALMAP)
            tex.set_editor_property("srgb", False)
            tex.set_editor_property("flip_green_channel", True)   # the generator writes OpenGL-style green; UE is DirectX
        elif name.endswith("_ORM"):
            tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_MASKS)
            tex.set_editor_property("srgb", False)
        lib.save_loaded_asset(tex)
    log(f"{len(tasks)} textures")


def tex(name):
    return unreal.load_asset(f"{TEX}/T_HW_B1_{name}")


def build_master():
    path = f"{MAT}/M_HW_B1_Env"
    if lib.does_asset_exist(path):
        lib.delete_asset(path)
    lib.make_directory(MAT)
    m = tools.create_asset("M_HW_B1_Env", MAT, unreal.Material, unreal.MaterialFactoryNew())

    def E(cls, x, y, **props):
        e = mel.create_material_expression(m, cls, x, y)
        for k, v in props.items():
            e.set_editor_property(k, v)
        return e

    def link(a, out, b, inp):
        if not mel.connect_material_expressions(a, out, b, inp):
            raise RuntimeError(f"connect {a.get_name()}.{out} -> {b.get_name()}.{inp}")

    def param(name, default, x, y):
        return E(unreal.MaterialExpressionScalarParameter, x, y, parameter_name=name, default_value=default)

    def vparam(name, default, x, y):
        return E(unreal.MaterialExpressionVectorParameter, x, y, parameter_name=name, default_value=unreal.LinearColor(*default))

    # world-aligned UV: (x, y, -z) / TileCm, plane picked by the dominant normal axis
    wp = E(unreal.MaterialExpressionWorldPosition, -2000, 0)
    flip = E(unreal.MaterialExpressionConstant3Vector, -2000, 120, constant=unreal.LinearColor(1, 1, -1, 0))
    wpf = E(unreal.MaterialExpressionMultiply, -1800, 0)
    link(wp, "", wpf, "A")
    link(flip, "", wpf, "B")
    tile = param("TileCm", 200.0, -1800, 150)
    p = E(unreal.MaterialExpressionDivide, -1600, 0)
    link(wpf, "", p, "A")
    link(tile, "", p, "B")
    xy = E(unreal.MaterialExpressionComponentMask, -1400, -150, r=True, g=True, b=False, a=False)
    xz = E(unreal.MaterialExpressionComponentMask, -1400, 0, r=True, g=False, b=True, a=False)
    yz = E(unreal.MaterialExpressionComponentMask, -1400, 150, r=False, g=True, b=True, a=False)
    for mk in (xy, xz, yz):
        link(p, "", mk, "")
    nrm = E(unreal.MaterialExpressionVertexNormalWS, -1800, 400)
    an = E(unreal.MaterialExpressionAbs, -1600, 400)
    link(nrm, "", an, "")
    nx = E(unreal.MaterialExpressionComponentMask, -1400, 350, r=True, g=False, b=False, a=False)
    nz = E(unreal.MaterialExpressionComponentMask, -1400, 450, r=False, g=False, b=True, a=False)
    link(an, "", nx, "")
    link(an, "", nz, "")
    rx = E(unreal.MaterialExpressionRound, -1250, 350)
    rz = E(unreal.MaterialExpressionRound, -1250, 450)
    link(nx, "", rx, "")
    link(nz, "", rz, "")
    l1 = E(unreal.MaterialExpressionLinearInterpolate, -1100, 50)
    link(xz, "", l1, "A")
    link(yz, "", l1, "B")
    link(rx, "", l1, "Alpha")
    uv = E(unreal.MaterialExpressionLinearInterpolate, -950, 0)
    link(l1, "", uv, "A")
    link(xy, "", uv, "B")
    link(rz, "", uv, "Alpha")

    # maps
    def sample(name, default, stype, x, y):
        s = E(unreal.MaterialExpressionTextureSampleParameter2D, x, y, parameter_name=name, texture=default, sampler_type=stype)
        link(uv, "", s, "UVs")
        return s

    c = sample("BaseColorTex", tex("concrete_C"), unreal.MaterialSamplerType.SAMPLERTYPE_COLOR, -700, -300)
    n = sample("NormalTex", tex("concrete_N"), unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL, -700, 100)
    o = sample("ORMTex", tex("concrete_ORM"), unreal.MaterialSamplerType.SAMPLERTYPE_MASKS, -700, 450)

    # grime: the grime map at ~1/7 scale, as a multiplier 0.7..1.15 blended by GrimeAmount
    gs = E(unreal.MaterialExpressionMultiply, -900, -550)
    link(uv, "", gs, "A")
    gk = E(unreal.MaterialExpressionConstant, -1050, -500, r=0.137)
    link(gk, "", gs, "B")
    g = E(unreal.MaterialExpressionTextureSample, -700, -650, texture=tex("grime_C"))
    link(gs, "", g, "UVs")
    gl = E(unreal.MaterialExpressionLinearInterpolate, -450, -650)
    link(E(unreal.MaterialExpressionConstant, -600, -500, r=0.7), "", gl, "A")
    link(E(unreal.MaterialExpressionConstant, -600, -450, r=1.15), "", gl, "B")
    link(g, "R", gl, "Alpha")
    ga = E(unreal.MaterialExpressionLinearInterpolate, -300, -650)
    link(E(unreal.MaterialExpressionConstant, -450, -520, r=1.0), "", ga, "A")
    link(gl, "", ga, "B")
    link(param("GrimeAmount", 0.8, -450, -420), "", ga, "Alpha")

    tint = vparam("Tint", (1, 1, 1, 1), -450, -300)
    bc = E(unreal.MaterialExpressionMultiply, -250, -300)
    link(c, "RGB", bc, "A")
    link(tint, "", bc, "B")
    bcg = E(unreal.MaterialExpressionMultiply, -100, -300)
    link(bc, "", bcg, "A")
    link(ga, "", bcg, "B")
    mel.connect_material_property(bcg, "", unreal.MaterialProperty.MP_BASE_COLOR)

    nl = E(unreal.MaterialExpressionLinearInterpolate, -250, 100)
    link(E(unreal.MaterialExpressionConstant3Vector, -450, 60, constant=unreal.LinearColor(0, 0, 1, 0)), "", nl, "A")
    link(n, "RGB", nl, "B")
    link(param("NormalStrength", 0.8, -450, 200), "", nl, "Alpha")
    mel.connect_material_property(nl, "", unreal.MaterialProperty.MP_NORMAL)

    rough = E(unreal.MaterialExpressionMultiply, -250, 450)
    link(o, "G", rough, "A")
    link(param("RoughnessMult", 1.0, -450, 520), "", rough, "B")
    mel.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    mel.connect_material_property(o, "B", unreal.MaterialProperty.MP_METALLIC)
    mel.connect_material_property(o, "R", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)

    em = E(unreal.MaterialExpressionMultiply, -250, -100)
    link(c, "RGB", em, "A")
    link(vparam("EmissiveColor", (0, 0, 0, 0), -450, -120), "", em, "B")
    mel.connect_material_property(em, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)

    mel.recompile_material(m)
    lib.save_loaded_asset(m)
    log("master built")
    return m


# name: (texture set, tile cm, tint, roughness mult, emissive, grime)
SURFACES = {
    "concrete": ("concrete", 300, (1, 1, 1), 1.0, None, 0.8),
    "floor":    ("floor", 400, (1, 1, 1), 1.0, None, 0.9),
    "steel":    ("steel", 200, (1, 1, 1), 1.0, None, 0.6),
    "rust":     ("rust", 150, (1, 1, 1), 1.0, None, 0.6),
    "wood":     ("wood", 150, (1, 1, 1), 1.0, None, 0.5),
    "canvas":   ("canvas", 100, (1, 1, 1), 1.0, None, 0.5),
    "hazard":   ("hazard", 100, (1, 1, 1), 1.0, None, 0.4),
    "mat":      ("rubber", 100, (1.4, 1.4, 1.3), 1.0, None, 0.6),
    "paper":    ("posters", 200, (0.62, 0.58, 0.48), 1.0, None, 0.6),   # faded, yellowed (L285 «빛바랜»)
    "screen":   ("screen", 60, (1, 1, 1), 0.3, (2.5, 2.5, 2.5, 1), 0.0),
    "dark":     ("steel", 200, (0.25, 0.25, 0.25), 0.4, None, 0.2),
    "lamp":     ("canvas", 100, (1, 0.8, 0.55), 1.0, (18, 12, 6, 1), 0.0),
    "girder":   ("steel", 200, (0.55, 0.55, 0.58), 1.0, None, 0.7),
    "cloth_a":  ("canvas", 80, (0.62, 0.78, 1.05), 1.0, None, 0.4),   # laundry: faded blue, red, grey
    "cloth_b":  ("canvas", 80, (1.25, 0.55, 0.45), 1.0, None, 0.4),
    "cloth_c":  ("canvas", 80, (0.85, 0.85, 0.85), 1.0, None, 0.4),
    "paint_yellow": ("paint", 120, (0.95, 0.72, 0.12), 1.0, None, 0.5),   # walkway lines, markings
    "paint_white":  ("paint", 120, (0.85, 0.84, 0.80), 1.0, None, 0.5),
    "water":    ("steel", 200, (0.16, 0.16, 0.17), 0.18, None, 0.0),   # standing water: a darker, glossy stain
    "led_red":   ("canvas", 50, (1, 0.2, 0.15), 1.0, (30, 3, 2, 1), 0.0),     # panel indicator lights
    "led_green": ("canvas", 50, (0.3, 1, 0.4), 1.0, (3, 22, 6, 1), 0.0),
}


def build_instances(master):
    for name, (texset, tile, tint, rough, emissive, grime) in SURFACES.items():
        path = f"{MAT}/MI_HW_B1_{name}"
        if lib.does_asset_exist(path):
            lib.delete_asset(path)
        mi = tools.create_asset(f"MI_HW_B1_{name}", MAT, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
        mi.set_editor_property("parent", master)
        mel.set_material_instance_texture_parameter_value(mi, "BaseColorTex", tex(f"{texset}_C"))
        if unreal.EditorAssetLibrary.does_asset_exist(f"{TEX}/T_HW_B1_{texset}_N"):
            mel.set_material_instance_texture_parameter_value(mi, "NormalTex", tex(f"{texset}_N"))
            mel.set_material_instance_texture_parameter_value(mi, "ORMTex", tex(f"{texset}_ORM"))
        mel.set_material_instance_scalar_parameter_value(mi, "TileCm", float(tile))
        mel.set_material_instance_scalar_parameter_value(mi, "RoughnessMult", float(rough))
        mel.set_material_instance_scalar_parameter_value(mi, "GrimeAmount", float(grime))
        mel.set_material_instance_vector_parameter_value(mi, "Tint", unreal.LinearColor(*tint, 1))
        if emissive:
            mel.set_material_instance_vector_parameter_value(mi, "EmissiveColor", unreal.LinearColor(*emissive))
        lib.save_loaded_asset(mi)
    log(f"{len(SURFACES)} instances")


def build_signs():
    """M_HW_B1_Sign: a plain UV-mapped plate (a sign must not be cut by world alignment) + MI per sign texture."""
    path = f"{MAT}/M_HW_B1_Sign"
    if lib.does_asset_exist(path):
        lib.delete_asset(path)
    m = tools.create_asset("M_HW_B1_Sign", MAT, unreal.Material, unreal.MaterialFactoryNew())
    t = mel.create_material_expression(m, unreal.MaterialExpressionTextureSampleParameter2D, -500, 0)
    t.set_editor_property("parameter_name", "SignTex")
    t.set_editor_property("texture", tex("sign_b1_C"))
    mel.connect_material_property(t, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
    r = mel.create_material_expression(m, unreal.MaterialExpressionConstant, -300, 200)
    r.set_editor_property("r", 0.75)
    mel.connect_material_property(r, "", unreal.MaterialProperty.MP_ROUGHNESS)
    mel.recompile_material(m)
    lib.save_loaded_asset(m)
    n = 0
    for f in sorted(os.listdir(SRC)):
        if f.startswith("T_HW_B1_sign_") and f.endswith("_C.png"):
            key = f[len("T_HW_B1_sign_"):-len("_C.png")]
            p = f"{MAT}/MI_HW_B1_sign_{key}"
            if lib.does_asset_exist(p):
                lib.delete_asset(p)
            mi = tools.create_asset(f"MI_HW_B1_sign_{key}", MAT, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
            mi.set_editor_property("parent", m)
            mel.set_material_instance_texture_parameter_value(mi, "SignTex", tex(f"sign_{key}_C"))
            lib.save_loaded_asset(mi)
            n += 1
    log(f"{n} signs")


import_textures()
build_instances(build_master())
build_signs()
