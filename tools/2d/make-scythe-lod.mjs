// 아인 낫 휴대폰 LOD (docs/design/229 §46) — 그냥 줄이면 js/ain-scythe-mount.js 의 자루 교정(높이 0.2~1.2 m 띠 ±2.5 cm 의 정점 중심이 일직선, 오차 6 mm)이
// «no longer a straight calibrated shaft» 로 거부했다(자루 정점이 듬성해져 띠 중심이 흔들림). 자루 높이(0.17~1.23 m)의 정점은 잠그고 날·장식만 줄인다.
//   GT=<node_modules> node tools/2d/make-scythe-lod.mjs [비율=0.4]   → art/3d/lod/ain_scythe_tex.glb
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const GT = process.env.GT, imp = m => { const pj = JSON.parse(fs.readFileSync(path.join(GT, m, 'package.json'))); const e = pj.exports?.['.']; const f = (typeof e === 'string' ? e : e?.import?.default || e?.import || e?.default) || pj.module || pj.main || 'index.js'; return import(pathToFileURL(path.join(GT, m, f)).href); };
const { NodeIO } = await imp('@gltf-transform/core'); const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { prune, dedup, textureCompress, compactPrimitive, weld } = await imp('@gltf-transform/functions'); const sharp = (await import('node:module')).createRequire(path.join(GT, 'x.js'))('sharp');
const { MeshoptSimplifier, MeshoptDecoder, MeshoptEncoder } = await imp('meshoptimizer'); await MeshoptSimplifier.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const RATIO = +(process.argv[2] || 0.4), SRC = 'art/3d/ain_scythe_tex.glb', OUT = 'art/3d/lod/ain_scythe_tex.glb';
const doc = await io.read(SRC); let t0 = 0, t1 = 0, locked = 0;
await doc.transform(weld());
for (const node of doc.getRoot().listNodes()) { const mesh = node.getMesh(); if (!mesh) continue; const W = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) { const P = p.getAttribute('POSITION'), U = p.getAttribute('TEXCOORD_0'), I = p.getIndices(), n = P.getCount(), pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), lock = new Uint8Array(n), e = [];
    for (let i = 0; i < n; i++) { P.getElement(i, e); pos.set(e, i * 3); const y = W[1] * e[0] + W[5] * e[1] + W[9] * e[2] + W[13]; if (y > 0.17 && y < 1.23) { lock[i] = 1; locked++; } if (U) { U.getElement(i, e); uv.set(e.slice(0, 2), i * 2); } }
    const ix = new Uint32Array(I.getArray()); t0 += ix.length / 3;
    const [out] = MeshoptSimplifier.simplifyWithAttributes(ix, pos, 3, uv, 2, [0.5, 0.5], lock, Math.floor(ix.length * RATIO / 3) * 3, 0.02, []);
    I.setArray(new Uint32Array(out)); compactPrimitive(p); t1 += out.length / 3; } }
await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 82 }));
await io.write(OUT, doc); console.log('삼각형', t0, '->', t1, '잠근 정점', locked, 'bytes', fs.statSync(SRC).size, '->', fs.statSync(OUT).size);
