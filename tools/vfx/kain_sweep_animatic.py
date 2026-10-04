"""Kain skill 3 «한 바퀴 쓸어베기» animatic (doc 178 §3: coil 0.4 s -> one full turn 0.35 s -> hitstop 0.13 s -> recover);
built from kain_leap_animatic.py. Original header of that file:
Kain skill 4 «도약 내려찍기» animatic (doc 178 §3): Kain's rigged game body (art/3d/kain_anim.glb) + the Kimodo
leap-slam take, timed to the order sheet: crouch 0.35 s -> jump -> apex hold 0.1 s -> fall 0.12 s -> impact with a white
dust ring, ground cracks and debris -> hitstop 0.18 s -> recovery. Greatsword from art/3d/gear/w_kain_greatsword.glb
in the right hand.

blender -b -P tools/vfx/kain_leap_animatic.py -- out_dir
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)
FPS = 30
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
bpy.ops.import_scene.gltf(filepath="C:/w/hwanghon/art/3d/kain_anim.glb")
arm = next(o for o in sc.objects if o.type == "ARMATURE")
for o in sc.objects:
    if o.type == "MESH" and len(o.data.vertices) < 100:
        o.hide_render = True
arm.animation_data_create()
arm.animation_data.action = None


def load_kimodo(path):
    before_a = set(bpy.data.actions)
    before_o = set(sc.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=True)
    a_ = [a for a in bpy.data.actions if a not in before_a][0]
    for o in [o for o in sc.objects if o not in before_o]:
        bpy.data.objects.remove(o, do_unlink=True)
    try:
        fcs = a_.layers[0].strips[0].channelbags[0].fcurves
    except Exception:
        fcs = a_.fcurves
    for fc in list(fcs):
        if fc.data_path.endswith("location"):
            fcs.remove(fc)
            continue
        fc.data_path = fc.data_path.replace('"mixamorig_', '"mixamorig:')
    return a_


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kimodo_retarget import retarget  # noqa: E402
act = retarget(arm, "C:/w/hwanghon/art/anim/kimodo/hw_kmd_kain_sweep.fbx", "kain_sweep")
f0, f1 = act.frame_range
L = f1 - f0
# time remap (order sheet): source 0..0.55 = windup/raise, 0.55..0.75 = strike down, 0.75..1 = crouch hold
SEG = [(0.00, 0.40, 0.0, 0.35), (0.40, 0.35, 0.35, 0.75), (0.75, 0.13, 0.75, 0.77), (0.88, 0.72, 0.77, 1.00)]          # (start s, dur s, src from, src to): crouch+jump, apex, fall, hitstop, recover
for i, (t0, d, a0, a1) in enumerate(SEG):
    trk = arm.animation_data.nla_tracks.new()
    s = trk.strips.new(f"s{i}", int(round(t0 * FPS)) + 1, act)
    if hasattr(s, "action_slot") and len(act.slots):
        s.action_slot = act.slots[0]
    s.action_frame_start, s.action_frame_end = f0 + L * a0, f0 + L * a1
    s.scale = max(0.02, d * FPS / max(0.5, L * (a1 - a0)))
    s.frame_end = s.frame_start + d * FPS
    s.extrapolation = "NOTHING"
DUR = 1.6
# --- hand keys on top (doc 178 §6): sword overhead at the apex, struck down at impact. An overlay action holds
# only the arm bones; its influence is 0 outside the strike so the Kimodo take shows through
from mathutils import Matrix  # noqa: E402
AW = arm.matrix_world.copy()
ARMB = ["mixamorig:RightArm", "mixamorig:RightForeArm", "mixamorig:LeftArm", "mixamorig:LeftForeArm"]
over = bpy.data.actions.new("kain_strike_overlay")
POSES = {0.40: (Vector((-0.2, 0.6, 0.05)), Vector((-0.4, 0.7, 0.1))),    # coiled: blade behind
         0.58: (Vector((0.2, -1, 0.0)), Vector((0.3, -1, -0.05))),     # mid turn: blade out in front
         0.75: (Vector((0.6, -0.5, -0.3)), Vector((0.6, -0.6, -0.5))),   # end of the turn: low out front
         1.1: (Vector((0.3, -0.5, -0.8)), Vector((0.3, -0.6, -0.8)))}     # recovering, blade low
POSE_CACHE = {}
for tt, (du, df) in POSES.items():
    f = int(round(tt * FPS)) + 1
    arm.animation_data.action = None
    sc.frame_set(f)
    bpy.context.view_layer.update()
    for side in ("Right", "Left"):
        sg = 1 if side == "Left" else -1
        for bn, dv in ((f"mixamorig:{side}Arm", du), (f"mixamorig:{side}ForeArm", df)):
            pb = arm.pose.bones[bn]
            d_ = Vector((dv.x * sg, dv.y, dv.z)).normalized()
            # armature space of this rig: Mixamo glTF rigs are Y-up inside the armature; map world dir to armature
            d_arm = (AW.inverted().to_3x3() @ d_).normalized()
            cur = (pb.tail - pb.head).normalized()
            q = cur.rotation_difference(d_arm)
            h = pb.head.copy()
            pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
            bpy.context.view_layer.update()
            POSE_CACHE[(f, bn)] = pb.matrix_basis.to_quaternion().copy()
    # wrist: the blade (the hand bone's local Z, KAIN_SWORD_AX=z) towards a world direction at the impact keys
    wdir = {0.40: Vector((-0.3, 1, 0.1)), 0.58: Vector((0.1, -1, 0.0)), 0.75: Vector((0.7, -0.7, -0.15)), 1.1: Vector((0.4, -0.8, -0.5))}.get(tt)
    if wdir is not None:
        pb = arm.pose.bones["mixamorig:RightHand"]
        bz = pb.matrix.to_3x3().col[2].normalized()
        q = bz.rotation_difference((AW.inverted().to_3x3() @ wdir.normalized()).normalized())
        h = pb.head.copy()
        pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
        bpy.context.view_layer.update()
        POSE_CACHE[(f, "mixamorig:RightHand")] = pb.matrix_basis.to_quaternion().copy()
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
arm.animation_data.action = over
if hasattr(arm.animation_data, "action_slot") and len(over.slots) == 0:
    pass
for (f, bn), q in POSE_CACHE.items():
    pb = arm.pose.bones[bn]
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = q
    pb.keyframe_insert("rotation_quaternion", frame=f)
OVER_ON = os.environ.get("KAIN_NO_OVERLAY") != "1"
for tt, v in ((0.0, 0.0), (0.30, 0.0), (0.40, 1.0 * OVER_ON), (1.1, 1.0 * OVER_ON), (1.5, 0.0)):
    arm.animation_data.action_influence = v
    arm.animation_data.keyframe_insert("action_influence", frame=int(round(tt * FPS)) + 1)
for pb in arm.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
print("ANIM overlay keys", len(POSE_CACHE))
sc.frame_start, sc.frame_end = 1, int(DUR * FPS)
base = arm.location.copy()
for tt, z in ((0, 0), (0.35, -0.08), (0.75, -0.05), (DUR, 0)):
    arm.location = base + Vector((0, 0, z))
    arm.keyframe_insert("location", frame=int(round(tt * FPS)) + 1)
# greatsword in the right hand: its long axis along a chosen axis of the hand bone (KAIN_SWORD_AX: x, -x, z, -z),
# the grip end at the palm
try:
    from mathutils import Matrix as _M
    import numpy as _np
    before = set(sc.objects)
    bpy.ops.import_scene.gltf(filepath="C:/w/hwanghon/art/3d/gear/w_kain_greatsword.glb")
    new = [o for o in sc.objects if o not in before]
    swm = max((o for o in new if o.type == "MESH"), key=lambda o: len(o.data.vertices))
    bpy.context.view_layer.update()
    swm.data.transform(swm.matrix_world)
    for o in new:
        if o is not swm:
            bpy.data.objects.remove(o, do_unlink=True)
    swm.parent = None
    swm.matrix_world = _M.Identity(4)
    V = _np.array([v.co[:] for v in swm.data.vertices])
    ax_i = int(_np.argmax(V.max(0) - V.min(0)))
    lo, hi = V[:, ax_i].min(), V[:, ax_i].max()
    # grip = the narrower end (cross-section width at 8 % from each end)
    def width(t):
        sl = V[_np.abs(V[:, ax_i] - t) < (hi - lo) * 0.04]
        o_ = [j for j in range(3) if j != ax_i]
        return float((sl[:, o_].max(0) - sl[:, o_].min(0)).sum()) if len(sl) else 9
    grip_lo = width(lo + (hi - lo) * 0.08) < width(hi - (hi - lo) * 0.08)
    if os.environ.get("KAIN_GRIP_FLIP", "1") == "1":
        grip_lo = not grip_lo
    gz = lo + (hi - lo) * 0.06 if grip_lo else hi - (hi - lo) * 0.06
    # sword local: grip at origin, blade along +Y
    T = _M.Translation(Vector([-gz if j == ax_i else -V[:, j].mean() for j in range(3)]))
    swm.data.transform(T)
    if ax_i != 1:
        swm.data.transform(_M.Rotation(math.radians(-90 if ax_i == 2 else 90), 4, "X" if ax_i == 2 else "Z"))
    if not grip_lo:
        swm.data.transform(_M.Rotation(math.pi, 4, "X"))
    L_ = hi - lo
    sc_ = float(os.environ.get("KAIN_SWORD_LEN", "1.5")) / L_
    swm.data.transform(_M.Scale(sc_, 4))
    hand = arm.data.bones["mixamorig:RightHand"]
    swm.parent = arm
    swm.parent_type = "BONE"
    swm.parent_bone = "mixamorig:RightHand"
    ax = os.environ.get("KAIN_SWORD_AX", "z")
    R = {"x": _M.Rotation(math.radians(-90), 4, "Z"), "-x": _M.Rotation(math.radians(90), 4, "Z"),
         "z": _M.Rotation(math.radians(90), 4, "X"), "-z": _M.Rotation(math.radians(-90), 4, "X")}[ax]
    # bone-parented children sit at the bone tail in bone space (y along the bone); move back to the palm
    swm.matrix_parent_inverse = _M.Identity(4)
    swm.matrix_basis = _M.Translation((0, -hand.length * 0.45, 0)) @ R
    print("ANIM sword axis", ax, "len scale", round(sc_, 3), "grip low", grip_lo)
except Exception as e:  # noqa: BLE001
    import traceback
    traceback.print_exc()
# sweep FX: a flat steel-blue arc around the body during the turn, then fading
em = bpy.data.materials.new("arc")
em.use_nodes = True
nt = em.node_tree
for n_ in list(nt.nodes):
    nt.nodes.remove(n_)
e_ = nt.nodes.new("ShaderNodeEmission")
e_.inputs[0].default_value = (0.5, 0.65, 1.0, 1)
e_.inputs[1].default_value = 5
o_ = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(e_.outputs[0], o_.inputs[0])
import bmesh as _bm
for k in range(6):
    bpy.ops.mesh.primitive_torus_add(major_radius=1.55, minor_radius=0.03, major_segments=64, minor_segments=6,
                                     location=base + Vector((0, 0, 1.05)))
    tor = bpy.context.active_object
    tor.data.materials.append(em)
    bm = _bm.new()
    bm.from_mesh(tor.data)
    a_end = 60 * (k + 1)
    _bm.ops.delete(bm, geom=[v for v in bm.verts if math.degrees(math.atan2(v.co.y, v.co.x)) % 360 > a_end], context="VERTS")
    bm.to_mesh(tor.data)
    bm.free()
    tor.rotation_euler = (0, 0, math.radians(90))
    t_on = 0.40 + 0.35 * k / 6
    for f, vis in ((1, False), (int(t_on * FPS) + 1, True), (int((t_on + 0.06) * FPS) + 1, k == 5), (int(1.0 * FPS) + 1, False)):
        tor.hide_render = not vis
        tor.keyframe_insert("hide_render", frame=f)
# ground, world, light, camera
bpy.ops.mesh.primitive_plane_add(size=40)
gm = bpy.data.materials.new("ground")
gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.35, 0.32, 0.28, 1)
bpy.context.active_object.data.materials.append(gm)
sc.world = bpy.data.worlds.new("w")
sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.6, 0.7, 1)
sc.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 4
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
sc.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.lens = 28
cam.location = base + Vector((4.5, -6.5, 2.6))
d = (base + Vector((0, -0.7, 1.2))) - cam.location
cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
# camera shake on impact
for tt, dx in ((0.74, 0), (0.78, 0.06), (0.82, -0.05), (0.86, 0.03), (0.92, 0)):
    cam.location = base + Vector((4.5 + dx, -6.5, 2.6 + dx * 0.5))
    cam.keyframe_insert("location", frame=int(tt * FPS) + 1)
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 960, 540
sc.frame_set(int(0.35 * FPS) + 1)
bpy.context.view_layer.update()
hq = arm.pose.bones["mixamorig:Hips"].matrix.to_euler()
print("ANIM hips at 0.35", [round(math.degrees(x)) for x in hq])
for name, tt in (("1_coil", 0.35), ("2_turn_a", 0.5), ("3_turn_b", 0.62), ("4_turn_end", 0.74), ("5_hitstop", 0.82), ("6_recover", 1.3)):
    sc.frame_set(int(tt * FPS) + 1)
    sc.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
if os.environ.get("KAIN_STILLS_ONLY") == "1":
    print("ANIM out", OUT)
    sys.exit(0)
sc.render.resolution_x, sc.render.resolution_y = 640, 360
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = os.path.join(OUT, "frames", "f_")
bpy.ops.render.render(animation=True)
print("ANIM out", OUT)
