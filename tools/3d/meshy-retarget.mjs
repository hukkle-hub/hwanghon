/* Meshy 리그 클립 → 아인 리그 클립 (JSON 트랙).
 *
 * Meshy 는 «우리 몸 메시(ain_body.glb)» 를 자기 뼈대로 리깅해 전문가 클립을 입혀 준다
 * (docs/design/72 부록). 뼈 이름은 Mixamo 식이지만 척추 순서가 반대이고
 * (Spine02 가 제일 아래), 쉬는 자세의 뼈 축도 우리 리그와 다르다. 그래서 이름만
 * 바꿔 붙이면 안 되고 «월드 회전의 변화량» 으로 옮긴다:
 *
 *     D(t)      = W_src(t) · W_src(rest)⁻¹      원본 뼈가 쉬는 자세에서 얼마나 돌았나
 *     W_tgt(t)  = D(t) · W_tgt(rest)            우리 뼈를 같은 만큼 돌린다
 *     local(t)  = W_tgt(parent, t)⁻¹ · W_tgt(t)
 *
 * 둘 다 같은 메시의 같은 쉬는 자세라 변화량이 그대로 통한다. 골반 위치는 키 비율로.
 *
 * 사용: node tools/3d/meshy-retarget.mjs <meshy.glb> <이름> [시작초 끝초] [--fps 60]
 *          [--target 캐릭터.glb] [--root] [--crouch k] [--spine k] [--lean …] [--face g,h,c] [--chest 접점,가슴각,g,시작,끝,w] > out.json
 * 74번에 쓴 명령 (docs/design/74-meshy-clips.md):
 *   attack3  thrust.glb  0.25 1.25 --fps 60 --chest .48,20,.5,-13,-13,.5
 *   counter  charged.glb 0.75 1.65 --fps 60 --chest .44,0,.5,-13,-13,.5
 *   skill1   reap.glb    2.95 3.95 --fps 60 --chest .24,40,.5,-13,-13,.5
 *   skill2   dodge.glb   0    1.46 --fps 60
 */
import {readFile} from 'node:fs/promises';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
const args=process.argv.slice(2), file=args[0], name=args[1];
const t0=args[2]!=null&&!args[2].startsWith('--')?+args[2]:null, t1=args[3]!=null&&!args[3].startsWith('--')?+args[3]:null;
const FPS=+(args[args.indexOf('--fps')+1]||30)||30;
const load=async f=>{const b=await readFile(f),l=new GLTFLoader();l.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
/* --target 캐릭터 glb (기본 아인). 카인·류·세라도 같은 Mixamo 이름 뼈대다 (docs/design/76) */
const TARGET=args.includes('--target')?args[args.indexOf('--target')+1]:new URL('../../art/3d/ain_anim.glb',import.meta.url).pathname;
const src=await load(file), tgt=await load(TARGET);
/* 우리 뼈 → Meshy 뼈. 척추는 순서가 반대다. */
const MAP={Hips:'Hips',Spine:'Spine02',Spine1:'Spine01',Spine2:'Spine',Neck:'neck',Head:'Head',
  LeftShoulder:'LeftShoulder',LeftArm:'LeftArm',LeftForeArm:'LeftForeArm',LeftHand:'LeftHand',
  RightShoulder:'RightShoulder',RightArm:'RightArm',RightForeArm:'RightForeArm',RightHand:'RightHand',
  LeftUpLeg:'LeftUpLeg',LeftLeg:'LeftLeg',LeftFoot:'LeftFoot',LeftToeBase:'LeftToeBase',
  RightUpLeg:'RightUpLeg',RightLeg:'RightLeg',RightFoot:'RightFoot',RightToeBase:'RightToeBase'};
const S={},G={};
src.scene.traverse(o=>{if(o.isBone)S[o.name]=o;}); tgt.scene.traverse(o=>{if(o.isBone)G[o.name.replace(/^mixamorig:?/,'')]=o;});
src.scene.updateMatrixWorld(true); tgt.scene.updateMatrixWorld(true);
const wq=o=>o.getWorldQuaternion(new T.Quaternion());
const restS={},restG={};
for(const [g,s] of Object.entries(MAP)){ restS[s]=wq(S[s]); restG[g]=wq(G[g]); }
const hipRestS=S.Hips.getWorldPosition(new T.Vector3()), hipRestG=G.Hips.position.clone();
const scale=G.Hips.getWorldPosition(new T.Vector3()).y/hipRestS.y;
const clip=src.animations[0], mixer=new T.AnimationMixer(src.scene); mixer.clipAction(clip).play();
const A=t0!=null?t0:0, B=Math.min(t1!=null?t1:clip.duration, clip.duration-1e-4),   /* 끝 시각 그대로면 믹서가 0 으로 되감긴다 */ N=Math.max(2,Math.round((B-A)*FPS));
/* 부모 먼저 — 계층 순서 */
const order=[]; tgt.scene.traverse(o=>{if(o.isBone){const n=o.name.replace(/^mixamorig:?/,'');if(MAP[n])order.push(n);}});
const tracks={}; order.forEach(n=>tracks[n]=[]); const hips=[];
const INPLACE=!args.includes('--root');
const CROUCH=args.includes('--crouch')?+args[args.indexOf('--crouch')+1]:1;
const SPINE=args.includes('--spine')?+args[args.indexOf('--spine')+1]:1;
const LEAN=args.includes('--lean')?args[args.indexOf('--lean')+1].split(',').map(Number):null;
const legLen={}, footRest={}, plant={Left:{},Right:{}};
const legPlan=[];                      /* 프레임마다 발 목표·무릎 방향 — 다 모은 뒤 펴서 푼다 */
for(const side of ['Left','Right']){
  const a=G[side+'UpLeg'].getWorldPosition(new T.Vector3()), k=G[side+'Leg'].getWorldPosition(new T.Vector3()), f=G[side+'Foot'].getWorldPosition(new T.Vector3());
  legLen[side]=[a.distanceTo(k),k.distanceTo(f)];
  footRest[side]=S[side+'Foot'].getWorldPosition(new T.Vector3()).y*scale;
}
/* --face g,h,c : 몸 방향(골반 yaw) 다스리기. Meshy 클립은 동작 중에 몸이 통째로 돈다
   (3타 116°, 반격·스킬1 은 가슴이 160~200°). 게임은 뿌리(root)가 과녁을 보게 두고
   클립은 «제자리» 로 트므로, 그대로 넣으면 치는 동안 옆·뒤를 보다가 대기로 돌아오며 휙 돈다.
     Y(t)  = 원본 골반 yaw,  L(t) = Y(0)→Y(끝) 을 스무더스텝으로 잇는 «순회전» 선
     Y'(t) = c + g·(Y − L) + h·(Y(끝) − Y(0))·(s(u) − ½)
   g: 순회전을 뺀 나머지 비틀림을 얼마나 남길지, h: 순회전 중 남길 몫, c: 가운데 방향(°).
   몸 전체(모든 뼈의 월드 회전)를 같은 각만큼 돌리고, 발 목표도 골반 축으로 같이 돌린다 —
   딛는 발 판정은 «원본» 에서 하므로 몸이 덜 도는 만큼 다리가 덜 꼬일 뿐 발은 박혀 있다. */
const FACE=args.includes('--face')?args[args.indexOf('--face')+1].split(',').map(Number):null;
const yawR=[];
if(FACE){ const [g,h,c]=[FACE[0],FACE[1]||0,(FACE[2]||0)*Math.PI/180], Y=[];
  for(let i=0;i<=N;i++){ mixer.setTime(A+(B-A)*i/N); src.scene.updateMatrixWorld(true);
    const v=new T.Vector3(0,0,1).applyQuaternion(wq(S.Hips).multiply(restS.Hips.clone().invert()));
    let y=Math.atan2(v.x,v.z); if(Y.length){ while(y-Y[Y.length-1]>Math.PI)y-=2*Math.PI; while(y-Y[Y.length-1]<-Math.PI)y+=2*Math.PI; } Y.push(y); }
  const net=Y[N]-Y[0], ss=u=>u*u*u*(u*(u*6-15)+10);
  for(let i=0;i<=N;i++){ const u=i/N, L=Y[0]+net*ss(u); yawR.push(c+g*(Y[i]-L)+h*net*(ss(u)-.5)-Y[i]); }
  const deg=x=>(x*180/Math.PI).toFixed(0);
  process.stderr.write(`  골반 yaw 원본 ${deg(Y[0])}°→${deg(Y[N])}° (범위 ${deg(Math.min(...Y))}~${deg(Math.max(...Y))}) → 보정 후 ${deg(Y[0]+yawR[0])}°→${deg(Y[N]+yawR[N])}° (범위 ${deg(Math.min(...Y.map((y,i)=>y+yawR[i])))}~${deg(Math.max(...Y.map((y,i)=>y+yawR[i])))})\n`);
}
/* --chest uc,cc,g[,c0,c1] : 가슴(Spine2 — 두손 리그가 낫 경로를 거는 «몸통 틀») 방향을
   기준점에 맞춘다. 낫 경로 키는 몸통 기준이라 «접점 순간의 가슴 방향» 이 맞아야 날이 과녁에
   간다. 시작·끝 = 대기 가슴(c0,c1 기본 −13°), 접점 uc = 옛 클립 접점의 가슴 방향 cc.
   세 점을 스무더스텝으로 잇고, 원본이 그 선에서 벗어나는 흔들림은 g 만큼 남긴다.
   몸 전체를 같은 각만큼 돌린다(골반·다리 포함, 발 목표도). 각도는 «뼈 축 기준» 이다. */
const CHEST=args.includes('--chest')?args[args.indexOf('--chest')+1].split(',').map(Number):null;
if(CHEST){ const [uc,cc,g,c0=-13,c1=-13,w=0]=CHEST, r=Math.PI/180, C=[], H=[];
  /* --yaw-x: 옆 축(x)으로 잰다. 크게 숙이면(카인 해머 스윙 끝 90°) 앞 축은 바닥을 가리켜 yaw 가
     엉망이 된다 — 옆 축은 숙여도 수평이다. 74번(아인) 명령은 앞 축 그대로. */
  const YX=args.includes('--yaw-x');
  const yawOf=q=>{ if(YX){const v=new T.Vector3(1,0,0).applyQuaternion(q);return Math.atan2(-v.z,v.x);} const v=new T.Vector3(0,0,1).applyQuaternion(q);return Math.atan2(v.x,v.z);};
  for(let i=0;i<=N;i++){ mixer.setTime(A+(B-A)*i/N); src.scene.updateMatrixWorld(true);
    let y=yawOf(wq(S.Spine).multiply(restS.Spine.clone().invert()).multiply(restG.Spine2));
    if(C.length){ while(y-C[C.length-1]>Math.PI)y-=2*Math.PI; while(y-C[C.length-1]<-Math.PI)y+=2*Math.PI; } C.push(y);
    let h=yawOf(wq(S.Hips).multiply(restS.Hips.clone().invert()).multiply(restG.Hips));
    while(h-y>Math.PI)h-=2*Math.PI; while(h-y<-Math.PI)h+=2*Math.PI; H.push(h); }
  /* w: 시작·끝을 «골반 w : 가슴 1−w» 섞은 방향으로 맞춘다. 원본이 처음부터 몸을 꼰
     자세(반격: 골반·가슴 50°)면 가슴만 맞출 때 골반이 대기에서 51° 튄다 — 공격 섞기는
     0.06초라 그대로 «휙» 이다. 반반이면 둘 다 25° 안쪽(옛 반격 가슴 22° 와 같은 급). */
  const M=i=>w*H[i]+(1-w)*C[i], IDLE_H=-12;
  const ss=u=>u*u*u*(u*(u*6-15)+10), ic=Math.round(uc*N);
  const line=(u,a0,ac,a1)=>u<=uc?a0+(ac-a0)*ss(u/uc):ac+(a1-ac)*ss((u-uc)/(1-uc));
  const r0=w*IDLE_H*r+(1-w)*c0*r-M(0), rc=cc*r-C[ic], r1=w*IDLE_H*r+(1-w)*c1*r-M(N);
  for(let i=0;i<=N;i++){ const u=i/N; yawR[i]=(yawR[i]||0)+line(u,r0,rc,r1)+(g-1)*(C[i]-line(u,C[0],C[ic],C[N])); }
  const deg=x=>(x/r).toFixed(0);
  process.stderr.write(`  가슴 yaw 원본 ${deg(C[0])}→${deg(C[ic])}(접점)→${deg(C[N])}° 범위 ${deg(Math.min(...C))}~${deg(Math.max(...C))} → ${deg(C[0]+yawR[0])}→${deg(C[ic]+yawR[ic])}→${deg(C[N]+yawR[N])}° 범위 ${deg(Math.min(...C.map((c,i)=>c+yawR[i])))}~${deg(Math.max(...C.map((c,i)=>c+yawR[i])))}\n`);
}
const Ry=i=>new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yawR.length?yawR[i]:0);
const PIV=new T.Vector3(hipRestS.x*scale,0,hipRestS.z*scale);
const turn=(p,i)=>yawR.length?p.clone().sub(PIV).applyAxisAngle(new T.Vector3(0,1,0),yawR[i]).add(PIV).setY(p.y):p;
const armParent=G.Hips.parent; armParent.updateMatrixWorld(true);
const armQ=wq(armParent), armInv=armQ.clone().invert();
for(let i=0;i<=N;i++){
  mixer.setTime(A+(B-A)*i/N); src.scene.updateMatrixWorld(true);
  const W={};
  for(const n of order){
    const s=MAP[n], D=wq(S[s]).multiply(restS[s].clone().invert());
    /* --spine k: 골반·척추의 «월드 회전 변화» 를 k 만큼만 — 몸통이 과하게 숙이거나
       비틀어 날이 과녁에서 돌아갈 때. 팔·다리는 그대로 따라간다. */
    if(SPINE!==1&&/^(Hips|Spine|Spine1|Spine2)$/.test(n)) D.slerp(new T.Quaternion(),1-SPINE);
    /* --lean 숙임°,돌림°,중심,폭 : 가산 레이어. 접점 언저리에서만 골반을 돌리고(돌림) 가슴을
       숙인다(숙임) — 애니메이터가 원본 위에 얹는 보정 레이어와 같다. 낫 경로(키)가 옛 몸의
       접점 자세(왼쪽 40° · 27° 숙임) 기준으로 짜여 있어, 꼿꼿이 선 새 몸으로는 날이 과녁 위로
       지나간다. 모양은 스무더스텝 봉우리라 앞뒤가 매끄럽게 이어진다. */
    if(LEAN){ const u=i/N, x=Math.max(0,1-Math.abs(u-LEAN[2])/LEAN[3]), k=x*x*x*(x*(x*6-15)+10);
      if(n==='Hips') D.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),LEAN[1]*k*Math.PI/180));
      if(n==='Spine1'||n==='Spine2') D.premultiply(new T.Quaternion().setFromAxisAngle(
        new T.Vector3(1,0,0).applyQuaternion(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),LEAN[1]*k*Math.PI/180)),LEAN[0]/2*k*Math.PI/180)); }
    if(yawR.length) D.premultiply(Ry(i));
    W[n]=D.multiply(restG[n]);
    const pn=G[n].parent.name.replace(/^mixamorig:?/,'');
    const pw=W[pn]||(G[n].parent===armParent?armQ:wq(G[n].parent));
    const local=pw.clone().invert().multiply(W[n]);
    const prev=tracks[n][tracks[n].length-1];
    if(prev&&prev.dot(local)<0) local.set(-local.x,-local.y,-local.z,-local.w);   /* 반구를 이어 둔다 */
    tracks[n].push(local);
  }
  /* 골반 위치: 원본 월드 변위 × 키 비율 → 아인 부모 공간 */
  const dW=S.Hips.getWorldPosition(new T.Vector3()).sub(hipRestS).multiplyScalar(scale);
  const d=dW.clone().applyQuaternion(armInv);
  const ps=armParent.getWorldScale(new T.Vector3()); d.divide(ps);
  if(INPLACE){ d.x=0; d.z=0; }
  /* --crouch k: 골반이 내려가는 양만 k 배로 (반격처럼 «웅크림» 이 너무 깊어 날이 높은 과녁에
     못 미칠 때). 발은 박힌 채 다리 IK 가 다시 맞추므로 무릎만 덜 굽는다. */
  if(CROUCH!==1&&d.y<0) d.y*=CROUCH;
  hips.push(hipRestG.clone().add(d));
  if(INPLACE) plantLegs(i,dW);
}
/* ── 제자리 변환 + 발 고정 (다리 2본 IK) ────────────────────────────────
   게임은 공격 클립의 골반 앞뒤 이동을 지우고 제자리에서 재생한다
   (js/ain-bind-repair.js). Meshy 클립은 런지·스텝으로 골반이 0.5~1.1 m 나간다 —
   그대로 넣으면 딛고 있는 발이 그만큼 뒤로 «미끄러진다».
   그래서: 골반은 제자리, 원본에서 «딛고 있는» 발(낮고 느린 발)은 딛기 시작한
   자리에 박아 두고, 들린 발은 원본 궤적을 골반 이동만큼 당겨 따라간다.
   다리는 해석적 2본 IK, 무릎 방향은 원본 무릎. */
function plantLegs(i,dW){
  const hipOff=new T.Vector3(dW.x,0,dW.z), rec={};
  for(const side of ['Left','Right']){
    const sF=S[side+'Foot'], sK=S[side+'Leg'];
    const fW=sF.getWorldPosition(new T.Vector3()).multiplyScalar(scale), kW=sK.getWorldPosition(new T.Vector3()).multiplyScalar(scale);
    const st=plant[side];
    const low=fW.y<footRest[side]+0.05, slow=st.prev?fW.clone().setY(0).distanceTo(st.prev.clone().setY(0))*N/(B-A)<0.45:false;
    st.prev=fW.clone();
    let target=turn(fW.clone().sub(hipOff),i);          /* 박을 자리는 «돌린 뒤» 공간에서 잡는다 */
    if(low&&slow){ if(!st.lock) st.lock=target.clone(); target=st.lock.clone(); target.y=fW.y; } else st.lock=null;
    rec[side]={target, pole:turn(kW.clone().sub(hipOff),i)};
  }
  legPlan[i]=rec;
}
/* 박힘/풀림이 바뀌는 순간 목표가 툭 옮겨 가면 다리가 한 프레임에 튄다(3타 왼다리 12.1).
   그래서 목표 궤적을 가우시안(σ 0.05초)으로 편 뒤 IK 를 푼다 — 발은 조금 덜 박히지만 안 튄다. */
function solveLegs(){
  const sig=0.05*N/(B-A), R=Math.ceil(3*sig);
  const smooth=(side,key)=>legPlan.map((_,i)=>{ const acc=new T.Vector3(); let w=0;
    for(let j=Math.max(0,i-R);j<=Math.min(legPlan.length-1,i+R);j++){ const k=Math.exp(-((j-i)**2)/(2*sig*sig)); acc.addScaledVector(legPlan[j][side][key],k); w+=k; }
    return acc.multiplyScalar(1/w); });
  const T2={Left:smooth('Left','target'),Right:smooth('Right','target')}, P2={Left:smooth('Left','pole'),Right:smooth('Right','pole')};
  for(let i=0;i<legPlan.length;i++){
    for(const n of order) G[n].quaternion.copy(tracks[n][i]);
    G.Hips.position.copy(hips[i]); tgt.scene.updateMatrixWorld(true);
    for(const side of ['Left','Right']){
      const up=G[side+'UpLeg'], lo=G[side+'Leg'], ft=G[side+'Foot'];
      const a=up.getWorldPosition(new T.Vector3()), L1=legLen[side][0], L2=legLen[side][1];
      const target=T2[side][i], pole=P2[side][i];
      const toT=target.clone().sub(a); let dist=toT.length(); const dmax=(L1+L2)*0.999; if(dist>dmax){ toT.setLength(dmax); dist=dmax; }
      const dirT=toT.clone().normalize();
      const cosA=Math.max(-1,Math.min(1,(L1*L1+dist*dist-L2*L2)/(2*L1*dist)));
      let bend=pole.clone().sub(a); bend.sub(dirT.clone().multiplyScalar(bend.dot(dirT)));
      if(bend.lengthSq()<1e-8) bend.set(0,0,1); bend.normalize();
      const knee=a.clone().add(dirT.clone().multiplyScalar(L1*cosA)).add(bend.multiplyScalar(L1*Math.sqrt(1-cosA*cosA)));
      const foot=a.clone().add(toT);
      const aim=(bone,childPos,want)=>{ const o=bone.getWorldPosition(new T.Vector3()), cur=childPos.clone().sub(o).normalize(), w=want.clone().sub(o).normalize();
        const W1=new T.Quaternion().setFromUnitVectors(cur,w).multiply(wq(bone));
        bone.quaternion.copy(wq(bone.parent).invert().multiply(W1)); tgt.scene.updateMatrixWorld(true); };
      const footW=wq(ft);
      aim(up, lo.getWorldPosition(new T.Vector3()), knee);
      aim(lo, ft.getWorldPosition(new T.Vector3()), foot);
      ft.quaternion.copy(wq(lo).invert().multiply(footW)); tgt.scene.updateMatrixWorld(true);
      for(const n of [side+'UpLeg',side+'Leg',side+'Foot']){ const q=G[n].quaternion.clone(), prev=tracks[n][i-1];
        if(prev&&prev.dot(q)<0) q.set(-q.x,-q.y,-q.z,-q.w); tracks[n][i]=q; }
    }
  }
}
if(INPLACE) solveLegs();
const times=Array.from({length:N+1},(_,i)=>+((B-A)*i/N).toFixed(5));
const out={name, source:file.split('/').pop(), sourceClip:clip.name, from:A, to:B, duration:+(B-A).toFixed(5), fps:FPS, times,
  tracks:Object.fromEntries(order.map(n=>[n,tracks[n].flatMap(q=>[q.x,q.y,q.z,q.w].map(v=>+v.toFixed(6)))])),
  hips:hips.flatMap(p=>[p.x,p.y,p.z].map(v=>+v.toFixed(5)))};
/* 계측: 오른손 속도(원본 기준)로 «때리는 순간» 후보를 알려 준다 */
const sp=[]; let prev=null;
for(let i=0;i<=N;i++){ mixer.setTime(A+(B-A)*i/N); src.scene.updateMatrixWorld(true); const p=S.RightHand.getWorldPosition(new T.Vector3()); if(prev) sp.push(p.distanceTo(prev)*FPS/((B-A)*FPS/N)); prev=p; }
let pk=0,pi=0; sp.forEach((v,i)=>{if(v>pk){pk=v;pi=i;}});
process.stderr.write(`${name}: 원본 ${clip.name} ${clip.duration.toFixed(2)}s, 구간 ${A.toFixed(2)}~${B.toFixed(2)}s, ${N+1} 표본, 키 비율 ${scale.toFixed(3)}\n`);
process.stderr.write(`  오른손 최고속 ${pk.toFixed(2)} m/s @ ${((pi+1)/N).toFixed(3)} (구간 비율)\n`);
process.stderr.write('  오른손 속도 20칸: '+Array.from({length:20},(_,b)=>{const a=Math.floor(b*sp.length/20),c=Math.floor((b+1)*sp.length/20);return (sp.slice(a,c).reduce((s,x)=>s+x,0)/Math.max(1,c-a)).toFixed(1);}).join(' ')+'\n');
console.log(JSON.stringify(out));
