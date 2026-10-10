/* 스킨 다시 묶기를 GLB 에 굽는다 (문서 225) — 디렉터 «모션에 다 늘어나서 붙었네 … 제대로 잡고 가야지».
   js/mmo/skin-fix.js 의 rebindModel(떨어진 조각 굳히기 + 갈래 다시 묶기 + 붙은 살 끊기)을 걸고, 가중치·뼈 번호·삼각형을 «같은 자리, 같은 크기» 로 덮어쓴다.
   끊은 삼각형은 넓이 0 삼각형(0,0,0)으로 채운다 — 버퍼 배치가 그대로라 다른 도구(glb-put-clips 등)와 안 부딪힌다.
   두 번 걸지 않게 asset.extras.skinRebind 에 표를 남긴다. 런타임 비용 0.
     node tools/3d/skin-rebind.mjs art/3d/part1/clave.glb [다른.glb …] [--force]
   tools/3d/jeong-clips.mjs 는 원본에서 다시 구운 뒤 이걸 부른다(원본엔 예전 가중치가 있다). */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';
import { rebindModel } from '../../js/mmo/skin-fix.js';

const SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function chunks(raw) { if (raw.readUInt32LE(0) !== 0x46546C67) throw Error('GLB 아님'); let off = 12, json = null, bin = null;
  while (off < raw.length) { const len = raw.readUInt32LE(off), type = raw.readUInt32LE(off + 4), body = raw.subarray(off + 8, off + 8 + len);
    if (type === 0x4E4F534A) json = JSON.parse(body.toString('utf8')); else if (type === 0x004E4942) bin = Buffer.from(body); off += 8 + len; }
  return { json, bin }; }
/* accessor 자리에 값 쓰기 (byteStride 가 있어도) */
function writeAccessor(json, bin, ai, get) {
  const a = json.accessors[ai], bv = json.bufferViews[a.bufferView], es = SIZE[a.componentType], nc = COMPS[a.type], stride = bv.byteStride || es * nc, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const put = { 5120: (o, v) => bin.writeInt8(v, o), 5121: (o, v) => bin.writeUInt8(v, o), 5122: (o, v) => bin.writeInt16LE(v, o), 5123: (o, v) => bin.writeUInt16LE(v, o), 5125: (o, v) => bin.writeUInt32LE(v, o), 5126: (o, v) => bin.writeFloatLE(v, o) }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < nc; k++) put(base + i * stride + k * es, get(i, k));
}
export async function rebindGlb(file, { force = false, opts = {} } = {}) {
  const raw = fs.readFileSync(file), { json, bin } = chunks(raw);
  if (json.asset?.extras?.skinRebind && !force) return { file, skipped: true };
  const ld = new GLTFLoader(); ld.register(() => ({ name: 'skip', loadTexture: () => Promise.resolve(new T.Texture()) }));
  const g = await ld.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
  const res = rebindModel(T, g.scene, opts), done = [];
  g.scene.traverse(o => { if (!o.isSkinnedMesh) return; const as = g.parser.associations.get(o); if (!as || as.meshes == null) throw Error('메시 연결을 못 찾음: ' + o.name);
    const prim = json.meshes[as.meshes].primitives[as.primitives ?? 0], geo = o.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (json.accessors[prim.attributes.WEIGHTS_0].count !== sw.count) throw Error('정점 수가 다르다: ' + o.name);
    writeAccessor(json, bin, prim.attributes.WEIGHTS_0, (i, k) => sw.getComponent(i, k));
    writeAccessor(json, bin, prim.attributes.JOINTS_0, (i, k) => si.getComponent(i, k));
    if (prim.indices != null && geo.index) { const n0 = json.accessors[prim.indices].count, ix = geo.index; if (ix.count > n0) throw Error('삼각형이 늘었다: ' + o.name);
      writeAccessor(json, bin, prim.indices, i => i < ix.count ? ix.getX(i) : 0); }   /* 끊은 몫 = 넓이 0 삼각형 */
    done.push(o.name); });
  json.asset = json.asset || {}; json.asset.extras = { ...(json.asset.extras || {}), skinRebind: { v: 1, by: 'tools/3d/skin-rebind.mjs', meshes: res.map(r => ({ mesh: r.mesh, islands: r.islands, changed: r.changed, cut: r.cut })) } };
  let js = Buffer.from(JSON.stringify(json), 'utf8'); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const b = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]), head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + b.length, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4); bh.writeUInt32LE(b.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, js, bh, b]));
  return { file, meshes: done, res };
}
if ((process.argv[1] || '').endsWith('skin-rebind.mjs')) {
  const force = process.argv.includes('--force');
  for (const f of process.argv.slice(2).filter(a => !a.startsWith('--'))) { const r = await rebindGlb(f, { force }); console.log(r.skipped ? `${f}: 이미 묶음 (--force 로 다시)` : `${f}: ${JSON.stringify(r.res.map(x => ({ mesh: x.mesh, 굳힘: x.islands, 고침: x.changed, 끊음: x.cut })))}`); }
}
