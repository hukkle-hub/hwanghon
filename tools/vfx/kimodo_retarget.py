"""Kimodo X Bot take -> a Mixamo-named game rig in the same Blender scene (doc 181 §6, doc 178): per bone, the pose
rotation is moved through both rigs' rest orientations in armature space
    D = Rs_rest * q_src * Rs_rest^-1 ;  q_tgt = Rt_rest^-1 * D * Rt_rest
which is what copying rotations by bone name skipped (bones with different rolls bent the wrong way: Kain lay on his
back during the crouch). Root travel is dropped (other units); callers key the height themselves.

from kimodo_retarget import retarget ; action = retarget(target_armature, "take.fbx", "name")
"""
import bpy
from mathutils import Quaternion, Vector

XBOT_STAND_HIPS = 1.05


def retarget(tgt, path, name, hips_down=False):
    """hips_down: also key the hips' DROP below the take's standing height (crouches, landings), scaled by the two
    rigs' hip heights; rises are left out - the game lifts the body itself (docs/design/181 §8). Without it a crouch
    folds the legs up under a hips that stays put (the boss hung in the air)."""
    sc = bpy.context.scene
    before_o = set(sc.objects)
    before_a = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=True)
    new_o = [o for o in sc.objects if o not in before_o]
    src = next(o for o in new_o if o.type == "ARMATURE")
    sact = [a for a in bpy.data.actions if a not in before_a][0]
    f0, f1 = (int(round(x)) for x in sact.frame_range)
    sname = {b.name.replace("mixamorig_", "mixamorig:"): b.name for b in src.data.bones}
    pairs = [(tb, sname[tb.name]) for tb in tgt.pose.bones if tb.name in sname]
    # rest orientations in WORLD space (the two armature objects are rotated differently: X Bot FBX vs glTF rig);
    # a spin about the vertical mapped through armature space only turned Kain upside down in the sweep
    ws = src.matrix_world.to_quaternion()
    wt = tgt.matrix_world.to_quaternion()
    rs = {sn: ws @ src.data.bones[sn].matrix_local.to_quaternion() for _, sn in pairs}
    rt = {tb.name: wt @ tb.bone.matrix_local.to_quaternion() for tb, _ in pairs}
    out = bpy.data.actions.new(name)
    keys = {tb.name: [] for tb, _ in pairs}
    hip = next(((tb, sn) for tb, sn in pairs if tb.name.endswith("Hips")), None) if hips_down else None
    hip_keys = []
    if hip:
        t_rest = (tgt.matrix_world @ hip[0].bone.head_local).z - min((tgt.matrix_world @ b.head_local).z for b in tgt.data.bones)
        ratio = t_rest / max(1e-6, XBOT_STAND_HIPS)
        hm = tgt.matrix_world @ hip[0].bone.matrix_local   # world -> hips rest frame (pose location lives there)
        # X Bot standing hips height, measured in the standing takes (sf_flurry 1.05, sf_dive 1.00-1.05). Not the
        # first frame: sf_rise starts already crouched (0.90) and its deepest crouch (0.79) then read as 11 cm.
        stand = XBOT_STAND_HIPS
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        if hip:
            z = (src.matrix_world @ src.pose.bones[hip[1]].head).z
            dz = min(0.0, z - stand) * ratio
            hip_keys.append((f, hm.to_3x3().inverted() @ Vector((0.0, 0.0, dz))))
        for tb, sn in pairs:
            q = src.pose.bones[sn].matrix_basis.to_quaternion()
            D = rs[sn] @ q @ rs[sn].inverted()
            qt = rt[tb.name].inverted() @ D @ rt[tb.name]
            keys[tb.name].append((f, qt))
    # write via a temporary assignment so the slot / channel bag exist
    tgt.animation_data_create()
    prev = tgt.animation_data.action
    tgt.animation_data.action = out
    for tb, _ in pairs:
        tb.rotation_mode = "QUATERNION"
        last = None
        for f, q in keys[tb.name]:
            if last is not None and last.dot(q) < 0:
                q = Quaternion((-q.w, -q.x, -q.y, -q.z))
            tb.rotation_quaternion = q
            tb.keyframe_insert("rotation_quaternion", frame=f)
            last = q
    if hip:
        for f, v in hip_keys:
            hip[0].location = v
            hip[0].keyframe_insert("location", frame=f)
        hip[0].location = (0, 0, 0)
    tgt.animation_data.action = prev
    for o in new_o:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.actions.remove(sact)
    for tb in tgt.pose.bones:
        tb.matrix_basis.identity() if False else None
    print("RETARGET", name, "bones", len(pairs), "frames", f0, f1)
    return out
