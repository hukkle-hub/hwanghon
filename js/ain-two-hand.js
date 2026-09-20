import * as T from '../vendor/three/three.module.js';
import {makeRigAdapter} from './combat-motion.js';
import {gripReachShift,solveGripCircle} from './ain-grip-ik.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const Q=()=>new T.Quaternion();
function worldQ(b,q){b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert().multiply(q));b.updateWorldMatrix(false,true);}
const ready=[0,-.12,.32,-.65,.75,.18];
const slash=[[0,ready],[.20,[-.12,-.08,.28,-.8,.45,-.35]],[.42,[0,-.12,.30,-.75,.15,.65]],[.65,[.10,-.15,.30,-.90,.22,.35]],[1,ready]];
const chop=[[0,ready],[.20,[0,.12,.27,-.65,.75,-.22]],[.42,[0,-.1,.40,-.65,-.45,.6]],[.65,[0,-.22,.37,-.7,-.5,.5]],[1,ready]];
const thrust=[[0,ready],[.24,[-.08,-.13,.22,-.6,.15,.75]],[.42,[0,-.08,.48,-.6,.1,.75]],[.62,[0,-.12,.28,-.6,.3,.75]],[1,ready]];
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
 function apply(a,moving,guard,dt,poseName='idle'){
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
  if(a&&Number.isFinite(a.hitAt)&&a.hitAt>0&&a.hitAt<a.duration)t=a.elapsed<=a.hitAt?.42*a.elapsed/a.hitAt:.42+.58*(a.elapsed-a.hitAt)/(a.duration-a.hitAt);
  const keys=/attack2|smash|exec/.test(name)?chop:/attack3|counter/.test(name)?thrust:slash;
  const spec=path(keys,t),weaponQ=pathRotation(keys,t);
  const center=bones.LeftArm.getWorldPosition(V()).add(bones.RightArm.getWorldPosition(V())).multiplyScalar(.5).add(V(...spec.slice(0,3)).multiplyScalar(scale).applyQuaternion(frame));
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
  apply(a,moving,guard,dt,poseName){base.apply(a,moving,guard,dt);arms.apply(a,moving,guard,dt,poseName);arms.diagnostics.footError=base.diagnostics.footError;}
 };
}
