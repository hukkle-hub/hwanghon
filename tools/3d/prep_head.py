"""Hi3D bald bust -> MetaHuman conform target (docs/design/177): head + neck only, real size, centred.
Cuts at the neck (the narrowest slice in the lower half, plus a margin down), scales crown-to-cut to HEIGHT cm,
puts the neck cut at z=0 and the head on x/y 0, faces -Y (as Hi3D exports). Writes GLB (textures kept) + the albedo PNG.
blender -b -P tools/3d/prep_head.py -- in.glb out.glb [height_cm=27] [dark_back=0]
dark_back > 0: faces on the back half whose texture is darker than this go first (Hi3D sometimes leaves a black
ponytail stuck to a bald head - Sera v2), then the loose bits.
"""
import os
import sys

import bmesh
import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = a[0], a[1]
HEIGHT = float(a[2]) / 100.0 if len(a) > 2 else 0.27
DARK_BACK = float(a[3]) if len(a) > 3 else 0.0
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(SRC))
sc = bpy.context.scene
meshes = [o for o in sc.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
m = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if DARK_BACK > 0:
    tex = next((nd.image for sl in m.material_slots if sl.material and sl.material.use_nodes
                for nd in sl.material.node_tree.nodes if nd.type == "TEX_IMAGE" and nd.image), None)
    tw, th = tex.size
    px = tex.pixels[:]

    def lum(u, v):
        x = min(tw - 1, max(0, int((u % 1.0) * tw)))
        y = min(th - 1, max(0, int((v % 1.0) * th)))
        i = (y * tw + x) * 4
        return 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]

    bm = bmesh.new()
    bm.from_mesh(m.data)
    uvl = bm.loops.layers.uv.active
    ys = [v.co.y for v in bm.verts]
    ymid = (max(ys) + min(ys)) / 2
    kill = [f for f in bm.faces if f.calc_center_median().y > ymid
            and sum(lum(*lp[uvl].uv) for lp in f.loops) / len(f.loops) < DARK_BACK]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    # keep the biggest connected piece only (weld the UV seams first: Hi3D splits the head down the middle)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
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
    bmesh.ops.delete(bm, geom=[v for c in comps[1:] for v in c], context="VERTS")
    bm.to_mesh(m.data)
    bm.free()
    print("HEAD dark back faces removed", len(kill), "pieces dropped", len(comps) - 1)
vs = [v.co.copy() for v in m.data.vertices]
top = max(v.z for v in vs)
bot = min(v.z for v in vs)
H = top - bot
# narrowest slice (x extent) between 15% and 55% of the height from the bottom: the neck
best, best_z = 1e9, None
for i in range(40):
    z0 = bot + H * (0.15 + 0.40 * i / 40)
    sl = [v.x for v in vs if abs(v.z - z0) < H * 0.01]
    if len(sl) < 20:
        continue
    w = max(sl) - min(sl)
    if w < best:
        best, best_z = w, z0
cut = best_z - H * 0.04
bm = bmesh.new()
bm.from_mesh(m.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if max(v.co.z for v in f.verts) < cut], context="FACES")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bm.to_mesh(m.data)
bm.free()
vs = [v.co.copy() for v in m.data.vertices]
cx = (max(v.x for v in vs) + min(v.x for v in vs)) / 2
cy = (max(v.y for v in vs) + min(v.y for v in vs)) / 2
s = HEIGHT / (top - cut)
for v in m.data.vertices:
    v.co = Vector(((v.co.x - cx) * s, (v.co.y - cy) * s, (v.co.z - cut) * s))
# ~30k triangles: the conform solver needs shape, not 470k scan vertices
dec = m.modifiers.new("dec", "DECIMATE")
dec.ratio = min(1.0, 60000.0 / max(1, len(m.data.polygons)))
bpy.context.view_layer.objects.active = m
bpy.ops.object.modifier_apply(modifier="dec")
for o in list(sc.objects):
    if o is not m:
        bpy.data.objects.remove(o, do_unlink=True)
img = None
for slot in m.material_slots:
    if slot.material and slot.material.use_nodes:
        for n in slot.material.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and "base" in (n.label + n.name + n.image.name).lower() or (n.type == "TEX_IMAGE" and img is None and n.image):
                img = n.image if img is None else img
if img:
    img.filepath_raw = os.path.splitext(os.path.abspath(OUT))[0] + "_albedo.png"
    img.file_format = "PNG"
    img.save()
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", use_selection=False, export_image_format="JPEG")
print("HEAD verts", len(m.data.vertices), "neck width", round(best * s, 3), "scale", round(s, 4), "albedo", img.filepath_raw if img else None)
