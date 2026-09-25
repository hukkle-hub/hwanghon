"""새 아인 손 → 옛 손 좌표 맞춤 (쥔 손 모양을 그대로 쓰려고, docs/design/80).

왜: js/ain-grip-shape.js 의 «쥔 손» 은 옛 아인(Hi3D) 손 뼈 로컬 좌표에 맞춰 잰 값이다(손가락 = +y, 두께 = x,
벌림 = z, 자루 가운데 (±.022+.005, .052)). 새 손(Tripo)은 같은 축이지만 손가락이 30° 가량 기울고 1~2 cm 비켜 있어
그대로 굽히면 삼각형이 터졌다. 새 손 정점을 옛 손 정점(tools/3d/ref/ain_hand_ref.json)에 겹치는 변환
(z 축 회전 + 이동, 가까운 60 % 만 쓰는 ICP)을 구해 Hand 노드 extras.gripFrame(4×4, 열 우선)에 적는다.
새 손가락은 미리 굽어 있어 옮겨도 손끝이 낮다 → 손끝 높이 비율로 굽힘 배율 extras.gripCurl.
js/ain-bind-repair.js 가 이 변환을 거쳐 굽히고, 자루 자리(HandSlot)도 옮긴다.

  python3 tools/3d/ain-grip-frame.py <입력 glb> <출력 glb>
"""
import sys, json, struct, os
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
REF = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ref', 'ain_hand_ref.json')))['hands']
CT = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1'}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
raw = open(src, 'rb').read(); jl = struct.unpack_from('<I', raw, 12)[0]
J = json.loads(raw[20:20 + jl]); B = raw[28 + jl:28 + jl + struct.unpack_from('<I', raw, 20 + jl)[0]]
def acc(i):
    A = J['accessors'][i]; V = J['bufferViews'][A['bufferView']]; n = NC[A['type']]; dt = np.dtype(CT[A['componentType']])
    o = V.get('byteOffset', 0) + A.get('byteOffset', 0)
    return np.frombuffer(B[o:o + A['count'] * n * dt.itemsize], dt).reshape(A['count'], n)
node = next(n for n in J['nodes'] if 'skin' in n and 'mesh' in n); skin = J['skins'][node['skin']]
prim = J['meshes'][node['mesh']]['primitives'][0]
P = acc(prim['attributes']['POSITION']).astype(np.float64); Jn = acc(prim['attributes']['JOINTS_0']).astype(int); Wt = acc(prim['attributes']['WEIGHTS_0']).astype(np.float64)
IBM = acc(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)   # 열 우선 → 행렬
names = [J['nodes'][j]['name'].split(':')[-1] for j in skin['joints']]
def rotz(a): c, s = np.cos(a), np.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
for side in ('Right', 'Left'):
    j = names.index(side + 'Hand'); w = (Wt * (Jn == j)).sum(1)
    Bh = (IBM[j] @ np.column_stack([P[w > 0.5], np.ones(int((w > 0.5).sum()))]).T).T[:, :3]
    Bh = np.unique(np.round(Bh, 5), axis=0); A = np.array(REF[side])
    best = None
    for a0 in np.radians(np.arange(-60, 61, 10)):
        a = a0; t = A.mean(0) - (rotz(a) @ Bh.T).T.mean(0)
        for _ in range(60):
            Bt = (rotz(a) @ Bh.T).T + t
            d = ((Bt[:, None, :] - A[None, :, :]) ** 2).sum(-1); k = d.argmin(1); dist = np.sqrt(d[np.arange(len(Bh)), k])
            keep = dist < np.quantile(dist, 0.6); X = Bh[keep]; Y = A[k[keep]]
            Xc = X - X.mean(0); Yc = Y - Y.mean(0); H = Xc[:, :2].T @ Yc[:, :2]
            a = np.arctan2(H[0, 1] - H[1, 0], H[0, 0] + H[1, 1]); t = Y.mean(0) - rotz(a) @ X.mean(0)
        Bt = (rotz(a) @ Bh.T).T + t; score = np.sqrt(np.quantile(((Bt[:, None, :] - A[None, :, :]) ** 2).sum(-1).min(1), 0.6))
        if best is None or score < best[0]: best = (score, a, t)
    score, a, t = best
    M = np.eye(4); M[:3, :3] = rotz(a); M[:3, 3] = t
    # 굽힘 배율: 손끝(위 2 %) 높이가 옛 손보다 낮으면(새 손은 미리 굽어 있다) 같은 비율로 더 굽혀야 자루를 절반 넘게 감싼다
    tip_new = np.quantile(((rotz(a) @ Bh.T).T + t)[:, 1], 0.98); tip_old = np.quantile(A[:, 1], 0.98)
    # 비율을 다 쓰면(오른손 1.36) 손끝이 나선처럼 늘어났다(늘어난 변 9.6 %, 옛 손 3.7 %). 30 % 만 쓰면 1.11 —
    # 굽힘을 1.0·1.1·1.2·1.28 로 재 보니 «절반 넘게 감싼다» 를 지키는 가장 작은 값이 1.1 이었다(늘어난 변 5.7 %).
    curl = float(np.clip(1 + 0.3 * ((tip_old - 0.052) / max(tip_new - 0.052, 1e-3) - 1), 1.0, 1.3))
    hn = J['nodes'][skin['joints'][j]]; hn['extras'] = {**hn.get('extras', {}), 'gripFrame': [round(float(x), 6) for x in M.T.reshape(-1)], 'gripCurl': round(curl, 3)}
    print(f'{side}: z 회전 {np.degrees(a):.1f}° · 이동 {np.round(t * 1000, 1)} mm · 겹친 60 % 거리 {score * 1000:.1f} mm · 손끝 {tip_new:.3f}/{tip_old:.3f} → 굽힘 × {curl:.2f}')
js = json.dumps(J, separators=(',', ':'), ensure_ascii=False).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(B)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(B), 0x004E4942) + B)
print('썼다', dst)
