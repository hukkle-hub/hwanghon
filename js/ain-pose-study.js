import * as T from '../vendor/three/three.module.js';
import {smoothArmClip} from './ain-motion-quality.js';
import {solveLimb} from './combat-motion.js';
export function refineStudyGrip(rig,slot){
  const b=rig.bones,pos=slot.getWorldPosition(new T.Vector3());
  const axis=new T.Vector3(0,1,0).applyQuaternion(slot.getWorldQuaternion(new T.Quaternion()));
  let off=T.MathUtils.clamp(b.LeftArm.getWorldPosition(new T.Vector3()).sub(pos).dot(axis),-.55,.5);
  if(Math.abs(off)<.12)off=off<0?-.12:.12;
  const target=pos.addScaledVector(axis,off);
  // Legacy baseline only. The bounded review deliberately does not call this.
  for(let i=0;i<4;i++)solveLimb(b.LeftArm,b.LeftForeArm,b.LeftHand,target);
  rig.diagnostics.gripError=b.LeftHand.getWorldPosition(new T.Vector3()).distanceTo(target);
}
// Six editable poses sampled from the existing asset, not generated mocap.
export const KEYS = [
  {name:'준비',time:0,source:0},
  {name:'낫 당기기',time:.32,source:.18},
  {name:'회전 진입',time:.52,source:.32},
  {name:'타격 후보',time:.66,source:.42},
  {name:'후속 궤적',time:.88,source:.68},
  {name:'준비 복귀',time:1.4,source:0}
];
export function makePoseStudy(source,{smooth=false}={}){
  if(!source)throw new Error('attack1 clip missing');
  const tracks=source.tracks.map(track=>{
    const interpolation=track.createInterpolant(),values=[];
    for(const k of KEYS)values.push(...interpolation.evaluate(k.source*source.duration));
    if(/Hips\.position$/.test(track.name))for(let i=0;i<values.length;i+=3){values[i]=values[0];values[i+2]=values[2];}
    return new track.constructor(track.name,KEYS.map(k=>k.time),values,T.InterpolateLinear);
  });
  const clip=new T.AnimationClip('ain_six_pose_study',1.4,tracks);
  return smooth?smoothArmClip(clip):clip;
}
