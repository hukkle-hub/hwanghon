/* 스킨 무게 옮기기 — Meshy 리그의 무게를 우리 캐릭터 메시로 (docs/design/77).
 *
 * 카인·류는 우리 bpy 자동 리깅(거리 무게)이라 팔을 어깨 위로 올리면 위팔 스킨이 칼날처럼
 * 찢어진다(해머 스윙에서 변 4% 가 2배 넘게 늘어남). 같은 몸(…_body.glb)을 Meshy 가 리깅한
 * 결과는 같은 자세에서 0.3~0.5% 다. 그래서 Meshy 의 무게를 가져온다:
 *
 *   1. 두 메시를 바인드 자세 월드 좌표로 (Meshy 는 Armature 0.01 배, cm 단위)
 *   2. 우리 정점마다 Meshy 삼각형 위 가장 가까운 점 → 세 꼭짓점 무게를 무게중심 좌표로 섞음
 *   3. 뼈 이름을 우리 이름으로 (척추 순서가 반대: Spine02→Spine …) → 상위 4개, 합 1
 *   4. glb 의 JOINTS_0/WEIGHTS_0 만 새 접근자로 바꿔 쓴다 — 정점·UV·애니메이션은 그대로
 *
 *   node tools/3d/skin-transfer.mjs <우리.glb> <meshy.glb> [--out 파일] [--near 0.02] [--far 0.06] [--smooth 3]
 */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const args=process.argv.slice(2), tgtPath=args[0], srcPath=args[1];
const OUT=args.includes('--out')?args[args.indexOf('--out')+1]:tgtPath;
const MAXD=args.includes('--max-dist')?+args[args.indexOf('--max-dist')+1]:0.03;
const load=async f=>{const b=fs.readFileSync(f),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const MAP={Hips:'Hips',Spine:'Spine02',Spine1:'Spine01',Spine2:'Spine',Neck:'neck',Head:'Head',
  LeftShoulder:'LeftShoulder',LeftArm:'LeftArm',LeftForeArm:'LeftForeArm',LeftHand:'LeftHand',
  RightShoulder:'RightShoulder',RightArm:'RightArm',RightForeArm:'RightForeArm',RightHand:'RightHand',
  LeftUpLeg:'LeftUpLeg',LeftLeg:'LeftLeg',LeftFoot:'LeftFoot',LeftToeBase:'LeftToeBase',
  RightUpLeg:'RightUpLeg',RightLeg:'RightLeg',RightFoot:'RightFoot',RightToeBase:'RightToeBase'};
const INV=Object.fromEntries(Object.entries(MAP).map(([a,b])=>[b,a]));
const tg=await load(tgtPath), sg=await load(srcPath);
const one=g=>{let m;g.scene.traverse(o=>{if(o.isSkinnedMesh&&!m)m=o;});return m;};
const TM=one(tg), SM=one(sg);
tg.scene.updateMatrixWorld(true); SM.skeleton.pose(); sg.scene.updateMatrixWorld(true);
/* 바인드 자세 월드 좌표 */
const world=(m,useSkin)=>{const n=m.geometry.attributes.position.count,out=new Float32Array(n*3),v=new T.Vector3();
  for(let i=0;i<n;i++){ if(useSkin) m.getVertexPosition(i,v); else v.fromBufferAttribute(m.geometry.attributes.position,i); v.applyMatrix4(m.matrixWorld); out.set([v.x,v.y,v.z],i*3); } return out;};
const TP=world(TM,false), SP=world(SM,true);
const box=P=>{const b=new T.Box3();for(let i=0;i<P.length;i+=3)b.expandByPoint(new T.Vector3(P[i],P[i+1],P[i+2]));return b;};
const tb=box(TP), sb=box(SP), ts=tb.getSize(new T.Vector3()), ss=sb.getSize(new T.Vector3());
process.stderr.write(`우리 ${TM.geometry.attributes.position.count} 정점, 크기 ${ts.toArray().map(v=>v.toFixed(3))} · Meshy ${SM.geometry.attributes.position.count} 정점, 크기 ${ss.toArray().map(v=>v.toFixed(3))}\n`);
/* 뼈로 맞춘다 — Meshy 는 «속옷 몸»(…_body.glb)을, 우리는 옷 입은 메시를 쓴다. 겉모양이 달라
   상자 크기로 맞추면 어긋난다. 골반·머리 관절을 기준으로 옮기고 키 비율로 늘린다. */
const jw=(g,nm)=>{let b;g.scene.traverse(o=>{if(o.isBone&&o.name.replace(/^mixamorig:?/,'')===nm)b=o;});return b.getWorldPosition(new T.Vector3());};
const tH=jw(tg,'Hips'), tHd=jw(tg,'Head'), sH=jw(sg,'Hips'), sHd=jw(sg,'Head'), k=tH.distanceTo(tHd)/sH.distanceTo(sHd);
for(let i=0;i<SP.length;i+=3){ SP[i]=(SP[i]-sH.x)*k+tH.x; SP[i+1]=(SP[i+1]-sH.y)*k+tH.y; SP[i+2]=(SP[i+2]-sH.z)*k+tH.z; }
process.stderr.write(`뼈 맞춤: 배율 ${k.toFixed(2)}, 골반 ${tH.toArray().map(v=>v.toFixed(3))}\n`);
/* Meshy 삼각형 격자 */
const sidx=SM.geometry.index.array, cell=0.05, grid=new Map(), key=(x,y,z)=>`${Math.floor(x/cell)},${Math.floor(y/cell)},${Math.floor(z/cell)}`;
for(let t=0;t<sidx.length;t+=3){ const a=sidx[t]*3,b=sidx[t+1]*3,c=sidx[t+2]*3;
  const mn=[0,1,2].map(j=>Math.min(SP[a+j],SP[b+j],SP[c+j])), mx=[0,1,2].map(j=>Math.max(SP[a+j],SP[b+j],SP[c+j]));
  for(let x=Math.floor(mn[0]/cell);x<=Math.floor(mx[0]/cell);x++)for(let y=Math.floor(mn[1]/cell);y<=Math.floor(mx[1]/cell);y++)for(let z=Math.floor(mn[2]/cell);z<=Math.floor(mx[2]/cell);z++){
    const kk=`${x},${y},${z}`; if(!grid.has(kk)) grid.set(kk,[]); grid.get(kk).push(t); } }
const tri=new T.Triangle(), cp=new T.Vector3(), bary=new T.Vector3(), P=new T.Vector3();
const sJ=SM.geometry.attributes.skinIndex, sW=SM.geometry.attributes.skinWeight;
const sName=SM.skeleton.bones.map(b=>b.name.replace(/^mixamorig:?/,'')), tName=TM.skeleton.bones.map(b=>b.name.replace(/^mixamorig:?/,''));
const tIndex=Object.fromEntries(tName.map((n,i)=>[n,i]));
const n=TM.geometry.attributes.position.count, J=new Uint16Array(n*4), W=new Float32Array(n*4), MW=new Array(n), DIST=new Float32Array(n);
const NEAR=args.includes('--near')?+args[args.indexOf('--near')+1]:0.02, FAR=args.includes('--far')?+args[args.indexOf('--far')+1]:0.06, SMOOTH=args.includes('--smooth')?+args[args.indexOf('--smooth')+1]:3, CORE=args.includes('--core')?+args[args.indexOf('--core')+1]:0.025;
let far=0, worst=0;
for(let i=0;i<n;i++){ P.set(TP[i*3],TP[i*3+1],TP[i*3+2]); let best=Infinity,bt=-1,bb=null;
  for(let r=0;r<=6&&bt<0;r++){ const cx=Math.floor(P.x/cell),cy=Math.floor(P.y/cell),cz=Math.floor(P.z/cell);
    for(let x=cx-r;x<=cx+r;x++)for(let y=cy-r;y<=cy+r;y++)for(let z=cz-r;z<=cz+r;z++){ const L=grid.get(`${x},${y},${z}`); if(!L) continue;
      for(const t of L){ const a=sidx[t]*3,b=sidx[t+1]*3,c=sidx[t+2]*3;
        tri.a.set(SP[a],SP[a+1],SP[a+2]); tri.b.set(SP[b],SP[b+1],SP[b+2]); tri.c.set(SP[c],SP[c+1],SP[c+2]);
        tri.closestPointToPoint(P,cp); const d=cp.distanceToSquared(P); if(d<best){ best=d; bt=t; tri.getBarycoord(cp,bary); bb=bary.clone(); } } } }
  const acc={}; const d=Math.sqrt(best); worst=Math.max(worst,d); if(d>MAXD) far++;
  if(bt>=0){ [0,1,2].forEach((c,ci)=>{ const v=sidx[bt+c], bw=[bb.x,bb.y,bb.z][ci];
      for(let q=0;q<4;q++){ const w=sW.getComponent(v,q)*bw; if(w<=0) continue; const nm=INV[sName[sJ.getComponent(v,q)]]; const ti=tIndex[nm]; if(ti==null) continue; acc[ti]=(acc[ti]||0)+w; } }); }
  MW[i]=acc; DIST[i]=d; }
/* 2차 규칙 (1차는 코트 자락이 팔에 거미줄처럼 붙고 무게가 점점이 튀었다):
   · 몸에서 멀수록(옷) 원래 무게를 쓴다 — 2 cm 까지 Meshy, 6 cm 부터 원래, 사이는 섞음
   · «부위» 를 바꾸지 않는다 — 원래 무게와 Meshy 무게의 주 부위(몸통·왼팔·오른팔·왼다리·오른다리)가
     다르면 원래 무게. Meshy 는 «같은 부위 안에서 어떻게 나눌지» 만 고친다
   · 메시 변을 따라 무게를 몇 번 펴서 점점이 튀는 것을 없앤다 */
const tJ=TM.geometry.attributes.skinIndex, tW=TM.geometry.attributes.skinWeight;
const part=nm=>/^Left(Shoulder|Arm|ForeArm|Hand)/.test(nm)?'LA':/^Right(Shoulder|Arm|ForeArm|Hand)/.test(nm)?'RA':/^Left(UpLeg|Leg|Foot|Toe)/.test(nm)?'LL':/^Right(UpLeg|Leg|Foot|Toe)/.test(nm)?'RL':'C';
const domPart=w=>{const by={};for(const [bi,v] of Object.entries(w)){const pp=part(tName[bi]);by[pp]=(by[pp]||0)+v;}return Object.entries(by).sort((x,y)=>y[1]-x[1])[0]?.[0];};
const smooth3=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const cur=new Array(n); let kept=0, mixed=0;
for(let i=0;i<n;i++){ const orig={}; for(let q=0;q<4;q++){ const w=tW.getComponent(i,q); if(w>0) orig[tJ.getComponent(i,q)]=(orig[tJ.getComponent(i,q)]||0)+w; }
  /* 부위가 다를 때: 몸통↔팔다리는 몸에 붙은 정점(겨드랑이·어깨, ≤ CORE m)만 Meshy 를 따른다 —
     바로 거기가 우리 무게가 틀린 곳이다. 좌↔우, 팔↔다리, 몸에서 뜬 옷은 원래대로. */
  let a=1-smooth3(NEAR,FAR,DIST[i]); const pm=domPart(MW[i]), po=domPart(orig);
  if(pm!==po&&!((pm==='C'||po==='C')&&DIST[i]<=CORE)) a=0; if(a<=0) kept++; else if(a<1) mixed++;
  const w={}; for(const [bi,v] of Object.entries(orig)) w[bi]=(w[bi]||0)+(1-a)*v; for(const [bi,v] of Object.entries(MW[i])) w[bi]=(w[bi]||0)+a*v; cur[i]=w; }
const nb=Array.from({length:n},()=>new Set()), tidx=TM.geometry.index.array;
for(let t=0;t<tidx.length;t+=3){ const a=tidx[t],b=tidx[t+1],c=tidx[t+2]; nb[a].add(b);nb[a].add(c);nb[b].add(a);nb[b].add(c);nb[c].add(a);nb[c].add(b); }
for(let it=0;it<SMOOTH;it++){ const nx=new Array(n);
  for(let i=0;i<n;i++){ const w={}; for(const [bi,v] of Object.entries(cur[i])) w[bi]=.5*v; const L=[...nb[i]]; if(!L.length){ nx[i]=cur[i]; continue; }
    for(const j of L) for(const [bi,v] of Object.entries(cur[j])) w[bi]=(w[bi]||0)+.5*v/L.length; nx[i]=w; }
  for(let i=0;i<n;i++) cur[i]=nx[i]; }
for(let i=0;i<n;i++){ const top=Object.entries(cur[i]).sort((x,y)=>y[1]-x[1]).slice(0,4), s=top.reduce((z,[,w])=>z+w,0)||1;
  for(let q=0;q<4;q++){ J[i*4+q]=top[q]?+top[q][0]:0; W[i*4+q]=top[q]?top[q][1]/s:(q===0&&!top.length?1:0); } }
process.stderr.write(`원래 무게 유지 ${kept} · 섞음 ${mixed} · Meshy ${n-kept-mixed} 정점, 펴기 ${SMOOTH}회\n`);
process.stderr.write(`가장 먼 정점 ${worst.toFixed(4)} m, ${MAXD} m 넘는 정점 ${far}개 (${(far/n*100).toFixed(2)}%) — 옷이 몸에서 떨어진 만큼이다\n`);
/* glb 쓰기 — JOINTS_0 / WEIGHTS_0 를 새 버퍼뷰로 */
const buf=fs.readFileSync(tgtPath), jl=buf.readUInt32LE(12), json=JSON.parse(buf.slice(20,20+jl).toString());
let bin=buf.slice(20+jl+8, 20+jl+8+buf.readUInt32LE(20+jl));
const meshIdx=json.nodes.find(nd=>nd.skin!=null&&nd.mesh!=null).mesh, prim=json.meshes[meshIdx].primitives[0];
const addView=(arr)=>{ const pad=(4-bin.length%4)%4; bin=Buffer.concat([bin,Buffer.alloc(pad),Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength)]);
  json.bufferViews.push({buffer:0,byteOffset:bin.length-arr.byteLength,byteLength:arr.byteLength}); return json.bufferViews.length-1; };
json.accessors.push({bufferView:addView(J),componentType:5123,count:n,type:'VEC4'}); prim.attributes.JOINTS_0=json.accessors.length-1;
json.accessors.push({bufferView:addView(W),componentType:5126,count:n,type:'VEC4'}); prim.attributes.WEIGHTS_0=json.accessors.length-1;
json.buffers[0].byteLength=bin.length;
json.extras={...(json.extras||{}),skin:`meshy weights from ${srcPath.split('/').pop()}`};
let js=Buffer.from(JSON.stringify(json)); js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
const binPad=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);
const head=Buffer.alloc(12); head.writeUInt32LE(0x46546C67,0); head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+binPad.length,8);
const ch=(len,type)=>{const b=Buffer.alloc(8);b.writeUInt32LE(len,0);b.writeUInt32LE(type,4);return b;};
fs.writeFileSync(OUT,Buffer.concat([head,ch(js.length,0x4E4F534A),js,ch(binPad.length,0x004E4942),binPad]));
process.stderr.write(`썼다 ${OUT} (${(fs.statSync(OUT).size/1e6).toFixed(2)} MB)\n`);
