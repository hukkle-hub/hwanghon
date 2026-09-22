import * as T from '../vendor/three/three.module.js';
import {makeRigAdapter} from './combat-motion.js';
import {gripReachShift,solveGripCircle} from './ain-grip-ik.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const Q=()=>new T.Quaternion();
function worldQ(b,q){b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert().multiply(q));b.updateWorldMatrix(false,true);}
const ready=[0,-.12,.32,-.65,.75,.18];
// 평상시(전투 행동이 없을 때)의 «들고 다니는» 자세. ready 와 나누어 둔 이유는
// ready 가 모든 공격 경로의 시작·끝 키이기 때문이다 — 그걸 내리면 모든 휘두름의
// 예비와 여운이 같이 바뀐다. 큰 낫은 깃발처럼 세워 드는 물건이 아니라 자루를
// 잡고 날을 뒤로 늘어뜨려 끌고 다니는 물건이다. 자루 방향을 아래·뒤로 돌린다.
// 값은 재서 맞췄다 — 손잡이가 y=1.03, 날 길이 1.86 m 이므로 자루 y 성분이
// 높이를 정한다. 날 끝 y: -.86→-0.73(바닥 아래 73cm, 파묻힘) · -.45→-0.09 ·
// -.38→0.08 · -.34→0.17 · -.25→0.40(다시 뜬다). -.34 로 잡아 17 cm 를 남겼다 —
// 회전 기울기(최대 15°)가 날 끝을 24 cm 끌어내리므로 여유가 필요하다.
// scratch: scratchpad/carrysweep.mjs · docs/design/60-carry.md
export const AIN_CARRY=[.06,-.30,.10,-.34,-.34,-.88];
const slash=[[0,ready],[.20,[-.12,-.08,.28,-.8,.45,-.35]],[.42,[0,-.12,.30,-.75,.15,.65]],[.65,[.10,-.15,.30,-.90,.22,.35]],[1,ready]];
const chop=[[0,ready],[.20,[0,.12,.27,-.65,.75,-.22]],[.42,[0,-.1,.40,-.65,-.45,.6]],[.65,[0,-.22,.37,-.7,-.5,.5]],[1,ready]];
const thrust=[[0,ready],[.24,[-.08,-.13,.22,-.6,.15,.75]],[.42,[0,-.08,.48,-.6,.1,.75]],[.62,[0,-.12,.28,-.6,.3,.75]],[1,ready]];
// Distinct skill silhouettes; the negative-X shaft component keeps the two
// hands ordered instead of crossing through an elbow branch singularity.
export const AIN_SKILL_PATHS={
 skill1:[[0,ready],[.16,[-.13,.06,.27,-.8,.6,-.28]],[.42,[.25,.10,.25,-.35,.90,-.10]],[.70,[.15,-.20,.31,-.85,-.25,.3]],[1,ready]],
 /* 그림자 걸음 — 키 두 개가 «같은 값» 이라 낫이 한 자세에 멈춰 있었다(1.86 m).
    x 는 원본의 안정적인 −0.8 에 붙여 두고 y·z 만 흔든다. */
 skill2:[[0,ready],[.22,[-.02,-.18,.18,-.82,.30,-.16]],[.50,[-.06,-.22,.26,-.80,-.06,.30]],
   [.74,[-.02,-.14,.24,-.82,.22,.34]],[1,ready]],
 skill3:[[0,ready],[.16,[-.09,-.14,.29,-.95,.12,-.25]],[.42,[.25,.10,.25,-.35,.90,-.10]],[.80,[.10,-.16,.32,-.95,.12,.25]],[1,ready]],
 /* 결의 — 역시 멈춰 있었다(1.06 m). 앞으로 내밀었다가 크게 세운다. */
 skill4:[[0,ready],[.26,[.02,-.10,.30,-.50,.70,.36]],[.54,[.02,-.18,.32,-.52,.12,.52]],
   [.76,[.02,-.16,.30,-.52,.18,.50]],[.92,[-.02,.12,.16,-.46,.86,.12]],[1,ready]],
 ult:[[0,ready],[.20,[0,.15,.27,-.65,.75,-.22]],[.42,[.25,.10,.25,-.18,.98,-.10]],[.76,[0,-.22,.35,-.85,-.25,.40]],[1,ready]]
};
// Shaft block, short brace, then a distinct release. Perfect counters travel
// farther through the follow-through without changing authoritative timing.
export const AIN_RAISED_CONTACT={smash:[.25,-.05,.25,-.20,.90,.15],counter:[.25,.10,.25,-.35,.90,-.30]};
// 높은 부위(2.7 m 위)를 겨눌 때의 스킬1 접촉 자세. 손으로 맞춘 값이 아니라
// «재서» 찾은 값이다 — punch.py 로 skill1 타이밍을 고치자 옛 값이 클립과 어긋나
// 보정이 오히려 멀어지게 만들었다 (0.492 → 0.568, 반경 0.488). 좌표 하강으로
// 다시 찾았다. 상수로 빼 둔 건 그 탐색이 이 값을 바꿔 가며 재야 하기 때문이다.
// tools/3d 검수: scratchpad/highkey.mjs · docs/design/55-high-reach.md
export const AIN_HIGH_CONTACT={skill1:[.253,.767,.557,-.212,1.1,-.51]};
const counter=[[0,ready],[.16,[0,-.08,.31,-.98,.10,.12]],[.24,[0,-.08,.31,-.98,.10,.12]],[.42,[.06,-.13,.40,-.8,.12,.6]],[.70,[.13,-.18,.31,-.85,.1,.4]],[1,ready]];
const perfectCounter=counter.map(([t,p])=>[t,p.slice()]);
perfectCounter[4]=[.70,[.16,-.21,.32,-.8,-.18,.55]];
/* 키 사이를 어떻게 잇는가 — 여기가 「촐싹댄다」의 진짜 원인이었다.

   예전에는 «이웃한 두 키 사이» 를 각각 smootherstep 으로 이었다. smootherstep 은
   양 끝에서 «속도가 0» 이다. 그래서 무기가 **키마다 한 번씩 멈췄다가 다시
   가속**했다. 키가 5개면 스윙 한 번에 네 번 멈추는 셈이다.

   실측 (tools/3d/swing-measure.html 의 cond, 2차 차분 · 60 fps 환산):

       클립      손    자루    팔꿈치
       counter  153.7  298.2   128.3
       attack3   86.0  249.7    81.5
       attack1   80.6  236.0    66.8
       skill3    11.5   28.2    11.0

   **입력(자루)이 출력(팔꿈치)보다 거칠다.** 즉 IK 가 흔드는 게 아니라 오히려
   다듬고 있었다. 64·66·67번 문서에서 두 손 그립 IK 를 천장으로 지목했는데
   그건 틀렸다 — 재 보니 radial 0.13~0.25, |cos| 최대 0.95, 특이점 근처에
   간 적이 없다.

   고친 것: 키를 «지나가는» 3차 에르미트로 잇는다. 접선은 이웃 키의 시간차로
   잡고(Catmull-Rom), 양 끝만 0 으로 둔다 — 시작과 끝은 실제로 멈춰 있어야
   하니까. 키를 정확히 통과하므로 접점 자세는 그대로다. */
function tangents(keys,j){
 const n=keys.length;
 return keys.map((_,i)=>{
  if(i===0||i===n-1) return 0;                     /* 시작·끝은 정지 */
  const dt=keys[i+1][0]-keys[i-1][0];
  return dt>1e-6?(keys[i+1][1][j]-keys[i-1][1][j])/dt:0;
 });
}
function hermite(keys,t,j,tan){
 let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
 const t0=keys[i][0],t1=keys[i+1][0],h=t1-t0;
 if(h<=1e-6) return keys[i+1][1][j];
 const u=T.MathUtils.clamp((t-t0)/h,0,1),u2=u*u,u3=u2*u;
 const p0=keys[i][1][j],p1=keys[i+1][1][j],m0=tan[i]*h,m1=tan[i+1]*h;
 return (2*u3-3*u2+1)*p0+(u3-2*u2+u)*m0+(-2*u3+3*u2)*p1+(u3-u2)*m1;
}
function path(keys,t){
 const out=[];
 for(let j=0;j<keys[0][1].length;j++) out.push(hermite(keys,t,j,tangents(keys,j)));
 return out;
}
/* 휘두름 크기. 무기의 «움직임» 은 클립이 아니라 여기 적힌 키 경로가 만든다
   (아래 keys 선택부). 그래서 「스킬이 어깨 위에서 달랑달랑한다」의 원인은
   소스 클립이 아니라 이 경로가 작다는 것이다 — 클립을 갈아도 안 바뀐다.

   gain 은 «겨눔 자세(ready)에서 그 키까지의 각» 을 몇 배로 밀지다. 자루는
   방향이라 길이를 키워 봐야 소용없고, 대원 위에서 각을 더 밀어야 커진다.
   날이 1.861 m 이므로 각 1° 가 날 끝 3.2 cm 다.

   값은 손으로 고른 게 아니라 «재서» 골랐다 — tools/3d/swing-measure.html 로
   날 끝 경로를 재고, tests/ain-two-hand 의 손목·연속성 검사를 제약으로 뒀다.
   docs/design/67-swing-gain.md */
export const AIN_SWING_GAIN={
 /* 값은 «재서» 골랐다. 목표는 날 끝 경로를 늘리는 것, 제약은 두 가지다:
      · 날 끝이 바닥을 뚫으면 안 된다 (측정칸 «최저» ≥ 0)
      · tests/ain-two-hand 의 손목 한계·연속성 검사를 통과해야 한다
    접점 속도는 텐트 배율 덕에 모든 값에서 그대로 유지된다.

      클립      배율   날끝 경로        최저     왜
      attack1   1.30   12.74 → 13.0 m   1.08
      attack3   1.25    9.32 → 9.6 m    0.29
      skill3    1.35   16.97 → 18.1 m   0.51
      ult       1.25   12.79 → 13.4 m   0.27

    처음엔 1.35~1.50 으로 잡았다가 관절 튐이 8.54°/프레임 이 나서(문턱 8°)
    한 단계 내렸다 — 두 손 그립 IK 의 팔꿈치 특이점이 여기서도 천장이다.
      attack2     —    (안 건다)       −0.47     이미 날이 바닥을 뚫는다
      smash       —    (안 건다)       −0.06     위와 같음
      skill1      —    (안 건다)                 1.1 에서 경로가 «줄었다»
                                                 (ready 와 거의 반대인 키가 있어
                                                  회전축이 불안정 — 64번 문서 §3)
    attack2·smash 의 바닥 관통은 따로 고쳐야 한다. docs/design/67 §3 */
 attack1:1.30, attack3:1.25, skill3:1.35, ult:1.25
};
function amplify(dir,gain){
 if(!(gain>0)||Math.abs(gain-1)<1e-6) return dir;
 const base=V(...ready.slice(3)).normalize();
 const dot=T.MathUtils.clamp(base.dot(dir),-1,1), ang=Math.acos(dot);
 if(ang<1e-4) return dir;
 const axis=base.clone().cross(dir);
 if(axis.lengthSq()<1e-12) return dir;
 return base.clone().applyQuaternion(Q().setFromAxisAngle(axis.normalize(),ang*gain));
}
function pathRotation(keys,t,gain){
 /* 자루 방향도 같은 이유로 에르미트로 잇는다. 방향에서 회전을 «매 프레임
    새로 세우면» 방향이 뒤집히는 근처에서 롤이 튄다고 예전 주석이 경고했는데,
    그건 «각 키에서 독립적으로» 세울 때 얘기다. 여기서는 보간한 방향을
    한 번만 세우고, 그 방향 자체가 이제 C1 이라 튀지 않는다.
    실측으로 확인한다 (tests/ain-blade-direction · swing-measure 의 cond). */
 const tan=[0,1,2].map(k=>tangents(keys,3+k));
 const dir=V(hermite(keys,t,3,tan[0]),hermite(keys,t,4,tan[1]),hermite(keys,t,5,tan[2]));
 if(dir.lengthSq()<1e-9)dir.set(0,1,0);
 const swing=Q().setFromUnitVectors(V(0,1,0),dir.normalize());
 /* ⚠ 전 구간을 똑같이 키우면 «접점 자세» 까지 밀려서 오히려 나빠진다.
    실측: 균일 배율 1.6 에서 skill3 접점 날끝 15.4 → 8.8 m/s, skill1 9.5 → 7.0.
    크게 휘두르되 «맞는 순간은 그대로» 여야 한다. 그래서 접점(.42)에서는 배율
    1, 예비와 여운으로 갈수록 커지는 텐트 모양으로 건다. */
 return aimScytheBlade(amplify(V(0,1,0).applyQuaternion(swing), gainAt(t,gain)));
}
function gainAt(t,gain){
 if(!(gain>0)||Math.abs(gain-1)<1e-6) return 1;
 const d=t<=.42 ? (.42-t)/.42 : (t-.42)/.58;
 return 1+(gain-1)*T.MathUtils.smootherstep(d,0,1);
}
// The measured asset's blade extends along -X, not along the shaft (+Y).
// Specifying a shaft direction alone leaves its cutting plane unconstrained.
// Keep the hooked blade ahead of the torso, in the shaft/forward plane; this
// follows the whole-body turn and avoids presenting the blade's broad side.
export const AIM_DIAG={minSin:Infinity,reset(){this.minSin=Infinity;}};
export function aimScytheBlade(shaft,forward=V(0,0,1)){
 const y=shaft.clone().normalize(),blade=forward.clone().addScaledVector(y,-forward.dot(y));
 { const s=blade.length(); if(s<AIM_DIAG.minSin)AIM_DIAG.minSin=s; }
 if(blade.lengthSq()<1e-6)throw Error('Scythe shaft/forward singularity: author a non-collinear weapon pose');
 const x=blade.normalize().negate(),z=x.clone().cross(y).normalize();
 return Q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
}

// Two palm sockets + a common weapon path, solved from the bind pose. This does
// not chase the legacy wrist animation or use its discontinuous shoulder target.
export function makeAinTwoHand(model,root,slot){
 const bones={},saved=new Map(),bind=new Map(),restWorld=new Map(),gripMeshes=model.userData.ainBindRepair?.grips||[];model.updateWorldMatrix(true,true);
 model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.bones.forEach((b,i)=>restWorld.set(b,o.skeleton.boneInverses[i].clone().invert()));});
 model.traverse(o=>{if(o.isBone){const n=o.name.replace(/^mixamorig:?/,'');bones[n]=o;bind.set(n,o.quaternion.clone());}});
 for(const [n,b]of Object.entries(bones))if(restWorld.has(b)&&restWorld.has(b.parent))bind.set(n,Q().setFromRotationMatrix(restWorld.get(b.parent).clone().invert().multiply(restWorld.get(b))));
 const torso=bones.Spine2,restTorso=restWorld.has(torso)?Q().setFromRotationMatrix(restWorld.get(torso)):torso.getWorldQuaternion(Q());
 const scale=model.getWorldScale(V()).x,offsets={};
 for(const side of ['Left','Right'])offsets[side]=bones[side+'HandSlot']?.position.clone()||V(0,.055,-.025);
 const diagnostics={gripError:0,rightGripError:0,footError:0};
 let gripAmount=1;
 let carryAmount=1;
 let lastGripSlot=Q().setFromUnitVectors(V(0,1,0),V(0,0,-1));
 const transitionBones=['LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','RightHandSlot'].map(n=>bones[n]).filter(Boolean);
 let previousPose=null,lastActive=null,transition=null;
 function finishPose(active,dt){
  if(!(dt>0)){previousPose=null;lastActive=null;transition=null;return;}
  if(previousPose&&lastActive!==active)transition={from:previousPose,time:0};
  if(transition){
   transition.time+=Math.min(dt,.05);const w=T.MathUtils.smootherstep(transition.time,0,.12);
   for(const b of transitionBones){keep(b);b.quaternion.copy(transition.from.get(b).clone().slerp(b.quaternion,w));}
   if(w===1)transition=null;
   model.updateWorldMatrix(true,true);
  }
  previousPose=new Map(transitionBones.map(b=>[b,b.quaternion.clone()]));lastActive=active;
 }
 function keep(b){if(!saved.has(b))saved.set(b,{q:b.quaternion.clone(),p:b.position.clone()});}
 function restore(){for(const [b,s]of saved){b.quaternion.copy(s.q);b.position.copy(s.p);}saved.clear();for(const m of gripMeshes)m.morphTargetInfluences.fill(0);}
 function apply(a,moving,guard,dt,poseName='idle',target=null){
  if(!slot)return;
  model.updateWorldMatrix(true,true);
  const active=!/death|hit|roll|dodge|pickup|cheer/.test(a?.clip||poseName);
  gripAmount=dt>0?T.MathUtils.lerp(gripAmount,active?1:0,1-Math.exp(-Math.min(dt,.05)*24)):(active?1:0);
  for(const m of gripMeshes){m.morphTargetInfluences[0]=gripAmount;m.morphTargetInfluences[1]=1;}
  if(!active){
   // The left hand may release for rolls/hits, but the weapon remains in the
   // closed right hand. Authored slot tracks use the obsolete uncalibrated grip.
   keep(slot);slot.position.copy(offsets.Right);slot.quaternion.copy(lastGripSlot);
   finishPose(false,dt);model.updateWorldMatrix(true,true);diagnostics.gripError=0;diagnostics.rightGripError=0;return;
  }
  const frame=torso.getWorldQuaternion(Q()).multiply(restTorso.clone().invert());
  const name=a?.clip||a?.id||'guard';
  let t=a?T.MathUtils.clamp(a.elapsed/a.duration,0,1):0;
  // Contact remains at the existing combat hit timestamp, not a new timer.
  if(a&&Number.isFinite(a.hitAt)&&a.hitAt>0&&a.hitAt<a.duration)t=globalThis.TW_COMBAT_QUALITY.phase(a);
  // 전투 행동이 없으면(대기·걷기·달리기) «들고 다니는» 자세를 쓴다. 방어 중에는
 // 낫을 세워 막아야 하므로 ready 를 그대로 둔다. carryAmount 로 섞어 전투에
 // 들어가고 나올 때 낫이 «툭» 튀지 않게 한다.
 const carrying=!a&&!guard;
 // 들고 다니는 자세와 겨눔 자세는 자루 방향이 120° 넘게 벌어져 있다. 지수 감쇠로
 // 섞으면 «처음 몇 프레임» 에 그 각도의 큰 몫이 한꺼번에 들어가 관절이 튄다
 // (tests/ain-two-hand: 9.24°/프레임, 문턱 8°). 그래서 속도 자체를 제한한다.
 // 비대칭이다: 싸우러 들어갈 때는 빨리 세우고(0.18초), 끝나고 내릴 때는 천천히(0.45초).
 // 평타 접점이 0.30초라 올리는 쪽이 느리면 접점까지 반쯤 들린 채로 친다.
 { const span=carrying?.45:.18, want=carrying?1:0;
   if(dt>0){ const step=Math.min(dt,.05)/span, d=want-carryAmount;
             carryAmount+=Math.abs(d)<=step?d:(d>0?step:-step); }
   else carryAmount=want; }
 const keys=AIN_SKILL_PATHS[name]||(name==='counter'?(a?.opt?.perfect?perfectCounter:counter):/attack2|smash|exec/.test(name)?chop:/attack3/.test(name)?thrust:slash);
  let spec=path(keys,t),weaponQ=pathRotation(keys,t,AIN_SWING_GAIN[name]);
 if(carryAmount>1e-3){
  const c=AIN_CARRY;
  spec=spec.map((v,j)=>T.MathUtils.lerp(v,c[j],carryAmount));
  weaponQ=weaponQ.clone().slerp(aimScytheBlade(V(c[3],c[4],c[5]).normalize()),carryAmount);
 }
  if(target&&/^(attack[123]|smash|counter|exec)$/.test(name)){
   const local=root.worldToLocal(target.clone());
   const weight=T.MathUtils.smootherstep(local.y,2.0,2.30)*(1-T.MathUtils.smootherstep(local.y,2.85,3.25))
    *T.MathUtils.smootherstep(t,0,.30);
   // A raised cut for the actual selected chest/core, not the old waist-high
   // cut with a magically tall damage cone. Keep contact timing and palms.
   const raised=keys.filter(([phase])=>(phase<=.42||phase===1)&&!(name==='counter'&&phase===.24)).map(([phase,p])=>[phase,phase===.42?(AIN_RAISED_CONTACT[name]||[.25,.10,.25,-.35,.90,-.10]):p]);
   const lifted=path(raised,t);for(let i=0;i<3;i++)spec[i]=T.MathUtils.lerp(spec[i],lifted[i],weight);
   weaponQ.slerp(pathRotation(raised,t),weight);
  }
  if(target&&name==='skill1'){
   const local=root.worldToLocal(target.clone()),high=T.MathUtils.smootherstep(local.y,2.7,3.0)*(1-T.MathUtils.smootherstep(local.y,3.25,3.6))*(1-T.MathUtils.smootherstep(Math.hypot(local.x,local.z),1.5,2.2));
   if(high>0){
    // Raised hook strike: shaft leans back while the hook travels above the
    // hands. Both palms still use the common reach-constrained weapon pose.
    const highKeys=keys.filter(([phase])=>phase!==.16).map(([phase,p])=>[phase===.70?.86:phase,phase===.42?AIN_HIGH_CONTACT.skill1:p]);
    const highSpec=path(highKeys,t);for(let i=0;i<3;i++)spec[i]=T.MathUtils.lerp(spec[i],highSpec[i],high);
    weaponQ.slerp(pathRotation(highKeys,t),high);
   }
  }
  const center=bones.LeftArm.getWorldPosition(V()).add(bones.RightArm.getWorldPosition(V())).multiplyScalar(.5).add(V(...spec.slice(0,3)).multiplyScalar(scale).applyQuaternion(frame));
  // Nearby target adaptation is a bounded root-space translation, not wrist twist.
  // Fade in/out around contact so target selection cannot snap the idle pose.
  // The shared reach solver below still limits both arms together.
  if(target&&['skill1','skill3','ult','counter','smash','attack3'].includes(name)){
   // 언제 조준 보정을 켜는가. 기본은 «동작 초반부터 접점까지» 인데, 몸이 도는 기술은
   // 그러면 안 된다 — 도는 동안 어깨가 같이 돌기 때문에, 고정된 세계 좌표를 향해
   // 팔을 계속 끌면 팔꿈치 분기가 뒤집혀 한 프레임에 13.3° 튄다 (skill3Target).
   // 몸이 도는 둘(피의 회전·궁극기)은 «한 바퀴가 끝나 갈 무렵» 부터 조준한다.
   // [켜지기 시작, 다 켜짐, 꺼지기 시작, 다 꺼짐]. docs/design/55-high-reach.md
   const WIN=name==='skill3'?[.44,.58,.74,1]:name==='ult'?[.34,.50,.74,1]:[0,.32,.55,1];
   const local=root.worldToLocal(target.clone()),weight=T.MathUtils.smootherstep(t,WIN[0],WIN[1])*(1-T.MathUtils.smootherstep(t,WIN[2],WIN[3]))
    *T.MathUtils.smootherstep(local.y,1.9,2.1)*(1-T.MathUtils.smootherstep(local.y,2.7,2.95))*(1-T.MathUtils.smootherstep(Math.hypot(local.x,local.z),1.8,2.5));
   if(weight>0){
    const delta=local.clone().sub(name==='ult'?V(.08,2.49,.48):name==='counter'?V(-.28,2.4,.80):name==='attack3'?V(-.20,2.4,.65):V(-.16,2.4,.5));
    delta.x=T.MathUtils.clamp(delta.x,-.3,.3);delta.y=T.MathUtils.clamp(delta.y,-.20,.35);delta.z=T.MathUtils.clamp(delta.z,-.2,.3);
    if(name==='smash')delta.set(T.MathUtils.clamp(delta.x,-.08,.16),0,0);
    if(name==='counter')delta.set(T.MathUtils.clamp(delta.x,-.12,.22),0,T.MathUtils.clamp(delta.z,-.2,.1));
    if(name==='attack3')delta.set(T.MathUtils.clamp(delta.x,-.12,.12),0,T.MathUtils.clamp(delta.z,-.08,.1));
    /* 카운터의 조준 경사로를 넓혔다 (.28~.42 → .20~.50). 좁으면 그 짧은 구간에
       보정이 급히 들어와 팔꿈치가 8.27° 튄다 — 넓히면 5.33° 로 내려간다. */
    center.add(delta.multiplyScalar(weight*(['counter','attack3','smash'].includes(name)?T.MathUtils.smootherstep(t,name==='attack3'?.29:.20,.50):1)).applyQuaternion(root.getWorldQuaternion(Q())));
   }
  }
  const shaftQ=frame.clone().multiply(weaponQ);
  const axis=V(0,1,0).applyQuaternion(shaftQ);
  const palms={Right:center.clone().addScaledVector(axis,.16*scale),Left:center.clone().addScaledVector(axis,-.16*scale)};
  for(const side of ['Left','Right'])for(const part of ['Arm','ForeArm','Hand']){const b=bones[side+part];keep(b);b.quaternion.copy(bind.get(side+part));}
  model.updateWorldMatrix(true,true);
  const arms={};
  for(const side of ['Right','Left']){
   const upper=bones[side+'Arm'],lower=bones[side+'ForeArm'],hand=bones[side+'Hand'];
   const reach=offsets[side].clone().add(hand.position.clone().applyQuaternion(bind.get(side+'Hand').clone().invert()));
   arms[side]={shoulder:upper.getWorldPosition(V()),length:upper.getWorldPosition(V()).distanceTo(lower.getWorldPosition(V())),axis:axis.clone().multiplyScalar(side==='Left'?1:-1),reach:V(reach.z,reach.y,-reach.x)};
  }
  for(let pass=0;pass<16;pass++)for(const side of ['Right','Left']){
   const a=arms[side],shift=gripReachShift(a.shoulder,palms[side],a.axis,a.reach,scale,a.length);
   palms.Right.add(shift);palms.Left.add(shift);
  }
  for(const side of ['Right','Left']){
   const upper=bones[side+'Arm'],lower=bones[side+'ForeArm'],hand=bones[side+'Hand'];
   const a=arms[side],solution=solveGripCircle(a.shoulder,palms[side],a.axis,a.reach,scale,a.length,side==='Left'?1:-1);
   solution.rotation.multiply(Q().setFromAxisAngle(V(0,1,0),Math.PI/2));
   const wrist=palms[side].clone().sub(offsets[side].clone().multiplyScalar(scale).applyQuaternion(solution.rotation));
   const localY=lower.position.clone().normalize(),localZ=localY.clone().cross(hand.position.clone().applyQuaternion(bind.get(side+'ForeArm'))).normalize();
   const localX=localY.clone().cross(localZ).normalize();
   const worldY=solution.elbow.clone().sub(a.shoulder).normalize(),worldZ=worldY.clone().cross(wrist.clone().sub(solution.elbow)).normalize(),worldX=worldY.clone().cross(worldZ).normalize();
   const upperQ=Q().setFromRotationMatrix(new T.Matrix4().makeBasis(worldX,worldY,worldZ)).multiply(Q().setFromRotationMatrix(new T.Matrix4().makeBasis(localX,localY,localZ)).invert());
   worldQ(upper,upperQ);
   worldQ(lower,solution.rotation.clone().multiply(bind.get(side+'Hand').clone().invert()));
   worldQ(hand,solution.rotation);
  }
  keep(slot);slot.position.copy(offsets.Right);
  worldQ(slot,frame.clone().multiply(weaponQ));
  lastGripSlot.copy(slot.quaternion);
  finishPose(true,dt);
  model.updateWorldMatrix(true,true);
  const leftPalm=offsets.Left.clone().applyMatrix4(bones.LeftHand.matrixWorld),rightPalm=offsets.Right.clone().applyMatrix4(bones.RightHand.matrixWorld);
  diagnostics.gripError=leftPalm.distanceTo(slot.getWorldPosition(V()).addScaledVector(axis,-.32*scale));
  diagnostics.rightGripError=rightPalm.distanceTo(slot.getWorldPosition(V()));
 }
 return {bones,restore,apply,diagnostics};
}

export function makeAinRigAdapter(model,root,slot){
 const base=makeRigAdapter(model,root,null),arms=makeAinTwoHand(model,root,slot);
 return {bones:arms.bones,diagnostics:arms.diagnostics,
  restore(){arms.restore();base.restore();},
  apply(a,moving,guard,dt,poseName,target){base.apply(a,moving||a?.clip==='skill3',guard,dt);arms.apply(a,moving,guard,dt,poseName,target);arms.diagnostics.footError=base.diagnostics.footError;}
 };
}
