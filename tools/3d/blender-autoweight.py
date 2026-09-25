"""Blender 자동 무게(뼈 열 확산)로 스킨 무게만 다시 칠하기 (bpy 4.2, docs/design/80).

왜: 디렉터가 보여 준 영상(«Opus 5.5 가 Unreal·Blender 에서 게임을 만든다») 의 캐릭터는 Blender 에서
만들고 Blender 에서 뼈에 붙였다. 우리 재제작은 무게를 Meshy 자동 리깅에서 옮겨 왔는데, 관절이 튀고(시험 27)
세라 머리칼이 머리를 덜 따른다(시험 352). 같은 메시·같은 뼈에 Blender «Armature Deform · Automatic Weights» 를
돌려 비교한다. 뼈 위치·방향·클립·텍스처·UV·정점 순서는 그대로 — JOINTS_0 / WEIGHTS_0 만 바꾼다.

  python3 tools/3d/blender-autoweight.py <입력 glb> <출력 glb> [--chin 1.47] [--neck-blend 0.03] [--smooth 2]
  --chin       : 이 높이(바인드 좌표 m) 위 = 머리 한 몸(Head 1.0) — 얼굴이 목에 끌려 일그러지지 않게 (docs/design/78)
  --neck-blend : 턱 아래 이 폭에서 Head 1.0 → 자동 무게로 서서히
  --smooth     : Blender «Smooth Vertex Weights» 반복 횟수
  --arm-mask t : 입력 glb 의 옛 무게에서 팔(위팔·아래팔·손) 합이 t 미만인 정점은 팔 무게를 뺀다
                 — A 포즈에서 손이 치마·허리 옆이라 열 확산이 치마 조각을 손에 붙여, 공격 때 가시처럼 끌려 나왔다
"""
import sys, json, struct, argparse
import numpy as np
import bpy
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--chin', type=float, default=None); ap.add_argument('--neck-blend', type=float, default=0.03)
ap.add_argument('--smooth', type=int, default=2); ap.add_argument('--arm-mask', type=float, default=None); ap.add_argument('--rigid-head-only', action='store_true'); ap.add_argument('--merge', type=float, default=1e-4)
a = ap.parse_args(argv)

# ── glb 읽기 (mesh-swap.py 와 같은 방식) ──
CT = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1'}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
raw = open(a.src, 'rb').read(); jl = struct.unpack_from('<I', raw, 12)[0]
J = json.loads(raw[20:20 + jl]); B = bytearray(raw[28 + jl:28 + jl + struct.unpack_from('<I', raw, 20 + jl)[0]])
def acc(i):
    A = J['accessors'][i]; V = J['bufferViews'][A['bufferView']]; n = NC[A['type']]; dt = np.dtype(CT[A['componentType']])
    o = V.get('byteOffset', 0) + A.get('byteOffset', 0)
    return np.frombuffer(bytes(B[o:o + A['count'] * n * dt.itemsize]), dt).reshape(A['count'], n)
skin_node = next(n for n in J['nodes'] if 'skin' in n and 'mesh' in n)
prim = J['meshes'][skin_node['mesh']]['primitives'][0]
P = acc(prim['attributes']['POSITION']).astype(np.float64)
jnames = [J['nodes'][j]['name'] for j in J['skins'][skin_node['skin']]['joints']]
jidx = {n: i for i, n in enumerate(jnames)}

# ── Blender: 들여와서 쉬는 자세로 자동 무게 ──
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
body = max((o for o in bpy.context.scene.objects if o.type == 'MESH' and o.find_armature() == arm), key=lambda o: len(o.data.vertices))
for o in list(bpy.context.scene.objects):
    if o.type == 'MESH' and o is not body: bpy.data.objects.remove(o)
arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
for b in arm.data.bones: b.use_deform = not b.name.endswith('HandSlot')   # 무기 자리 뼈는 무게를 받지 않는다
# 옛 무게·부모 떼기 (모양은 그대로)
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
for m in list(body.modifiers): body.modifiers.remove(m)
body.vertex_groups.clear()
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# 이음새(UV 경계)로 갈라진 정점을 붙인 복사본에서 계산 — 갈라진 채로 열 확산을 돌리면 이음새마다 무게가 끊긴다
calc = body.copy(); calc.data = body.data.copy(); bpy.context.collection.objects.link(calc)
bpy.ops.object.select_all(action='DESELECT'); calc.select_set(True); bpy.context.view_layer.objects.active = calc
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=a.merge); bpy.ops.object.mode_set(mode='OBJECT')
print(f'정점 {len(body.data.vertices)} → 붙인 뒤 {len(calc.data.vertices)}')
arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
if a.smooth:
    bpy.ops.object.select_all(action='DESELECT'); calc.select_set(True); bpy.context.view_layer.objects.active = calc
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=a.smooth)
    bpy.ops.object.mode_set(mode='OBJECT')

# ── 계산한 무게 → glb 정점 (위치로 짝짓기: Blender z-up (x,-z,y) ↔ glTF y-up) ──
cv = calc.data.vertices; names = [g.name for g in calc.vertex_groups]
kd = KDTree(len(cv))
for v in cv: kd.insert(v.co, v.index)
kd.balance()
W = np.zeros((len(P), len(jnames)))
dmax = 0.0; zero = 0
for i, (x, y, z) in enumerate(P):
    co, vi, d = kd.find((x, -z, y)); dmax = max(dmax, d)
    for g in cv[vi].groups:
        n = names[g.group]
        if n in jidx: W[i, jidx[n]] += g.weight
    if W[i].sum() < 1e-6: zero += 1
print(f'짝짓기 최대 거리 {dmax*1000:.2f} mm · 무게 0 정점 {zero}')
if zero:   # 열 확산이 못 닿은 조각(떠 있는 장식 등) → 가장 가까운 무게 있는 정점을 따른다
    ok = np.where(W.sum(1) > 1e-6)[0]; kd2 = KDTree(len(ok))
    for k, i in enumerate(ok): kd2.insert(P[i], k)
    kd2.balance()
    for i in np.where(W.sum(1) <= 1e-6)[0]: W[i] = W[ok[kd2.find(P[i])[1]]]

# ── 팔 가리기: 옛 무게가 팔이라고 한 곳에만 팔 무게 ──
if a.arm_mask is not None:
    OJ = acc(prim['attributes']['JOINTS_0']).astype(int); OW = acc(prim['attributes']['WEIGHTS_0']).astype(np.float64)
    for side in ('Left', 'Right'):
        chain = [jidx[f'mixamorig:{side}{b}'] for b in ('Arm', 'ForeArm', 'Hand') if f'mixamorig:{side}{b}' in jidx]
        old = (OW * np.isin(OJ, chain)).sum(1); cut = old < a.arm_mask
        moved = W[cut][:, chain].sum(1)
        W[np.ix_(cut, chain)] = 0
        print(f'{side} 팔 가리기: {int((moved > 0.01).sum())} 정점에서 팔 무게 뺌')
    empty = W.sum(1) < 1e-6   # 팔 무게뿐이던 정점 → 옛 무게 그대로
    for i in np.where(empty)[0]:
        for j, w in zip(OJ[i], OW[i]): W[i, j] += w

# ── 머리 한 몸 (얼굴은 목에 끌리지 않게, docs/design/78) ──
if a.chin is not None and 'mixamorig:Head' in jidx:
    h = jidx['mixamorig:Head']; y = P[:, 1]
    t = np.clip((y - (a.chin - a.neck_blend)) / a.neck_blend, 0, 1)
    # 머리 쪽 무게(머리·목)가 이미 과반인 정점만 — 어깨·옷깃까지 머리에 붙이지 않는다
    headish = W[:, h] + (0 if a.rigid_head_only else W[:, jidx.get('mixamorig:Neck', h)])
    t = t * (headish > 0.5 * W.sum(1))
    Wh = np.zeros_like(W); Wh[:, h] = W.sum(1)
    W = W * (1 - t[:, None]) + Wh * t[:, None]
    print(f'머리 한 몸: {int((t > 0.999).sum())} 정점 · 섞임 {int(((t > 0) & (t < 0.999)).sum())}')

# 정점마다 큰 넷만, 합 1
top = np.argsort(-W, 1)[:, :4]; tw = np.take_along_axis(W, top, 1); tw /= tw.sum(1, keepdims=True)
tw[tw < 1e-4] = 0; tw /= tw.sum(1, keepdims=True)

# ── 쓰기: JOINTS_0 / WEIGHTS_0 을 버퍼 끝에 새로 ──
def put(arr, ct, typ):
    global B
    while len(B) % 4: B += b'\0'
    b = np.ascontiguousarray(arr.astype(CT[ct])).tobytes()
    J['bufferViews'].append({'buffer': 0, 'byteOffset': len(B), 'byteLength': len(b), 'target': 34962}); B += b
    J['accessors'].append({'bufferView': len(J['bufferViews']) - 1, 'componentType': ct, 'count': len(arr), 'type': typ})
    return len(J['accessors']) - 1
prim['attributes']['JOINTS_0'] = put(top, 5123, 'VEC4'); prim['attributes']['WEIGHTS_0'] = put(tw, 5126, 'VEC4')
while len(B) % 4: B += b'\0'
J['buffers'][0]['byteLength'] = len(B)
J['asset'].setdefault('extras', {})['autoWeight'] = 'tools/3d/blender-autoweight.py (docs/design/80)'
js = json.dumps(J, separators=(',', ':'), ensure_ascii=False).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
out = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(B)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(B), 0x004E4942) + bytes(B)
open(a.dst, 'wb').write(out)
dom = np.bincount(top[:, 0], minlength=len(jnames))
print('썼다', a.dst, len(out), '· 주 뼈 정점 수:', {jnames[i].split(':')[-1]: int(dom[i]) for i in np.argsort(-dom)[:8]})
