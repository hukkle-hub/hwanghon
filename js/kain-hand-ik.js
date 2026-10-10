import * as T from '../vendor/three/three.module.js';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
// Standard two-bone target + elbow hint. Unlike the rejected neutral-wrist
// circle, this allows physiological wrist flexion without routing an arm
// through the torso merely to make the wrist angle exactly zero.
export function solveKainHand(ar,palm,axis,normal,cal,scale,bindHand,body,previous,dt=1/60){
 const base=previous?Q().setFromUnitVectors(cal.gripAxis.clone().applyQuaternion(previous.handQ).normalize(),axis).multiply(previous.handQ).normalize():Q().setFromRotationMatrix(new T.Matrix4().makeBasis(axis,normal,axis.clone().cross(normal))).multiply(cal.frame.clone().invert()).normalize();
 const hint=ar.outward.clone().add(V().set(0,-.4,0)).addScaledVector(body.forward,.2).normalize(),foreLocal=ar.foreLocal;
 let best;
 function candidate(roll,poleAngle){
  const handQ=Q().setFromAxisAngle(axis,roll).multiply(base).normalize(),desired=palm.clone().sub(cal.offset.clone().multiplyScalar(scale).applyQuaternion(handQ)),delta=desired.clone().sub(ar.shoulder),distance=delta.length(),dir=delta.clone().normalize();
  const poleRef=previous?previous.elbow.clone().sub(ar.shoulder):hint.clone();
  const d=T.MathUtils.clamp(distance,Math.abs(ar.upper-ar.lower)+.002,ar.upper+ar.lower-.003),c=T.MathUtils.clamp((ar.upper*ar.upper+d*d-ar.lower*ar.lower)/(2*ar.upper*d),-1,1),pole=poleRef.addScaledVector(dir,-poleRef.dot(dir)).normalize().applyAxisAngle(dir,poleAngle);
  const elbow=ar.shoulder.clone().addScaledVector(dir,ar.upper*c).addScaledVector(pole,ar.upper*Math.sqrt(1-c*c)),wrist=ar.shoulder.clone().addScaledVector(dir,d),fore=wrist.clone().sub(elbow).normalize();
  const neutral=handQ.clone().multiply(bindHand.clone().invert()),lowerQ=Q().setFromUnitVectors(foreLocal.clone().applyQuaternion(neutral).normalize(),fore).multiply(neutral).normalize(),bend=lowerQ.clone().invert().multiply(handQ).normalize().angleTo(bindHand);
  let clearance=Infinity,clearNormal=V();for(let j=0;j<=8;j++){const p=elbow.clone().lerp(wrist,j/8),u=T.MathUtils.clamp(p.clone().sub(body.base).dot(body.axis)/body.axis.lengthSq(),0,1),normal=p.clone().sub(body.base.clone().addScaledVector(body.axis,u)),d=normal.length();if(d<clearance){clearance=d;clearNormal.copy(normal).normalize();}}
  const uy=elbow.clone().sub(ar.shoulder).normalize(),uz=uy.clone().cross(fore).normalize(),ux=uy.clone().cross(uz).normalize(),upperQ=Q().setFromRotationMatrix(new T.Matrix4().makeBasis(ux,uy,uz)).multiply(ar.hingeBasis),relative=ar.bindLower.clone().invert().multiply(upperQ.clone().invert().multiply(lowerQ));let twist=2*Math.atan2(relative.y,relative.w);twist=Math.abs(Math.atan2(Math.sin(twist),Math.cos(twist)));
  const residual=Math.abs(distance-d),continuity=previous?previous.handQ.angleTo(handQ):0,lowerContinuity=previous?previous.lowerQ.angleTo(lowerQ):0,cost=residual*residual*1e6+Math.max(0,.205-clearance)**2*1e6+bend*bend*50+Math.max(0,bend-.45)**2*1e5+twist*twist*3+Math.max(0,twist-1.5)**2*200+continuity*continuity+lowerContinuity*lowerContinuity+.05*(1-Math.cos(poleAngle));
  const result={cost,roll,poleAngle,handQ,lowerQ,wrist,desired,elbow,bend,twist,clearance,clearNormal,residual};if(!best||cost<best.cost)best=result;
 }
 const limit=Math.max(.001,dt*16);
 if(ar.baked){candidate(0,0);return best;}
 if(previous){for(const r of [-limit,-limit*.5,0,limit*.5,limit])for(const p of [-limit,0,limit])candidate(r,p);}
 else for(let i=0;i<24;i++)for(let j=0;j<12;j++)candidate(i*Math.PI/12,j*Math.PI/6);
 for(let step=previous?limit/4:Math.PI/24;step>.001;step*=.5){const r=best.roll,p=best.poleAngle;candidate(r-step,p);candidate(r+step,p);candidate(r,p-step);candidate(r,p+step);}
 return best;
}
