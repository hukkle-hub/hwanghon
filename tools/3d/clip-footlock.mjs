/* 클립 재작업 — 발 고정 굽기 (디렉터 지시 2026-09-27: «접점 전후 지지발 미끄러짐이 보이면 실패, 보정식 말고 클립 자체를»).
 * 클립을 60 fps 로 표본해, 매 프레임 «디딘 발»(더 낮고 느린 발)을 처음 닿은 자리에 잠그고, 그 발이 미끄러지는 만큼 골반 위치(XZ)를
 * 반대로 옮긴다(발 잠금 → 뿌리 이동 제거). 다른 뼈 회전은 그대로. 마지막 TAIL 초는 오프셋을 0 으로 풀어 대기로 이어진다.
 *   node tools/3d/clip-footlock.mjs <char.glb> <clip> [--contact 0.43] [--tail 0.18] > clip.json   → glb-put-clips.mjs 로 넣는다
 * 출력엔 «잠그기 전/후 접점 ±0.15 s 디딘 발 수평 이동» 을 stderr 로 찍는다. */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const args=process.argv.slice(2), F=args[0], NAME=args[1], opt=(k,d)=>{ const i=args.indexOf(k); return i>0?+args[i+1]:d; };
const CONTACT=opt('--contact',null), TAIL=opt('--tail',0.18), FPS=60, LOWY=opt('--lowy',0.06);
const b=fs.readFileSync(F), l=new GLTFLoader(); l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const c=g.animations.find(a=>a.name===NAME); if(!c) throw new Error('클립 없음: '+NAME);
const G={}, order=[]; g.scene.traverse(o=>{ if(o.isBone){ const n=o.name.replace(/^mixamorig:?/,''); G[n]=o; order.push(n); } });
const m=new T.AnimationMixer(g.scene), a=m.clipAction(c); a.play(); a.paused=true;
const N=Math.round(c.duration*FPS), fr=[];
for(let i=0;i<=N;i++){ a.time=Math.min(c.duration-1e-4,c.duration*i/N); m.update(0); g.scene.updateMatrixWorld(true);
  const q={}; for(const n of order) q[n]=G[n].quaternion.clone();
  fr.push({t:c.duration*i/N,q,hips:G.Hips.position.clone(),L:G.LeftFoot.getWorldPosition(new T.Vector3()),R:G.RightFoot.getWorldPosition(new T.Vector3()),hipsW:G.Hips.getWorldPosition(new T.Vector3())}); }
/* 골반 로컬 → 세계: Hips 의 부모(Armature) 변환. 골반 로컬 XZ 를 dx 만큼 옮기면 세계에서도 같은 축(회전 없음 가정)으로 움직인다 — 확인 */
const parent=G.Hips.parent; const pm=new T.Matrix4().copy(parent.matrixWorld); const scl=new T.Vector3().setFromMatrixScale(pm);
const minY=Math.min(...fr.map(f=>Math.min(f.L.y,f.R.y)));
/* 디딘 발 고르기: 바닥(minY+LOWY) 아래이고 더 느린 발. 둘 다 아니면 잠금 없음(공중) */
const speed=(i,k)=>{ const p=fr[Math.max(0,i-1)][k], n=fr[Math.min(N,i+1)][k]; return Math.hypot(n.x-p.x,n.z-p.z)/((fr[Math.min(N,i+1)].t-fr[Math.max(0,i-1)].t)||1e-3); };
let lock=null; const off=[], lockK=[]; /* 세계 XZ 오프셋(발을 제자리에 두려면 골반을 이만큼 옮긴다) · 프레임별 잠근 발 */
let cur=new T.Vector3(0,0,0);
/* 접점 창의 지지발 = 창 안에서 평균 높이가 낮은 발. 창 안에서는 이 발을 강제로 잠근다.
   창 밖에서는 «잠근 발이 들리면(LIFT 이상) 다른 발이 바닥이면 갈아탄다» — 히스테리시스로 흔들림을 막는다. */
const contact0=CONTACT!=null?CONTACT:c.duration*0.45, W0=contact0-0.35, W1=contact0+0.25;
const inWin=fr.map(f=>f.t>=W0&&f.t<=W1);
const avg=k=>fr.filter((f,i)=>inWin[i]).reduce((s,f)=>s+f[k].y,0);
const SUPPORT=avg('L')<=avg('R')?'L':'R'; const LIFT=LOWY+0.04;
for(let i=0;i<=N;i++){ const f=fr[i]; const onFloor=k=>f[k].y<=minY+LOWY;
  let k=lock?lock.k:null;
  if(inWin[i]){ if(onFloor(SUPPORT)||!k) k=SUPPORT; }
  else if(!k){ if(onFloor('L')&&onFloor('R')) k=speed(i,'L')<=speed(i,'R')?'L':'R'; else if(onFloor('L')) k='L'; else if(onFloor('R')) k='R'; }
  else if(f[k].y>minY+LIFT){ const o=k==='L'?'R':'L'; k=onFloor(o)?o:null; }
  if(k&&(!lock||lock.k!==k)) lock={k, at:f[k].clone().add(cur)};
  if(!k){ lock=null; off.push(cur.clone()); lockK.push(null); continue; }
  cur=new T.Vector3(lock.at.x-f[k].x,0,lock.at.z-f[k].z); off.push(cur.clone()); lockK.push(k); }
/* 꼬리: 마지막 TAIL 초 동안 0 으로 */
for(let i=0;i<=N;i++){ const t=fr[i].t, r=c.duration-t; if(r<TAIL){ const w=r/TAIL, e=w*w*(3-2*w); off[i].multiplyScalar(e); } }
/* 골반 로컬 이동 = 세계 이동 / 부모 스케일 (부모 회전 없음 가정: Armature 는 Y-up 단위 회전) */
const hipsOut=fr.map((f,i)=>new T.Vector3(f.hips.x+off[i].x/scl.x, f.hips.y, f.hips.z+off[i].z/scl.z));
/* 계측: 접점 ±0.15 s 디딘 발 수평 이동, 전/후 */
const contact=CONTACT!=null?CONTACT:c.duration*0.45; const win=(i)=>Math.abs(fr[i].t-contact)<=0.15;
const slip=(k,withOff)=>{ let s=0; for(let i=1;i<=N;i++){ if(!win(i)||!win(i-1)) continue; const a=fr[i-1][k].clone(), b=fr[i][k].clone(); if(withOff){ a.add(off[i-1]); b.add(off[i]); } s+=Math.hypot(b.x-a.x,b.z-a.z); } return s*100; };
const low=fr.filter((f,i)=>win(i)).reduce((s,f)=>s+f.L.y,0)<=fr.filter((f,i)=>win(i)).reduce((s,f)=>s+f.R.y,0)?'L':'R';
process.stderr.write(`${NAME}: 접점 ${contact.toFixed(2)} s 디딘 발 ${low} 미끄러짐 ±0.15 s — 전 L ${slip('L',false).toFixed(1)} R ${slip('R',false).toFixed(1)} cm → 후 L ${slip('L',true).toFixed(1)} R ${slip('R',true).toFixed(1)} cm · 골반 오프셋 최대 ${(Math.max(...off.map(o=>o.length()))*100).toFixed(0)} cm\n`);
/* 자유 발(디딘 발이 아닌 쪽)도 바닥에 닿아 있는 동안은 «끌리지» 않게 다리 IK 를 굽는다 — 골반 오프셋을 적용한 뒤의 세계 좌표 기준.
   발이 LOWY 위로 들리면 풀어 준다(들리는 높이에 따라 0→1 로 완화). 무릎은 원래 굽힘 평면을 지킨다(CCD 8 회). */
const IKW=opt('--ik',1);
function worldQ(o){ return o.getWorldQuaternion(new T.Quaternion()); }
function rotateWorld(bone, R){ const pq=bone.parent.getWorldQuaternion(new T.Quaternion()); const pInv=pq.clone().invert(); bone.quaternion.copy(pInv.multiply(R).multiply(pq).multiply(bone.quaternion)); }
function ccd(up, lo, ft, target, iters){ for(let it=0;it<iters;it++){ for(const j of [lo, up]){ g.scene.updateMatrixWorld(true); const J=j.getWorldPosition(new T.Vector3()), C=ft.getWorldPosition(new T.Vector3()); const a=C.clone().sub(J).normalize(), b=target.clone().sub(J).normalize(); const d=Math.max(-1,Math.min(1,a.dot(b))); const ang=Math.acos(d); if(ang<1e-4) continue; const ax=new T.Vector3().crossVectors(a,b); if(ax.lengthSq()<1e-10) continue; ax.normalize(); rotateWorld(j, new T.Quaternion().setFromAxisAngle(ax, ang*(j===lo?0.7:0.6))); } }
  g.scene.updateMatrixWorld(true); return ft.getWorldPosition(new T.Vector3()).distanceTo(target); }
if(IKW>0){ let anchor={L:null,R:null};
  for(let i=0;i<=N;i++){ const f=fr[i]; a.time=Math.min(c.duration-1e-4,f.t); m.update(0);
    /* 골반 오프셋 적용(로컬) */ G.Hips.position.copy(hipsOut[i]); g.scene.updateMatrixWorld(true);
    for(const k of ['L','R']){ if(lockK[i]===k){ anchor[k]=null; continue; }   /* 골반이 이미 붙든 발은 IK 를 걸지 않는다 */
      const side=k==='L'?'Left':'Right', up=G[side+'UpLeg'], lo=G[side+'Leg'], ft=G[side+'Foot']; const p=ft.getWorldPosition(new T.Vector3());
      const h=p.y-minY; const w=h<=LOWY?1:h>=LOWY+0.06?0:1-(h-LOWY)/0.06;   /* 바닥이면 1, 6 cm 위부터 풀린다 */
      if(w<=0){ anchor[k]=null; continue; }
      if(!anchor[k]) anchor[k]=p.clone();
      const tgt=anchor[k].clone().lerp(p,1-w); tgt.y=p.y;             /* 높이는 클립대로, 수평만 붙든다 */
      const q0u=up.quaternion.clone(), q0l=lo.quaternion.clone(), fq=worldQ(ft);
      ccd(up,lo,ft,tgt,8);
      /* 발 자체의 세계 방향은 원래대로(발이 뒤집히지 않게) */ const lq=lo.getWorldQuaternion(new T.Quaternion()).invert(); ft.quaternion.copy(lq.multiply(fq));
      /* IK 가중 */ up.quaternion.copy(q0u.slerp(up.quaternion,IKW)); lo.quaternion.copy(q0l.slerp(lo.quaternion,IKW)); }
    g.scene.updateMatrixWorld(true);
    for(const n of order) f.q[n]=G[n].quaternion.clone(); f.L=G.LeftFoot.getWorldPosition(new T.Vector3()); f.R=G.RightFoot.getWorldPosition(new T.Vector3()); }
  const slip2=(k)=>{ let s=0; for(let i=1;i<=N;i++){ if(!win(i)||!win(i-1)) continue; s+=Math.hypot(fr[i][k].x-fr[i-1][k].x, fr[i][k].z-fr[i-1][k].z); } return s*100; };
  process.stderr.write(`   IK 굽기 뒤 접점 ±0.15 s: L ${slip2('L').toFixed(1)} R ${slip2('R').toFixed(1)} cm\n`); }
const times=fr.map(f=>+f.t.toFixed(5)); const tracks={};
for(const n of order){ const arr=[]; let prev=null; for(const f of fr){ const q=f.q[n].clone().normalize(); if(prev&&prev.dot(q)<0) q.set(-q.x,-q.y,-q.z,-q.w); prev=q; arr.push(q.x,q.y,q.z,q.w); } tracks[n]=arr; }   /* 반올림 없이 — 6 자리 반올림은 그립 IK 뒤 |q| 오차를 1e-5 넘게 키웠다 */
console.log(JSON.stringify({name:NAME, source:F.split('/').pop(), sourceClip:NAME+' (footlock)', duration:+c.duration.toFixed(5), fps:FPS, times, tracks, hips:hipsOut.flatMap(p=>[+p.x.toFixed(5),+p.y.toFixed(5),+p.z.toFixed(5)])}));
