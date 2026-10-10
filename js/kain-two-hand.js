import * as T from '../vendor/three/three.module.js';
import {makeRigAdapter} from './combat-motion.js';
import {solveKainHand} from './kain-hand-ik.js';
import {prepareFootSurface,footSurfaceNow} from './skinned-sole.js';
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
const setWorld=(b,q)=>{b.quaternion.copy(b.parent.getWorldQuaternion(Q()).normalize().invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);};
// Weapon-specific choreography, not the source actor's empty-hand wrist roll.
// Each path is sampled on the SAME clock as the full-body take.
const PATHS={
 skill1:[[0,.65,.65,.39],[.22,0,.99,-.14],[.40,0,.8,.6],[.52,0,-.15,.99],[.70,.55,-.05,.81],[1,.65,.65,.39]],
 skill2:[[0,.65,.65,.39],[.26,-.28,.95,.12],[.74,-.28,.95,.12],[1,.65,.65,.39]],
 skill4:[[0,.65,.65,.39],[.24,0,.99,-.1],[.42,0,.8,.6],[.53,0,.3,.95],[.72,.55,.5,.81],[1,.65,.65,.39]],
 ult:[[0,.65,.65,.39],[.22,-.4,-.15,.95],[.36,0,.6,.8],[.52,0,.99,-.1],[.64,0,.8,.6],[.75,0,-.15,.99],[1,.65,.65,.39]]
};
function weaponAxis(name,t){
 if(name==='skill3'){
  if(t<.18)return V().set(.65,.65,.39).normalize().lerp(V().set(-Math.sin(.6),.25,Math.cos(.6)).normalize(),T.MathUtils.smootherstep(t,0,.18)).normalize();
  if(t>.82)return V().set(Math.sin(.6),.25,Math.cos(.6)).normalize().lerp(V().set(.65,.65,.39).normalize(),T.MathUtils.smootherstep(t,.82,1)).normalize();
  const a=-.6+(t-.18)/.64*(Math.PI*2+1.2);return V().set(Math.sin(a),.25,Math.cos(a)).normalize();
 }
 const p=PATHS[name]||PATHS.skill1;let k=0;while(k<p.length-2&&t>p[k+1][0])k++;
 const a=p[k],b=p[k+1],w=T.MathUtils.smootherstep(t,a[0],b[0]);return V().fromArray(a,1).normalize().lerp(V().fromArray(b,1).normalize(),w).normalize();
}
function weaponLift(name,t){const peak={skill1:.22,skill4:.24,ult:.52}[name];if(peak==null)return 0;const start=name==='ult'?.38:0,end=peak+.18;return .26*(t<peak?T.MathUtils.smootherstep(t,start,peak):1-T.MathUtils.smootherstep(t,peak,end));}
// Calibrate the geometric neutral-wrist circle from Kain's own fists/bind.
// Full-body source hips, legs, shoulders remain intact; ONE rigid sword drives
// both palms. No post-IK smoothing, limb scaling or scythe-specific offsets.
export function makeKainRigAdapter(model,root,slot,opts={}){
 // Measured skinned boot soles in the actual idle were 26.8 mm below y=0
 // on original and 26.6 mm on mobile. Move the entire character + sword,
 // never a hand, foot or shared GLB. Both solo and online use this adapter.
 if(!model.userData.kainGroundOffset){model.position.y+=.027;model.userData.kainGroundOffset=.027;}
 const groundBase=model.position.y,feet=prepareFootSurface(model);
 const legacy=makeRigAdapter(model,root,slot,opts),bones={},saved=new Map(),bind=new Map(),hands={},previous={},frontLocal={};
 model.traverse(b=>{if(b.isBone){bones[b.name.replace(/^mixamorig:?/,'')]=b;bind.set(b,b.quaternion.clone());}});model.updateMatrixWorld(true);
 const restForward=bones.LeftToeBase.getWorldPosition(V()).sub(bones.LeftFoot.getWorldPosition(V())).setY(0).normalize();
 for(const side of ['Right','Left'])frontLocal[side]=restForward.clone().applyQuaternion(bones[side+'Arm'].getWorldQuaternion(Q()).invert());
 for(const side of ['Right','Left']){
  const hand=bones[side+'Hand'],x=hand.userData.gripAxis.clone().normalize(),y=hand.userData.gripFinger.clone();y.addScaledVector(x,-y.dot(x)).normalize();const z=x.clone().cross(y).normalize(),frame=Q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
  const fy=hand.position.clone().normalize(),fx=x.clone().applyQuaternion(bind.get(hand));fx.addScaledVector(fy,-fx.dot(fy)).normalize();const fz=fx.clone().cross(fy).normalize();fx.copy(fy).cross(fz).normalize();
  const neutral=Q().setFromRotationMatrix(new T.Matrix4().makeBasis(fx,fy,fz)).multiply(frame.clone().invert()).normalize();
  bind.set(hand,neutral);
  hands[side]={frame,gripAxis:x,offset:hand.userData.gripPoint.clone(),reach:hand.userData.gripPoint.clone().add(hand.position.clone().applyQuaternion(neutral.clone().invert())).applyQuaternion(frame.clone().invert())};
 }
 const diagnostics={reach:Object.fromEntries(Object.entries(hands).map(([s,c])=>[s,c.reach.toArray()]))},socket=slot?.userData.gripOf||slot;let state=null,last=null,transition=null,previousFacing=null,offset=V(),rollCarry=null;
 function restore(){for(const[b,q]of saved)b.quaternion.copy(q);saved.clear();legacy.restore();model.position.y=groundBase;}
 function apply(a,moving,guard,dt,clip,target){
  // Ground interpolated reactions/banking as ONE body before its rigid weapon
  // solve. Positive airborne heights remain unchanged; no limb is stretched.
  model.position.y=groundBase;model.updateWorldMatrix(true,true);const soles=footSurfaceNow(feet),sink=Math.max(0,root.getWorldPosition(V()).y+.001-Math.min(soles.Left,soles.Right));
  if(sink>0){model.position.y+=sink/model.parent.getWorldScale(V()).y;model.updateWorldMatrix(true,true);}diagnostics.groundLift=sink;
  const data=a&&model.userData.heroSkillMotion?.[a.clip],baked=!!data?.weaponBaked,carry=!a;
  if(!slot||(!data&&!carry)){legacy.apply(a,moving,guard,dt,clip,target);Object.assign(diagnostics,legacy.diagnostics,{source:'legacy'});state=null;return;}
  model.updateWorldMatrix(true,true);const scale=model.getWorldScale(V()).x;
  let center,rotation;
  if(data){const clock=Number.isFinite(a.clipTime)?a.clipTime:a.elapsed/a.duration*data.duration,phase=clock/data.duration,localAxis=a.clip==='skill3'?V().set(Math.sin((.5-phase)*.7),.25,1).normalize():weaponAxis(a.clip,phase),forward=bones.LeftArm.getWorldPosition(V()).sub(bones.RightArm.getWorldPosition(V())).cross(bones.Spine2.getWorldPosition(V()).sub(bones.Hips.getWorldPosition(V()))).normalize(),up=bones.Spine2.getWorldPosition(V()).sub(bones.Hips.getWorldPosition(V())).normalize(),right=up.clone().cross(forward).normalize(),facing=Q().setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,forward));rotation=facing.multiply(Q().setFromUnitVectors(V().set(0,1,0),localAxis));center=bones.RightArm.getWorldPosition(V()).add(bones.LeftArm.getWorldPosition(V())).multiplyScalar(.5).addScaledVector(forward,.45*scale).addScaledVector(up,(-.35+.25*Math.max(0,localAxis.y))*scale);}
  else{center=model.localToWorld(V().set(0,1.10,.36));rotation=model.getWorldQuaternion(Q()).multiply(Q().setFromUnitVectors(V().set(0,1,0),V().set(-.65,.55,.52).normalize()));}
  const reactionCarry=!data&&/^(hit2?|guardHit)$/.test(clip||'');
  if(!data&&/^(roll|dodge[BLR]|hit2?|guardHit)$/.test(clip||'')){
   // Carry the rigid sword with the tumbling torso. A fixed world-upright
   // target made the body roll/recoil away from its wrists and forced IK
   // branch flips. Hit reactions must carry the same whole-body weapon frame.
   const base=bones.Hips.getWorldPosition(V()),up=bones.Spine2.getWorldPosition(V()).sub(base).normalize(),forward=bones.LeftArm.getWorldPosition(V()).sub(bones.RightArm.getWorldPosition(V())).cross(up).normalize(),right=up.clone().cross(forward).normalize(),frame=Q().setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,forward));
   if(state!=='carry:'+clip||!rollCarry){const oldFrame=reactionCarry&&last?.bodyFacing||frame,oldBase=reactionCarry&&last?.bodyBase||base;rollCarry={p:(last?.center||center).clone().sub(oldBase).applyQuaternion(oldFrame.clone().invert()),q:oldFrame.clone().invert().multiply(last?.rotation||rotation)};}
   center=rollCarry.p.clone().applyQuaternion(frame).add(base);rotation=frame.multiply(rollCarry.q);
  }
  if(baked||data?.explicitWeaponPath){const clock=Number.isFinite(a.clipTime)?a.clipTime:a.elapsed/a.duration*data.duration;center=model.localToWorld(V().fromArray(data.position.evaluate(clock)));rotation=model.getWorldQuaternion(Q()).multiply(Q().fromArray(data.rotation.evaluate(clock)));}
  if(data&&!baked&&a.clip==='skill4'){const phase=(Number.isFinite(a.clipTime)?a.clipTime:a.elapsed/a.duration*data.duration)/data.duration,weight=1-T.MathUtils.smootherstep(Math.abs(phase-.55),.02,.15),forward=bones.LeftArm.getWorldPosition(V()).sub(bones.RightArm.getWorldPosition(V())).cross(bones.Spine2.getWorldPosition(V()).sub(bones.Hips.getWorldPosition(V()))).normalize();center.addScaledVector(forward,.12*scale*weight);}
  if(data&&!baked&&!data.explicitWeaponPath&&a.clip!=='skill2'&&a.clip!=='skill3'&&a.clip!=='skill4'){
   const phase=(Number.isFinite(a.clipTime)?a.clipTime:a.elapsed/a.duration*data.duration)/data.duration,contacts={skill1:[.46],skill4:[.475],ult:[.31,.69]}[a.clip]||[],weight=(a.clip==='ult'?.7:1)*Math.max(0,...contacts.map(t=>1-T.MathUtils.smootherstep(Math.abs(phase-t),0,.12))),axis=V().set(0,1,0).applyQuaternion(rotation),aim=model.localToWorld(V().set(0,1.65/1.14,1.4/1.14)).sub(center).normalize(),next=axis.clone().lerp(aim,weight).normalize();rotation.premultiply(Q().setFromUnitVectors(axis,next));
  }
  const next=data?a.clip+':'+(a.id??''):'carry:'+(clip||'idle');if(reactionCarry)transition=null;else if(baked&&!data.coupledReady)transition=null;else if(next!==state){if(last){transition={p:last.center.clone().sub(center),q:last.rotation.clone().multiply(rotation.clone().invert()),t:0};offset.set(0,0,0);}}
  if(transition&&dt>0){transition.t+=Math.min(.05,dt);const w=T.MathUtils.smootherstep(transition.t,0,.22);center.addScaledVector(transition.p,1-w);rotation.premultiply(transition.q.clone().slerp(Q(),w));if(w===1)transition=null;}
  rotation.normalize();let axis=V().set(0,1,0).applyQuaternion(rotation).normalize();const palms={Right:center.clone().addScaledVector(axis,.085),Left:center.clone().addScaledVector(axis,-.085)},arms={};
  const body={base:bones.Hips.getWorldPosition(V()),axis:bones.Spine2.getWorldPosition(V()).sub(bones.Hips.getWorldPosition(V())),forward:bones.LeftArm.getWorldPosition(V()).sub(bones.RightArm.getWorldPosition(V())).cross(bones.Spine2.getWorldPosition(V()).sub(bones.Hips.getWorldPosition(V()))).normalize()};
  for(const side of ['Right','Left']){const u=bones[side+'Arm'],l=bones[side+'ForeArm'],h=bones[side+'Hand'],shoulder=u.getWorldPosition(V()),elbow=l.getWorldPosition(V()),ly=l.position.clone().normalize(),lz=ly.clone().cross(frontLocal[side]).normalize(),lx=ly.clone().cross(lz).normalize();arms[side]={shoulder,upper:shoulder.distanceTo(elbow),lower:elbow.distanceTo(h.getWorldPosition(V())),foreLocal:h.position.clone().normalize(),outward:shoulder.clone().sub(bones[(side==='Right'?'Left':'Right')+'Arm'].getWorldPosition(V())).normalize(),hingeBasis:Q().setFromRotationMatrix(new T.Matrix4().makeBasis(lx,ly,lz)).invert(),bindLower:bind.get(l)};}
  for(const [side,ar] of Object.entries(arms)){ar.baked=baked;ar.upperClearanceWeight=data?.upperClearanceWeight??1e6;const phase=data?(Number.isFinite(a.clipTime)?a.clipTime:a.elapsed/a.duration*data.duration)/data.duration:0;ar.searchFull=side==='Right'&&!!data?.naturalArms&&phase===0;ar.lowerElbow=side==='Right'?500:data?.naturalArms?(data.naturalArmWeight??8):carry?8:a?.clip==='skill4'?T.MathUtils.smootherstep(phase,.25,.4)*(1-T.MathUtils.smootherstep(phase,.6,.8)):0;ar.elbowDrop=side==='Right'?.22:data?.naturalArms||carry ? .13 : .08;}
  const bodyUp=body.axis.clone().normalize(),bodyRight=bodyUp.clone().cross(body.forward).normalize(),bodyFacing=Q().setFromRotationMatrix(new T.Matrix4().makeBasis(bodyRight,bodyUp,body.forward));
  if(baked){for(const side of ['Right','Left'])previous[side]={handQ:bones[side+'Hand'].getWorldQuaternion(Q()),lowerQ:bones[side+'ForeArm'].getWorldQuaternion(Q()),elbow:bones[side+'ForeArm'].getWorldPosition(V()),shoulder:arms[side].shoulder.clone()};}
  else if(previousFacing){const dq=bodyFacing.clone().multiply(previousFacing.clone().invert());for(const side of ['Right','Left'])if(previous[side]){const s=previous[side];s.handQ.premultiply(dq);s.lowerQ.premultiply(dq);s.upperQ?.premultiply(dq);s.elbow.sub(s.shoulder).applyQuaternion(dq).add(arms[side].shoulder);}}
  if(!baked){
  offset.applyQuaternion(bodyFacing);center.add(offset);palms.Right.add(offset);palms.Left.add(offset);
  const evaluate=delta=>{const ss={},normal=V().set(0,0,1).applyQuaternion(rotation).normalize();let cost=offset.clone().add(delta).lengthSq()*(data?.naturalCenterWeight??4);for(const side of ['Right','Left']){const s=solveKainHand(arms[side],palms[side].clone().add(delta),axis,normal,hands[side],scale,bind.get(bones[side+'Hand']).clone().normalize(),body,previous[side],dt);ss[side]=s;cost+=s.bend*s.bend*100+Math.max(0,s.bend-.45)**2*1e7+Math.max(0,s.twist-1.5)**2*200+Math.max(0,.205-s.clearance)**2*1e6+Math.max(0,.195-s.upperClearance)**2*arms[side].upperClearanceWeight+s.elbowLift*s.elbowLift*200+s.residual*s.residual*1e6;}return{ss,cost,delta};};
  let chosen=evaluate(V());const step=Math.min(.04,Math.max(0,dt)*2.4);for(const direction of [body.forward,bodyUp,bodyRight])for(const sign of [-1,1]){const delta=direction.clone().multiplyScalar(step*sign);if(offset.clone().add(delta).length()>.45)continue;const e=evaluate(delta);if(e.cost<chosen.cost)chosen=e;}
  center.add(chosen.delta);palms.Right.add(chosen.delta);palms.Left.add(chosen.delta);offset.add(chosen.delta);
  // Keep the long blade above the floor without moving either hand separately.
  const minY=(-center.y+.15)/1.7475;if(axis.y<minY){const safe=axis.clone();safe.y=minY;const horizontal=Math.hypot(safe.x,safe.z),radius=Math.sqrt(Math.max(0,1-safe.y*safe.y));safe.x*=radius/horizontal;safe.z*=radius/horizontal;rotation.premultiply(Q().setFromUnitVectors(axis,safe));axis.copy(safe);palms.Right.copy(center).addScaledVector(axis,.085);palms.Left.copy(center).addScaledVector(axis,-.085);}
  }
  let solutions={};
  for(let pass=0;pass<32;pass++){
   const normal=V().set(0,0,1).applyQuaternion(rotation).normalize();let shift=V(),error=0;
   for(const side of ['Right','Left']){const h=bones[side+'Hand'],s=solveKainHand(arms[side],palms[side],axis,normal,hands[side],scale,bind.get(h).clone().normalize(),body,previous[side],dt);solutions[side]=s;if(s.residual>.00001){shift.add(s.wrist.clone().sub(s.desired));error=Math.max(error,s.residual);}}
   const closest=Object.values(solutions).sort((a,b)=>a.clearance-b.clearance)[0];
   // First solve common rigid reach, then improve clearance. Simultaneously
   // pushing away from the torso and back into reach oscillated in hit poses.
   if(!baked&&error<.00001&&closest.clearance<.19){const push=closest.clearNormal.clone().multiplyScalar(Math.min(.005,.19-closest.clearance));shift.add(push);offset.add(push);error=Math.max(error,.01);}
   // Never apply solutions from BEFORE the last target translation.
   if(error<.00001||pass===31)break;palms.Right.add(shift.multiplyScalar(.75));palms.Left.add(shift);center.copy(palms.Right).add(palms.Left).multiplyScalar(.5);
  }
  for(const side of ['Right','Left']){
   const u=bones[side+'Arm'],l=bones[side+'ForeArm'],h=bones[side+'Hand'],s=solutions[side],ar=arms[side];for(const bone of [u,l,h])saved.set(bone,bone.quaternion.clone());
   const ly=l.position.clone().normalize(),lz=ly.clone().cross(frontLocal[side]).normalize(),lx=ly.clone().cross(lz).normalize(),wy=s.elbow.clone().sub(ar.shoulder).normalize(),wz=wy.clone().cross(s.wrist.clone().sub(s.elbow)).normalize(),wx=wy.clone().cross(wz).normalize();
   const upperQ=Q().setFromRotationMatrix(new T.Matrix4().makeBasis(wx,wy,wz)).multiply(Q().setFromRotationMatrix(new T.Matrix4().makeBasis(lx,ly,lz)).invert()).normalize(),sourceUpper=u.getWorldQuaternion(Q()).normalize();
   // The almost-straight bind elbow cannot define a stable roll sign. Choose
   // the upper-arm roll that does not twist the forearm skin by 180 degrees.
   let rollBest={cost:Infinity,angle:0,q:upperQ};const rollCandidate=angle=>{const q=Q().setFromAxisAngle(wy,angle).multiply(upperQ),rel=bind.get(l).clone().invert().multiply(q.clone().invert().multiply(s.lowerQ));let twist=2*Math.atan2(rel.y,rel.w);twist=Math.atan2(Math.sin(twist),Math.cos(twist));const cost=upperQ.angleTo(q)**2*10+twist*twist*3+sourceUpper.angleTo(q)**2*.1;if(cost<rollBest.cost)rollBest={cost,angle,q};};if(!baked){for(let k=-4;k<=4;k++)rollCandidate(k*Math.PI/24);for(let step=Math.PI/48;step>.001;step*=.5){const a=rollBest.angle;rollCandidate(a-step);rollCandidate(a+step);}}else rollBest.q=Q().setFromUnitVectors(ly.clone().applyQuaternion(sourceUpper).normalize(),wy).multiply(sourceUpper).normalize();
   if(!baked&&previous[side]?.upperQ){const old=previous[side].upperQ,aligned=Q().setFromUnitVectors(ly.clone().applyQuaternion(old).normalize(),wy).multiply(old).normalize(),angle=aligned.angleTo(rollBest.q),jump=a?.clip==='skill4',weight=Math.min(1-Math.exp(-dt/(jump?.03:.08)),dt*(jump?10:6)/Math.max(.00001,angle));rollBest.q=aligned.slerp(rollBest.q,weight).normalize();}
   setWorld(u,rollBest.q);setWorld(l,s.lowerQ);setWorld(h,s.handQ);s.upperQ=rollBest.q.clone();previous[side]=s;diagnostics[side+'Residual']=s.residual;diagnostics[side+'WristBend']=h.quaternion.angleTo(bind.get(h).clone().normalize());diagnostics[side+'TorsoClearance']=s.clearance;diagnostics[side+'UpperArmClearance']=s.upperClearance;
  }
  saved.set(socket,socket.quaternion.clone());setWorld(socket,rotation);model.updateWorldMatrix(true,true);opts.handGrip?.set('Left',1);opts.handGrip?.set('Right',1);
  const palm=s=>hands[s].offset.clone().applyMatrix4(bones[s+'Hand'].matrixWorld);diagnostics.gripError=palm('Left').distanceTo(slot.getWorldPosition(V()).addScaledVector(axis,-.17));diagnostics.rightGripError=palm('Right').distanceTo(palms.Right);diagnostics.twoHand=1;diagnostics.source=data?'full-body-mocap':'two-hand-carry';
  for(const side of ['Right','Left'])previous[side].shoulder=arms[side].shoulder.clone();previousFacing=bodyFacing;offset.applyQuaternion(bodyFacing.clone().invert());
  last={center:palms.Right.clone().add(palms.Left).multiplyScalar(.5),rotation:rotation.clone(),bodyBase:body.base.clone(),bodyFacing:bodyFacing.clone()};state=next;
 }
 return{restore,apply,diagnostics};
}
