"""Boss skill animatics for the other part-1 bosses (doc 181 §2): one script, one SKILL id, the rigged body from
art/3d/part1/<boss>.glb, Kimodo takes retargeted by kimodo_retarget.py, simple readable VFX, stills + PNG frames.

blender -b -P tools/vfx/boss_skill_animatic.py -- <skill> out_dir
skills:
  s09_frenzy  실험체 09호 «폭주 연타»: lurching 5-hit combo with an off-beat pause (Orphan of Kos rhythm breaking)
  s09_storm   실험체 09호 «방전 폭우» (phase 2): rears up, the arena darkens, 6 lightning telegraph circles -> strikes
  clave_shut  클레이브 «셔터 붕괴»: vanishes, reappears behind the target, 0.8 s frozen overhead, delayed crash,
              then a chain of 5 blasts walking outward (Radahn-style delayed hit + screen-filling follow-up)
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
SKILL, OUT = a[0], a[1]
os.makedirs(OUT, exist_ok=True)
FPS = 30
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kimodo_retarget import retarget  # noqa: E402

BOSS = {"s09_frenzy": "subject_09", "s09_storm": "subject_09", "clave_shut": "clave"}[SKILL]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=f"C:/w/hwanghon/art/3d/part1/{BOSS}.glb")
arm = next(o for o in sc.objects if o.type == "ARMATURE")
body = max((o for o in sc.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
for o in sc.objects:
    if o.type == "MESH" and o is not body:
        o.hide_render = True
arm.animation_data_create()
arm.animation_data.action = None
KD = "C:/w/hwanghon/art/anim/kimodo/"
acts = {}


def strip(name, t0, dur, part=(0.0, 1.0)):
    act = acts[name]
    f0, f1 = act.frame_range
    s0, s1 = f0 + (f1 - f0) * part[0], f0 + (f1 - f0) * part[1]
    trk = arm.animation_data.nla_tracks.new()
    s = trk.strips.new(f"{name}_{t0:.2f}", int(round(t0 * FPS)) + 1, act)
    if hasattr(s, "action_slot") and len(act.slots):
        s.action_slot = act.slots[0]
    s.action_frame_start, s.action_frame_end = s0, s1
    s.scale = max(0.02, dur * FPS / max(0.5, s1 - s0))
    s.frame_end = s.frame_start + dur * FPS
    s.extrapolation = "NOTHING"


def emis(nm, rgb, strength):
    m_ = bpy.data.materials.new(nm)
    m_.use_nodes = True
    t_ = m_.node_tree
    for n_ in list(t_.nodes):
        t_.nodes.remove(n_)
    e_ = t_.nodes.new("ShaderNodeEmission")
    e_.inputs[0].default_value = (*rgb, 1)
    e_.inputs[1].default_value = strength
    o_ = t_.nodes.new("ShaderNodeOutputMaterial")
    t_.links.new(e_.outputs[0], o_.inputs[0])
    return m_, e_


def vis_keys(ob, pairs):
    for tt, v in pairs:
        ob.hide_render = not v
        ob.keyframe_insert("hide_render", frame=max(1, int(round(tt * FPS)) + 1))


base = arm.location.copy()
sc.frame_set(1)
dg = bpy.context.evaluated_depsgraph_get()
bb = [body.evaluated_get(dg).matrix_world @ Vector(c) for c in body.bound_box]
cen = Vector((sum(v.x for v in bb) / 8, sum(v.y for v in bb) / 8, min(v.z for v in bb)))
HT = max(v.z for v in bb) - min(v.z for v in bb)
rnd = random.Random(9)
ORANGE = (1.0, 0.45, 0.1)
DUR = 4.0
SHOTS = []

if SKILL == "s09_frenzy":
    acts["c"] = retarget(arm, KD + "hw_kmd_s09_combo.fbx", "s09_combo")
    # 2 quick hits, a dead pause, 3 heavy fast hits (doc 181 «리듬 깨기»): hit times
    HITS = [0.55, 0.85, 1.95, 2.2, 2.5]
    strip("c", 0.0, 1.0, part=(0.0, 0.35))
    strip("c", 1.0, 0.8, part=(0.35, 0.42))      # the pause: almost frozen
    strip("c", 1.8, 1.2, part=(0.42, 0.85))
    strip("c", 3.0, 1.0, part=(0.85, 1.0))
    DUR = 4.0
    for i, h in enumerate(HITS):
        arc_m, _ = emis(f"arc{i}", ORANGE, 6)
        bpy.ops.mesh.primitive_torus_add(major_radius=1.6, minor_radius=0.03, major_segments=48, minor_segments=6)
        tor = bpy.context.active_object
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(tor.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if math.degrees(math.atan2(v.co.y, v.co.x)) % 360 > 120], context="VERTS")
        bm.to_mesh(tor.data)
        bm.free()
        tor.data.materials.append(arc_m)
        sd = 1 if i % 2 else -1
        tor.location = cen + Vector((0.2 * sd, -1.0, HT * 0.55))
        tor.rotation_euler = (math.radians(90 + 30 * sd), math.radians(20 * sd), math.radians(-60 + 50 * sd))
        vis_keys(tor, ((0, False), (h, True), (h + 0.15, False)))
    SHOTS = [("1_first", 0.55), ("2_second", 0.85), ("3_pause", 1.5), ("4_heavy1", 1.95), ("5_heavy3", 2.5), ("6_end", 3.4)]
elif SKILL == "s09_storm":
    acts["r"] = retarget(arm, KD + "hw_kmd_s09_roar.fbx", "s09_roar")
    strip("r", 0.0, 2.2, part=(0.0, 0.7))
    strip("r", 2.2, 3.0, part=(0.7, 1.0))
    DUR = 5.2
    pts = [(rnd.uniform(-6, 6), rnd.uniform(-7, 3)) for _ in range(6)]
    for i, (x, y) in enumerate(pts):
        t0 = 1.6 + 0.35 * i
        circ_m, ce = emis(f"tc{i}", (0.6, 0.75, 1.0), 0.0)
        bpy.ops.mesh.primitive_circle_add(vertices=48, radius=1.4, fill_type="NGON", location=(cen.x + x, cen.y + y, 0.02))
        c = bpy.context.active_object
        c.data.materials.append(circ_m)
        vis_keys(c, ((0, False), (t0, True), (t0 + 1.4, False)))
        for tt, e in ((t0, 0.1), (t0 + 1.2, 1.6), (t0 + 1.3, 0.0)):
            ce.inputs[1].default_value = e
            ce.inputs[1].keyframe_insert("default_value", frame=int(round(tt * FPS)) + 1)
        bolt_m, _ = emis(f"bolt{i}", (0.85, 0.92, 1.0), 25)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=14, location=(cen.x + x, cen.y + y, 7))
        b = bpy.context.active_object
        b.data.materials.append(bolt_m)
        vis_keys(b, ((0, False), (t0 + 1.2, True), (t0 + 1.32, False)))
    SHOTS = [("1_hunch", 0.6), ("2_rear", 1.6), ("3_circles", 2.4), ("4_bolt1", 2.85), ("5_bolts", 3.6), ("6_after", 4.6)]
elif SKILL == "clave_shut":
    acts["t"] = retarget(arm, KD + "hw_kmd_clave_tele.fbx", "clave_tele")
    # vanish 0.3 s -> appear behind 0.2 s -> raise + frozen 0.8 s -> crash 0.15 s -> chain blasts
    strip("t", 0.5, 1.4, part=(0.0, 0.55))
    strip("t", 1.9, 0.15, part=(0.55, 0.7))
    strip("t", 2.05, 1.95, part=(0.7, 1.0))
    DUR = 4.0
    # teleport: hidden 0.3 -> 0.5, moves 4 m
    for tt, y in ((0, 0), (0.3, 0), (0.31, -4.0), (DUR, -4.0)):
        arm.location = base + Vector((0, y, 0))
        arm.keyframe_insert("location", frame=int(round(tt * FPS)) + 1)
    vis_keys(body, ((0, True), (0.3, False), (0.5, True)))
    smoke_m, _ = emis("smoke", (0.25, 0.2, 0.18), 1.5)
    for k, (yy, t0) in enumerate(((0, 0.3), (-4.0, 0.5))):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=(cen.x, cen.y + yy, HT * 0.5))
        sm = bpy.context.active_object
        sm.data.materials.append(smoke_m)
        for tt, s_, v in ((t0 - 0.01, 0.1, False), (t0, 0.4, True), (t0 + 0.25, 1.4, True), (t0 + 0.3, 1.4, False)):
            sm.scale = (s_, s_, s_ * 1.5)
            sm.hide_render = not v
            sm.keyframe_insert("scale", frame=int(round(tt * FPS)) + 1)
            sm.keyframe_insert("hide_render", frame=int(round(tt * FPS)) + 1)
        sm.hide_render = True
        sm.keyframe_insert("hide_render", frame=1)
    # chain blasts walking out in front: 5 rings 1.2 s apart... (0.12 s apart), orange
    for i in range(5):
        t0 = 2.05 + 0.12 * i
        bl_m, _ = emis(f"bl{i}", ORANGE, 8)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=(cen.x, cen.y - 4.0 - 1.4 - 1.6 * i, 0.3))
        bs = bpy.context.active_object
        bs.data.materials.append(bl_m)
        for tt, s_, v in ((t0 - 0.01, 0.1, False), (t0, 0.3, True), (t0 + 0.2, 1.3, True), (t0 + 0.3, 1.3, False)):
            bs.scale = (s_, s_, s_ * 0.8)
            bs.hide_render = not v
            bs.keyframe_insert("scale", frame=int(round(tt * FPS)) + 1)
            bs.keyframe_insert("hide_render", frame=int(round(tt * FPS)) + 1)
        bs.hide_render = True
        bs.keyframe_insert("hide_render", frame=1)
    SHOTS = [("1_vanish", 0.35), ("2_appear", 0.6), ("3_raise", 1.2), ("4_frozen", 1.85), ("5_crash", 2.1), ("6_chain", 2.4)]

def overlay(poses, ramp):
    """hand keys on the arm bones over the Kimodo strips: poses {t: (upper dir, fore dir)} in world space for the
    left arm (the right mirrored), the overlay's influence ramp [(t, v)] (doc 178 §6 method)"""
    from mathutils import Matrix
    AW = arm.matrix_world.copy()
    cache = {}
    for tt, (du, df) in poses.items():
        f = int(round(tt * FPS)) + 1
        arm.animation_data.action = None
        sc.frame_set(f)
        bpy.context.view_layer.update()
        for side in ("Left", "Right"):
            sg = 1 if side == "Left" else -1
            for bn, dv in ((f"mixamorig:{side}Arm", du), (f"mixamorig:{side}ForeArm", df)):
                pb = arm.pose.bones[bn]
                d_ = (AW.inverted().to_3x3() @ Vector((dv.x * sg, dv.y, dv.z)).normalized()).normalized()
                q = (pb.tail - pb.head).normalized().rotation_difference(d_)
                h = pb.head.copy()
                pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
                bpy.context.view_layer.update()
                cache[(f, bn)] = pb.matrix_basis.to_quaternion().copy()
        for pb in arm.pose.bones:
            pb.matrix_basis = Matrix.Identity(4)
    over = bpy.data.actions.new("overlay")
    arm.animation_data.action = over
    for (f, bn), q in cache.items():
        pb = arm.pose.bones[bn]
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = q
        pb.keyframe_insert("rotation_quaternion", frame=f)
    for tt, v in ramp:
        arm.animation_data.action_influence = v
        arm.animation_data.keyframe_insert("action_influence", frame=int(round(tt * FPS)) + 1)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)


if SKILL == "clave_shut":
    # the shutter held high over the head, frozen; then crashed down in front
    overlay({1.2: (Vector((0.15, 0.1, 1)), Vector((0.05, 0.25, 1))), 1.9: (Vector((0.15, 0.15, 1)), Vector((0.05, 0.35, 1))),
             2.05: (Vector((0.15, -1, -0.2)), Vector((0.05, -1, -0.5))), 2.6: (Vector((0.2, -1, -0.4)), Vector((0.1, -0.9, -0.7)))},
            [(0, 0), (0.9, 0), (1.2, 1), (2.6, 1), (3.2, 0)])
elif SKILL == "s09_frenzy":
    # long-limbed body: wide sweeping arms on the heavy hits
    overlay({1.95: (Vector((1, -0.4, 0.2)), Vector((0.8, -0.9, -0.1))), 2.2: (Vector((-0.2, -1, 0.1)), Vector((-0.6, -0.8, -0.2))),
             2.5: (Vector((0.3, -0.6, 1)), Vector((0.2, -1, 0.3)))}, [(0, 0), (1.8, 0), (1.95, 1), (2.6, 1), (3.0, 0)])
sc.frame_start, sc.frame_end = 1, int(DUR * FPS)
bpy.ops.mesh.primitive_plane_add(size=60)
gm = bpy.data.materials.new("ground")
gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.2, 0.19, 0.18, 1)
bpy.context.active_object.data.materials.append(gm)
sc.world = bpy.data.worlds.new("w")
sc.world.use_nodes = True
bg = sc.world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.35, 0.36, 0.42, 1)
bg.inputs[1].default_value = 1.0
if SKILL == "s09_storm":                      # the arena darkens as the storm is called
    for tt, v in ((0, 1.0), (1.6, 0.25), (DUR, 0.25)):
        bg.inputs[1].default_value = v
        bg.inputs[1].keyframe_insert("default_value", frame=int(round(tt * FPS)) + 1)
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 4
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
sc.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.lens = 24
look = cen + Vector((0, -2.0 if SKILL == "clave_shut" else 0, HT * 0.5))
cam.location = look + Vector((7.5, -10.5, 3.5)) if SKILL != "s09_storm" else look + Vector((10, -16, 9))
cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 960, 540
for name, tt in SHOTS:
    sc.frame_set(int(round(tt * FPS)) + 1)
    sc.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
sc.render.resolution_x, sc.render.resolution_y = 640, 360
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = os.path.join(OUT, "frames", "f_")
bpy.ops.render.render(animation=True)
print("BOSS out", SKILL, OUT, [n for n, _ in SHOTS])
