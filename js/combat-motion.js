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

// opts.twoHand=false: 한손·쌍수 무기(류 단검·세라 시약) — 왼손을 오른손 무기로 끌어오지 않는다 (docs/design/93)
// opts.handGrip: 쥔 손 모프(js/hand-grip.js) — 양손 그립 동안 왼손을 쥔다 (docs/design/94)
export function makeRigAdapter(model,root,slot,opts={}) {
  const twoHand=opts.twoHand!==false, handGrip=opts.handGrip||null;let leftGrip=handGrip?handGrip.amount.Left:0;
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
        const hold=1-THREE.MathUtils.smoothstep(excess-0.22,0.03,0.09);gripWant=hold;
        // Bring an overextended weapon hand inward without changing its world orientation.
        if(hold>0&&excess>0){
          keep(['RightArm','RightForeArm','RightHand']);
          const handQ=right.getWorldQuaternion(new THREE.Quaternion());
          const pull=shoulder.clone().sub(target).setLength(Math.min(0.22,excess+0.02));
          solveLimb(bones.RightArm,bones.RightForeArm,right,right.getWorldPosition(new THREE.Vector3()).add(pull));
          right.quaternion.copy(right.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(handQ));
          model.updateWorldMatrix(true,true);target=gripTarget();
        }
        // 손 관절이 아니라 주먹(손바닥)을 손잡이에 — 다시 리깅한 몸은 손 관절이 손목 쪽이라 관절을 대면 13~29 cm 떴다.
        // 끝점을 «손에 붙은 점»으로 두고 풀어야 팔을 돌려 손 방향이 바뀌어도 그 점이 닿는다(관절+오프셋 되풀이로는 17 cm 남았다).
        if(hold>0)solveLimbPoint(upper,lower,palmWorld,target,hold);
        diagnostics.gripError=hold>0?palmWorld().distanceTo(target):0;diagnostics.twoHand=hold;
      }
    }else{diagnostics.gripError=0;diagnostics.twoHand=0;}
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
