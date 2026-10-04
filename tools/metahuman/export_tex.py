"""Export the built face base colour (LOD1) of MH_<name> as PNG -> C:/w/mhlab/tex_<name>_BC.png (doc 177 §14)."""
import os, traceback
import unreal
NAME = os.environ.get("MH_NAME", "Sera")
out = []
try:
    t = unreal.load_asset(f"/Game/Heroes/Built/{NAME}/MH_{NAME}/Face/Baked/T_Head_LOD1_BC")
    out.append(f"tex {t} {t.blueprint_get_size_x()}x{t.blueprint_get_size_y()}")
    task = unreal.AssetExportTask()
    for k, v in (("object", t), ("filename", f"C:/w/mhlab/tex_{NAME}_BC.png"), ("automated", True), ("replace_identical", True), ("prompt", False)):
        task.set_editor_property(k, v)
    out.append(f"export {unreal.Exporter.run_asset_export_task(task)}")
except Exception:
    out.append(traceback.format_exc())
open(f"C:/w/mhlab/export_tex_{NAME}.txt", "w").write("\n".join(out))
unreal.SystemLibrary.quit_editor()
