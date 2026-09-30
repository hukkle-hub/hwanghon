"""DA_Boss_Scarecrow (docs/design/168): the EP01 scarecrow's own motion set from the retargeted Mixamo clips.

Starts from DA_Boss_Training (the other patterns and online keys keep the old clips) and replaces what the
scarecrow fight shows: a 3 m body's weight (Mutant idle/walk), the spin as a real 360 attack, the elbow as a
short punch, the rebound as an actual knock-down onto the mat (the old "down" held a 60 cm plank with an arm up).
Contacts were measured from bone positions (Saved/MixamoBones61, hand furthest in front of the hips):
360 High: right 0.33, left 0.52, left again 0.60 · Mutant Punch: right 0.27.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_boss_scarecrow_set.py" -unattended -nullrhi
"""
import os
import sys

import unreal

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import ue_boss_training_setup as base  # noqa: E402

MX = "/Game/Animation/Boss/Scarecrow/Mixamo/"
OUT = "/Game/Animation/Boss/DA_Boss_Scarecrow"
lib = unreal.EditorAssetLibrary


def mx(name):
    seq = unreal.load_asset(MX + name)
    if not seq:
        raise RuntimeError("missing " + MX + name)
    return seq


def bind(name, loop=False):
    b = unreal.HWSequenceBinding()
    b.set_editor_property("sequence", mx(name))
    b.set_editor_property("loop", loop)
    return b


def pattern(name, contacts):
    p = unreal.HWBossPatternAnimationBinding()
    p.set_editor_property("strike", bind(name))
    p.set_editor_property("beat_sequences", [mx(name) for _ in contacts])
    p.set_editor_property("source_beat_normalized", list(contacts))
    return p


if lib.does_asset_exist(OUT):
    lib.delete_asset(OUT)
lib.duplicate_asset("/Game/Animation/Boss/DA_Boss_Training", OUT)
da = unreal.load_asset(OUT)
patterns = dict(da.get_editor_property("boss_patterns"))
patterns["Spin"] = pattern("MX_Standing_Melee_Attack_360_High", (0.33, 0.52, 0.60))
patterns["Elbow"] = pattern("MX_Mutant_Punch", (0.27,))
da.set_editor_property("boss_patterns", patterns)
da.set_editor_property("boss_idle", bind("MX_Mutant_Breathing_Idle", True))
da.set_editor_property("boss_walk", bind("MX_Mutant_Walking", True))
da.set_editor_property("boss_break_reaction", bind("MX_Knocked_Down"))
da.set_editor_property("boss_smash_reaction", bind("MX_Standing_React_Large_From_Front"))
da.set_editor_property("boss_stagger_reaction", bind("MX_Standing_React_Large_From_Front"))
da.set_editor_property("boss_injured_idle", bind("MX_Injured_Idle", True))
da.set_editor_property("boss_injured_walk", bind("MX_Injured_Walk", True))
da.set_editor_property("boss_roar", bind("MX_Mutant_Roaring"))

# floating clips are lowered to the idle's ground, as the training set does
ground = base.lowest_toe(mx("MX_Mutant_Breathing_Idle"))
offsets = dict(da.get_editor_property("clip_ground_offset_cm"))
for n in ("MX_Mutant_Walking", "MX_Standing_Melee_Attack_360_High", "MX_Mutant_Punch", "MX_Standing_React_Large_From_Front"):
    lift = base.lowest_toe(mx(n)) - ground
    if lift > 3.0:
        offsets[mx(n)] = round(lift, 1)
da.set_editor_property("clip_ground_offset_cm", offsets)
lib.save_loaded_asset(da)
unreal.log(f"[HWBoss] wrote {OUT}")
