"""Blender 자동 무게(뼈 열 확산)로 스킨 무게만 다시 칠하기 (bpy 4.2, docs/design/80).

왜: 디렉터가 보여 준 영상(«Opus 5.5 가 Unreal·Blender 에서 게임을 만든다») 의 캐릭터는 Blender 에서
만들고 Blender 에서 뼈에 붙였다. 우리 재제작은 무게를 Meshy 자동 리깅에서 옮겨 왔는데, 관절이 튀고(시험 27)
세라 머리칼이 머리를 덜 따른다(시험 352). 같은 메시·같은 뼈에 Blender «Armature Deform · Automatic Weights» 를
돌려 비교한다. 뼈 위치·방향·클립·텍스처·UV·정점 순서는 그대로 — JOINTS_0 / WEIGHTS_0 만 바꾼다.

  python3 tools/3d/blender-autoweight.py <입력 glb> <출력 glb> [--chin 1.47] [--neck-blend 0.03] [--smooth 2]
  --chin       : 이 높이(바인드 좌표 m) 위 = 머리 한 몸(Head 1.0) — 얼굴이 목에 끌려 일그러지지 않게 (docs/design/78)
  --neck-blend : 턱 아래 이 폭에서 Head 1.0 → 자동 무게로 서서히
  --smooth     : Blender «Smooth Vertex Weights» 반복 횟수
  --region-smooth y0:y1:n[:k] : 이 높이 띠 안에서만 무게를 이웃 평균으로 n 번(메시 연결을 따라, UV 이음새는 붙여서).
                 머리 한 몸(턱 위)은 고정 — 턱 아래 목·목도리·앞머리칼이 머리에서 몸으로 «서서히» 넘어간다.
                 없으면 턱선 3 cm 띠에서 무게가 한꺼번에 바뀌어 목도리·앞머리칼이 쇄골선에서 꺾였다(확대 검수)
  --target N   : 삼각형을 N 개 아래로(안드로이드 캐릭터 예산 6만, docs/design/05). 머리·손(쥔 손 모양)은 그대로,
                 몸만 줄인다 — 위치·UV·법선(얼굴 투영의 매끈한 법선 포함)을 Blender 에서 다시 뽑아 쓴다
  --skirt k    : 엉덩이 아래, 다리 뼈에서 7.5 cm 넘게 떨어진 옷자락 정점의 다리 무게 × k (나머지는 골반).
                 다리를 벌리면 두 다리 사이 치마가 양쪽으로 찢어지던 것을 줄인다
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
ap.add_argument('--smooth', type=int, default=2); ap.add_argument('--arm-mask', type=float, default=None); ap.add_argument('--rigid-head-only', action='store_true')
ap.add_argument('--region-smooth', action='append', default=[], help='y0:y1:반복[:세기] — 이 높이 띠의 무게를 메시 이웃 평균으로 (여러 번)')
ap.add_argument('--skirt', type=float, default=None, help='엉덩이 아래 다리에서 먼 옷자락의 다리 무게를 이 배율로(나머지는 골반)'); ap.add_argument('--merge', type=float, default=1e-4)
ap.add_argument('--target', type=int, default=None, help='삼각형 수 상한 — 머리(턱 5 cm 아래부터)·손은 그대로 두고 몸만 줄인다')
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
IDX = acc(prim['indices']).reshape(-1, 3).astype(np.int64)
OJ = acc(prim['attributes']['JOINTS_0']).astype(int); OW = acc(prim['attributes']['WEIGHTS_0']).astype(np.float64)
NEW = None   # --target 이면 새 (위치, 법선, UV) — 정점이 바뀐다
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
PRE = body.data.copy()   # 무게는 줄이기 «전» 메시로 — 줄인 메시는 열 확산이 풀리지 않았다(«failed to find solution»)
if a.target and len(IDX) > a.target:
    # 지킬 곳: 머리(턱 5 cm 아래부터) · 손(옛 손 무게 > 0.3). 원래 정점과 위치로 짝지어 칠한다
    hands = [jidx[f'mixamorig:{s}Hand'] for s in ('Left', 'Right')]
    handw = (OW * np.isin(OJ, hands)).sum(1)
    keepw = np.maximum(np.clip((P[:, 1] - ((a.chin or 9) - 0.08)) / 0.03, 0, 1), (handw > 0.3).astype(float))
    kd0 = KDTree(len(P))
    for i, (x, y, z) in enumerate(P): kd0.insert((x, -z, y), i)
    kd0.balance()
    vg = body.vertex_groups.new(name='keep')
    for v in body.data.vertices:
        w = keepw[kd0.find(v.co)[1]]
        if w > 0: vg.add([v.index], float(w), 'REPLACE')
    m = body.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.vertex_group = 'keep'; m.invert_vertex_group = True
    m.vertex_group_factor = 1.0; m.use_collapse_triangulate = True
    ratio = a.target / len(IDX) * 0.97
    for _ in range(8):
        m.ratio = min(1.0, ratio); dg = bpy.context.evaluated_depsgraph_get(); n = len(body.evaluated_get(dg).data.polygons)
        if a.target * 0.97 <= n <= a.target: break
        ratio *= a.target * 0.985 / max(n, 1)
    bpy.ops.object.modifier_apply(modifier='dec'); body.vertex_groups.clear()
    me = body.data; nl = len(me.loops)
    lv = np.zeros(nl, np.int64); me.loops.foreach_get('vertex_index', lv)
    uvl = np.zeros(nl * 2); me.uv_layers.active.data.foreach_get('uv', uvl); uvl = uvl.reshape(-1, 2)
    cn = np.zeros(nl * 3); me.corner_normals.foreach_get('vector', cn); cn = cn.reshape(-1, 3)
    co = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    key = np.column_stack([lv, np.round(uvl * 1e5), np.round(cn * 1e3)]).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
    c = co[lv[first]]; nn = cn[first]
    NEW = (np.column_stack([c[:, 0], c[:, 2], -c[:, 1]]), np.column_stack([nn[:, 0], nn[:, 2], -nn[:, 1]]), np.column_stack([uvl[first, 0], 1 - uvl[first, 1]]))
    tri = inv.reshape(-1, 3)
    # 옛 무게(팔 가리기용)는 가장 가까운 원래 정점에서
    src = np.array([kd0.find((x, -z, y))[1] for x, y, z in NEW[0]])
    print(f'삼각형 {len(IDX)} → {len(tri)} · 정점 {len(P)} → {len(NEW[0])} (머리·손 지킴 {int((keepw > 0.5).sum())} 정점)')
    P, IDX, OJ, OW = NEW[0], tri, OJ[src], OW[src]
# 이음새(UV 경계)로 갈라진 정점을 붙인 복사본에서 계산 — 갈라진 채로 열 확산을 돌리면 이음새마다 무게가 끊긴다
calc = body.copy(); calc.data = PRE; calc.modifiers.clear(); bpy.context.collection.objects.link(calc)
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

# ── 옷자락: 다리에서 먼 치맛단은 골반을 더 따른다 ──
fixed = np.zeros(len(P), bool)
if a.chin is not None: fixed = P[:, 1] >= a.chin
if a.skirt is not None:
    pb = {b.name: (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in arm.data.bones}
    def g2b(v): return np.array([v.x, v.z, -v.y])   # Blender z-up → glTF y-up
    hip_y = g2b(pb['mixamorig:Hips'][0])[1]; hips = jidx['mixamorig:Hips']
    dmin = np.full(len(P), 9.0)
    for side in ('Left', 'Right'):
        for bn in ('UpLeg', 'Leg', 'Foot', 'ToeBase'):   # 발·발끝도 재야 부츠가 «옷자락» 으로 잡히지 않는다
            if f'mixamorig:{side}{bn}' not in pb: continue
            h0, h1 = g2b(pb[f'mixamorig:{side}{bn}'][0]), g2b(pb[f'mixamorig:{side}{bn}'][1]); d = h1 - h0
            t = np.clip(((P - h0) @ d) / (d @ d), 0, 1); dmin = np.minimum(dmin, np.linalg.norm(P - (h0 + t[:, None] * d), axis=1))
    legs = [jidx[f'mixamorig:{s}{b}'] for s in ('Left', 'Right') for b in ('UpLeg', 'Leg') if f'mixamorig:{s}{b}' in jidx]
    f = np.clip((dmin - 0.075) / 0.07, 0, 1) * (P[:, 1] < hip_y)   # 다리 살갗(7.5 cm 안)은 그대로
    k = 1 - f * (1 - a.skirt); moved = W[:, legs].sum(1) * (1 - k)
    W[:, legs] *= k[:, None]; W[:, hips] += moved
    print(f'옷자락: {int((f > 0.5).sum())} 정점 · 다리 무게 × {a.skirt}')

# ── 띠 안에서 이웃 평균 (UV 이음새로 갈라진 정점은 위치로 붙여서) ──
if a.region_smooth:
    key = np.round(P / 1e-5).astype(np.int64); _, uid, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
    U = len(uid); E = inv[np.concatenate([IDX[:, [0, 1]], IDX[:, [1, 2]], IDX[:, [2, 0]]])]
    E = E[E[:, 0] != E[:, 1]]; E = np.unique(np.sort(E, 1), axis=0)
    deg = np.bincount(E.ravel(), minlength=U).astype(np.float64)
    WU = np.zeros((U, W.shape[1])); np.add.at(WU, inv, W); WU /= np.bincount(inv, minlength=U)[:, None]
    PU = P[uid]; FU = np.zeros(U, bool); np.logical_or.at(FU, inv, fixed)
    for spec in a.region_smooth:
        y0, y1, n, *kk = [float(x) for x in spec.split(':')]; lam = kk[0] if kk else 0.5
        m = (PU[:, 1] >= y0) & (PU[:, 1] <= y1) & ~FU & (deg > 0)
        for _ in range(int(n)):
            S = np.zeros_like(WU); np.add.at(S, E[:, 0], WU[E[:, 1]]); np.add.at(S, E[:, 1], WU[E[:, 0]])
            avg = S / np.maximum(deg, 1)[:, None]; WU[m] = (1 - lam) * WU[m] + lam * avg[m]
        print(f'띠 {y0}~{y1} m: {int(m.sum())} 정점 · {int(n)} 번')
    W = WU[inv]

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
if NEW is not None:   # 줄였으면 모양·UV·법선·삼각형도 새로 (옛 것은 버퍼에 남지만 아래에서 빈 버퍼로 다시 싼다)
    prim['attributes'] = {'POSITION': put(NEW[0], 5126, 'VEC3'), 'NORMAL': put(NEW[1], 5126, 'VEC3'), 'TEXCOORD_0': put(NEW[2], 5126, 'VEC2'),
                          'JOINTS_0': prim['attributes']['JOINTS_0'], 'WEIGHTS_0': prim['attributes']['WEIGHTS_0']}
    A = J['accessors'][prim['attributes']['POSITION']]; A['min'] = NEW[0].min(0).tolist(); A['max'] = NEW[0].max(0).tolist()
    prim['indices'] = put(IDX.reshape(-1), 5125 if len(P) >= 65536 else 5123, 'SCALAR'); J['bufferViews'][-1]['target'] = 34963
# 쓰지 않게 된 옛 조각(옛 무게·옛 모양)을 버퍼에서 빼고 다시 싼다
used = sorted({A['bufferView'] for A in J['accessors'] if 'bufferView' in A} | {im['bufferView'] for im in J.get('images', []) if 'bufferView' in im})
live = set()
for m in J['meshes']:
    for pr in m['primitives']: live |= set(pr['attributes'].values()) | ({pr['indices']} if 'indices' in pr else set())
for sk in J.get('skins', []):
    if 'inverseBindMatrices' in sk: live.add(sk['inverseBindMatrices'])
for an in J.get('animations', []):
    for sm in an['samplers']: live |= {sm['input'], sm['output']}
amap = {}; accs = []
for i, A in enumerate(J['accessors']):
    if i in live: amap[i] = len(accs); accs.append(A)
vused = sorted({A['bufferView'] for A in accs} | {im['bufferView'] for im in J.get('images', []) if 'bufferView' in im})
vmap = {}; views = []; NB = bytearray()
for v in vused:
    V = J['bufferViews'][v]
    while len(NB) % 4: NB += b'\0'
    o = V.get('byteOffset', 0); nv = dict(V); nv['byteOffset'] = len(NB); NB += B[o:o + V['byteLength']]
    vmap[v] = len(views); views.append(nv)
for A in accs: A['bufferView'] = vmap[A['bufferView']]
for im in J.get('images', []):
    if 'bufferView' in im: im['bufferView'] = vmap[im['bufferView']]
for m in J['meshes']:
    for pr in m['primitives']:
        pr['attributes'] = {k: amap[v] for k, v in pr['attributes'].items()}
        if 'indices' in pr: pr['indices'] = amap[pr['indices']]
for sk in J.get('skins', []):
    if 'inverseBindMatrices' in sk: sk['inverseBindMatrices'] = amap[sk['inverseBindMatrices']]
for an in J.get('animations', []):
    for sm in an['samplers']: sm['input'] = amap[sm['input']]; sm['output'] = amap[sm['output']]
J['accessors'] = accs; J['bufferViews'] = views; B = NB
while len(B) % 4: B += b'\0'
J['buffers'][0]['byteLength'] = len(B)
J['asset'].setdefault('extras', {})['autoWeight'] = 'tools/3d/blender-autoweight.py (docs/design/80)'
js = json.dumps(J, separators=(',', ':'), ensure_ascii=False).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
out = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(B)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(B), 0x004E4942) + bytes(B)
open(a.dst, 'wb').write(out)
dom = np.bincount(top[:, 0], minlength=len(jnames))
print('썼다', a.dst, len(out), '· 주 뼈 정점 수:', {jnames[i].split(':')[-1]: int(dom[i]) for i in np.argsort(-dom)[:8]})
import os; os._exit(0)   # bpy 가 끝날 때 가끔 죽는다(파일은 이미 다 썼다)
