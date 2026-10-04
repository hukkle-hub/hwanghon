"""Dump MH_<name>'s face landmarks (get_face_landmarks) to landmarks_<name>.json - to find the eyelid points (doc 177 §7)."""
import json
import os
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
out = {}
try:
    sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
    char = unreal.load_asset(f"/Game/Heroes/MH_{NAME}")
    out["edit"] = sub.try_add_object_to_edit(char)
    lm = sub.get_face_landmarks(char)
    out["landmarks"] = [[v.x, v.y, v.z] for v in lm]
    for fn in dir(sub):
        if "landmark" in fn.lower() or "eye" in fn.lower() or "sculpt" in fn.lower() or "blend" in fn.lower():
            out.setdefault("api", []).append(fn)
except Exception:
    out["error"] = traceback.format_exc()
json.dump(out, open(f"C:/w/mhlab/landmarks_{NAME}.json", "w"))
unreal.SystemLibrary.quit_editor()
