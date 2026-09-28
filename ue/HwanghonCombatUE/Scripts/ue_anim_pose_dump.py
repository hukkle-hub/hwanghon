"""Dump bone positions of animation clips for stick-figure review (doc 127 §2, doc 128).

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_anim_pose_dump.py" -unattended -nullrhi
  env HW_POSE_CLIPS  = comma separated asset paths (default: Countess kit/life candidates)
  env HW_POSE_OUT    = output JSON (default Saved/AnimPose/poses.json)
  env HW_POSE_SAMPLES = samples per clip (default 8)
Draw with Scripts/make_pose_sheet.py.
"""
import json
import os

import unreal

COUNTESS = "/Game/ParagonCountess/Characters/Heroes/Countess/Animations"
DEFAULT = [f"{COUNTESS}/{n}" for n in (
    "Ability_Q", "Ability_E", "Ability_RMB_InMotion", "Cast", "Attack_Melee_Air", "Ability_Ultimate",
    "Death", "Knock_Bwd", "Knock_Fwd", "Stun_Start", "Stun_Loop", "Respawn", "Recall", "Hitreact_Fwd")]
BONES = ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head",
         "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l", "clavicle_r", "upperarm_r", "lowerarm_r", "hand_r",
         "thigh_l", "calf_l", "foot_l", "ball_l", "thigh_r", "calf_r", "foot_r", "ball_r",
         "weapon_l", "weapon_r", "sword_tail_l_02", "sword_tail_r_02"]


def main():
    clips = [c for c in os.environ.get("HW_POSE_CLIPS", ",".join(DEFAULT)).split(",") if c]
    out = os.environ.get("HW_POSE_OUT", os.path.join(unreal.Paths.project_saved_dir(), "AnimPose", "poses.json"))
    samples = int(os.environ.get("HW_POSE_SAMPLES", "8"))
    opts = unreal.AnimPoseEvaluationOptions()
    result = {}
    for path in clips:
        seq = unreal.load_asset(path)
        if not seq:
            unreal.log_warning(f"[pose] missing {path}")
            continue
        length = seq.get_play_length()
        frames = []
        for i in range(samples):
            t = length * i / max(1, samples - 1)
            pose = unreal.AnimPoseExtensions.get_anim_pose_at_time(seq, t, opts)
            names = set(str(n) for n in unreal.AnimPoseExtensions.get_bone_names(pose))
            bones = {}
            for b in BONES:
                if b in names:
                    tr = unreal.AnimPoseExtensions.get_bone_pose(pose, b, unreal.AnimPoseSpaces.WORLD)
                    loc = tr.translation
                    bones[b] = [round(loc.x, 1), round(loc.y, 1), round(loc.z, 1)]
            frames.append({"t": round(t, 3), "bones": bones})
        result[path.rsplit("/", 1)[-1]] = {"length": round(length, 3), "frames": frames}
        unreal.log(f"[pose] {path} {length:.3f}s")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f)
    unreal.log(f"[pose] wrote {out}")


main()
