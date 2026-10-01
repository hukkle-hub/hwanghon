"""Cut the face out of a fused Hi3D hero (docs/design/177): the conform target for a MetaHuman head.
Keeps the triangles around the head bone, drops the ones whose texture is dark (hair, scarf, brows) so the
cranium shape comes from the skin only. Writes an FBX in centimetres, Z up, facing -Y (as the GLB stands).

blender -b -P tools/3d/extract_face.py -- art/3d/heroes/ain.glb out.fbx [dark=0.18]
"""
import os
import sys

import bmesh
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = args[0], args[1]
DARK = float(args[2]) if len(args) > 2 else 0.18

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(SRC))
sc = bpy.context.scene
mesh = max((o for o in sc.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
# the head from the mesh itself: Hi3D's skeleton sits lower than the body (neck bone at 1.15 m on a 1.68 m mesh)
mw = mesh.matrix_world
zs = sorted((mw @ v.co).z for v in mesh.data.vertices)
lo, top = zs[0], zs[-1]
stature = top - lo
neck_z = top - stature * 0.155
band = [mw @ v.co for v in mesh.data.vertices if (mw @ v.co).z > neck_z]
head_c = Vector((sum(p.x for p in band) / len(band), sum(p.y for p in band) / len(band), top - stature * 0.065))
R = stature * 0.11
print("FACE head", head_c, "neck_z", round(neck_z, 3), "R", round(R, 3), "stature", round(stature, 3))

# texture to sample (base color of the first material)
img = None
for slot in mesh.material_slots:
    if slot.material and slot.material.use_nodes:
        for n in slot.material.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                img = n.image
                break
    if img:
        break
W, H = img.size
px = list(img.pixels[:])


def lum(u, v):
    x = min(W - 1, max(0, int((u % 1.0) * W)))
    y = min(H - 1, max(0, int((v % 1.0) * H)))
    i = (y * W + x) * 4
    return 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]


bpy.context.view_layer.objects.active = mesh
bm = bmesh.new()
bm.from_mesh(mesh.data)
uvl = bm.loops.layers.uv.active
kill = []
kept = 0
for f in bm.faces:
    c = mw @ f.calc_center_median()
    if (c - head_c).length > R or c.z < neck_z:
        kill.append(f)
        continue
    l = sum(lum(*lp[uvl].uv) for lp in f.loops) / len(f.loops)
    if l < DARK:
        kill.append(f)
        continue
    kept += 1
bmesh.ops.delete(bm, geom=kill, context="FACES")
# drop little islands (stray skin specks inside the hair)
bm.verts.ensure_lookup_table()
islands, seen = [], set()
for v in bm.verts:
    if v.index in seen:
        continue
    stack, comp = [v], []
    seen.add(v.index)
    while stack:
        a = stack.pop()
        comp.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen:
                seen.add(b.index)
                stack.append(b)
    islands.append(comp)
islands.sort(key=len, reverse=True)
small = [v for comp in islands[1:] for v in comp if len(comp) < 200]
bmesh.ops.delete(bm, geom=small, context="VERTS")
bm.to_mesh(mesh.data)
bm.free()
print("FACE kept faces", kept, "islands", len(islands), "largest", len(islands[0]) if islands else 0)

for o in list(sc.objects):
    if o is not mesh:
        bpy.data.objects.remove(o, do_unlink=True)
mesh.modifiers.clear()
mesh.parent = None
mesh.matrix_world = mw
# head centred at the origin's x/y, the neck at z=0: the conform aligns scale/rotation/translation itself
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for v in mesh.data.vertices:
    v.co.x -= head_c.x
    v.co.y -= head_c.y
    v.co.z -= neck_z
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
# the texture as its own PNG: the FBX's embedded texture did not come through the UE import (grey material)
img.filepath_raw = os.path.splitext(os.path.abspath(OUT))[0] + "_albedo.png"
img.file_format = "PNG"
img.save()
print("FACE albedo", img.filepath_raw)
bpy.ops.export_scene.fbx(filepath=os.path.abspath(OUT), use_selection=True, object_types={"MESH"},
                         apply_unit_scale=True, axis_forward="-Y", axis_up="Z", path_mode="COPY", embed_textures=True)
pts = [v.co for v in mesh.data.vertices]
print("FACE out", OUT, "verts", len(pts), "z", round(min(p.z for p in pts), 3), round(max(p.z for p in pts), 3))
