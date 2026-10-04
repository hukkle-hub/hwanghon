"""Wrap the MetaHuman face template onto a Hi3D bald head (docs/design/177, after Na0n / Lost Realm):
the topology stays MetaHuman's, the shape becomes the design face -> UE «Conform: import from template», alignment none.

blender -b -P tools/metahuman/wrap_template.py -- template.fbx hi3d_head.glb out.fbx preview.png
- template.fbx: SKM_Face LOD0 exported from UE (export_template.py), metres, faces -Y
- hi3d_head.glb: tools/3d/prep_head.py output (faces -Y)

1. scale/place the Hi3D head on the template (crown, forehead width, nose depth)
2. render both faces front-on; mediapipe FaceMesh (tools venv C:/w/tools/face-venv) finds the same 468 points on each;
   ray-cast them back onto the meshes -> 3D pairs
3. RBF (r kernel + affine) moves the template so the pairs meet: eyes, nose, lips, jaw land where the design has them
4. short refine: each skin vertex steps onto the Hi3D surface along its normal (<= 6 mm, same facing), gaps smoothed
   (eye rims and the inner lips keep the RBF result: the Hi3D eyes are sculpted bumps, the mouth a closed line)
"""
import json
import math
import os
import subprocess
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

a = sys.argv[sys.argv.index("--") + 1:]
TPL, HEAD, OUT, PREVIEW = a[0], a[1], a[2], a[3] if len(a) > 3 else None
FACE_PY = os.environ.get("FACE_PY", "C:/w/tools/face-venv/Scripts/python.exe")
WORK = os.path.splitext(os.path.abspath(OUT))[0] + "_work"
os.makedirs(WORK, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def only_selected(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


bpy.ops.import_scene.fbx(filepath=os.path.abspath(TPL))
tpl = next(o for o in sc.objects if o.type == "MESH")
only_selected(tpl)
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(sc.objects):
    if o is not tpl:
        bpy.data.objects.remove(o, do_unlink=True)

before = set(sc.objects)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(HEAD))
heads = [o for o in sc.objects if o not in before and o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in heads:
    o.select_set(True)
bpy.context.view_layer.objects.active = heads[0]
if len(heads) > 1:
    bpy.ops.object.join()
hd = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(sc.objects):
    if o not in (tpl, hd):
        bpy.data.objects.remove(o, do_unlink=True)

me = tpl.data
head_mats = {i for i, m in enumerate(me.materials) if m and m.name.startswith("M_GrayTexture_Head")}
head_vs = set()
for p in me.polygons:
    if p.material_index in head_mats:
        head_vs.update(p.vertices)
hlist = sorted(head_vs)
HL = np.array(hlist)
nv = len(me.vertices)
CO = np.zeros(nv * 3)
me.vertices.foreach_get("co", CO)
CO = CO.reshape(-1, 3)
ORIG = CO.copy()
P = CO[HL].copy()
crown = P[:, 2].max()


def slab_width(pts, z, half=0.008):
    s = pts[np.abs(pts[:, 2] - z) < half]
    return s[:, 0].max() - s[:, 0].min()


def front_y(pts, z, half=0.01):
    s = pts[(np.abs(pts[:, 2] - z) < half) & (np.abs(pts[:, 0]) < 0.02)]
    return s[:, 1].min()


# 1) place the Hi3D head: crown on crown, forehead width for scale, nose depth
hv = np.array([list(v.co) for v in hd.data.vertices])
htop = hv[:, 2].max()
s = slab_width(P, crown - 0.05) / slab_width(hv, htop - 0.05)
cx = (hv[:, 0].max() + hv[:, 0].min()) / 2
hv = np.column_stack(((hv[:, 0] - cx) * s, hv[:, 1] * s, (hv[:, 2] - htop) * s + crown))
hv[:, 1] += front_y(P, crown - 0.11) - front_y(hv, crown - 0.11)
hd.data.vertices.foreach_set("co", hv.ravel())
hd.data.update()
print("WRAP placed scale", round(s, 3))

# the template's skin alone, for the render and the ray casts (eyelashes, eye shells, teeth hidden)
skin = tpl.copy()
skin.data = me.copy()
sc.collection.objects.link(skin)
only_selected(skin)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="DESELECT")
bpy.ops.object.mode_set(mode="OBJECT")
cast_mats = head_mats | {i for i, m in enumerate(me.materials) if m and m.name.startswith("M_GrayTexture_Eyes")}
for p in skin.data.polygons:
    p.select = p.material_index not in cast_mats
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.delete(type="FACE")
bpy.ops.object.mode_set(mode="OBJECT")

# 2) front renders -> mediapipe -> 3D pairs
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


def render(obj, path, textured):
    for o in (tpl, hd, skin):
        o.hide_render = o is not obj
    sc.display.shading.color_type = "TEXTURE" if textured else "OBJECT"
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


DETECT = r"""
import json, sys, cv2, mediapipe as mp
out = {}
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.2) as fm:
    for p in sys.argv[2:]:
        im = cv2.imread(p)
        r = fm.process(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
        out[p] = [[l.x, l.y] for l in r.multi_face_landmarks[0].landmark] if r.multi_face_landmarks else None
json.dump(out, open(sys.argv[1], "w"))
"""
render(skin, f"{WORK}/tpl_front.png", False)
render(hd, f"{WORK}/hd_front.png", True)
open(f"{WORK}/detect.py", "w").write(DETECT)
subprocess.run([FACE_PY, f"{WORK}/detect.py", f"{WORK}/lm.json", f"{WORK}/tpl_front.png", f"{WORK}/hd_front.png"], check=True)
lm = json.load(open(f"{WORK}/lm.json"))
L_t, L_h = lm[f"{WORK}/tpl_front.png"], lm[f"{WORK}/hd_front.png"]
assert L_t and L_h, f"mediapipe found no face: template {bool(L_t)} hi3d {bool(L_h)}"

dg = bpy.context.evaluated_depsgraph_get()
bvh_t = BVHTree.FromObject(skin, dg)
bvh_h = BVHTree.FromObject(hd, dg)


def cast(bvh, uv):
    x = FC.x + (uv[0] - 0.5) * ORTHO
    z = FC.z + (0.5 - uv[1]) * ORTHO
    loc, n, _i, _d = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
    return loc, n


INNER_LIPS = {78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191}
# eyelid lines (mediapipe eye contour, outer corner -> inner corner). They are matched densely below against the
# template's own lid edge loop (the way a wrap artist clicks points all along both lids) instead of point by point:
# the grey template render gives poor lid landmarks and the template's upper lids came out higher than the design's.
EYE_UP = {"R": [33, 246, 161, 160, 159, 158, 157, 173, 133], "L": [263, 466, 388, 387, 386, 385, 384, 398, 362]}
EYE_LO = {"R": [33, 7, 163, 144, 145, 153, 154, 155, 133], "L": [263, 249, 390, 373, 374, 380, 381, 382, 362]}
EYE_IDS = set(sum(EYE_UP.values(), []) + sum(EYE_LO.values(), []))
src, dst = [], []
for k in range(468):
    if k in INNER_LIPS or k in EYE_IDS:
        continue
    pt, nt = cast(bvh_t, L_t[k])
    ph, nh = cast(bvh_h, L_h[k])
    # grazing hits (the face outline) give the wrong depth: keep the ones that face the camera
    if pt is None or ph is None or -nt.y < 0.35 or -nh.y < 0.35:
        continue
    src.append(list(pt))
    dst.append(list(ph))
src, dst = np.array(src), np.array(dst)
# depth outliers (a ray that slipped past an edge): compare each gap with the median gap after a similarity fit
g = dst - src
dev = np.linalg.norm(g - np.median(g, axis=0), axis=1)
ok = dev < np.median(dev) + 3.0 * np.median(np.abs(dev - np.median(dev))) + 0.002
print("WRAP dropped outliers", int((~ok).sum()))
src, dst = src[ok], dst[ok]
print("WRAP landmark pairs", len(src), "mean gap mm", round(1000 * np.linalg.norm(dst - src, axis=1).mean(), 1))


def resample(poly, k):
    poly = np.asarray(poly, float)
    seg = np.linalg.norm(np.diff(poly, axis=0), axis=1)
    t = np.concatenate([[0], np.cumsum(seg)])
    u = np.linspace(0, t[-1], k)
    return np.column_stack([np.interp(u, t, poly[:, j]) for j in range(3)])


import bmesh  # noqa: E402

bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index not in head_mats], context="FACES")
bm.verts.ensure_lookup_table()
bnd = {}
for e in bm.edges:
    if e.is_boundary:
        a_, b_ = e.verts[0].index, e.verts[1].index
        bnd.setdefault(a_, []).append(b_)
        bnd.setdefault(b_, []).append(a_)
loops, seen = [], set()
for v0 in bnd:
    if v0 in seen:
        continue
    loop, prev, cur = [v0], None, v0
    seen.add(v0)
    while True:
        nxt = [w for w in bnd[cur] if w != prev and w not in seen]
        if not nxt:
            break
        prev, cur = cur, nxt[0]
        seen.add(cur)
        loop.append(cur)
    loops.append([bm.verts[i].co.copy() for i in loop])
bm.free()
n_lid = 0
for side, sgn in (("R", -1.0), ("L", 1.0)):
    hu = [cast(bvh_h, L_h[k])[0] for k in EYE_UP[side]]
    hl = [cast(bvh_h, L_h[k])[0] for k in EYE_LO[side]]
    if any(p_ is None for p_ in hu + hl):
        print("WRAP lid", side, "missing hits")
        continue
    hc = np.mean([list(p_) for p_ in hu + hl], axis=0)
    # the template's eye loop: the boundary loop whose centre is nearest this eye (image-left = subject right = -x)
    cand = [lp for lp in loops if 20 < len(lp) < 400 and np.sign(np.mean([q.x for q in lp])) == sgn]
    if not cand:
        print("WRAP lid", side, "no loop")
        continue
    lp = min(cand, key=lambda lp_: abs(np.mean([q.z for q in lp_]) - hc[2]) + abs(abs(np.mean([q.x for q in lp_])) - abs(hc[0])))
    P_ = np.array([list(q) for q in lp])
    io = int(np.argmax(np.abs(P_[:, 0])))       # outer corner: farthest from the midline
    ii = int(np.argmin(np.abs(P_[:, 0])))       # inner corner
    m = len(P_)
    c1 = [P_[(io + j) % m] for j in range(((ii - io) % m) + 1)]
    c2 = [P_[(io - j) % m] for j in range(((io - ii) % m) + 1)]
    up_t, lo_t = (c1, c2) if np.mean([q[2] for q in c1]) > np.mean([q[2] for q in c2]) else (c2, c1)
    for tchain, hchain in ((up_t, hu), (lo_t, hl)):
        a12 = resample(tchain, 12)
        b12 = resample([list(p_) for p_ in hchain], 12)
        # depth: the template loop is the inner lid edge, the Hi3D line the lash line on the surface - keep the
        # template's depth and add the local depth change of the face pairs around it
        for a_, b_ in zip(a12, b12):
            near = np.argsort(np.linalg.norm(src - a_, axis=1))[:8]
            b_ = b_.copy()
            b_[1] = a_[1] + np.mean(dst[near, 1] - src[near, 1])
            src = np.vstack([src, a_])
            dst = np.vstack([dst, b_])
            n_lid += 1
print("WRAP lid pairs", n_lid)


def overlay(path, pts, out):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.array(img.pixels[:]).reshape(h, w, 4)
    for u, v in pts:
        x, y = int(u * w), h - 1 - int(v * h)
        px[max(0, y - 2):y + 3, max(0, x - 2):x + 3] = (1, 0.2, 0.1, 1)
    img.pixels = px.ravel()
    img.filepath_raw = out
    img.save()


overlay(f"{WORK}/tpl_front.png", L_t, f"{WORK}/tpl_lm.png")
overlay(f"{WORK}/hd_front.png", L_h, f"{WORK}/hd_lm.png")

# 3) RBF warp: phi(r) = r with an affine part, a little regularisation against noisy points
n = len(src)
K = np.linalg.norm(src[:, None] - src[None], axis=2) - np.eye(n) * 0.004   # phi=r is the -biharmonic kernel: smoothing subtracts
Pm = np.hstack([src, np.ones((n, 1))])
A = np.zeros((n + 4, n + 4))
A[:n, :n], A[:n, n:], A[n:, :n] = K, Pm, Pm.T
coef = np.linalg.solve(A, np.vstack([dst, np.zeros((4, 3))]))


def rbf(X):
    return np.linalg.norm(X[:, None] - src[None], axis=2) @ coef[:n] + np.hstack([X, np.ones((len(X), 1))]) @ coef[n:]


# full weight down to just under the chin, then fading down the neck (the body joins there). The fade used to start
# at crown-21.5 cm - above the chin - so the chin kept MetaHuman's length (lower face +22 % vs the design, measured)
_c, _ = cast(bvh_h, L_h[152])                        # mediapipe 152 = chin bottom, on the Hi3D head (template frame)
chin_z = _c.z if _c is not None else crown - 0.235
z_full, z_zero = chin_z - 0.012, chin_z - 0.06
W = np.clip((P[:, 2] - z_zero) / (z_full - z_zero), 0, 1)
print("WRAP chin z", round(chin_z, 4), "crown-chin cm", round(100 * (crown - chin_z), 1))
P = P + (rbf(P) - P) * W[:, None]
print("WRAP rbf residual mm", round(1000 * np.linalg.norm(rbf(src) - dst, axis=1).mean(), 2))

# 4) short refine along the normals
idx = {v: k for k, v in enumerate(hlist)}
_, GRP = np.unique(np.round(ORIG[HL] * 1e5).astype(np.int64), axis=0, return_inverse=True)
GRP = GRP.ravel()
NG = GRP.max() + 1
print("WRAP seam welds", len(hlist) - NG)


def weld(X):
    acc = np.zeros((NG, X.shape[1]))
    np.add.at(acc, GRP, X)
    cnt = np.bincount(GRP, minlength=NG)[:, None]
    return (acc / cnt)[GRP]


E = [(idx[e.vertices[0]], idx[e.vertices[1]]) for e in me.edges if e.vertices[0] in idx and e.vertices[1] in idx]
# seam twins count as neighbours of each other's neighbours: link each vertex to its group's first member
first = {}
for k, g_ in enumerate(GRP):
    if g_ in first:
        E.append((first[g_], k))
    else:
        first[g_] = k
E = np.array(E)
EA, EB = E[:, 0], E[:, 1]
DEG = np.bincount(np.concatenate([EA, EB]), minlength=len(hlist)).astype(float)


def smooth(X, k):
    for _ in range(k):
        acc = np.zeros_like(X)
        np.add.at(acc, EA, X[EB])
        np.add.at(acc, EB, X[EA])
        X = np.where(DEG[:, None] > 0, acc / np.maximum(DEG, 1)[:, None], X) * 0.5 + X * 0.5
    return X


def normals_of(Pk):
    CO[HL] = Pk
    me.vertices.foreach_set("co", CO.ravel())
    me.update()
    nn = np.zeros(nv * 3)
    me.vertices.foreach_get("normal", nn)
    return nn.reshape(-1, 3)[HL]


def lm3(k):
    pt, _ = cast(bvh_t, L_t[k])
    return np.array(pt) if pt is not None else None


# eye rims and the inner lips stay with the RBF (mediapipe: 33/133 and 362/263 eye corners, 13/14 inner lips)
keep = np.zeros(len(P), bool)
P0 = ORIG[HL]
for a_, b_, r in ((33, 133, 0.62), (362, 263, 0.62), (13, 14, 0.9)):
    pa, pb = lm3(a_), lm3(b_)
    if pa is None or pb is None:
        continue
    c, rad = (pa + pb) / 2, max(0.008, np.linalg.norm(pa - pb) * r)
    keep |= np.linalg.norm(P0 - c, axis=1) < rad
# the whole lip line (corner to corner, mediapipe 61/291): the corners got pulled out through the closed Hi3D mouth (Sera v2)
pa, pb = lm3(61), lm3(291)
if pa is not None and pb is not None:
    ab = pb - pa
    t = np.clip(((P0 - pa) @ ab) / (ab @ ab), -0.08, 1.08)
    d = np.linalg.norm(P0 - (pa + t[:, None] * ab), axis=1)
    lips = d < 0.0065
    keep |= lips
    print("WRAP lip line kept", int(lips.sum()))
ear = (np.abs(P0[:, 0]) > 0.062) & (P0[:, 2] < crown - 0.08) & (P0[:, 2] > crown - 0.19) & (P0[:, 1] > -0.02)
keep |= ear
print("WRAP kept by rbf", int(keep.sum()), "ears", int(ear.sum()))
for sm_n, max_d, steps in ((30, 0.006, 4), (10, 0.004, 4), (2, 0.003, 3)):
    for _ in range(steps):
        N = normals_of(P)
        D = np.zeros_like(P)
        C = np.zeros(len(P))
        for k in range(len(P)):
            if W[k] <= 0 or keep[k]:
                continue
            best = None
            for sgn in (1.0, -1.0):
                hit, hn, _i, d = bvh_h.ray_cast(Vector(P[k]), Vector(N[k] * sgn), max_d)
                if hit is not None and np.dot(N[k], np.array(hn)) > 0.6 and (best is None or d < best[1]):
                    best = (np.array(hit), d)
            if best is not None:
                D[k] = best[0] - P[k]
                C[k] = 1.0
        num, den = smooth(D * C[:, None], sm_n), smooth(C[:, None], sm_n)
        P = weld(P + np.where(den > 1e-4, num / np.maximum(den, 1e-4), 0.0) * W[:, None] * 0.8)
    print("WRAP refine", sm_n, "hits", int(C.sum()), "of", int((W > 0).sum()))

# despike: a vertex whose move differs from its neighbours' by > 1.2 mm (a ray that went through a nostril or a
# lip corner) takes their move instead
for it in range(6):
    Dd = P - ORIG[HL]
    acc = np.zeros_like(Dd)
    np.add.at(acc, EA, Dd[EB])
    np.add.at(acc, EB, Dd[EA])
    Mn = acc / np.maximum(DEG, 1)[:, None]
    spike = (np.linalg.norm(Dd - Mn, axis=1) > 0.0012) & (DEG > 0)
    P = weld(np.where(spike[:, None], ORIG[HL] + Mn, P))
    if it == 0 or not spike.any():
        print("WRAP despike", it, int(spike.sum()))
    if not spike.any():
        break
# lower face length from the design sheet: nose tip -> chin stretched by LOWER_FACE_K (design ratio / Hi3D ratio,
# measured with tools/metahuman measure_face: Ain 0.595/0.527, Sera 0.567/0.498); below the chin the shift fades out
K_LOW = float(os.environ.get("LOWER_FACE_K", "1.0"))
if abs(K_LOW - 1.0) > 1e-3:
    _n, _ = cast(bvh_h, L_h[1])
    nose_z = _n.z
    z = P[:, 2].copy()
    above = z >= chin_z
    newz = np.where(above & (z < nose_z), nose_z - (nose_z - z) * K_LOW, z)
    chin_shift = -(nose_z - chin_z) * (K_LOW - 1.0)
    below = ~above
    fade = np.clip((z - (chin_z - 0.05)) / 0.05, 0, 1)
    newz = np.where(below, z + chin_shift * fade, newz)
    P[:, 2] = newz
    print("WRAP lower face x", K_LOW, "chin moved mm", round(1000 * chin_shift, 1))
# cheekbone width (CHEEK_WIDEN > 1 widens): around the cheekbone height (mediapipe 234/454 on the Hi3D head), only
# the sides of the face (|x| beyond 2.5 cm, full from 5 cm) so the eyes stay put. Ain was 6 % narrow there (pupil-based)
CW = float(os.environ.get("CHEEK_WIDEN", "1.0"))
if abs(CW - 1.0) > 1e-3:
    cz = [cast(bvh_h, L_h[k])[0] for k in (234, 454)]
    cheek_z0 = np.mean([c.z for c in cz if c is not None]) if any(c is not None for c in cz) else crown - 0.12
    wz = np.clip(1 - np.abs(P[:, 2] - cheek_z0) / 0.035, 0, 1)
    wx = np.clip((np.abs(P[:, 0]) - 0.025) / 0.025, 0, 1)
    P[:, 0] *= 1.0 + (CW - 1.0) * wz * wx
    print("WRAP cheek widen", CW, "at z", round(cheek_z0, 4), "verts", int((wz * wx > 0).sum()))
# jaw / chin width from the design sheet (JAW_NARROW, CHIN_NARROW: x scale at the jaw angle and the chin, measured
# with measure_face against the design): full below the mouth corners, fading out up to the cheekbones and down the neck
JN = float(os.environ.get("JAW_NARROW", "1.0"))
CN = float(os.environ.get("CHIN_NARROW", str(JN)))
if abs(JN - 1.0) > 1e-3 or abs(CN - 1.0) > 1e-3:
    mouth_z = np.mean([cast(bvh_h, L_h[k])[0].z for k in (61, 291) if cast(bvh_h, L_h[k])[0] is not None])
    cheek_z = np.mean([cast(bvh_h, L_h[k])[0].z for k in (234, 454) if cast(bvh_h, L_h[k])[0] is not None])         if all(cast(bvh_h, L_h[k])[0] is not None for k in (234, 454)) else mouth_z + 0.035
    z = P[:, 2]
    up = np.clip((cheek_z - z) / max(1e-4, cheek_z - mouth_z), 0, 1)          # 0 at the cheekbones -> 1 at the mouth
    down = np.clip((z - (chin_z - 0.05)) / 0.05, 0, 1)                        # fades out under the chin
    tchin = np.clip((mouth_z - z) / max(1e-4, mouth_z - chin_z), 0, 1)        # 0 at the mouth -> 1 at the chin
    fac = 1.0 - ((1.0 - JN) * (1 - tchin) + (1.0 - CN) * tchin) * up * down
    P[:, 0] *= fac
    print("WRAP jaw narrow", JN, "chin", CN, "min factor", round(float(fac.min()), 3))
# left/right symmetry (SYMMETRIZE=1): each skin vertex and its mirror twin on the (symmetric) archetype share the
# mean of their moves, mirrored - the Hi3D head leaned the jaw 3 % to one side against the design (measured)
if os.environ.get("SYMMETRIZE") == "1":
    kd_m = KDTree(len(hlist))
    for k, i in enumerate(hlist):
        kd_m.insert(Vector(ORIG[i]), k)
    kd_m.balance()
    O = ORIG[HL]
    twin = np.array([kd_m.find(Vector((-o[0], o[1], o[2])))[1] for o in O])
    good = np.linalg.norm(O[twin] * np.array([-1, 1, 1]) - O, axis=1) < 0.0005
    Dm = P - O
    Dt = Dm[twin] * np.array([-1, 1, 1])
    P = np.where(good[:, None], O + (Dm + Dt) / 2, P)
    print("WRAP symmetrized verts", int(good.sum()), "of", len(O))
CO[HL] = P
# eyes, teeth, lashes, lacrimal pieces: follow the nearest skin vertex
kd = KDTree(len(hlist))
for k, i in enumerate(hlist):
    kd.insert(Vector(ORIG[i]), k)
kd.balance()
for i in range(nv):
    if i in idx:
        continue
    _, k, _ = kd.find(Vector(ORIG[i]))
    CO[i] = ORIG[i] + (P[k] - ORIG[hlist[k]])
# the eyeballs move rigidly (their mean move): following the nearest skin bent them where the lids moved
eye_mats = [k for k, m in enumerate(me.materials) if m and m.name.startswith("M_GrayTexture_Eyes")]
eye_ctr = []
for em in eye_mats:
    vs = np.array(sorted({v for p_ in me.polygons if p_.material_index == em for v in p_.vertices}))
    if len(vs):
        mv = (CO[vs] - ORIG[vs]).mean(0)
        CO[vs] = ORIG[vs] + mv
        c_ = CO[vs].mean(0)
        # sclera radius (median), not the cornea tip (max): with the max the lids were pushed back round the cornea
        # bulge and the eyes opened wider (0.381 -> 0.407 of the eye width, measured)
        eye_ctr.append((c_, float(np.median(np.linalg.norm(CO[vs] - c_, axis=1)))))
# upper lids down (UPPER_LID_DROP, mm): the design eyes are half-lidded, the MetaHuman lids sat higher.
# Lid skin above the eye opening moves down, fading over 9 mm up and towards the corners; nothing inside the eyeball
DROP = float(os.environ.get("UPPER_LID_DROP", "0")) / 1000.0         # negative: the upper lids go up (open more)
RAISE = float(os.environ.get("LOWER_LID_RAISE", "0")) / 1000.0     # lower lids up (narrower eyes)
if RAISE != 0 and eye_ctr:
    moved = 0
    for c_, r_ in eye_ctr:
        for k, i in enumerate(hlist):
            q = CO[i]
            dx = abs(q[0] - c_[0])
            dn = c_[2] - q[2]                      # distance below the eye centre
            if dx > r_ * 1.25 or dn < r_ * 0.05 or dn > r_ * 0.3 + 0.008 or q[1] > c_[1] + r_ * 0.2:
                continue
            w = (1 - max(0.0, dn - r_ * 0.3) / 0.008) * max(0.0, 1 - dx / (r_ * 1.25))
            if w <= 0:
                continue
            q = q.copy()
            q[2] += RAISE * w
            v_ = q - c_
            dist = np.linalg.norm(v_)
            if dist < r_ + 0.0003:
                q = c_ + v_ / max(dist, 1e-6) * (r_ + 0.0003)
            CO[i] = q
            moved += 1
    print("WRAP lower lid raise mm", RAISE * 1000, "verts", moved)
if DROP != 0 and eye_ctr:
    moved = 0
    for c_, r_ in eye_ctr:
        for k, i in enumerate(hlist):
            q = CO[i]
            dx = abs(q[0] - c_[0])
            up = q[2] - c_[2]
            if dx > r_ * 1.25 or up < r_ * 0.05 or up > r_ * 0.3 + 0.009 or q[1] > c_[1] + r_ * 0.2:
                continue
            w = (1 - max(0.0, up - r_ * 0.3) / 0.009) * max(0.0, 1 - dx / (r_ * 1.25))
            if w <= 0:
                continue
            q = q.copy()
            q[2] -= DROP * w
            v_ = q - c_
            dist = np.linalg.norm(v_)
            if dist < r_ + 0.0003:                 # keep the lid on the sclera, not through it
                q = c_ + v_ / max(dist, 1e-6) * (r_ + 0.0003)
            CO[i] = q
            moved += 1
    print("WRAP upper lid drop mm", DROP * 1000, "verts", moved)
me.vertices.foreach_set("co", CO.ravel())
me.update()
disp = np.linalg.norm(P - ORIG[HL], axis=1)
print("WRAP disp mm mean", round(1000 * disp.mean(), 1), "max", round(1000 * disp.max(), 1))
bpy.data.objects.remove(skin, do_unlink=True)

if PREVIEW:
    sc.display.shading.color_type = "OBJECT"
    sc.render.resolution_x, sc.render.resolution_y = 1024, 512
    cam.data.ortho_scale = 0.62
    tpl.hide_render = hd.hide_render = False
    for view, loc, rot, off in (("", Vector((0.08, -1.0, crown - 0.13)), (math.pi / 2, 0, 0), Vector((0.17, 0, 0))),
                                ("_side", Vector((1.0, 0.13, crown - 0.13)), (math.pi / 2, 0, math.pi / 2), Vector((0, 0.26, 0)))):
        hd.location = off
        cam.location, cam.rotation_euler = loc, rot
        sc.render.filepath = PREVIEW.replace(".png", view + ".png")
        bpy.ops.render.render(write_still=True)
    hd.location = (0, 0, 0)

bpy.data.objects.remove(hd, do_unlink=True)
only_selected(tpl)
bpy.ops.export_scene.fbx(filepath=os.path.abspath(OUT), use_selection=True, object_types={"MESH"}, apply_unit_scale=True,
                         axis_forward="-Y", axis_up="Z", mesh_smooth_type="FACE")
print("WRAP out", OUT, "verts", nv)
# the chin height for whole_rig.py (its neck fade must start under the chin too) - template frame, metres
_nz = cast(bvh_h, L_h[1])[0]
json.dump({"chin_z": float(chin_z), "nose_z": float(_nz.z) if _nz is not None else None, "crown": float(crown)},
          open(os.path.splitext(os.path.abspath(OUT))[0] + ".json", "w"))
