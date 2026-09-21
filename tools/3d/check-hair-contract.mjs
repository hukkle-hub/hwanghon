/* 머리카락 파일 계약 검사기 — docs/design/45 §3
 *
 *   node tools/3d/check-hair-contract.mjs art/3d/ain_body.glb [...]
 *   node tools/3d/check-hair-contract.mjs            (전부)
 *
 * 후보 GLB 가 올라왔을 때 «눈으로 보기 전에» 걸러 내려고 만들었다. 네 가지를 본다.
 *
 *   1. 분리   — js/hair.js 가 머리카락을 찾아내는가 (§3.1)
 *   2. 독점   — 그 재질을 살·옷이 같이 쓰고 있지 않은가 (§3.1)
 *   3. 스킨   — 같은 리그에 물려 있는가, 아니면 고개 돌릴 때 머리만 남는가 (§3.1)
 *   4. 두피   — 머리카락을 끄면 그 밑에 살이 있는가, 구멍인가 (§3.2)
 *
 * 4 번은 머리뼈 중심에서 위쪽 반구를 16×8 로 나눠, 머리카락이 아닌 면이 몇 칸이나
 * 채우는지 센다. 구멍은 «경계 모서리»(한 면에만 붙은 모서리) 가 정수리에 있는지로 본다.
 *
 * 경계 모서리를 «메시마다 따로» 세면 안 된다 — 처음에 그렇게 짰다가 멀쩡한 세라가
 * 178 개로 걸렸다. VRoid 는 머리 살을 Body_SKIN 과 Face_SKIN 두 메시로 나눠 놓는데,
 * 둘이 맞닿은 이음매가 각 메시에서는 «한 면에만 붙은 모서리» 로 보인다. 그래서
 * 머리카락이 아닌 면을 전부 0.1 mm 격자로 «용접한 뒤» 한 번에 센다. 그러면 세라·
 * 카인·류 모두 0 이 나온다. 눈썹·속눈썹 같은 판때기는 정수리보다 낮으므로 자동으로 빠진다.
 *
 * 색이 살색인지까지는 못 본다 — 그건 눈으로 봐야 한다.
 */
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join, basename} from 'node:path';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
new Function(await readFile(join(ROOT, 'js/hair.js'), 'utf8'))();
const {TW_HAIR} = globalThis;

const files = process.argv.slice(2).length ? process.argv.slice(2)
  : ['ain', 'kain', 'ryu', 'sera'].flatMap(c => [`art/3d/${c}_anim.glb`, `art/3d/${c}_body.glb`]);

async function load(p) {
  const b = await readFile(join(ROOT, p)), l = new GLTFLoader();
  l.register(() => ({name: 'no-raster', loadTexture: () => Promise.resolve(new T.Texture())}));
  return l.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
}
const OK = '  ✔ ', NO = '  ✘ ', HM = '  · ';
const tris = m => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;

/* 한 면에만 붙은 모서리 = 뚫린 자리. 메시 경계의 이음매를 구멍으로 세지 않도록
   머리카락이 아닌 면을 0.1 mm 격자로 용접한 뒤 한 덩어리로 센다. */
function openEdgesAbove(meshes, y0) {
  const vid = new Map(), edge = new Map(), v = new T.Vector3();
  const id = (m, i) => {
    v.fromBufferAttribute(m.geometry.attributes.position, i).applyMatrix4(m.matrixWorld);
    const k = Math.round(v.x * 1e4) + ',' + Math.round(v.y * 1e4) + ',' + Math.round(v.z * 1e4);
    let r = vid.get(k); if (!r) vid.set(k, r = {n: vid.size, y: v.y});
    return r;
  };
  for (const m of meshes) { const idx = m.geometry.index; if (!idx) continue;
    for (let i = 0; i < idx.count; i += 3) {
      const t = [id(m, idx.getX(i)), id(m, idx.getX(i + 1)), id(m, idx.getX(i + 2))];
      for (let e = 0; e < 3; e++) { const a = t[e], b = t[(e + 1) % 3]; if (a.n === b.n) continue;
        const k = a.n < b.n ? a.n + ':' + b.n : b.n + ':' + a.n;
        let r = edge.get(k); if (!r) edge.set(k, r = {c: 0, y: Math.min(a.y, b.y)});
        r.c++; } } }
  let n = 0; for (const r of edge.values()) if (r.c === 1 && r.y > y0) n++;
  return n;
}

let bad = 0;
for (const f of files) {
  let gltf; try { gltf = await load(f); } catch (e) { console.log(`\n${basename(f)}\n${NO}읽지 못했다 — ${e.message}`); bad++; continue; }
  const scene = gltf.scene; scene.updateMatrixWorld(true);

  const meshes = []; let head = null, bones = new Set();
  scene.traverse(o => {
    if (o.isMesh) meshes.push(o);
    if (o.isBone) { const n = o.name.replace(/^mixamorig:?/, ''); bones.add(n);
      if (n === 'Head') head = o.getWorldPosition(new T.Vector3()); }
  });
  const hairs = TW_HAIR.find(scene);
  const skin = meshes.filter(m => !hairs.includes(m));
  console.log(`\n${basename(f)}  — 메시 ${meshes.length} · 면 ${meshes.reduce((s, m) => s + tris(m), 0).toLocaleString()}`);

  /* 1. 분리 */
  if (!hairs.length) { console.log(`${NO}1 분리 — 머리카락 조각이 없다. 살·옷과 한 메시다 (§3.1)`);
    console.log(`${HM}     재질: ${[...new Set(meshes.flatMap(m => [].concat(m.material).map(x => x && x.name)))].join(', ')}`);
    bad++; continue; }
  console.log(`${OK}1 분리 — ${hairs.length}조각 · 면 ${hairs.reduce((s, m) => s + tris(m), 0).toLocaleString()}` +
              ` (${(100 * hairs.reduce((s, m) => s + tris(m), 0) / meshes.reduce((s, m) => s + tris(m), 0)).toFixed(1)}%)` +
              ` · ${hairs.map(m => [].concat(m.material).map(x => x && x.name).join('/')).join(', ')}`);

  /* 2. 독점 */
  const hairMats = new Set(hairs.flatMap(m => [].concat(m.material)));
  const shared = skin.filter(m => [].concat(m.material).some(x => hairMats.has(x)));
  if (shared.length) { console.log(`${NO}2 독점 — 머리카락 재질을 ${shared.map(m => m.name).join(', ')} 도 쓴다 (§3.1)`); bad++; }
  else console.log(`${OK}2 독점 — 머리카락 재질을 다른 메시가 쓰지 않는다`);

  /* 3. 스킨 */
  const loose = hairs.filter(m => !m.isSkinnedMesh);
  const offrig = hairs.filter(m => m.isSkinnedMesh && m.skeleton &&
    !m.skeleton.bones.some(b => b.name.replace(/^mixamorig:?/, '') === 'Head'));
  if (loose.length) { console.log(`${NO}3 스킨 — ${loose.map(m => m.name).join(', ')} 이 리그에 안 물렸다 (§3.1)`); bad++; }
  else if (offrig.length) { console.log(`${NO}3 스킨 — Head 뼈가 없는 스켈레톤에 물렸다 (§3.1)`); bad++; }
  else console.log(`${OK}3 스킨 — ${hairs.length}조각 모두 Head 를 가진 리그에 물려 있다`);

  /* 4. 두피 */
  if (!head) { console.log(`${HM}4 두피 — Head 뼈가 없어 못 쟀다`); }
  else {
    const hb = new T.Box3(); hairs.forEach(m => hb.expandByObject(m));
    const bins = new Set(), v = new T.Vector3();
    for (const m of skin) { const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).sub(head);
        if (v.length() < 1e-4) continue; v.normalize(); if (v.y < 0.30) continue;   // 위쪽 반구만
        bins.add(Math.floor((Math.atan2(v.z, v.x) + Math.PI) / (2 * Math.PI) * 16) + ':' + Math.floor((v.y - 0.30) / 0.70 * 8)); } }
    const cover = bins.size / (16 * 8);
    const y0 = head.y + (hb.max.y - head.y) * 0.65;          /* 눈썹·속눈썹 판때기보다 위 */
    const holes = openEdgesAbove(skin, y0);
    const line = `정수리 방향 ${bins.size}/128 칸 채움 (${(cover * 100).toFixed(0)}%) · 정수리 열린 모서리 ${holes}개`;
    if (cover < 0.35 || holes > 8) { console.log(`${NO}4 두피 — ${line} → 머리카락을 끄면 뚫려 보인다 (§3.2)`); bad++; }
    else console.log(`${OK}4 두피 — ${line}`);
    console.log(`${HM}     색이 살색인지는 못 본다 — viewer.html 로 한 번 봐 주세요`);
  }
}
console.log(bad ? `\n계약 위반 ${bad}건.` : '\n전부 계약을 지킨다.');
process.exit(bad ? 1 : 0);
