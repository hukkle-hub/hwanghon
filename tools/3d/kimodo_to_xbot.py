"""Kimodo BVH (SOMA77, standard T-pose) -> Mixamo X Bot FBX, headless Blender (docs/design/172).

The X Bot clip then goes through the same UE path as the Mixamo hero clips (Scripts/ue_mixamo_heroes.py:
X Bot skeleton -> RTG_XBot_To_Countess). Bones are matched by world rotation relative to each rig's T-pose:
    target_world = (source_world * source_rest_world^-1) * target_rest_world
so differing bone rolls between the two rigs do not matter; the hips position is scaled by the hips heights.

blender -b -P tools/3d/kimodo_to_xbot.py -- <in.bvh> <out.fbx> [xbot_tpose.fbx]
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
WITH_MESH = os.environ.get("KMD_MESH", "0") == "1"   # armature only: UE ignores import_rotation for a file with a mesh
BVH, OUT = argv[0], argv[1]
XBOT = argv[2] if len(argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "..", "art", "anim", "mixamo_heroes", "_XBot_TPose_skin.fbx")

# SOMA77 -> Mixamo (the X Bot file already carries mixamorig_ names, docs/design/168)
MAP = {
    "Hips": "Hips", "Spine1": "Spine", "Spine2": "Spine1", "Chest": "Spine2", "Neck1": "Neck", "Head": "Head",
    "LeftLeg": "LeftUpLeg", "LeftShin": "LeftLeg", "LeftFoot": "LeftFoot", "LeftToeBase": "LeftToeBase",
    "RightLeg": "RightUpLeg", "RightShin": "RightLeg", "RightFoot": "RightFoot", "RightToeBase": "RightToeBase",
}
for side in ("Left", "Right"):
    for b in ("Shoulder", "Arm", "ForeArm", "Hand"):
        MAP[side + b] = side + b
    for f in ("Thumb", "Index", "Middle", "Ring", "Pinky"):
        for i in (1, 2, 3):
            MAP[f"{side}Hand{f}{i}"] = f"{side}Hand{f}{i}"

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30   # Kimodo always outputs 30 fps

bpy.ops.import_scene.fbx(filepath=os.path.abspath(XBOT), automatic_bone_orientation=False, ignore_leaf_bones=True)
tgt = next(o for o in scene.objects if o.type == "ARMATURE")
bpy.ops.import_anim.bvh(filepath=os.path.abspath(BVH), axis_forward="-Z", axis_up="Y", update_scene_fps=False,
                        update_scene_duration=True, rotate_mode="NATIVE")
src = next(o for o in scene.objects if o.type == "ARMATURE" and o != tgt)
# the clip's own length: update_scene_duration left the default 250 frames (8.4 s of a held last pose)
a0, a1 = src.animation_data.action.frame_range
scene.frame_start, scene.frame_end = int(a0), int(a1)
bpy.context.view_layer.update()

prefix = "mixamorig_"
pairs = [(s, prefix + t) for s, t in MAP.items() if s in src.pose.bones and (prefix + t) in tgt.pose.bones]
missing = [s for s in MAP if s not in src.pose.bones or (prefix + MAP[s]) not in tgt.pose.bones]


def rest_world(obj, name):
    return obj.matrix_world @ obj.data.bones[name].matrix_local


# facing: both rigs in T-pose; turn the BVH so it faces the same way as the X Bot
def lateral(obj, hips, hand):
    v = rest_world(obj, hand).translation - rest_world(obj, hips).translation
    return Vector((v.x, v.y)).normalized()


# hip to hip (the T-pose arms are not exactly level in SOMA: hands gave 5 deg); both rigs are axis-aligned -> snap to 90
a = lateral(src, "RightLeg", "LeftLeg")
b = lateral(tgt, prefix + "RightUpLeg", prefix + "LeftUpLeg")
ang = math.atan2(b.y, b.x) - math.atan2(a.y, a.x)
ang = round(ang / (math.pi / 2)) * (math.pi / 2)
src.matrix_world = Matrix.Rotation(ang, 4, "Z") @ src.matrix_world
bpy.context.view_layer.update()

# scale by leg length (hips over ankle), not hips height: the X Bot's ankle sits higher, and the hips ratio sank
# every take ~20 cm into the floor (lowest foot -9..-13 cm against +12 cm for the Mixamo clips)
src_ank = rest_world(src, "LeftFoot").translation.z
tgt_ank = rest_world(tgt, prefix + "LeftFoot").translation.z
ratio = (rest_world(tgt, prefix + "Hips").translation.z - tgt_ank) / max(1e-6, rest_world(src, "Hips").translation.z - src_ank)
src_rest = {s: rest_world(src, s).to_quaternion() for s, _ in pairs}
tgt_rest = {t: rest_world(tgt, t).to_quaternion() for _, t in pairs}
tgt_obj_q = tgt.matrix_world.to_quaternion()

# parents before children
order = sorted(pairs, key=lambda p: len(tgt.data.bones[p[1]].parent_recursive))
for _, t in pairs:
    tgt.pose.bones[t].rotation_mode = "QUATERNION"
f0, f1 = int(scene.frame_start), int(scene.frame_end)
for f in range(f0, f1 + 1):
    scene.frame_set(f)
    for s, t in order:
        sw = src.matrix_world @ src.pose.bones[s].matrix
        q_world = sw.to_quaternion() @ src_rest[s].inverted() @ tgt_rest[t]
        pb = tgt.pose.bones[t]
        m = (tgt_obj_q.inverted() @ q_world).to_matrix().to_4x4()
        if t == prefix + "Hips":
            w = Vector((sw.translation.x * ratio, sw.translation.y * ratio, tgt_ank + (sw.translation.z - src_ank) * ratio))
            m.translation = tgt.matrix_world.inverted() @ w
        else:
            m.translation = pb.matrix.translation
        pb.matrix = m
        bpy.context.view_layer.update()
        pb.keyframe_insert("rotation_quaternion", frame=f)
        if t == prefix + "Hips":
            pb.keyframe_insert("location", frame=f)

# export the X Bot, named like a Mixamo download
bpy.data.objects.remove(src, do_unlink=True)
tgt.name = "Armature"
bpy.ops.object.select_all(action="DESELECT")
tgt.select_set(True)
# armature only (UE path). Without a skin cluster there is no bind pose, so a Blender re-import takes the export frame's
# pose as the rest pose - the comparison render copies world matrices and does not depend on it (xbot_clip_render.py)
for ch in tgt.children:
    ch.select_set(WITH_MESH)
bpy.context.view_layer.objects.active = tgt
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.fbx(filepath=os.path.abspath(OUT), use_selection=True, object_types={"ARMATURE", "MESH"} if WITH_MESH else {"ARMATURE"},
                         bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
                         add_leaf_bones=False, primary_bone_axis="Y", secondary_bone_axis="X")
# UE: import these with import_rotation roll +90 (Scripts/ue_mixamo_heroes.py) - the armature node carries Blender's
# 90 deg X turn and UE drops it for a skeleton rooted at the hips: no export axis option changed that (doc 172 §3)
print(f"KIMODO_TO_XBOT frames {f0}-{f1} pairs {len(pairs)} missing {missing} ratio {ratio:.3f} turn {math.degrees(ang):.0f}")
