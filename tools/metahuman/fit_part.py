"""One equipment part (its own Hi3D model) onto the MetaHuman hero (doc 182): the part is scaled and placed on the body
part it belongs to, pushed out of the skin, skinned to the nearby bones and written as a skeletal-mesh FBX that the
UE build attaches like the outfit (lab_build.py MH_PARTS).

blender -b -P tools/metahuman/fit_part.py -- part.glb mh_body.fbx head_state.fbx out.fbx preview.png
env: PART_KIND (scarf), PART_GAP (0.004 m off the skin), PART_ROT ("x,y,z" degrees, extra rotation of the part),
     PART_INNER (inner radius over the neck radius, 1.0), PART_TOP (m below the chin: the part's top, 0.0)
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

a = sys.argv[sys.argv.index("--") + 1:]
PART, MHB, HEAD, OUT, PREV = a[:5]
KIND = os.environ.get("PART_KIND", "scarf")
GAP = float(os.environ.get("PART_GAP", "0.004"))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
vl = bpy.context.view_layer

bpy.ops.import_scene.fbx(filepath=os.path.abspath(MHB))
arm = next(o for o in sc.objects if o.type == "ARMATURE")
body = next(o for o in sc.objects if o.type == "MESH")
vl.update()
AW = arm.matrix_world.copy()
print("PART arm", arm.name, "scale", [round(x, 4) for x in AW.to_scale()], "neck_01", [round(x, 3) for x in (AW @ arm.pose.bones["neck_01"].head)])
AWi = AW.inverted()


def bhead(n):
    return AW @ arm.pose.bones[n].head


# skin surfaces: body + head (world, m)
def world_mesh(o):
    me = o.data.copy()
    me.transform(o.matrix_world)
    return me


before = set(sc.objects)
_ul = sc.unit_settings.scale_length
bpy.ops.import_scene.fbx(filepath=os.path.abspath(HEAD))
print("PART unit scale before/after head import", _ul, sc.unit_settings.scale_length, "arm scale", [round(x, 4) for x in arm.matrix_world.to_scale()])
hobj = max((o for o in sc.objects if o not in before and o.type == "MESH"), key=lambda o: len(o.data.vertices))
vl.update()
hme = world_mesh(hobj)
if max(v.co.z for v in hme.vertices) > 10:
    hme.transform(Matrix.Scale(0.01, 4))
bme = world_mesh(body)
skinV = [v.co.copy() for v in bme.vertices] + [v.co.copy() for v in hme.vertices]
off = len(bme.vertices)
skinF = [list(p.vertices) for p in bme.polygons] + [[i + off for i in p.vertices] for p in hme.polygons]
bvh_s = BVHTree.FromPolygons(skinV, skinF)
for o in [o for o in sc.objects if o not in (arm, body)]:
    bpy.data.objects.remove(o, do_unlink=True)

# the part
before = set(sc.objects)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(PART))
ms = [o for o in sc.objects if o not in before and o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in ms:
    o.select_set(True)
vl.objects.active = ms[0]
if len(ms) > 1:
    bpy.ops.object.join()
part = vl.objects.active
for o in [o for o in sc.objects if o not in (arm, body, part)]:
    bpy.data.objects.remove(o, do_unlink=True)
part.data.transform(part.matrix_world)
part.parent = None
part.matrix_world = Matrix.Identity(4)
rx, ry, rz = (float(x) for x in os.environ.get("PART_ROT", "0,0,0").split(","))
if rx or ry or rz:
    part.data.transform(Euler((math.radians(rx), math.radians(ry), math.radians(rz))).to_matrix().to_4x4())
nf = len(part.data.polygons)
MAXF = int(os.environ.get("PART_MAX_FACES", "60000"))
if nf > MAXF:
    dm = part.modifiers.new("dec", "DECIMATE")
    dm.ratio = MAXF / nf
    vl.objects.active = part
    bpy.ops.object.modifier_apply(modifier="dec")
P = np.array([v.co[:] for v in part.data.vertices])
arm.matrix_world = AW.copy()      # the glTF import reset the armature object scale (0.01 -> 1)
vl.update()
print("PART chk after gltf", [round(x, 4) for x in arm.matrix_world.to_scale()])
print("PART verts", len(P), "faces", nf, "->", len(part.data.polygons), "bounds", P.min(0).round(3), P.max(0).round(3))

if KIND == "scarf":
    # neck: centre line and radius from the head/body skin at mid-neck
    n1, n2 = bhead("neck_01"), bhead("neck_02")
    hv = np.array([v.co[:] for v in hme.vertices])
    zmid = (n1.z + n2.z) / 2
    ring = hv[np.abs(hv[:, 2] - zmid) < 0.008]
    ring = ring[np.linalg.norm(ring[:, :2] - np.array([n1.x, n1.y]), axis=1) < 0.12]
    nc = ring[:, :2].mean(0)
    nr = float(np.median(np.linalg.norm(ring[:, :2] - nc, axis=1)))
    # part: hole axis vertical (Hi3D gives Y-up -> Z-up already); inner radius at its middle height
    pc = P[:, :2].mean(0)
    pz0, pz1 = P[:, 2].min(), P[:, 2].max()
    mid = P[np.abs(P[:, 2] - (pz0 + pz1) / 2) < (pz1 - pz0) * 0.15]
    rr = np.linalg.norm(mid[:, :2] - pc, axis=1)
    inner = float(np.percentile(rr, 5))
    s = (nr * float(os.environ.get("PART_INNER", "1.0")) + GAP) / max(inner, 1e-4)
    top_target = n2.z + 0.02 - float(os.environ.get("PART_TOP", "0.0"))
    P = (P - np.array([pc[0], pc[1], pz1])) * s + np.array([nc[0], nc[1], top_target])
    print("PART scarf neck r", round(nr, 4), "part inner", round(inner, 4), "scale", round(s, 3), "top z", round(top_target, 3), "height", round((pz1 - pz0) * s, 3))
if KIND == "belt":
    # a closed loop around the hips: horizontal ring axis -> z; the inner opening scaled to the hip section at belt
    # height (+ gap, PART_INNER), tilted forward-down PART_TILT degrees (belts sit lower at the front)
    ext = P.max(0) - P.min(0)
    ax_i = int(np.argmin(ext))                         # the ring's thin axis = its axis
    order = [i for i in range(3) if i != ax_i] + [ax_i]
    P = P[:, order]
    P -= (P.max(0) + P.min(0)) / 2
    belt_z = (bhead("pelvis").z + bhead("spine_01").z) / 2 - float(os.environ.get("PART_DROP", "0.03"))
    BV = np.array([v.co[:] for v in bme.vertices])
    ring = BV[(np.abs(BV[:, 2] - belt_z) < 0.01) & (np.abs(BV[:, 0]) < 0.25) & (np.abs(BV[:, 1]) < 0.2)]
    cxy = ring[:, :2].mean(0)
    hx = float(np.percentile(np.abs(ring[:, 0] - cxy[0]), 98))
    hy = float(np.percentile(np.abs(ring[:, 1] - cxy[1]), 98))
    # the loop's own half-widths (thin straps: the outer extent is the ring radius); 0.06 from inner percentiles
    # picked up the crossing straps and blew the belt up 3x
    ix = float(np.percentile(np.abs(P[:, 0]), 97)) * 0.96
    iy = float(np.percentile(np.abs(P[:, 1]), 97)) * 0.96
    kin = float(os.environ.get("PART_INNER", "1.0"))
    P[:, 0] *= (hx * kin + GAP) / max(ix, 1e-4)
    P[:, 1] *= (hy * kin + GAP) / max(iy, 1e-4)
    P[:, 2] *= (hx * kin + GAP) / max(ix, 1e-4)
    # buckle to the front (-Y): the buckle is the bulkiest part of the ring
    ang = np.arctan2(P[:, 1], P[:, 0])
    rr = np.hypot(P[:, 0], P[:, 1])
    hist = [float(np.percentile(rr[(ang >= a0) & (ang < a0 + 0.5)], 95)) if ((ang >= a0) & (ang < a0 + 0.5)).any() else 0 for a0 in np.arange(-math.pi, math.pi, 0.5)]
    a_b = -math.pi + 0.5 * int(np.argmax(hist)) + 0.25
    rot = -math.pi / 2 - a_b
    ca, sa = math.cos(rot), math.sin(rot)
    P[:, :2] = P[:, :2] @ np.array([[ca, sa], [-sa, ca]])
    tl = math.radians(float(os.environ.get("PART_TILT", "8")))
    cy_, sy_ = math.cos(tl), math.sin(tl)
    P[:, 1], P[:, 2] = P[:, 1] * cy_ - P[:, 2] * sy_, P[:, 1] * sy_ + P[:, 2] * cy_
    P += np.array([cxy[0], cxy[1], belt_z])
    print("PART belt hip half", round(hx, 3), round(hy, 3), "inner", round(ix, 3), round(iy, 3), "buckle angle", round(math.degrees(a_b)))
if KIND == "hip":
    # a pouch / vial holder on the left-front hip: its width -> PART_W (m), its back (concave side, +Y after the
    # turn) against the hip skin at belt height (between pelvis and spine_01), turned to face out of the hip
    W_ = float(os.environ.get("PART_W", "0.16"))
    ext = P.max(0) - P.min(0)
    if ext[1] > ext[0]:                                  # make X the long horizontal axis
        P = P[:, [1, 0, 2]] * np.array([1, -1, 1])
        ext = P.max(0) - P.min(0)
    s = W_ / ext[0]
    P = (P - (P.max(0) + P.min(0)) / 2) * s
    # concave side to the body: the panel curves around a hip; find the side where the middle sits back
    mid = P[np.abs(P[:, 0]) < W_ * 0.15]
    ends = P[np.abs(P[:, 0]) > W_ * 0.35]
    if mid[:, 1].mean() > ends[:, 1].mean():             # middle further +Y than the ends -> convex to +Y: flip
        P[:, 1] *= -1
    belt_z = (bhead("pelvis").z + bhead("spine_01").z) / 2 + float(os.environ.get("PART_DZ", "0.0"))
    ang = math.radians(float(os.environ.get("PART_ANG", "35")))        # around the body from the front, to the left
    BV = np.array([v.co[:] for v in bme.vertices])
    ring = BV[(np.abs(BV[:, 2] - belt_z) < 0.01) & (np.abs(BV[:, 0]) < 0.22) & (np.abs(BV[:, 1]) < 0.2)]
    cxy = ring[:, :2].mean(0)
    d2 = np.array([math.sin(ang), -math.cos(ang)])     # outward direction at that angle (front = -Y)
    proj = (ring[:, :2] - cxy) @ d2
    r_ = float(np.percentile(proj, 98))
    # turn the part so its +Y (back) faces the body centre, i.e. its -Y faces d2
    rot = math.atan2(d2[0], -d2[1])
    ca, sa = math.cos(rot), math.sin(rot)
    P[:, :2] = P[:, :2] @ np.array([[ca, sa], [-sa, ca]])
    back = P[:, :2] @ (-d2)
    P[:, :2] += cxy + d2 * (r_ + GAP - back.min() * 0 + (P[:, :2] @ d2).max() * 0)
    # push the whole piece out so its back touches the skin
    off_ = (r_ + GAP) - (P[:, :2] - cxy) @ d2
    P[:, :2] += d2 * max(0.0, float(np.percentile(off_, 95)))
    P[:, 2] += belt_z - float(os.environ.get("PART_DROP", "0.06"))
    print("PART hip width", round(W_, 3), "scale", round(s, 3), "belt z", round(belt_z, 3), "angle", round(math.degrees(ang)), "hip r", round(r_, 3))
if KIND == "bracer":
    # a tube along each forearm: long axis = the part's tallest axis; wide end to the elbow; length = PART_LEN of the
    # forearm ending PART_WRIST m before the hand; inner radius = forearm radius + gap; right one mirrored
    ext = P.max(0) - P.min(0)
    ax_i = int(np.argmax(ext))
    order = [i for i in range(3) if i != ax_i] + [ax_i]
    P = P[:, order]                                       # long axis -> z
    zr = P[:, 2].max() - P[:, 2].min()
    top = P[P[:, 2] > P[:, 2].max() - zr * 0.15]
    bot = P[P[:, 2] < P[:, 2].min() + zr * 0.15]
    def rad(Q):
        c = Q[:, :2].mean(0)
        return float(np.percentile(np.linalg.norm(Q[:, :2] - c, axis=1), 50))
    if rad(bot) > rad(top):                               # wide (elbow) end to +z
        P[:, 2] *= -1
        P[:, 1] *= -1
    pc = P[:, :2].mean(0)
    P[:, :2] -= pc
    P[:, 2] -= P[:, 2].min()                              # wrist end at 0, elbow end at zr
    BV = np.array([v.co[:] for v in bme.vertices])
    halves = []
    for side in ("l", "r"):
        el = np.array(bhead(f"lowerarm_{side}"))
        wr = np.array(bhead(f"hand_{side}"))
        axv = el - wr
        L_ = np.linalg.norm(axv)
        axv /= L_
        wr_end = float(os.environ.get("PART_WRIST", "0.015"))
        length = L_ * float(os.environ.get("PART_LEN", "0.62"))
        # forearm radius around the axis, over the covered span
        rel = BV - wr
        tt = rel @ axv
        dd = np.linalg.norm(rel - np.outer(tt, axv), axis=1)
        m = (tt > wr_end) & (tt < wr_end + length) & (dd < 0.08)
        fr = float(np.percentile(dd[m], 90)) if m.any() else 0.035
        mid = P[(P[:, 2] > zr * 0.4) & (P[:, 2] < zr * 0.6)]
        inner = float(np.percentile(np.linalg.norm(mid[:, :2], axis=1), 8))
        sxy = (fr + GAP) / max(inner, 1e-4)
        Q = P.copy()
        Q[:, :2] *= sxy
        Q[:, 2] *= length / zr
        if side == "r":
            Q[:, 0] *= -1
        # frame: z -> forearm axis (wrist to elbow); x -> outward (away from the body)
        up = np.array([0, 0, 1.0])
        xa = np.cross(axv, up)
        if np.dot(xa, np.array([1.0 if side == "l" else -1.0, 0, 0])) < 0:
            xa = -xa
        xa /= np.linalg.norm(xa)
        ya = np.cross(axv, xa)
        Rm = np.stack([xa, ya, axv], 1)
        Q = Q @ Rm.T + wr + axv * wr_end
        halves.append(Q)
        print("PART bracer", side, "forearm r", round(fr, 4), "len", round(length, 3), "xy scale", round(sxy, 3))
    bm = bmesh.new()
    bm.from_mesh(part.data)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    me2 = bpy.data.meshes.new("bracer_r")
    bm.to_mesh(me2)
    bm.free()
    for m_ in part.data.materials:
        me2.materials.append(m_)
    ob2 = bpy.data.objects.new("bracer_r", me2)
    sc.collection.objects.link(ob2)
    part.data.vertices.foreach_set("co", halves[0].ravel())
    me2.vertices.foreach_set("co", halves[1].ravel())
    part.data.update()
    me2.update()
    bpy.ops.object.select_all(action="DESELECT")
    ob2.select_set(True)
    part.select_set(True)
    vl.objects.active = part
    bpy.ops.object.join()
    P = np.array([v.co[:] for v in part.data.vertices])
if KIND == "boot":
    # one boot model -> left and right: scaled so its top reaches PART_TOP_Z on the calf; sole on the floor; toe to
    # -Y (the MetaHuman faces -Y); centred on each foot; the right one mirrored
    pz0, pz1 = P[:, 2].min(), P[:, 2].max()
    top_z = float(os.environ.get("PART_TOP_Z", "0.40"))
    s = top_z / (pz1 - pz0)
    ext = P[:, :2].max(0) - P[:, :2].min(0)
    if ext[0] > ext[1]:
        P = P[:, [1, 0, 2]] * np.array([1, -1, 1])
    low = P[P[:, 2] < pz0 + (pz1 - pz0) * 0.12]
    shaft = P[P[:, 2] > pz0 + (pz1 - pz0) * 0.6]
    if low[:, 1].mean() - shaft[:, 1].mean() > 0:
        P[:, 1] *= -1
        shaft = P[P[:, 2] > pz0 + (pz1 - pz0) * 0.6]
    sc_xy = shaft[:, :2].mean(0)
    # foot length from the body: heel..toe tip below 4 cm, per side; the boot sole must cover it + 1.5 cm
    BV = np.array([v.co[:] for v in bme.vertices])
    lowb = BV[(BV[:, 2] < 0.04) & (BV[:, 0] > 0.02)]
    foot_len = float(lowb[:, 1].max() - lowb[:, 1].min())
    foot_toe = float(lowb[:, 1].min())
    sole = P[P[:, 2] < pz0 + (pz1 - pz0) * 0.06]
    boot_len = float(sole[:, 1].max() - sole[:, 1].min()) * s
    ky = max(1.0, (foot_len + 0.015) / max(boot_len, 1e-4))
    print("PART boots foot len", round(foot_len, 3), "boot sole len", round(boot_len, 3), "length scale", round(ky, 3))
    sides = []
    for side in ("l", "r"):
        ank = np.array(bhead(f"foot_{side}"))
        Q = (P - np.array([sc_xy[0], sc_xy[1], pz0])) * s
        Q[:, 0] *= float(os.environ.get("PART_WIDTH", "1.0"))
        lowq = Q[:, 2] < 0.12 * top_z + 0.04          # stretch only the foot part forwards (the shaft keeps its shape)
        f_ = np.clip((0.12 - Q[:, 2]) / 0.08, 0, 1)
        Q[:, 1] = Q[:, 1] * (1 + (ky - 1) * f_)
        if side == "r":
            Q[:, 0] *= -1
        # this side's foot sole: centre, direction (toe-out angle) and toe tip
        sg = 1 if side == "l" else -1
        fs = BV[(BV[:, 2] < 0.04) & (BV[:, 0] * sg > 0.02)]
        fc = fs[:, :2].mean(0)
        cov = np.cov((fs[:, :2] - fc).T)
        ev, evec = np.linalg.eigh(cov)
        ax = evec[:, 1] if evec[1, 1] < 0 else -evec[:, 1]          # long axis pointing to the toes (-Y)
        ang = math.atan2(ax[0], -ax[1])                             # 0 = straight ahead
        # boot sole centre at the origin, then rotate and move onto the foot
        sole_c = Q[Q[:, 2] < 0.03, :2].mean(0)
        Q[:, :2] -= sole_c
        ca, sa = math.cos(ang), math.sin(ang)
        Q[:, :2] = Q[:, :2] @ np.array([[ca, sa], [-sa, ca]])
        Q[:, :2] += fc
        toe_proj = (fs[:, :2] - fc) @ np.array([math.sin(ang), -math.cos(ang)])
        bq = (Q[Q[:, 2] < 0.03, :2] - fc) @ np.array([math.sin(ang), -math.cos(ang)])
        sh = (toe_proj.max() + 0.008) - bq.max()
        Q[:, :2] += sh * np.array([math.sin(ang), -math.cos(ang)])
        print("PART boot", side, "foot centre", fc.round(3), "toe-out deg", round(math.degrees(ang), 1), "shift", round(sh, 3))
        Q[:, 2] -= float(os.environ.get("PART_SINK", "0.012"))           # the foot's sole is 1 cm under the floor line
        sides.append(Q)
    bm = bmesh.new()
    bm.from_mesh(part.data)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    me2 = bpy.data.meshes.new("boot_r")
    bm.to_mesh(me2)
    bm.free()
    for m_ in part.data.materials:
        me2.materials.append(m_)
    ob2 = bpy.data.objects.new("boot_r", me2)
    sc.collection.objects.link(ob2)
    part.data.vertices.foreach_set("co", sides[0].ravel())
    me2.vertices.foreach_set("co", sides[1].ravel())
    part.data.update()
    me2.update()
    bpy.ops.object.select_all(action="DESELECT")
    ob2.select_set(True)
    part.select_set(True)
    vl.objects.active = part
    bpy.ops.object.join()
    P = np.array([v.co[:] for v in part.data.vertices])
    print("PART boots scale", round(s, 3), "height", round(top_z, 3), "verts", len(P))
part.data.vertices.foreach_set("co", P.ravel())
part.data.update()

print("PART chk after place", [round(x, 4) for x in arm.matrix_world.to_scale()])
# push out of the skin
pushed = 0
for i in range(len(P)):
    if KIND == "boot" and P[i][2] < 0.12:        # the sole wraps the foot: pushing it out lifted it off the toes
        continue
    loc, nrm, _i, d = bvh_s.find_nearest(Vector(P[i]))
    if loc is None:
        continue
    if (Vector(P[i]) - loc).dot(nrm) < GAP:
        P[i] = np.array(loc + nrm * GAP)
        pushed += 1
part.data.vertices.foreach_set("co", P.ravel())
part.data.update()
print("PART pushed", pushed)

if KIND == "bracer":
    bg = {f"{b}_{sd}": [] for b in ("lowerarm", "hand") for sd in "lr"}
    for i, p in enumerate(P):
        sd = "l" if p[0] > 0 else "r"
        wr = np.array(bhead(f"hand_{sd}"))
        el = np.array(bhead(f"lowerarm_{sd}"))
        t = float(np.clip(np.dot(p - wr, (el - wr) / np.linalg.norm(el - wr)) / 0.05, 0, 1))
        bg[f"lowerarm_{sd}"].append((i, 0.5 + 0.5 * t))
        if t < 1:
            bg[f"hand_{sd}"].append((i, 0.5 * (1 - t)))
    for k, lst in bg.items():
        g = part.vertex_groups.new(name=k)
        for i, v in lst:
            g.add([i], v, "REPLACE")
if KIND in ("hip", "belt"):
    g = part.vertex_groups.new(name="pelvis")
    g.add(list(range(len(P))), 1.0, "REPLACE")
if KIND == "boot":
    bg = {k: [] for k in ("foot_l", "calf_l", "ball_l", "foot_r", "calf_r", "ball_r")}
    for i, p in enumerate(P):
        sd = "l" if p[0] > 0 else "r"
        fz = bhead(f"foot_{sd}").z
        if p[2] > fz + 0.06:
            w = {f"calf_{sd}": 1.0}
        elif p[2] > fz - 0.02:
            t = (p[2] - (fz - 0.02)) / 0.08
            w = {f"calf_{sd}": t, f"foot_{sd}": 1 - t}
        else:
            toe = float(np.clip((bhead(f"foot_{sd}").y - p[1] - 0.06) / 0.06, 0, 1))
            w = {f"foot_{sd}": 1 - toe, f"ball_{sd}": toe}
        for k, v in w.items():
            if v > 0.001:
                bg[k].append((i, v))
    for k, lst in bg.items():
        g = part.vertex_groups.new(name=k)
        for i, v in lst:
            g.add([i], v, "REPLACE")
# weights: by height along the neck (neck_02 at the top -> neck_01 -> spine_05 / clavicles below)
if KIND == "scarf":
    zs = {"neck_02": bhead("neck_02").z, "neck_01": bhead("neck_01").z, "spine_05": bhead("spine_05").z}
    groups = {k: [] for k in ("neck_02", "neck_01", "spine_05", "clavicle_l", "clavicle_r")}
    for i, p in enumerate(P):
        z = p[2]
        if z >= zs["neck_02"]:
            w = {"neck_02": 1.0}
        elif z >= zs["neck_01"]:
            t = (z - zs["neck_01"]) / max(1e-4, zs["neck_02"] - zs["neck_01"])
            w = {"neck_02": t, "neck_01": 1 - t}
        else:
            t = float(np.clip((zs["neck_01"] - z) / max(1e-4, zs["neck_01"] - zs["spine_05"]), 0, 1))
            side = "clavicle_l" if p[0] > 0 else "clavicle_r"
            sw = min(1.0, abs(p[0]) / 0.12) * t
            w = {"neck_01": 1 - t, "spine_05": t * (1 - sw * 0.6), side: t * sw * 0.6}
        for k, v in w.items():
            if v > 0.001:
                groups[k].append((i, v))
    for k, lst in groups.items():
        g = part.vertex_groups.new(name=k)
        for i, v in lst:
            g.add([i], v, "REPLACE")
part.name = "Part_" + KIND
# texture next to the FBX
img = next((nd.image for sl in part.material_slots if sl.material and sl.material.use_nodes
            for nd in sl.material.node_tree.nodes if nd.type == "TEX_IMAGE" and nd.image), None)
if img:
    tex_out = os.path.splitext(os.path.abspath(OUT))[0] + "_albedo.png"
    img.filepath_raw = tex_out
    img.file_format = "PNG"
    img.save()
    print("PART texture", tex_out)
for f in part.data.polygons:
    f.use_smooth = True

print("PART chk after weights", [round(x, 4) for x in arm.matrix_world.to_scale()])
# preview with the body
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.color_type = "TEXTURE"
sc.display.shading.light = "STUDIO"
sc.render.resolution_x, sc.render.resolution_y = 800, 800
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = {"scarf": 0.6, "hip": 0.8, "belt": 0.8, "bracer": 1.4}.get(KIND, 1.0)
zc = float(P[:, 2].mean())
for tag, loc, rot in (("front", (0, -3, zc), (math.pi / 2, 0, 0)), ("side", (3, 0, zc), (math.pi / 2, 0, math.pi / 2)), ("back", (0, 3, zc), (math.pi / 2, 0, math.pi))):
    cam.location, cam.rotation_euler = Vector(loc), rot
    sc.render.filepath = PREV.replace(".png", f"_{tag}.png")
    bpy.ops.render.render(write_still=True)

print("PART chk after preview", [round(x, 4) for x in arm.matrix_world.to_scale()])
# into the armature frame, armature modifier, export
part.data.transform(AWi)
part.parent = arm
part.matrix_parent_inverse = Matrix.Identity(4)
part.matrix_world = AW.copy()
am = part.modifiers.new("Armature", "ARMATURE")
am.object = arm
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
part.select_set(True)
bpy.data.objects.remove(body, do_unlink=True)
print("PART export arm scale", [round(x, 4) for x in arm.matrix_world.to_scale()], "unit", sc.unit_settings.scale_length)
bpy.ops.export_scene.fbx(filepath=os.path.abspath(OUT), use_selection=True, object_types={"ARMATURE", "MESH"},
                         add_leaf_bones=False, mesh_smooth_type="FACE", path_mode="COPY", embed_textures=True)
print("PART out", OUT)
