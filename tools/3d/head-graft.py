"""머리 이식 — 설정 시트 얼굴로 새로 만든 3D 머리를 캐릭터 목에 붙인다 (docs/design/79).

왜: 텍스처 투영(face-project)으로 눈·입·피부는 시트대로 들어갔지만, Hi3D 가 만든 머리 «모양»
(큰 평면 얼굴 · 판자 같은 머리칼 껍질)은 텍스처로 못 고친다. 시트 얼굴 복원본 → 4면 이미지 → 3D 머리를
새로 만들고, 옛 머리(머리 뼈에 매인 면)를 지운 자리에 붙인다.

  python3 tools/3d/head-graft.py <몸 glb> <머리 glb> --body ex1,ey1,ex2,ey2,mx,my --head ex1,ey1,ex2,ey2,mx,my
         [--cut y] [--drop-head 0.5] [--rigid-y y] [--dz m] [--scale k] [--tex 2048] --out 파일
  --body  : 몸 메시 바인드 정면 좌표(m) 왼눈(화면 왼쪽)·오른눈·입 — face-project --mesh 와 같은 값
  --head  : 머리 glb 정면 좌표 같은 세 점 (tools/3d/face-ortho.html ?glb= 로 찾는다)
  --cut   : 새 머리에서 이 높이(몸 좌표) 아래 면은 버린다 — 목 아래는 옛 옷깃 안으로 숨는다
  --drop-head : 옛 몸에서 세 정점 모두 Head 무게가 이 값 이상인 면을 지운다(옛 얼굴·머리칼)

규칙
  · 맞춤은 «배율 + 이동» 만 — 두 모델 모두 +z 가 앞, +y 가 위. 눈 사이·눈-입 거리로 배율, 세 점 가운데로 이동.
    깊이(z)는 정면에서 본 표면 높이로 — 눈·입 자리의 가장 앞 면.
  · 새 정점의 스킨 무게 = 옛 몸의 가장 가까운 «머리·목» 정점 무게. 턱 위(--rigid-y)는 Head 1.0(얼굴은 한 몸).
  · 새 머리는 두 번째 프리미티브(자기 재질·텍스처) — 몸 텍스처·UV 는 그대로.
"""
import sys, json, struct, io, argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('body'); ap.add_argument('head')
ap.add_argument('--body-lm', dest='blm', required=True); ap.add_argument('--head-lm', dest='hlm', required=True)
ap.add_argument('--cut', type=float, default=None); ap.add_argument('--drop-head', type=float, default=0.5)
ap.add_argument('--rigid-y', type=float, default=None); ap.add_argument('--dz', type=float, default=0.0)
ap.add_argument('--rot-y', type=float, default=0.0, help='머리 glb 를 y 축으로 돌려 앞을 +z 로 (도) — Tripo 는 앞이 +x 라 -90');
ap.add_argument('--scale', type=float, default=1.0); ap.add_argument('--tex', type=int, default=2048)
ap.add_argument('--keep', default='', help='지우지 않을 옛 면: y 아래 값 (예: 옛 긴 머리칼 아래쪽을 남긴다)')
ap.add_argument('--keep-dark', default='', help='y,L — y 아래에 있고 원래 텍스처가 L 보다 어두운 옛 면(목도리·옷깃)은 남긴다')
ap.add_argument('--drop-skin', default='', help='y,L,R — y 위 · 밝기 ≥ L · 머리 축에서 R m 안의 옛 면(옛 목 피부 윗동)도 지운다 — 새 목이 대신한다')
ap.add_argument('--debris', default='', help='N,y — 지우고 난 뒤 y 위에 남은 N 면 미만의 떠 있는 조각(옛 머리칼 끝)을 지운다')
ap.add_argument('--keep-hair', default='', help='L,S — --cut 아래라도 새 텍스처가 머리칼 같은 면(밝기 ≥ L · 채도 ≤ S)은 남긴다 — 가슴까지 내려오는 긴 머리')
ap.add_argument('--weights-light', type=float, default=0, help='새 정점 무게를 «밝은 옛 정점»(옛 머리칼·피부, 밝기 ≥ 값)에서 — 긴 머리가 옛 긴 머리처럼 가슴·등 뼈를 따른다')
ap.add_argument('--push-out', type=float, default=0, help='m — 새 머리칼(턱 아래)이 몸(옷) 속에 묻히면 앞·뒤 표면 밖으로 이만큼 밀어낸다(주변으로 부드럽게 번짐)')
ap.add_argument('--push-cap', type=float, default=0.035, help='이보다 깊게 묻힌 정점은 밀지 않는다(m)')
ap.add_argument('--blend', type=float, default=0.0, help='m — rigid-y 아래 이 폭 안에서 Head 1.0 → 옛 무게로 서서히 (긴 머리가 턱선에서 꺾이지 않게)')
ap.add_argument('--no-mr', action='store_true', help='머리 거칠기 텍스처를 쓰지 않는다(균일 0.8)')
ap.add_argument('--out', required=True)
a = ap.parse_args()

CT = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1', 5120: 'i1', 5122: '<i2'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def load(path):
    buf = open(path, 'rb').read(); jl = struct.unpack_from('<I', buf, 12)[0]
    J = json.loads(buf[20:20 + jl]); bl = struct.unpack_from('<I', buf, 20 + jl)[0]
    return J, bytes(buf[28 + jl:28 + jl + bl])

def acc(J, BIN, i):
    A = J['accessors'][i]; V = J['bufferViews'][A['bufferView']]; n = NC[A['type']]; dt = np.dtype(CT[A['componentType']])
    off = V.get('byteOffset', 0) + A.get('byteOffset', 0); st = V.get('byteStride')
    if st and st != n * dt.itemsize:
        raw = np.frombuffer(BIN[off:off + st * A['count']], 'u1').reshape(A['count'], st)[:, :n * dt.itemsize]
        arr = np.frombuffer(raw.tobytes(), dt)
    else:
        arr = np.frombuffer(BIN[off:off + A['count'] * n * dt.itemsize], dt)
    arr = arr.reshape(A['count'], n) if n > 1 else arr
    if A.get('normalized') and dt.kind in 'ui': arr = arr.astype(np.float64) / np.iinfo(dt).max
    return arr

def image_of(J, BIN, tex_index):
    im = J['images'][J['textures'][tex_index]['source']]
    if 'bufferView' in im:
        V = J['bufferViews'][im['bufferView']]; o = V.get('byteOffset', 0)
        return Image.open(io.BytesIO(BIN[o:o + V['byteLength']]))
    raise SystemExit('외부 이미지 uri 는 지원 안 함')

def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])

def node_mat(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    M = np.eye(4); R = quat_mat(n.get('rotation', [0, 0, 0, 1])); S = np.diag(n.get('scale', [1, 1, 1]))
    M[:3, :3] = R @ S; M[:3, 3] = n.get('translation', [0, 0, 0]); return M

# ── 몸 ────────────────────────────────────────────────────────────────
JB, BB = load(a.body)
prim = JB['meshes'][0]['primitives'][0]
P = acc(JB, BB, prim['attributes']['POSITION']).astype(np.float64)
JO = acc(JB, BB, prim['attributes']['JOINTS_0']).astype(np.int64); WE = acc(JB, BB, prim['attributes']['WEIGHTS_0']).astype(np.float64)
IDX = acc(JB, BB, prim['indices']).reshape(-1, 3).astype(np.int64)
skin = JB['skins'][0]; jn = [JB['nodes'][j]['name'].split(':')[-1] for j in skin['joints']]
H_ = jn.index('Head'); N_ = jn.index('Neck')
headw = (WE * (JO == H_)).sum(1) + sum((WE * (JO == jn.index(n))).sum(1) for n in jn if n.startswith('HeadTop'))
neckw = (WE * (JO == N_)).sum(1)

# ── 머리 (모든 프리미티브를 월드 좌표로 펴기) ─────────────────────────────
JH, BH = load(a.head)
def walk(ni, M, out):
    n = JH['nodes'][ni]; M2 = M @ node_mat(n)
    if 'mesh' in n:
        for pr in JH['meshes'][n['mesh']]['primitives']: out.append((pr, M2))
    for c in n.get('children', []): walk(c, M2, out)
hp = []
for r in JH['scenes'][JH.get('scene', 0)]['nodes']: walk(r, np.eye(4), hp)
HP, HN, HUV, HI, off = [], [], [], [], 0
mat_i = hp[0][0].get('material')
for pr, M in hp:
    p = acc(JH, BH, pr['attributes']['POSITION']).astype(np.float64); p = p @ M[:3, :3].T + M[:3, 3]
    nrm = acc(JH, BH, pr['attributes']['NORMAL']).astype(np.float64) @ np.linalg.inv(M[:3, :3])
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    uv = acc(JH, BH, pr['attributes']['TEXCOORD_0']).astype(np.float64)
    ix = acc(JH, BH, pr['indices']).reshape(-1, 3).astype(np.int64) if 'indices' in pr else np.arange(len(p)).reshape(-1, 3)
    HP.append(p); HN.append(nrm); HUV.append(uv); HI.append(ix + off); off += len(p)
    if pr.get('material') != mat_i: print('경고: 머리 프리미티브 재질이 여러 개 — 첫 재질 텍스처만 쓴다')
HP, HN, HUV, HI = np.vstack(HP), np.vstack(HN), np.vstack(HUV), np.vstack(HI)
if a.rot_y:
    th = np.radians(a.rot_y); RY = np.array([[np.cos(th), 0, np.sin(th)], [0, 1, 0], [-np.sin(th), 0, np.cos(th)]])
    HP = HP @ RY.T; HN = HN @ RY.T
print(f'몸 정점 {len(P)} 면 {len(IDX)} · 머리 정점 {len(HP)} 면 {len(HI)} · 머리 상자 {HP.min(0).round(3)} ~ {HP.max(0).round(3)}')

def front_z(V, F, xy, r=0.004):
    """정면(+z)에서 본 표면 높이 — 점 xy 를 덮는 면 중 가장 앞의 z (반경 r 안 정점 최댓값으로 근사 후 면 보간)"""
    out = []
    tri = V[F]; mn = tri[:, :, :2].min(1); mx = tri[:, :, :2].max(1)
    for x, y in xy:
        c = np.where((mn[:, 0] <= x) & (mx[:, 0] >= x) & (mn[:, 1] <= y) & (mx[:, 1] >= y))[0]; best = -1e9
        for t in tri[c]:
            (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = t
            d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
            if abs(d) < 1e-14: continue
            l0 = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d; l1 = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d; l2 = 1 - l0 - l1
            if min(l0, l1, l2) >= -1e-6: best = max(best, l0 * z0 + l1 * z1 + l2 * z2)
        out.append(best)
    return np.array(out)

bl = np.array([float(v) for v in a.blm.split(',')]).reshape(3, 2); hl = np.array([float(v) for v in a.hlm.split(',')]).reshape(3, 2)
# 몸 쪽 깊이는 «지울 옛 머리» 가 아니라 얼굴 표면 — 옛 얼굴 면(Head 무게)로 잰다
face_tris = IDX[(headw[IDX] >= a.drop_head).all(1)]
bz = front_z(P, face_tris, bl); hz = front_z(HP, HI, hl)
B3 = np.c_[bl, bz]; H3 = np.c_[hl, hz]
s = np.mean([np.linalg.norm(bl[0] - bl[1]) / np.linalg.norm(hl[0] - hl[1]),
             np.linalg.norm(bl[:2].mean(0) - bl[2]) / np.linalg.norm(hl[:2].mean(0) - hl[2])]) * a.scale
t = B3.mean(0) - s * H3.mean(0); t[2] += a.dz
print(f'맞춤: 배율 {s:.4f} · 이동 {t.round(4)} · 눈-눈 비 {np.linalg.norm(bl[0]-bl[1])/np.linalg.norm(hl[0]-hl[1]):.4f} · 눈-입 비 {np.linalg.norm(bl[:2].mean(0)-bl[2])/np.linalg.norm(hl[:2].mean(0)-hl[2]):.4f}')
print(f'  깊이: 몸 {bz.round(4)} · 머리(옮긴 뒤) {(hz*s+t[2]).round(4)}')
HP = HP * s + t

def head_tri_color():
    hm_ = JH['materials'][mat_i] if mat_i is not None else {}
    im_ = image_of(JH, BH, hm_['pbrMetallicRoughness']['baseColorTexture']['index']).convert('RGB')
    im_.thumbnail((1024, 1024)); TXh = np.asarray(im_).astype(np.float64); th_, tw_ = TXh.shape[:2]
    uvc = np.concatenate([HUV[HI], HUV[HI].mean(1, keepdims=True)], 1).reshape(-1, 2)
    uvc = uvc - np.floor(uvc)
    return TXh[np.clip((uvc[:, 1] * th_).astype(int), 0, th_ - 1), np.clip((uvc[:, 0] * tw_).astype(int), 0, tw_ - 1)].reshape(-1, 4, 3).mean(1)

# 새 머리: 목 아래 자르기
if a.cut is not None:
    keepf = ~(HP[HI][:, :, 1] < a.cut).all(1)
    if a.keep_hair:
        hl_, hs_ = [float(v) for v in a.keep_hair.split(',')]; col = head_tri_color()
        hairlike = (col @ [0.299, 0.587, 0.114] >= hl_) & (col.max(1) - col.min(1) <= hs_)
        print(f'  목 아래 머리칼 남김: {int((~keepf & hairlike).sum())} 면'); keepf |= hairlike
    HI = HI[keepf]
    used = np.unique(HI); remap = -np.ones(len(HP), np.int64); remap[used] = np.arange(len(used))
    HP, HN, HUV, HI = HP[used], HN[used], HUV[used], remap[HI]
    print(f'새 머리 목 아래 자름(y<{a.cut}): 남은 면 {len(HI)}')

# 옛 머리 지우기
drop = (headw[IDX] >= a.drop_head).all(1)
if a.keep:
    ky = float(a.keep); drop &= ~(P[IDX][:, :, 1] < ky).all(1)
IDX2 = IDX[~drop]
if a.keep_dark:
    ky, kl = [float(v) for v in a.keep_dark.split(',')]
    UVb = acc(JB, BB, prim['attributes']['TEXCOORD_0']).astype(np.float64)
    bt = JB['materials'][prim.get('material', 0)]['pbrMetallicRoughness']['baseColorTexture']['index']
    TX = np.asarray(image_of(JB, BB, bt).convert('L')).astype(np.float64); th_, tw_ = TX.shape
    uvc = np.concatenate([UVb[IDX], UVb[IDX].mean(1, keepdims=True)], 1).reshape(-1, 2)
    lum = TX[np.clip((uvc[:, 1] * th_).astype(int), 0, th_ - 1), np.clip((uvc[:, 0] * tw_).astype(int), 0, tw_ - 1)].reshape(-1, 4).mean(1)
    kd = drop & (P[IDX][:, :, 1] < ky).all(1) & (lum < kl); drop &= ~kd
    print(f'  목도리·옷깃(y<{ky} · 밝기<{kl}) 남김: {int(kd.sum())}')
print(f'옛 머리 면 지움: {int(drop.sum())} (Head 무게 ≥ {a.drop_head})')
def tri_lum():
    UVb = acc(JB, BB, prim['attributes']['TEXCOORD_0']).astype(np.float64)
    bt = JB['materials'][prim.get('material', 0)]['pbrMetallicRoughness']['baseColorTexture']['index']
    TX = np.asarray(image_of(JB, BB, bt).convert('L')).astype(np.float64); th_, tw_ = TX.shape
    uvc = np.concatenate([UVb[IDX], UVb[IDX].mean(1, keepdims=True)], 1).reshape(-1, 2)
    return TX[np.clip((uvc[:, 1] * th_).astype(int), 0, th_ - 1), np.clip((uvc[:, 0] * tw_).astype(int), 0, tw_ - 1)].reshape(-1, 4).mean(1)
if a.drop_skin:
    sy, sl, sr = [float(v) for v in a.drop_skin.split(',')]
    hc = P[headw > 0.9].mean(0); cen = P[IDX].mean(1)
    ds = ~drop & (P[IDX][:, :, 1] > sy).all(1) & (tri_lum() >= sl) & (np.hypot(cen[:, 0] - hc[0], cen[:, 2] - hc[2]) < sr)
    drop |= ds; print(f'  옛 목 피부(y>{sy} · 밝기≥{sl} · 반경 {sr}) 지움: {int(ds.sum())}')
if a.debris:
    dn, dy_ = a.debris.split(','); dn = int(dn); dy_ = float(dy_)
    rest = np.where(~drop)[0]
    key = np.round(P / 1e-5).astype(np.int64); _, wid = np.unique(key, axis=0, return_inverse=True); wid = wid.ravel()
    par = np.arange(wid.max() + 1)
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for t3 in wid[IDX[rest]]:
        r0 = find(t3[0]); par[find(t3[1])] = r0; par[find(t3[2])] = r0
    root = np.array([find(x) for x in wid[IDX[rest, 0]]]); _, inv_, cnt_ = np.unique(root, return_inverse=True, return_counts=True)
    cy_ = P[IDX[rest]].mean(1)[:, 1]
    cmax = np.zeros(len(cnt_)); np.maximum.at(cmax, inv_, cy_)
    dd = (cnt_[inv_] < dn) & (cmax[inv_] > dy_); drop[rest[dd]] = True
    print(f'  떠 있는 조각(<{dn}면 · y>{dy_}) 지움: 덩어리 {len(np.unique(inv_[dd]))} · 면 {int(dd.sum())}')
IDX2 = IDX[~drop]

if a.push_out > 0 and a.rigid_y is not None:
    # 남은 옛 몸의 앞(최대 z)·뒤(최소 z) 깊이 지도 — 3 mm 격자
    G = 0.003; tri = P[IDX2]; lo = np.array([-0.35, 0.9]); nx, ny = int(0.7 / G), int(0.8 / G)
    ZF = np.full((ny, nx), -np.inf); ZB = np.full((ny, nx), np.inf)
    for t3 in tri:
        mn = np.floor((t3[:, :2].min(0) - lo) / G).astype(int); mx = np.ceil((t3[:, :2].max(0) - lo) / G).astype(int)
        if mx[0] < 0 or mx[1] < 0 or mn[0] >= nx or mn[1] >= ny: continue
        mn = np.maximum(mn, 0); mx = np.minimum(mx, [nx - 1, ny - 1])
        X, Y = np.meshgrid(np.arange(mn[0], mx[0] + 1), np.arange(mn[1], mx[1] + 1))
        px_ = lo[0] + (X + .5) * G; py_ = lo[1] + (Y + .5) * G
        (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = t3
        d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(d) < 1e-14: continue
        l0 = ((y1 - y2) * (px_ - x2) + (x2 - x1) * (py_ - y2)) / d; l1 = ((y2 - y0) * (px_ - x2) + (x0 - x2) * (py_ - y2)) / d; l2 = 1 - l0 - l1
        ins = (l0 >= -1e-6) & (l1 >= -1e-6) & (l2 >= -1e-6); z = l0 * z0 + l1 * z1 + l2 * z2
        sf = ZF[Y, X]; sb = ZB[Y, X]
        ZF[Y, X] = np.where(ins & (z > sf), z, sf); ZB[Y, X] = np.where(ins & (z < sb), z, sb)
    ix = np.clip(((HP[:, 0] - lo[0]) / G).astype(int), 0, nx - 1); iy = np.clip(((HP[:, 1] - lo[1]) / G).astype(int), 0, ny - 1)
    zf, zb = ZF[iy, ix], ZB[iy, ix]; cov = np.isfinite(zf) & np.isfinite(zb) & (HP[:, 1] < a.rigid_y)
    mid = (zf + zb) / 2; push = np.zeros(len(HP))
    fr = cov & (HP[:, 2] >= mid) & (HP[:, 2] < zf + a.push_out); push[fr] = (zf + a.push_out - HP[:, 2])[fr]
    bk = cov & (HP[:, 2] < mid) & (HP[:, 2] > zb - a.push_out); push[bk] = (zb - a.push_out - HP[:, 2])[bk]
    # 둘레로 부드럽게: 반경 2.5 cm 안 밀린 정점의 값(거리 감쇠) 중 절댓값이 가장 큰 것
    push[np.abs(push) > a.push_cap] = 0   # 너무 깊이 묻힌 곳은 그냥 가려 둔다 — 멀리 밀면 머리칼이 늘어난다
    src = np.where(push != 0)[0]; R_ = 0.025; out_ = push.copy()
    for i0 in range(0, len(HP), 1024):
        q = HP[i0:i0 + 1024]; d = np.sqrt(((q[:, None, :] - HP[src][None]) ** 2).sum(-1)); f = np.clip(1 - d / R_, 0, 1) * push[src][None]
        sel_ = np.abs(f).argmax(1); out_[i0:i0 + 1024] = f[np.arange(len(q)), sel_]
    out_[HP[:, 1] >= a.rigid_y] = 0
    HP[:, 2] += out_
    print(f'머리칼 밀어내기: 앞 {int(fr.sum())} · 뒤 {int(bk.sum())} 정점 (최대 {np.abs(out_).max()*100:.1f} cm)')

# 새 정점 스킨 무게: 가장 가까운 «머리·목» 옛 정점
cand = np.where(headw + neckw > 0.5)[0]
if a.weights_light:
    UVb = acc(JB, BB, prim['attributes']['TEXCOORD_0']).astype(np.float64)
    bt = JB['materials'][prim.get('material', 0)]['pbrMetallicRoughness']['baseColorTexture']['index']
    TX = np.asarray(image_of(JB, BB, bt).convert('L')).astype(np.float64); th_, tw_ = TX.shape
    vl = TX[np.clip((UVb[:, 1] * th_).astype(int), 0, th_ - 1), np.clip((UVb[:, 0] * tw_).astype(int), 0, tw_ - 1)]
    cand = np.union1d(cand, np.where(vl >= a.weights_light)[0]); print(f'  무게 후보: 머리·목 + 밝은 옛 정점 = {len(cand)}')
CP = P[cand]
nj = np.zeros((len(HP), 4), np.int64); nw = np.zeros((len(HP), 4))
for i0 in range(0, len(HP), 2048):
    q = HP[i0:i0 + 2048]; d = ((q[:, None, :] - CP[None]) ** 2).sum(-1); k = cand[d.argmin(1)]
    nj[i0:i0 + 2048] = JO[k]; nw[i0:i0 + 2048] = WE[k]
if a.rigid_y is not None and a.blend > 0:
    band = np.where((HP[:, 1] < a.rigid_y) & (HP[:, 1] >= a.rigid_y - a.blend))[0]
    for i in band:
        t_ = (HP[i, 1] - (a.rigid_y - a.blend)) / a.blend; wh = t_ * t_ * (3 - 2 * t_)
        acc_w = {}
        for j, w in zip(nj[i], nw[i]):
            if w > 0: acc_w[int(j)] = acc_w.get(int(j), 0) + w * (1 - wh)
        acc_w[H_] = acc_w.get(H_, 0) + wh
        top = sorted(acc_w.items(), key=lambda kv: -kv[1])[:4] + [(0, 0.0)] * 4
        nj[i] = [k for k, _ in top[:4]]; nw[i] = [v for _, v in top[:4]]
    print(f'턱 아래 {a.blend*100:.0f} cm 무게 섞기: 정점 {len(band)}')
if a.rigid_y is not None:
    up = HP[:, 1] >= a.rigid_y; nj[up] = [H_, 0, 0, 0]; nw[up] = [1, 0, 0, 0]
    print(f'턱 위(y≥{a.rigid_y}) Head 1.0: 정점 {int(up.sum())}')
nw /= nw.sum(1, keepdims=True) + 1e-12

# 머리 텍스처
hm = JH['materials'][mat_i] if mat_i is not None else {}
pbr = hm.get('pbrMetallicRoughness', {})
timgs = {}
def tex_bytes(ti, kind):
    im = image_of(JH, BH, ti); im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') and kind == 'base' else 'RGB')
    if max(im.size) > a.tex: im = im.resize((a.tex, a.tex) if im.size[0] == im.size[1] else (int(im.size[0] * a.tex / max(im.size)), int(im.size[1] * a.tex / max(im.size))), Image.LANCZOS)
    b = io.BytesIO()
    if im.mode == 'RGBA' and np.asarray(im)[..., 3].min() < 250: im.save(b, 'PNG', optimize=True); return b.getvalue(), 'image/png'
    im.convert('RGB').save(b, 'JPEG', quality=92); return b.getvalue(), 'image/jpeg'
if 'baseColorTexture' in pbr: timgs['base'] = tex_bytes(pbr['baseColorTexture']['index'], 'base')
if 'normalTexture' in hm: timgs['normal'] = tex_bytes(hm['normalTexture']['index'], 'normal')
if 'metallicRoughnessTexture' in pbr and not a.no_mr: timgs['mr'] = tex_bytes(pbr['metallicRoughnessTexture']['index'], 'mr')
print('머리 텍스처:', {k: (v[1], len(v[0])) for k, v in timgs.items()})

# ── 쓰기: 쓰는 접근자만 빽빽하게 ─────────────────────────────────────────
J = JB; out = bytearray(); views = []; accs = []
def view(b, target=None):
    global out
    while len(out) % 4: out += b'\0'
    v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(b)}
    if target: v['target'] = target
    views.append(v); out += b; return len(views) - 1
def new_acc(arr, ctype, typ, target=None, minmax=False):
    arr = np.ascontiguousarray(arr.astype(CT[ctype])); A = {'bufferView': view(arr.tobytes(), target), 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
    if minmax: A['min'] = arr.min(0).tolist(); A['max'] = arr.max(0).tolist()
    accs.append(A); return len(accs) - 1
amap = {}
def copy_acc(i):
    if i in amap: return amap[i]
    A = dict(J['accessors'][i]); V = J['bufferViews'][A['bufferView']]; n = NC[A['type']]; sz = np.dtype(CT[A['componentType']]).itemsize
    o = V.get('byteOffset', 0) + A.get('byteOffset', 0); A.pop('byteOffset', None)
    A['bufferView'] = view(BB[o:o + A['count'] * n * sz], V.get('target')); accs.append(A); amap[i] = len(accs) - 1; return amap[i]
for k in list(prim['attributes']): prim['attributes'][k] = copy_acc(prim['attributes'][k])
ict = 5125 if max(len(P), len(HP)) >= 65536 else 5123
prim['indices'] = new_acc(IDX2.reshape(-1), ict, 'SCALAR', 34963)
if 'inverseBindMatrices' in skin: skin['inverseBindMatrices'] = copy_acc(skin['inverseBindMatrices'])
for an in J.get('animations', []):
    for sm in an['samplers']: sm['input'] = copy_acc(sm['input']); sm['output'] = copy_acc(sm['output'])
# 옛 이미지
for im in J['images']:
    V = J['bufferViews'][im['bufferView']]; o = V.get('byteOffset', 0); im['bufferView'] = view(BB[o:o + V['byteLength']])
# 새 머리 프리미티브
jct = J['accessors'][prim['attributes']['JOINTS_0']]['componentType']
hat = {'POSITION': new_acc(HP, 5126, 'VEC3', 34962, True), 'NORMAL': new_acc(HN, 5126, 'VEC3', 34962),
       'TEXCOORD_0': new_acc(HUV, 5126, 'VEC2', 34962), 'JOINTS_0': new_acc(nj, jct, 'VEC4', 34962), 'WEIGHTS_0': new_acc(nw, 5126, 'VEC4', 34962)}
hidx = new_acc(HI.reshape(-1), ict, 'SCALAR', 34963)
J.setdefault('samplers', [{'magFilter': 9729, 'minFilter': 9987}])
def add_tex(key):
    b, mime = timgs[key]; J['images'].append({'bufferView': view(b), 'mimeType': mime, 'name': f'head_{key}'})
    J['textures'].append({'sampler': 0, 'source': len(J['images']) - 1}); return len(J['textures']) - 1
mat = {'name': 'head_graft', 'pbrMetallicRoughness': {'metallicFactor': 0.0, 'roughnessFactor': 0.8}}
if 'base' in timgs: mat['pbrMetallicRoughness']['baseColorTexture'] = {'index': add_tex('base')}
if 'normal' in timgs: mat['normalTexture'] = {'index': add_tex('normal')}
if 'mr' in timgs: mat['pbrMetallicRoughness']['metallicRoughnessTexture'] = {'index': add_tex('mr')}; mat['pbrMetallicRoughness']['metallicFactor'] = 0.0; mat['pbrMetallicRoughness']['roughnessFactor'] = 1.0   # 거칠기만 텍스처 — 금속값은 0(머리칼이 쇠처럼 번쩍였다)
if timgs.get('base', (0, ''))[1] == 'image/png': mat['alphaMode'] = 'MASK'; mat['alphaCutoff'] = 0.4; mat['doubleSided'] = True
J['materials'].append(mat)
J['meshes'][0]['primitives'].append({'attributes': hat, 'indices': hidx, 'material': len(J['materials']) - 1})
J['accessors'] = accs; J['bufferViews'] = views
while len(out) % 4: out += b'\0'
J['buffers'] = [{'byteLength': len(out)}]
J.setdefault('asset', {}).setdefault('extras', {})['headGraft'] = {'tool': 'tools/3d/head-graft.py (docs/design/79)', 'scale': round(float(s), 5), 'offset': [round(float(v), 5) for v in t]}
js = json.dumps(J, separators=(',', ':'), ensure_ascii=False).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
ob = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(a.out, 'wb').write(ob); print('썼다', a.out, len(ob))
