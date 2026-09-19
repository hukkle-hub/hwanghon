// Visual sampling only: simulation remains the owner of damage and movement.
const prepared=new WeakMap();
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
