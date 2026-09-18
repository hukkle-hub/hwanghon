#!/usr/bin/env python3
"""GLB 안의 임베디드 텍스처만 지정 크기 이하로 줄인다 (지오메트리·머티리얼은 그대로).
사용: python3 glb_tex_resize.py in.glb out.glb MAX  (예: MAX=1024)
폰 WebGL 은 8192² 텍스처(장당 268MB) 를 올리다 컨텍스트가 끊기므로 런타임 자산은 2048 이하로 둔다."""
import sys, struct, json, io
from PIL import Image
src, dst, MAX = sys.argv[1], sys.argv[2], int(sys.argv[3])
d = open(src, 'rb').read()
assert d[:4] == b'glTF'
jl = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20+jl]); off = 20+jl
bl = struct.unpack('<I', d[off:off+4])[0]; assert d[off+4:off+8] == b'BIN\0'; bin_ = d[off+8:off+8+bl]
bvs = j['bufferViews']
# 이미지가 쓰는 bufferView 를 새 데이터로 교체, 나머지는 그대로 복사하며 오프셋 재계산
repl = {}
for im in j.get('images', []):
    bv = bvs[im['bufferView']]; b = bin_[bv['byteOffset']:bv['byteOffset']+bv['byteLength']]
    img = Image.open(io.BytesIO(b)); w, h = img.size
    if max(w, h) <= MAX: continue
    s = MAX / max(w, h); img = img.convert('RGB').resize((max(1, round(w*s)), max(1, round(h*s))), Image.LANCZOS)
    out = io.BytesIO(); img.save(out, format='JPEG', quality=88, optimize=True); repl[im['bufferView']] = out.getvalue(); im['mimeType'] = 'image/jpeg'
    print(f'image bv{im["bufferView"]}: {w}x{h} ({len(b)//1024}KB) -> {img.size} ({len(repl[im["bufferView"]])//1024}KB)')
newbin = bytearray()
for i, bv in enumerate(bvs):
    data = repl.get(i, bin_[bv.get('byteOffset', 0):bv.get('byteOffset', 0)+bv['byteLength']])
    while len(newbin) % 4: newbin += b'\0'
    bv['byteOffset'] = len(newbin); bv['byteLength'] = len(data); newbin += data
while len(newbin) % 4: newbin += b'\0'
j['buffers'][0]['byteLength'] = len(newbin)
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
total = 12 + 8 + len(js) + 8 + len(newbin)
with open(dst, 'wb') as f:
    f.write(b'glTF' + struct.pack('<II', 2, total)); f.write(struct.pack('<I', len(js)) + b'JSON' + js); f.write(struct.pack('<I', len(newbin)) + b'BIN\0' + newbin)
print('wrote', dst, total//1024, 'KB')
