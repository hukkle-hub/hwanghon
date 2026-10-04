"""Export the built MetaHuman face (LOD0) as FBX for sculpting in Blender (Na0n's method, docs/design/177).
Env MH_NAME (Ain/Sera). Out: C:/w/mhlab/template_<name>.fbx + vertex count to template_<name>.txt
"""
import os
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
out = []
try:
    sk = unreal.load_asset(os.environ.get("MH_TEMPLATE_SRC", f"/Game/Heroes/Built/{NAME}/MH_{NAME}/Face/SKM_MH_{NAME}_FaceMesh"))
    out.append(f"mesh {sk}")
    t = unreal.AssetExportTask()
    t.set_editor_property("object", sk)
    t.set_editor_property("filename", f"C:/w/mhlab/template_{NAME}.fbx")
    t.set_editor_property("automated", True)
    t.set_editor_property("replace_identical", True)
    t.set_editor_property("prompt", False)
    opt = unreal.FbxExportOption()
    for k, v in (("level_of_detail", False), ("export_morph_targets", False), ("collision", False), ("export_source_mesh", True)):
        try:
            opt.set_editor_property(k, v)
        except Exception as e:  # noqa: BLE001
            out.append(f"opt {k} err {e}")
    t.set_editor_property("options", opt)
    ok = unreal.Exporter.run_asset_export_task(t)
    out.append(f"export {ok} size {os.path.getsize(f'C:/w/mhlab/template_{NAME}.fbx') if os.path.exists(f'C:/w/mhlab/template_{NAME}.fbx') else -1}")
except Exception:
    out.append(traceback.format_exc())
open(f"C:/w/mhlab/template_{NAME}.txt", "w").write("\n".join(out))

unreal.SystemLibrary.quit_editor()
