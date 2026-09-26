/* 팔 IK 뒤집힘 고치기 (docs/design/97) — 굽는 단계에서 팔꿈치가 키마다 뒤집힌 클립을 다시 푼다.
 *
 * rig_char.py 는 무기 경로(손 위치·자루 방향)를 주고 팔을 IK 로 풀어 24 fps 로 굽는다. 그런데 팔꿈치 쪽을
 * 매 키 따로 골라서 카인 3타는 시작(0.04~0.13초)에 오른 아래팔이 한 키(42 ms)에 98~175° 뒤집혔다. 키 자세의 손은 맞지만
 * 게임이 키 사이를 뼈마다 섞으면(slerp) 손·대검이 그 사이에서 휘돈다 — 대검이 한 프레임 아래로 꺾였다가 돌아왔다.
 *
 * «손»은 원본 그대로 두고 «팔»만 다시 푼다:
 *   1. 원본 키마다 손(위치·회전)·팔꿈치·어깨를 가슴(Spine2) 공간으로 잰다 — 무기 경로가 곧 설계 의도다.
 *   2. 60 fps 로 다시 뽑는다: 몸통·다리는 원본 보간, 손 목표는 가슴 공간에서 Catmull-Rom(위치)·slerp(회전).
 *   3. 두 뼈 IK — 팔꿈치 쪽(--elbow follow, 기본)은 앞 프레임을 이어받되 원본 키의 팔꿈치 쪽으로 --pull(0.5)만큼 당긴다.
 *      원본이 한결같은 곳에선 원본 자세에 붙고, 뒤집히는 곳에선 이어받기가 버틴다.
 *   4. 위팔·아래팔 비틀림(--twist orig, 기본)은 원본 그대로 두고 방향만 최소 회전으로 맞춘다.
 *   --window a,b,f : a~b 초만 다시 풀고 f 초 동안 원본으로 되섞는다(3타는 0,0.28,0.06 — 판정 0.44초 이후는 원본 그대로).
 *
 * 해 보고 버린 것(렌더로 확인): 경첩 축 맞춤(--twist hinge)·자연 방향 당김(--elbow smooth) — 매끄럽지만 위팔 비틀림이
 * 원본과 달라 어깨 망토 이음새가 흰 줄로 벌어졌다. 원본 키 팔꿈치 그대로 잇기(--elbow orig) — 키 사이 팔꿈치가 크게 돌아
 * 대기에서 넘어오는 섞임(0.085초)과 겹쳐 오른손이 여전히 튀었다(가속 54).
 *
 * 사용: node tools/3d/clip-arm-repair.mjs <캐릭터.glb> <클립> [--window a,b,f] [--fps 60] [--sides Right,Left] > out.json
 *       node tools/3d/glb-put-clips.mjs <캐릭터.glb> out.json
 */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const args=process.argv.slice(2), file=args[0], name=args[1];
const opt=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const FPS=+opt('--fps',60), SIDES=opt('--sides','Right,Left').split(',');
const PULL=+opt('--pull',.5);
const TWIST=opt('--twist','orig');
const ELBOW=opt('--elbow','follow');  /* smooth: 앞 프레임 이어받기 · orig: 원본 키의 팔꿈치 쪽을 키 사이에서 어깨-손목 축 둘레로 돌려 잇는다(키에서는 원본과 같다) */   /* hinge: 경첩 축 맞춤 · orig: 원본 위팔 비틀림 유지(방향만 최소 회전) · transport: 앞 프레임에서 최소 회전 */
const prevUp={};
/* --window a,b,f : a~b 초만 다시 풀고, 가장자리 f 초 동안 원본으로 되섞는다(밖은 원본 그대로). 기본은 클립 전체 */
const WIN=opt('--window',null)?opt('--window').split(',').map(Number):null;
const ARM=['Arm','ForeArm','Hand'];   /* 자연 방향으로 당기는 몫(프레임마다). 「근거 없음」 — 렌더로 확인 */
const b=fs.readFileSync(file),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const m=g.scene, B={}; m.traverse(o=>{if(o.isBone)B[o.name.replace(/^mixamorig:?/,'')]=o;});
const clip=g.animations.find(a=>a.name===name); if(!clip) throw Error('클립 없음: '+name);
const mixer=new T.AnimationMixer(m), act=mixer.clipAction(clip); act.play();
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), Q=()=>new T.Quaternion();
const wq=o=>o.getWorldQuaternion(Q()), wp=o=>o.getWorldPosition(V());
const pose=t=>{act.time=t;mixer.update(0);m.updateMatrixWorld(true);};
const chest=B.Spine2||B.Spine1||B.Spine;
m.updateMatrixWorld(true); const chestBindInv=wq(chest).invert();   /* 바인드(클립 적용 전) 가슴 회전 */
/* 원본 키 시각(모든 트랙의 합집합) */
const keyT=[...new Set(clip.tracks.flatMap(tr=>[...tr.times].map(x=>+x.toFixed(5))))].sort((a,b)=>a-b);
/* 1. 키마다 손을 가슴 공간으로 */
const keys={};
for(const s of SIDES){ keys[s]=keyT.map(t=>{ pose(t); const ci=chest.matrixWorld.clone().invert(), h=B[s+'Hand'];
  return {p:wp(h).applyMatrix4(ci), q:wq(chest).invert().multiply(wq(h)), e:wp(B[s+'ForeArm']).applyMatrix4(ci), sh:wp(B[s+'Arm']).applyMatrix4(ci)}; });
  for(let k=1;k<keys[s].length;k++) if(keys[s][k].q.dot(keys[s][k-1].q)<0){const q=keys[s][k].q;q.set(-q.x,-q.y,-q.z,-q.w);} }
/* 팔꿈치 경첩 축(위팔 로컬): «자연 클립»(대기·달리기·Meshy 전문가 클립 등, --hinge-ref)에서 30° 넘게 굽은 키의 굽힘 축을 모아
   주축(부호 없는 거듭제곱법)을 잡고, 쉬는 자세에서 그 축으로 굽혔을 때 손이 앞으로 가는 쪽을 + 로 한다.
   (굽는 단계의 IK 클립 — 1·2·3타·스매시·처형·궁극기 — 는 위팔을 180° 돌려 반대 축으로 굽혀 있었다, docs/design/97) */
const dirU=s=>B[s+'ForeArm'].position.clone().normalize(), dirF=s=>B[s+'Hand'].position.clone().normalize();
const REF=opt('--hinge-ref','idle,idle2,run,walk,hit,hit2,skill1,skill2,skill3,skill4,counter,guardUp,death,cheer,brake').split(',');
const hinge={};
{ const mx=new T.AnimationMixer(m);
  m.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();}); m.updateMatrixWorld(true);
  const fwd=wp(B.LeftToeBase).sub(wp(B.LeftFoot)).setY(0).normalize();
  for(const s of SIDES){ const M=[[0,0,0],[0,0,0],[0,0,0]]; let n=0;
    for(const c of g.animations){ if(!REF.includes(c.name)) continue; const ac=mx.clipAction(c); mx.stopAllAction(); ac.play();
      for(const t of c.tracks[0].times){ ac.time=t; mx.update(0); const ax=V().crossVectors(dirU(s),dirF(s).applyQuaternion(B[s+'ForeArm'].quaternion)); if(ax.length()<.5) continue; ax.normalize();
        const a=ax.toArray(); for(let i=0;i<3;i++)for(let j=0;j<3;j++)M[i][j]+=a[i]*a[j]; n++; } }
    mx.stopAllAction(); let v=V(1,1,1); for(let k=0;k<60;k++){const a=v.toArray(); v=V(...[0,1,2].map(i=>M[i][0]*a[0]+M[i][1]*a[1]+M[i][2]*a[2])).normalize();}
    m.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();}); m.updateMatrixWorld(true);
    const fo=B[s+'ForeArm'],uq=wq(B[s+'Arm']),f0=dirF(s).applyQuaternion(fo.quaternion);
    if(f0.clone().applyAxisAngle(v,.5).applyQuaternion(uq).sub(f0.clone().applyQuaternion(uq)).dot(fwd)<0) v.negate();
    hinge[s]=v; process.stderr.write(`${s} 경첩 축(위팔 로컬) ${v.toArray().map(x=>x.toFixed(3))} · 자연 클립 ${n} 키\n`); }
  mx.uncacheRoot(m); }
act.play();
/* 뒤집힘 판정: 원본 키에서 경첩 축과 실제 굽힘 축이 반대인 키 수 */
for(const s of SIDES){ let flip=0,n=0; for(const t of keyT){ pose(t); const fo=B[s+'ForeArm'];
    const ax=V().crossVectors(dirU(s),dirF(s).applyQuaternion(fo.quaternion)); if(ax.length()<.3) continue; n++; if(ax.normalize().dot(hinge[s])<0) flip++; }
  process.stderr.write(`${s} 원본 굽힘이 경첩 반대인 키 ${flip}/${n}\n`); }
/* 2~4. 60 fps 로 다시 */
const N=Math.max(2,Math.round(clip.duration*FPS)), times=[], out={}, hips=[];
const names=clip.tracks.filter(tr=>tr.name.endsWith('.quaternion')).map(tr=>tr.name.slice(0,-11).replace(/^mixamorig:?/,''));
for(const n of names) out[n]=[];
const THREE_smooth=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
const cr=(p0,p1,p2,p3,u)=>{ const u2=u*u,u3=u2*u; return V().addScaledVector(p0,-.5*u3+u2-.5*u).addScaledVector(p1,1.5*u3-2.5*u2+1).addScaledVector(p2,-1.5*u3+2*u2+.5*u).addScaledVector(p3,.5*u3-.5*u2); };
function handTarget(s,t){ const K=keys[s]; let k=0; while(k<keyT.length-2&&keyT[k+1]<=t) k++;
  const u=Math.min(1,Math.max(0,(t-keyT[k])/(keyT[k+1]-keyT[k]))), P=i=>K[Math.max(0,Math.min(K.length-1,i))].p;
  const p=cr(P(k-1),P(k),P(k+1),P(k+2),u), q=K[k].q.clone().slerp(K[k+1].q,u);
  return {p:p.applyMatrix4(chest.matrixWorld), q:wq(chest).multiply(q)}; }
const prevBend={}, prevTw={}, stats={};
function keyBend(s,t,dh){ const K=keys[s]; let k=0; while(k<keyT.length-2&&keyT[k+1]<=t) k++;
  const u=Math.min(1,Math.max(0,(t-keyT[k])/(keyT[k+1]-keyT[k])));
  const bOf=i=>{ const e=K[i].e.clone().applyMatrix4(chest.matrixWorld), sh=K[i].sh.clone().applyMatrix4(chest.matrixWorld), w=K[i].p.clone().applyMatrix4(chest.matrixWorld);
    const d=w.sub(sh).normalize(), b=e.sub(sh); b.addScaledVector(d,-b.dot(d)); b.addScaledVector(dh,-b.dot(dh)); return b.normalize(); };
  const b0=bOf(k), b1=bOf(k+1); const ang=Math.atan2(V().crossVectors(b0,b1).dot(dh),b0.dot(b1));
  return b0.applyAxisAngle(dh,ang*u); }
const setWorld=(bone,Wq)=>{ bone.quaternion.copy(wq(bone.parent).invert().multiply(Wq)); bone.updateMatrixWorld(true); };
for(let i=0;i<=N;i++){ const t=clip.duration*i/N; times.push(+t.toFixed(5)); pose(t);
  const orig={}; for(const s of SIDES) for(const a of ARM) orig[s+a]=B[s+a].quaternion.clone();
  let w=1; if(WIN){ const [a,b,f]=WIN; w=t<a-f||t>b+f?0:t<a?(a<=1e-6?1:THREE_smooth((t-(a-f))/f)):t>b?THREE_smooth(1-(t-b)/f):1; }
  for(const s of SIDES){ const up=B[s+'Arm'], fo=B[s+'ForeArm'], ha=B[s+'Hand'];
    const S=wp(up), L1=wp(fo).distanceTo(S), L2=wp(ha).distanceTo(wp(fo)), tg=handTarget(s,t);
    const toT=tg.p.clone().sub(S); let d=toT.length(); d=Math.min(Math.max(d,Math.abs(L1-L2)+1e-3),(L1+L2)*.999); toT.setLength(d); const dh=toT.clone().normalize();
    /* 자연 굽힘: 가슴 기준 아래·바깥·뒤 (쉬는 자세 A 자세의 팔꿈치 쪽) */
    const cq=wq(chest), side=s==='Right'?1:-1;
    const nat=V(.45*side,-1,-.35).applyQuaternion(cq.clone().multiply(chestBindInv)).normalize();
    /* follow: 앞 프레임을 이어받되 원본 키 팔꿈치 쪽으로 PULL 만큼 당긴다 — 원본이 한결같은 곳에선 원본 자세로 붙고(망토 이음새 그대로), 뒤집히는 곳에선 이어받기가 버틴다 */
    const pullTo=ELBOW==='follow'?keyBend(s,t,dh):nat;
    let bend=ELBOW==='orig'?keyBend(s,t,dh):prevBend[s]?prevBend[s].clone().multiplyScalar(1-PULL).addScaledVector(pullTo,PULL):(ELBOW==='follow'?keyBend(s,t,dh):wp(fo).sub(S));
    bend.addScaledVector(dh,-bend.dot(dh)); if(bend.lengthSq()<1e-8) bend=nat.clone().addScaledVector(dh,-nat.dot(dh)); bend.normalize(); prevBend[s]=bend.clone();
    const cosA=(L1*L1+d*d-L2*L2)/(2*L1*d), E=S.clone().addScaledVector(dh,L1*cosA).addScaledVector(bend,L1*Math.sqrt(Math.max(0,1-cosA*cosA)));
    /* 위팔: 방향을 팔꿈치로, 비틀림은 경첩 축이 굽는 면 법선(dh×bend 쪽)이 되게 */
    const upDir=E.clone().sub(S).normalize(), normal=V().crossVectors(upDir,tg.p.clone().sub(E).normalize());
    if(normal.lengthSq()<1e-6) normal.crossVectors(dh,bend); normal.normalize();
    const q1=Q().setFromUnitVectors(dirU(s),upDir);                     /* 로컬 방향 → 월드 방향 (비틀림 임의) */
    const h1=hinge[s].clone().applyQuaternion(q1);                        /* 그때의 경첩 축 */
    const hp=h1.clone().addScaledVector(upDir,-h1.dot(upDir)).normalize(), np=normal.clone().addScaledVector(upDir,-normal.dot(upDir)).normalize();
    const tw=Math.atan2(V().crossVectors(hp,np).dot(upDir),hp.dot(np));
    if(TWIST==='hinge') setWorld(up,Q().setFromAxisAngle(upDir,tw).multiply(q1));
    else { const base=TWIST==='transport'&&prevUp[s]?prevUp[s].clone():wq(up);      /* orig: 지금 원본 위팔 회전 */
      const cur=dirU(s).applyQuaternion(base); setWorld(up,Q().setFromUnitVectors(cur,upDir).multiply(base)); }
    prevUp[s]=wq(up);
    /* 아래팔: 위팔에서 최소 회전으로 손목을 향해 */
    const fq=wq(fo), cur=dirF(s).applyQuaternion(fq), want=tg.p.clone().sub(wp(fo)).normalize();
    let Fq=Q().setFromUnitVectors(cur,want).multiply(fq);
    /* 손목 비틀림의 절반을 아래팔로 (연속되게 이어 감) */
    const rel=Fq.clone().invert().multiply(tg.q), ax=dirF(s);
    const pr=V(rel.x,rel.y,rel.z).projectOnVector(ax); let twq=new T.Quaternion(pr.x,pr.y,pr.z,rel.w).normalize();
    let tau=2*Math.atan2(V(twq.x,twq.y,twq.z).dot(ax),twq.w); while(tau>Math.PI)tau-=2*Math.PI; while(tau<-Math.PI)tau+=2*Math.PI;
    if(prevTw[s]!=null){ while(tau-prevTw[s]>Math.PI)tau-=2*Math.PI; while(tau-prevTw[s]<-Math.PI)tau+=2*Math.PI; } prevTw[s]=tau;
    if(ELBOW!=='orig') Fq.multiply(Q().setFromAxisAngle(ax,tau*.5)); setWorld(fo,Fq);   /* orig: 아래팔 비틀림도 원본 그대로 */
    setWorld(ha,tg.q);
    const err=wp(ha).distanceTo(tg.p); stats[s]=Math.max(stats[s]||0,err);
  }
  if(w<1) for(const s of SIDES) for(const a of ARM){ const bn=B[s+a], o=orig[s+a]; if(o.dot(bn.quaternion)<0) o.set(-o.x,-o.y,-o.z,-o.w); bn.quaternion.copy(o.slerp(bn.quaternion.clone(),w)); }
  for(const n of names){ const q=B[n].quaternion, arr=out[n], k=arr.length;
    if(k>=4&&(arr[k-4]*q.x+arr[k-3]*q.y+arr[k-2]*q.z+arr[k-1]*q.w)<0) arr.push(-q.x,-q.y,-q.z,-q.w); else arr.push(q.x,q.y,q.z,q.w); }
  hips.push(B.Hips.position.x,B.Hips.position.y,B.Hips.position.z);
}
for(const s of SIDES) process.stderr.write(`${s} 손 목표 최대 오차 ${(stats[s]*100).toFixed(2)} cm\n`);
const r5=v=>+v.toFixed(6);
console.log(JSON.stringify({name,source:file.split('/').pop(),sourceClip:name+' (팔 다시 풂)',from:0,to:clip.duration,duration:+clip.duration.toFixed(5),fps:FPS,times,
  tracks:Object.fromEntries(Object.entries(out).map(([n,a])=>[n,a.map(r5)])),hips:hips.map(r5)}));
