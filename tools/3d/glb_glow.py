"""생성 모델의 «빛나는 부분» 을 살린다 — 붉은 발광부에 emissive + 금속 끄기 (docs/design/82).

왜: Tripo 는 컨셉의 빛(세라 정제 촉매의 붉은 유리, 파쇄 기갑의 심장 등)을 발광이 아니라 «색» 으로만 굽고,
그 자리를 금속(metallic 1)로 잡는 일이 잦다. three.js 에서 금속 + 짙은 빨강 = 거의 검정이라 빛이 사라졌다.
기본색에서 채도 높은 붉은 픽셀(색상 ±hue, 채도·명도 문턱)을 골라
  · 그 색 × gain 을 emissive 텍스처로 새로 달고(나머지 검정)
  · 금속·거칠기 텍스처의 그 자리 금속(B)을 0, 거칠기(G)를 rough 로 바꾼다.

  python3 tools/3d/glb_glow.py <입력 glb> <출력 glb> [--hue 0] [--width 22] [--sat 0.55] [--val 0.22] [--gain 1.6] [--rough 0.25]
"""
import json, struct, io, argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--hue', type=float, default=0); ap.add_argument('--width', type=float, default=22)
ap.add_argument('--sat', type=float, default=0.55); ap.add_argument('--val', type=float, default=0.22)
ap.add_argument('--gain', type=float, default=1.6); ap.add_argument('--rough', type=float, default=0.25)
a = ap.parse_args()
raw = open(a.src, 'rb').read(); jl = struct.unpack_from('<I', raw, 12)[0]
J = json.loads(raw[20:20 + jl]); B = bytearray(raw[28 + jl:28 + jl + struct.unpack_from('<I', raw, 20 + jl)[0]])
def img_of(tex_index):
    im = J['images'][J['textures'][tex_index]['source']]; V = J['bufferViews'][im['bufferView']]; o = V.get('byteOffset', 0)
    return im, Image.open(io.BytesIO(bytes(B[o:o + V['byteLength']])))
def put(im_entry, pil, fmt):
    global B
    buf = io.BytesIO(); pil.save(buf, fmt, **({'quality': 90} if fmt == 'JPEG' else {})); nb = buf.getvalue()
    while len(B) % 4: B += b'\0'
    J['bufferViews'].append({'buffer': 0, 'byteOffset': len(B), 'byteLength': len(nb)}); B += nb
    im_entry['bufferView'] = len(J['bufferViews']) - 1; im_entry['mimeType'] = 'image/jpeg' if fmt == 'JPEG' else 'image/png'
total = 0
for m in J['materials']:
    pbr = m.get('pbrMetallicRoughness', {})
    if 'baseColorTexture' not in pbr: continue
    _, base = img_of(pbr['baseColorTexture']['index']); rgb = np.asarray(base.convert('RGB')).astype(np.float32) / 255
    hsv = np.asarray(base.convert('RGB').convert('HSV')).astype(np.float32) / 255
    dh = np.abs(((hsv[..., 0] * 360 - a.hue) + 180) % 360 - 180)
    mask = (dh < a.width) & (hsv[..., 1] > a.sat) & (hsv[..., 2] > a.val)
    n = int(mask.sum()); total += n
    if not n: continue
    em = np.zeros_like(rgb); em[mask] = np.clip(rgb[mask] * a.gain, 0, 1)
    J['images'].append({'name': 'glow'}); put(J['images'][-1], Image.fromarray((em * 255).astype(np.uint8)), 'JPEG')
    J['textures'].append({'source': len(J['images']) - 1}); m['emissiveTexture'] = {'index': len(J['textures']) - 1}; m['emissiveFactor'] = [1, 1, 1]
    if 'metallicRoughnessTexture' in pbr:
        # 기본색·금속 텍스처가 한 이미지를 같이 쓰면 망가진다 — 늘 새 이미지로 떼어 낸다
        mr_im, mr = img_of(pbr['metallicRoughnessTexture']['index']); arr = np.asarray(mr.convert('RGB').resize(base.size)).copy()
        arr[mask, 2] = 0; arr[mask, 1] = int(a.rough * 255)
        J['images'].append({'name': 'mr_glow'}); put(J['images'][-1], Image.fromarray(arr), 'JPEG')
        J['textures'].append({'source': len(J['images']) - 1}); pbr['metallicRoughnessTexture'] = {'index': len(J['textures']) - 1}
    print(f"{m.get('name','?')[:30]}: 발광 픽셀 {n} ({100 * n / mask.size:.1f} %)")
# 쓰지 않게 된 이미지·조각을 빼고 다시 싼다 (tex-pad.py 와 같은 방식)
used_tex = set()
for m in J['materials']:
    for k in ('normalTexture', 'emissiveTexture', 'occlusionTexture'):
        if k in m: used_tex.add(m[k]['index'])
    for k in ('baseColorTexture', 'metallicRoughnessTexture'):
        if k in m.get('pbrMetallicRoughness', {}): used_tex.add(m['pbrMetallicRoughness'][k]['index'])
used_img = sorted({J['textures'][t]['source'] for t in used_tex})
imap = {o: i for i, o in enumerate(used_img)}; J['images'] = [J['images'][o] for o in used_img]
tmap = {}; texs = []
for t in sorted(used_tex): tmap[t] = len(texs); tt = dict(J['textures'][t]); tt['source'] = imap[tt['source']]; texs.append(tt)
J['textures'] = texs
for m in J['materials']:
    for k in ('normalTexture', 'emissiveTexture', 'occlusionTexture'):
        if k in m: m[k]['index'] = tmap[m[k]['index']]
    for k in ('baseColorTexture', 'metallicRoughnessTexture'):
        if k in m.get('pbrMetallicRoughness', {}): m['pbrMetallicRoughness'][k]['index'] = tmap[m['pbrMetallicRoughness'][k]['index']]
used = sorted({A['bufferView'] for A in J['accessors'] if 'bufferView' in A} | {i['bufferView'] for i in J['images'] if 'bufferView' in i})
vmap = {}; views = []; NB = bytearray()
for v in used:
    Vv = J['bufferViews'][v]
    while len(NB) % 4: NB += b'\0'
    oo = Vv.get('byteOffset', 0); nv = dict(Vv); nv['byteOffset'] = len(NB); NB += B[oo:oo + Vv['byteLength']]; vmap[v] = len(views); views.append(nv)
for A in J['accessors']:
    if 'bufferView' in A: A['bufferView'] = vmap[A['bufferView']]
for i in J['images']:
    if 'bufferView' in i: i['bufferView'] = vmap[i['bufferView']]
J['bufferViews'] = views; B = NB
while len(B) % 4: B += b'\0'
J['buffers'][0]['byteLength'] = len(B)
js = json.dumps(J, separators=(',', ':'), ensure_ascii=False).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
open(a.dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(B)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(B), 0x004E4942) + bytes(B))
print(f'발광 픽셀 합 {total} · 썼다 {a.dst}')
