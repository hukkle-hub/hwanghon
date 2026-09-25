"""MPFB 로 만든 캐릭터 glb 를 게임용으로 다듬는다 (docs/design/81).

Blender glTF 내보내기는 MakeHuman 재질을 전부 반투명(BLEND)으로 낸다 → three.js 가 깊이를 안 써서 이·눈이
얼굴 위에 그려졌다(코·입 자리에 구멍처럼). 재질마다 알파 방식을 바로잡고, 무거운 확장을 빼고, 텍스처를 줄인다.
  몸·눈·이·혀·옷 = OPAQUE  /  머리칼·눈썹·속눈썹 = MASK(0.5)
  python3 tools/3d/mh/finalize.py <입력 glb> <출력 glb> [--tex 1024]
"""
import sys, json, struct, io, argparse
from PIL import Image
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--tex', type=int, default=1024)
ap.add_argument('--hair', default=None, help='머리칼 색 #rrggbb — 밝기는 원래 결을 따르고 색만 바꾼다')
ap.add_argument('--eyes', default=None, help='홍채 텍스처 png (eyes/materials/*_eye.png)'); ap.add_argument('--eye-tint', default=None, help='홍채 색 #rrggbb (붉은 눈 등)')
a = ap.parse_args()
raw = open(a.src, 'rb').read(); jl = struct.unpack_from('<I', raw, 12)[0]
J = json.loads(raw[20:20 + jl]); B = raw[28 + jl:28 + jl + struct.unpack_from('<I', raw, 20 + jl)[0]]
HAIR = ('hair', 'long0', 'short0', 'bob0', 'braid0', 'ponytail0', 'afro0')
CUT = ('eyebrow', 'eyelash', 'hair', 'long0', 'short0', 'bob0', 'braid0', 'ponytail0', 'afro0')
alpha_imgs = set(); hair_imgs = set(); eye_imgs = set()
for m in J['materials']:
    n = (m.get('name') or '').lower(); m.pop('extensions', None)
    if any(k in n for k in CUT):
        m['alphaMode'] = 'MASK'; m['alphaCutoff'] = 0.5; m['doubleSided'] = True
        t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if t:
            alpha_imgs.add(J['textures'][t['index']]['source'])
            if any(k in n for k in HAIR): hair_imgs.add(J['textures'][t['index']]['source'])
    else:
        t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if t and ('low-poly' in n or 'high-poly' in n): eye_imgs.add(J['textures'][t['index']]['source'])
        m['alphaMode'] = 'OPAQUE'; m.pop('alphaCutoff', None); m['doubleSided'] = False
    pb = m.setdefault('pbrMetallicRoughness', {}); pb['metallicFactor'] = 0.0; pb.setdefault('roughnessFactor', 0.6)
J.pop('extensionsUsed', None) if 'KHR_materials_clearcoat' in J.get('extensionsUsed', []) and len(J['extensionsUsed']) == 1 else None
if 'extensionsUsed' in J: J['extensionsUsed'] = [e for e in J['extensionsUsed'] if e != 'KHR_materials_clearcoat'] or J.pop('extensionsUsed')
# 텍스처 줄이기 — 알파 쓰는 것은 PNG, 나머지 JPEG
views = J['bufferViews']; newbin = bytearray(); vmap = {}
imgdata = {}
for i, im in enumerate(J['images']):
    V = views[im['bufferView']]; o = V.get('byteOffset', 0); pil = Image.open(io.BytesIO(B[o:o + V['byteLength']]))
    import numpy as np
    hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
    if i in hair_imgs and a.hair:
        arr = np.asarray(pil.convert('RGBA')).astype(np.float32) / 255; L = arr[..., :3] @ [0.3, 0.59, 0.11]
        L = L / max(np.percentile(L[arr[..., 3] > 0.5], 90), 1e-3)   # 결(밝고 어두운 가닥)만 남기고 색은 새로
        c = hexrgb(a.hair); rgb = np.clip(c[None, None] * (0.35 + 0.75 * L[..., None]) + 0.10 * np.clip(L[..., None] - 1, 0, 1), 0, 1)
        pil = Image.fromarray((np.concatenate([rgb, arr[..., 3:]], -1) * 255).astype(np.uint8), 'RGBA')
    if i in eye_imgs and (a.eyes or a.eye_tint):
        if a.eyes: pil = Image.open(a.eyes)
        if a.eye_tint:
            arr = np.asarray(pil.convert('RGB')).astype(np.float32) / 255; sat = arr.max(-1) - arr.min(-1); L = arr @ [0.3, 0.59, 0.11]
            iris = (sat > 0.08) & (L < 0.8)   # 흰자·동공은 그대로, 채도 있는 홍채만
            c = hexrgb(a.eye_tint); arr[iris] = np.clip(c * (0.4 + 1.2 * L[iris, None]), 0, 1)
            pil = Image.fromarray((arr * 255).astype(np.uint8))
    if max(pil.size) > a.tex: pil = pil.resize((a.tex * pil.size[0] // max(pil.size), a.tex * pil.size[1] // max(pil.size)), Image.LANCZOS)
    b = io.BytesIO()
    if i in alpha_imgs: pil.convert('RGBA').save(b, 'PNG', optimize=True); im['mimeType'] = 'image/png'
    else: pil.convert('RGB').save(b, 'JPEG', quality=88); im['mimeType'] = 'image/jpeg'
    imgdata[im['bufferView']] = b.getvalue()
for vi, V in enumerate(views):
    while len(newbin) % 4: newbin += b'\0'
    data = imgdata.get(vi); o = V.get('byteOffset', 0)
    chunk = data if data is not None else B[o:o + V['byteLength']]
    V['byteOffset'] = len(newbin); V['byteLength'] = len(chunk); newbin += chunk
while len(newbin) % 4: newbin += b'\0'
J['buffers'][0]['byteLength'] = len(newbin)
js = json.dumps(J, separators=(',', ':'), ensure_ascii=False).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
out = struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(newbin)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(newbin), 0x004E4942) + bytes(newbin)
open(a.dst, 'wb').write(out); print(f'썼다 {a.dst} {len(raw)/1e6:.1f} → {len(out)/1e6:.1f} MB · 알파 텍스처 {len(alpha_imgs)}')
