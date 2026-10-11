// 보스 휴대폰 «먼 거리» 기하 (docs/design/229 §45) — 기하만 줄이고(뼈·스킨 무게·UV 는 meshopt 가 원래 정점 중에서 고르므로 그대로) 텍스처·재질은 버린다.
// 런타임(world3d)이 원본 메시 옆에 같은 뼈대·같은 재질로 붙여, 28 m 넘게 멀 때만 이쪽을 보인다(군도 손잡이 등은 원본 정점을 계속 읽는다).
//   GT=<node_modules> node tools/2d/make-boss-lod.mjs [비율=0.35] art/3d/part1/shadow_fang.glb …   → art/3d/lod/part1/<같은 이름>
//   의존성은 make-lod.mjs 와 같다(저장소에 넣지 않음).
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const GT = process.env.GT, imp = m => { const pj = JSON.parse(fs.readFileSync(path.join(GT, m, 'package.json'))); const e = pj.exports?.['.']; const f = (typeof e === 'string' ? e : e?.import?.default || e?.import || e?.default) || pj.module || pj.main || 'index.js'; return import(pathToFileURL(path.join(GT, m, f)).href); };
const { NodeIO } = await imp('@gltf-transform/core'); const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { simplify, weld, prune, dedup, quantize } = await imp('@gltf-transform/functions'); const { MeshoptSimplifier, MeshoptDecoder, MeshoptEncoder } = await imp('meshoptimizer');
await MeshoptSimplifier.ready; await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const tris = doc => doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
let args = process.argv.slice(2), RATIO = 0.35; if (/^[\d.]+$/.test(args[0])) RATIO = +args.shift();
fs.mkdirSync('art/3d/lod/part1', { recursive: true });
for (const f of args) { const doc = await io.read(f), t0 = tris(doc);
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.02, lockBorder: false }), dedup());
  for (const t of doc.getRoot().listTextures()) t.dispose(); for (const a of doc.getRoot().listAnimations()) a.dispose();   /* 기하만 — 재질·클립은 원본 것을 쓴다. 정리(prune)는 keepAttributes — 텍스처가 없으니 UV 를 «안 쓰는 속성» 으로 지워 얼굴이 어두웠다 */
  await doc.transform(prune({ keepAttributes: true }), quantize({ pattern: /^(NORMAL|WEIGHTS_\d+)$/ }));   /* 양자화 — 1.2 MB 는 휴대폰에 무겁다. 위치는 빼야 한다: 위치 양자화는 노드 변환으로 되푸는데 스킨 메시는 노드 변환을 무시해 몸이 쪼그라들었다. UV 도 뺀다 — UV 양자화는 재질의 텍스처 변환으로 되푸는데 원본 재질을 쓰니 얼굴이 어두워졌다 */
  const out = 'art/3d/lod/part1/' + path.basename(f); await io.write(out, doc); console.log(path.basename(f).padEnd(32), t0, '->', Math.round(tris(doc)), 'bytes', fs.statSync(f).size, '->', fs.statSync(out).size); }
