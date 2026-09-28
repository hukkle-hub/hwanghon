# 리깅한 몸이 클립에서 얼마나 늘어나는가 — 모서리 길이 (변형 / 기본) 비율. 텍스처가 늘어져 보이는 곳을 숫자로 찾는다.
#   blender -b -P tools/3d/measure_stretch.py -- <rigged.glb> [samples]
import bpy, sys
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
SRC = argv[0]; N = int(argv[1]) if len(argv) > 1 else 12
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
me = body.data
E = np.array([e.vertices[:] for e in me.edges])
arm.data.pose_position = 'REST'
bpy.context.view_layer.update()
def coords():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg); m = ev.to_mesh()
    c = np.array([v.co[:] for v in m.vertices]); ev.to_mesh_clear(); return c
rest = coords(); L0 = np.linalg.norm(rest[E[:, 0]] - rest[E[:, 1]], axis=1); ok = L0 > 1e-5
# seam twins: vertices on the same spot at rest (split at UV seams) - their gap in motion is a visible crack
_, same = np.unique(np.round(rest / 1e-5).astype(np.int64), axis=0, return_inverse=True); same = same.ravel()
twin = np.bincount(same)[same] > 1
# near pairs across pieces (within 1.5 cm at rest, not joined by an edge): how far they drift apart = a crack
from mathutils.kdtree import KDTree
kd = KDTree(len(rest))
for i, p in enumerate(rest): kd.insert(p, i)
kd.balance()
edgeset = set(map(tuple, np.sort(E, axis=1)))
NP = np.array([(i, j) for i in range(len(rest)) for (_, j, _) in kd.find_range(rest[i], 0.015) if j > i and (i, j) not in edgeset] or [(0, 0)])
D0 = np.linalg.norm(rest[NP[:, 0]] - rest[NP[:, 1]], axis=1)
# dominant bone per vertex
groups = {g.index: g.name for g in body.vertex_groups}
dom = np.full(len(me.vertices), -1)
for v in me.vertices:
    if v.groups:
        g = max(v.groups, key=lambda x: x.weight); dom[v.index] = g.group
arm.data.pose_position = 'POSE'
arm.animation_data_create()
sc = bpy.context.scene
for act in sorted(bpy.data.actions, key=lambda a: a.name):
    arm.animation_data.action = act
    if hasattr(arm.animation_data, 'action_slot') and act.slots: arm.animation_data.action_slot = act.slots[0]
    f0, f1 = act.frame_range; worst = 1.0; bad = 0.0; where = {}; gap = 0.0
    for k in range(N):
        sc.frame_set(int(f0 + (f1 - f0) * k / max(1, N - 1)))
        c = coords(); L = np.linalg.norm(c[E[:, 0]] - c[E[:, 1]], axis=1)
        if twin.any():
            cen = np.zeros((same.max() + 1, 3)); np.add.at(cen, same, c); cen /= np.bincount(same)[:, None]
            gap = max(gap, float(np.linalg.norm(c[twin] - cen[same[twin]], axis=1).max()) * 2)
        crack = float(np.percentile(np.linalg.norm(c[NP[:, 0]] - c[NP[:, 1]], axis=1) - D0, 99.9))
        gap = max(gap, crack)
        r = np.where(ok, L / np.maximum(L0, 1e-9), 1.0)
        worst = max(worst, float(np.percentile(r, 99.9))); frac = float((r > 2.0).mean()); bad = max(bad, frac)
        for vi in E[r > 2.0][:, 0]:
            n = groups.get(dom[vi], '-'); where[n] = where.get(n, 0) + 1
    top = sorted(where.items(), key=lambda x: -x[1])[:3]
    print(f'[stretch] {act.name:12s} p99.9 x{worst:.2f}  edges>2x {100*bad:.2f}%  seam gap {gap*100:.1f} cm  where {top}')
