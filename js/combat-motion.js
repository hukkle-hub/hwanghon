/* Presentation adapter. Model/clip swaps do not own combat time or damage. */
import * as THREE from '../vendor/three/three.module.js';
import './boss-contact-volumes.js';
import './combat-quality.js';
import './swing-body.js';

/* 행동 시각 → 클립 시각. 접점(phase .42)은 반드시 클립의 접점 프레임에 못 박고,
   그 앞뒤 «안에서» 만 시간을 다시 깎는다 — 무거운 것은 굼뜨게 감았다가
   접점 근처에서 최고속을 찍어야 한다 (js/swing-body.js 의 무게 곡선).
   판정 시각도 행동 길이도 안 변한다. docs/design/66-scythe-weight.md */
export function sampleAction(a, duration) {
  const t=Math.max(0,Math.min(a.duration,a.elapsed));
  const contact=duration*a.clipHit;
  const phase=globalThis.TW_COMBAT_QUALITY.phase({...a,elapsed:t});
  const SB=globalThis.TW_SWING_BODY;
  /* 세 박자 템포가 있는 기술은 몸도 같은 곡선으로 흘린다 (js/swing-body.js TEMPO) */
  const tempo=SB&&SB.TEMPO&&SB.TEMPO[a.clip];
  /* 몸 클립은 접점 직후에도 제 속도로 크게 움직여서(원본이 도는 동작) 무기와 같은
     bite 로는 감속이 안 보였다 — 몸 쪽 감속은 따로 둔다 (bodyBite). */
  if(tempo) return SB.tempoCurve(phase, tempo.bodyBite!=null?Object.assign({},tempo,{bite:tempo.bodyBite}):tempo, contact, duration-contact);
  if(phase<=.42){
    const u=phase/.42;
    return contact*(SB?SB.coilEase(u,a.clip,a.clipHit):u);
  }
  const u=(phase-.42)/.58;
  return contact+(duration-contact)*(SB?SB.throwEase(u,a.clip,a.clipHit):u);
}

function rotateToward(bone, end, target, amount) {
  const origin=bone.getWorldPosition(new THREE.Vector3());
  const from=(typeof end==='function'?end():end.getWorldPosition(new THREE.Vector3())).sub(origin).normalize();
  const to=target.clone().sub(origin).normalize();
  if(!from.lengthSq()||!to.lengthSq()) return;
  const delta=new THREE.Quaternion().setFromUnitVectors(from,to);
  const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const local=parent.clone().invert().multiply(delta).multiply(parent).multiply(bone.quaternion);
  bone.quaternion.slerp(local,amount);bone.updateWorldMatrix(false,true);
}

/* 끝점이 뼈가 아니라 «손에 붙은 점»(주먹 구멍)일 때 — 손목 관절이 아니라 그 점을 target 에 (docs/design/94) */
export function solveLimbPoint(upper,lower,point,target,weight=1) {
  const u=upper.getWorldPosition(new THREE.Vector3()), l=lower.getWorldPosition(new THREE.Vector3());
  const reach=u.distanceTo(l)+l.distanceTo(point()), delta=target.clone().sub(u);
  if(delta.length()>reach*0.985) target=u.clone().add(delta.setLength(reach*0.985));
  for(let i=0;i<10;i++){rotateToward(lower,point,target,weight);rotateToward(upper,point,target,weight);}
  return point().distanceTo(target);
}

/* Reach-bounded CCD correction; never scales limbs. */
export function solveLimb(upper,lower,end,target,weight=1) {
  if(!upper||!lower||!end) return Infinity;
  const u=upper.getWorldPosition(new THREE.Vector3()), l=lower.getWorldPosition(new THREE.Vector3()), e=end.getWorldPosition(new THREE.Vector3());
  const reach=u.distanceTo(l)+l.distanceTo(e), delta=target.clone().sub(u);
  if(delta.length()>reach*0.985) target=u.clone().add(delta.setLength(reach*0.985));
  for(let i=0;i<8;i++){rotateToward(lower,end,target,weight);rotateToward(upper,end,target,weight);}
  return end.getWorldPosition(new THREE.Vector3()).distanceTo(target);
}

/* 왼손 두 손 잡기 풀이 (docs/design/95) — 주먹 구멍 점을 손잡이 축 위 target 에, 주먹 구멍 방향(새끼→엄지)을 칼날 쪽 축에.
   남는 자유도 둘을 재서 고른다: 손잡이 둘레 돌림 φ(36) × 팔꿈치 돌림 ψ(13, ±120°). 값 = 손목 꺾임(쉬는 자세 34° 넘는 만큼)² + 손목 비틀림² + 팔꿈치 비틀림(클립 대비)² + 팔꿈치 돌림².
   (돌림만 고르면 손목이 150° 꺾이거나 팔뚝 대비 172° 비틀렸다 — 손목 살이 꼬인다.) 장면 갱신 없이 벡터 셈만 한다. */
const PULL_MAX=.25;   // 오른손을 몸 쪽으로 당기는 최대 거리(m). 「근거 없음」
const CLAV_MAX=.55;   // 왼쇄골을 내미는 최대 각(rad, 31°). 「근거 없음」 — 렌더로 확인
const PSI=[0,-.35,.35,-.7,.7,-1.05,1.05,-1.4,1.4,-1.75,1.75,-2.1,2.1];
function planLeftGrip(upper,lower,hand,slot,target){
  const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
  const la=hand.userData.gripAxis.clone().normalize(),lf=hand.userData.gripFinger?hand.userData.gripFinger.clone().normalize():null,palm=hand.userData.gripPoint;
  const A=V().set(0,1,0).applyQuaternion(slot.getWorldQuaternion(Q())).normalize();
  const S=upper.getWorldPosition(V()),E0=lower.getWorldPosition(V()),W0=hand.getWorldPosition(V());
  const uW0=upper.getWorldQuaternion(Q()),lW0=lower.getWorldQuaternion(Q()),hW0=hand.getWorldQuaternion(Q()),k=hand.getWorldScale(V()).x;
  const a=S.distanceTo(E0),b=E0.distanceTo(W0),boneAxis=hand.position.clone().normalize(),foreAxis=lower.position.clone().normalize();
  const twistQ=(q,ax)=>{const p=V().set(q.x,q.y,q.z),pr=ax.clone().multiplyScalar(p.dot(ax));return new THREE.Quaternion(pr.x,pr.y,pr.z,q.w).normalize();};
  const angOf=t=>2*Math.acos(Math.min(1,Math.abs(t.w)));
  const twistOf=q=>angOf(twistQ(q,boneAxis));
  /* 팔꿈치 비틀림은 클립 자세 대비로 잰다(클립이 원래 돌려 둔 만큼은 괜찮다) */
  const e0=twistQ(uW0.clone().invert().multiply(lW0),foreAxis);
  const elbowDev=(uW,lW)=>angOf(e0.clone().invert().multiply(twistQ(uW.clone().invert().multiply(lW),foreAxis)));
  /* 손목 비틀림 30° 넘는 몫의 절반을 아래팔이 나눠 진다 — 실제 팔도 아래팔 전체가 돈다(회내·회외) */
  const share=(lW,q)=>{const t=twistQ(lW.clone().invert().multiply(q),boneAxis),tw=angOf(t);return tw>.5?lW.clone().multiply(Q().slerp(t,(tw-.5)/2/tw)):lW;};
  const base=Q().setFromUnitVectors(la.clone().applyQuaternion(hW0).normalize(),A).multiply(hW0);
  let best=null,bestC=Infinity;
  for(let r=0;r<36;r++){
    const q=Q().setFromAxisAngle(A,r*Math.PI/18).multiply(base);
    const Wt=target.clone().sub(palm.clone().multiplyScalar(k).applyQuaternion(q));
    const toW=Wt.clone().sub(S);let d=toW.length();const u=toW.clone().normalize();const resid=Math.max(0,d-(a+b)*.999);d=Math.min(d,(a+b)*.999);
    const cosA=THREE.MathUtils.clamp((a*a+d*d-b*b)/(2*a*d),-1,1),sinA=Math.sqrt(1-cosA*cosA);
    const v0=E0.clone().sub(S);v0.addScaledVector(u,-v0.dot(u));if(v0.lengthSq()<1e-8)v0.set(0,-1,0).addScaledVector(u,-u.y);v0.normalize();const w=V().crossVectors(u,v0);
    const Wr=S.clone().addScaledVector(u,d);
    for(const psi of PSI){
      const E=S.clone().addScaledVector(u,a*cosA).addScaledVector(v0,a*sinA*Math.cos(psi)).addScaledVector(w,a*sinA*Math.sin(psi));
      const d1=Q().setFromUnitVectors(E0.clone().sub(S).normalize(),E.clone().sub(S).normalize());
      const fwd=W0.clone().sub(E0).applyQuaternion(d1).normalize(),d2=Q().setFromUnitVectors(fwd,Wr.clone().sub(E).normalize());
      const uW=d1.clone().multiply(uW0),lW=share(d2.clone().multiply(d1).multiply(lW0),q);
      const tw=twistOf(lW.clone().invert().multiply(q)),bend=lf?lf.clone().applyQuaternion(q).angleTo(Wr.clone().sub(E)):0,el=elbowDev(uW,lW);
      /* 못 닿는 돌림은 크게 벌한다 — 주먹 방향이 손목 각을 정하므로 팔이 닿는지는 돌림마다 다르다 */
      const c=Math.max(0,bend-.6)**2+tw*tw+el*el+.15*psi*psi+(resid*40)**2;
      if(c<bestC){bestC=c;best={q,lW,uW,tw,bend,el,resid};}
    }
  }
  return best;
}
function applyLeftGrip(upper,lower,hand,target,best,hold){
  const Q=()=>new THREE.Quaternion(),palm=hand.userData.gripPoint;
  /* 적용: 위팔 → 아래팔 → 손 (hold 만큼 원래 자세에서 섞는다) */
  const up=upper.parent.getWorldQuaternion(Q()).invert().multiply(best.uW);
  upper.quaternion.slerp(up,hold);upper.updateWorldMatrix(false,true);
  const lo=upper.getWorldQuaternion(Q()).invert().multiply(best.lW);
  lower.quaternion.slerp(lo,hold);lower.updateWorldMatrix(false,true);
  const hq=lower.getWorldQuaternion(Q()).invert().multiply(best.q);
  hand.quaternion.slerp(hq,hold);hand.updateWorldMatrix(false,true);
  /* 두 뼈 길이로 푼 팔꿈치가 1~2 mm 어긋날 수 있어 주먹 점으로 한 번 더 맞춘다(방향은 거의 그대로) */
  if(hold>=1)solveLimbPoint(upper,lower,()=>palm.clone().applyMatrix4(hand.matrixWorld),target,1);
  return best;
}

// opts.twoHand=false: 한손·쌍수 무기(류 단검·세라 시약) — 왼손을 오른손 무기로 끌어오지 않는다 (docs/design/93)
// opts.handGrip: 쥔 손 모프(js/hand-grip.js) — 양손 그립 동안 왼손을 쥔다 (docs/design/94)
export function makeRigAdapter(model,root,slot,opts={}) {
  const twoHand=opts.twoHand!==false, handGrip=opts.handGrip||null;let leftGrip=handGrip?handGrip.amount.Left:0;let twoHandS=0,reachOK=true;
  const bones={};model.traverse(o=>{if(o.isBone) bones[o.name.replace(/^mixamorig:?/,'')]=o;});
  const restCorrections=new Map(), anchors={}, diagnostics={gripError:0,footError:0};
  function restore(){for(const [b,q] of restCorrections)b.quaternion.copy(q);restCorrections.clear();}
  function keep(names){for(const n of names){const b=bones[n];if(b&&!restCorrections.has(b))restCorrections.set(b,b.quaternion.clone());}}
  function apply(a,moving,guard,dt){
    model.updateWorldMatrix(true,true);
    const active=a&&a.kind!=='counter'?a.elapsed/a.duration:0;
    if(a){
      keep(['Hips','Spine','Spine2']);
      /* 몸통 비틀기 — «감았다 치고 멈춘다». 전에는 sin(2πt)*0.08 = ±4.6° 였다.
         4.6° 로는 두 손으로 든 큰 낫이 어깨 위에서 흔들릴 뿐이다.
         이제 js/swing-body.js 가 접점(0.42)에 맞춰 모양을 주고, 기술마다 세기를
         다르게 준다 (스매시 ±25°, 평타 ±17°, 카운터는 작게).
         팔이 아니라 몸을 돌리는 이유는 docs/design/64-swing-size.md — 팔로 키우면
         두 손의 순서가 뒤집히며 팔꿈치가 튄다. 몸통은 어깨째 돌아 그 문제가 없다. */
      const SB=globalThis.TW_SWING_BODY;
      if(SB){
        const k=(Number.isFinite(a.hitAt)&&a.hitAt>0&&a.hitAt<a.duration)
          ? globalThis.TW_COMBAT_QUALITY.phase(a) : active;
        const sw=SB.shape(SB.tempoPhase?SB.tempoPhase(k,a.clip):k, SB.weightOf(a.clip, a.combo));
        /* 평타 연계는 타수마다 몸이 «반대로» 돈다 — 봉술의 여덟 방향 원리.
           방향이 안 바뀌면 아무리 크게 휘둘러도 연계로 안 읽힌다 (66번 문서 §1) */
        const side=SB.sideOf?SB.sideOf(a.clip, a.combo):1, yaw=sw.yaw*side;
        if(bones.Hips){ bones.Hips.rotateY(yaw*SB.SHARE.Hips); bones.Hips.rotateX(sw.lean*SB.SHARE.Hips); }
        if(bones.Spine){ bones.Spine.rotateY(yaw*SB.SHARE.Spine); bones.Spine.rotateX(sw.lean*SB.SHARE.Spine); }
        if(bones.Spine2){ bones.Spine2.rotateY(yaw*SB.SHARE.Spine2); bones.Spine2.rotateX(sw.lean*SB.SHARE.Spine2);
          bones.Spine2.rotateZ(Math.sin(active*Math.PI)*0.025); }
      } else {
        const drive=Math.sin(active*Math.PI*2)*0.08;
        if(bones.Hips)bones.Hips.rotateY(-drive*0.5);
        if(bones.Spine)bones.Spine.rotateY(drive);
        if(bones.Spine2)bones.Spine2.rotateZ(Math.sin(active*Math.PI)*0.025);
      }
      model.updateWorldMatrix(true,true);
    }
    // New main's idle is intentionally one-handed. Correct grip only while fighting/guarding.
    let gripWant=0;
    if(slot&&twoHand&&(a||guard)){
      keep(['LeftArm','LeftForeArm','LeftHand']);
      const left=bones.LeftHand,right=bones.RightHand,upper=bones.LeftArm,lower=bones.LeftForeArm;
      if(left&&right&&upper&&lower){
        function gripTarget(){
          const pos=slot.getWorldPosition(new THREE.Vector3());
          const axis=new THREE.Vector3(0,1,0).applyQuaternion(slot.getWorldQuaternion(new THREE.Quaternion()));
          const shoulder=upper.getWorldPosition(new THREE.Vector3());
          let off=THREE.MathUtils.clamp(shoulder.sub(pos).dot(axis),-0.55,0.5);
          if(Math.abs(off)<0.12)off=off<0?-0.12:0.12;
          /* 무기가 손잡이 길이를 알려 주면 그 안에서만 (looks.js hand2) — 안 그러면 폼멜 너머 허공을 쥐었다 */
          const h2=slot.userData.hand2;if(h2)off=THREE.MathUtils.clamp(off,h2[0],h2[1]);
          return pos.addScaledVector(axis,off);
        }
        let target=gripTarget();
        const shoulder=upper.getWorldPosition(new THREE.Vector3());
        const elbow=lower.getWorldPosition(new THREE.Vector3());
        // 손바닥(쥔 손이면 주먹 구멍, docs/design/94)을 손잡이에 댄다 — 팔이 닿는지도 그 점으로 잰다
        const palm=globalThis.TW_LOOKS&&TW_LOOKS.palm?TW_LOOKS.palm(THREE,left):null;
        const palmWorld=()=>palm?palm.clone().applyMatrix4(left.matrixWorld):left.getWorldPosition(new THREE.Vector3());
        /* 팔이 닿는 거리 = 어깨→팔꿈치 + 팔꿈치→주먹 (손목에서 주먹까지가 카인은 20 cm, 손목 각도에 따라 다르다) */
        const reachP=(shoulder.distanceTo(elbow)+elbow.distanceTo(palmWorld()))*0.975;
        const excess=shoulder.distanceTo(target)-reachP;
        // 오른손을 22 cm 당겨도 3~9 cm 넘게 모자라면 두 손 잡기를 풀어 준다 — 카인 공격1 은 한 손으로 88 cm 내뻗어
        // (팔+손 84 cm) 억지로 잡으면 왼손이 허공에서 손잡이 17 cm 옆에 멈췄다 (docs/design/94)
        /* 쥔 손(gripAxis)은 아래 풀이가 쇄골·오른손 당김까지 해 보고 모자란 거리로 놓을지 정한다 — 이 대략 판정은 편 손에만 */
        const hold=left.userData.gripAxis?1:1-THREE.MathUtils.smoothstep(excess-0.22,0.03,0.09);gripWant=hold;
        // Bring an overextended weapon hand inward without changing its world orientation.
        let pulled=0;
        const pullRight=len=>{len=Math.min(PULL_MAX-pulled,len);if(len<=.002)return;pulled+=len;
          keep(['RightArm','RightForeArm','RightHand']);
          const handQ=right.getWorldQuaternion(new THREE.Quaternion());
          const pull=shoulder.clone().sub(target).setLength(len);
          solveLimb(bones.RightArm,bones.RightForeArm,right,right.getWorldPosition(new THREE.Vector3()).add(pull));
          right.quaternion.copy(right.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(handQ));
          model.updateWorldMatrix(true,true);target=gripTarget();};
        /* 편 손만 먼저 당긴다 — 쥔 손은 아래 풀이가 쇄골부터 내밀고 모자랄 때만 당긴다(먼저 당기면 공격1 접점에서 대검이 21 cm 몸 쪽으로 들어왔다) */
        if(hold>0&&excess>0&&!left.userData.gripAxis)pullRight(excess+0.02);
        /* 왼쇄골 내밀기: 어깨 관절을 목표 쪽으로 돌린다 — 쇄골 길이 × 각만큼 닿는 거리가 는다 */
        const clav=bones.LeftShoulder;let clavUsed=0;
        const reachClavicle=need=>{if(!clav){clavUsed=CLAV_MAX;return;}keep(['LeftShoulder']);
          const o=clav.getWorldPosition(new THREE.Vector3()),j=upper.getWorldPosition(new THREE.Vector3()),len=o.distanceTo(j);
          const from=j.clone().sub(o).normalize(),to=target.clone().sub(o).normalize(),ax=new THREE.Vector3().crossVectors(from,to);
          const ang=Math.min(from.angleTo(to),CLAV_MAX-clavUsed,need/Math.max(.05,len));if(ang<1e-3||ax.lengthSq()<1e-10){clavUsed=CLAV_MAX;return;}
          clavUsed+=ang;const q=new THREE.Quaternion().setFromAxisAngle(ax.normalize(),ang).multiply(clav.getWorldQuaternion(new THREE.Quaternion()));
          clav.quaternion.copy(clav.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));clav.updateWorldMatrix(false,true);};
        // 손 관절이 아니라 주먹(손바닥)을 손잡이에 — 다시 리깅한 몸은 손 관절이 손목 쪽이라 관절을 대면 13~29 cm 떴다.
        // 끝점을 «손에 붙은 점»으로 두고 풀어야 팔을 돌려 손 방향이 바뀌어도 그 점이 닿는다(관절+오프셋 되풀이로는 17 cm 남았다).
        /* 쥔 손(gripAxis 있음): 주먹 위치 + 주먹 방향을 함께 푼다 — solveLeftGrip. 없으면 주먹 점만 CCD. */
        const gAxis=left.userData.gripAxis;diagnostics.gripAngle=0;diagnostics.gripTwist=0;diagnostics.gripBend=0;
        let hold2=hold;
        /* 두 주먹 떼기: 잡기 시작·놓기 도중(세기 < 1)엔 관절을 섞으므로 왼주먹이 호를 그리며 오른주먹을 지나간다 —
           세기 .95~.98 에서 손잡이 위 9.6~10.4 cm(주먹 폭 10.8)까지 겹쳤다. 주먹을 공(지름 11 cm, 「근거 없음」)으로 보고
           두 중심이 11 cm 안이면 칼날 쪽(앞)에 있을 땐 손잡이 방향으로 hand2[0] 까지, 폼멜 쪽(뒤)에 있을 땐 오른주먹에서 곧장 멀어지게 민다
           — 뒤에 있는 주먹을 앞으로 밀면 오른주먹을 뚫고 18 cm 튀었다 (docs/design/96) */
        const FIST=.11;
        const separateFists=()=>{const h2=slot.userData.hand2;if(!h2)return;
          const p=slot.getWorldPosition(new THREE.Vector3()),ax=new THREE.Vector3(0,1,0).applyQuaternion(slot.getWorldQuaternion(new THREE.Quaternion()));
          const f=palmWorld(),d=f.clone().sub(p),along=d.dot(ax);
          if(d.length()>=FIST||along>=h2[0])return;
          /* 앞·뒤 두 목표를 축 위치로 섞는다(±3 cm) — 한 프레임에 갈래가 바뀌면 13 cm 튀었다 */
          const back=f.clone().addScaledVector(d.clone().normalize(),FIST-d.length()),front=f.clone().addScaledVector(ax,h2[0]-along);
          solveLimbPoint(upper,lower,palmWorld,back.lerp(front,THREE.MathUtils.smoothstep(along,-.03,.03)),1);
          /* 팔이 모자라 못 밀면(잡기 시작엔 쇄골·오른손 당김도 세기만큼만 들어가 있다) 손잡이 옆으로 비켜 둔다 */
          const g=palmWorld(),e=g.clone().sub(p),al=e.dot(ax);if(e.length()>=FIST-.002||al>=h2[0]-.005)return;
          const side=e.clone().addScaledVector(ax,-al),rd=side.length();if(rd<1e-4)side.set(1,0,0).cross(ax);
          const want=Math.sqrt(Math.max(0,FIST*FIST-al*al));
          solveLimbPoint(upper,lower,palmWorld,g.addScaledVector(side.normalize(),want-rd),1);};
        if(hold>0&&gAxis){let plan=planLeftGrip(upper,lower,left,slot,target);
          /* 주먹 방향이 손목 각을 정해 팔이 모자랄 수 있다. 사람처럼 먼저 왼어깨(쇄골)를 내밀고(최대 31°),
             그래도 모자라면 오른손을 더 당겨(합 PULL_MAX) 다시 푼다. 공격1·2 접점은 몸통 비틀기가 왼어깨를 3~6 cm 멀리 보내
             모자란 만큼 왼주먹이 오른주먹 쪽으로 밀려 겹쳤다 (docs/design/96) */
          for(let k=0;k<4&&plan.resid>.002;k++){
            if(clavUsed<CLAV_MAX)reachClavicle(plan.resid+.01);else if(pulled<PULL_MAX)pullRight(plan.resid+.02);else break;
            plan=planLeftGrip(upper,lower,left,slot,target);}
          /* 주먹 방향까지 맞추면 2~6 cm 넘게 못 닿는 자세는 두 손 잡기를 푼다(오른손 주먹과 겹치거나 허공을 쥐지 않게) */
          /* 놓기·잡기는 켜고 끄기(0.8 cm 넘게 모자라면 놓고 0.4 cm 안이면 다시 잡는다) — 모자란 만큼 왼주먹이 오른주먹 쪽으로 밀려 겹친다(주먹 폭 10.8 cm).
             중간 세기로 멈추면 왼손이 손잡이 옆 허공에 떴다 */
          if(reachOK&&plan.resid>.008)reachOK=false;else if(!reachOK&&plan.resid<.004)reachOK=true;
          const want=reachOK?hold:0;diagnostics.gripResid=plan.resid;diagnostics.gripPull=pulled;diagnostics.gripClav=clavUsed;
          /* 두 손 잡기 세기는 시간으로 따라간다(초당 10) — 행동 시작에 왼손이 손잡이로 «튀지» 않고 미끄러져 잡고,
             한 손으로 내뻗는 순간(카인 공격1·3 접점, 오른팔 68 cm)엔 부드럽게 놓는다 */
          twoHandS+=(want-twoHandS)*Math.min(1,(dt||1/60)*10);if(Math.abs(want-twoHandS)<.01)twoHandS=want;
          hold2=twoHandS;gripWant=hold2;
          /* 오른손 당김·왼쇄골 내밀기도 두 손 잡기 세기만큼만 — 놓았는데 대검이 25 cm 몸 쪽에 남아 있었다(강철 회전) */
          if(hold2<1){for(const n of ['RightArm','RightForeArm','RightHand','LeftShoulder']){const b=bones[n],q0=b&&restCorrections.get(b);if(q0)b.quaternion.copy(q0.clone().slerp(b.quaternion,hold2));}
            model.updateWorldMatrix(true,true);target=gripTarget();}
          if(hold2>0){applyLeftGrip(upper,lower,left,target,plan,hold2);separateFists();}}
        else if(hold>0)solveLimbPoint(upper,lower,palmWorld,target,hold);
        diagnostics.gripError=hold2>0?palmWorld().distanceTo(target):0;diagnostics.twoHand=hold2;
      }
    }else{diagnostics.gripError=0;diagnostics.twoHand=0;twoHandS=0;reachOK=true;}
    if(handGrip&&twoHand){leftGrip+=(gripWant-leftGrip)*Math.min(1,(dt||1/60)*14);if(Math.abs(gripWant-leftGrip)<.01)leftGrip=gripWant;handGrip.set('Left',leftGrip);}
    // Flat training ground: preserve authored footfall height; anchor grounded feet during stationary actions.
    diagnostics.footError=0;
    for(const side of ['Left','Right']){
      const foot=bones[side+'Foot'];if(!foot)continue;
      const p=foot.getWorldPosition(new THREE.Vector3());
      if(moving||!a){delete anchors[side];continue;}
      const key=a.id;
      if(!anchors[side]||anchors[side].id!==key)anchors[side]={id:key,pos:p.clone()};
      const anchor=anchors[side].pos;
      if(p.y>anchor.y+0.10){delete anchors[side];continue;}
      keep([side+'UpLeg',side+'Leg',side+'Foot']);
      const err=solveLimb(bones[side+'UpLeg'],bones[side+'Leg'],foot,anchor,0.85);
      diagnostics.footError=Math.max(diagnostics.footError,err);
    }
  }
  return {restore,apply,bones,diagnostics};
}
