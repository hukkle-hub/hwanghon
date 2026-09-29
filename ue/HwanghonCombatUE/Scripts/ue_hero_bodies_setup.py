"""The four heroes' own bodies (docs/design/160) -> UE.

art/3d/heroes/<id>.glb (tools/3d/rig_boss_template.py with HW_RIG_TEMPLATE=art/3d/<id>_anim.glb: the Hi3D body on the
web game's mixamorig skeleton with that hero's 29 clips) -> /Game/Heroes/<id>/SkeletalMeshes/<id> + clips <id><clip>.
Scripts/ue_frontend_set.py puts them on the character stand; the fight still wears the Countess set (its AnimBP and
DA_Ain_Graybox are built on the Paragon skeleton) until the heroes' combat clips are moved over.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_hero_bodies_setup.py" -unattended -nullrhi
"""
import os

import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, "..", "..", "..", "art", "3d", "heroes"))
DEST = "/Game/Heroes"
lib = unreal.EditorAssetLibrary
BODY_METALLIC = 0.25


def log(msg):
    unreal.log(f"[HWHeroes] {msg}")


tasks = []
for f in sorted(os.listdir(SRC)) if os.path.isdir(SRC) else []:
    if f.endswith(".glb"):
        t = unreal.AssetImportTask()
        t.filename = os.path.join(SRC, f)
        t.destination_path = DEST
        t.automated = True
        t.replace_existing = True
        t.save = True
        tasks.append(t)
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks(tasks)
for t in tasks:
    hid = os.path.basename(t.filename)[:-4]
    folder = f"{DEST}/{hid}/SkeletalMeshes"
    clips = [os.path.basename(p).split(".")[0] for p in lib.list_assets(folder, recursive=False, include_folder=False)] \
        if lib.does_directory_exist(folder) else []
    log(f"{hid}: {len(clips)} assets in {folder}: {', '.join(sorted(clips))[:600]}")
    # Hi3D bakes a high metallic value into leather and cloth: under the stand's key light the whole outfit read as chrome
    # (first capture). The body material keeps its maps with MetallicFactor 0.25; weapons keep theirs.
    body = unreal.load_asset(f"{DEST}/{hid}/Materials/pbr_material")
    if body:
        unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(body, "MetallicFactor", BODY_METALLIC)
        lib.save_loaded_asset(body)
        log(f"{hid}: body MetallicFactor {BODY_METALLIC}")
log(f"{len(tasks)} heroes")
