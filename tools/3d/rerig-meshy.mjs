/* 다시 리깅 — 우리 캐릭터 메시를 Meshy 뼈대(관절 위치 + 무게)로 옮기고, 모든 클립을 새 뼈대로 다시 굽는다.
 * (docs/design/77)
 *
 * 왜: 카인 스킨이 팔을 어깨 위로 올릴 때 칼날처럼 찢어진다. 무게만 Meshy 것으로 바꿔 봐도
 * 거의 그대로였다(409 → 325‱) — Meshy 무게는 Meshy 관절 위치를 전제로 한 것인데 우리 관절이
 * 4~15 cm 어긋나 있다(어깨 4 cm 아래, 가슴 척추 10 cm 아래, 넓적다리 8 cm 위). 그래서 관절째 옮긴다.
 *
 *   1. 관절 = Meshy 바인드 자세 관절(메시 상자로 맞춰 — 메시 일치 중앙 0.0 mm). 이름·부모는 우리 것 그대로.
 *      손 슬롯(RightHandSlot 등)은 손에 대한 상대 위치·방향 그대로 따라간다.
 *   2. 무게 = Meshy 삼각형 위 가장 가까운 점의 무게(뼈 이름을 우리 것으로), 한 번 편다.
 *   3. 클립 = 옛 뼈대로 틀었을 때 각 뼈의 «월드 회전 변화» D(t)=W(t)·W_rest⁻¹ 를 새 뼈대에 그대로:
 *      W_new(t)=D(t)·W_new_rest → 로컬. 골반 위치는 변위 그대로(키가 같다).
 *   4. glb 에 쓴다: 뼈 노드 이동값, 역바인드 행렬, JOINTS/WEIGHTS, 모든 애니메이션(원래 키 시각).
 *      뼈마다 «옛 관절 자리»를 extras.rerigAnchor 로 남긴다 — js/looks.js 가 장비를 거기에 붙인다.
 *
 *   node tools/3d/rerig-meshy.mjs <우리.glb> <meshy 리그.glb> [--out 파일] [--dry] [--clips a,b] [--smooth N] [--head-rigid [--chin y] [--neck-blend m] [--head-lo a --head-hi b]]
 *   --dry: 파일을 쓰지 않고 새 리그를 메모리에서 만들어 JSON 요약만 (검증용). 모듈로 import 해서
 *          buildRig() 를 쓰면 three 객체를 그대로 받는다.
 */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';

const MAP={Hips:'Hips',Spine:'Spine02',Spine1:'Spine01',Spine2:'Spine',Neck:'neck',Head:'Head',
  LeftShoulder:'LeftShoulder',LeftArm:'LeftArm',LeftForeArm:'LeftForeArm',LeftHand:'LeftHand',
  RightShoulder:'RightShoulder',RightArm:'RightArm',RightForeArm:'RightForeArm',RightHand:'RightHand',
  LeftUpLeg:'LeftUpLeg',LeftLeg:'LeftLeg',LeftFoot:'LeftFoot',LeftToeBase:'LeftToeBase',
  RightUpLeg:'RightUpLeg',RightLeg:'RightLeg',RightFoot:'RightFoot',RightToeBase:'RightToeBase'};
const INV=Object.fromEntries(Object.entries(MAP).map(([a,b])=>[b,a]));
const short=n=>n.replace(/^mixamorig:?/,'');
export async function load(f){const b=fs.readFileSync(f),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const one=g=>{let m;g.scene.traverse(o=>{if(o.isSkinnedMesh&&!m)m=o;});return m;};

/* 옛 뼈대로 클립을 틀어 월드 회전(쉬는 자세 대비)과 골반 변위를 뽑는다 */
function sampleOld(g,clip,fps=60,keepTimes=false){
  const B={}; g.scene.traverse(o=>{if(o.isBone)B[short(o.name)]=o;});
  const mixer=new T.AnimationMixer(g.scene), a=mixer.clipAction(clip); a.play(); a.paused=true;
  const N=Math.max(1,Math.round(clip.duration*fps)), times=[], W={}, hips=[];
  for(const n in B) W[n]=[];
  /* keepTimes: 원래 키 시각 그대로 — 곡선화 정책(char-clip-policy)이 키 간격을 보고 고른 것이라 */
  const at=keepTimes?[...new Set(clip.tracks.flatMap(tr=>[...tr.times]))].sort((x,y)=>x-y):Array.from({length:N+1},(_,i)=>Math.min(clip.duration,clip.duration*i/N));
  for(const t of at){ a.time=Math.min(clip.duration-1e-5,t); mixer.update(0); g.scene.updateMatrixWorld(true);
    times.push(t); for(const n in B) W[n].push(B[n].getWorldQuaternion(new T.Quaternion())); hips.push(B.Hips.position.clone()); }
  mixer.stopAllAction(); mixer.uncacheRoot(g.scene);
  return {times,W,hips};
}

export async function buildRig(tgtPath,srcPath,opt={}){
  const tg=await load(tgtPath), sg=await load(srcPath), ref=await load(tgtPath);   /* ref = 옛 리그(샘플링용) */
  const TM=one(tg), SM=one(sg);
  tg.scene.updateMatrixWorld(true); SM.skeleton.pose(); sg.scene.updateMatrixWorld(true);
  const TB={}; tg.scene.traverse(o=>{if(o.isBone)TB[short(o.name)]=o;});
  const SB={}; sg.scene.traverse(o=>{if(o.isBone)SB[short(o.name)]=o;});
  const sw=n=>SB[n].getWorldPosition(new T.Vector3()), tw=n=>TB[n].getWorldPosition(new T.Vector3());
  /* 맞추기: 메시 상자(키로 배율, 가로·깊이는 가운데, 바닥은 바닥). 관절로 맞추면 안 된다 — 우리 관절이
     틀려 있는 게 문제라서(골반→머리 거리로 재면 배율이 어긋나 메시가 2~4 cm 떠 있었다). */
  const meshPts=(m,skin)=>{ const n=m.geometry.attributes.position.count,a=[],v=new T.Vector3(); for(let i=0;i<n;i++){ if(skin) m.getVertexPosition(i,v); else v.fromBufferAttribute(m.geometry.attributes.position,i); v.applyMatrix4(m.matrixWorld); a.push(v.clone()); } return a; };
  const bbOf=a=>{ const b=new T.Box3(); a.forEach(p=>b.expandByPoint(p)); return b; };
  const TA=meshPts(TM,false), SA=meshPts(SM,true), ta=bbOf(TA), tb=bbOf(SA), k=ta.getSize(new T.Vector3()).y/tb.getSize(new T.Vector3()).y, ca=ta.getCenter(new T.Vector3()), cb=tb.getCenter(new T.Vector3());
  const mk=f=>p=>new T.Vector3((p.x-cb.x)*k*f+ca.x,(p.y-tb.min.y)*k+ta.min.y,(p.z-cb.z)*k*f+ca.z);
  const err=f=>{ const m=mk(f), B=SA.filter((_,i)=>i%7===0).map(m); let s=0; for(let i=0;i<200;i++){ const p=TA[(i*997)%TA.length]; let d=1e9; for(const q of B){ const dd=p.distanceToSquared(q); if(dd<d) d=dd; } s+=Math.sqrt(d); } return s; };
  const toOurs=mk(err(1)<=err(-1)?1:-1);
  /* 쉬는 자세의 월드 회전 (새 뼈대도 옛 뼈대의 쉬는 방향을 그대로 쓴다 — 관절 «위치» 만 옮긴다) */
  const restQ={}; for(const n in TB) restQ[n]=TB[n].getWorldQuaternion(new T.Quaternion());
  /* 1. 관절 위치: 매핑된 뼈는 Meshy 위치로, 나머지(슬롯 등)는 부모에 대한 월드 오프셋 유지 */
  const oldWorld={}; for(const n in TB) oldWorld[n]=tw(n);
  const newWorld={};
  const order=[]; tg.scene.traverse(o=>{if(o.isBone)order.push(short(o.name));});
  for(const n of order){ const b=TB[n], pn=b.parent&&b.parent.isBone?short(b.parent.name):null;
    if(MAP[n]&&SB[MAP[n]]) newWorld[n]=toOurs(sw(MAP[n]));
    else if(pn) newWorld[n]=newWorld[pn].clone().add(oldWorld[n].clone().sub(oldWorld[pn]));
    else newWorld[n]=oldWorld[n].clone(); }
  for(const n of order){ const b=TB[n], p=b.parent; const pw=p.isBone?newWorld[short(p.name)]:null;
    /* 부모 로컬 = (내 월드 − 부모 월드)를 부모의 월드 회전·배율로 되돌린 것. 쉬는 회전은 그대로다 */
    const local=pw?newWorld[n].clone().sub(pw).applyQuaternion(restQ[short(p.name)].clone().invert()).divide(p.getWorldScale(new T.Vector3())):b.position.clone();
    if(pw){ b.position.copy(local); } }
  tg.scene.updateMatrixWorld(true);
  /* 역바인드 다시 계산 — 이 자세가 새 바인드 자세 */
  TM.skeleton.calculateInverses(); TM.bind(TM.skeleton,TM.bindMatrix);
  /* 2. 무게 — skin-transfer 와 같은 가장 가까운 점. Meshy 가 «우리 옷 입은 메시» 를 직접 리깅한 것을 쓴다(0.1 mm 일치) */
  const TP=(()=>{const n=TM.geometry.attributes.position.count,o=new Float32Array(n*3),v=new T.Vector3();for(let i=0;i<n;i++){v.fromBufferAttribute(TM.geometry.attributes.position,i).applyMatrix4(TM.matrixWorld);o.set([v.x,v.y,v.z],i*3);}return o;})();
  const SP=(()=>{const n=SM.geometry.attributes.position.count,o=new Float32Array(n*3),v=new T.Vector3();for(let i=0;i<n;i++){SM.getVertexPosition(i,v);v.applyMatrix4(SM.matrixWorld);const q=toOurs(v);o.set([q.x,q.y,q.z],i*3);}return o;})();
  const sidx=SM.geometry.index.array, cell=0.05, grid=new Map();
  for(let t=0;t<sidx.length;t+=3){ const a=sidx[t]*3,b=sidx[t+1]*3,c=sidx[t+2]*3; const mn=[0,1,2].map(j=>Math.min(SP[a+j],SP[b+j],SP[c+j])), mx=[0,1,2].map(j=>Math.max(SP[a+j],SP[b+j],SP[c+j]));
    for(let x=Math.floor(mn[0]/cell);x<=Math.floor(mx[0]/cell);x++)for(let y=Math.floor(mn[1]/cell);y<=Math.floor(mx[1]/cell);y++)for(let z=Math.floor(mn[2]/cell);z<=Math.floor(mx[2]/cell);z++){ const kk=`${x},${y},${z}`; if(!grid.has(kk)) grid.set(kk,[]); grid.get(kk).push(t); } }
  const tri=new T.Triangle(), cp=new T.Vector3(), bary=new T.Vector3(), P=new T.Vector3();
  const sJ=SM.geometry.attributes.skinIndex, sW=SM.geometry.attributes.skinWeight, sName=SM.skeleton.bones.map(b=>short(b.name));
  const tIndex=Object.fromEntries(TM.skeleton.bones.map((b,i)=>[short(b.name),i]));
  const n=TM.geometry.attributes.position.count, cur=new Array(n), fitD=[];   /* fitD: 우리 정점 ↔ Meshy 면 거리 (메시가 같은지) */
  for(let i=0;i<n;i++){ P.set(TP[i*3],TP[i*3+1],TP[i*3+2]); let best=Infinity,bt=-1,bb=null;
    for(let r=0;r<=6&&bt<0;r++){ const cx=Math.floor(P.x/cell),cy=Math.floor(P.y/cell),cz=Math.floor(P.z/cell);
      for(let x=cx-r;x<=cx+r;x++)for(let y=cy-r;y<=cy+r;y++)for(let z=cz-r;z<=cz+r;z++){ const L=grid.get(`${x},${y},${z}`); if(!L) continue;
        for(const t of L){ const a=sidx[t]*3,b=sidx[t+1]*3,c=sidx[t+2]*3; tri.a.set(SP[a],SP[a+1],SP[a+2]); tri.b.set(SP[b],SP[b+1],SP[b+2]); tri.c.set(SP[c],SP[c+1],SP[c+2]);
          tri.closestPointToPoint(P,cp); const d=cp.distanceToSquared(P); if(d<best){ best=d; bt=t; tri.getBarycoord(cp,bary); bb=bary.clone(); } } } }
    const acc={}; if(bt>=0) [0,1,2].forEach((c,ci)=>{ const v=sidx[bt+c], bw=[bb.x,bb.y,bb.z][ci]; for(let q=0;q<4;q++){ const w=sW.getComponent(v,q)*bw; if(w<=0) continue; const ti=tIndex[INV[sName[sJ.getComponent(v,q)]]]; if(ti==null) continue; acc[ti]=(acc[ti]||0)+w; } });
    cur[i]=acc; fitD.push(Math.sqrt(best)); }
  const nb=Array.from({length:n},()=>new Set()), tidx=TM.geometry.index.array;
  for(let t=0;t<tidx.length;t+=3){ const a=tidx[t],b=tidx[t+1],c=tidx[t+2]; nb[a].add(b);nb[a].add(c);nb[b].add(a);nb[b].add(c);nb[c].add(a);nb[c].add(b); }
  /* 같은 자리 정점(UV 이음새에서 둘로 나뉜 정점)은 한 몸이다. 이웃을 합치고 끝에 무게를 똑같이 맞춘다 —
     안 그러면 펴기가 서로 다른 이웃으로 달리 펴서, 움직일 때 이음새가 벌어진다(세라 머리칼·등의 검은 금, docs/design/77) */
  const pa0=TM.geometry.attributes.position, grp=new Map(), gOf=new Int32Array(n);
  for(let i=0;i<n;i++){ const k=Math.round(pa0.getX(i)*1e5)+','+Math.round(pa0.getY(i)*1e5)+','+Math.round(pa0.getZ(i)*1e5); if(!grp.has(k)) grp.set(k,[]); grp.get(k).push(i); }
  const groups=[...grp.values()].filter(g=>g.length>1);
  for(const g of groups){ const u=new Set(); for(const i of g) for(const j of nb[i]) u.add(j); for(const i of g) nb[i]=u; }
  const weld=()=>{ for(const g of groups){ const w={}; for(const i of g) for(const [bi,v] of Object.entries(cur[i])) w[bi]=(w[bi]||0)+v/g.length; for(const i of g) cur[i]={...w}; } };
  weld();
  for(let it=0;it<(opt.smooth??1);it++){ const nx=new Array(n); for(let i=0;i<n;i++){ const w={}; for(const [bi,v] of Object.entries(cur[i])) w[bi]=.5*v; const L=[...nb[i]]; if(!L.length){nx[i]=cur[i];continue;} for(const j of L) for(const [bi,v] of Object.entries(cur[j])) w[bi]=(w[bi]||0)+.5*v/L.length; nx[i]=w; } for(let i=0;i<n;i++) cur[i]=nx[i]; weld(); }
  /* 얼굴은 머리와 한 몸 (--head-rigid, docs/design/78). Meshy 무게는 입·턱에 목·어깨가 섞여 공격 중 턱이 4~6 cm
     휘었다(세라). 높이·위치만으로 «얼굴» 을 가르면 턱 높이까지 올라온 옷깃(세라 목폴라)이 머리를 따라가 턱선 밖으로
     삐져나왔다 → Meshy 가 이미 매긴 «머리 몫» 을 다이얼로 쓴다: 머리 몫 ≥ hb(0.5) 는 Head 1.0, ≤ ha(0.15) 는 그대로,
     사이는 부드럽게. 머리 가운데 R 안 · 턱(--chin) 3 cm 아래까지만. */
  if(opt.headRigid){ const hd=newWorld.Head, hi=tIndex.Head, chin=opt.chin!=null?opt.chin:hd.y, lo=chin-(opt.neckBlend||0.03), R=opt.headR||0.17, ha=opt.headLo??0.15, hb=opt.headHi??0.5;
    let cx=0,cy=0,cz=0,cn=0; for(let i=0;i<n;i++){ const y=TP[i*3+1]; if(y>hd.y+0.06&&Math.abs(TP[i*3]-hd.x)<0.12){ cx+=TP[i*3];cy+=y;cz+=TP[i*3+2];cn++; } }
    const C=new T.Vector3(cx/cn,cy/cn,cz/cn); let changed=0;
    for(let i=0;i<n;i++){ const y=TP[i*3+1]; if(y<lo||Math.hypot(TP[i*3]-C.x,y-C.y,TP[i*3+2]-C.z)>R) continue;
      let hw=0,tw=0; for(const [bi,v] of Object.entries(cur[i])){ tw+=v; if(+bi===hi) hw+=v; } if(!tw) continue;
      const t=Math.min(1,Math.max(0,(hw/tw-ha)/(hb-ha))), k=t*t*(3-2*t); if(k<=0) continue;
      const w={}; for(const [bi,v] of Object.entries(cur[i])) w[bi]=(1-k)*v/tw; w[hi]=(w[hi]||0)+k; cur[i]=w; changed++; }
    weld(); if(opt.log) opt.log(`머리 한 몸: ${changed} 정점 (머리 관절 y ${hd.y.toFixed(3)}, 턱 ${chin}, 가운데 ${C.toArray().map(v=>v.toFixed(3))})`); }
  const J=new Uint16Array(n*4), Wt=new Float32Array(n*4);
  for(let i=0;i<n;i++){ const top=Object.entries(cur[i]).sort((x,y)=>y[1]-x[1]).slice(0,4), s=top.reduce((z,[,w])=>z+w,0)||1; for(let q=0;q<4;q++){ J[i*4+q]=top[q]?+top[q][0]:tIndex.Hips; Wt[i*4+q]=top[q]?top[q][1]/s:(q===0&&!top.length?1:0); } }
  TM.geometry.setAttribute('skinIndex',new T.BufferAttribute(J,4)); TM.geometry.setAttribute('skinWeight',new T.BufferAttribute(Wt,4));
  /* 3. 클립 다시 굽기 */
  const newRestQ=restQ;   /* 쉬는 회전은 그대로 — 위치만 옮겼다 */
  const clips=[];
  for(const clip of ref.animations){ if(opt.clips&&!opt.clips.includes(clip.name)) continue;
    const s=sampleOld(ref,clip,60,opt.keepTimes), tracks=[];
    for(const nme of order){ const b=TB[nme], vals=[];
      for(let i=0;i<s.times.length;i++){ const D=s.W[nme][i].clone().multiply(restQ[nme].clone().invert()), Wn=D.multiply(newRestQ[nme]);
        const pw=b.parent.isBone?s.W[short(b.parent.name)][i].clone().multiply(restQ[short(b.parent.name)].clone().invert()).multiply(newRestQ[short(b.parent.name)]):b.parent.getWorldQuaternion(new T.Quaternion());
        const q=pw.invert().multiply(Wn).normalize(); const L=vals.length; if(L&&(vals[L-4]*q.x+vals[L-3]*q.y+vals[L-2]*q.z+vals[L-1]*q.w)<0) q.set(-q.x,-q.y,-q.z,-q.w); vals.push(q.x,q.y,q.z,q.w); }
      tracks.push(new T.QuaternionKeyframeTrack(b.name+'.quaternion',s.times,vals)); }
    const hp=[]; const h0=ref.scene.getObjectByName(TB.Hips.name).position; for(const p of s.hips){ const d=p.clone().sub(h0); const q=TB.Hips.position.clone().add(d); hp.push(q.x,q.y,q.z); }
    tracks.push(new T.VectorKeyframeTrack(TB.Hips.name+'.position',s.times,hp));
    clips.push(new T.AnimationClip(clip.name,clip.duration,tracks)); }
  tg.animations=clips;
  const anchor={}; tg.scene.updateMatrixWorld(true); for(const nme of order) anchor[nme]=TB[nme].worldToLocal(oldWorld[nme].clone()).toArray();
  const raw=fs.readFileSync(tgtPath), jl=raw.readUInt32LE(12), srcExtras={};
  for(const a of JSON.parse(raw.subarray(20,20+jl).toString('utf8')).animations||[]) if(a.extras) srcExtras[a.name]=a.extras;
  fitD.sort((x,y)=>x-y); const fit={median:fitD[fitD.length>>1],p95:fitD[Math.floor(fitD.length*.95)],max:fitD[fitD.length-1]};
  return {g:tg,mesh:TM,bones:TB,order,newWorld,oldWorld,J,W:Wt,k,srcExtras,anchor,fit};
}

/* glb 쓰기 — 원본 JSON 을 고쳐 쓰고, 안 쓰게 된 버퍼(옛 무게·역바인드·애니메이션)는 뺀다 */
export function writeRigGlb(srcPath,outPath,R){
  const buf=fs.readFileSync(srcPath); if(buf.readUInt32LE(0)!==0x46546C67) throw Error('GLB 아님');
  let off=12, json=null, bin=null;
  while(off<buf.length){ const len=buf.readUInt32LE(off), type=buf.readUInt32LE(off+4), body=buf.subarray(off+8,off+8+len);
    if(type===0x4E4F534A) json=JSON.parse(body.toString('utf8')); else if(type===0x004E4942) bin=body; off+=8+len; }
  if(json.meshes.length!==1||json.skins.length!==1) throw Error('메시·스킨 1개짜리만 지원');
  const nodeIndex={}; json.nodes.forEach((n,i)=>{ nodeIndex[short(n.name||'')]=i; });
  const prim=json.meshes[0].primitives; const skin=json.skins[0];
  /* 1. 뼈 노드 이동값 */
  for(const n of R.order){ const i=nodeIndex[n]; if(i==null) throw Error('노드 없음 '+n); json.nodes[i].translation=R.bones[n].position.toArray();
    /* 장비 자리: 옛 관절 위치를 새 뼈 로컬로 남긴다 → js/looks.js 가 거기에 붙인다 */
    const a=R.anchor[n]; if(a&&Math.hypot(...a)>1e-3) json.nodes[i].extras={...(json.nodes[i].extras||{}),rerigAnchor:a.map(v=>+v.toFixed(5))}; }
  /* 2. 남길 접근자 → 새 버퍼로 옮겨 담는다 */
  const drop=new Set([skin.inverseBindMatrices]); prim.forEach(p=>{ drop.add(p.attributes.JOINTS_0); drop.add(p.attributes.WEIGHTS_0); });
  json.animations.forEach(a=>a.samplers.forEach(sm=>{ drop.add(sm.input); drop.add(sm.output); }));
  const parts=[]; let len=0; const views=[], accs=[], accMap={};
  const put=(b,extra={})=>{ const pad=(4-len%4)%4; if(pad){ parts.push(Buffer.alloc(pad)); len+=pad; } parts.push(b); views.push({buffer:0,byteOffset:len,byteLength:b.length,...extra}); len+=b.length; return views.length-1; };
  const viewUse={}; json.accessors.forEach(a=>{ if(a.bufferView!=null) viewUse[a.bufferView]=(viewUse[a.bufferView]||0)+1; });
  const viewMap={};
  const copyView=vi=>{ if(viewMap[vi]!=null) return viewMap[vi]; const v=json.bufferViews[vi]; const ex={}; if(v.byteStride) ex.byteStride=v.byteStride; if(v.target) ex.target=v.target;
    return viewMap[vi]=put(Buffer.from(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)),ex); };
  json.accessors.forEach((a,i)=>{ if(drop.has(i)) return; const na={...a}; if(a.bufferView!=null) na.bufferView=copyView(a.bufferView); accMap[i]=accs.push(na)-1; });
  (json.images||[]).forEach(im=>{ if(im.bufferView!=null) im.bufferView=copyView(im.bufferView); });
  prim.forEach(p=>{ for(const k in p.attributes) if(accMap[p.attributes[k]]!=null) p.attributes[k]=accMap[p.attributes[k]];
    if(p.indices!=null) p.indices=accMap[p.indices]; if(p.targets) p.targets=p.targets.map(t=>Object.fromEntries(Object.entries(t).map(([k,v])=>[k,accMap[v]]))); });
  const add=(typed,componentType,type,count,mm)=>{ const b=Buffer.from(typed.buffer,typed.byteOffset,typed.byteLength); const a={bufferView:put(b),componentType,count,type}; if(mm){ a.min=[Math.min(...typed)]; a.max=[Math.max(...typed)]; } return accs.push(a)-1; };
  /* 3. 무게 · 역바인드 */
  const n=R.mesh.geometry.attributes.position.count;
  prim.forEach(p=>{ p.attributes.JOINTS_0=add(R.J,5123,'VEC4',n); p.attributes.WEIGHTS_0=add(R.W,5126,'VEC4',n); });
  const boneOf=Object.fromEntries(R.mesh.skeleton.bones.map((b,i)=>[short(b.name),i]));
  const ibm=new Float32Array(skin.joints.length*16);
  skin.joints.forEach((ni,k)=>{ const bi=boneOf[short(json.nodes[ni].name)]; ibm.set(R.mesh.skeleton.boneInverses[bi].elements,k*16); });
  skin.inverseBindMatrices=add(ibm,5126,'MAT4',skin.joints.length);
  /* 4. 애니메이션 — 뼈마다 회전 + 골반 위치 */
  json.animations=R.g.animations.map(clip=>{ const samplers=[], channels=[], tIn={};
    for(const tr of clip.tracks){ const [nm,path]=tr.name.split('.'); const node=nodeIndex[short(nm)]; if(node==null) continue;
      const key=tr.times.join(','); if(tIn[key]==null) tIn[key]=add(new Float32Array(tr.times),5126,'SCALAR',tr.times.length,true);
      const vec=path==='quaternion'?'VEC4':'VEC3';
      samplers.push({input:tIn[key],output:add(new Float32Array(tr.values),5126,vec,tr.values.length/(vec==='VEC4'?4:3)),interpolation:'LINEAR'});
      channels.push({sampler:samplers.length-1,target:{node,path:path==='quaternion'?'rotation':'translation'}}); }
    const old=R.srcExtras[clip.name]; const a={name:clip.name,channels,samplers}; if(old) a.extras=old; return a; });
  json.accessors=accs; json.bufferViews=views;
  json.asset.extras={...(json.asset.extras||{}),rerig:'tools/3d/rerig-meshy.mjs (docs/design/77)'};
  const newBin=Buffer.concat(parts); json.buffers=[{byteLength:newBin.length}];
  let js=Buffer.from(JSON.stringify(json),'utf8'); js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
  const bb=Buffer.concat([newBin,Buffer.alloc((4-newBin.length%4)%4)]);
  const head=Buffer.alloc(12); head.writeUInt32LE(0x46546C67,0); head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+bb.length,8);
  const cj=Buffer.alloc(8); cj.writeUInt32LE(js.length,0); cj.writeUInt32LE(0x4E4F534A,4);
  const cb=Buffer.alloc(8); cb.writeUInt32LE(bb.length,0); cb.writeUInt32LE(0x004E4942,4);
  fs.writeFileSync(outPath,Buffer.concat([head,cj,js,cb,bb]));
  return {bytes:12+16+js.length+bb.length, anims:json.animations.length};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const args=process.argv.slice(2), val=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
  const clipsOpt=val('--clips')?val('--clips').split(','):null;
  const R=await buildRig(args[0],args[1],{clips:clipsOpt,smooth:val('--smooth')!=null?+val('--smooth'):1,keepTimes:true,headRigid:args.includes('--head-rigid'),headLo:val('--head-lo')!=null?+val('--head-lo'):undefined,headHi:val('--head-hi')!=null?+val('--head-hi'):undefined,chin:val('--chin')!=null?+val('--chin'):null,neckBlend:val('--neck-blend')!=null?+val('--neck-blend'):null,log:m=>process.stderr.write(m+'\n')});
  const moved=R.order.filter(n=>MAP[n]).map(n=>`${n} ${(R.newWorld[n].distanceTo(R.oldWorld[n])*100).toFixed(1)}cm`);
  process.stderr.write(`메시 일치: 중앙 ${(R.fit.median*1000).toFixed(1)} mm · 95% ${(R.fit.p95*1000).toFixed(1)} mm · 최대 ${(R.fit.max*1000).toFixed(0)} mm\n관절 이동: ${moved.join(', ')}\n클립 ${R.g.animations.length}개 다시 구움\n`);
  if(!args.includes('--dry')){ const out=val('--out')||args[0]; const w=writeRigGlb(args[0],out,R);
    process.stderr.write(`썼다 ${out} ${(fs.statSync(args[0]).size/1e6).toFixed(2)} → ${(w.bytes/1e6).toFixed(2)} MB, 애니메이션 ${w.anims}\n`); }
}
