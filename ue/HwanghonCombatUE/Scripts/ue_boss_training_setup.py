"""Training boss motion set from the project's own boss clips (doc 131).

The web game's training boss (Mixamo rig, /Game/Bosses/Training/boss_anim) came with pattern clips
(hookL/R, charge, slam, spin, kick, hammer...) but no AnimBP. Retargeting ABP_Unarmed onto it gave the
locomotion clips but no AnimBP (duplicate_and_retarget skips blueprints), so the body runs single node:
UHWBossPresentationComponent scrubs these clips on the boss clock. This script writes DA_Boss_Training.

Contacts start from the web game's hitFrac (js/dungeons.js, "hand/foot fastest"). Four were moved to where
the limb actually arrives (doc 132, sampled 60 frames): slam hands finish the descent at 0.31 (0.26 is
mid-fall, hands still 2 m up), kick foot fully out at 0.41, scythe blade in front at 0.50, charge shove at
0.22 (0.62 is already standing up). Clips moved from other rigs (slam/spin/kick) stand 26-39 cm above the
idle ground; ClipGroundOffsetCm (measured here from the toes) lowers the body while they play.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_boss_training_setup.py" -unattended -nullrhi
"""
import unreal

OUT = "/Game/Animation/Boss"
CLIPS = "/Game/Bosses/Training/boss_anim/SkeletalMeshes/boss_anim"
lib = unreal.EditorAssetLibrary

# clip -> contact 0..1 (web hitFrac; slam/kick/scythe/charge measured, see the docstring)
HIT = {"atk_hookR": 0.54, "atk_hookL": 0.54, "atk_charge": 0.22, "atk_slam": 0.31, "atk_spin": 0.49,
       "atk_kick": 0.41, "atk_hammer": 0.48, "atk_bolt": 0.35, "atk_scythe": 0.50}
FEET = ("mixamorig_LeftFoot", "mixamorig_RightFoot", "mixamorig_LeftToeBase", "mixamorig_RightToeBase")

# Local patterns (HWCombatTuningAsset): one clip per beat, contact on the beat.
LOCAL = {
    "HookCombo": [("atk_hookR", None), ("atk_hookL", None), ("atk_hammer", None)],   # beats 0.08 / 0.40 / 1.15
    "Charge": [("atk_charge", None)],
    "Slam": [("atk_slam", None)],
    "Spin": [("atk_spin", 0.29), ("atk_spin", 0.48), ("atk_spin", 0.535)],          # arms cross the front: L, R, L (one turn)
    "GroundWave": [("atk_hammer", None)],
}
# Online beats are keyed by the server's pattern icon (server/raid.cjs snapshot boss.pattern.icon).
ONLINE = {"hookL": "atk_hookL", "hookR": "atk_hookR", "charge": "atk_charge", "slam": "atk_slam", "spin": "atk_spin",
          "kick": "atk_kick", "hammer": "atk_hammer", "bolt": "atk_bolt", "scythe": "atk_scythe"}


def log(msg):
    unreal.log(f"[HWBoss] {msg}")


def clip(name):
    path = CLIPS + name
    seq = unreal.load_asset(path)
    if not seq:
        raise RuntimeError(f"missing clip {path}")
    return seq


def seq_binding(name, loop=False):
    b = unreal.HWSequenceBinding()
    b.set_editor_property("sequence", clip(name))
    b.set_editor_property("loop", loop)
    return b


def pattern(beats):
    p = unreal.HWBossPatternAnimationBinding()
    p.set_editor_property("strike", seq_binding(beats[0][0]))
    p.set_editor_property("beat_sequences", [clip(n) for n, _ in beats])
    p.set_editor_property("source_beat_normalized", [HIT[n] if u is None else u for n, u in beats])
    return p


def lowest_toe(seq, samples=30):
    """Lowest foot/toe height over the clip (mesh cm)."""
    opts = unreal.AnimPoseEvaluationOptions()
    low = 1e9
    for i in range(samples):
        t = seq.get_play_length() * i / (samples - 1)
        pose = unreal.AnimPoseExtensions.get_anim_pose_at_time(seq, t, opts)
        for b in FEET:
            low = min(low, unreal.AnimPoseExtensions.get_bone_pose(pose, b, unreal.AnimPoseSpaces.WORLD).translation.z)
    return low


def ground_offsets(names):
    ground = lowest_toe(clip("idle"))
    out = {}
    for n in sorted(set(names)):
        lift = lowest_toe(clip(n)) - ground
        if lift > 3.0:   # a few cm of toe roll is not a float
            out[clip(n)] = round(lift, 1)
            log(f"{n}: stands {lift:.1f} cm above idle ground -> lowered")
    return out


def main():
    lib.make_directory(OUT)
    path = f"{OUT}/DA_Boss_Training"
    da = unreal.load_asset(path) if lib.does_asset_exist(path) else unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        "DA_Boss_Training", OUT, unreal.HWAnimationSetAsset, unreal.DataAssetFactory())
    patterns = {k: pattern(v) for k, v in LOCAL.items()}
    # FName keys are case-insensitive: online "spin"/"slam"/"charge" ARE the local Spin/Slam/Charge keys.
    # Keep the local multi-beat binding there (an online beat uses its first contact).
    local_keys = {k.lower() for k in patterns}
    patterns.update({k: pattern([(v, None)]) for k, v in ONLINE.items() if k.lower() not in local_keys})
    da.set_editor_property("boss_patterns", patterns)
    da.set_editor_property("boss_idle", seq_binding("idle", True))
    da.set_editor_property("boss_walk", seq_binding("walk", True))
    da.set_editor_property("boss_death", seq_binding("death"))
    for prop in ("boss_light_reaction", "boss_finisher_reaction", "boss_smash_reaction", "boss_counter_reaction"):
        da.set_editor_property(prop, seq_binding("hit"))
    da.set_editor_property("boss_stagger_reaction", seq_binding("stagger"))
    da.set_editor_property("boss_break_reaction", seq_binding("down"))
    used = [n for v in LOCAL.values() for n, _ in v] + list(ONLINE.values())
    da.set_editor_property("clip_ground_offset_cm", ground_offsets(used))
    lib.save_loaded_asset(da)
    log(f"wrote {path}: {len(patterns)} patterns")


main()
