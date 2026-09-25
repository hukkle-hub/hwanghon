"""얼굴은 촘촘히 두고 몸만 줄이기 (bpy, docs/design/80).

왜: Tripo 전신을 6만 면으로 뽑으면 얼굴이 120 면뿐이라 각이 진다(코·광대가 판자). 20만 면으로 뽑은 뒤
«얼굴·손은 남기고 몸만» 줄여 게임 예산(약 6~7만 면)에 맞춘다.

  python3 tools/3d/decimate-keep.py <입력 glb> <출력 glb> --target 70000 [--front x] [--head 0.15] [--hand 0.6]
  --front : 입력 모델의 앞 방향 축(x 또는 z) — Tripo 는 x
  --head  : 키의 위쪽 이 비율 = 머리(무게 1 → 거의 안 줄임)
  --hand  : 손 둘레 무게(0~1)
"""
import sys, argparse
import bpy, bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--target', type=int, default=70000); ap.add_argument('--front', default='x')
ap.add_argument('--head', type=float, default=0.15); ap.add_argument('--hand', type=float, default=0.6)
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
if len(objs) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
n0 = len(me.polygons)
# Blender 은 glTF 의 +y(위)를 +z 로 들여온다. 위 = z. 앞 = glTF x → Blender x, glTF z → Blender -y
zs = [v.co.z for v in me.vertices]; zmin, zmax = min(zs), max(zs); H = zmax - zmin
lat = (lambda v: v.co.y) if a.front == 'x' else (lambda v: v.co.x)   # 옆(팔을 벌린) 축
lats = [abs(lat(v)) for v in me.vertices]; lmax = max(lats)
vg = ob.vertex_groups.new(name='keep')
head_n = hand_n = 0
for v in me.vertices:
    h = (v.co.z - zmin) / H; w = 0.0
    if h > 1 - a.head: w = 1.0; head_n += 1
    elif h > 1 - a.head - 0.04: w = (h - (1 - a.head - 0.04)) / 0.04
    if abs(lat(v)) > lmax * 0.78 and 0.35 < h < 0.62: w = max(w, a.hand); hand_n += 1
    if w > 0: vg.add([v.index], w, 'REPLACE')
m = ob.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'
m.vertex_group = 'keep'; m.invert_vertex_group = True; m.vertex_group_factor = 1.0; m.use_collapse_triangulate = True
# 목표 면 수에 맞춰 비율을 몇 번 조정 (얼굴을 지키면 실제 비율이 목표보다 덜 줄어든다)
ratio = a.target / n0
for _ in range(6):
    m.ratio = min(1.0, ratio)
    dg = bpy.context.evaluated_depsgraph_get(); n = len(ob.evaluated_get(dg).data.polygons)
    if abs(n - a.target) < a.target * 0.03: break
    ratio *= a.target / max(n, 1)
bpy.ops.object.modifier_apply(modifier='dec')
# 머리 면 수 (확인용)
hn = sum(1 for p in me.polygons if (sum((me.vertices[i].co.z for i in p.vertices)) / len(p.vertices) - zmin) / H > 1 - a.head)
print(f'면 {n0} → {len(me.polygons)} · 머리(위 {a.head*100:.0f}%) 면 {hn} · 머리 정점 {head_n} · 손 정점 {hand_n}')
bpy.ops.export_scene.gltf(filepath=a.dst, export_format='GLB', use_selection=False, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO')
