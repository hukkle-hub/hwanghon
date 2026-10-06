// 휴대폰용 가벼운 모델(LOD) 만들기 — 2D 맵 MMORPG 필드에서 인물은 화면 높이의 18% 남짓이라 14만 삼각형이 필요 없다 (docs/design/185 §6.2).
// meshoptimizer 로 삼각형을 줄인다. 뼈·스킨 무게·UV·애니메이션은 그대로 둔다.
//   텍스처도 줄인다: 화면에서 150px 남짓인 인물에 2K 텍스처는 낭비 — 긴 변 TEX(기본 512) px · webp.
//   의존성(저장소에 넣지 않음): npm i --prefix <폴더> @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer draco3dgltf sharp
//   GT=<폴더>/node_modules node tools/2d/make-lod.mjs [비율=0.25]
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const GT=process.env.GT; if(!GT){ console.error('GT=<node_modules 경로> 가 필요하다'); process.exit(1); }
const imp=m=>import(pathToFileURL(path.join(GT,m,JSON.parse(fs.readFileSync(path.join(GT,m,'package.json'))).exports?.['.']?.import||JSON.parse(fs.readFileSync(path.join(GT,m,'package.json'))).module||'index.js')).href);
const { NodeIO }=await imp('@gltf-transform/core'); const { ALL_EXTENSIONS }=await imp('@gltf-transform/extensions');
const { simplify, weld, prune, dedup, textureCompress, compactPrimitive }=await imp('@gltf-transform/functions'); const sharp=(await import('node:module')).createRequire(path.join(GT,'x.js'))('sharp'); const { MeshoptSimplifier, MeshoptDecoder, MeshoptEncoder }=await imp('meshoptimizer');
const draco=(await import(pathToFileURL(path.join(GT,'draco3dgltf','draco3dgltf.js')).href)).default;
await MeshoptSimplifier.ready; await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder':MeshoptDecoder, 'meshopt.encoder':MeshoptEncoder, 'draco3d.decoder':await draco.createDecoderModule(), 'draco3d.encoder':await draco.createEncoderModule() });
const RATIO=+(process.argv[2]||0.25), ERR=+(process.env.ERR||0.004), GEAR_ERR=+(process.env.GEAR_ERR||0.02), TEX=+(process.env.TEX||512), SLOPPY=+(process.env.SLOPPY||0.5);   /* 엉성한 축소는 덜 — 0.25 에서 흉갑에 구멍 */   /* 장비는 화면에서 더 작다 — 오차를 더 허용 */
const tris=doc=>doc.getRoot().listMeshes().reduce((a,m)=>a+m.listPrimitives().reduce((b,p)=>b+(p.getIndices()?p.getIndices().getCount():p.getAttribute('POSITION').getCount())/3,0),0);
const JOBS=[...['ain','kain','ryu','sera'].map(c=>['art/3d/'+c+'_anim.glb','art/3d/lod/'+c+'_anim.glb']),
  ...fs.readdirSync('art/3d/gear').filter(f=>f.endsWith('.glb')&&!/red_tension/.test(f)).map(f=>['art/3d/gear/'+f,'art/3d/lod/gear/'+f])];
fs.mkdirSync('art/3d/lod/gear',{recursive:true}); let before=0, after=0, sloppy=0;
for(const [src,dst] of JOBS){ const doc=await io.read(src); const t0=tris(doc);
  const orig=new Map(); doc.getRoot().listMeshes().forEach(m=>m.listPrimitives().forEach(p=>{ if(p.getIndices()) orig.set(p,p.getIndices().getCount()); }));
  await doc.transform(weld(), simplify({ simplifier:MeshoptSimplifier, ratio:RATIO, error:src.includes('/gear/')?GEAR_ERR:ERR, lockBorder:false }), dedup(), prune(), textureCompress({ encoder:sharp, targetFormat:'webp', resize:[TEX,TEX], quality:82 }));
  /* 안 줄어든 조각(Hi3D·Tripo 출력은 삼각형마다 정점이 따로라 위상이 없다) → 위치로만 묶는 «엉성한» 축소.
     UV 는 정점에 남아 있어 섬 경계가 조금 늘어나지만, 화면 150px 인물에서는 안 보인다 */
  for(const mesh of doc.getRoot().listMeshes()) for(const prim of mesh.listPrimitives()){ const ix=prim.getIndices(), pos=prim.getAttribute('POSITION'); if(!ix||!pos) continue;
    if(prim.getAttribute('JOINTS_0')) continue;   /* 스킨 메시(영웅 몸)는 하지 않는다 — 아인 어깨 갑주·머리카락에 구멍이 났다 (확대 비교, 문서 185 §6.3) */
    const n0=orig.get(prim)||ix.getCount(), target=Math.floor(n0*SLOPPY/3)*3; if(ix.getCount()<=target*1.15) continue;
    const P=new Float32Array(pos.getCount()*3), e=[]; for(let i=0;i<pos.getCount();i++){ pos.getElement(i,e); P[i*3]=e[0]; P[i*3+1]=e[1]; P[i*3+2]=e[2]; }   /* 양자화돼 있어도 실수로 */
    const [out]=MeshoptSimplifier.simplifySloppy(new Uint32Array(ix.getArray()), P, 3, null, target, 0.02);
    if(out.length>=3){ ix.setArray(new Uint32Array(out)); compactPrimitive(prim); sloppy++; } }
  const t1=tris(doc); await io.write(dst, doc); before+=t0; after+=t1;
  console.log(path.basename(src).padEnd(28), String(Math.round(t0)).padStart(7),'→',String(Math.round(t1)).padStart(6), (fs.statSync(dst).size/1e6).toFixed(2)+' MB'); }
console.log('합계',Math.round(before),'→',Math.round(after),'· 엉성한 축소',sloppy);
