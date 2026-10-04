"""Shadow Fang «그림자 난무» 3D animatic (doc 181 §3): the rigged part-1 body (art/3d/part1/shadow_fang.glb) with its
template clips laid out on the motion-study timings (tools/vfx/shadowfang-motion-study.html), violet slash arcs at
the hit frames, a chest light following the tell curve. Renders key stills + an mp4 for the director.

blender -b -P tools/vfx/shadowfang_animatic.py -- out_dir
"""
import math
import os
import sys

import bpy
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1]
os.makedirs(OUT, exist_ok=True)
FPS = 30
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
bpy.ops.import_scene.gltf(filepath="C:/w/hwanghon/art/3d/part1/shadow_fang.glb")
arm = next(o for o in sc.objects if o.type == "ARMATURE")
for o in sc.objects:
    if o.type == "MESH" and len(o.data.vertices) < 100:
        o.hide_render = True
acts = {a.name: a for a in bpy.data.actions}
arm.animation_data_create()
arm.animation_data.action = None
tr = arm.animation_data.nla_tracks.new()


def strip(name, t0, dur, scale_to=True, part=None):
    a = acts[name]
    f0, f1 = a.frame_range
    if part:
        f0, f1 = f0 + (f1 - f0) * part[0], f0 + (f1 - f0) * part[1]
    trk = arm.animation_data.nla_tracks.new()      # one track per strip: a fresh strip spans the whole clip before scaling
    s = trk.strips.new(f"{name}_{t0:.2f}", int(round(t0 * FPS)) + 1, a)
    s.extrapolation = "NOTHING"
    if hasattr(s, "action_slot") and len(a.slots):
        s.action_slot = a.slots[0]
    s.action_frame_start, s.action_frame_end = f0, f1
    s.scale = max(0.05, dur * FPS / max(1.0, (f1 - f0)))
    s.frame_end = s.frame_start + dur * FPS
    s.blend_in = s.blend_out = 0
    return s


# Kimodo takes (X Bot FBX, mixamorig bones) -> actions on this rig by bone name (doc 181 §5)
def load_kimodo(path, name):
    before_a = set(bpy.data.actions)
    before_o = set(sc.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=True)
    new_a = [a for a in bpy.data.actions if a not in before_a]
    for o in [o for o in sc.objects if o not in before_o]:
        bpy.data.objects.remove(o, do_unlink=True)
    if new_a:
        a_ = new_a[0]
        # X Bot bones are mixamorig_*, this rig's mixamorig:*
        try:
            fcs = a_.layers[0].strips[0].channelbags[0].fcurves
        except Exception:
            fcs = a_.fcurves
        for fc in list(fcs):
            if fc.data_path.endswith("location"):     # X Bot root travel is in other units; heights are keyed below
                fcs.remove(fc)
                continue
            fc.data_path = fc.data_path.replace('"mixamorig_', '"mixamorig:')
        new_a[0].name = name
        acts[name] = new_a[0]
        print("ANIMATIC kimodo", name, new_a[0].frame_range[:])
USE_KIMODO = os.environ.get("SF_KIMODO", "1") == "1"
if USE_KIMODO:
    KD = "C:/w/hwanghon/art/anim/kimodo/"
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from kimodo_retarget import retarget  # noqa: E402
    for nm in ("sf_rise", "sf_flurry", "sf_dive", "sf_thrust"):
        acts[nm] = retarget(arm, KD + f"hw_kmd_{nm}.fbx", nm)
# timings = motion study «그림자 난무»
SKILL = os.environ.get("SF_SKILL", "flurry")
if SKILL == "thrust":
    # «무음 찌르기» (motion study tab 2): frozen coil 1.25 s, lunge 0.12 s over 9 m, slide 1.5 m, 1 s opening
    strip("sf_thrust", 0.0, 1.25, part=(0.0, 0.42))
    strip("sf_thrust", 1.25, 0.12, part=(0.42, 0.55))
    strip("sf_thrust", 1.37, 0.40, part=(0.55, 0.75))
    strip("sf_thrust", 1.77, 1.23, part=(0.75, 1.0))
elif SKILL == "bloom":
    # «그림자 개화» (tab 3): tear 1.0 s, rise to 6 m 0.6 s, hang 1.6 s, dive 0.2 s, burst, pool
    strip("sf_rise", 0.0, 1.0, part=(0.0, 0.35))
    strip("sf_rise", 1.0, 0.6, part=(0.35, 0.6))
    strip("sf_flurry", 1.6, 1.6, part=(0.0, 0.2))
    strip("sf_dive", 3.2, 3.2, part=(0.3, 1.0))
elif USE_KIMODO and "sf_rise" in acts:
    strip("sf_rise", 0.0, 1.25, part=(0.0, 0.55))           # crouch, spring
    t = 1.25
    for set_i, (n, gap) in enumerate(((5, .14), (5, .14), (7, .12))):
        strip("sf_flurry", t, n * gap, part=(0.3, 0.75))   # one fast pass of the clawing per set
        t += n * gap
        if set_i < 2:
            strip("sf_rise", t, 0.6, part=(0.45, 0.6))
            t += 0.6
    strip("sf_dive", 4.75, 1.85, part=(0.35, 1.0))          # dive, stuck
else:
    strip("atk_charge", 0.0, 0.9, part=(0.0, 0.45))          # crouch / coil (tell)
    strip("atk_charge", 0.9, 0.35, part=(0.45, 0.6))        # spring up
    t = 1.25
    for set_i, (n, gap) in enumerate(((5, .14), (5, .14), (7, .12))):
        for k in range(n):
            strip("atk_hookL" if (k + set_i) % 2 else "atk_hookR", t + k * gap, gap, part=(0.3, 0.7))
        t += n * gap
        if set_i < 2:
            strip("idle", t, 0.6, part=(0.0, 0.3))
            t += 0.6
    strip("atk_slam", 4.75, 0.25, part=(0.45, 0.8))          # dive
    strip("stagger", 5.0, 1.4)                                 # stuck in the ground
sc.frame_start, sc.frame_end = 1, int(6.6 * FPS)
# rise / dive: the armature object height
base = arm.location.copy()
sc.frame_set(1)
bossm = max((o for o in sc.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
deg = bossm.evaluated_get(bpy.context.evaluated_depsgraph_get())
bb = [deg.matrix_world @ Vector(c) for c in deg.bound_box]
cen = Vector((sum(v.x for v in bb) / 8, sum(v.y for v in bb) / 8, min(v.z for v in bb)))
print("ANIMATIC boss centre", [round(x, 2) for x in cen], "height", round(max(v.z for v in bb) - min(v.z for v in bb), 2))


def keyz(tt, z):
    arm.location = base + Vector((0, 0, z))
    arm.keyframe_insert("location", frame=int(round(tt * FPS)) + 1)


if SKILL == "thrust":
    sc.frame_end = int(3.0 * FPS)
    for tt, y in ((0, 0), (1.25, 0), (1.29, -3.0), (1.33, -6.5), (1.37, -9.0), (1.77, -10.5), (3.0, -10.5)):
        arm.location = base + Vector((0, y, 0))
        arm.keyframe_insert("location", frame=int(round(tt * FPS)) + 1)
    for fc in (arm.animation_data.action.fcurves if arm.animation_data.action and hasattr(arm.animation_data.action, "fcurves") else []):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
elif SKILL == "bloom":
    sc.frame_end = int(6.4 * FPS)
    for tt, z in ((0, 0), (1.0, 0), (1.6, 6.0), (3.2, 6.2), (3.4, 0), (6.4, 0)):
        keyz(tt, z)
else:
    for tt, z in ((0, 0), (.9, 0), (1.25, 2.4), (1.95, 2.55), (2.55, 2.4), (3.25, 2.55), (3.85, 2.4), (4.75, 2.5), (5.0, 0), (6.6, 0)):
        keyz(tt, z)
# chest light (tell curve): ramps over the coil, flashes on the hits
li = bpy.data.objects.new("chest", bpy.data.lights.new("chest", "POINT"))
li.data.color = (0.62, 0.48, 1.0)
sc.collection.objects.link(li)
li.parent = arm
li.location = Vector((0, -0.25, 1.7))
for tt, e in ((0, 20), (.9, 400), (1.25, 250), (4.75, 600), (5.0, 50), (6.4, 5)):
    li.data.energy = e
    li.data.keyframe_insert("energy", frame=int(round(tt * FPS)) + 1)
# slash arcs: a violet emissive torus segment per hit, visible for 0.15 s
mat = bpy.data.materials.new("slash")
mat.use_nodes = True
nt = mat.node_tree
for n_ in list(nt.nodes):
    nt.nodes.remove(n_)
em = nt.nodes.new("ShaderNodeEmission")
em.inputs[0].default_value = (0.62, 0.45, 1.0, 1)
em.inputs[1].default_value = 3.5
outn = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(em.outputs[0], outn.inputs[0])
hits = [1.25 + i * .14 for i in range(5)] + [2.55 + i * .14 for i in range(5)] + [3.85 + i * .12 for i in range(7)]
if SKILL in ("thrust", "bloom"):
    hits = []
for i, h in enumerate(hits):
    bpy.ops.mesh.primitive_torus_add(major_radius=1.6, minor_radius=0.025, major_segments=48, minor_segments=6)
    tor = bpy.context.active_object
    tor.data.materials.append(mat)
    # keep a 110 degree arc
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(tor.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if math.degrees(math.atan2(v.co.y, v.co.x)) % 360 > 110], context="VERTS")
    bm.to_mesh(tor.data)
    bm.free()
    side = -1 if (i % 2) else 1
    tor.rotation_euler = (math.radians(90 + 25 * side), math.radians(15 * side), math.radians(-60 + 40 * side + i * 23))
    zz = 2.4 + 1.4 if h < 4.75 else 1.4
    tor.location = cen + Vector((0.2 * side, -0.6, zz))
    for f, vis in ((int(h * FPS), False), (int(h * FPS) + 1, True), (int((h + .15) * FPS) + 1, False)):
        tor.hide_render = not vis
        tor.keyframe_insert("hide_render", frame=max(1, f))
# shockwave ring at the dive
bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.04)
ring = bpy.context.active_object
ring.data.materials.append(mat)
ring.location = cen + Vector((0, 0, 0.05))
ring.hide_render = True
ring.keyframe_insert('hide_render', frame=1)
for tt, s_, vis in ((4.74, 0.1, False), (4.75, 0.2, True), (5.05, 4.0, True), (5.1, 4.0, False)):
    ring.scale = (s_, s_, 1)
    ring.hide_render = not vis
    ring.keyframe_insert("scale", frame=int(tt * FPS) + 1)
    ring.keyframe_insert("hide_render", frame=int(tt * FPS) + 1)
# ground, world, camera
bpy.ops.mesh.primitive_plane_add(size=40)
gm = bpy.data.materials.new("ground")
gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.03, 0.028, 0.035, 1)
gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.6
bpy.context.active_object.data.materials.append(gm)
sc.world = bpy.data.worlds.new("w")
sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.04, 0.08, 1)
sc.world.node_tree.nodes["Background"].inputs[1].default_value = 1.4
key = bpy.data.objects.new("key", bpy.data.lights.new("key", "SUN"))
key.data.energy = 5.0
key.data.color = (0.75, 0.72, 0.9)
key.rotation_euler = (math.radians(55), 0, math.radians(35))
sc.collection.objects.link(key)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.lens = 24
cam.location = cen + Vector((4.5, -8.5, 3.0))
d = (cen + Vector((0, 0, 2.6))) - cam.location
if SKILL == "thrust":
    cam.data.lens = 24
    cam.location = cen + Vector((9.5, -4.5, 3.0))
    d = (cen + Vector((0, -4.5, 1.0))) - cam.location
cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 960, 540
try:
    sc.eevee.use_bloom = True
except AttributeError:
    pass
# stills at the phase marks
if SKILL == "bloom":
    # telegraph disc (8 m) filling 1.6 -> 3.2 s, petal burst 3.4 -> 3.9 s, dark pool to 6.4 s
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
    bpy.ops.mesh.primitive_circle_add(vertices=96, radius=8.0, fill_type="NGON", location=(cen.x, cen.y, 0.02))
    disc = bpy.context.active_object
    dm_, de_ = emis("disc", (0.12, 0.03, 0.22), 0.0)
    disc.data.materials.append(dm_)
    for tt, vis in ((0, False), (1.6, True), (3.4, False)):
        disc.hide_render = not vis
        disc.keyframe_insert("hide_render", frame=int(tt * FPS) + 1)
    for tt, e in ((0, 0.0), (1.6, 0.05), (3.2, 1.2), (3.4, 0.0)):
        de_.inputs[1].default_value = e
        de_.inputs[1].keyframe_insert("default_value", frame=int(tt * FPS) + 1)
    bpy.ops.mesh.primitive_torus_add(major_radius=8.0, minor_radius=0.06, major_segments=128, location=(cen.x, cen.y, 0.05))
    rim = bpy.context.active_object
    rim.data.materials.append(mat)
    for tt, vis in ((0, False), (1.6, True), (3.4, False)):
        rim.hide_render = not vis
        rim.keyframe_insert("hide_render", frame=int(tt * FPS) + 1)
    pm_, pe_ = emis("petal", (0.08, 0.03, 0.14), 1.0)
    import random as _r
    rr = _r.Random(4)
    for i in range(24):
        a_ = i / 24 * 2 * math.pi + rr.random() * 0.2
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1.0, location=(cen.x, cen.y, 0.3))
        pt = bpy.context.active_object
        pt.data.materials.append(pm_)
        pt.rotation_euler = (0, math.radians(20), a_)
        for tt, r_, sz, vis in ((3.39, 0.0, 0.01, False), (3.4, 0.3, 0.2, True), (3.9, 7.5, 1.0, True), (4.3, 8.2, 0.6, False)):
            pt.location = (cen.x + math.cos(a_) * r_, cen.y + math.sin(a_) * r_, 0.3 + 0.6 * math.sin(min(1, r_ / 7.5) * math.pi))
            pt.scale = (1.2 * sz, 0.35 * sz, 0.12 * sz)
            pt.hide_render = not vis
            for path in ("location", "scale", "hide_render"):
                pt.keyframe_insert(path, frame=int(tt * FPS) + 1)
        pt.hide_render = True
        pt.keyframe_insert("hide_render", frame=1)
    bpy.ops.mesh.primitive_circle_add(vertices=96, radius=7.8, fill_type="NGON", location=(cen.x, cen.y, 0.03))
    pool = bpy.context.active_object
    poolm, poole = emis("pool", (0.06, 0.0, 0.12), 0.8)
    pool.data.materials.append(poolm)
    for tt, vis in ((0, False), (3.9, True), (6.4, True)):
        pool.hide_render = not vis
        pool.keyframe_insert("hide_render", frame=int(tt * FPS) + 1)
    # wider shot from higher up
    cam.data.lens = 20
    cam.location = cen + Vector((10.0, -14.0, 9.0))
    dd = (cen + Vector((0, 0, 2.5))) - cam.location
    cam.rotation_euler = dd.to_track_quat("-Z", "Y").to_euler()
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
SHOTS = (("1_coil", .8), ("2_rise", 1.2), ("3_set1", 1.4), ("4_set3", 4.1), ("5_dive", 4.8), ("6_stuck", 5.6))
if SKILL == "thrust":
    # the thrust path: a ground shadow line darkening over the coil, ghost trail during the lunge
    bpy.ops.mesh.primitive_plane_add(size=1)
    lane = bpy.context.active_object
    lane.scale = (1.6, 9.0, 1)
    lane.location = Vector((cen.x, cen.y - 4.5, 0.02))
    lm = bpy.data.materials.new("lane")
    lm.use_nodes = True
    ntl = lm.node_tree
    for n_ in list(ntl.nodes):
        ntl.nodes.remove(n_)
    el = ntl.nodes.new("ShaderNodeEmission")
    el.inputs[0].default_value = (0.35, 0.15, 0.8, 1)
    ol = ntl.nodes.new("ShaderNodeOutputMaterial")
    ntl.links.new(el.outputs[0], ol.inputs[0])
    lane.data.materials.append(lm)
    for tt, e in ((0.0, 0.0), (0.3, 0.2), (1.1, 1.5), (1.25, 2.5), (1.4, 0.0)):
        el.inputs[1].default_value = e
        el.inputs[1].keyframe_insert("default_value", frame=int(tt * FPS) + 1)
    # streak along the path during the lunge
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=9.0, location=cen + Vector((0, -4.5, 1.3)), rotation=(math.radians(90), 0, 0))
    stk = bpy.context.active_object
    stk.data.materials.append(mat)
    for tt, vis in ((0, False), (1.25, True), (1.45, False)):
        stk.hide_render = not vis
        stk.keyframe_insert("hide_render", frame=int(tt * FPS) + 1)
    # ghosts: copies of the evaluated boss at 4 points of the lunge
    for gi, gt in enumerate((1.28, 1.31, 1.34)):
        sc.frame_set(int(gt * FPS) + 1)
        dg = bpy.context.evaluated_depsgraph_get()
        gme = bpy.data.meshes.new_from_object(bossm.evaluated_get(dg), depsgraph=dg)
        gme.transform(bossm.matrix_world)
        gob = bpy.data.objects.new(f"ghost{gi}", gme)
        sc.collection.objects.link(gob)
        gme.materials.clear()
        gm_ = bpy.data.materials.new(f"ghost{gi}")
        gm_.use_nodes = True
        nt_ = gm_.node_tree
        for n_ in list(nt_.nodes):
            nt_.nodes.remove(n_)
        eg = nt_.nodes.new("ShaderNodeEmission")
        eg.inputs[0].default_value = (0.4, 0.25, 0.9, 1)
        eg.inputs[1].default_value = 0.6 + 0.4 * gi
        og = nt_.nodes.new("ShaderNodeOutputMaterial")
        nt_.links.new(eg.outputs[0], og.inputs[0])
        gme.materials.append(gm_)
        gob.location.y += -9.0 * (gi + 1) / 4 - (gob.location.y)
        for tt, vis in ((0, False), (1.25, True), (1.5, False)):
            gob.hide_render = not vis
            gob.keyframe_insert("hide_render", frame=int(tt * FPS) + 1)
    SHOTS = (("1_coil", .4), ("2_coil_late", 1.15), ("3_lunge", 1.31), ("4_slide", 1.6), ("5_open", 2.2), ("6_end", 2.9))
if SKILL == "bloom":
    SHOTS = (("1_tear", .6), ("2_rise", 1.5), ("3_hang", 2.8), ("4_dive", 3.35), ("5_burst", 3.7), ("6_pool", 5.0))
for name, tt in SHOTS:
    sc.frame_set(int(tt * FPS) + 1)
    sc.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
# video: PNG frames (this Blender build has no FFMPEG writer) -> animated webp with PIL outside
sc.render.resolution_x, sc.render.resolution_y = 640, 360
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = os.path.join(OUT, "frames", "f_")
sc.frame_end = int({"thrust": 3.0, "bloom": 6.4}.get(SKILL, 6.6) * FPS)
bpy.ops.render.render(animation=True)
print("ANIMATIC out", OUT)
