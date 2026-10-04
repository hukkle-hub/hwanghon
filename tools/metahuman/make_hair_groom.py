"""Strand hair (groom) from the design hair shape (doc 177 §23): the cards came out as twisted shards, so the same
surface-traced strands become real hair curves -> Alembic -> UE groom, rendered like the MetaHuman grooms.

blender -b -P tools/metahuman/make_hair_groom.py -- hair_placed.fbx out.abc [preview.png|-] [head_state.fbx]
head_state.fbx: the built character (place_on_state.py's state); the design hair shell floats ~7 cm over the crown,
so the guides are pulled onto the scalp near the roots (GROOM_HUG "0.007,0.03": max gap at the crown, at the shoulders)
and part in the middle (roots traced towards the centre line, not one crown point)
env: GROOM_GUIDES (600), GROOM_CHILD (28 hairs per guide), GROOM_STEP (0.01 m), GROOM_SPREAD (0.006 m),
     GROOM_LIFT (0.004 m, max distance off the shell)
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

a = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = a[0], a[1]
PREVIEW = a[2] if len(a) > 2 and a[2] != "-" else None
HEAD = a[3] if len(a) > 3 else None
NG = int(os.environ.get("GROOM_GUIDES", "900"))
NC = int(os.environ.get("GROOM_CHILD", "40"))
STEP = float(os.environ.get("GROOM_STEP", "0.02"))
SPREAD = float(os.environ.get("GROOM_SPREAD", "0.006"))
LIFT = float(os.environ.get("GROOM_LIFT", "0.004"))
CLUMP = float(os.environ.get("GROOM_CLUMP", "0"))
rng = np.random.default_rng(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.fbx(filepath=os.path.abspath(SRC))
for o in sc.objects:
    if o.type == "MESH":
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
meshes = [o for o in sc.objects if o.type == "MESH"]
shell = max((o for o in meshes if "cap" not in o.name.lower()), key=lambda o: len(o.data.vertices))
if max(v.co.z for v in shell.data.vertices) > 10:
    shell.data.transform(Matrix.Scale(0.01, 4))
for o in meshes:
    if o is not shell:
        bpy.data.objects.remove(o, do_unlink=True)
bvh = BVHTree.FromObject(shell, bpy.context.evaluated_depsgraph_get())
V = np.array([v.co[:] for v in shell.data.vertices])
crown = V[:, 2].max()
cx, cy = (V[:, 0].max() + V[:, 0].min()) / 2, (V[:, 1].max() + V[:, 1].min()) / 2

bm = bmesh.new()
bm.from_mesh(shell.data)
bmesh.ops.triangulate(bm, faces=bm.faces)
tris = [[v.co.copy() for v in f.verts] for f in bm.faces]
bm.free()
areas = np.array([((t[1] - t[0]).cross(t[2] - t[0])).length / 2 for t in tris])


def snap(p):
    loc, nrm, _i, d = bvh.find_nearest(p)
    return loc, nrm, d


def trace(p0, sign):
    pts, p, prev = [p0.copy()], p0.copy(), None
    for _ in range(int(1.4 / STEP)):
        loc, nrm, d = snap(p)
        if loc is None or d > 0.02:
            break
        g = Vector((0, 0, sign)) if sign < 0 else (Vector((cx, p.y, crown)) - p).normalized()   # centre part
        t = g - nrm * g.dot(nrm)
        if t.length < 1e-4:
            break
        t.normalize()
        if prev is not None:
            t = (t + prev * 0.8).normalized()
        q, _n, _d = snap(p + t * STEP)
        if q is None or (q - p).length < STEP * 0.25:
            break
        if sign < 0 and q.z > p.z - STEP * 0.1:
            break
        pts.append(q)
        if sign > 0 and q.z >= crown - 0.004:
            break
        prev = (q - p).normalized()
        p = q
    return pts


# guides: seeds on the outer side, traced to the crown and to the tip
guides = []
for i in rng.choice(len(tris), size=NG * 4, p=areas / areas.sum()):
    t = tris[i]
    r1, r2 = rng.random(), rng.random()
    if r1 + r2 > 1:
        r1, r2 = 1 - r1, 1 - r2
    p = t[0] + (t[1] - t[0]) * r1 + (t[2] - t[0]) * r2
    _l, nrm, _d = snap(p)
    out = Vector((p.x - cx, p.y - cy, max(0.0, p.z - (crown - 0.10)) * 0.5)).normalized()
    if nrm is None or nrm.dot(out) < 0.1:
        continue
    pts = list(reversed(trace(p, +1)[1:])) + trace(p, -1)
    if len(pts) >= 4:
        # smooth the guide a little (the shell is lumpy)
        P = np.array([list(q) for q in pts])
        for _ in range(int(os.environ.get('GROOM_SMOOTH', '10'))):   # sleek straight hair (3 left kinks)
            P[1:-1] = P[1:-1] * 0.5 + (P[:-2] + P[2:]) * 0.25
        guides.append(P)
    if len(guides) >= NG:
        break
if HEAD:
    before = set(sc.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(HEAD))
    hm = [o for o in sc.objects if o not in before and o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in hm:
        o.select_set(True)
    bpy.context.view_layer.objects.active = hm[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(hm) > 1:
        bpy.ops.object.join()
    hobj = bpy.context.view_layer.objects.active
    if max(v.co.z for v in hobj.data.vertices) > 10:
        hobj.data.transform(Matrix.Scale(0.01, 4))
    hbvh = BVHTree.FromObject(hobj, bpy.context.evaluated_depsgraph_get())
    htop = max(v.co.z for v in hobj.data.vertices)
    h0, h1 = (float(x) for x in os.environ.get("GROOM_HUG", "0.007,0.03").split(","))
    pulled = 0
    for G in guides:
        for k in range(len(G)):
            p = Vector(G[k])
            f = np.clip((htop - p.z) / 0.30, 0, 1)           # 0 at the crown, 1 at about the shoulders
            if f >= 1:
                continue
            cap_ = h0 + (h1 - h0) * f
            loc, nrm, _i, d = hbvh.find_nearest(p)
            if loc is None:
                continue
            out_ = (p - loc)
            if out_.length > cap_:
                G[k] = np.array(loc + out_.normalized() * cap_)
                pulled += 1
        for _ in range(4):
            G[1:-1] = G[1:-1] * 0.5 + (G[:-2] + G[2:]) * 0.25
    print("GROOM pulled onto the scalp", pulled, "points; head top", round(htop, 3))
    # scalp roots: the shell has no hair over the front/top of the scalp (a bald band at the part) -> roots on the
    # whole scalp, each following the nearest guide from its nearest point (offset fading out over 8 cm)
    HV = np.array([v.co[:] for v in hobj.data.vertices])
    yc = (HV[:, 1].max() + HV[:, 1].min()) / 2
    front_hl, back_hl = (float(x) for x in os.environ.get("GROOM_HAIRLINE", "0.075,0.17").split(","))
    # hairline rounded up at the centre (GROOM_HAIRLINE_CENTER, m below the top) -> a clean centre part, no tuft
    hxc = (HV[:, 0].max() + HV[:, 0].min()) / 2
    fc = float(os.environ.get("GROOM_HAIRLINE_CENTER", str(front_hl)))
    fl = front_hl - (front_hl - fc) * np.clip(1 - np.abs(HV[:, 0] - hxc) / 0.045, 0, 1)
    sc_ = (HV[:, 2] > htop - fl) | ((HV[:, 1] > yc + 0.01) & (HV[:, 2] > htop - back_hl))
    SV = HV[sc_]
    print("GROOM scalp verts", len(SV))
    from mathutils.kdtree import KDTree
    gp = [(gi, k) for gi, G in enumerate(guides) for k in range(len(G)) if G[k][2] > htop - 0.25]
    kd = KDTree(len(gp))
    for j, (gi, k) in enumerate(gp):
        kd.insert(Vector(guides[gi][k]), j)
    kd.balance()
    NR = int(os.environ.get("GROOM_ROOTS", "20000"))
    root_strands, root_gid = [], []
    # more roots at the front of the scalp (the part / hairline is what the camera sees)
    fw = np.where((SV[:, 1] < yc) & (SV[:, 2] > htop - front_hl), float(os.environ.get("GROOM_FRONT_W", "1")), 1.0)
    for r in SV[rng.choice(len(SV), size=NR, p=fw / fw.sum())] + rng.normal(0, 0.003, (NR, 3)):
        loc, nrm, _i, _d = hbvh.find_nearest(Vector(r))
        if loc is None:
            continue
        r = np.array(loc + nrm * 0.001)
        _c, j, _dd = kd.find(Vector(r))
        gi, k = gp[j]
        tail = guides[gi][k:]
        if len(tail) < 3:
            continue
        arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(tail, axis=0), axis=1))])
        fade = np.clip(1 - arc / 0.08, 0, 1)[:, None]
        S = tail + (r - tail[0]) * fade
        S = S.copy()
        # the blend is a chord through the skull (front roots joining side guides) -> push points back out of the head
        for k2 in range(1, len(S)):
            if S[k2][2] < htop - 0.32:
                break
            l2, n2, _i2, _d2 = hbvh.find_nearest(Vector(S[k2]))
            if l2 is None:
                continue
            v2 = Vector(S[k2]) - l2
            if v2.dot(n2) < 0.0015:
                S[k2] = np.array(l2 + n2 * (0.0015 + 0.004 * min(1.0, arc[k2] / 0.15)))
        keep = int(len(S) * (0.8 + 0.2 * rng.random()))
        root_strands.append(S[:max(3, keep)] + rng.normal(0, float(os.environ.get('GROOM_WOB', '0.0005')) * 0.8, 3))
        root_gid.append(gi)
    print("GROOM scalp strands", len(root_strands))
    bpy.data.objects.remove(hobj, do_unlink=True)
print("GROOM guides", len(guides), "mean pts", round(np.mean([len(g) for g in guides]), 1))

# children: offsets in the guide's local frame, kept for the whole length (clumps), lifted off the shell,
# tips trimmed at random so the ends are not one straight line
strands, sgid = [], []
for gi_, G in enumerate(guides):
    n = len(G)
    T = np.gradient(G, axis=0)
    T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-9)
    N_ = np.array([list(snap(Vector(q))[1] or Vector((0, 0, 1))) for q in G])
    B = np.cross(T, N_)
    B /= np.maximum(np.linalg.norm(B, axis=1, keepdims=True), 1e-9)
    for _ in range(NC):
        ob, on = rng.normal(0, SPREAD), abs(rng.normal(0, LIFT))
        keep = int(n * (0.75 + 0.25 * rng.random()))
        wob = rng.normal(0, float(os.environ.get('GROOM_WOB', '0.0005')), 3)
        tt = np.linspace(0, 1, n)[:keep, None]
        cl = 1 - CLUMP * tt ** 0.8                              # clumping: the strands of a clump meet at its tip
        S = G[:keep] + (B[:keep] * ob + N_[:keep] * on) * cl + wob
        if len(S) >= 3:
            strands.append(S)
            sgid.append(gi_)
if HEAD:
    strands += root_strands
    sgid += root_gid
# forehead: the design hair leaves a broad forehead; strands in front of it (between the hairline and the brows) are
# pushed sideways to the brow ends (GROOM_FOREHEAD_X, half width in m)
FX = float(os.environ.get("GROOM_FOREHEAD_X", "0"))
if FX > 0 and HEAD:
    hx = (HV[:, 0].max() + HV[:, 0].min()) / 2
    moved = 0
    for i_, S in enumerate(strands):
        z_ = S[:, 2]
        zone = (S[:, 1] < yc - 0.03) & (z_ < htop - float(os.environ.get('GROOM_FOREHEAD_TOP', '0.06'))) & (z_ > htop - 0.16)
        if not zone.any():
            continue
        dx = S[:, 0] - hx
        need = zone & (np.abs(dx) < FX)
        if need.any():
            sg = np.sign(dx[need]) + (dx[need] == 0)
            S = S.copy()
            S[need, 0] = hx + sg * (FX + rng.random(need.sum()) * 0.004)
            for _ in range(3):
                S[1:-1, 0] = S[1:-1, 0] * 0.5 + (S[:-2, 0] + S[2:, 0]) * 0.25
            strands[i_] = S
            moved += 1
    print("GROOM forehead cleared", moved, "strands")
    # strands that still cross the forehead after the push (long arcs from the far side) are dropped
    if os.environ.get("GROOM_FOREHEAD_DROP", "0") == "1":
        keep_ = []
        for S in strands:
            z_ = S[:, 2]
            zone = (S[:, 1] < yc - 0.03) & (z_ < htop - float(os.environ.get('GROOM_FOREHEAD_TOP', '0.06')) - 0.01) & (z_ > htop - 0.15)
            hit = np.nonzero(zone & (np.abs(S[:, 0] - hx) < FX - 0.008))[0]
            if len(hit):
                # cut at the forehead (whole strands dropped left the crown front bare)
                if hit[0] >= 4:
                    keep_.append(S[:hit[0]])
                continue
            keep_.append(S)
        print("GROOM forehead crossing strands cut", len(strands) - sum(1 for x in keep_ if True))
        strands = keep_
# messy (Ain): each guide's clump flicks its tips its own way, strands in it spread, layered lengths, a few flyaways
MESSY = float(os.environ.get("GROOM_MESSY", "0"))
if MESSY > 0:
    cvec = rng.normal(0, 1, (len(guides), 3))
    cvec /= np.linalg.norm(cvec, axis=1, keepdims=True)
    out = []
    for S, gi_ in zip(strands, sgid):
        n_ = len(S)
        if n_ < 4:
            out.append(S)
            continue
        arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(S, axis=0), axis=1))])
        t = (arc / max(arc[-1], 1e-6))[:, None]
        sv = rng.normal(0, 1, 3)
        d_ = cvec[gi_] * float(os.environ.get('GROOM_MESSY_CLUMP', '0.018')) + sv * float(os.environ.get('GROOM_MESSY_STRAND', '0.006'))
        if rng.random() < float(os.environ.get("GROOM_FLYAWAY", "0.06")):   # flyaway
            d_ = d_ + sv / np.linalg.norm(sv) * 0.03
        S = S + d_ * MESSY * t ** 1.6
        WAV = float(os.environ.get("GROOM_WAVE", "0"))
        if WAV > 0:          # wavy, separated strands (the design's wild bob): kinks per clump, growing to the tip
            pv = np.cross(np.gradient(S, axis=0), cvec[gi_])
            pv /= np.maximum(np.linalg.norm(pv, axis=1, keepdims=True), 1e-9)
            per = float(os.environ.get("GROOM_WAVE_PERIOD", "0.05"))
            S = S + pv * (WAV * np.sin(arc / per * 2 * np.pi + gi_ * 1.7))[:, None] * (0.3 + 0.7 * t)
        keep = int(n_ * (1 - MESSY * 0.45 * rng.random()))
        out.append(S[:max(4, keep)])
    strands = out
    print("GROOM messy", MESSY)
# flick (Ain): tips bend outward from the head axis and a little up (GROOM_FLICK m at the tip)
FLICK = float(os.environ.get("GROOM_FLICK", "0"))
if FLICK > 0 and HEAD:
    hx = (HV[:, 0].max() + HV[:, 0].min()) / 2
    out = []
    for S in strands:
        if len(S) < 4:
            out.append(S)
            continue
        arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(S, axis=0), axis=1))])
        t = (arc / max(arc[-1], 1e-6))[:, None]
        r = np.column_stack([S[:, 0] - hx, S[:, 1] - yc, np.zeros(len(S))])
        r /= np.maximum(np.linalg.norm(r, axis=1, keepdims=True), 1e-6)
        k_ = FLICK * (0.5 + rng.random())
        out.append(S + (r + np.array([0, 0, 0.35])) * k_ * t ** 2.5)
    strands = out
    print("GROOM flick", FLICK)
if os.environ.get("GROOM_DUMP"):
    np.savez(os.environ["GROOM_DUMP"], roots=np.array([x[0] for x in strands]), n_guide_children=len(strands) - (len(root_strands) if HEAD else 0),
             head=SV if HEAD else np.zeros((0, 3)), pts=np.concatenate(strands[::20]), hv=HV if HEAD else np.zeros((0, 3)))
print("GROOM strands", len(strands), "points", sum(len(s) for s in strands))

# a Curves object (Blender hair) -> Alembic
cu = bpy.data.hair_curves.new("SeraGroom")
cu.add_curves([len(s) for s in strands])
flat = np.concatenate(strands).astype(np.float32)
cu.attributes["position"].data.foreach_set("vector", flat.ravel())
# poly curves: Blender's default Catmull-Rom curves reach UE as knotted splines and the Alembic hair translator
# reads the knots wrong (ensure "GlobalKnotIndex + CurveNumKnots <= NumKnots", strands drawn as wide sheets)
ct = cu.attributes.get("curve_type") or cu.attributes.new("curve_type", "INT8", "CURVE")
ct.data.foreach_set("value", np.full(len(strands), 1, np.int8))
# widths: without them UE draws every strand at its default width (sheets); root 0.09 mm -> tip 0.03 mm
RAD = float(os.environ.get("GROOM_RADIUS", "0.000045"))
rad = np.concatenate([RAD * (1.0 - 0.65 * np.linspace(0, 1, len(s_))) for s_ in strands]).astype(np.float32)
ra = cu.attributes.get("radius") or cu.attributes.new("radius", "FLOAT", "POINT")
ra.data.foreach_set("value", rad)
ob = bpy.data.objects.new("Groom", cu)
sc.collection.objects.link(ob)
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
if PREVIEW:
    shell.hide_render = True
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 800, 800
    cam = bpy.data.objects.new("c", bpy.data.cameras.new("c"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    lo = float(flat[:, 2].min())
    cam.data.ortho_scale = (crown - lo) * 1.2
    cam.location = Vector((cx, cy + 2, (crown + lo) / 2))
    cam.rotation_euler = (math.pi / 2, 0, math.pi)
    sc.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.alembic_export(filepath=os.path.abspath(OUT), selected=True, start=1, end=1)
print("GROOM out", OUT, "z", round(float(flat[:, 2].min()), 3), round(float(flat[:, 2].max()), 3))
