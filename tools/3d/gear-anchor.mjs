/* 장비 자리 옮기기 — 옛 몸의 «장비 자리» 를 새 몸 뼈에 적는다 (docs/design/80).

   왜: js/looks.js 의 방어구 자리(ARMOR)는 옛 몸의 옛 관절에 맞춰 잰 값이다. 옛 몸은 다시 리깅할 때 뼈마다 옛 관절
   자리를 extras.rerigAnchor 로 남겨 거기에 장비를 붙였다(docs/design/77). 새 몸(mesh-swap + Blender 무게)은 그
   자리가 없어 장비가 새 관절에 바로 붙었고 — 머리 관절이 7.5 cm 낮아 후드가 어깨로 흘러내렸다.
   옛 자리의 «바인드 세계 좌표» 를 새 뼈 로컬로 바꿔 extras.gearAnchor 로 적는다. 몸통 세로 뼈(머리·목·가슴)는
   새 몸 가운데로(x = 0) 맞추고, 머리는 두 몸의 정수리 높이 차·머리 앞뒤 가운데 차만큼 옮긴다
   (새 세라는 머리가 목 관절보다 앞으로 나와 후드가 뒤통수에 걸렸다).
   rerigAnchor 와 이름을 나눈 까닭: js/wind.js 는 rerigAnchor 로 옷자락을 가른다 — 새 몸은 새 관절이 맞다.

     node tools/3d/gear-anchor.mjs <옛 glb> <새 glb> <출력 glb> [--skip 정규식]
   손 슬롯(HandSlot)은 늘 뺀다(무기 자리는 쥔 손이 정한다). 아인은 --skip 'ForeArm$|Hand$' — 옛 아인도 이 둘은
   ain-bind-repair 가 관절 자체를 옮기고 옛 자리를 지웠다.
*/
import {readFile, writeFile} from 'node:fs/promises';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';

const [oldF, newF, outF] = process.argv.slice(2); const si = process.argv.indexOf('--skip'), SKIP = new RegExp(si > 0 ? process.argv[si + 1] : '^$');
async function load(f) {
  const b = await readFile(f), l = new GLTFLoader();
  l.register(() => ({name: 'no-raster', loadTexture: () => Promise.resolve(new T.Texture())}));
  const g = await l.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); g.scene.updateMatrixWorld(true); return g;
}
const strip = n => n.replace(/^mixamorig:?/, '');
function info(g) {
  const bones = {}; let mesh = null;
  g.scene.traverse(o => { if (o.isBone) bones[strip(o.name)] = o; if (o.isSkinnedMesh && !mesh) mesh = o; });
  /* 정수리 = 머리 무게가 큰 정점 중 가장 높은 곳(바인드) */
  const p = mesh.geometry.attributes.position, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
  const hi = mesh.skeleton.bones.findIndex(b => strip(b.name) === 'Head'); let top = -1e9; const c = new T.Vector3(); let cn = 0;
  for (let i = 0; i < p.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hi) w += sw.getComponent(i, k);
    if (w > .5) { top = Math.max(top, p.getY(i)); c.x += p.getX(i); c.z += p.getZ(i); cn++; } }
  c.multiplyScalar(1 / cn);   // 머리(머리칼 포함) 가로·앞뒤 가운데
  return {bones, top, c};
}
const O = info(await load(oldF)), N = info(await load(newF));
const raw = await readFile(newF), jl = raw.readUInt32LE(12), J = JSON.parse(raw.subarray(20, 20 + jl).toString());
const bin = raw.subarray(20 + jl);
const CENTER = new Set(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']);
const dTop = N.top - O.top;
let n = 0;
for (const node of J.nodes) {
  const name = strip(node.name || ''), ob = O.bones[name], nb = N.bones[name];
  if (!ob || !nb || /HandSlot$/.test(name) || SKIP.test(name)) continue;
  const a = ob.userData.rerigAnchor || [0, 0, 0];
  const w = new T.Vector3(...a).applyMatrix4(ob.matrixWorld);
  if (CENTER.has(name)) w.x = nb.getWorldPosition(new T.Vector3()).x;
  if (name === 'Head' || name === 'Neck') { w.y += dTop; w.z += N.c.z - O.c.z; }   // 머리가 목 관절보다 앞으로 나온 만큼(새 세라 +z)
  const local = nb.worldToLocal(w.clone());
  if (local.length() < 1e-3) continue;
  node.extras = {...(node.extras || {}), gearAnchor: local.toArray().map(v => +v.toFixed(5))}; n++;
  if (/^(Head|Spine1|LeftLeg|LeftForeArm|Neck)$/.test(name)) console.log(name.padEnd(12), '옛 자리', w.toArray().map(v => v.toFixed(3)).join(','), '→ 새 뼈 로컬', local.toArray().map(v => v.toFixed(3)).join(','));
}
console.log(`뼈 ${n} 개에 장비 자리 · 정수리 옛 ${O.top.toFixed(3)} 새 ${N.top.toFixed(3)} (차 ${(dTop * 100).toFixed(1)} cm) · 머리 앞뒤 차 ${((N.c.z - O.c.z) * 100).toFixed(1)} cm`);
let js = Buffer.from(JSON.stringify(J)); const pad = (4 - js.length % 4) % 4; js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
const head = Buffer.alloc(20); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + js.length + bin.length, 8); head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4E4F534A, 16);
await writeFile(outF, Buffer.concat([head, js, bin])); console.log('썼다', outF);
