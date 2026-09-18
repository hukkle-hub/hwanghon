/* Presentation adapter. Model/clip swaps do not own combat time or damage. */
import * as THREE from '../vendor/three/three.module.js';

export function sampleAction(a, duration) {
  const t=Math.max(0,Math.min(a.duration,a.elapsed));
  const contact=duration*a.clipHit;
  return t<=a.hitAt ? contact*t/a.hitAt : contact+(duration-contact)*(t-a.hitAt)/(a.duration-a.hitAt);
}

function rotateToward(bone, end, target, amount) {
  const origin=bone.getWorldPosition(new THREE.Vector3());
  const from=end.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const to=target.clone().sub(origin).normalize();
  if(!from.lengthSq()||!to.lengthSq()) return;
  const delta=new THREE.Quaternion().setFromUnitVectors(from,to);
  const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const local=parent.clone().invert().multiply(delta).multiply(parent).multiply(bone.quaternion);
  bone.quaternion.slerp(local,amount);bone.updateWorldMatrix(false,true);
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

export function makeRigAdapter(model,root,slot) {
  const bones={};model.traverse(o=>{if(o.isBone) bones[o.name.replace(/^mixamorig:?/,'')]=o;});
  const restCorrections=new Map(), anchors={}, diagnostics={gripError:0,footError:0};
  function restore(){for(const [b,q] of restCorrections)b.quaternion.copy(q);restCorrections.clear();}
  function keep(names){for(const n of names){const b=bones[n];if(b&&!restCorrections.has(b))restCorrections.set(b,b.quaternion.clone());}}
  function apply(a,moving,guard,dt){
    model.updateWorldMatrix(true,true);
    const active=a&&a.kind!=='counter'?a.elapsed/a.duration:0;
    if(a){
      keep(['Hips','Spine','Spine2']);
      const drive=Math.sin(active*Math.PI*2)*0.08;
      if(bones.Hips)bones.Hips.rotateY(-drive*0.5);
      if(bones.Spine)bones.Spine.rotateY(drive);
      if(bones.Spine2)bones.Spine2.rotateZ(Math.sin(active*Math.PI)*0.025);
      model.updateWorldMatrix(true,true);
    }
    // New main's idle is intentionally one-handed. Correct grip only while fighting/guarding.
    if(slot&&(a||guard)){
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
        const reach=(shoulder.distanceTo(elbow)+elbow.distanceTo(left.getWorldPosition(new THREE.Vector3())))*0.975;
        const excess=shoulder.distanceTo(target)-reach;
        // Bring an overextended weapon hand inward without changing its world orientation.
        if(excess>0){
          keep(['RightArm','RightForeArm','RightHand']);
          const handQ=right.getWorldQuaternion(new THREE.Quaternion());
          const pull=shoulder.clone().sub(target).setLength(Math.min(0.22,excess+0.02));
          solveLimb(bones.RightArm,bones.RightForeArm,right,right.getWorldPosition(new THREE.Vector3()).add(pull));
          right.quaternion.copy(right.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(handQ));
          model.updateWorldMatrix(true,true);target=gripTarget();
        }
        solveLimb(upper,lower,left,target);
        diagnostics.gripError=left.getWorldPosition(new THREE.Vector3()).distanceTo(target);
      }
    }else diagnostics.gripError=0;
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
