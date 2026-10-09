// 필드 몬스터 임시 몸 (문서 210 §6) — 류 몸을 몬스터용으로 가볍게. 승인 GLB(갈고리손 …)가 오기 전까지만.
// 몬스터는 화면에서 사람보다 작고 한 화면에 최대 20마리(서버 관심 반경)라, 휴대폰 LOD(1.5만 삼각형)도 20배면 30만이다.
// 클립은 그리기(js/mmo/field-mobs.js CLIP)가 쓰는 다섯만 남긴다. 뼈·스킨 무게·UV 는 그대로.
//   의존성은 make-lod.mjs 와 같다:  GT=<폴더>/node_modules node tools/2d/make-mob-body.mjs [비율=0.07]
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const GT=process.env.GT; if(!GT){ console.error('GT=<node_modules 경로> 가 필요하다'); process.exit(1); }
const imp=m=>{ const pk=JSON.parse(fs.readFileSync(path.join(GT,m,'package.json'))); return import(pathToFileURL(path.join(GT,m,pk.exports?.['.']?.import||pk.module||'index.js')).href); };
const { NodeIO }=await imp('@gltf-transform/core'); const { ALL_EXTENSIONS }=await imp('@gltf-transform/extensions');
const { simplify, weld, prune, dedup, textureCompress }=await imp('@gltf-transform/functions'); const sharp=(await import('node:module')).createRequire(path.join(GT,'x.js'))('sharp'); const { MeshoptSimplifier, MeshoptDecoder, MeshoptEncoder }=await imp('meshoptimizer');
const draco=(await import(pathToFileURL(path.join(GT,'draco3dgltf','draco3dgltf.js')).href)).default;
await MeshoptSimplifier.ready; await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder':MeshoptDecoder, 'meshopt.encoder':MeshoptEncoder, 'draco3d.decoder':await draco.createDecoderModule(), 'draco3d.encoder':await draco.createEncoderModule() });
const SRC='art/3d/ryu_anim.glb', DST='art/3d/lod/mob_temp.glb', KEEP=new Set(['idle','walk','attack1','hit','death']);
const RATIO=+(process.argv[2]||0.07), ERR=+(process.env.ERR||0.02), TEX=+(process.env.TEX||256);
const tris=doc=>doc.getRoot().listMeshes().reduce((a,m)=>a+m.listPrimitives().reduce((b,p)=>b+(p.getIndices()?p.getIndices().getCount():p.getAttribute('POSITION').getCount())/3,0),0);
const doc=await io.read(SRC), t0=tris(doc);
for(const a of doc.getRoot().listAnimations()) if(!KEEP.has(a.getName())) a.dispose();
await doc.transform(weld(), simplify({ simplifier:MeshoptSimplifier, ratio:RATIO, error:ERR, lockBorder:false }), dedup(), prune(), textureCompress({ encoder:sharp, targetFormat:'webp', resize:[TEX,TEX], quality:80 }));
const names=doc.getRoot().listAnimations().map(a=>a.getName()); await io.write(DST,doc);
console.log(SRC,Math.round(t0),'→',Math.round(tris(doc)),'삼각형 ·',(fs.statSync(DST).size/1e6).toFixed(2),'MB · 클립',names.join(' '));
if(names.length!==KEEP.size){ console.error('클립이 모자란다'); process.exit(1); }
