/* 늘어남 감사 — 디렉터 «모션에 다 늘어나서 붙었네» (문서 225).
   스킨 메시의 삼각형 변이 쉬는 자세(바인드) 대비 클립에서 얼마나 늘어나는지 잰다.
   node tools/3d/stretch-audit.mjs art/3d/part1/clave.glb [clip,clip] [--step=0.05] [--fix=2] [--json]   (--fix: js/mmo/skin-fix.js 를 먼저 건다)
   보고: 클립마다 최악 늘어남 · 2배 넘게 늘어난 변 비율 · 그 변을 끄는 뼈 쌍(가중치 1위 뼈끼리) */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';
import { fixSkin, rebindModel } from '../../js/mmo/skin-fix.js';
import { makePoser } from './pose-eval.mjs';

export async function loadGlb(file) {
  const raw = fs.readFileSync(file), ld = new GLTFLoader(); ld.register(() => ({ name: 'skip', loadTexture: () => Promise.resolve(new T.Texture()) }));
  return ld.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
}
/* 메시마다 변 목록(바인드 자세 길이) · 정점의 1위 뼈 */
function prep(mesh) {
  const idx = mesh.geometry.index, pos = mesh.geometry.attributes.position, n = idx ? idx.count : pos.count, edges = new Map();
  const bind = i => new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
  const P = []; for (let i = 0; i < pos.count; i++) P.push(bind(i));
  for (let t = 0; t < n; t += 3) { const v = [0, 1, 2].map(k => idx ? idx.getX(t + k) : t + k);
    for (let k = 0; k < 3; k++) { let a = v[k], b = v[(k + 1) % 3]; if (a > b) [a, b] = [b, a]; const key = a * 1e7 + b; if (!edges.has(key)) { const d = P[a].distanceTo(P[b]); if (d > 1e-5) edges.set(key, [a, b, d]); } } }
  const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, top = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { let w = -1, b = 0; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > w) { w = sw.getComponent(i, k); b = si.getComponent(i, k); } top[i] = b; }
  return { mesh, edges: [...edges.values()], top };
}
/* 지금 자세에서 늘어남. 바인드 공간 길이로 견준다 (메시 비율이 섞이지 않게) */
export function stretchNow(p, limit = 2) {
  const { mesh, edges, top } = p, inv = mesh.bindMatrixInverse, va = new T.Vector3(), vb = new T.Vector3(), cache = new Map();
  const at = (i, out) => { let c = cache.get(i); if (!c) { mesh.getVertexPosition(i, out); c = out.clone(); cache.set(i, c); } return c; };   /* getVertexPosition 은 바인드 공간 결과 */
  let worst = 0, over = 0, worstE = null; const pairs = new Map();
  for (const e of edges) { const a = at(e[0], va), b = at(e[1], vb), r = a.distanceTo(b) / e[2];
    if (r > worst) { worst = r; worstE = e; }
    if (r > limit) { over++; const bones = mesh.skeleton.bones, k = [bones[top[e[0]]].name, bones[top[e[1]]].name].sort().join(' ↔ '); pairs.set(k, (pairs.get(k) || 0) + 1); } }
  return { worst, over, frac: over / edges.length, pairs, worstE };
}
export async function audit(file, clipNames, step = .05, limit = 2, hops = 0, cut = 0) {
  const g = await loadGlb(file), root = g.scene, meshes = []; const fixed = hops === 'rebind' ? rebindModel(T, root, { sigma: cut || .08, wpow: +(process.env.WPOW || 1), skirt: process.env.SKIRT === '1', floor: +(process.env.FLOOR || 0), reach: +(process.env.REACH || 2), geo: process.env.GEO === '1', core: +(process.env.CORE || .25), tube: +(process.env.TUBE || 0), cut: process.env.CUT !== '0' }) : hops >= 0 ? fixSkin(root, hops, cut) : null; root.traverse(o => { if (o.isSkinnedMesh) meshes.push(prep(o)); });
  const mixer = new T.AnimationMixer(root), rest = []; root.traverse(o => rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  const clips = g.animations.filter(c => !clipNames || clipNames.includes(c.name)), out = [];
  for (const c of clips) { const poser = makePoser(root, c);   /* 믹서는 멈춘 구간에서 뼈를 다시 안 쓴다 (pose-eval.mjs) */
    const r = { clip: c.name, dur: +c.duration.toFixed(2), worst: 0, at: 0, frac: 0, fracAt: 0, pairs: new Map() };
    for (let t = 0; t <= c.duration + 1e-6; t += step) { for (const [o, p, q, s] of rest) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
      poser(t);
      for (const m of meshes) { m.mesh.skeleton.update(); const s = stretchNow(m, limit); if (s.worst > r.worst) { r.worst = s.worst; r.at = +t.toFixed(2); r.mesh = m.mesh.name; }
        if (s.frac > r.frac) { r.frac = s.frac; r.fracAt = +t.toFixed(2); } for (const [k, n] of s.pairs) r.pairs.set(k, Math.max(r.pairs.get(k) || 0, n)); } }
    r.top = [...r.pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6); delete r.pairs; out.push(r); }
  return { fixed, meshes: meshes.map(m => ({ name: m.mesh.name, edges: m.edges.length, bones: m.mesh.skeleton.bones.length })), clips: out };
}
if ((process.argv[1] || '').endsWith('stretch-audit.mjs')) {
  const [file, list] = process.argv.slice(2).filter(a => !a.startsWith('--')), step = +(process.argv.find(a => a.startsWith('--step=')) || '--step=0.05').slice(7);
  const fa = process.argv.find(a => a.startsWith('--fix=')), hops = fa ? (fa.slice(6) === 'rebind' ? 'rebind' : +fa.slice(6)) : -1, cut = +(process.argv.find(a => a.startsWith('--cut=')) || '--cut=0').slice(6), r = await audit(file, list ? list.split(',') : null, step, 2, hops, cut); if (hops === 'rebind') console.log(JSON.stringify(r.fixed)); else if (hops >= 0) console.log('굳힌 조각 정점', r.fixed.islands, '· 가중치 고친 정점', r.fixed.verts, '(위계 ' + hops + '칸 밖 버림) · 끊은 삼각형', r.fixed.tris, '(주인 뼈 ' + cut + '칸 넘게 먼 것)');
  if (process.argv.includes('--json')) console.log(JSON.stringify(r)); else { console.log(r.meshes); for (const c of r.clips) console.log(`${c.clip.padEnd(18)} ${c.dur}s  최악 ×${c.worst.toFixed(2)} @${c.at}s  2배↑ 변 ${(c.frac * 100).toFixed(2)}% @${c.fracAt}s  ${c.top.map(([k, n]) => k + ' ' + n).join(' | ')}`); }
}
