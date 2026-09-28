# 리깅된 GLB 의 무게를 이웃 평균으로 부드럽게 편다 (뼈·클립 그대로). 겨드랑이·가랑이처럼 경계가 급한 곳의 늘어남을 줄인다.
#   blender -b -P tools/3d/smooth_skin.py -- <in.glb> <out.glb> [rounds=6]
import bpy, sys
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]; R = int(argv[2]) if len(argv) > 2 else 6
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = max((o for o in bpy.data.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
vs = body.data.vertices; G = body.vertex_groups
W = np.zeros((len(vs), len(G)))
for v in vs:
    for g in v.groups: W[v.index, g.group] = g.weight
lock = np.array([not g.name.startswith('mixamorig:') for g in G])   # helper groups untouched
E = np.array([e.vertices[:] for e in body.data.edges]); deg = np.bincount(E.ravel(), minlength=len(vs)).astype(float)
# vertices split at UV seams sit on the same spot with no edge between them: they must keep equal weights or the
# seam opens (white cracks in the game, doc 151 §2.1)
co = np.array([v.co[:] for v in vs])
# pieces that touch without sharing vertices (robe hem on the torso) crack apart when each follows its own bone:
# vertices within NEAR of each other are smoothed together like edge neighbours
from mathutils.kdtree import KDTree
NEAR = float(argv[3]) if len(argv) > 3 else 0.03   # measured: 1.5 cm crack 4.0 cm, 3 cm crack 3.2 cm (doc 151 §2.1)
kd = KDTree(len(vs))
for v in vs: kd.insert(v.co, v.index)
kd.balance()
pairs = [(v.index, j) for v in vs for (_, j, _) in kd.find_range(v.co, NEAR) if j > v.index]
if pairs:
    E = np.concatenate([E, np.array(pairs)]); deg = np.bincount(E.ravel(), minlength=len(vs)).astype(float)
print('[smooth] proximity links', len(pairs))
_, same = np.unique(np.round(co / 1e-5).astype(np.int64), axis=0, return_inverse=True)
same = same.ravel(); cnt = np.bincount(same).astype(float)
def weld(W):
    acc = np.zeros((cnt.size, W.shape[1])); np.add.at(acc, same, W); return (acc / cnt[:, None])[same]
W = weld(W)
for _ in range(R):
    acc = np.zeros_like(W); np.add.at(acc, E[:, 0], W[E[:, 1]]); np.add.at(acc, E[:, 1], W[E[:, 0]])
    has = deg > 0; new = W.copy(); new[has] = 0.5 * W[has] + 0.5 * acc[has] / deg[has, None]; new[:, lock] = W[:, lock]; W = weld(new)
cut = np.sort(W, axis=1)[:, -4][:, None]; W[W < cut] = 0; W /= np.maximum(W.sum(1, keepdims=True), 1e-9); W = weld(W)
print('[smooth] seam vertices', int((cnt > 1).sum()), 'spots shared by', int(cnt[cnt > 1].sum()), 'vertices')
for j, g in enumerate(G):
    g.remove(list(range(len(vs))))
    for i in np.nonzero(W[:, j] > 1e-4)[0]: g.add([int(i)], float(W[i, j]), 'REPLACE')
for o in bpy.data.objects: o.select_set(o in (arm, body))
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='ACTIONS', export_skins=True)
print('[smooth] rounds', R, '->', OUT)
