"""Bone positions of every clip of a boss body, straight from the animation data (docs/design/165) - no rendering,
no editor tick (posing a SkeletalMeshActor in the editor did not evaluate: every clip read as the reference pose,
2026-09-30). Writes <out>/clip_bones.json: {clip: {"len": s, "samples": [{"t": s, "bones": {name: [x, y, z]}}]}}
in component space (feet on z = 0 in the reference pose). tools/3d/clip_bone_sheet.py draws and judges it.

  UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_boss_clip_bones.py" -unattended -nullrhi
      (env HW_CLIPS=<folder of AnimSequences>, HW_OUT=<dir>, HW_SAMPLES=13)
"""
import json
import os

import unreal

folder = os.environ.get("HW_CLIPS", "/Game/Bosses/Training/boss_anim/SkeletalMeshes")
out = os.environ.get("HW_OUT", ".")
n = int(os.environ.get("HW_SAMPLES", "13"))
reg = unreal.AssetRegistryHelpers.get_asset_registry()
opt = unreal.AnimPoseEvaluationOptions()
result = {}
for d in reg.get_assets_by_path(folder, recursive=True):
    if str(d.asset_class_path.asset_name) != "AnimSequence":
        continue
    seq = unreal.load_asset(str(d.package_name))
    ln = seq.get_play_length()
    samples = []
    for k in range(n):
        t = ln * k / (n - 1)
        pose = unreal.AnimPoseExtensions.get_anim_pose_at_time(seq, t, opt)
        bones = {}
        for b in unreal.AnimPoseExtensions.get_bone_names(pose):
            p = unreal.AnimPoseExtensions.get_bone_pose(pose, b, unreal.AnimPoseSpaces.WORLD).translation
            bones[str(b)] = [round(p.x, 1), round(p.y, 1), round(p.z, 1)]
        samples.append({"t": round(t, 3), "bones": bones})
    result[str(d.asset_name)] = {"len": round(ln, 3), "samples": samples}
os.makedirs(out, exist_ok=True)
with open(os.path.join(out, "clip_bones.json"), "w", encoding="utf-8") as f:
    json.dump(result, f)
unreal.log(f"[HWBones] {len(result)} clips x {n} samples -> {out}")
