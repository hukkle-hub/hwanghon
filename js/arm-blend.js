/* 팔 뼈 «제자리 돌기» 막기 (docs/design/99).
 *
 * 카인의 굽는 단계 공격 클립(1·2·3타·스매시·처형·궁극기)은 위팔·아래팔이 뼈 축 둘레로 대기와 100~150° 달리 돌아 있고,
 * 클립 안에서도 키 사이에 그만큼 뒤집힌다(굽는 IK 가 손은 맞추고 팔 비틀림은 키마다 따로 골랐다, docs/design/97).
 * 게임이 동작을 0.085~0.26 초에 섞거나 두 손 잡기가 손목을 맞추는 동안 아래팔이 한 프레임 60~170° 씩 제자리에서 돌았다
 * (자연 클립은 16° 안) — «대기↔공격 넘어갈 때 팔 도는 것».
 *
 * 뼈 자리(어깨·팔꿈치·손목)와 손 방향(대검·두 손 잡기)은 그대로 두고, 위팔·아래팔이 «자기 축 둘레로» 도는 빠르기만 묶는다.
 * 넘친 몫은 다음 관절(팔꿈치·손목)이 잠깐 비틀려 흡수하고 몇 프레임에 걸쳐 따라잡는다.
 * 그 비틀림이 JOINT_MAX 를 넘으면(클립이 원래 더 비틀어 둔 만큼은 괜찮다) 최대 3 배 빨리 따라잡는다 — 살이 꼬여 늘어나지 않게.
 * 앞 프레임과의 비교는 가슴(Spine2) 기준 — 몸이 돌거나 달려도 팔 돌기로 세지 않는다.
 * 호출 순서(게임): restore() → mixer.update → (두 손 보정 rig.apply) → apply(dt) */
import * as THREE from '../vendor/three/three.module.js';

export const ROLL_RATE=12.6;        /* rad/s = 한 프레임(60 fps) 12°. 「근거 없음」 — 전문가 클립(대기·달리기·Meshy) 최대 16°/프레임 안쪽 */
export const JOINT_MAX=Math.PI/2;   /* 묶기가 팔꿈치·손목에 남겨도 되는 비틀림(바인드 대비). 「근거 없음」 — 확대 렌더로 확인 */
const BOOST=[1,1.5,2,3];            /* 관절이 JOINT_MAX 를 넘을 때 올리는 빠르기 배수 */
const CHAINS=[['LeftArm','LeftForeArm','LeftHand'],['RightArm','RightForeArm','RightHand']];
const Q=()=>new THREE.Quaternion(),V=()=>new THREE.Vector3();
/* 쉬는 자세 대비 ax 둘레 비틀림 각(-π..π) */
const twistOf=(q,rest,ax)=>{const r=rest.clone().invert().multiply(q),p=V().set(r.x,r.y,r.z);let a=2*Math.atan2(p.dot(ax),r.w);
  while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};

export function createArmBlend(model,opts={}){
  const rate=opts.rate||ROLL_RATE;
  const B={}; model.traverse(o=>{ if(o.isBone) B[o.name.replace(/^mixamorig:?/,'')]=o; });
  const chest=B.Spine2||B.Spine1||B.Spine;
  const links=[];
  for(const names of CHAINS){ const bs=names.map(n=>B[n]); if(!chest||bs.some(b=>!b)) continue;
    for(let i=0;i<2;i++){ const bone=bs[i],child=bs[i+1],ax=child.position.clone().normalize();
      const m=V().set(1,0,0); if(Math.abs(ax.x)>.8) m.set(0,0,1); m.addScaledVector(ax,-m.dot(ax)).normalize();
      links.push({bone,child,ax,m,rest:child.quaternion.clone(),prev:null}); } }
  const saved=new Map(), diagnostics={clamped:0,maxRoll:0,boosted:0};
  /* 믹서는 값이 바뀐 뼈만 다시 쓴다 — 고친 값이 다음 프레임에 남지 않게 믹서보다 먼저 되돌린다 */
  function restore(){ for(const [b,q] of saved) b.quaternion.copy(q); saved.clear(); }
  function reset(){ for(const l of links) l.prev=null; }
  function apply(dt=1/60){
    if(!links.length) return 0;
    model.updateMatrixWorld(true);
    const cq=chest.getWorldQuaternion(Q()),ci=cq.clone().invert(),lim=rate*Math.min(dt,.05);
    diagnostics.clamped=0; diagnostics.maxRoll=0;
    for(const l of links){
      const wq=l.bone.getWorldQuaternion(Q()),A=l.ax.clone().applyQuaternion(wq),M=l.m.clone().applyQuaternion(wq);
      if(l.prev){ const p=l.prev.clone().applyQuaternion(cq); p.addScaledVector(A,-p.dot(A));
        if(p.lengthSq()>1e-8){ p.normalize();
          const d=Math.atan2(V().crossVectors(p,M).dot(A),p.dot(M)); diagnostics.maxRoll=Math.max(diagnostics.maxRoll,Math.abs(d));
          if(Math.abs(d)>lim){
            const childW=l.child.getWorldQuaternion(Q()),pw=l.bone.parent.getWorldQuaternion(Q()).invert();
            const allow=Math.max(JOINT_MAX,Math.abs(twistOf(l.child.quaternion,l.rest,l.ax)));
            for(const b of [l.bone,l.child]) if(!saved.has(b)) saved.set(b,b.quaternion.clone());
            let fix=null;
            for(const k of BOOST){ fix=Q().setFromAxisAngle(A,THREE.MathUtils.clamp(d,-lim*k,lim*k)-d); const nw=fix.clone().multiply(wq);
              l.bone.quaternion.copy(pw.clone().multiply(nw)); l.child.quaternion.copy(nw.clone().invert().multiply(childW));
              if(Math.abs(twistOf(l.child.quaternion,l.rest,l.ax))<=allow){ if(k>1) diagnostics.boosted++; break; } }
            l.bone.updateMatrixWorld(true);
            M.applyQuaternion(fix); diagnostics.clamped++; } } }
      l.prev=M.applyQuaternion(ci); }
    return diagnostics.clamped; }
  return {apply,restore,reset,diagnostics};
}
