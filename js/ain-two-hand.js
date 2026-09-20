import * as T from '../vendor/three/three.module.js';
import {makeRigAdapter} from './combat-motion.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const Q=()=>new T.Quaternion();
function worldQ(b,q){b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert().multiply(q));b.updateWorldMatrix(false,true);}
function aim(b,end,target){
 const p=b.getWorldPosition(V()),from=end.getWorldPosition(V()).sub(p).normalize(),to=target.clone().sub(p).normalize();
 worldQ(b,new T.Quaternion().setFromUnitVectors(from,to).multiply(b.getWorldQuaternion(Q())));
}
function solve(upper,lower,hand,target,pole){
 const s=upper.getWorldPosition(V()),e=lower.getWorldPosition(V()),h=hand.getWorldPosition(V());
 const a=s.distanceTo(e),b=e.distanceTo(h),dir=target.clone().sub(s),d=T.MathUtils.clamp(dir.length(),Math.abs(a-b)+.01,(a+b)*.97);dir.normalize();
 const bend=pole.clone().addScaledVector(dir,-pole.dot(dir)).normalize();
 const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
 aim(upper,lower,s.clone().addScaledVector(dir,along).addScaledVector(bend,height));
 aim(lower,hand,s.clone().addScaledVector(dir,d));
}
const ready=[0,-.12,.32,-.35,.92,.18];
const slash=[[0,ready],[.23,[-.12,-.08,.28,-.72,.58,-.35]],[.42,[0,-.12,.40,-.15,.15,.98]],[.65,[.10,-.15,.32,.90,.22,.35]],[1,ready]];
const chop=[[0,ready],[.20,[0,.12,.27,-.2,.95,-.22]],[.42,[0,-.1,.40,-.15,-.45,.88]],[.65,[0,-.22,.37,-.2,-.5,.84]],[1,ready]];
const thrust=[[0,ready],[.24,[-.08,-.13,.22,-.3,.15,.94]],[.42,[0,-.08,.48,-.2,.1,.98]],[.62,[0,-.12,.28,-.3,.3,.9]],[1,ready]];
function path(keys,t){
 let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
 const [t0,a]=keys[i],[t1,b]=keys[i+1],u=T.MathUtils.smootherstep(t,t0,t1);
 return a.map((v,j)=>T.MathUtils.lerp(v,b[j],u));
}
function pathRotation(keys,t){
 // Interpolate complete orientations. Reconstructing a rotation from a
 // normalized direction each frame amplifies roll near a direction reversal.
 let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
 const [t0,a]=keys[i],[t1,b]=keys[i+1],u=T.MathUtils.smootherstep(t,t0,t1);
 return Q().setFromUnitVectors(V(0,1,0),V(...a.slice(3)).normalize()).slerp(Q().setFromUnitVectors(V(0,1,0),V(...b.slice(3)).normalize()),u);
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
 function apply(a,moving,guard,dt,poseName='idle'){
  if(!slot)return;
  model.updateWorldMatrix(true,true);
  const active=!/death|hit|roll|dodge|pickup|cheer/.test(a?.clip||poseName);
  gripAmount=dt>0?T.MathUtils.lerp(gripAmount,active?1:0,1-Math.exp(-Math.min(dt,.05)*24)):(active?1:0);
  for(const m of gripMeshes)m.morphTargetInfluences.fill(gripAmount);
  if(!active){finishPose(false,dt);diagnostics.gripError=0;diagnostics.rightGripError=0;return;}
  const frame=torso.getWorldQuaternion(Q()).multiply(restTorso.clone().invert());
  const name=a?.clip||a?.id||'guard';
  let t=a?T.MathUtils.clamp(a.elapsed/a.duration,0,1):0;
  // Contact remains at the existing combat hit timestamp, not a new timer.
  if(a&&Number.isFinite(a.hitAt)&&a.hitAt>0&&a.hitAt<a.duration)t=a.elapsed<=a.hitAt?.42*a.elapsed/a.hitAt:.42+.58*(a.elapsed-a.hitAt)/(a.duration-a.hitAt);
  const keys=/attack2|smash|exec/.test(name)?chop:/attack3|counter/.test(name)?thrust:slash;
  const spec=path(keys,t),weaponQ=pathRotation(keys,t);
  const center=bones.LeftArm.getWorldPosition(V()).add(bones.RightArm.getWorldPosition(V())).multiplyScalar(.5).add(V(...spec.slice(0,3)).multiplyScalar(scale).applyQuaternion(frame));
  const shaftQ=frame.clone().multiply(weaponQ);
  const axis=V(0,1,0).applyQuaternion(shaftQ),poles={Left:V(.8,-.65,-.25).applyQuaternion(frame),Right:V(-.8,-.65,-.25).applyQuaternion(frame)};
  const palms={Right:center.clone().addScaledVector(axis,.16*scale),Left:center.clone().addScaledVector(axis,-.16*scale)};
  for(const side of ['Left','Right'])for(const part of ['Arm','ForeArm','Hand']){const b=bones[side+part];keep(b);b.quaternion.copy(bind.get(side+part));}
  model.updateWorldMatrix(true,true);
  // Translate the WHOLE shaft into the intersection of both reachable palm
  // spheres. Never fix reach by stretching a limb or detaching the other hand.
  for(let pass=0;pass<6;pass++)for(const side of ['Right','Left']){
   const s=bones[side+'Arm'].getWorldPosition(V()),e=bones[side+'ForeArm'].getWorldPosition(V()),h=bones[side+'Hand'].getWorldPosition(V());
   const max=(s.distanceTo(e)+e.distanceTo(h))*.82,d=palms[side].clone().sub(s);
   if(d.length()>max){const shift=d.clone().setLength(max).sub(d);palms.Right.add(shift);palms.Left.add(shift);}
  }
  for(const side of ['Right','Left']){
   const upper=bones[side+'Arm'],lower=bones[side+'ForeArm'],hand=bones[side+'Hand'];
   let target=palms[side].clone().add(V(0,.05,-.02).multiplyScalar(scale).applyQuaternion(frame));
   for(let i=0;i<8;i++){
    // Reset before each solve prevents accumulating axial twist.
    upper.quaternion.copy(bind.get(side+'Arm'));lower.quaternion.copy(bind.get(side+'ForeArm'));hand.quaternion.copy(bind.get(side+'Hand'));upper.updateWorldMatrix(false,true);
    solve(upper,lower,hand,target,poles[side]);
    // Preserve the neutral wrist until a grip authoring pass can satisfy both
    // anatomical limits and finger contact. Shaft-only alignment hyperextends
    // this asset's wrists and is intentionally not enabled.
    const handQ=lower.getWorldQuaternion(Q()).multiply(bind.get(side+'Hand'));
    worldQ(hand,handQ);
    target=palms[side].clone().sub(offsets[side].clone().multiplyScalar(scale).applyQuaternion(handQ));
   }
  }
  keep(slot);slot.position.copy(offsets.Right);
  worldQ(slot,frame.clone().multiply(weaponQ));
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
  apply(a,moving,guard,dt,poseName){base.apply(a,moving,guard,dt);arms.apply(a,moving,guard,dt,poseName);arms.diagnostics.footError=base.diagnostics.footError;}
 };
}
