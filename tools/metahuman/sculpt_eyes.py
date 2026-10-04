"""Hooded eyes by landmarks (doc 177 §7): copy MH_<name> to MH_<name>_<tag> and move the upper-lid landmarks down
(and the lower lids up a little) with translate_face_landmarks, then commit + save.
Landmark ids from landmarks_Ain.json (UE cm, x = side, z = up): upper lids 35 36 | 51 52, lower lids 37 | 53.
Env MH_NAME, MH_VARIANTS = "tag:upper_cm:lower_cm;..." (upper moves down, lower moves up). Log sculpt_log.txt.
"""
import os
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
VARS = [v.split(":") for v in os.environ.get("MH_VARIANTS", "l15:0.15:0.03").split(";") if v]
UPPER = [35, 36, 51, 52]
LOWER = [37, 53]
LOG = "C:/w/mhlab/sculpt_log.txt"
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


eal = unreal.EditorAssetLibrary
sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
for tag, up, lo in VARS:
    try:
        dst = f"/Game/Heroes/MH_{NAME}_{tag}"
        if eal.does_asset_exist(dst):
            eal.delete_asset(dst)
        char = eal.duplicate_asset(f"/Game/Heroes/MH_{NAME}", dst)
        sub.try_add_object_to_edit(char)
        before = sub.get_face_landmarks(char)
        ids = UPPER + LOWER
        deltas = [unreal.Vector(0, 0, -float(up)) for _ in UPPER] + [unreal.Vector(0, 0, float(lo)) for _ in LOWER]
        sub.translate_face_landmarks(char, ids, deltas)
        after = sub.get_face_landmarks(char)
        moved = [round(after[i].z - before[i].z, 3) for i in ids]
        sub.commit_face_state(char)
        eal.save_loaded_asset(char)
        sub.remove_object_to_edit(char)
        log(tag, "moved z", moved)
    except Exception:
        log("ERROR", tag, traceback.format_exc())
unreal.SystemLibrary.quit_editor()
