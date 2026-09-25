"""얼굴 투영 굽기 — 설정 시트 얼굴을 3D 얼굴 텍스처에 «정면에서 비춰» 굽는다 (docs/design/78).

왜: Hi3D 가 설정 시트 3면도(얼굴 50~60 px)로 만든 얼굴은 이목구비가 흐리고, 코 옆 덩어리(아인)·
머리칼 조각이 얼굴을 뚫는 금(세라) 같은 잡티가 있다. 얼굴 사진(설정 시트 얼굴 확대본)을 정면 직교로
투영해서 기존 텍스처의 얼굴 자리에 그려 넣는다 — UV·재질·정점은 그대로, 텍스처만 바뀐다.

  python3 tools/3d/face-project.py <glb> <얼굴 이미지> --mesh ex1,ey1,ex2,ey2,mx,my --img ex1,ey1,ex2,ey2,mx,my
         --mask cx,cy,rx,ry[,feather] [--out 파일] [--tone 0.7]
  --mesh : 메시 정면(바인드) 좌표 m — 왼눈(화면 왼쪽)·오른눈·입 가운데 (tools/3d/face-ortho.html 로 찾는다)
  --img  : 얼굴 이미지 픽셀 — 같은 세 점
  --mask : 이미지 픽셀 타원(피부만, 머리칼 제외) · 가장자리 부드럽게
  --tone : 이미지 색을 원래 피부 색으로 맞추는 세기(0~1)

규칙
  · 정면에서 «보이는» 면만 칠한다(깊이 버퍼) — 코 옆 덩어리·얼굴을 뚫는 머리칼 조각도 피부로 덮인다
  · 법선이 옆을 볼수록 덜 칠한다(볼 옆면이 늘어나지 않게)
  · 세 점으로 아핀 맞춤 — 눈 사이·눈-입 비율이 달라도 맞는다
"""
import sys, json, struct, io, argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('glb'); ap.add_argument('face')
ap.add_argument('--mesh', required=True); ap.add_argument('--img', required=True); ap.add_argument('--mask', required=True)
ap.add_argument('--out'); ap.add_argument('--tone', type=float, default=0.7); ap.add_argument('--preview')
ap.add_argument('--contrast', type=float, default=0.2, help='대비를 원래 텍스처 쪽으로 맞추는 정도(0 = 시트 대비 그대로) — 1 이면 흐려진다')
ap.add_argument('--keep-dark', type=float, default=0, help='원래 텍스처가 이 밝기(0~255)보다 어두운 삼각형(검은 머리칼)은 칠하지 않고 가림막으로도 안 친다')
ap.add_argument('--core', type=float, default=0.8, help='가면 타원 안쪽 이 비율까지는 옆을 봐도 끝까지 칠한다(코 옆 덩어리가 조각으로 남지 않게)')
ap.add_argument('--core-depth', type=float, default=0.006, help='가면 안쪽에서 앞면 뒤 몇 m 까지 칠하나')
ap.add_argument('--drop-debris', type=int, default=0, help='가면 안쪽의 작은 떠 있는 조각(삼각형 N 개 미만의 연결 덩어리)을 지운다 — 아인 코 옆 덩어리')
ap.add_argument('--smooth-normals', type=float, default=0, help='얼굴 피부 법선을 반경 R(m) 안 면 법선 평균으로 — 큰 평면이 각져 보이는 것(로우폴리 얼굴)을 둥글게 비춘다')
ap.add_argument('--island', type=int, default=0, help='얼굴 전용 섬(px) — 텍스처 아래에 S px 띠를 붙여 얼굴을 고해상도로 다시 편다')
a = ap.parse_args()

buf = open(a.glb, 'rb').read()
jl = struct.unpack_from('<I', buf, 12)[0]
J = json.loads(buf[20:20 + jl]); bl = struct.unpack_from('<I', buf, 20 + jl)[0]; BIN = bytearray(buf[28 + jl:28 + jl + bl])
CT = {5126: ('f', 4), 5123: ('H', 2), 5125: ('I', 4), 5121: ('B', 1)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def acc(i):
    A = J['accessors'][i]; V = J['bufferViews'][A['bufferView']]; t, s = CT[A['componentType']]; n = NC[A['type']]
    off = V.get('byteOffset', 0) + A.get('byteOffset', 0)
    arr = np.frombuffer(bytes(BIN[off:off + A['count'] * n * s]), dtype={'f': '<f4', 'H': '<u2', 'I': '<u4', 'B': 'u1'}[t])
    return arr.reshape(A['count'], n) if n > 1 else arr
prim = J['meshes'][0]['primitives'][0]
P = acc(prim['attributes']['POSITION']).astype(np.float64); N = acc(prim['attributes']['NORMAL']).astype(np.float64)
UV = acc(prim['attributes']['TEXCOORD_0']).astype(np.float64); IDX = acc(prim['indices']).reshape(-1, 3)
tex_i = J['textures'][J['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
img = J['images'][tex_i]; V = J['bufferViews'][img['bufferView']]
TEX = np.asarray(Image.open(io.BytesIO(bytes(BIN[V.get('byteOffset', 0):V.get('byteOffset', 0) + V['byteLength']]))).convert('RGB')).astype(np.float64)
TH, TW = TEX.shape[:2]
FACE = np.asarray(Image.open(a.face).convert('RGB')).astype(np.float64); FH, FW = FACE.shape[:2]

# 메시(x,y) → 이미지(u,v) 아핀 — 세 점
m = [float(v) for v in a.mesh.split(',')]; g = [float(v) for v in a.img.split(',')]
Ms = np.array([[m[0], m[1], 1], [m[2], m[3], 1], [m[4], m[5], 1]]); Gs = np.array([[g[0], g[1]], [g[2], g[3]], [g[4], g[5]]])
AF = np.linalg.solve(Ms, Gs)   # 3x2
def to_img(xy): return np.c_[xy, np.ones(len(xy))] @ AF
cx, cy, rx, ry, *fe = [float(v) for v in a.mask.split(',')]; feather = fe[0] if fe else 0.18
def ell(uv): return np.sqrt(((uv[:, 0] - cx) / rx) ** 2 + ((uv[:, 1] - cy) / ry) ** 2)
def mask_at(uv): return np.clip((1 - ell(uv)) / feather, 0, 1)

def sample(img, u, v):   # 쌍선형
    H, W = img.shape[:2]; u = np.clip(u, 0, W - 1.001); v = np.clip(v, 0, H - 1.001)
    i, j = v.astype(int), u.astype(int); fu, fv = (u - j)[:, None], (v - i)[:, None]
    return img[i, j] * (1 - fu) * (1 - fv) + img[i, j + 1] * fu * (1 - fv) + img[i + 1, j] * (1 - fu) * fv + img[i + 1, j + 1] * fu * fv

IDX_CHANGED = False
if a.drop_debris > 0:
    # 같은 자리 정점을 하나로 보고 연결 덩어리를 나눈다 — 얼굴 가면 안쪽의 작은 덩어리는 Hi3D 가 남긴 부스러기
    key = np.round(P / 1e-5).astype(np.int64); _, wid = np.unique(key, axis=0, return_inverse=True); wid = wid.ravel()
    par = np.arange(wid.max() + 1)
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for t3 in wid[IDX]:
        r0 = find(t3[0]); par[find(t3[1])] = r0; par[find(t3[2])] = r0
    root = np.array([find(x) for x in wid[IDX[:, 0]]]); u_, inv_, cnt_ = np.unique(root, return_inverse=True, return_counts=True)
    cen_ = P[IDX].mean(1); small = cnt_[inv_] < a.drop_debris
    inmask = ell(to_img(cen_[:, :2])) < a.core
    # 덩어리 전체가 가면 안쪽일 때만 (머리칼 끝이 조금 들어온 것은 두지 않는다 — 작은 덩어리만)
    comp_in = np.zeros(len(u_), bool); comp_all = np.bincount(inv_, minlength=len(u_)); comp_inn = np.bincount(inv_, weights=inmask, minlength=len(u_))
    comp_in = comp_inn >= comp_all
    drop = small & comp_in[inv_]
    IDX = IDX[~drop]; IDX_CHANGED = bool(drop.any())
    print(f'부스러기 지움: 덩어리 {len(np.unique(inv_[drop]))} · 삼각형 {int(drop.sum())}')

# 얼굴 쪽 메시 범위 (이미지 타원을 메시로 되돌린 상자)
inv = np.linalg.inv(np.vstack([AF.T, [0, 0, 1]]))   # [u,v,1] → [x,y,1]
corners = np.array([[cx - rx, cy - ry, 1], [cx + rx, cy - ry, 1], [cx - rx, cy + ry, 1], [cx + rx, cy + ry, 1]]) @ inv.T
x0, x1, y0, y1 = corners[:, 0].min(), corners[:, 0].max(), corners[:, 1].min(), corners[:, 1].max()

# 정면 깊이 버퍼 (보이는 면만 칠한다)
DR = 700; dx = (x1 - x0) / DR; dh = int((y1 - y0) / dx) + 1
DEP = np.full((dh, DR), -1e9)
tri = P[IDX]
sel = (tri[:, :, 0].max(1) >= x0) & (tri[:, :, 0].min(1) <= x1) & (tri[:, :, 1].max(1) >= y0) & (tri[:, :, 1].min(1) <= y1)
if a.keep_dark > 0:
    # 검은 머리칼 조각(원래 텍스처가 어두운 삼각형)은 그대로 둔다 — 칠하지도, 뒤 피부를 가리지도 않는다
    tuv = np.concatenate([UV[IDX], UV[IDX].mean(1, keepdims=True)], 1).reshape(-1, 2) * [TW, TH]
    lum = (sample(TEX, tuv[:, 0], tuv[:, 1]) @ [0.299, 0.587, 0.114]).reshape(-1, 4).mean(1)
    dark = sel & (lum < a.keep_dark); sel = sel & ~dark
    print(f'어두운(머리칼) 삼각형 {int(dark.sum())} 은 그대로')
for t in tri[sel]:
    px = (t[:, 0] - x0) / dx; py = (y1 - t[:, 1]) / dx
    ix0, ix1 = max(0, int(px.min())), min(DR - 1, int(px.max()) + 1); iy0, iy1 = max(0, int(py.min())), min(dh - 1, int(py.max()) + 1)
    if ix0 > ix1 or iy0 > iy1: continue
    X, Y = np.meshgrid(np.arange(ix0, ix1 + 1) + .5, np.arange(iy0, iy1 + 1) + .5)
    d = (py[1] - py[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (py[0] - py[2])
    if abs(d) < 1e-12: continue
    l0 = ((py[1] - py[2]) * (X - px[2]) + (px[2] - px[1]) * (Y - py[2])) / d
    l1 = ((py[2] - py[0]) * (X - px[2]) + (px[0] - px[2]) * (Y - py[2])) / d; l2 = 1 - l0 - l1
    ins = (l0 >= -1e-6) & (l1 >= -1e-6) & (l2 >= -1e-6)
    z = l0 * t[0, 2] + l1 * t[1, 2] + l2 * t[2, 2]
    sub = DEP[iy0:iy1 + 1, ix0:ix1 + 1]; np.copyto(sub, np.where(ins & (z > sub), z, sub))
def depth_at(xy):
    ix = np.clip(((xy[:, 0] - x0) / dx).astype(int), 0, DR - 1); iy = np.clip(((y1 - xy[:, 1]) / dx).astype(int), 0, dh - 1)
    return DEP[iy, ix]


def raster(uvpx, tol=-0.02):
    """삼각형 하나를 픽셀 격자에 — (X, Y, 무게중심좌표) 를 돌려준다"""
    ix0, ix1 = int(np.floor(uvpx[:, 0].min())), int(np.ceil(uvpx[:, 0].max())); iy0, iy1 = int(np.floor(uvpx[:, 1].min())), int(np.ceil(uvpx[:, 1].max()))
    X, Y = np.meshgrid(np.arange(ix0, ix1 + 1) + .5, np.arange(iy0, iy1 + 1) + .5); X, Y = X.ravel(), Y.ravel()
    d = (uvpx[1, 1] - uvpx[2, 1]) * (uvpx[0, 0] - uvpx[2, 0]) + (uvpx[2, 0] - uvpx[1, 0]) * (uvpx[0, 1] - uvpx[2, 1])
    if abs(d) < 1e-9: return None
    l0 = ((uvpx[1, 1] - uvpx[2, 1]) * (X - uvpx[2, 0]) + (uvpx[2, 0] - uvpx[1, 0]) * (Y - uvpx[2, 1])) / d
    l1 = ((uvpx[2, 1] - uvpx[0, 1]) * (X - uvpx[2, 0]) + (uvpx[0, 0] - uvpx[2, 0]) * (Y - uvpx[2, 1])) / d; l2 = 1 - l0 - l1
    ins = (l0 >= tol) & (l1 >= tol) & (l2 >= tol)
    if not ins.any(): return None
    return X[ins], Y[ins], np.c_[l0, l1, l2][ins]

def weight_of(pos, nor):
    uvimg = to_img(pos[:, :2]); incore = ell(uvimg) < a.core
    # 가면 안쪽은 앞면 바로 뒤(core-depth)까지 칠한다 — 튀어나온 덩어리의 윗면·옆면은 정면에서 안 보여도 비스듬히는 보인다
    vis = pos[:, 2] >= depth_at(pos[:, :2]) - np.where(incore, a.core_depth, 0.006)
    face_on = np.clip((nor[:, 2] - 0.05) / 0.25, 0, 1)   # 옆을 볼수록 덜 — 로우폴리 법선이 흔들려도 앞얼굴은 1
    face_on = np.maximum(face_on, np.clip((a.core - ell(uvimg)) / 0.1, 0, 1))   # 가면 안쪽은 옆면도 끝까지
    return mask_at(uvimg) * face_on * vis, uvimg

def tone_blend(src, orig, W_):
    core = W_ > 0.5
    if core.sum() > 50 and a.tone > 0:
        ms, ss = src[core].mean(0), src[core].std(0) + 1e-6; mo, so = orig[core].mean(0), orig[core].std(0) + 1e-6
        src = src * (1 - a.tone) + ((src - ms) * (so / ss) ** a.contrast + mo) * a.tone   # 평균(피부 톤)은 맞추고 대비는 시트 쪽
    return orig * (1 - W_[:, None]) + np.clip(src, 0, 255) * W_[:, None]

fsel = np.where(sel)[0]
N_OUT = None
if a.smooth_normals > 0:
    # 칠할 피부 삼각형(가면 안 · 보임 · 머리칼 아님)의 면 법선을 넓게 평균 — 모양은 그대로, 빛만 둥글게
    cen = P[IDX[fsel]].mean(1); e1 = P[IDX[fsel, 1]] - P[IDX[fsel, 0]]; e2 = P[IDX[fsel, 2]] - P[IDX[fsel, 0]]
    fn = np.cross(e1, e2); ar = np.linalg.norm(fn, axis=1); fn = fn / (ar[:, None] + 1e-12)
    wcen = mask_at(to_img(cen[:, :2])) * (cen[:, 2] >= depth_at(cen[:, :2]) - 0.006) * (fn[:, 2] > -0.2)
    skin = wcen > 0; cS, fS, aS = cen[skin], fn[skin], ar[skin]
    vids_ = np.unique(IDX[fsel[skin]]); R_ = a.smooth_normals
    N_OUT = N.copy(); cnt_s = 0
    for v in vids_:
        d = np.linalg.norm(cS - P[v], axis=1); k = d < R_
        if not k.any(): continue
        acc_n = ((aS[k] * (1 - d[k] / R_))[:, None] * fS[k]).sum(0); ln = np.linalg.norm(acc_n)
        if ln < 1e-12: continue
        w_ = float(mask_at(to_img(P[v:v + 1, :2]))[0]); nn = N[v] * (1 - w_) + acc_n / ln * w_
        N_OUT[v] = nn / (np.linalg.norm(nn) + 1e-12); cnt_s += 1
    print(f'법선 고르게: 정점 {cnt_s} (반경 {R_*100:.1f} cm)')
NEWUV = None
EXTRA_IMG = {}   # 이미지 번호 → 새 바이트 (섬 띠를 붙인 다른 텍스처)
if a.island > 0:
    # ── 얼굴 전용 섬: 앞을 보고 · 보이고 · 가면 안에 드는 삼각형을 새 띠(S px)에 정면 투영으로 다시 편다
    S = a.island; NH = TH + S; m_ = 6
    cen = P[IDX[fsel]].mean(1); cn = N[IDX[fsel]].mean(1); cn /= np.linalg.norm(cn, axis=1, keepdims=True) + 1e-9
    wc, _ = weight_of(cen, cn)
    core_c = ell(to_img(cen[:, :2])) < a.core
    isl = fsel[(wc > 0.0) & ((cn[:, 2] > 0.25) | core_c)]
    # 섬 UV 는 정면 투영이라 옆·위를 보는 삼각형은 가늘게 눌린다 — 덩어리 윗면은 색이 한 줄로 늘어나지만 피부색이라 괜찮다
    vids = np.unique(IDX[isl]); xy = P[vids, :2]
    bx0, by0 = xy.min(0); bx1, by1 = xy.max(0); sc = (S - 2 * m_) / max(bx1 - bx0, by1 - by0)
    ox = m_ + ((S - 2 * m_) - (bx1 - bx0) * sc) / 2
    def island_px(q): return np.c_[(q[:, 0] - bx0) * sc + ox, TH + m_ + (by1 - q[:, 1]) * sc]
    NEW = np.zeros((NH, TW, 3)); NEW[:TH] = TEX; filled = np.zeros((NH, TW), bool); filled[:TH] = True
    Ts, Ws, Ls, Os = [], [], [], []
    for k in isl:
        ids = IDX[k]; r = raster(island_px(P[ids]), -0.03)
        if r is None: continue
        X, Y, L = r; pos = L @ P[ids]; nor = L @ N[ids]; nor /= np.linalg.norm(nor, axis=1, keepdims=True) + 1e-9
        w, uvimg = weight_of(pos, nor); ouv = (L @ UV[ids]) * [TW, TH]
        Ts.append(np.c_[X, Y].astype(int)); Ws.append(w); Ls.append(uvimg); Os.append(ouv)
    T_ = np.vstack(Ts); W_ = np.concatenate(Ws); L_ = np.vstack(Ls); O_ = np.vstack(Os)
    ok = (T_[:, 0] >= 0) & (T_[:, 0] < TW) & (T_[:, 1] >= TH) & (T_[:, 1] < NH); T_, W_, L_, O_ = T_[ok], W_[ok], L_[ok], O_[ok]
    orig = sample(TEX, O_[:, 0], O_[:, 1]); src = sample(FACE, L_[:, 0], L_[:, 1])
    NEW[T_[:, 1], T_[:, 0]] = tone_blend(src, orig, W_); filled[T_[:, 1], T_[:, 0]] = True
    def dilate(img_, fil, n=6):   # 섬 밖으로 번지게(밉맵에서 이음새가 안 보이게)
        fil = fil.copy()
        for _ in range(n):
            e = ~fil
            if not e.any(): break
            accum = np.zeros_like(img_); cnt = np.zeros(fil.shape)
            for dy_, dx_ in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                sh = np.roll(np.roll(fil, dy_, 0), dx_, 1); accum += np.where(sh[..., None], np.roll(np.roll(img_, dy_, 0), dx_, 1), 0); cnt += sh
            grow = e & (cnt > 0); img_[grow] = accum[grow] / cnt[grow][:, None]; fil |= grow
    filled0 = filled.copy(); dilate(NEW, filled)
    # 같은 UV 를 쓰는 다른 텍스처(거칠기·금속 등)도 섬 띠를 붙인다 — 안 그러면 섬 UV 가 엉뚱한 곳을 읽는다
    for ti in {v_['index'] for k_, v_ in list(J['materials'][0]['pbrMetallicRoughness'].items()) + list(J['materials'][0].items()) if isinstance(v_, dict) and 'index' in v_}:
        si = J['textures'][ti]['source']
        if si == tex_i: continue
        im_ = J['images'][si]; V2 = J['bufferViews'][im_['bufferView']]
        pil = Image.open(io.BytesIO(bytes(BIN[V2.get('byteOffset', 0):V2.get('byteOffset', 0) + V2['byteLength']])))
        mode = pil.mode if pil.mode in ('RGB', 'RGBA', 'L') else 'RGB'; X_ = np.asarray(pil.convert(mode)).astype(np.float64)
        if X_.ndim == 2: X_ = X_[..., None]
        MH, MW = X_.shape[:2]
        vals = sample(X_, O_[:, 0] * MW / TW, O_[:, 1] * MH / TH)
        # 칠한 곳은 재질도 피부로 — 코 옆 덩어리가 원래 «금속» 값이라 은색으로 번쩍였다. 가면 안쪽의 중앙값(= 피부)으로 무게만큼
        skin = np.median(vals[W_ > 0.95], 0); vals = vals * (1 - W_[:, None]) + skin * W_[:, None]
        strip = np.zeros((NH, TW, X_.shape[2])); strip[T_[:, 1], T_[:, 0]] = vals
        f2 = np.zeros((NH, TW), bool); f2[T_[:, 1], T_[:, 0]] = True; f2[:TH] = True; dilate(strip, f2, 8)
        sh_ = max(1, round(MH * S / TH)); tail = np.asarray(Image.fromarray(strip[TH:].astype(np.uint8).squeeze()).resize((MW, sh_), Image.BILINEAR)).astype(np.float64)
        if tail.ndim == 2: tail = tail[..., None]
        OUT2 = np.concatenate([X_, tail], 0).astype(np.uint8).squeeze()
        b2 = io.BytesIO(); Image.fromarray(OUT2).save(b2, 'PNG' if im_.get('mimeType') == 'image/png' else 'JPEG', **({} if im_.get('mimeType') == 'image/png' else {'quality': 93}))
        EXTRA_IMG[si] = b2.getvalue(); print(f'  텍스처 {si} 도 섬 띠 {MW}x{MH} → {MW}x{MH + sh_}')
    # 정점: 섬 삼각형이 쓰는 정점을 복제해 새 UV (위치·무게는 같아서 이음새는 벌어지지 않는다)
    newid = {int(v): P.shape[0] + i for i, v in enumerate(vids)}
    UVn = UV.copy(); UVn[:, 1] *= TH / NH
    isl_uv = island_px(P[vids]) / [TW, NH]
    IDXn = IDX.copy()
    for k in isl: IDXn[k] = [newid[int(v)] for v in IDX[k]]
    DUP = vids; NEWUV = (np.vstack([UVn, isl_uv]), IDXn, DUP)
    print(f'얼굴 섬 {S}px: 삼각형 {len(isl)} · 정점 복제 {len(vids)} · 텍셀 {len(T_)} · 완전히 시트 {(W_>0.95).mean()*100:.0f}% · 섞임 {((W_>0.05)&(W_<=0.95)).mean()*100:.0f}%')
else:

    Ts, Ws, Ls, Os = [], [], [], []
    fsel = np.where(sel)[0]
    for k in fsel:
        ids = IDX[k]; t = P[ids]; n = N[ids]; uv = UV[ids] * [TW, TH]
        ix0, ix1 = max(0, int(uv[:, 0].min())), min(TW - 1, int(uv[:, 0].max()) + 1); iy0, iy1 = max(0, int(uv[:, 1].min())), min(TH - 1, int(uv[:, 1].max()) + 1)
        X, Y = np.meshgrid(np.arange(ix0, ix1 + 1) + .5, np.arange(iy0, iy1 + 1) + .5); X, Y = X.ravel(), Y.ravel()
        d = (uv[1, 1] - uv[2, 1]) * (uv[0, 0] - uv[2, 0]) + (uv[2, 0] - uv[1, 0]) * (uv[0, 1] - uv[2, 1])
        if abs(d) < 1e-9: continue
        l0 = ((uv[1, 1] - uv[2, 1]) * (X - uv[2, 0]) + (uv[2, 0] - uv[1, 0]) * (Y - uv[2, 1])) / d
        l1 = ((uv[2, 1] - uv[0, 1]) * (X - uv[2, 0]) + (uv[0, 0] - uv[2, 0]) * (Y - uv[2, 1])) / d; l2 = 1 - l0 - l1
        ins = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)   # 가장자리 한 픽셀 더 — 이음새 번짐 방지
        if not ins.any(): continue
        L = np.c_[l0, l1, l2][ins]; pos = L @ t; nor = L @ n; nor /= np.linalg.norm(nor, axis=1, keepdims=True) + 1e-9
        vis = pos[:, 2] >= depth_at(pos[:, :2]) - 0.006
        face_on = np.clip((nor[:, 2] - 0.15) / 0.35, 0, 1)
        uvimg = to_img(pos[:, :2]); w = mask_at(uvimg) * face_on * vis
        keep = w > 0.003
        if not keep.any(): continue
        Ts.append(np.c_[X[ins][keep], Y[ins][keep]].astype(int)); Ws.append(w[keep]); Ls.append(uvimg[keep])
    if not Ts: sys.exit('칠할 곳이 없다 — 좌표를 확인')
    T_ = np.vstack(Ts); W_ = np.concatenate(Ws); L_ = np.vstack(Ls)
    # 같은 텍셀이 여러 번 나오면 가장 큰 무게만
    order = np.argsort(-W_); T_, W_, L_ = T_[order], W_[order], L_[order]
    _, first = np.unique(T_[:, 1] * TW + T_[:, 0], return_index=True); T_, W_, L_ = T_[first], W_[first], L_[first]
    src = sample(FACE, L_[:, 0], L_[:, 1]); orig = TEX[T_[:, 1], T_[:, 0]]
    # 색 맞추기: 이미지 피부의 평균·편차를 원래 얼굴 텍스처에 맞춘다 (무게 큰 곳 기준)
    core = W_ > 0.5
    if core.sum() > 50 and a.tone > 0:
        ms, ss = src[core].mean(0), src[core].std(0) + 1e-6; mo, so = orig[core].mean(0), orig[core].std(0) + 1e-6
        adj = (src - ms) * (so / ss) + mo
        src = src * (1 - a.tone) + adj * a.tone
    out = orig * (1 - W_[:, None]) + np.clip(src, 0, 255) * W_[:, None]
    NEW = TEX.copy(); NEW[T_[:, 1], T_[:, 0]] = out
    print(f'칠한 텍셀 {len(T_)} (완전 {int((W_>0.95).sum())}) · 얼굴 삼각형 {len(fsel)} · 메시 상자 x {x0:.3f}~{x1:.3f} y {y0:.3f}~{y1:.3f}')
    if a.preview: Image.fromarray(NEW.astype(np.uint8)).save(a.preview)


# ── glb 다시 쓰기: 쓰는 접근자만 새 버퍼에 빽빽하게(옛 데이터는 버린다) ──────────────────
if a.preview: Image.fromarray(NEW.astype(np.uint8)).save(a.preview)
jb = io.BytesIO(); Image.fromarray(NEW.astype(np.uint8)).save(jb, 'JPEG', quality=93); NEWJPG = jb.getvalue()
assert all('byteStride' not in v for v in J['bufferViews']), '끼워 넣은(interleaved) 버퍼는 지원 안 함'
DT = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1'}
repl = {}   # 접근자 번호 → (numpy 배열, componentType)
if NEWUV is not None:
    UVall, IDXn, DUP = NEWUV
    for name, ai in prim['attributes'].items():
        if name == 'TEXCOORD_0': repl[ai] = (UVall.astype('<f4'), 5126); continue
        A_ = J['accessors'][ai]; arr = N_OUT.astype('<f4') if (name == 'NORMAL' and N_OUT is not None) else acc(ai); repl[ai] = (np.concatenate([arr, arr[DUP]]).astype(DT[A_['componentType']]), A_['componentType'])
    nv = UVall.shape[0]; ct = 5123 if nv < 65536 else 5125
    repl[prim['indices']] = (IDXn.reshape(-1).astype(DT[ct]), ct)
if NEWUV is None and N_OUT is not None: repl[prim['attributes']['NORMAL']] = (N_OUT.astype('<f4'), 5126)
if NEWUV is None and IDX_CHANGED:
    ct = 5123 if P.shape[0] < 65536 else 5125; repl[prim['indices']] = (IDX.reshape(-1).astype(DT[ct]), ct)
refs = list(prim['attributes'].values()) + [prim['indices']] + [s_['inverseBindMatrices'] for s_ in J.get('skins', []) if 'inverseBindMatrices' in s_]
for an in J.get('animations', []):
    for sm in an['samplers']: refs += [sm['input'], sm['output']]
order_ = sorted(set(refs)); amap = {}; views = []; accs = []; out = bytearray()
def view(b, target=None):
    global out
    while len(out) % 4: out += b'\0'
    v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(b)}
    if target: v['target'] = target
    views.append(v); out += b; return len(views) - 1
for i in order_:
    A_ = dict(J['accessors'][i]); tgt = J['bufferViews'][A_['bufferView']].get('target')
    if i in repl:
        arr, ct = repl[i]; A_['componentType'] = ct; A_['count'] = arr.shape[0]
        if 'min' in A_ and arr.ndim == 2: A_['min'] = arr.min(0).tolist(); A_['max'] = arr.max(0).tolist()
        b = arr.tobytes()
    else:
        V_ = J['bufferViews'][A_['bufferView']]; t, sz = CT[A_['componentType']]; n = NC[A_['type']]; o = V_.get('byteOffset', 0) + A_.get('byteOffset', 0)
        b = bytes(BIN[o:o + A_['count'] * n * sz])
    A_.pop('byteOffset', None); A_['bufferView'] = view(b, tgt); accs.append(A_); amap[i] = len(accs) - 1
for name in list(prim['attributes']): prim['attributes'][name] = amap[prim['attributes'][name]]
prim['indices'] = amap[prim['indices']]
for s_ in J.get('skins', []):
    if 'inverseBindMatrices' in s_: s_['inverseBindMatrices'] = amap[s_['inverseBindMatrices']]
for an in J.get('animations', []):
    for sm in an['samplers']: sm['input'] = amap[sm['input']]; sm['output'] = amap[sm['output']]
for k, im in enumerate(J['images']):
    V_ = J['bufferViews'][im['bufferView']]; o = V_.get('byteOffset', 0)
    im['bufferView'] = view(NEWJPG if k == tex_i else EXTRA_IMG.get(k) or bytes(BIN[o:o + V_['byteLength']]))
J['accessors'] = accs; J['bufferViews'] = views
while len(out) % 4: out += b'\0'
J['buffers'] = [{'byteLength': len(out)}]
J.setdefault('asset', {}).setdefault('extras', {})['faceProject'] = 'tools/3d/face-project.py (docs/design/78)'
js = json.dumps(J, separators=(',', ':'), ensure_ascii=False).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
outb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(a.out or a.glb, 'wb').write(outb); print('썼다', a.out or a.glb, len(buf), '→', len(outb))
