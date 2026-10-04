"""The strand hair as a mesh for phones (docs/design/184 §5): the mobile renderer draws no hair strands
(r.HairStrands.Strands 0 on Android: the MetaHuman stood bald on the tablet), so the same curves the groom is made of
(make_hair_groom.py -> Alembic) become thin ribbons, one per picked strand, facing out from the head.

blender -b -P tools/metahuman/groom_to_mesh.py -- groom.abc out.fbx [count=3000] [root_width_mm=7]
Each ribbon: the strand's points every other one, width from root_width at the root to 20 % at the tip, turned
across the strand and the line from the head centre (so it shows its face to a camera around the head), pushed
1 mm outwards. The FBX lands where the groom lands (same Blender scene space, default UE FBX axis conversion).
"""
import os
import sys

import bpy
import numpy as np

a = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = a[0], a[1]
COUNT = int(a[2]) if len(a) > 2 else 3000
W0 = (float(a[3]) if len(a) > 3 else 7.0) / 1000.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.alembic_import(filepath=SRC)
objs = [o for o in bpy.context.scene.objects if o.type in ("CURVES", "CURVE")]
assert objs, "no curves in " + SRC
strands = []
for o in objs:
    M = np.array(o.matrix_world)
    own = []
    if o.type == "CURVES":
        pos = np.array([p.position[:] for p in o.data.points])
        offs = [c.first_point_index for c in o.data.curves] + [len(pos)]
        for i in range(len(offs) - 1):
            own.append(pos[offs[i]:offs[i + 1]])
    else:
        for sp in o.data.splines:
            pts = sp.points if len(sp.points) else sp.bezier_points
            own.append(np.array([p.co[:3] for p in pts]))
    strands += [(np.c_[s_, np.ones(len(s_))] @ M.T)[:, :3] for s_ in own]   # world space
print("STRANDS", len(strands))
rng = np.random.default_rng(3)
pick = rng.choice(len(strands), size=min(COUNT, len(strands)), replace=False)
roots = np.array([s[0] for s in strands])
centre = roots.mean(0) - np.array([0.0, 0.0, 0.07])   # under the crown: radial = out of the head
verts, faces = [], []
for k in pick:
    s = strands[k][::2]
    if len(s) < 3:
        continue
    n = len(s)
    for i in range(n):
        t = s[min(i + 1, n - 1)] - s[max(i - 1, 0)]
        t /= max(np.linalg.norm(t), 1e-9)
        r = s[i] - centre
        r /= max(np.linalg.norm(r), 1e-9)
        side = np.cross(t, r)
        side /= max(np.linalg.norm(side), 1e-9)
        u = i / (n - 1)
        w = W0 * (1.0 - 0.8 * u)
        p = s[i] + r * 0.001
        verts += [p - side * w * 0.5, p + side * w * 0.5]
        if i:
            b = len(verts) - 4
            faces += [(b, b + 1, b + 3), (b, b + 3, b + 2)]
me = bpy.data.meshes.new("HairMobile")
me.from_pydata([tuple(v) for v in verts], [], faces)
me.update()
ob = bpy.data.objects.new("HairMobile", me)
bpy.context.scene.collection.objects.link(ob)
mat = bpy.data.materials.new("M_HairMobile")
me.materials.append(mat)
for o in objs:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True)
bpy.context.view_layer.objects.active = ob
bpy.ops.export_scene.fbx(filepath=OUT, use_selection=True, object_types={"MESH"}, apply_unit_scale=True, mesh_smooth_type="FACE")
print("HAIRMESH", OUT, "ribbons", len(pick), "verts", len(verts), "tris", len(faces))
