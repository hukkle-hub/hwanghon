// Review-only deterministic attack -> interrupted pose -> stagger -> idle.
// Uses authored tracks via makePoser, not paused AnimationMixer state. No GLB edits.
import {makePoser} from './pose-eval.mjs';
export function createInterruptPoseStudy(root,clips,{blendIn=.18,blendOut=.25}={}){
 const byName=new Map(clips.map(c=>[c.name,c])),stagger=byName.get('stagger'),idle=byName.get('idle');
 if(!stagger||!idle||!(blendIn>0&&blendOut>0&&blendIn+blendOut<stagger.duration))throw Error('Invalid interruption clips/timing');
 const bindings=new Map(),posers=new Map();
 for(const clip of clips){
  for(const track of clip.tracks){
   const dot=track.name.lastIndexOf('.'),name=track.name.slice(0,dot),prop=track.name.slice(dot+1),node=root.getObjectByName(name);
   if(!node||!['quaternion','position','scale','morphTargetInfluences'].includes(prop))throw Error('Unsupported interruption track '+track.name);
   if(!bindings.has(track.name))bindings.set(track.name,{node,prop,base:prop==='morphTargetInfluences'?[...node[prop]]:node[prop].clone()});
  }
  posers.set(clip.name,makePoser(root,clip));
 }
 const slots=[...bindings.values()];
 const copy=(s,v)=>{if(s.prop==='morphTargetInfluences')v.forEach((n,i)=>s.node[s.prop][i]=n);else s.node[s.prop].copy(v)};
 function apply(name,t){for(const s of slots)copy(s,s.base);posers.get(name)(t)}
 const capture=()=>slots.map(s=>s.prop==='morphTargetInfluences'?[...s.node[s.prop]]:s.node[s.prop].clone());
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
 function blend(from,a){slots.forEach((s,i)=>{
  const current=s.node[s.prop];if(s.prop==='morphTargetInfluences')current.forEach((v,k)=>current[k]=from[i][k]+(v-from[i][k])*a);
  else if(s.prop==='quaternion')current.slerpQuaternions(from[i],current.clone(),a);
  else current.lerpVectors(from[i],current.clone(),a);
 });root.updateMatrixWorld(true)}
 return {pose(name,t,cancelAt=Infinity){
  const attack=byName.get(name);if(!attack||!Number.isFinite(t)||t<0)throw Error('Invalid interruption pose');
  if(!Number.isFinite(cancelAt)||cancelAt<0||cancelAt>=attack.duration||t<cancelAt){apply(name,t);return 'attack'}
  const age=t-cancelAt,exit=stagger.duration-blendOut;
  if(age<blendIn){apply(name,cancelAt);const frozen=capture();apply('stagger',age);blend(frozen,smooth(age/blendIn));return 'interrupt'}
  if(age<exit){apply('stagger',age);return 'stagger'}
  if(age<stagger.duration){apply('stagger',age);const from=capture();apply('idle',age-exit);blend(from,smooth((age-exit)/blendOut));return 'recover'}
  apply('idle',(age-exit)%idle.duration);return 'idle';
 },duration(name,cancelAt=Infinity){const attack=byName.get(name);return Number.isFinite(cancelAt)&&cancelAt>=0&&cancelAt<attack.duration?Math.max(attack.duration,cancelAt+stagger.duration+.5):attack.duration}};
}
