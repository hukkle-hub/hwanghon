import * as T from '../vendor/three/three.module.js';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
// A source-pose pole and exact two-bone IK. Unlike the legacy neutral-wrist
// circle, this accepts the full mocap swing without changing limb lengths.
// Rotation around the shaft is chosen to minimise wrist bend, not to make a
// mathematically valid elbow disappear inside the ribs.
export function planMocapGrip(source,palm,axis,offset,scale,previous=null,dt=1/60){
 const S=source.shoulder,A=S.distanceTo(source.elbow),B=source.elbow.distanceTo(source.wrist);
 const origin=previous?.handQ||source.handQ;
 const spread=V().set(0,0,1).applyQuaternion(origin),base=Q().setFromUnitVectors(spread,axis).multiply(origin);
 const limit=Math.max(0,dt)*8;
 const rolls=previous?[-limit,-limit*.5,0,limit*.5,limit]:Array.from({length:24},(_,k)=>k*Math.PI/12);
 let best=null;
 for(const roll of rolls){
  const handQ=Q().setFromAxisAngle(axis,roll).multiply(base);
  const wrist=palm.clone().sub(offset.clone().multiplyScalar(scale).applyQuaternion(handQ));
  const d=wrist.clone().sub(S),distance=d.length(),dir=d.clone().normalize();
  if(distance<1e-6)continue;
  const actual=T.MathUtils.clamp(distance,Math.abs(A-B)+.001,A+B-.001),residual=Math.abs(actual-distance);
  const pole=source.elbow.clone().sub(S);pole.addScaledVector(dir,-pole.dot(dir));
  if(pole.lengthSq()<1e-8)pole.set(0,-1,0).addScaledVector(dir,dir.y);
  pole.normalize();
  const sourcePole=pole.clone(),oldPole=previous?.pole?.clone().addScaledVector(dir,-previous.pole.dot(dir)).normalize();
  const c=T.MathUtils.clamp((A*A+actual*actual-B*B)/(2*A*actual),-1,1);
  for(const turn of [-Math.PI,-2.5,-2,-1.5,-1,-.5,0,.5,1,1.5,2,2.5,Math.PI]){
  const candidate=sourcePole.clone().applyAxisAngle(dir,turn);
  if(oldPole){const angle=oldPole.angleTo(candidate);if(angle>0)candidate.copy(oldPole.clone().applyQuaternion(Q().setFromUnitVectors(oldPole,candidate).slerp(Q(),1-Math.min(1,Math.max(0,dt)*8/angle))));}
  const elbow=S.clone().addScaledVector(dir,A*c).addScaledVector(candidate,A*Math.sqrt(1-c*c));
  const end=S.clone().addScaledVector(dir,actual),fore=end.clone().sub(elbow).normalize(),fingers=V().set(0,1,0).applyQuaternion(handQ);
  const bend=fore.angleTo(fingers),coherence=previous?previous.handQ.angleTo(handQ):source.handQ.angleTo(handQ);
  let penetration=0;if(source.bodyTop){const axis=source.bodyTop.clone().sub(source.bodyBottom),t=T.MathUtils.clamp(elbow.clone().sub(source.bodyBottom).dot(axis)/axis.lengthSq(),0,1),near=source.bodyBottom.clone().addScaledVector(axis,t);penetration=Math.max(0,source.bodyRadius-elbow.distanceTo(near));}
  const cost=residual*residual*1e5+bend*bend*8+Math.max(0,bend-.6)**2*30+coherence*coherence*.3+candidate.angleTo(sourcePole)**2*.15+penetration*penetration*1e4;
  if(!best||cost<best.cost)best={cost,handQ,wrist:end,elbow,residual,bend,pole:candidate};
  }
 }
 return best;
}
