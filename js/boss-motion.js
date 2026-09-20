// Visual sampling only: simulation remains the owner of damage and movement.
const prepared=new WeakMap();
// Additive, bounded silhouette cues. Always restore BEFORE mixer evaluation:
// paused clips and hitstop must never accumulate rotations frame over frame.
export function createBossReadability(model){
 const bones={},saved=new Map();model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
 function restore(){for(const [b,q]of saved)b.quaternion.copy(q);saved.clear();}
 function rotate(name,axis,value){const b=bones[name];if(!b||!value)return;if(!saved.has(b))saved.set(b,b.quaternion.clone());b[axis](value);}
 function apply(state){
  const windup=Math.max(0,Math.min(1,state.windup||0)),cue=state.state==='telegraph'?Math.sin(Math.PI*Math.min(1,windup/.85)):0;
  const icon=state.patIcon||state.pattern?.icon;
  if(icon==='hammer'){rotate('Spine','rotateX',-.10*cue);rotate('LeftArm','rotateZ',.22*cue);rotate('RightArm','rotateZ',-.22*cue);}
  else if(icon==='bolt'){rotate('Spine1','rotateY',-.16*cue);rotate('RightArm','rotateX',-.20*cue);}
  else if(icon==='scythe'){rotate('Spine','rotateY',.22*cue);rotate('LeftArm','rotateZ',.14*cue);}
  // Broken shoulder droops at rest, then blends out before committed contact.
  const rest=['idle','stagger','recover'].includes(state.state)?1:state.state==='telegraph'?1-Math.min(1,windup*3):0;
  for(const p of state.parts||[])if(p.broken){if(p.id==='shl')rotate('LeftArm','rotateZ',-.28*rest);if(p.id==='shr')rotate('RightArm','rotateZ',.28*rest);}
  model.updateWorldMatrix(true,true);
 }
 return {restore,apply};
}
export function prepareTrainingMotion(asset) {
 if(prepared.has(asset))return prepared.get(asset);
 const animations=asset.animations.map(source=>{
  const clip=source.clone();
  if(!/^atk_/.test(clip.name))return clip;
  for(const track of clip.tracks){
   if(!/(^|mixamorig:?|[.:])Hips\.position$/.test(track.name))continue;
   // glTF Y-up. Keep vertical weight shifts but prevent double horizontal motion.
   for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2];}
  }
  return clip;
 });
 const result={...asset,animations};prepared.set(asset,result);return result;
}
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
export function sampleBossAttack(spec,duration,state) {
 const contact=duration*clamp(spec.hitFrac);
 if(state.state==='telegraph'){
  const progress=Number.isFinite(state.windup)?state.windup:1-state.tele/Math.max(.001,state.teleDur);
  return contact*clamp(progress);
 }
 if(state.state==='recover'){
  const progress=1-Math.max(0,state.recovery)/Math.max(.001,state.recoveryDur);
  return contact+(duration-contact)*clamp(progress);
 }
 return null; // link/interrupt states must not remain paused at the last windup pose
}
