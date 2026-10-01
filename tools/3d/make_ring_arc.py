"""SM_HW_RingArc source: a flat 270-degree arc, radius 100 cm, 4 cm wide, UV u along the arc (0 tail -> 1 head),
v across (docs/design/174). The spin skills draw 3 of these turning around the hero (Crimson Desert study, doc 173).
blender -b -P tools/3d/make_ring_arc.py -- art/fx/ring_arc.fbx
"""
import math
import sys

import bmesh
import bpy

out = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.scale_length = 0.01   # 1 unit = 1 cm in the FBX
me = bpy.data.meshes.new("ring_arc")
bm = bmesh.new()
uv = bm.loops.layers.uv.new()
N, R, W, SPAN = 48, 100.0, 4.0, math.radians(270)
rows = []
for i in range(N + 1):
    a = SPAN * i / N
    rows.append((bm.verts.new((math.cos(a) * (R - W / 2), math.sin(a) * (R - W / 2), 0)),
                 bm.verts.new((math.cos(a) * (R + W / 2), math.sin(a) * (R + W / 2), 0))))
for i in range(N):
    f = bm.faces.new((rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]))
    for loop in f.loops:
        j = next(k for k in (i, i + 1) if loop.vert in rows[k])
        loop[uv].uv = (j / N, 0.0 if loop.vert is rows[j][0] else 1.0)
bm.to_mesh(me)
bm.free()
ob = bpy.data.objects.new("SM_HW_RingArc", me)
bpy.context.scene.collection.objects.link(ob)
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
bpy.ops.export_scene.fbx(filepath=out, use_selection=True, object_types={"MESH"}, apply_unit_scale=True, global_scale=1.0)
print("RING_ARC", out)
