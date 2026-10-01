"""ABP_Hero_Countess (docs/design/170): the Countess AnimBP with a full-body slot in front of its output.

The pack AnimBP plays montages on the upper body only (UpperBody slot, layered from the spine), so the heroes'
skills never moved the legs - spins and leaps kept the combat idle stance below the waist. A copy gets a
DefaultSlot node between the final pose and the output (UHWEditorAnimTools::InsertOutputSlot, C++); the hero
sets' Skill1-4 / Ultimate bindings then play on DefaultSlot. Basic attacks stay on UpperBody (they run while moving).

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_hero_fullbody_abp.py" -unattended -nullrhi
"""
import json
import os

import unreal

SRC = "/Game/ParagonCountess/Characters/Heroes/Countess/Countess_AnimBlueprint"
DST = "/Game/Animation/Heroes/ABP_Hero_Countess"
SLOT = "DefaultSlot"
lib = unreal.EditorAssetLibrary
report = {}

if lib.does_asset_exist(DST):
    lib.delete_asset(DST)
lib.duplicate_asset(SRC, DST)
abp = unreal.load_asset(DST)
res = unreal.HWEditorAnimTools.insert_output_slot(abp, SLOT)   # Python hands back the out message (bool dropped)
report["insert"] = str(res)
lib.save_loaded_asset(abp)

for hero in ("ain", "kain", "ryu", "sera"):
    da = unreal.load_asset(f"/Game/Animation/Heroes/DA_Hero_{hero}")
    for prop in ("skill1", "skill2", "skill3", "skill4", "ultimate"):
        b = da.get_editor_property(prop)
        b.set_editor_property("slot_name", SLOT)
        da.set_editor_property(prop, b)
    lib.save_loaded_asset(da)
report["sets"] = "skill bindings -> " + SLOT
with open(os.path.join(unreal.Paths.project_saved_dir(), "hero_fullbody.json"), "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=1)
