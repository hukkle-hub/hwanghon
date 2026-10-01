"""Hi3D bald bust -> MetaHuman conform target (docs/design/177): head + neck only, real size, centred.
Cuts at the neck (the narrowest slice in the lower half, plus a margin down), scales crown-to-cut to HEIGHT cm,
puts the neck cut at z=0 and the head on x/y 0, faces -Y (as Hi3D exports). Writes GLB (textures kept) + the albedo PNG.
blender -b -P tools/3d/prep_head.py -- in.glb out.glb [height_cm=27]
"""
import os
import sys

import bmesh
import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = a[0], a[1]
HEIGHT = float(a[2]) / 100.0 if len(a) > 2 else 0.27
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
