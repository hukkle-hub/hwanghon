"""MH_<name> from a wrapped template head (docs/design/177, Na0n's «Conform -> Import from template»).
Env MH_NAME, MH_TEMPLATE (FBX, head skin only, MetaHuman topology), MH_ALIGN (none|srt). Log: import_template_log.txt
"""
import os
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
FBX = os.environ.get("MH_TEMPLATE", f"C:/w/mhlab/{NAME.lower()}_wrapped_head.fbx")
LOG = "C:/w/mhlab/import_template_log.txt"
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


eal = unreal.EditorAssetLibrary
sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
try:
    t = unreal.AssetImportTask()
    for k, v in (("filename", FBX), ("destination_path", f"/Game/Template/{NAME}"), ("automated", True),
                 ("save", True), ("replace_existing", True)):
        t.set_editor_property(k, v)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
    sms = [x for x in eal.list_assets(f"/Game/Template/{NAME}", recursive=True) if isinstance(unreal.load_asset(x), unreal.StaticMesh)]
    sm = unreal.load_asset(sms[0])
    log("template", sm, "verts", sm.get_num_vertices(0), "bounds", sm.get_bounds().box_extent)

    PRESET = {"Ain": "Aera", "Sera": "Aera"}[NAME]
    dst = f"/Game/Heroes/MH_{NAME}"
    if eal.does_asset_exist(dst):
        eal.delete_asset(dst)
    char = eal.duplicate_asset(f"/MetaHumanCharacter/Optional/Presets/{PRESET}", dst)
    log("character", char, "edit", sub.try_add_object_to_edit(char))

    p = unreal.ImportFromTemplateParams()
    align = {"none": unreal.MetaHumanAlignmentOptions.NONE, "srt": unreal.MetaHumanAlignmentOptions.SCALING_ROTATION_TRANSLATION}[os.environ.get("MH_ALIGN", "srt")]
    for k, v in (("match_vertices_by_u_vs", True), ("use_eye_meshes", False), ("use_teeth_mesh", False),
                 ("alignment_options", align), ("block_until_complete", True)):
        try:
            p.set_editor_property(k, v)
        except Exception as e:  # noqa: BLE001
            log("param", k, "err", e)
    log("params", p)
    code = sub.import_from_template(char, sm, None, None, None, p)
    log("import_from_template", code)
    sub.commit_face_state(char)
    eal.save_loaded_asset(char)
    log("saved")
except Exception:
    log("ERROR", traceback.format_exc())
unreal.SystemLibrary.quit_editor()
