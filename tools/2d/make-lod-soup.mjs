// 위상 없는 장비(삼각형마다 꼭짓점 따로 — Hi3D·Tripo 출력)의 휴대폰 LOD 를 다시 만든다 (docs/design/229 §41).
// make-lod.mjs 는 이런 조각을 «엉성한 축소»(simplifySloppy, 위치만)로 줄여 두건에 구멍 · 건틀릿·장화·정강이에 검은 반점이 났다.
// 원인: 법선이 면마다 따로(평면 음영)라 같은 자리의 꼭짓점이 갈라져 있어 weld 가 못 잇는다 → 법선을 떼고 위치+UV 로 잇고,
// 위상 보존 축소(lockBorder) 뒤 법선을 위치 기준으로 부드럽게 다시 계산한다. 원본 대비 50~64 % 에서 멈춘다(오차 0.01).
//   GT=<node_modules> OUT=art/3d/lod/gear node tools/2d/make-lod-soup.mjs a_hood.glb a_steel_gauntlet.glb …
//   의존성은 make-lod.mjs 와 같다(저장소에 넣지 않음).
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const GT = process.env.GT, imp = m => { const pj = JSON.parse(fs.readFileSync(path.join(GT, m, 'package.json'))); const e = pj.exports?.['.']; const f = (typeof e === 'string' ? e : e?.import?.default || e?.import || e?.default) || pj.module || pj.main || 'index.js'; return import(pathToFileURL(path.join(GT, m, f)).href); };
const { NodeIO } = await imp('@gltf-transform/core'); const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { simplify, weld, prune, dedup, textureCompress } = await imp('@gltf-transform/functions'); const sharp = (await import('node:module')).createRequire(path.join(GT, 'x.js'))('sharp'); const { MeshoptSimplifier, MeshoptDecoder, MeshoptEncoder } = await imp('meshoptimizer');
await MeshoptSimplifier.ready; await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const tris = doc => doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const RATIO = +(process.env.RATIO || 0.5), ERR = +(process.env.ERR || 0.01);
for (const f of process.argv.slice(2)) { const doc = await io.read('art/3d/gear/' + f), t0 = tris(doc);
  /* 면마다 따로인 법선(평면 음영)이 꼭짓점을 갈라 놓아 위상이 없다 → 법선을 떼고 위치+UV 로 잇는다 */
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const N = p.getAttribute('NORMAL'); if (N) { p.setAttribute('NORMAL', null); } }
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: ERR, lockBorder: true }), dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 82 }));
  /* 부드러운 법선 — 위치가 같은 꼭짓점끼리 면 법선(넓이 가중)을 모은다(UV 이음매에서 음영이 갈라지지 않게) */
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const P = p.getAttribute('POSITION'), I = p.getIndices(), n = P.getCount(), pos = new Float32Array(n * 3), e = [];
    for (let i = 0; i < n; i++) { P.getElement(i, e); pos.set(e, i * 3); } const key = new Map(), grp = new Int32Array(n); for (let i = 0; i < n; i++) { const k = Math.round(pos[i*3]*1e4) + ',' + Math.round(pos[i*3+1]*1e4) + ',' + Math.round(pos[i*3+2]*1e4); let g = key.get(k); if (g == null) key.set(k, g = key.size); grp[i] = g; }
    const acc = new Float32Array(key.size * 3), ix = I ? I.getArray() : null, T = ix ? ix.length : n;
    for (let t = 0; t < T; t += 3) { const a = ix ? ix[t] : t, b = ix ? ix[t+1] : t+1, c = ix ? ix[t+2] : t+2; const ux = pos[b*3]-pos[a*3], uy = pos[b*3+1]-pos[a*3+1], uz = pos[b*3+2]-pos[a*3+2], vx = pos[c*3]-pos[a*3], vy = pos[c*3+1]-pos[a*3+1], vz = pos[c*3+2]-pos[a*3+2];
      const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx; for (const v of [a, b, c]) { const g = grp[v]; acc[g*3] += nx; acc[g*3+1] += ny; acc[g*3+2] += nz; } }
    const out = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const g = grp[i], x = acc[g*3], y = acc[g*3+1], z = acc[g*3+2], l = Math.hypot(x, y, z) || 1; out[i*3] = x/l; out[i*3+1] = y/l; out[i*3+2] = z/l; }
    p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(out).setBuffer(doc.getRoot().listBuffers()[0])); }
  const t1 = tris(doc); await io.write(process.env.OUT + '/' + f, doc); console.log(f.padEnd(28), t0, '->', Math.round(t1), (t1 / t0 * 100).toFixed(0) + '%', 'oldLOD', fs.statSync('art/3d/lod/gear/' + f).size, 'new', fs.statSync(process.env.OUT + '/' + f).size); }
