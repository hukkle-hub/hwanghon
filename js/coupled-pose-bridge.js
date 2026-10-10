import * as T from '../vendor/three/three.module.js';
// One visible full-body connection path for solo and online Kain. The weapon
// adapter runs AFTER apply(); capture() runs AFTER the rigid two-hand solve.
function capturePose(model,buffer){if(!buffer){buffer=[];model.traverse(b=>{if(b.isBone)buffer.push([b,new T.Vector3(),new T.Quaternion(),new T.Vector3()]);});}for(const[b,p,q,s]of buffer){p.copy(b.position);q.copy(b.quaternion);s.copy(b.scale);}return buffer;}
const freezePose=pose=>pose.map(([b,p,q,s])=>[b,p.clone(),q.clone(),s.clone()]);
export function createCoupledPoseBridge(model){
 if(!model.userData.heroSkillMotion?.attack1?.coupledReady)return null;
 let presentedPose=null,transition=null,restoreBuffer=null,restorePending=false,state=null;
 return{
  restore(){if(!restorePending)return;for(const[b,p,q,s]of restoreBuffer){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s);}restorePending=false;},
  apply(dt,key){
   if(key!==state){if(presentedPose)transition={pose:freezePose(presentedPose),t:0};state=key;}
   if(!transition)return;transition.t+=Math.min(dt,.05);const w=T.MathUtils.smootherstep(transition.t,0,.22);restoreBuffer=capturePose(model,restoreBuffer);restorePending=true;
   for(let i=0;i<transition.pose.length;i++){const[b,p,q,s]=transition.pose[i],target=restoreBuffer[i];b.position.lerpVectors(p,target[1],w);b.quaternion.copy(q).slerp(target[2],w).normalize();b.scale.lerpVectors(s,target[3],w);}if(w===1)transition=null;
  },
  capture(){presentedPose=capturePose(model,presentedPose);},
  get presentedPose(){return presentedPose;},get transition(){return transition;}
 };
}
