"""Ain and Sera from the MetaHuman lab into the game project (docs/design/184).

Run in the lab project (it owns the built MetaHumans):
  UnrealEditor-Cmd C:/w/mhlab/MHLab.uproject -ExecutePythonScript=<this> -unattended -nullrhi

1. The lab dresses its heroes in the level (lab_build.py: outfit component overrides). The game spawns them from
   assets, so the outfit materials are written onto the outfit skeletal mesh itself, slot by slot, with the same rule
   lab_build uses (Lining / Boots / Collar / merged parts _001.._005 / cloth).
2. The built MetaHuman blueprint, the outfit mesh and the strand groom (+ its hair material) are migrated with their
   dependencies into the game's Content folder (same /Game paths).
"""
import os

import unreal

GAME_CONTENT = "C:/w/hwanghon/ue/HwanghonCombatUE/Content"
HEROES = {"Ain": "ain_v108m", "Sera": "sera_v108m"}
eal = unreal.EditorAssetLibrary


def log(*a):
    unreal.log("[HWExport] " + " ".join(str(x) for x in a))


def material_for(name, slot):
    odir = f"/Game/Outfit/{name}"
    pick = None
    if "Collar" in slot:
        pick = f"M_{name}_OutfitCollar"
    elif "Lining" in slot:
        pick = f"M_{name}_OutfitLining"
    elif slot[-3:] in ("001", "002", "003", "004", "005"):
        pick = f"M_{name}_OutfitPart{slot[-1]}"
    elif "Boots" in slot:
        pick = f"M_{name}_OutfitBoots"
    else:
        pick = f"M_{name}_OutfitCloth"
    return unreal.load_asset(f"{odir}/{pick}")


packages = []
for name, skm_name in HEROES.items():
    skm = unreal.load_asset(f"/Game/Outfit/{name}/{skm_name}")
    if not skm:
        log(name, "no outfit mesh", skm_name)
        continue
    mats = skm.get_editor_property("materials")
    for i, sm in enumerate(mats):
        slot = str(sm.get_editor_property("material_slot_name"))
        m = material_for(name, slot)
        if m:
            sm.set_editor_property("material_interface", m)
            mats[i] = sm
        log(name, "outfit slot", i, slot, "->", m.get_name() if m else None)
    skm.set_editor_property("materials", mats)
    eal.save_loaded_asset(skm)
    packages += [f"/Game/Heroes/Built/{name}/MH_{name}/BP_MH_{name}", f"/Game/Outfit/{name}/{skm_name}",
                 f"/Game/GroomCustom/{name}/{name.lower()}_groom", f"/Game/GroomCustom/{name}/MI_{name}_GroomCustom"]

opts = unreal.MigrationOptions()
for k, v in (("prompt", False), ("ignore_dependencies", False), ("asset_conflict", unreal.AssetMigrationConflict.OVERWRITE)):
    try:
        opts.set_editor_property(k, v)
    except Exception as e:  # noqa: BLE001
        log("option", k, e)
log("migrating", packages)
unreal.AssetToolsHelpers.get_asset_tools().migrate_packages(packages, GAME_CONTENT, opts)
log("done")
