"""Hair cards from the design hair shape (doc 177 §22): the placed Hi3D hair mesh (place_on_state.py output, in the
built character's frame) is the shape; thin textured ribbons are laid over it from the crown down, two or three
layers deep. Cards render on phones (MetaHuman's own mobile hair LODs are cards).

blender -b -P tools/metahuman/make_hair_cards.py -- hair_placed.fbx out_cards.fbx preview.png
env: CARDS_N (seed strands, 700), CARDS_W (card width m, 0.022), CARDS_LAYERS (offsets mm, "1.5,5,9"),
     CARDS_RGB (strand colour, "0.03,0.028,0.03"), CARDS_STEP (m, 0.012)

1. seeds spread over the hair shell (area weighted); each seed traced UP to the crown and DOWN to the tip along the
   surface (gravity projected on the tangent plane, snapped back onto the shell each step)
2. each strand -> a ribbon: width tapering to the tip, facing out of the shell, one per layer at an offset
3. UV: u across, v root -> tip. The texture: thin strands with alpha (written next to the FBX as _cards.png)
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

a = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT, PREVIEW = a[0], a[1], a[2] if len(a) > 2 else None
N = int(os.environ.get("CARDS_N", "700"))
WID = float(os.environ.get("CARDS_W", "0.022"))
LAYERS = [float(x) / 1000 for x in os.environ.get("CARDS_LAYERS", "1.5,5,9").split(",")]
RGB = [float(x) for x in os.environ.get("CARDS_RGB", "0.03,0.028,0.03").split(",")]
STEP = float(os.environ.get("CARDS_STEP", "0.012"))
rng = np.random.default_rng(7)

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
cap = next((o for o in meshes if "cap" in o.name.lower()), None)
shell = max((o for o in meshes if o is not cap), key=lambda o: len(o.data.vertices))
from mathutils import Matrix  # noqa: E402
if max(v.co.z for v in shell.data.vertices) > 10:
    for o in meshes:
        o.data.transform(Matrix.Scale(0.01, 4))
bvh = BVHTree.FromObject(shell, bpy.context.evaluated_depsgraph_get())
V = np.array([v.co[:] for v in shell.data.vertices])
crown, bottom = V[:, 2].max(), V[:, 2].min()
cx, cy = (V[:, 0].max() + V[:, 0].min()) / 2, (V[:, 1].max() + V[:, 1].min()) / 2
print("CARDS shell verts", len(V), "crown", round(crown, 3), "bottom", round(bottom, 3))

# seeds: area weighted points on the shell, outward-facing ones only (the shell is two-sided clumps)
bm = bmesh.new()
bm.from_mesh(shell.data)
bmesh.ops.triangulate(bm, faces=bm.faces)
tris = [[v.co.copy() for v in f.verts] for f in bm.faces]
bm.free()
areas = np.array([((t[1] - t[0]).cross(t[2] - t[0])).length / 2 for t in tris])
pick = rng.choice(len(tris), size=N * 3, p=areas / areas.sum())
seeds = []
for i in pick:
    t = tris[i]
    r1, r2 = rng.random(), rng.random()
    if r1 + r2 > 1:
        r1, r2 = 1 - r1, 1 - r2
    p = t[0] + (t[1] - t[0]) * r1 + (t[2] - t[0]) * r2
    out = Vector((p.x - cx, p.y - cy, max(0.0, p.z - (crown - 0.10)) * 0.5)).normalized()
    loc, nrm, _i, _d = bvh.find_nearest(p)
    if nrm is not None and nrm.dot(out) > 0.1:      # outer side of the hair
        seeds.append(p)
    if len(seeds) >= N:
        break
print("CARDS seeds", len(seeds))


def snap(p):
    loc, nrm, _i, d = bvh.find_nearest(p)
    return loc, nrm, d


def trace(p0, sign):
    """sign -1: down to the tip, +1: up to the root. Steps along gravity projected on the surface tangent plane."""
    pts = [p0.copy()]
    p = p0.copy()
    prev = None
    for _ in range(int(1.2 / STEP)):
        loc, nrm, d = snap(p)
        if loc is None or d > 0.02:
            break
        g = Vector((0, 0, sign))
        if sign > 0:        # up: towards the crown centre once above the ears
            g = (Vector((cx, cy, crown)) - p).normalized()
        t = g - nrm * g.dot(nrm)
        if t.length < 1e-4:
            break
        t.normalize()
        if prev is not None:
            t = (t + prev * 0.6).normalized()
        q = p + t * STEP
        loc2, nrm2, d2 = snap(q)
        if loc2 is None:
            break
        q = loc2
        if (q - p).length < STEP * 0.25:      # stuck at an edge (the tip / the crown)
            break
        if sign < 0 and q.z > p.z - STEP * 0.15:
            break
        if sign > 0 and q.z >= crown - 0.004:
            pts.append(q)
            break
        pts.append(q)
        prev = (q - p).normalized()
        p = q
    return pts


strands = []
for s in seeds:
    up = trace(s, +1)
    dn = trace(s, -1)
    pts = list(reversed(up[1:])) + dn
    if len(pts) >= 3:
        strands.append(pts)
print("CARDS strands", len(strands), "mean pts", round(np.mean([len(s) for s in strands]), 1))

# ribbons
me = bpy.data.meshes.new("Cards")
verts, faces, uvs = [], [], []
for li, off in enumerate(LAYERS):
    for si, pts in enumerate(strands):
        if li > 0 and rng.random() < 0.25:
            continue
        n_ = len(pts)
        u0 = rng.random() * 0.75                 # which strip of the texture this card uses
        jitter = Vector(rng.normal(0, 0.002, 3))
        base = len(verts)
        for k, p in enumerate(pts):
            loc, nrm, d = snap(p)
            nrm = nrm if nrm is not None else Vector((0, 0, 1))
            t = (pts[min(k + 1, n_ - 1)] - pts[max(k - 1, 0)])
            t = t.normalized() if t.length > 1e-6 else Vector((0, 0, -1))
            b = nrm.cross(t).normalized()
            frac = k / (n_ - 1)
            w = WID * (1.0 - 0.65 * frac ** 1.5) * (0.8 + 0.4 * rng.random() if k == 0 else 1.0)
            c = p + nrm * off + jitter
            verts.append(c - b * w / 2)
            verts.append(c + b * w / 2)
            uvs.append((u0, frac))
            uvs.append((u0 + 0.25, frac))
            if k > 0:
                i0 = base + 2 * (k - 1)
                faces.append((i0, i0 + 1, i0 + 3, i0 + 2))
me.from_pydata([tuple(v) for v in verts], [], faces)
me.update()
uvl = me.uv_layers.new(name="UVMap")
for poly in me.polygons:
    for li_ in poly.loop_indices:
        uvl.data[li_].uv = uvs[me.loops[li_].vertex_index]
cards = bpy.data.objects.new("HairCards", me)
sc.collection.objects.link(cards)
print("CARDS ribbons verts", len(verts), "quads", len(faces), "tris", 2 * len(faces))

# strand texture: 1024 x 2048, RGBA - many thin strands, brightness jitter, alpha tapering at the tip
TW, TH = 1024, 2048
img_a = np.zeros((TH, TW), np.float32)
img_c = np.zeros((TH, TW), np.float32)
ys = np.linspace(0, 1, TH)[:, None]
for _ in range(int(os.environ.get("CARDS_STRANDS", "260"))):   # 900 was nearly opaque (mean alpha 0.58)
    x = rng.random() * TW
    wpx = 0.9 + rng.random() * 1.2
    length = 0.55 + 0.45 * rng.random()
    wav = rng.normal(0, 2.0) * np.sin(ys * (2 + rng.random() * 4) * math.pi + rng.random() * 6)
    xs = np.arange(TW)[None, :]
    dist = np.abs(xs - (x + wav))
    prof = np.clip(1 - dist / wpx, 0, 1)
    tip = np.clip((length - ys) / 0.12, 0, 1)
    a_ = prof * tip
    img_a = np.maximum(img_a, a_)
    img_c = np.maximum(img_c, a_ * (0.6 + 0.8 * rng.random()))
rgb = np.array(RGB)[None, None, :] * (0.55 + 0.9 * img_c[..., None])
rgba = np.concatenate([np.clip(rgb, 0, 1), img_a[..., None]], -1)
tex = bpy.data.images.new("HairCardsTex", TW, TH, alpha=True)
tex.pixels = rgba[::-1].ravel()          # Blender images start at the bottom row (v = 0 at the root here)
tex_path = os.path.splitext(os.path.abspath(OUT))[0] + "_cards.png"
tex.filepath_raw = tex_path
tex.file_format = "PNG"
tex.save()
mat = bpy.data.materials.new("HairCardsMat")
mat.use_nodes = True
nt = mat.node_tree
tn = nt.nodes.new("ShaderNodeTexImage")
tn.image = tex
bsdf = nt.nodes["Principled BSDF"]
nt.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(tn.outputs["Alpha"], bsdf.inputs["Alpha"])
me.materials.append(mat)
print("CARDS texture", tex_path)

if PREVIEW:
    shell.hide_render = True
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 1200, 800
    sc.world = bpy.data.worlds.new("w")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.6, 0.6, 0.62, 1)
    cam = bpy.data.objects.new("c", bpy.data.cameras.new("c"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = (crown - bottom) * 1.5
    zc = (crown + bottom) / 2
    for tag, loc, rot in (("f", (cx, cy - 2, zc), (math.pi / 2, 0, 0)), ("b", (cx, cy + 2, zc), (math.pi / 2, 0, math.pi))):
        cam.location, cam.rotation_euler = Vector(loc), rot
        sc.render.filepath = PREVIEW.replace(".png", f"_{tag}.png")
        bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action="DESELECT")
cards.select_set(True)
if cap:
    cap.select_set(True)
bpy.data.objects.remove(shell, do_unlink=True)
bpy.ops.export_scene.fbx(filepath=os.path.abspath(OUT), use_selection=True, object_types={"MESH"}, apply_unit_scale=True,
                         axis_forward="-Y", axis_up="Z", mesh_smooth_type="FACE")
print("CARDS out", OUT)
