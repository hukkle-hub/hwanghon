"""Training boss (the stand-in body of every story fight) with smoothed skin weights (docs/design/151 §2.1).

tools/3d/smooth_skin.py writes a copy of art/3d/boss_anim.glb whose weights are averaged over mesh neighbours
(edge stretch in the hook attack x10.6 -> x6.7). It is staged under the same file name so the import replaces
/Game/Bosses/Training/boss_anim in place (clips keep their paths; DA_Boss_Training is rebuilt for the ground offsets).
The web game keeps art/3d/boss_anim.glb as it is.

  env HW_BOSS_GLB=<staged dir>/boss_anim.glb
  UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_boss_training_reskin.py" -unattended -nullrhi
"""
import os

import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
src = os.environ["HW_BOSS_GLB"]
assert os.path.basename(src) == "boss_anim.glb", "stage the file as boss_anim.glb so it replaces the same assets"
t = unreal.AssetImportTask()
t.filename = src
t.destination_path = "/Game/Bosses/Training"
t.automated = True
t.replace_existing = True
t.save = True
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
unreal.log(f"[HWBossReskin] imported {len(list(t.imported_object_paths))} objects")
ns = {"__name__": "ue_boss_training_setup"}
exec(open(os.path.join(HERE, "ue_boss_training_setup.py"), encoding="utf-8").read(), ns)
ns["build"]()
unreal.log("[HWBossReskin] done")
