import * as T from '../vendor/three/three.module.js';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
const S={handQ:Q(),desired:V(),off:V(),delta:V(),dir:V(),poleRef:V(),elbow:V(),wrist:V(),fore:V(),neutral:Q(),bindInv:Q(),lowerQ:Q(),fl:V(),q2:Q(),clearNormal:V(),p:V(),t:V(),n:V(),b:V(),up:V(),e2:V(),uy:V(),uz:V(),ux:V(),upperQ:Q(),M:new T.Matrix4(),rel:Q(),upInv:Q()};   /* 후보 평가의 임시 객체 (§47) */
// Standard two-bone target + elbow hint. Unlike the rejected neutral-wrist
// circle, this allows physiological wrist flexion without routing an arm
// through the torso merely to make the wrist angle exactly zero.
export function solveKainHand(ar,palm,axis,normal,cal,scale,bindHand,body,previous,dt=1/60){
 const base=previous?Q().setFromUnitVectors(cal.gripAxis.clone().applyQuaternion(previous.handQ).normalize(),axis).multiply(previous.handQ).normalize():Q().setFromRotationMatrix(new T.Matrix4().makeBasis(axis,normal,axis.clone().cross(normal))).multiply(cal.frame.clone().invert()).normalize();
 const hint=ar.outward.clone().add(V().set(0,-.4,0)).addScaledVector(body.forward,.2).normalize(),foreLocal=ar.foreLocal;
 /* 할당 없는 후보 평가 (문서 229 §47) — 프레임마다 후보 수백 개 × 후보당 벡터·행렬 ~40 개를 새로 만들어 JS 시간의 29 % 가 쓰레기 수거였다.
    계산 순서는 그대로 두고 임시 객체만 재사용한다(예전 함수와 결과가 비트 단위로 같다 — tests/kain-hand-ik-alloc.test.mjs). 가장 좋은 후보만 이 풀이의 몫(B)에 복사한다 */
 let best=null;const B={cost:0,roll:0,poleAngle:0,handQ:Q(),lowerQ:Q(),wrist:V(),desired:V(),elbow:V(),bend:0,twist:0,clearance:0,upperClearance:0,elbowLift:0,clearNormal:V(),residual:0};
 const bindInv=S.bindInv.copy(bindHand).invert();
 function candidate(roll,poleAngle){
  const handQ=S.handQ.setFromAxisAngle(axis,roll).multiply(base).normalize(),desired=S.desired.copy(palm).sub(S.off.copy(cal.offset).multiplyScalar(scale).applyQuaternion(handQ)),delta=S.delta.copy(desired).sub(ar.shoulder),distance=delta.length(),dir=S.dir.copy(delta).normalize();
  const poleRef=previous?S.poleRef.copy(previous.elbow).sub(ar.shoulder):S.poleRef.copy(hint);
  const d=T.MathUtils.clamp(distance,Math.abs(ar.upper-ar.lower)+.002,ar.upper+ar.lower-(ar.reachMargin??.003)),c=T.MathUtils.clamp((ar.upper*ar.upper+d*d-ar.lower*ar.lower)/(2*ar.upper*d),-1,1),pole=poleRef.addScaledVector(dir,-poleRef.dot(dir)).normalize().applyAxisAngle(dir,poleAngle);
  const elbow=S.elbow.copy(ar.shoulder).addScaledVector(dir,ar.upper*c).addScaledVector(pole,ar.upper*Math.sqrt(1-c*c)),wrist=S.wrist.copy(ar.shoulder).addScaledVector(dir,d),fore=S.fore.copy(wrist).sub(elbow).normalize();
  const neutral=S.neutral.copy(handQ).multiply(bindInv),lowerQ=S.lowerQ.setFromUnitVectors(S.fl.copy(foreLocal).applyQuaternion(neutral).normalize(),fore).multiply(neutral).normalize(),bend=S.q2.copy(lowerQ).invert().multiply(handQ).normalize().angleTo(bindHand);
  let clearance=Infinity;const clearNormal=S.clearNormal.set(0,0,0);for(let j=0;j<=8;j++){const p=S.p.copy(elbow).lerp(wrist,j/8),u=T.MathUtils.clamp(S.t.copy(p).sub(body.base).dot(body.axis)/body.axis.lengthSq(),0,1),normal=S.n.copy(p).sub(S.b.copy(body.base).addScaledVector(body.axis,u)),d=normal.length();if(d<clearance){clearance=d;clearNormal.copy(normal).normalize();}}
  // Shoulder endpoints belong to the torso surface. Test the remaining upper
  // arm too: a clear forearm alone can still leave the biceps inside the chest.
  let upperClearance=Infinity;for(let j=2;j<=8;j++){const p=S.p.copy(ar.shoulder).lerp(elbow,j/8),u=T.MathUtils.clamp(S.t.copy(p).sub(body.base).dot(body.axis)/body.axis.lengthSq(),0,1);upperClearance=Math.min(upperClearance,p.distanceTo(S.b.copy(body.base).addScaledVector(body.axis,u)));}
  // Prefer lowered elbows when the hands are at/below shoulder height. Raised
  // hands still allow an overhead chamber; this is not a blanket elbow mirror.
  const up=S.up.copy(body.axis).normalize(),elbowLift=Math.sqrt(ar.lowerElbow||0)*Math.max(0,S.t.copy(elbow).sub(ar.shoulder).dot(up)+(ar.elbowDrop??.08)-Math.max(0,S.e2.copy(desired).sub(ar.shoulder).dot(up)));
  const uy=S.uy.copy(elbow).sub(ar.shoulder).normalize(),uz=S.uz.copy(uy).cross(fore).normalize(),ux=S.ux.copy(uy).cross(uz).normalize(),upperQ=S.upperQ.setFromRotationMatrix(S.M.makeBasis(ux,uy,uz)).multiply(ar.hingeBasis),relative=S.rel.copy(ar.bindLower).invert().multiply(S.upInv.copy(upperQ).invert().multiply(lowerQ));let twist=2*Math.atan2(relative.y,relative.w);twist=Math.abs(Math.atan2(Math.sin(twist),Math.cos(twist)));
  const residual=Math.abs(distance-d),continuity=previous?previous.handQ.angleTo(handQ):0,lowerContinuity=previous?previous.lowerQ.angleTo(lowerQ):0,cost=residual*residual*1e6+Math.max(0,(ar.foreClearance??.205)-clearance)**2*1e6+Math.max(0,(ar.upperClearance??.195)-upperClearance)**2*(ar.upperClearanceWeight??1e6)+elbowLift*elbowLift*200+bend*bend*50+Math.max(0,bend-.45)**2*1e7+twist*twist*3+Math.max(0,twist-1.5)**2*200+continuity*continuity+lowerContinuity*lowerContinuity+.05*(1-Math.cos(poleAngle));
  const boundedCost=cost+(ar.maxLowerAngularRate&&previous?Math.max(0,lowerContinuity-dt*ar.maxLowerAngularRate)**2*1e6:0);
  if(!best||boundedCost<best.cost-(ar.costTieEpsilon??0)){B.cost=boundedCost;B.roll=roll;B.poleAngle=poleAngle;B.handQ.copy(handQ);B.lowerQ.copy(lowerQ);B.wrist.copy(wrist);B.desired.copy(desired);B.elbow.copy(elbow);B.bend=bend;B.twist=twist;B.clearance=clearance;B.upperClearance=upperClearance;B.elbowLift=elbowLift;B.clearNormal.copy(clearNormal);B.residual=residual;best=B;}
 }
 const limit=Math.max(.001,dt*(ar.maxSolveAngularRate??16));
 if(ar.baked){candidate(0,0);return best;}
 if(previous&&!ar.searchFull){for(const r of [-limit,-limit*.5,0,limit*.5,limit])for(const p of [-limit,0,limit])candidate(r,p);}
 else for(let i=0;i<24;i++)for(let j=0;j<12;j++)candidate(i*Math.PI/12,j*Math.PI/6);
 for(let step=previous&&!ar.searchFull?limit/4:Math.PI/24;step>.001;step*=.5){const r=best.roll,p=best.poleAngle;candidate(r-step,p);candidate(r+step,p);candidate(r,p-step);candidate(r,p+step);}
 return best;
}
