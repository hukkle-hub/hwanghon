"""
Create Hwanghon preview master material + physically distinct material instances.

Run inside UE 5.5 Editor:
  py ".../HwanghonCombatUE/Scripts/ue_create_material_library.py"

Purpose:
- Make fabric / leather / metal / concrete read differently under the same lighting.
- This is a preview/Vertical-Slice base library, not final hero skin/hair shading.
"""
from __future__ import annotations

import unreal

ROOT = "/Game/Materials/Hwanghon"
MASTER_PATH = ROOT
MASTER_NAME = "M_HW_SurfacePreview"

PRESETS = {
    "MI_HW_Fabric_Dark": {
        "BaseColor": unreal.LinearColor(0.025, 0.030, 0.040, 1.0),
        "Roughness": 0.78,
        "Metallic": 0.0,
        "Specular": 0.38,
        "AO": 1.0,
    },
    "MI_HW_Leather_Dark": {
        "BaseColor": unreal.LinearColor(0.045, 0.028, 0.020, 1.0),
        "Roughness": 0.50,
        "Metallic": 0.0,
        "Specular": 0.48,
        "AO": 1.0,
    },
    "MI_HW_WeaponMetal": {
        "BaseColor": unreal.LinearColor(0.11, 0.13, 0.16, 1.0),
        "Roughness": 0.28,
        "Metallic": 0.96,
        "Specular": 0.50,
        "AO": 1.0,
    },
    "MI_HW_PaintedMetal": {
        "BaseColor": unreal.LinearColor(0.08, 0.09, 0.10, 1.0),
        "Roughness": 0.43,
        "Metallic": 0.05,
        "Specular": 0.48,
        "AO": 1.0,
    },
    "MI_HW_DryConcrete": {
        "BaseColor": unreal.LinearColor(0.16, 0.17, 0.18, 1.0),
        "Roughness": 0.86,
        "Metallic": 0.0,
        "Specular": 0.32,
        "AO": 0.92,
    },
    "MI_HW_WetConcrete": {
        "BaseColor": unreal.LinearColor(0.075, 0.082, 0.090, 1.0),
        "Roughness": 0.22,
        "Metallic": 0.0,
        "Specular": 0.54,
        "AO": 0.96,
    },
    # Preview only. Final skin needs dedicated mobile skin shading / SSS approximation.
    "MI_HW_SkinPreview": {
        "BaseColor": unreal.LinearColor(0.52, 0.31, 0.24, 1.0),
        "Roughness": 0.56,
        "Metallic": 0.0,
        "Specular": 0.38,
        "AO": 1.0,
    },
}

def ensure_dir(path: str):
    unreal.EditorAssetLibrary.make_directory(path)

def create_master():
    full = f"{MASTER_PATH}/{MASTER_NAME}"
    existing = unreal.EditorAssetLibrary.load_asset(full)
    if existing:
        unreal.log(f"[HwanghonMaterials] master exists: {full}")
        return existing

    tools = unreal.AssetToolsHelpers.get_asset_tools()
    material = tools.create_asset(
        MASTER_NAME,
        MASTER_PATH,
        unreal.Material,
        unreal.MaterialFactoryNew()
    )
    if not material:
        raise RuntimeError("Could not create material")

    MEL = unreal.MaterialEditingLibrary

    base = MEL.create_material_expression(material, unreal.MaterialExpressionVectorParameter, -600, -180)
    base.set_editor_property("parameter_name", "BaseColor")
    base.set_editor_property("default_value", unreal.LinearColor(0.18, 0.18, 0.18, 1.0))

    rough = MEL.create_material_expression(material, unreal.MaterialExpressionScalarParameter, -600, -40)
    rough.set_editor_property("parameter_name", "Roughness")
    rough.set_editor_property("default_value", 0.55)

    metal = MEL.create_material_expression(material, unreal.MaterialExpressionScalarParameter, -600, 80)
    metal.set_editor_property("parameter_name", "Metallic")
    metal.set_editor_property("default_value", 0.0)

    spec = MEL.create_material_expression(material, unreal.MaterialExpressionScalarParameter, -600, 200)
    spec.set_editor_property("parameter_name", "Specular")
    spec.set_editor_property("default_value", 0.45)

    ao = MEL.create_material_expression(material, unreal.MaterialExpressionScalarParameter, -600, 320)
    ao.set_editor_property("parameter_name", "AO")
    ao.set_editor_property("default_value", 1.0)

    MEL.connect_material_property(base, "", unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    MEL.connect_material_property(metal, "", unreal.MaterialProperty.MP_METALLIC)
    MEL.connect_material_property(spec, "", unreal.MaterialProperty.MP_SPECULAR)
    MEL.connect_material_property(ao, "", unreal.MaterialProperty.MP_AMBIENT_OCCLUSION)

    MEL.layout_material_expressions(material)
    errors = MEL.recompile_material(material)
    unreal.EditorAssetLibrary.save_loaded_asset(material)

    if errors:
        unreal.log_warning(f"[HwanghonMaterials] compile messages: {errors}")

    unreal.log(f"[HwanghonMaterials] created master: {full}")
    return material

def create_instance(parent, name: str, values: dict):
    full = f"{ROOT}/{name}"
    instance = unreal.EditorAssetLibrary.load_asset(full)

    if not instance:
        factory = unreal.MaterialInstanceConstantFactoryNew()
        instance = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            name,
            ROOT,
            unreal.MaterialInstanceConstant,
            factory
        )

    if not instance:
        raise RuntimeError(f"Could not create {name}")

    MEL = unreal.MaterialEditingLibrary
    MEL.set_material_instance_parent(instance, parent)
    MEL.set_material_instance_vector_parameter_value(instance, "BaseColor", values["BaseColor"])
    MEL.set_material_instance_scalar_parameter_value(instance, "Roughness", values["Roughness"])
    MEL.set_material_instance_scalar_parameter_value(instance, "Metallic", values["Metallic"])
    MEL.set_material_instance_scalar_parameter_value(instance, "Specular", values["Specular"])
    MEL.set_material_instance_scalar_parameter_value(instance, "AO", values["AO"])
    MEL.update_material_instance(instance)
    unreal.EditorAssetLibrary.save_loaded_asset(instance)
    unreal.log(f"[HwanghonMaterials] ready: {full}")
    return instance

def main():
    ensure_dir(ROOT)
    master = create_master()

    for name, values in PRESETS.items():
        create_instance(master, name, values)

    unreal.log("[HwanghonMaterials] DONE")
    unreal.log("[HwanghonMaterials] Assign preview instances before final texture/SSS/hair shader work.")

if __name__ == "__main__":
    main()
