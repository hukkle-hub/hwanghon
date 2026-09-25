/* 늘어남·찢어짐 지도 — «어디가» 늘어나는지 뼈별로 센다 (docs/design/80).
   stretch-view.html 은 그림 한 장이라 «빨간 곳이 어느 뼈 무게인가» 를 알 수 없다. 여기서는 게임과 같은 클립 보정
   (아인 = repairAinClips, 그 밖 = smoothCharacterClips)을 거친 뒤 모든 클립·10 프레임에서 변 길이 ÷ 바인드 길이를 재고,
   나쁜 변(> 1.8 또는 < 0.45)을 양 끝 정점의 «주 뼈 쌍» 으로 묶어 많은 순서로 보여 준다.

     node tools/3d/stretch-map.mjs <char> [glb] [--clips a,b] [--top 12] [--json 파일]
*/
import {readFile, writeFile} from 'node:fs/promises';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {smoothCharacterClips} from '../../js/clip-smooth.js';
import {repairAinBind, repairAinClips} from '../../js/ain-bind-repair.js';

const args = process.argv.slice(2), val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const CH = args[0], FILE = args[1] && !args[1].startsWith('--') ? args[1] : `art/3d/${CH}_anim.glb`;
globalThis.window = globalThis;
for (const f of ['js/world.js', 'js/dungeons.js']) new Function(await readFile(f, 'utf8'))();
const DG = globalThis.TW_DUNGEONS;
const b = await readFile(FILE), l = new GLTFLoader();
l.register(() => ({name: 'no-raster', loadTexture: () => Promise.resolve(new T.Texture())}));
const g = await l.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
const M = DG.RULES.motion;
const clips = CH === 'ain' ? repairAinClips(g.animations, repairAinBind(g.scene))
  : smoothCharacterClips(CH, g.animations, {...M.clipContacts, ...(M.clipContactsByChar || {})[CH]});
const want = val('--clips') ? val('--clips').split(',') : null;
const meshes = []; g.scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
g.scene.updateMatrixWorld(true);
const strip = n => n.replace(/^mixamorig:?/, '');
const info = meshes.map(m => {
  const idx = m.geometry.index.array, pa = m.geometry.attributes.position, n = pa.count, set = new Set(), ed = [];
  for (let i = 0; i < idx.length; i += 3) for (const [a, c] of [[idx[i], idx[i + 1]], [idx[i + 1], idx[i + 2]], [idx[i + 2], idx[i]]]) {
    const k = a < c ? a * 1e7 + c : c * 1e7 + a; if (!set.has(k)) { set.add(k); ed.push(a, c); } }
  const R = new Float32Array(n * 3), v = new T.Vector3(); for (let i = 0; i < n; i++) { v.fromBufferAttribute(pa, i); R.set([v.x, v.y, v.z], i * 3); }
  const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, dom = new Int16Array(n);
  for (let i = 0; i < n; i++) { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; bi = si.getComponent(i, k); } } dom[i] = bi; }
  return {m, ed, R, dom, names: m.skeleton.bones.map(x => strip(x.name))};
});
const mixer = new T.AnimationMixer(g.scene);
const byPair = {}, byClip = {}, hot = {};
for (const c of clips) {
  if (want && !want.includes(c.name)) continue;
  mixer.stopAllAction(); const a = mixer.clipAction(c); a.reset(); a.play(); a.paused = true;
  let worst = 1, bad = 0, tot = 0;
  for (let k = 1; k < 10; k++) {
    a.time = Math.min(c.duration - 1e-4, c.duration * k / 10); mixer.update(0); g.scene.updateMatrixWorld(true);
    for (const I of info) {
      const {m, ed, R, dom, names} = I, n = R.length / 3, P = new Float32Array(n * 3), v = new T.Vector3();
      for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
      for (let e = 0; e < ed.length; e += 2) {
        const p = ed[e] * 3, q = ed[e + 1] * 3, l0 = Math.hypot(R[p] - R[q], R[p + 1] - R[q + 1], R[p + 2] - R[q + 2]); if (l0 < 0.004) continue;
        const r = Math.hypot(P[p] - P[q], P[p + 1] - P[q + 1], P[p + 2] - P[q + 2]) / l0; tot++; worst = Math.max(worst, r);
        if (r > 1.8 || r < 0.45) { bad++;
          const A = names[dom[ed[e]]], B = names[dom[ed[e + 1]]], key = A < B ? `${A}|${B}` : `${B}|${A}`;
          byPair[key] = (byPair[key] || 0) + 1;
          const h = hot[key] || (hot[key] = {n: 0, x: 0, y: 0, z: 0, clips: {}}); h.n++; h.x += R[p]; h.y += R[p + 1]; h.z += R[p + 2]; h.clips[c.name] = (h.clips[c.name] || 0) + 1; } } } }
  byClip[c.name] = {worst: +worst.toFixed(2), badPermil: +(bad / Math.max(1, tot) * 1000).toFixed(2)};
}
const top = +(val('--top') || 12), total = Object.values(byPair).reduce((s, x) => s + x, 0);
console.log(`${CH} ${FILE} — 나쁜 변 ${total} (클립 ${Object.keys(byClip).length} × 9 프레임)`);
for (const [k, n] of Object.entries(byPair).sort((a, b) => b[1] - a[1]).slice(0, top)) {
  const h = hot[k], cl = Object.entries(h.clips).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, x]) => `${c} ${x}`).join(', ');
  console.log(`  ${k.padEnd(28)} ${String(n).padStart(6)}  ${(n / total * 100).toFixed(1).padStart(5)}%  바인드 중심 (${(h.x / h.n).toFixed(2)}, ${(h.y / h.n).toFixed(2)}, ${(h.z / h.n).toFixed(2)})  ${cl}`);
}
if (val('--json')) await writeFile(val('--json'), JSON.stringify({byClip, byPair}, null, 1));
