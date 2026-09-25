"""메시 갈아 끼우기 — 새로 만든 캐릭터 메시(Tripo 등)를 우리 뼈대·클립 glb 에 넣는다 (docs/design/80).

왜: 설정 시트대로 «전신을 새로» 만든 메시를 쓰되, 뼈 이름·클립·장비 자리·게임 코드는 그대로 두려고.
이 도구는 메시만 바꾸고 무게는 비워 둔다(전부 골반) → 다음에 tools/3d/rerig-meshy.mjs 가
Meshy 자동 리깅 결과로 관절 위치·무게를 옮기고 클립을 다시 굽는다.

  python3 tools/3d/mesh-swap.py <뼈대 glb> <새 메시 glb> [--rot-y -90] [--tex 2048] --out 파일
  python3 tools/3d/mesh-swap.py <뼈대 glb> <새 메시 glb> --rot-y -90 --static 파일   # Meshy 리깅에 보낼 정적 메시(같은 자리·크기)

맞춤: 새 메시를 +z 가 앞으로 돌리고(--rot-y), 옛 메시 상자에 맞춘다 — 키(높이)로 배율, 가로·깊이 가운데, 발바닥 = 바닥.
재질: 기본색 + 법선 텍스처, 금속·거칠기 인자는 기본값(1/1) 그대로 — js/mat-fix.js 가 다른 캐릭터와 똑같이 고친다.
"""
import sys, json, struct, io, argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('skel'); ap.add_argument('mesh')
ap.add_argument('--rot-y', type=float, default=0.0); ap.add_argument('--tex', type=int, default=2048)
ap.add_argument('--height', type=float, default=None, help='새 메시 키(m) — 없으면 옛 메시 키')
ap.add_argument('--out'); ap.add_argument('--static')
a = ap.parse_args()

CT = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1', 5120: 'i1', 5122: '<i2'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def load(path):
    buf = open(path, 'rb').read(); jl = struct.unpack_from('<I', buf, 12)[0]
    return json.loads(buf[20:20 + jl]), bytes(buf[28 + jl:28 + jl + struct.unpack_from('<I', buf, 20 + jl)[0]])
def acc(J, B, i):
    A = J['accessors'][i]; V = J['bufferViews'][A['bufferView']]; n = NC[A['type']]; dt = np.dtype(CT[A['componentType']])
    o = V.get('byteOffset', 0) + A.get('byteOffset', 0); arr = np.frombuffer(B[o:o + A['count'] * n * dt.itemsize], dt)
    return arr.reshape(A['count'], n) if n > 1 else arr
def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def node_mat(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    M = np.eye(4); M[:3, :3] = quat_mat(n.get('rotation', [0, 0, 0, 1])) @ np.diag(n.get('scale', [1, 1, 1])); M[:3, 3] = n.get('translation', [0, 0, 0]); return M
def image_bytes(J, B, ti, size, kind):
    im = J['images'][J['textures'][ti]['source']]; V = J['bufferViews'][im['bufferView']]; o = V.get('byteOffset', 0)
    pil = Image.open(io.BytesIO(B[o:o + V['byteLength']])).convert('RGB')
    if max(pil.size) > size: pil = pil.resize((size, size) if pil.size[0] == pil.size[1] else (int(pil.size[0] * size / max(pil.size)), int(pil.size[1] * size / max(pil.size))), Image.LANCZOS)
    b = io.BytesIO(); pil.save(b, 'JPEG', quality=92 if kind == 'base' else 95); return b.getvalue()

JS, BS = load(a.skel); prim = JS['meshes'][0]['primitives'][0]
OP = acc(JS, BS, prim['attributes']['POSITION']).astype(np.float64)
omin, omax = OP.min(0), OP.max(0)
JM, BM = load(a.mesh)
parts = []
def walk(ni, M):
    n = JM['nodes'][ni]; M2 = M @ node_mat(n)
    if 'mesh' in n:
        for pr in JM['meshes'][n['mesh']]['primitives']: parts.append((pr, M2))
    for c in n.get('children', []): walk(c, M2)
for r in JM['scenes'][JM.get('scene', 0)]['nodes']: walk(r, np.eye(4))
P, N, UV, I, off = [], [], [], [], 0
for pr, M in parts:
    p = acc(JM, BM, pr['attributes']['POSITION']).astype(np.float64) @ M[:3, :3].T + M[:3, 3]
    nn = acc(JM, BM, pr['attributes']['NORMAL']).astype(np.float64) @ np.linalg.inv(M[:3, :3]); nn /= np.linalg.norm(nn, axis=1, keepdims=True) + 1e-12
    P.append(p); N.append(nn); UV.append(acc(JM, BM, pr['attributes']['TEXCOORD_0']).astype(np.float64))
    I.append((acc(JM, BM, pr['indices']).reshape(-1, 3).astype(np.int64) if 'indices' in pr else np.arange(len(p)).reshape(-1, 3)) + off); off += len(p)
P, N, UV, I = np.vstack(P), np.vstack(N), np.vstack(UV), np.vstack(I)
if a.rot_y:
    th = np.radians(a.rot_y); RY = np.array([[np.cos(th), 0, np.sin(th)], [0, 1, 0], [-np.sin(th), 0, np.cos(th)]]); P = P @ RY.T; N = N @ RY.T
nmin, nmax = P.min(0), P.max(0); H = a.height or (omax[1] - omin[1]); s = H / (nmax[1] - nmin[1])
P = (P - [(nmin[0] + nmax[0]) / 2, nmin[1], (nmin[2] + nmax[2]) / 2]) * s + [(omin[0] + omax[0]) / 2, omin[1], (omin[2] + omax[2]) / 2]
print(f'새 메시: 정점 {len(P)} 면 {len(I)} · 배율 {s:.4f} · 키 {H:.3f} m · 옛 상자 {omin.round(3)}~{omax.round(3)} · 새 상자 {P.min(0).round(3)}~{P.max(0).round(3)}')
mat = JM['materials'][parts[0][0].get('material', 0)]; pbr = mat.get('pbrMetallicRoughness', {})
base = image_bytes(JM, BM, pbr['baseColorTexture']['index'], a.tex, 'base')
nrm = image_bytes(JM, BM, mat['normalTexture']['index'], a.tex, 'normal') if 'normalTexture' in mat else None

def write(out, J, keep_skin):
    buf = bytearray(); views = []; accs = []
    def view(b, target=None):
        nonlocal buf
        while len(buf) % 4: buf += b'\0'
        v = {'buffer': 0, 'byteOffset': len(buf), 'byteLength': len(b)}
        if target: v['target'] = target
        views.append(v); buf += b; return len(views) - 1
    def new_acc(arr, ct, typ, target=None, mm=False):
        arr = np.ascontiguousarray(arr.astype(CT[ct])); A = {'bufferView': view(arr.tobytes(), target), 'componentType': ct, 'count': int(arr.shape[0]), 'type': typ}
        if mm: A['min'] = arr.min(0).tolist(); A['max'] = arr.max(0).tolist()
        accs.append(A); return len(accs) - 1
    amap = {}
    def copy_acc(i):
        if i in amap: return amap[i]
        A = dict(J['accessors'][i]); V = J['bufferViews'][A['bufferView']]; n = NC[A['type']]; sz = np.dtype(CT[A['componentType']]).itemsize
        o = V.get('byteOffset', 0) + A.get('byteOffset', 0); A.pop('byteOffset', None); A['bufferView'] = view(BS[o:o + A['count'] * n * sz], V.get('target'))
        accs.append(A); amap[i] = len(accs) - 1; return amap[i]
    ict = 5125 if len(P) >= 65536 else 5123
    attrs = {'POSITION': new_acc(P, 5126, 'VEC3', 34962, True), 'NORMAL': new_acc(N, 5126, 'VEC3', 34962), 'TEXCOORD_0': new_acc(UV, 5126, 'VEC2', 34962)}
    if keep_skin:
        hips = [JS['nodes'][j]['name'].split(':')[-1] for j in JS['skins'][0]['joints']].index('Hips')
        attrs['JOINTS_0'] = new_acc(np.tile([hips, 0, 0, 0], (len(P), 1)), 5123, 'VEC4', 34962)
        attrs['WEIGHTS_0'] = new_acc(np.tile([1.0, 0, 0, 0], (len(P), 1)), 5126, 'VEC4', 34962)
    idx = new_acc(I.reshape(-1), ict, 'SCALAR', 34963)
    images = [{'bufferView': view(base), 'mimeType': 'image/jpeg', 'name': 'base'}]; textures = [{'sampler': 0, 'source': 0}]
    m = {'name': 'pbr_material', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}}
    if nrm: images.append({'bufferView': view(nrm), 'mimeType': 'image/jpeg', 'name': 'normal'}); textures.append({'sampler': 0, 'source': 1}); m['normalTexture'] = {'index': 1}
    J['images'] = images; J['textures'] = textures; J['samplers'] = [{'magFilter': 9729, 'minFilter': 9987}]; J['materials'] = [m]
    J['meshes'][0]['primitives'] = [{'attributes': attrs, 'indices': idx, 'material': 0}]
    if keep_skin:
        sk = J['skins'][0]
        if 'inverseBindMatrices' in sk: sk['inverseBindMatrices'] = copy_acc(sk['inverseBindMatrices'])
        for an in J.get('animations', []):
            for sm in an['samplers']: sm['input'] = copy_acc(sm['input']); sm['output'] = copy_acc(sm['output'])
    J['accessors'] = accs; J['bufferViews'] = views
    while len(buf) % 4: buf += b'\0'
    J['buffers'] = [{'byteLength': len(buf)}]
    J.setdefault('asset', {}).setdefault('extras', {})['meshSwap'] = 'tools/3d/mesh-swap.py (docs/design/80)'
    js = json.dumps(J, separators=(',', ':'), ensure_ascii=False).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    ob = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(buf), 0x004E4942) + bytes(buf)
    open(out, 'wb').write(ob); print('썼다', out, len(ob))

if a.out: write(a.out, json.loads(json.dumps(JS)), True)
if a.static:
    S = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'mesh', 'mesh': 0}], 'meshes': [{'primitives': []}]}
    write(a.static, S, False)
