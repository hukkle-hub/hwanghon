"""얼굴 조각(아일랜드) 빈 곳 메우기 — UV 패딩 (docs/design/80).

왜: tools/3d/face-project.py 는 얼굴 삼각형을 텍스처 아래 띠(2048 줄 아래)로 옮겨 그 자리에 시트 얼굴을 칠한다.
띠 바탕은 검정이다. 옮겨졌지만 가림막(타원) 밖이라 칠해지지 않은 삼각형(이마 윗부분·관자놀이)이 검정을 그대로 받아
새 세라 이마·왼눈에 검은 십자 얼룩이 떴다. 칠한 픽셀을 바깥으로 번지게(이웃 평균, 한 번에 1 px) 해서 메운다.

  python3 tools/3d/tex-pad.py <입력 glb> <출력 glb> [--from-row 2048] [--grow 96]
"""
import sys, json, struct, io, argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--from-row', type=int, default=2048); ap.add_argument('--grow', type=int, default=96)
a = ap.parse_args()
raw = open(a.src, 'rb').read(); jl = struct.unpack_from('<I', raw, 12)[0]
J = json.loads(raw[20:20 + jl]); B = bytearray(raw[28 + jl:28 + jl + struct.unpack_from('<I', raw, 20 + jl)[0]])
im = J['images'][J['textures'][J['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
V = J['bufferViews'][im['bufferView']]; o = V.get('byteOffset', 0)
img = np.asarray(Image.open(io.BytesIO(bytes(B[o:o + V['byteLength']]))).convert('RGB')).astype(np.float32)
if img.shape[0] <= a.from_row: sys.exit(f'띠가 없다 ({img.shape}) — face-project 전 파일?')
S = img[a.from_row:].copy(); filled = S.sum(2) > 18; n0 = int((~filled).sum())
for _ in range(a.grow):
    acc = np.zeros_like(S); cnt = np.zeros(S.shape[:2], np.float32)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        m = np.roll(filled, (dy, dx), (0, 1)); v = np.roll(S, (dy, dx), (0, 1))
        acc += v * m[..., None]; cnt += m
    grow = (~filled) & (cnt > 0)
    if not grow.any(): break
    S[grow] = acc[grow] / cnt[grow][:, None]; filled |= grow
img[a.from_row:] = S
buf = io.BytesIO(); Image.fromarray(img.clip(0, 255).astype(np.uint8)).save(buf, 'JPEG', quality=92); nb = buf.getvalue()
# 새 이미지를 버퍼 끝에 붙이고 가리킨다(옛 것은 버림 — 크기 차이만큼만 커진다)
while len(B) % 4: B += b'\0'
J['bufferViews'].append({'buffer': 0, 'byteOffset': len(B), 'byteLength': len(nb)}); B += nb
im['bufferView'] = len(J['bufferViews']) - 1; im['mimeType'] = 'image/jpeg'
# 쓰지 않게 된 옛 이미지 조각을 빼고 다시 싼다
used = sorted({A['bufferView'] for A in J['accessors'] if 'bufferView' in A} | {m['bufferView'] for m in J['images'] if 'bufferView' in m})
vmap = {}; views = []; NB = bytearray()
for v in used:
    Vv = J['bufferViews'][v]
    while len(NB) % 4: NB += b'\0'
    oo = Vv.get('byteOffset', 0); nv = dict(Vv); nv['byteOffset'] = len(NB); NB += B[oo:oo + Vv['byteLength']]; vmap[v] = len(views); views.append(nv)
for A in J['accessors']:
    if 'bufferView' in A: A['bufferView'] = vmap[A['bufferView']]
for m in J['images']:
    if 'bufferView' in m: m['bufferView'] = vmap[m['bufferView']]
J['bufferViews'] = views; B = NB
while len(B) % 4: B += b'\0'
J['buffers'][0]['byteLength'] = len(B)
js = json.dumps(J, separators=(',', ':'), ensure_ascii=False).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(a.dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(B)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(B), 0x004E4942) + bytes(B))
print(f'띠 빈 픽셀 {n0} → {int((~filled).sum())} · 썼다 {a.dst}')
