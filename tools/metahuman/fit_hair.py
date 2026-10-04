"""The design's hair as a mesh (doc 177 §9): cut the hair out of the Hi3D hero (its shape follows the design sheet -
messy bob, bangs) and move it onto the MetaHuman head with the same face-landmark warp the face wrap uses.

blender -b -P tools/metahuman/fit_hair.py -- hero.glb template_face.fbx out_hair.glb preview.png [dark=0.16]
- hero.glb: Hi3D hero (art/3d/heroes/ain.glb), any scale
- template_face.fbx: the wrapped MetaHuman face (wrap_template.py output), metres, faces -Y

1. hero: hair = faces in the head region whose texture is dark (the face skin is light); the scarf/collar below the
   jaw line is cut away; small islands dropped
2. hero and template rendered front-on, mediapipe 468 points on both, ray-cast to 3D -> pairs hero -> template
3. RBF (phi = r + affine) moves the hair vertices
4. any hair vertex inside the template scalp is pushed out along the scalp normal to 2 mm above it
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
HERO, TPL, OUT, PREVIEW = a[0], a[1], a[2], a[3]
DARK = float(a[4]) if len(a) > 4 else 0.16
# MODE light: silver/blond hair - bright, colourless (skin is warm, clothes dark); long hair down to the waist
MODE = os.environ.get("HAIR_MODE", "dark")
FACE_PY = os.environ.get("FACE_PY", "C:/w/tools/face-venv/Scripts/python.exe")
WORK = os.path.splitext(os.path.abspath(OUT))[0] + "_work"
os.makedirs(WORK, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def only(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


# template face (skin + eyes for the ray casts)
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

# hero
before = set(sc.objects)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(HERO))
ms = [o for o in sc.objects if o not in before and o.type == "MESH"]
hero = max(ms, key=lambda o: len(o.data.vertices))
for o in list(sc.objects):
    if o not in (tpl, hero):
        bpy.data.objects.remove(o, do_unlink=True)
only(hero)
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
HV = np.array([v.co[:] for v in hero.data.vertices])
top, bot = HV[:, 2].max(), HV[:, 2].min()
stature = top - bot
# put the hero's head on the template's: crown on crown, head height ~ 0.13 of stature -> template's crown-to-chin
head = HV[HV[:, 2] > top - stature * 0.13]
s = (crown - (crown - 0.235)) / (stature * 0.13)
cx, cy = head[:, 0].mean(), head[:, 1].mean()
HV2 = np.column_stack(((HV[:, 0] - cx) * s, (HV[:, 1] - cy) * s, (HV[:, 2] - top) * s + crown))
hero.data.vertices.foreach_set("co", HV2.ravel())
hero.data.update()
tc = TP[TP[:, 2] > crown - 0.12]
dy = np.percentile(tc[:, 1], 2) - np.percentile(HV2[HV2[:, 2] > crown - 0.12][:, 1], 2)
for v in hero.data.vertices:
    v.co.y += dy
print("HAIR hero scale", round(s, 4), "dy", round(dy, 4))

# texture of the hero for the dark test
img = next((n.image for sl in hero.material_slots if sl.material and sl.material.use_nodes
            for n in sl.material.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
tw, th = img.size
px = np.array(img.pixels[:]).reshape(th, tw, 4)


def rgb(u, v):
    x = min(tw - 1, max(0, int((u % 1.0) * tw)))
    y = min(th - 1, max(0, int((v % 1.0) * th)))
    return px[y, x][:3]


def lum(u, v):
    r, g, b = rgb(u, v)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def is_hair(f, uvl):
    cs = [rgb(*lp[uvl].uv) for lp in f.loops]
    r, g, b = (sum(c[j] for c in cs) / len(cs) for j in range(3))
    L_ = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if MODE == "dark":
        return L_ <= DARK
    if MODE == "dark_crown":      # the parting at the crown is lighter (scalp showing): keep it so no hole shows
        return L_ <= DARK * 2.2
    # silver: bright enough, and not warm like skin (r clearly above b)
    return L_ > 0.22 and (r - b) < 0.035 and (max(r, g, b) - min(r, g, b)) < 0.08


# render both front-on for the landmarks (before the hero is cut down to its hair)
RES, ORTHO = 1024, 0.30
FC = Vector((0.0, -1.0, crown - 0.125))
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.render.resolution_x = sc.render.resolution_y = RES
sc.world = bpy.data.worlds.new("w")
sc.world.color = (0.5, 0.5, 0.52)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = ORTHO
cam.location = FC
cam.rotation_euler = (math.pi / 2, 0, 0)


def render(obj, path, textured):
    for o in (tpl, hero):
        o.hide_render = o is not obj
    sc.display.shading.color_type = "TEXTURE" if textured else "OBJECT"
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


render(tpl, f"{WORK}/tpl.png", False)
render(hero, f"{WORK}/hero.png", True)
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
subprocess.run([FACE_PY, f"{WORK}/detect.py", f"{WORK}/lm.json", f"{WORK}/tpl.png", f"{WORK}/hero.png"], check=True)
lm = json.load(open(f"{WORK}/lm.json"))
L_t, L_h = lm[f"{WORK}/tpl.png"], lm[f"{WORK}/hero.png"]
assert L_t and L_h, f"no face: template {bool(L_t)} hero {bool(L_h)}"
dg = bpy.context.evaluated_depsgraph_get()
bvh_t = BVHTree.FromObject(tpl, dg)
bvh_h = BVHTree.FromObject(hero, dg)


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
g = dst - src
dev = np.linalg.norm(g - np.median(g, axis=0), axis=1)
ok = dev < np.median(dev) + 3.0 * np.median(np.abs(dev - np.median(dev))) + 0.002
src, dst = src[ok], dst[ok]
print("HAIR landmark pairs", len(src), "gap mm", round(1000 * np.linalg.norm(dst - src, axis=1).mean(), 1))
n = len(src)
K = np.linalg.norm(src[:, None] - src[None], axis=2) - np.eye(n) * 0.02     # smoother than the face: hair follows the skull
Pm = np.hstack([src, np.ones((n, 1))])
A = np.zeros((n + 4, n + 4))
A[:n, :n], A[:n, n:], A[n:, :n] = K, Pm, Pm.T
coef = np.linalg.solve(A, np.vstack([dst, np.zeros((4, 3))]))


def rbf(X):
    out = np.zeros_like(X)
    for i in range(0, len(X), 4000):
        Xi = X[i:i + 4000]
        out[i:i + 4000] = np.linalg.norm(Xi[:, None] - src[None], axis=2) @ coef[:n] + np.hstack([Xi, np.ones((len(Xi), 1))]) @ coef[n:]
    return out


# cut the hero down to its hair
mw = hero.matrix_world
chin = crown - 0.235
bm = bmesh.new()
bm.from_mesh(hero.data)
uvl = bm.loops.layers.uv.active
kill = []
for f in bm.faces:
    c = f.calc_center_median()
    lowest = chin - 0.05 if MODE == "dark" else crown - 0.85
    half = 0.16 if MODE == "dark" else 0.27
    if c.z < lowest or abs(c.x) > half or c.y > 0.22 or c.y < -0.16:
        kill.append(f)
        continue
    if not is_hair(f, uvl):
        kill.append(f)
        continue
    # the scarf/collar: dark too and wrapped round the neck - the short hair ends about at the chin (side view)
    if MODE == "dark" and c.z < chin + 0.012:
        kill.append(f)
bmesh.ops.delete(bm, geom=kill, context="FACES")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)    # Hi3D seams are split ~0.1 mm apart: the scalp showed through the crown
bm.verts.ensure_lookup_table()
seen, comps = set(), []
for v0 in bm.verts:
    if v0.index in seen:
        continue
    st, comp = [v0], []
    seen.add(v0.index)
    while st:
        x = st.pop()
        comp.append(x)
        for e in x.link_edges:
            y = e.other_vert(x)
            if y.index not in seen:
                seen.add(y.index)
                st.append(y)
    comps.append(comp)
comps.sort(key=len, reverse=True)
small = [v for c in comps if len(c) < 60 for v in c]
bmesh.ops.delete(bm, geom=small, context="VERTS")
bm.to_mesh(hero.data)
bm.free()
print("HAIR kept verts", len(hero.data.vertices), "pieces", sum(1 for c in comps if len(c) >= 60))

# warp the hair, then keep it off the scalp
HP = np.array([v.co[:] for v in hero.data.vertices])
HP = rbf(HP)
pushed = 0
for k in range(len(HP)):
    q = Vector(HP[k])
    loc, nrm, _i, d = bvh_t.find_nearest(q)
    if loc is None:
        continue
    inside = (q - loc).dot(nrm) < 0.002
    if inside and d < 0.03:
        HP[k] = np.array(loc + nrm * 0.002)
        pushed += 1
hero.data.vertices.foreach_set("co", HP.ravel())
hero.data.update()
print("HAIR pushed out", pushed)

# design hairline (HAIRLINE=a,b: forehead open below z = crown - a - b*|x|, an arch high at the centre parting and
# dropping to the temples). Sera's warped hair covered the forehead with a flat straight edge
if os.environ.get("HAIRLINE"):
    ha, hb = (float(x) for x in os.environ["HAIRLINE"].split(","))
    fy = {}
    bm = bmesh.new()
    bm.from_mesh(hero.data)
    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        if abs(c.x) > 0.065 or c.z > crown - ha - hb * abs(c.x) or c.z < crown - 0.13:
            continue
        loc, nrm, _i, _d = bvh_t.find_nearest(c)
        # only the hair lying on the face front (not the strands hanging further out at the temples)
        if loc is not None and nrm.y < -0.45 and (c - loc).length < 0.012:
            kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(hero.data)
    bm.free()
    print("HAIR hairline cut faces", len(kill))

# preview: template face + hair, front / side / back
sc.display.shading.color_type = "TEXTURE"
tpl.hide_render = hero.hide_render = False
cam.data.ortho_scale = 0.36
sc.render.resolution_x, sc.render.resolution_y = 600, 600
shots = []
for tag, loc, rot in (("f", (0, -1.5, crown - 0.13), (math.pi / 2, 0, 0)), ("s", (1.5, 0, crown - 0.13), (math.pi / 2, 0, math.pi / 2)),
                      ("b", (0, 1.5, crown - 0.13), (math.pi / 2, 0, math.pi))):
    cam.location, cam.rotation_euler = Vector(loc), rot
    p = PREVIEW.replace(".png", f"_{tag}.png")
    sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    shots.append(p)

bpy.data.objects.remove(tpl, do_unlink=True)
bpy.data.objects.remove(cam, do_unlink=True)
only(hero)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", use_selection=True, export_image_format="JPEG")
print("HAIR out", OUT, "verts", len(hero.data.vertices))
