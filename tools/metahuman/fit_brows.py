"""Eyebrows as a decal mesh (doc 177 §12): the MetaHuman brow groom renders pale whatever its melanin, so the dark brows
painted on the Hi3D bald head (the design's brows) are cut out as a skin patch, moved onto the wrapped template with
the face-landmark warp, lifted 0.6 mm off the skin; UE makes the light parts transparent (masked material).

blender -b -P tools/metahuman/fit_brows.py -- hi3d_head.glb template.fbx out_brows.glb
"""
import json
import math
import os
import subprocess
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

a = sys.argv[sys.argv.index("--") + 1:]
HEAD, TPL, OUT = a[0], a[1], a[2]
FACE_PY = os.environ.get("FACE_PY", "C:/w/tools/face-venv/Scripts/python.exe")
WORK = os.path.splitext(os.path.abspath(OUT))[0] + "_work"
os.makedirs(WORK, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def only(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


bpy.ops.import_scene.fbx(filepath=os.path.abspath(TPL))
tpl = next(o for o in sc.objects if o.type == "MESH")
only(tpl)
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(sc.objects):
    if o is not tpl:
        bpy.data.objects.remove(o, do_unlink=True)
keep_m = {k for k, m in enumerate(tpl.data.materials) if m and ("Head" in m.name or ("Eye" in m.name and "Hide" not in m.name))}
bm = bmesh.new()
bm.from_mesh(tpl.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index not in keep_m], context="FACES")
bm.to_mesh(tpl.data)
bm.free()
TP = np.array([v.co[:] for v in tpl.data.vertices])
crown = TP[:, 2].max()

before = set(sc.objects)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(HEAD))
hs = [o for o in sc.objects if o not in before and o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in hs:
    o.select_set(True)
bpy.context.view_layer.objects.active = hs[0]
if len(hs) > 1:
    bpy.ops.object.join()
hd = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(sc.objects):
    if o not in (tpl, hd):
        bpy.data.objects.remove(o, do_unlink=True)


# place the Hi3D head as wrap_template.py does (crown, forehead width, nose depth)
def slab_width(pts, z, half=0.008):
    s_ = pts[np.abs(pts[:, 2] - z) < half]
    return s_[:, 0].max() - s_[:, 0].min()


def front_y(pts, z, half=0.01):
    s_ = pts[(np.abs(pts[:, 2] - z) < half) & (np.abs(pts[:, 0]) < 0.02)]
    return s_[:, 1].min()


hv = np.array([list(v.co) for v in hd.data.vertices])
htop = hv[:, 2].max()
s = slab_width(TP, crown - 0.05) / slab_width(hv, htop - 0.05)
cx = (hv[:, 0].max() + hv[:, 0].min()) / 2
hv = np.column_stack(((hv[:, 0] - cx) * s, hv[:, 1] * s, (hv[:, 2] - htop) * s + crown))
hv[:, 1] += front_y(TP, crown - 0.11) - front_y(hv, crown - 0.11)
hd.data.vertices.foreach_set("co", hv.ravel())
hd.data.update()

RES, ORTHO = 1024, 0.30
FC = Vector((0.0, -1.0, crown - 0.125))
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.render.resolution_x = sc.render.resolution_y = RES
sc.world = bpy.data.worlds.new("w")
sc.world.color = (0.25, 0.25, 0.27)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = ORTHO
cam.location = FC
cam.rotation_euler = (math.pi / 2, 0, 0)
for o, path, tex in ((tpl, f"{WORK}/tpl.png", False), (hd, f"{WORK}/hd.png", True)):
    tpl.hide_render, hd.hide_render = o is not tpl, o is not hd
    sc.display.shading.color_type = "TEXTURE" if tex else "OBJECT"
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
DETECT = r"""
import json, sys, cv2, mediapipe as mp
out = {}
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.2) as fm:
    for p in sys.argv[2:]:
        r = fm.process(cv2.cvtColor(cv2.imread(p), cv2.COLOR_BGR2RGB))
        out[p] = [[l.x, l.y] for l in r.multi_face_landmarks[0].landmark] if r.multi_face_landmarks else None
json.dump(out, open(sys.argv[1], "w"))
"""
open(f"{WORK}/detect.py", "w").write(DETECT)
subprocess.run([FACE_PY, f"{WORK}/detect.py", f"{WORK}/lm.json", f"{WORK}/tpl.png", f"{WORK}/hd.png"], check=True)
lm = json.load(open(f"{WORK}/lm.json"))
L_t, L_h = lm[f"{WORK}/tpl.png"], lm[f"{WORK}/hd.png"]
dg = bpy.context.evaluated_depsgraph_get()
bvh_t = BVHTree.FromObject(tpl, dg)
bvh_h = BVHTree.FromObject(hd, dg)


def cast(bvh, uv):
    x = FC.x + (uv[0] - 0.5) * ORTHO
    z = FC.z + (0.5 - uv[1]) * ORTHO
    loc, n, _i, _d = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
    return loc, n


src, dst = [], []
for k in range(468):
    ph, nh = cast(bvh_h, L_h[k])
    pt, nt = cast(bvh_t, L_t[k])
    if ph is None or pt is None or -nh.y < 0.35 or -nt.y < 0.35:
        continue
    src.append(list(ph))
    dst.append(list(pt))
src, dst = np.array(src), np.array(dst)
n = len(src)
K = np.linalg.norm(src[:, None] - src[None], axis=2) - np.eye(n) * 0.004
Pm = np.hstack([src, np.ones((n, 1))])
A = np.zeros((n + 4, n + 4))
A[:n, :n], A[:n, n:], A[n:, :n] = K, Pm, Pm.T
coef = np.linalg.solve(A, np.vstack([dst, np.zeros((4, 3))]))

# brow region on the Hi3D head: around mediapipe's brow points (upper + lower brow lines), 1 cm margin
BROW = [70, 63, 105, 66, 107, 46, 53, 52, 65, 55, 336, 296, 334, 293, 300, 276, 283, 282, 295, 285]
bp = np.array([list(cast(bvh_h, L_h[k])[0]) for k in BROW if cast(bvh_h, L_h[k])[0] is not None])
# not below the lower brow line: the lash line/eye shadow painted on the Hi3D head would land on the MetaHuman lids
low_brow = min(cast(bvh_h, L_h[k])[0].z for k in (46, 53, 52, 65, 55, 276, 283, 282, 295, 285) if cast(bvh_h, L_h[k])[0] is not None)
img = next((nd.image for sl in hd.material_slots if sl.material and sl.material.use_nodes
            for nd in sl.material.node_tree.nodes if nd.type == "TEX_IMAGE" and nd.image), None)
tw, th = img.size
px = np.array(img.pixels[:]).reshape(th, tw, 4)
bm = bmesh.new()
bm.from_mesh(hd.data)
uvl = bm.loops.layers.uv.active
kill = []
for f in bm.faces:
    c = np.array(f.calc_center_median())
    if np.min(np.linalg.norm(bp - c, axis=1)) > 0.012 or c[2] < low_brow - 0.004:
        kill.append(f)
bmesh.ops.delete(bm, geom=kill, context="FACES")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bm.to_mesh(hd.data)
bm.free()
V = np.array([v.co[:] for v in hd.data.vertices])
V = np.linalg.norm(V[:, None] - src[None], axis=2) @ coef[:n] + np.hstack([V, np.ones((len(V), 1))]) @ coef[n:]
# onto the template skin, 0.6 mm out
for k in range(len(V)):
    loc, nrm, _i, _d = bvh_t.find_nearest(Vector(V[k]))
    if loc is not None:
        V[k] = np.array(loc + nrm * 0.0006)
hd.data.vertices.foreach_set("co", V.ravel())
hd.data.update()
hd.name = "Brows"
print("BROWS verts", len(V), "landmarks", len(bp))
bpy.data.objects.remove(tpl, do_unlink=True)
bpy.data.objects.remove(cam, do_unlink=True)
only(hd)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", use_selection=True, export_image_format="JPEG")
print("BROWS out", OUT)
