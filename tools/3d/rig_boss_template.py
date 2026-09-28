# 새 보스 몸(Hi3D GLB) → 허수아비 보스 뼈대·클립 18개를 그대로 입힌다 (docs/design/151). Blender 5.x 배경 실행.
#   blender -b -P tools/3d/rig_boss_template.py -- <새 메시.glb> <키 m> <출력.glb> [--static]
# - 템플릿: art/3d/boss_anim.glb (mixamorig 23뼈, UE 의 DA_Boss_Training 이 이 이름으로 클립을 튼다)
# - 맞춤: 새 몸을 키(원문 수치 또는 설계값)에 맞추고 발바닥 = 0, 가로 가운데. 뼈대는 같은 배율로 균일 확대,
#   클립의 위치 키(골반 이동)도 같은 배율.
# - 무게: 뼈 선분까지 거리로 가장 가까운 두 뼈에 나눈다(1/d^4). 표면 모양과 무관해 Hi3D 의 뚫린 메시에서도 된다.
# - --static: 뼈 없이 크기·자리만 맞춘 정적 GLB (거미·뱀·탑처럼 사람 뼈대가 안 맞는 몸)
import bpy, sys, os
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
STATIC = '--static' in argv
argv = [a for a in argv if not a.startswith('--')]
SRC, HEIGHT, OUT = argv[0], float(argv[1]), argv[2]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
TEMPLATE = os.path.join(ROOT, 'art', '3d', 'boss_anim.glb')
MAX_TRIS = int(os.environ.get('MAX_TRIS', '60000'))

bpy.ops.wm.read_factory_settings(use_empty=True)


def meshes():
    return [o for o in bpy.data.objects if o.type == 'MESH']


def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])


def select(objs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


# ---- 1. new body: one mesh, height HEIGHT, feet on the ground, centred
bpy.ops.import_scene.gltf(filepath=SRC)
body = meshes()
for o in list(bpy.data.objects):
    if o.type == 'EMPTY':
        o.select_set(False)
select(body)
if len(body) > 1:
    bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'Boss_Mesh'
body.parent = None
select([body])
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.data.objects):
    if o.type == 'EMPTY':
        bpy.data.objects.remove(o)
mn, mx = bounds([body])
s = HEIGHT / (mx.z - mn.z)
body.scale = (s, s, s)
body.location = (-(mn.x + mx.x) / 2 * s, -(mn.y + mx.y) / 2 * s, -mn.z * s)
select([body])
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
if tris > MAX_TRIS:
    m = body.modifiers.new('dec', 'DECIMATE')
    m.ratio = MAX_TRIS / tris
    bpy.ops.object.modifier_apply(modifier='dec')
print(f'[rig] body {SRC}: {tris} tris -> {sum(len(p.vertices) - 2 for p in body.data.polygons)}, height {HEIGHT} m')

if STATIC:
    select([body])
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True)
    print('[rig] static ->', OUT)
    sys.exit(0)

# ---- 2. template skeleton + clips, scaled uniformly to the new height
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=TEMPLATE)
new = [o for o in bpy.data.objects if o not in before]
arm = next(o for o in new if o.type == 'ARMATURE')
for o in new:
    if o.type == 'MESH':
        bpy.data.objects.remove(o)   # the scarecrow's own body (and its helper sphere)
t_mn, t_mx = Vector((0, 0, 0)), Vector((0, 0, 2.72))   # template body height (art/3d/boss_anim.glb)
k = HEIGHT / (t_mx.z - t_mn.z)
select([arm])
arm.scale = (arm.scale.x * k, arm.scale.y * k, arm.scale.z * k)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
for act in bpy.data.actions:
    for fc in getattr(act, 'fcurves', []):
        if fc.data_path.endswith('location'):
            for kp in fc.keyframe_points:
                kp.co.y *= k
                kp.handle_left.y *= k
                kp.handle_right.y *= k
    # Blender 5 layered actions
    for layer in getattr(act, 'layers', []):
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []):
                for fc in bag.fcurves:
                    if fc.data_path.endswith('location'):
                        for kp in fc.keyframe_points:
                            kp.co.y *= k
                            kp.handle_left.y *= k
                            kp.handle_right.y *= k

# ---- 3. weights: nearest two bone segments, 1/d^4
bones = [b for b in arm.data.bones if b.use_deform and not b.name.endswith('HandSlot')]
heads = np.array([(arm.matrix_world @ b.head_local)[:] for b in bones])
tails = np.array([(arm.matrix_world @ b.tail_local)[:] for b in bones])
V = np.array([v.co[:] for v in body.data.vertices])
seg = tails - heads
L2 = np.maximum((seg ** 2).sum(1), 1e-8)
D = np.empty((len(V), len(bones)))
for j in range(len(bones)):
    t = np.clip(((V - heads[j]) @ seg[j]) / L2[j], 0, 1)
    P = heads[j] + t[:, None] * seg[j]
    D[:, j] = np.sqrt(((V - P) ** 2).sum(1))
near = np.argsort(D, axis=1)[:, :2]
d = np.take_along_axis(D, near, axis=1) + 1e-3
w = 1.0 / d ** 4
w /= w.sum(1, keepdims=True)
for b in bones:
    body.vertex_groups.new(name=b.name)
for j, b in enumerate(bones):
    g = body.vertex_groups[b.name]
    for col in range(2):
        idx = np.nonzero(near[:, col] == j)[0]
        for i in idx:
            g.add([int(i)], float(w[i, col]), 'ADD')
body.parent = arm
mod = body.modifiers.new('Armature', 'ARMATURE')
mod.object = arm
print(f'[rig] {len(bones)} bones weighted, {len(bpy.data.actions)} clips, skeleton x{k:.3f}')

# ---- 4. export: mesh + skeleton + every clip
select([arm, body], arm)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=True,
                          export_animation_mode='ACTIONS', export_skins=True)
print('[rig] ->', OUT)
