"""glb 에서 한 높이 아래(또는 위) 삼각형을 잘라 낸다 — 장갑의 손가락 떼기 (docs/design/83).

왜: 방어구는 뼈에 딱딱하게 붙는다. 무기를 쥔 손(구부린 손가락)에 손가락을 편 장갑 모델을 붙이면 손가락이 손 밑으로 튀어나오고
손이 두 배로 보였다. 손목에서 잘라 팔 보호대(브레이서)만 남기고 손은 캐릭터 몸 손을 쓴다.
정점·UV·텍스처는 그대로 두고 인덱스(삼각형)만 거른다 — 삼각형의 세 꼭짓점이 모두 남는 쪽일 때만 남긴다.

  python3 tools/3d/glb_cut.py <입력 glb> <출력 glb> --below -0.03     (glTF Y 가 -0.03 보다 아래인 삼각형 버림)
  python3 tools/3d/glb_cut.py <입력 glb> <출력 glb> --above 0.2
  --align : 비스듬히 만든 장갑은 잘라 낸 팔 보호대가 팔뚝과 어긋나 손목 뒤로 컵처럼 튀어나왔다 → 보호대 축을 세운다
"""
import sys, json, struct, argparse
import numpy as np

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--below', type=float); ap.add_argument('--above', type=float)
ap.add_argument('--align', action='store_true', help='남은 조각의 위·아래 끝 가운데를 이은 축을 +Y 로 세우고 경계 상자 가운데를 원점으로')
a = ap.parse_args()
raw = open(a.src, 'rb').read(); jl = struct.unpack_from('<I', raw, 12)[0]
J = json.loads(raw[20:20 + jl]); B = bytearray(raw[28 + jl:28 + jl + struct.unpack_from('<I', raw, 20 + jl)[0]])
CT = {5125: '<u4', 5123: '<u2', 5121: 'u1'}
def view(i, dt, n):
    A = J['accessors'][i]; V = J['bufferViews'][A['bufferView']]; o = V.get('byteOffset', 0) + A.get('byteOffset', 0)
    return np.frombuffer(bytes(B[o:o + A['count'] * n * np.dtype(dt).itemsize]), dt).reshape(A['count'], n)
kept = total = 0
for m in J['meshes']:
    for p in m['primitives']:
        P = view(p['attributes']['POSITION'], '<f4', 3); A = J['accessors'][p['indices']]
        I = view(p['indices'], CT[A['componentType']], 1).reshape(-1, 3)
        y = P[I][:, :, 1]
        ok = np.ones(len(I), bool)
        if a.below is not None: ok &= (y >= a.below).all(1)
        if a.above is not None: ok &= (y <= a.above).all(1)
        NI = I[ok].astype('<u4').reshape(-1); total += len(I); kept += int(ok.sum())
        while len(B) % 4: B += b'\0'
        J['bufferViews'].append({'buffer': 0, 'byteOffset': len(B), 'byteLength': NI.nbytes, 'target': 34963}); B += NI.tobytes()
        J['accessors'].append({'bufferView': len(J['bufferViews']) - 1, 'componentType': 5125, 'count': int(NI.size), 'type': 'SCALAR'})
        p['indices'] = len(J['accessors']) - 1
        # 남은 삼각형으로 POSITION min/max 를 다시 (three.js 는 경계 상자를 여기서 읽지 않지만 도구들이 읽는다)
        used = P[np.unique(NI)]; pa = J['accessors'][p['attributes']['POSITION']]; pa['min'] = used.min(0).tolist(); pa['max'] = used.max(0).tolist()
if a.align:
    # 남은 정점의 위 15 %·아래 15 % 가운데를 이은 축 → +Y 로 돌리고(로드리게스), 경계 상자 가운데를 원점으로. 노멀도 같이 돈다
    allP = []
    for m in J['meshes']:
        for p in m['primitives']:
            P = view(p['attributes']['POSITION'], '<f4', 3); I = view(p['indices'], '<u4', 1).reshape(-1); allP.append(P[np.unique(I)])
    Q = np.concatenate(allP); lo, hi = np.quantile(Q[:, 1], [0.15, 0.85])
    ax = Q[Q[:, 1] >= hi].mean(0) - Q[Q[:, 1] <= lo].mean(0); ax /= np.linalg.norm(ax); y = np.array([0, 1, 0.])
    v = np.cross(ax, y); c = float(ax @ y); K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    R = np.eye(3) + K + K @ K / (1 + c)
    Qr = Q @ R.T; ctr = (Qr.min(0) + Qr.max(0)) / 2
    print(f'축 기울기 {np.degrees(np.arccos(np.clip(c, -1, 1))):.1f}° → 세움')
    done = set()
    for m in J['meshes']:
        for p in m['primitives']:
            for key, shift in (('POSITION', True), ('NORMAL', False)):
                ai = p['attributes'].get(key)
                if ai is None or ai in done: continue
                done.add(ai); X = view(ai, '<f4', 3) @ R.T
                if shift: X = X - ctr
                X = X.astype('<f4'); A = J['accessors'][ai]; V = J['bufferViews'][A['bufferView']]; o = V.get('byteOffset', 0) + A.get('byteOffset', 0)
                B[o:o + X.nbytes] = X.tobytes()
                if shift: A['min'] = X.min(0).tolist(); A['max'] = X.max(0).tolist()
# 버린 인덱스 조각을 빼고 다시 싼다
used = sorted({x['bufferView'] for x in J['accessors'] if 'bufferView' in x} | {i['bufferView'] for i in J.get('images', []) if 'bufferView' in i})
vmap = {}; views = []; NB = bytearray()
for v in used:
    Vv = J['bufferViews'][v]
    while len(NB) % 4: NB += b'\0'
    oo = Vv.get('byteOffset', 0); nv = dict(Vv); nv['byteOffset'] = len(NB); NB += B[oo:oo + Vv['byteLength']]; vmap[v] = len(views); views.append(nv)
for x in J['accessors']:
    if 'bufferView' in x: x['bufferView'] = vmap[x['bufferView']]
for i in J.get('images', []):
    if 'bufferView' in i: i['bufferView'] = vmap[i['bufferView']]
J['bufferViews'] = views; B = NB
while len(B) % 4: B += b'\0'
J['buffers'][0]['byteLength'] = len(B)
js = json.dumps(J, separators=(',', ':'), ensure_ascii=False).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(a.dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(B)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(B), 0x004E4942) + bytes(B))
print(f'삼각형 {total} → {kept} · 썼다 {a.dst}')
