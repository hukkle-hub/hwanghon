/* 영상에서 뜬 33 관절(tools/3d/video-pose.py) → 우리 캐릭터 뼈 회전 클립 JSON (glb-put-clips.mjs 로 넣는다) — docs/design/86.
 *
 *   1. 빠진 프레임은 앞뒤를 이어 메우고, 관절 위치를 가우시안(σ 프레임)으로 편다 — AI 영상은 팔다리가 프레임마다 흔들린다
 *   2. 좌표: MediaPipe world(x 오른쪽, y 아래, z 멀어짐) → (x, −y, −z). 첫 몇 프레임 골반 정면을 +Z 로 돌린다(카메라 각 무관)
 *   3. 골반·가슴은 «틀»(좌우 선 + 위 방향)로 회전을 통째로, 척추 셋은 그 사이를 나눠 갖는다. 머리는 두 귀·코
 *   4. 팔·다리·발은 «방향»만(부모가 돌린 쉬는 방향 → 영상 방향 최소 회전). 비틀림은 영상으로 알 수 없어 부모를 따른다
 *   5. 골반 높이: 낮은 발이 바닥에 닿게(다리 길이 비로 환산). 앞뒤·좌우 이동은 없앤다(게임이 제자리로 튼다)
 *
 *   node tools/3d/pose-to-clip.mjs <pose.json> <클립이름> --target art/3d/sera_anim.glb [--sigma 1.5] [--from 초 --to 초] [--speed 1] > clip.json
 */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const args=process.argv.slice(2), [SRC,NAME]=args, opt=(k,d)=>args.includes('--'+k)?args[args.indexOf('--'+k)+1]:d;
const TARGET=opt('target','art/3d/ain_anim.glb'), SIG=+opt('sigma',1.5), SPEED=+opt('speed',1);
const load=async f=>{const b=fs.readFileSync(f),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const log=s=>process.stderr.write(s+'\n');
const J=JSON.parse(fs.readFileSync(SRC,'utf8')), FPS=J.fps||30;
let F=J.frames; const t0=+opt('from',0), t1=+opt('to',1e9); F=F.filter(f=>f.t>=t0-1e-6&&f.t<=t1+1e-6);
const N=F.length, ID=Object.fromEntries(J.names.map((n,i)=>[n,i]));
/* 1. 메우기 + 펴기 */
const P=F.map(f=>f.ok?f.world.map(w=>new T.Vector3(w[0],-w[1],-w[2])):null);
/* 좌우 뒤바뀜 고치기: 몸을 숙이거나 등을 보이면 MediaPipe 가 왼쪽·오른쪽을 통째로 바꿔 붙인다(세라 투척 24번째 프레임 — 든 팔이 반대로).
   바로 앞 프레임과 거리를 재서, 좌우를 바꾼 쪽이 더 가까우면 바꾼다 */
const SWAP=J.names.map((n,i)=>{ const m=n.replace(/^l_/,'r_#').replace(/^r_(?!#)/,'l_').replace('r_#','r_'); return J.names.indexOf(n.startsWith('l_')?'r_'+n.slice(2):n.startsWith('r_')?'l_'+n.slice(2):n); });
const LIMBK=['l_elbow','r_elbow','l_wrist','r_wrist','l_knee','r_knee','l_ankle','r_ankle','l_foot','r_foot'].map(n=>J.names.indexOf(n));
let prevOk=null, nSwap=0;
for(let i=0;i<N;i++){ if(!P[i]) continue; if(prevOk){ const cost=q=>LIMBK.reduce((s,k)=>s+q[k].distanceTo(prevOk[k]),0), sw=P[i].map((_,k)=>P[i][SWAP[k]]);
    if(cost(sw)<cost(P[i])*0.8){ P[i]=sw.map(v=>v.clone()); nSwap++; } } prevOk=P[i]; }
const okIdx=P.map((p,i)=>p?i:-1).filter(i=>i>=0); if(!okIdx.length) throw new Error('사람이 한 번도 안 잡혔다');
if(nSwap) process.stderr.write(`좌우 뒤바뀜 ${nSwap} 프레임 고침\n`);
for(let i=0;i<N;i++) if(!P[i]){ const a=[...okIdx].reverse().find(k=>k<i), b=okIdx.find(k=>k>i);
  if(a==null) P[i]=P[b].map(v=>v.clone()); else if(b==null) P[i]=P[a].map(v=>v.clone()); else { const u=(i-a)/(b-a); P[i]=P[a].map((v,k)=>v.clone().lerp(P[b][k],u)); } }
log(`${N} 프레임, 빈 프레임 ${N-okIdx.length} 메움`);
/* (시험: 화면 위치 + 뼈 길이로 깊이를 다시 세우는 --lift 는 오차가 오히려 늘어 뺐다 — 정면 29.8° → 31.1°, docs/design/86) */
const R=Math.ceil(3*SIG), S=P.map((_,i)=>P[0].map((_,k)=>{ const acc=new T.Vector3(); let w=0; for(let j=Math.max(0,i-R);j<=Math.min(N-1,i+R);j++){ const g=Math.exp(-((j-i)**2)/(2*SIG*SIG)); acc.addScaledVector(P[j][k],g); w+=g; } return acc.multiplyScalar(1/w); }));
const L=(i,n)=>S[i][ID[n]], mid=(a,b)=>a.clone().add(b).multiplyScalar(0.5);
/* 2. 정면 맞추기 */
const fwdOf=i=>{ const x=L(i,'l_hip').clone().sub(L(i,'r_hip')), up=mid(L(i,'l_shoulder'),L(i,'r_shoulder')).sub(mid(L(i,'l_hip'),L(i,'r_hip'))); return new T.Vector3().crossVectors(x,up).setY(0).normalize(); };
let f0=new T.Vector3(); for(let i=0;i<Math.min(5,N);i++) f0.add(fwdOf(i)); f0.normalize();
const yaw0=Math.atan2(f0.x,f0.z), Ry0=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-yaw0);
S.forEach(fr=>fr.forEach(v=>v.applyQuaternion(Ry0)));
log(`정면 보정 ${(-yaw0*180/Math.PI).toFixed(0)}°`);
/* 우리 뼈대 */
const tgt=await load(TARGET), G={}; tgt.scene.traverse(o=>{ if(o.isBone) G[o.name.replace(/^mixamorig:?/,'')]=o; }); tgt.scene.updateMatrixWorld(true);
const wq=o=>o.getWorldQuaternion(new T.Quaternion()), wp=n=>G[n].getWorldPosition(new T.Vector3());
const restW={}; Object.keys(G).forEach(n=>restW[n]=wq(G[n]));
const basis=(x,up)=>{ const X=x.clone().normalize(), Z=new T.Vector3().crossVectors(X,up).normalize(), Y=new T.Vector3().crossVectors(Z,X); return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X,Y,Z)); };
/* 쉬는 자세 틀 */
const restHipB=basis(wp('LeftUpLeg').sub(wp('RightUpLeg')), wp('Spine2').sub(wp('Hips')));
const restChestB=basis(wp('LeftArm').sub(wp('RightArm')), wp('Neck').sub(wp('Spine1')));
const restHeadB=basis(wp('LeftArm').sub(wp('RightArm')), wp('Head').sub(wp('Neck')));   /* 머리 옆 방향은 어깨와 나란하다고 본다 */
const LIMB=[ /* [뼈, 자식 뼈(쉬는 방향), 영상 시작점, 영상 끝점, 부모 회전 출처] */
 ['LeftArm','LeftForeArm','l_shoulder','l_elbow'],['LeftForeArm','LeftHand','l_elbow','l_wrist'],['LeftHand',null,'l_wrist',['l_index','l_pinky']],
 ['RightArm','RightForeArm','r_shoulder','r_elbow'],['RightForeArm','RightHand','r_elbow','r_wrist'],['RightHand',null,'r_wrist',['r_index','r_pinky']],
 ['LeftUpLeg','LeftLeg','l_hip','l_knee'],['LeftLeg','LeftFoot','l_knee','l_ankle'],['LeftFoot','LeftToeBase','l_heel','l_foot'],
 ['RightUpLeg','RightLeg','r_hip','r_knee'],['RightLeg','RightFoot','r_knee','r_ankle'],['RightFoot','RightToeBase','r_heel','r_foot']];
const restDir={}; for(const [b,c] of LIMB){ if(c) restDir[b]=wp(c).sub(wp(b)).normalize(); }
restDir.LeftHand=restDir.LeftForeArm.clone(); restDir.RightHand=restDir.RightForeArm.clone();
/* 발: 쉬는 발 방향은 발목→발끝(발가락 뼈) — 영상은 뒤꿈치→발끝이라 쉬는 자세의 «아래로 기운 각» 만큼 차이가 난다. 첫 프레임에서 그 차이를 잰다 */
const order=[]; tgt.scene.traverse(o=>{ if(o.isBone){ const n=o.name.replace(/^mixamorig:?/,''); if(restW[n]) order.push(n); } });
const legLenT=wp('LeftUpLeg').distanceTo(wp('LeftLeg'))+wp('LeftLeg').distanceTo(wp('LeftFoot'));
const hipRestY=G.Hips.position.y, hipWorldY=wp('Hips').y, footRestY=Math.min(wp('LeftFoot').y,wp('RightFoot').y);
const hipsParentQ=wq(G.Hips.parent), hipsParentS=G.Hips.parent.getWorldScale(new T.Vector3());
const tracks=Object.fromEntries(order.map(n=>[n,[]])), hips=[];
/* 머리 보정: 귀 선·귀-어깨 방향은 우리 목→머리 축과 어긋나(귀가 목 뒤에 있다) 그대로 쓰면 머리가 늘 숙여졌다.
   첫 프레임은 머리가 가슴과 같은 방향이라고 보고 그 차이를 빼 둔다 */
let headCal=new T.Quaternion();
{ const hB=basis(L(0,'l_ear').clone().sub(L(0,'r_ear')), mid(L(0,'l_ear'),L(0,'r_ear')).sub(mid(L(0,'l_shoulder'),L(0,'r_shoulder'))));
  const cB=basis(L(0,'l_shoulder').clone().sub(L(0,'r_shoulder')), mid(L(0,'l_shoulder'),L(0,'r_shoulder')).sub(mid(L(0,'l_hip'),L(0,'r_hip'))));
  /* Dd0 = hB·restHead⁻¹ 를 Dc0 = cB·restChest⁻¹ 로: headCal·hB = Dc0·restHead */
  headCal=cB.clone().multiply(restChestB.clone().invert()).multiply(restHeadB).multiply(hB.clone().invert()); }
const slerpQ=(a,b,u)=>a.clone().slerp(b,u);
for(let i=0;i<N;i++){
  const W={};
  const hipB=basis(L(i,'l_hip').clone().sub(L(i,'r_hip')), mid(L(i,'l_shoulder'),L(i,'r_shoulder')).sub(mid(L(i,'l_hip'),L(i,'r_hip'))));
  const chestB=basis(L(i,'l_shoulder').clone().sub(L(i,'r_shoulder')), mid(L(i,'l_shoulder'),L(i,'r_shoulder')).sub(mid(L(i,'l_hip'),L(i,'r_hip'))));
  const earMid=mid(L(i,'l_ear'),L(i,'r_ear')), headB=basis(L(i,'l_ear').clone().sub(L(i,'r_ear')), earMid.clone().sub(mid(L(i,'l_shoulder'),L(i,'r_shoulder'))));
  const Dh=hipB.clone().multiply(restHipB.clone().invert()), Dc=chestB.clone().multiply(restChestB.clone().invert()), Dd=headCal.clone().multiply(headB).multiply(restHeadB.clone().invert());
  const D={Hips:Dh, Spine:slerpQ(Dh,Dc,1/3), Spine1:slerpQ(Dh,Dc,2/3), Spine2:Dc, LeftShoulder:Dc, RightShoulder:Dc, Neck:slerpQ(Dc,Dd,0.5), Head:Dd};
  for(const [n,q] of Object.entries(D)) if(restW[n]) W[n]=q.clone().multiply(restW[n]);
  for(const [b,,a,e] of LIMB){ if(!restW[b]) continue;
    const pn=G[b].parent.name.replace(/^mixamorig:?/,''), Wp=W[pn]||restW[pn]||wq(G[b].parent);
    const Dp=Wp.clone().multiply((restW[pn]||Wp).clone().invert());                 /* 부모가 쉬는 자세에서 돈 만큼 */
    const d0=restDir[b].clone().applyQuaternion(Dp);
    const end=Array.isArray(e)?mid(L(i,e[0]),L(i,e[1])):L(i,e), d=end.clone().sub(L(i,a)).normalize();
    W[b]=new T.Quaternion().setFromUnitVectors(d0,d).multiply(Dp).multiply(restW[b]); }
  for(const n of order){ if(!W[n]){ const pn=G[n].parent.name.replace(/^mixamorig:?/,''); const Wp=W[pn]; W[n]=Wp?Wp.clone().multiply(restW[pn].clone().invert()).multiply(restW[n]):restW[n].clone(); } }
  for(const n of order){ const pn=G[n].parent.name.replace(/^mixamorig:?/,''); const pw=W[pn]||wq(G[n].parent); const loc=pw.clone().invert().multiply(W[n]);
    const prev=tracks[n][tracks[n].length-1]; if(prev&&prev.dot(loc)<0) loc.set(-loc.x,-loc.y,-loc.z,-loc.w); tracks[n].push(loc); }
  /* 5. 골반 높이 */
  const legLenS=(L(i,'l_hip').distanceTo(L(i,'l_knee'))+L(i,'l_knee').distanceTo(L(i,'l_ankle'))+L(i,'r_hip').distanceTo(L(i,'r_knee'))+L(i,'r_knee').distanceTo(L(i,'r_ankle')))/2;
  const k=legLenT/legLenS, low=Math.min(L(i,'l_ankle').y,L(i,'r_ankle').y), hipMidY=mid(L(i,'l_hip'),L(i,'r_hip')).y;
  const wantHipWorldY=footRestY+(hipMidY-low)*k, dY=(wantHipWorldY-hipWorldY);
  const d=new T.Vector3(0,dY,0).applyQuaternion(hipsParentQ.clone().invert()).divide(hipsParentS);
  hips.push(G.Hips.position.clone().add(d));
}
const dur=(N-1)/FPS/SPEED, times=Array.from({length:N},(_,i)=>+(i/FPS/SPEED).toFixed(5));
const out={name:NAME, source:SRC.split('/').pop(), from:t0, duration:+dur.toFixed(5), fps:FPS*SPEED, times,
  tracks:Object.fromEntries(order.map(n=>[n,tracks[n].flatMap(q=>[q.x,q.y,q.z,q.w].map(v=>+v.toFixed(6)))])), hips:hips.flatMap(p=>[p.x,p.y,p.z].map(v=>+v.toFixed(5)))};
log(`${NAME}: ${N} 키, ${dur.toFixed(2)} s, 뼈 ${order.length}`);
console.log(JSON.stringify(out));
