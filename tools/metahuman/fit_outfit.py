"""Design-sheet clothes onto the MetaHuman hero (doc 180): the Hi3D figure (one fused mesh: body + clothes + hair + prop)
is the source. Its dark cloth is cut out by texture, the MetaHuman skeleton is bent into the figure's pose, the cloth
is pushed out of the posed body, skin weights come from the nearest body faces, and inverse skinning brings the cloth
back to the MetaHuman rest (A) pose. Output: FBX with the MetaHuman armature + the cloth as a skinned mesh.

blender -b -P tools/metahuman/fit_outfit.py -- figure.glb joints.json mh_body.fbx out.fbx preview.png
env: OUTFIT_LUM (0.2, cloth = texels darker than this), OUTFIT_GAP (0.004 m off the skin), OUTFIT_DROP_Z (drop
     cloth above this height in the figure's frame, e.g. the head; default: the nose joint - 0.02)
"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

a = sys.argv[sys.argv.index("--") + 1:]
FIG, JSN, MHB, OUT, PREV = a[:5]
LUM = float(os.environ.get("OUTFIT_LUM", "0.2"))
CUT = os.environ.get("OUTFIT_CUT", "dark")   # dark: keep texels under OUTFIT_LUM / skin: drop only skin and light hair
GAP = float(os.environ.get("OUTFIT_GAP", "0.004"))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
vl = bpy.context.view_layer

# --- MetaHuman body + armature
bpy.ops.import_scene.fbx(filepath=os.path.abspath(MHB))
arm = next(o for o in sc.objects if o.type == "ARMATURE")
body = next(o for o in sc.objects if o.type == "MESH")
vl.update()
AW = arm.matrix_world


def bhead(n):
    return AW @ arm.pose.bones[n].head


# --- figure: placed so its torso matches the MetaHuman torso
J = {k: np.array(v[:3]) for k, v in json.load(open(JSN))["joints"].items()}
for p in ("shoulder", "hip", "elbow", "wrist", "knee", "ankle"):        # side view mixes left/right: share the depth
    yy = (J[p + "_l"][1] + J[p + "_r"][1]) / 2
    J[p + "_l"][1] = J[p + "_r"][1] = yy
for p in ("elbow", "wrist"):                                              # arms hang in the shoulder plane
    for s_ in "lr":
        J[f"{p}_{s_}"][1] = J[f"shoulder_{s_}"][1]
before = set(sc.objects)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(FIG))
new = [o for o in sc.objects if o not in before]
fig = max((o for o in new if o.type == "MESH"), key=lambda o: len(o.data.vertices))
for o in new:
    if o is not fig and o.type == "MESH":
        bpy.data.objects.remove(o, do_unlink=True)
vl.update()
fig.data.transform(fig.matrix_world)
# the Hi3D figure may carry an old (Mixamo) rig: its weights would mix with the MetaHuman ones
fig.modifiers.clear()
fig.vertex_groups.clear()
for o in [o for o in sc.objects if o.type == "ARMATURE" and o is not arm]:
    bpy.data.objects.remove(o, do_unlink=True)
fig.parent = None
fig.matrix_world = Matrix.Identity(4)
mh_sh = (bhead("upperarm_l") + bhead("upperarm_r")) / 2
mh_hp = (bhead("thigh_l") + bhead("thigh_r")) / 2
f_sh = (J["shoulder_l"] + J["shoulder_r"]) / 2
f_hp = (J["hip_l"] + J["hip_r"]) / 2
s = (mh_sh.z - mh_hp.z) / (f_sh[2] - f_hp[2])
off = np.array(mh_hp) - f_hp * s
T = Matrix.Translation(Vector(off)) @ Matrix.Scale(s, 4)
fig.data.transform(T)
for k in J:
    J[k] = J[k] * s + off
print("OUTFIT figure scale", round(s, 4), "offset", off.round(3))

# --- bend the MetaHuman arms/legs into the figure's pose (bone -> its child's head along the figure's segment)
CH = [("upperarm_l", "lowerarm_l", "shoulder_l", "elbow_l"), ("lowerarm_l", "hand_l", "elbow_l", "wrist_l"),
      ("upperarm_r", "lowerarm_r", "shoulder_r", "elbow_r"), ("lowerarm_r", "hand_r", "elbow_r", "wrist_r"),
      ("thigh_l", "calf_l", "hip_l", "knee_l"), ("calf_l", "foot_l", "knee_l", "ankle_l"),
      ("thigh_r", "calf_r", "hip_r", "knee_r"), ("calf_r", "foot_r", "knee_r", "ankle_r")]
AWi = AW.inverted()
for bn, cn, j0, j1 in CH:
    vl.update()
    pb = arm.pose.bones[bn]
    cur = (bhead(cn) - bhead(bn)).normalized()
    want = Vector(J[j1] - J[j0]).normalized()
    q = cur.rotation_difference(want)                      # world-space rotation
    Rn = AW.to_3x3().normalized()                          # rotation part only (the armature is scaled 0.01: cm)
    R = (Rn.inverted() @ q.to_matrix() @ Rn).to_4x4()
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix
    vl.update()
    print("OUTFIT pose", bn, "turned", round(math.degrees(cur.angle(want)), 1), "deg")
vl.update()

# posed body (for pushing out and for weights)
dg = bpy.context.evaluated_depsgraph_get()
pbody_me = bpy.data.meshes.new_from_object(body.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
pbody_me.transform(body.matrix_world)
pbody = bpy.data.objects.new("PosedBody", pbody_me)
sc.collection.objects.link(pbody)
for g in body.vertex_groups:
    pbody.vertex_groups.new(name=g.name)
vl.update()
PB = np.array([v.co[:] for v in pbody.data.vertices])
print("OUTFIT posed body verts", len(PB), "bounds", PB.min(0).round(3), PB.max(0).round(3), "body verts", len(body.data.vertices))
# from the polygons themselves: FromObject() hands back triangle indices, not polygon indices
bvh_b = BVHTree.FromPolygons([v.co.copy() for v in pbody.data.vertices], [list(p.vertices) for p in pbody.data.polygons])

# --- cut the cloth: dark texels, below the face
img = next((nd.image for sl in fig.material_slots if sl.material and sl.material.use_nodes
            for nd in sl.material.node_tree.nodes if nd.type == "TEX_IMAGE" and nd.image), None)
tw, th = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(th, tw, 4)
lum = px[..., :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)
SKIN_MIN_Z = float(os.environ.get("OUTFIT_SKIN_MIN_Z", "-1"))
HIP_FZ = float((J["hip_l"][2] + J["hip_r"][2]) / 2)
drop_z = float(os.environ.get("OUTFIT_DROP_Z", str(J["nose"][2] - float(os.environ.get("OUTFIT_DROP_BELOW_NOSE", "0.02")))))
bm = bmesh.new()
bm.from_mesh(fig.data)
uvl = bm.loops.layers.uv.active
kill, DBG, REAS = [], [], []
# skin colour sampled from the figure's own face (around the nose): skin = close to it in chromaticity, a broad
# brightness range for shade; warm metal / leather (more saturated) stays
SKIN_MODEL = os.environ.get("OUTFIT_SKIN_MODEL", "0") == "1"
WARM = os.environ.get("OUTFIT_WARM", "1") == "1"
if CUT == "skin" and SKIN_MODEL:
    nz = Vector(J["nose"])
    samp = []
    for f in bm.faces:
        c_ = f.calc_center_median()
        if (c_ - nz).length < 0.045 and c_.y < nz.y + 0.03:
            for l in f.loops:
                uu, vv = l[uvl].uv[0] % 1.0, l[uvl].uv[1] % 1.0
                samp.append(px[min(th - 1, int(vv * th)), min(tw - 1, int(uu * tw)), :3])
    samp = np.array(samp)
    SK = np.median(samp, 0)
    SKc = SK / max(SK.sum(), 1e-4)
    SKL = float(SK @ np.array([0.2126, 0.7152, 0.0722]))
    print("OUTFIT skin model", SK.round(3), "from", len(samp), "texels")
for f in bm.faces:
    u = np.mean([l[uvl].uv[0] for l in f.loops]) % 1.0
    v = np.mean([l[uvl].uv[1] for l in f.loops]) % 1.0
    zf_ = f.calc_center_median().z
    if CUT == "skin":
        # keep everything but skin (warm) and light hair (bright grey, only down to the hips - glossy boots are bright
        # grey too); vote over the centre and the corners so thin seam lines in the texture do not leave shards
        pts_ = [(u, v)] + [((l[uvl].uv[0]) % 1.0, (l[uvl].uv[1]) % 1.0) for l in f.loops]
        votes = 0
        for (uu, vv) in pts_:
            py_, px_ = min(th - 1, int(vv * th)), min(tw - 1, int(uu * tw))
            L = lum[py_, px_]
            r_, g_, b_ = px[py_, px_, :3]
            mx_, mn_ = max(r_, g_, b_), min(r_, g_, b_)
            sat_ = (mx_ - mn_) / max(mx_, 1e-4)
            warm_ = r_ > g_ > b_ and (r_ - b_) > 0.04 and 0.12 < sat_ < 0.6     # vivid red vials are not skin
            if SKIN_MODEL:
                cc = np.array([r_, g_, b_]) / max(r_ + g_ + b_, 1e-4)
                skin_ = (zf_ > SKIN_MIN_Z and np.abs(cc - SKc).max() < float(os.environ.get("OUTFIT_SKIN_CHROMA", "0.025"))
                         and 0.35 * SKL < L < 1.6 * SKL)
            else:
                # off for figures whose skin is not warm (pale grey Ain): then it only took bronze armour and leather
                skin_ = WARM and warm_ and zf_ > SKIN_MIN_Z and (L > 0.22 or (zf_ < HIP_FZ and L > 0.07))
            hair_ = zf_ > HIP_FZ and L > float(os.environ.get("OUTFIT_HAIR_LUM", "0.42")) and sat_ < 0.12
            # pale grey skin (old game models): bright below the hips, above the boots - the cloth there is dark
            pale_ = SKIN_MIN_Z < zf_ < HIP_FZ and L > float(os.environ.get("OUTFIT_PALE_LUM", "0.28"))
            if pale_:      # only on the legs: the coat's grey sheen further out is cloth (it cut the coat at the knee)
                dl_ = bvh_b.find_nearest(f.calc_center_median())[3]
                pale_ = dl_ is not None and dl_ < float(os.environ.get("OUTFIT_PALE_NEAR", "0.025"))
            votes += 1 if (skin_ or hair_ or pale_) else 0
            if os.environ.get("OUTFIT_DEBUG") and f.calc_center_median().x > 0.15 and 1.1 < zf_ < 1.45:
                REAS.append((skin_, hair_, pale_, round(float(L), 3), round(float(sat_), 3)))
        drop_ = votes * 2 > len(pts_)
    else:
        py_, px_ = min(th - 1, int(v * th)), min(tw - 1, int(u * tw))
        drop_ = lum[py_, px_] > LUM
    if drop_ or zf_ > drop_z:
        kill.append(f)
    if os.environ.get("OUTFIT_DEBUG"):
        DBG.append((zf_, drop_))
print("OUTFIT faces", len(bm.faces), "dropped", len(kill))
if os.environ.get("OUTFIT_DEBUG"):
    R_ = REAS
    print("OUTFIT arm texels", len(R_), "skin", sum(r[0] for r in R_), "hair", sum(r[1] for r in R_), "pale", sum(r[2] for r in R_))
    D_ = np.array(DBG)
    for z0 in np.arange(0, 0.7, 0.05):
        m_ = (D_[:, 0] >= z0) & (D_[:, 0] < z0 + 0.05)
        print("OUTFIT dbg z", round(z0, 2), "faces", int(m_.sum()), "dropped", int(D_[m_, 1].sum()))
tex_out = os.path.splitext(os.path.abspath(OUT))[0] + "_albedo.png"
img.filepath_raw = tex_out
img.file_format = "PNG"
img.save()
print("OUTFIT texture", tex_out)
bmesh.ops.delete(bm, geom=kill, context="FACES")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
# drop small islands (specks of dark texture on skin / hair)
islands, seen = [], set()
for v in bm.verts:
    if v.index in seen:
        continue
    stack, isl = [v], []
    seen.add(v.index)
    while stack:
        x = stack.pop()
        isl.append(x)
        for e in x.link_edges:
            y = e.other_vert(x)
            if y.index not in seen:
                seen.add(y.index)
                stack.append(y)
    islands.append(isl)
# also drop islands away from the body (the staff): median distance to the posed body over FAR m
FAR = float(os.environ.get("OUTFIT_FAR", "0.12"))
far_n = 0
small = []
for isl in islands:
    if len(isl) < int(os.environ.get("OUTFIT_MIN_ISLAND", "200")):
        small += isl
        continue
    smp = isl[::max(1, len(isl) // 60)]
    dd = [bvh_b.find_nearest(x.co)[3] for x in smp]
    if np.median([d_ if d_ is not None else 9 for d_ in dd]) > FAR:
        small += isl
        far_n += 1
print("OUTFIT far islands dropped", far_n)
bmesh.ops.delete(bm, geom=small, context="VERTS")
bm.to_mesh(fig.data)
bm.free()
fig.data.update()
print("OUTFIT cloth verts", len(fig.data.vertices), "islands", len(islands), "small dropped", len(small))
if os.environ.get("OUTFIT_DEBUG"):
    _V = np.array([v.co[:] for v in fig.data.vertices])
    _m = (_V[:, 2] > 0.1) & (_V[:, 2] < 0.35)
    print("OUTFIT trace cut shaft verts", int(_m.sum()), "x|y mean", np.abs(_V[_m, 0]).mean().round(3) if _m.any() else 0, _V[_m, 1].mean().round(3) if _m.any() else 0)
# keep it light: Hi3D v3 gives ~2M faces; collapse-decimate (UVs kept) to OUTFIT_MAX_FACES
MAXF = int(os.environ.get("OUTFIT_MAX_FACES", "150000"))
if len(fig.data.polygons) > MAXF:
    nf0 = len(fig.data.polygons)
    dm = fig.modifiers.new("dec", "DECIMATE")
    dm.ratio = MAXF / nf0
    bpy.context.view_layer.objects.active = fig
    bpy.ops.object.modifier_apply(modifier="dec")
    print("OUTFIT decimated", nf0, "->", len(fig.data.polygons), "faces")

# --- warp the cloth so the figure's joints land on the posed MetaHuman joints (narrow hips, feet together:
# bending the bones gets the directions, not the positions; boots ended up 3 cm inside the feet)
V = np.array([v.co[:] for v in fig.data.vertices])
PAIRS = [("hip", "thigh"), ("knee", "calf"), ("ankle", "foot")]
src, dst = [], []
for s_ in "lr":
    for jn, bn in PAIRS:
        src.append(J[f"{jn}_{s_}"])
        dst.append(np.array(bhead(f"{bn}_{s_}")))
    for (j0, b0), (j1, b1) in zip(PAIRS[:-1], PAIRS[1:]):
        for t_ in (0.25, 0.5, 0.75):
            src.append(J[f"{j0}_{s_}"] * (1 - t_) + J[f"{j1}_{s_}"] * t_)
            dst.append(np.array(bhead(f"{b0}_{s_}")) * (1 - t_) + np.array(bhead(f"{b1}_{s_}")) * t_)
    src.append(J[f"ankle_{s_}"] + np.array([0, -0.05, -0.08]))      # the foot itself
    dst.append(np.array(bhead(f"foot_{s_}")) + np.array([0, -0.05, -0.08]) + (np.array(bhead(f"foot_{s_}")) - J[f"ankle_{s_}"]) * 0)
src, dst = np.array(src), np.array(dst)
if os.environ.get("OUTFIT_WARP_Z", "0") != "1":
    # sideways only: both stand on the floor; the detected ankle sits 12 cm high on heeled boots and pulled the boot
    # shafts down into the leg
    dst[:, 2] = src[:, 2]
n_ = len(src)
# local, legs only: gaussian weights (8 cm), fading to no move away from the legs (coat panels by the hands stay)
SIG = float(os.environ.get("OUTFIT_WARP_SIGMA", "0.08"))
for c0 in range(0, len(V), 20000):
    X = V[c0:c0 + 20000]
    w_ = np.exp(-(np.linalg.norm(X[:, None] - src[None], axis=2) / SIG) ** 2)
    V[c0:c0 + 20000] = X + (w_ @ (dst - src)) / np.maximum(1.0, w_.sum(1, keepdims=True))
# boots: the figure's heeled boots cannot sit on the flat MetaHuman foot and come in many small pieces ->
# drop the cloth hugging the lower leg; a boot is made from the body's own lower leg below (OUTFIT_BOOT_TOP)
BOOT_TOP = float(os.environ.get("OUTFIT_BOOT_TOP", "0.40"))
print("OUTFIT joint warp", n_, "points, max joint move", round(float(np.linalg.norm(dst - src, axis=1).max()), 3))

# --- collar (scarf): the bare neck belongs to the MetaHuman head mesh, out of the body lining's reach -> a band of
# the head mesh between the body's top and under the chin, 4 mm out, in a dark texel of the cloth texture
COL = os.environ.get("OUTFIT_COLLAR", "")
COLLAR_V = set()
if COL:
    before_ = set(sc.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(COL))
    newo = [o for o in sc.objects if o not in before_]
    hm_ = max((o for o in newo if o.type == "MESH"), key=lambda o: len(o.data.vertices))
    vl.update()
    hme = hm_.data.copy()
    hme.transform(hm_.matrix_world)
    if max(v.co.z for v in hme.vertices) > 10:
        hme.transform(Matrix.Scale(0.01, 4))
    for o in newo:
        bpy.data.objects.remove(o, do_unlink=True)
    body_top = float(PB[:, 2].max())
    ctop = float(J["nose"][2]) - float(os.environ.get("OUTFIT_COLLAR_TOP", "0.075"))
    cbot = body_top - 0.03
    bm_c = bmesh.new()
    bm_c.from_mesh(hme)
    ny_ = float(bhead("neck_01").y)
    cback = float(J["nose"][2]) - float(os.environ.get("OUTFIT_COLLAR_BACK", "0.01"))   # the nape: up to the hair

    def top_at(c_):
        t_ = np.clip((c_.y - (ny_ - 0.02)) / 0.04, 0, 1)      # front (chin) -> back (nape)
        return ctop + (cback - ctop) * t_
    bmesh.ops.delete(bm_c, geom=[f for f in bm_c.faces if not (cbot < f.calc_center_median().z < top_at(f.calc_center_median()))], context="FACES")
    bmesh.ops.delete(bm_c, geom=[v for v in bm_c.verts if not v.link_faces], context="VERTS")
    bmesh.ops.recalc_face_normals(bm_c, faces=bm_c.faces)   # the head FBX came in mirrored: faces pointed inwards
    bm_c.normal_update()
    cc_ = sum((v.co for v in bm_c.verts), Vector()) / max(1, len(bm_c.verts))
    if sum((v.co - cc_).dot(v.normal) for v in bm_c.verts) < 0:
        bmesh.ops.reverse_faces(bm_c, faces=bm_c.faces)
        bm_c.normal_update()
    # scarf look: wrapped folds (rings that wobble around the neck) and a looser bottom
    FA = float(os.environ.get("OUTFIT_COLLAR_FOLDS", "0"))        # fold depth, m
    FL = float(os.environ.get("OUTFIT_COLLAR_FLARE", "0"))        # extra gap at the bottom, m
    g0 = float(os.environ.get("OUTFIT_COLLAR_GAP", "0.004"))
    zr = max(1e-3, ctop - cbot)
    for v in bm_c.verts:
        ang = math.atan2(v.co.x, v.co.y - ny_)
        t_ = float(np.clip((v.co.z - cbot) / zr, 0, 1))
        fold = 0.0
        if FA > 0:
            ph = v.co.z * 2 * math.pi / float(os.environ.get("OUTFIT_COLLAR_PERIOD", "0.045")) + 1.4 * math.sin(ang) + 0.7 * math.sin(3 * ang + 1.3)
            fold = FA * (0.5 + 0.5 * math.sin(ph)) * (0.7 + 0.3 * math.sin(2 * ang + 0.5))
        v.co += v.normal * (g0 + fold + FL * (1 - t_) ** 2)
    if FA > 0:      # the head mesh's own small bumps showed as fuzz once displaced
        for _ in range(2):
            bmesh.ops.smooth_vert(bm_c, verts=bm_c.verts[:], factor=0.4, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # wrapped scarf bands over the base collar: tilted rings around the neck axis, layered outwards, torn lower edge
    NB = int(os.environ.get("OUTFIT_SCARF_BANDS", "0"))
    if NB > 0:
        bvh_c = BVHTree.FromBMesh(bm_c)
        rs = np.random.default_rng(5)
        NA = 96
        nb_v = 0
        for bi in range(NB):
            zc_ = cbot + (ctop - cbot) * (0.15 + 0.75 * bi / max(1, NB - 1)) + rs.normal(0, 0.004)
            tilt = 0.012 + 0.012 * rs.random()
            ph0 = rs.random() * 2 * math.pi
            wid = 0.022 + 0.012 * rs.random()
            lay = 0.004 + 0.0035 * (NB - bi)          # lower bands sit further out (they wrap over)
            rows = []
            prev_r = None
            for ai in range(NA + 1):
                a_ = 2 * math.pi * ai / NA
                d_ = Vector((math.sin(a_), -math.cos(a_), 0))
                col = []
                tear = rs.random() * 0.012 if ai % 3 == 0 else 0.0
                for vi, vv in enumerate((0.0, 0.33, 0.66, 1.0)):
                    z_ = zc_ + tilt * math.sin(a_ + ph0) + (vv - 0.5) * wid - (tear if vi == 0 else 0)
                    hit = bvh_c.ray_cast(Vector((0, ny_, z_)), d_)
                    r_ = (hit[0] - Vector((0, ny_, z_))).length if hit[0] is not None else prev_r
                    if r_ is None:
                        r_ = 0.06
                    prev_r = r_
                    bul = 0.003 * math.sin(math.pi * vv) + 0.002 * math.sin(4 * a_ + bi)
                    col.append(bm_c.verts.new(Vector((0, ny_, z_)) + d_ * (r_ + lay + bul)))
                rows.append(col)
                nb_v += 4
            for ai in range(NA):
                for vi in range(3):
                    try:
                        bm_c.faces.new((rows[ai][vi], rows[ai + 1][vi], rows[ai + 1][vi + 1], rows[ai][vi + 1]))
                    except ValueError:
                        pass
        bm_c.normal_update()
        print("OUTFIT scarf bands", NB, "verts", nb_v)
    # a dark texel for its UVs
    dk = np.argwhere(lum < 0.03)
    dv_ = dk[len(dk) // 2] if len(dk) else np.array([0, 0])
    duv = ((dv_[1] + 0.5) / tw, (dv_[0] + 0.5) / th)
    ul_ = bm_c.loops.layers.uv.verify()
    for f in bm_c.faces:
        f.material_index = 0
        f.smooth = True             # faceted bands read as cardboard
        for l in f.loops:
            l[ul_].uv = duv
    cme = bpy.data.meshes.new("Collar")
    bm_c.to_mesh(cme)
    bm_c.free()
    cmat = bpy.data.materials.new("M_Collar")
    cme.materials.append(cmat)
    cob = bpy.data.objects.new("Collar", cme)
    sc.collection.objects.link(cob)
    cob.vertex_groups.new(name="_collar").add(list(range(len(cme.vertices))), 1.0, "REPLACE")
    cme.uv_layers[0].name = fig.data.uv_layers.active.name
    bpy.ops.object.select_all(action="DESELECT")
    cob.select_set(True)
    fig.select_set(True)
    vl.objects.active = fig
    bpy.ops.object.join()
    V = np.array([v.co[:] for v in fig.data.vertices])
    gi_c = fig.vertex_groups["_collar"].index
    COLLAR_V = {v.index for v in fig.data.vertices if any(g.group == gi_c and g.weight > 0.5 for g in v.groups)}
    fig.vertex_groups.remove(fig.vertex_groups["_collar"])
    print("OUTFIT collar fig verts above 1.45:", int((V[:, 2] > 1.45).sum()), "of", len(V))
    print("OUTFIT collar z", round(cbot, 3), round(ctop, 3), round(cback, 3), "verts", len(cme.vertices) if cme.name in bpy.data.meshes else "joined")

# --- push out of the posed body
pushed = 0
for i in range(len(V)):
    if i in COLLAR_V:                       # sits on the head mesh, not the body
        continue
    loc, nrm, _i, d = bvh_b.find_nearest(Vector(V[i]))
    if loc is None:
        continue
    dv = Vector(V[i]) - loc
    if dv.dot(nrm) < GAP:
        V[i] = np.array(loc + nrm * GAP)
        pushed += 1
fig.data.vertices.foreach_set("co", V.ravel())
fig.data.update()
print("OUTFIT pushed out", pushed)
if os.environ.get("OUTFIT_DEBUG"):
    _V = np.array([v.co[:] for v in fig.data.vertices])
    _m = (_V[:, 2] > 0.1) & (_V[:, 2] < 0.35)
    print("OUTFIT trace pushed shaft verts", int(_m.sum()), "x|y mean", np.abs(_V[_m, 0]).mean().round(3) if _m.any() else 0, _V[_m, 1].mean().round(3) if _m.any() else 0)
if BOOT_TOP > 0 and os.environ.get("OUTFIT_BOOT_CLEAN", "1") == "1":
    calf_y = (bhead("calf_l").y + bhead("calf_r").y) / 2
    near = (np.array([(bvh_b.find_nearest(Vector(x))[3] or 9) < float(os.environ.get("OUTFIT_BOOT_NEAR", "0.08")) for x in V]) & (V[:, 2] < BOOT_TOP)
            & (V[:, 1] < calf_y + 0.03)) | (V[:, 2] < float(os.environ.get("OUTFIT_FLOOR", "0.13")))   # not the coat behind the legs
    bm = bmesh.new()
    bm.from_mesh(fig.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if sum(near[v.index] for v in f.verts) >= 2], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(fig.data)
    bm.free()
    fig.data.update()
    V = np.array([v.co[:] for v in fig.data.vertices])
    # loose pieces wholly below the knee (heel blocks, boot shafts) - the coat hem stays joined to the coat
    bm = bmesh.new()
    bm.from_mesh(fig.data)
    bm.verts.ensure_lookup_table()
    seen_, gone = set(), []
    for v in bm.verts:
        if v.index in seen_:
            continue
        st, cur_ = [v], []
        seen_.add(v.index)
        while st:
            x_ = st.pop()
            cur_.append(x_)
            for e in x_.link_edges:
                y_ = e.other_vert(x_)
                if y_.index not in seen_:
                    seen_.add(y_.index)
                    st.append(y_)
        if max(x_.co.z for x_ in cur_) < float(os.environ.get("OUTFIT_LOOSE_Z", "0.42")):
            smp = cur_[::max(1, len(cur_) // 40)]
            md = np.median([(bvh_b.find_nearest(x_.co)[3] or 9) for x_ in smp])
            mx = abs(np.mean([x_.co.x for x_ in cur_]))
            my = np.mean([x_.co.y for x_ in cur_])
            leg_y = (bhead("calf_l").y + bhead("calf_r").y) / 2
            if md < float(os.environ.get("OUTFIT_LOOSE_NEAR", "0.09")) or (mx < 0.12 and my < leg_y + 0.05):
                # boot pieces: on or between the legs (the back coat panels behind the legs stay)
                gone += cur_
    bmesh.ops.delete(bm, geom=gone, context="VERTS")
    bm.to_mesh(fig.data)
    bm.free()
    fig.data.update()
    V = np.array([v.co[:] for v in fig.data.vertices])
    print("OUTFIT figure boots dropped; loose low pieces", len(gone), "cloth verts", len(V))

# --- weights from the nearest body face (by bone name; Blender's data-transfer mixed the group order up:
# a hem vertex by the foot got spine weights)
fig.name = "Outfit"
bnames = {g.index: g.name for g in body.vertex_groups}
bones = set(b.name for b in arm.data.bones)
BW = []
for v in body.data.vertices:
    gs = [(bnames[g.group], g.weight) for g in v.groups if g.weight > 0.001 and bnames[g.group] in bones]
    BW.append(sorted(gs, key=lambda x: -x[1])[:4])
pm = pbody.data
ARMB = ("clavicle", "upperarm", "lowerarm", "hand", "thumb", "index", "middle", "ring", "pinky", "wrist")
def armish(k):
    return sum(w for n_, w in BW[k] if n_.startswith(ARMB)) > 0.5
arm_poly = [all(armish(k) for k in p.vertices) for p in pm.polygons]
keep_p = [i for i, f in enumerate(arm_poly) if not f]
bvh_na = BVHTree.FromPolygons([v.co.copy() for v in pm.vertices], [list(pm.polygons[i].vertices) for i in keep_p])
ARM_NEAR = float(os.environ.get("OUTFIT_ARM_NEAR", "0.05"))
HIP_Z = float(bhead("thigh_l").z)
LEGB = ("thigh", "calf", "foot", "ball", "bigtoe", "littletoe", "indextoe", "middletoe", "ringtoe")
re_arm = 0
SLEEVE_R = float(os.environ.get("OUTFIT_SLEEVE_R", "0"))
SEG = {}
for s_ in "lr":
    SEG[s_] = [np.array(bhead(f"upperarm_{s_}")), np.array(bhead(f"lowerarm_{s_}")), np.array(bhead(f"hand_{s_}"))]


def seg_t(p, a_, b_):
    ab = b_ - a_
    t = float(np.clip(np.dot(p - a_, ab) / np.dot(ab, ab), 0, 1))
    return t, float(np.linalg.norm(p - (a_ + ab * t)))


def sleeve_w(p):
    best = None
    for s_, (sh, el, wr) in SEG.items():
        tu, du = seg_t(p, sh, el)
        tl, dl = seg_t(p, el, wr)
        for seg, t, dd in (("u", tu, du), ("l", tl, dl)):
            if best is None or dd < best[3]:
                best = (s_, seg, t, dd)
    s_, seg, t, dd = best
    if SLEEVE_R <= 0 or dd > SLEEVE_R or p[2] < HIP_Z + 0.03:   # off by default: rigid sleeves went blocky
        return None
    if seg == "u":
        w = {f"upperarm_{s_}": 1.0}
        if t > 0.8:
            k = (t - 0.8) / 0.2 * 0.5
            w = {f"upperarm_{s_}": 1 - k, f"lowerarm_{s_}": k}
        if t < 0.15:
            k = (0.15 - t) / 0.15 * 0.4
            w = {f"upperarm_{s_}": 1 - k, f"clavicle_{s_}": k}
    else:
        w = {f"lowerarm_{s_}": 1.0}
        if t < 0.2:
            k = (0.2 - t) / 0.2 * 0.5
            w = {f"lowerarm_{s_}": 1 - k, f"upperarm_{s_}": k}
        if t > 0.85:
            k = (t - 0.85) / 0.15 * 0.5
            w = {f"lowerarm_{s_}": 1 - k, f"hand_{s_}": k}
    return w


groups = {}
V = np.array([v.co[:] for v in fig.data.vertices])
for i in range(len(V)):
    if i in COLLAR_V:
        t_ = float(np.clip((V[i][2] - cbot) / max(cback - cbot, 1e-3), 0, 1))
        for n_, w_ in (("neck_01", max(0.0, 1 - 2 * t_)), ("neck_02", 1 - abs(2 * t_ - 1)), ("head", max(0.0, 2 * t_ - 1))):
            if w_ > 0.001:
                groups.setdefault(n_, []).append((i, w_))
        continue
    loc, nrm, fi, d = bvh_b.find_nearest(Vector(V[i]))
    if fi is None:
        continue
    if arm_poly[fi] and d > ARM_NEAR:
        # loose sleeve or coat panel by the hand? decided by the distance to the arm bones, not the skin
        sw = sleeve_w(V[i])
        if sw is not None:
            for n_, w_ in sw.items():
                groups.setdefault(n_, []).append((i, w_))
            continue
        loc, nrm, fj, d = bvh_na.find_nearest(Vector(V[i]))
        fi = keep_p[fj]
        re_arm += 1
    vids = list(pm.polygons[fi].vertices)
    dist = np.array([(pm.vertices[k].co - loc).length for k in vids]) + 1e-5
    iw = (1 / dist) / (1 / dist).sum()
    acc = {}
    for k, wk in zip(vids, iw):
        for n_, w_ in BW[k]:
            acc[n_] = acc.get(n_, 0.0) + w_ * wk
    tot = sum(acc.values())
    # long coat / skirt panels away from the leg: pelvis takes over (a sail from thigh to thigh otherwise)
    in_boot = V[i][2] < SKIN_MIN_Z and d < float(os.environ.get("OUTFIT_BOOT_R", "0.08"))   # bulky boots stay on the leg
    if V[i][2] < HIP_Z and d > 0.03 and not in_boot and any(k_.startswith(LEGB) for k_ in acc):
        a_ = min(0.85, (d - 0.03) / 0.09 * 0.85 + 0.25)
        acc = {k_: w_ * (1 - a_) for k_, w_ in acc.items()}
        acc["pelvis"] = acc.get("pelvis", 0.0) + tot * a_
        tot = sum(acc.values())
    for n_, w_ in sorted(acc.items(), key=lambda x: -x[1])[:4]:
        groups.setdefault(n_, []).append((i, w_ / tot))
for n_, lst in groups.items():
    g = fig.vertex_groups.new(name=n_)
    for i, w_ in lst:
        g.add([i], w_, "REPLACE")
print("OUTFIT vertex groups", len(fig.vertex_groups), "panels kept off the arms", re_arm)
low = {}
for n_, lst in groups.items():
    for i, w_ in lst:
        if V[i][2] < 0.3 and w_ > 0.5:
            low[n_] = low.get(n_, 0) + 1
print("OUTFIT low (boots) main bones", sorted(low.items(), key=lambda x: -x[1])[:8])
for k in ("thigh_l", "calf_l", "foot_l", "thigh_r", "calf_r", "foot_r"):
    print("OUTFIT posed", k, [round(x, 3) for x in bhead(k)], "fig", k.replace("thigh", "hip").replace("calf", "knee").replace("foot", "ankle"), J[k.replace("thigh", "hip").replace("calf", "knee").replace("foot", "ankle")].round(3))

# --- inverse skinning: posed cloth -> rest pose cloth
vl.update()
Mb = {}
for pb in arm.pose.bones:
    Mb[pb.name] = np.array(AW @ pb.matrix @ pb.bone.matrix_local.inverted() @ AWi)
gname = {g.index: g.name for g in fig.vertex_groups}
V = np.array([v.co[:] for v in fig.data.vertices])
R = np.empty_like(V)
for i, v in enumerate(fig.data.vertices):
    M = np.zeros((4, 4))
    tw_ = 0.0
    for g in v.groups:
        n = gname[g.group]
        if n in Mb and g.weight > 0:
            M += Mb[n] * g.weight
            tw_ += g.weight
    if tw_ < 1e-6:
        R[i] = V[i]
        continue
    M /= tw_
    R[i] = (np.linalg.inv(M) @ np.append(V[i], 1.0))[:3]
lowi = np.argsort(V[:, 2])[:3].tolist() + [int(np.argmax(V[:, 2]))]
for i in lowi:
    v = fig.data.vertices[i]
    gs = sorted(((gname[g.group], round(g.weight, 3)) for g in v.groups), key=lambda x: -x[1])[:4]
    print("OUTFIT dbg", V[i].round(3), "->", R[i].round(3), gs)
print("OUTFIT before inverse z", round(float(V[:, 2].min()), 3), round(float(V[:, 2].max()), 3))
fig.data.vertices.foreach_set("co", R.ravel())
fig.data.update()
# webbing: faces joining the arm to the side in the figure (arms hanging against the body) stretch into wings when
# the arm opens to the A pose -> drop faces with an edge grown over OUTFIT_STRETCH x (and longer than 2 cm)
STR = float(os.environ.get("OUTFIT_STRETCH", "2.5"))
bm = bmesh.new()
bm.from_mesh(fig.data)
bm.verts.ensure_lookup_table()
bad = []
for f in bm.faces:
    for e in f.edges:
        a_, b_ = e.verts[0].index, e.verts[1].index
        l0 = np.linalg.norm(V[a_] - V[b_])
        l1 = np.linalg.norm(R[a_] - R[b_])
        if l1 > 0.02 and l1 > STR * max(l0, 1e-4):
            bad.append(f)
            break
bmesh.ops.delete(bm, geom=bad, context="FACES")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bm.to_mesh(fig.data)
bm.free()
fig.data.update()
print("OUTFIT stretched faces dropped", len(bad), "| verts above 1.45 before/after inverse:", int((V[:, 2] > 1.45).sum()), int((R[:, 2] > 1.45).sum()))
if os.environ.get("OUTFIT_DEBUG"):
    _V = np.array([v.co[:] for v in fig.data.vertices])
    _m = (_V[:, 2] > 0.1) & (_V[:, 2] < 0.35)
    print("OUTFIT trace rest shaft verts", int(_m.sum()), "x|y mean", np.abs(_V[_m, 0]).mean().round(3) if _m.any() else 0, _V[_m, 1].mean().round(3) if _m.any() else 0)
for pb in arm.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
vl.update()
# parent to the armature (world coords kept), armature modifier
fig.data.transform(AWi)
fig.parent = arm
fig.matrix_parent_inverse = Matrix.Identity(4)
fig.matrix_world = AW.copy()
am = fig.modifiers.new("Armature", "ARMATURE")
am.object = arm
bpy.data.objects.remove(pbody, do_unlink=True)
vl.update()
print("OUTFIT rest verts z", round(float(R[:, 2].min()), 3), round(float(R[:, 2].max()), 3))

# --- lining: a thin dark layer over the torso and arms (the figure has no cloth where its hair hid the back)
if os.environ.get("OUTFIT_LINING", "1") == "1":
    lin = body.copy()
    lin.data = body.data.copy()
    lin.name = "Lining"
    sc.collection.objects.link(lin)
    LB = ("spine", "clavicle", "upperarm", "lowerarm", "pelvis", "neck")
    bn_ = {g.index: g.name for g in lin.vertex_groups}
    keepv = set()
    for v in lin.data.vertices:
        w_ = sum(g.weight for g in v.groups if bn_[g.group].startswith(LB) and (os.environ.get("OUTFIT_LINING_NECK") == "1" or not bn_[g.group].startswith("neck_02")))
        if w_ > float(os.environ.get("OUTFIT_LINING_W", "0.6")):
            keepv.add(v.index)
    bm = bmesh.new()
    bm.from_mesh(lin.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(v.index in keepv for v in f.verts)], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.normal_update()
    off_ = float(os.environ.get("OUTFIT_LINING_GAP", "0.002")) / AW.to_scale()[0]
    for v in bm.verts:
        v.co += v.normal * off_
    bm.to_mesh(lin.data)
    bm.free()
    lin.data.materials.clear()
    lm_ = bpy.data.materials.new("M_Lining")
    lm_.use_nodes = True
    lm_.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.012, 0.011, 0.012, 1)
    lm_.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.55
    lin.data.materials.append(lm_)
    print("OUTFIT lining verts", len(lin.data.vertices))
else:
    lin = None

# --- boots from the body: lower leg + foot below BOOT_TOP, 5 mm out, black leather (off when a boot part is merged)
if BOOT_TOP > 0 and os.environ.get("OUTFIT_BODY_BOOTS", "1") == "1":
    bt = body.copy()
    bt.data = body.data.copy()
    bt.name = "Boots"
    sc.collection.objects.link(bt)
    Wz = np.array([list(bt.matrix_world @ v.co) for v in bt.data.vertices])[:, 2]
    bm = bmesh.new()
    bm.from_mesh(bt.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(Wz[v.index] < BOOT_TOP for v in f.verts)], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.normal_update()
    off_ = float(os.environ.get("OUTFIT_BOOT_GAP", "0.005")) / AW.to_scale()[0]
    for v in bm.verts:
        v.co += v.normal * off_
    bm.to_mesh(bt.data)
    bm.free()
    bt.data.materials.clear()
    bm_m = bpy.data.materials.new("M_Boots")
    bm_m.use_nodes = True
    bm_m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.01, 0.009, 0.009, 1)
    bm_m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.35
    bt.data.materials.append(bm_m)
    print("OUTFIT boots verts", len(bt.data.vertices))
else:
    bt = None
if os.environ.get("OUTFIT_GLOVES", "0") == "1":
    gl = body.copy()
    gl.data = body.data.copy()
    gl.name = "Gloves"
    sc.collection.objects.link(gl)
    gn_ = {g.index: g.name for g in gl.vertex_groups}
    HANDB = ("hand", "thumb", "index", "middle", "ring", "pinky", "wrist")
    keepg = set()
    for v in gl.data.vertices:
        if sum(g.weight for g in v.groups if gn_[g.group].startswith(HANDB)) > 0.5:
            keepg.add(v.index)
    bm = bmesh.new()
    bm.from_mesh(gl.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(v.index in keepg for v in f.verts)], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.normal_update()
    off_ = 0.0012 / AW.to_scale()[0]
    for v in bm.verts:
        v.co += v.normal * off_
    bm.to_mesh(gl.data)
    bm.free()
    gl.data.materials.clear()
    gl.data.materials.append(bpy.data.materials.get("M_Boots") or bpy.data.materials.new("M_Boots"))
    print("OUTFIT gloves verts", len(gl.data.vertices))
else:
    gl = None

# --- preview: rest pose, body + cloth, front and side
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.color_type = "TEXTURE"
sc.display.shading.light = "STUDIO"
sc.render.resolution_x, sc.render.resolution_y = 1200, 1000
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = 2.0
for tag, loc, rot in (("front", (0, -5, 0.9), (math.pi / 2, 0, 0)), ("side", (5, 0, 0.9), (math.pi / 2, 0, math.pi / 2)),
                      ("back", (0, 5, 0.9), (math.pi / 2, 0, math.pi))):
    cam.location, cam.rotation_euler = Vector(loc), rot
    sc.render.filepath = PREV.replace(".png", f"_{tag}.png")
    bpy.ops.render.render(write_still=True)

# pose test: arm raised and bent, a leg forward, the chest turned (how the cloth follows)
POSE = {"upperarm_l": ((0, 1, 0), -50), "lowerarm_l": ((0, 0, 1), 45), "upperarm_r": ((0, 1, 0), 20),
        "thigh_r": ((1, 0, 0), 35), "calf_r": ((1, 0, 0), -45), "thigh_l": ((1, 0, 0), -15), "spine_03": ((0, 0, 1), 15)}
for bn, (ax, deg) in POSE.items():
    pb = arm.pose.bones.get(bn)
    if pb:
        Rn = AW.to_3x3().normalized()
        q = Matrix.Rotation(math.radians(deg), 4, Vector(ax))
        R = (Rn.inverted().to_4x4() @ q @ Rn.to_4x4())
        h = pb.head.copy()
        pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix
        vl.update()
for tag, loc, rot in (("pose_front", (0, -5, 0.9), (math.pi / 2, 0, 0)), ("pose_side", (5, 0, 0.9), (math.pi / 2, 0, math.pi / 2))):
    cam.location, cam.rotation_euler = Vector(loc), rot
    sc.render.filepath = PREV.replace(".png", f"_{tag}.png")
    bpy.ops.render.render(write_still=True)
for pb in arm.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
vl.update()

bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
fig.select_set(True)
if lin:
    lin.select_set(True)
if bt:
    bt.select_set(True)
if gl:
    gl.select_set(True)
bpy.data.objects.remove(body, do_unlink=True)
bpy.ops.export_scene.fbx(filepath=os.path.abspath(OUT), use_selection=True, object_types={"ARMATURE", "MESH"},
                         add_leaf_bones=False, mesh_smooth_type="FACE", path_mode="COPY", embed_textures=True)
print("OUTFIT out", OUT)
