"""Full-resolution head mesh of MH_<name>'s current face state (export_geometry) -> FBX, to measure where the
template shape is lost (fit vs build/LOD) - doc 177. Env MH_NAME. Out C:/w/mhlab/state_<name>.fbx, log export_geo_log.txt
"""
import os
import traceback

import unreal

NAMES = os.environ.get("MH_NAMES", os.environ.get("MH_NAME", "Ain")).split(",")
LOG = "C:/w/mhlab/export_geo_log.txt"
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


eal = unreal.EditorAssetLibrary
sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
for NAME in NAMES:
  try:
    char = unreal.load_asset(f"/Game/Heroes/MH_{NAME}")
    log(NAME, "edit", sub.try_add_object_to_edit(char))
    gp = unreal.MetaHumanGeometryExportParams()
    gp.project_path = f"/Game/Export/{NAME}"
    gp.head_skeletal_mesh = True
    gp.body_skeletal_mesh = False
    gp.full_body_skeletal_mesh = False
    gp.overwrite_existing_assets = True
    unreal.MetaHumanCharacterExportBlueprintLibrary.export_geometry(char, gp)
    sk = next((unreal.load_asset(x) for x in eal.list_assets(f"/Game/Export/{NAME}", recursive=True) if isinstance(unreal.load_asset(x), unreal.SkeletalMesh)), None)
    t = unreal.AssetExportTask()
    t.set_editor_property("object", sk)
    t.set_editor_property("filename", f"C:/w/mhlab/state_{NAME}.fbx")
    t.set_editor_property("automated", True)
    t.set_editor_property("replace_identical", True)
    t.set_editor_property("prompt", False)
    opt = unreal.FbxExportOption()
    opt.set_editor_property("level_of_detail", False)
    t.set_editor_property("options", opt)
    log(NAME, "fbx", unreal.Exporter.run_asset_export_task(t))
    sub.remove_object_to_edit(char)
  except Exception:
    log(NAME, "ERROR", traceback.format_exc())
unreal.SystemLibrary.quit_editor()
