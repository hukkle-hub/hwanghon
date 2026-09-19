import * as T from '../vendor/three/three.module.js';

const cache=new WeakMap();
// Symmetric offline filter: removes retargeting spikes without adding playback
// latency or changing clip duration / combat contact timestamps. Source untouched.
export function smoothArmClip(clip){
 if(cache.has(clip))return cache.get(clip);
 const result=clip.clone(),count=Math.max(2,Math.ceil(clip.duration*120));
 result.tracks=result.tracks.map(track=>{
  if(!/(?:Left|Right)(?:Shoulder|Arm|ForeArm|Hand)\.quaternion$/.test(track.name))return track;
  const sample=track.createInterpolant(),times=[],values=[];
  for(let i=0;i<=count;i++){
   const t=clip.duration*i/count,ref=new T.Quaternion().fromArray(sample.evaluate(t)).normalize();
   const sum=[0,0,0,0];let total=0;
   for(let k=-4;k<=4;k++){
    const q=new T.Quaternion().fromArray(sample.evaluate(T.MathUtils.clamp(t+k*.0125,0,clip.duration))).normalize();
    const weight=Math.exp(-k*k/4.5)*(q.dot(ref)<0?-1:1);
    sum[0]+=q.x*weight;sum[1]+=q.y*weight;sum[2]+=q.z*weight;sum[3]+=q.w*weight;total+=Math.abs(weight);
   }
   const q=new T.Quaternion(...sum.map(v=>v/total)).normalize();
   // Exact endpoints prevent a new seam at looping idle/run boundaries.
   const edge=Math.min(t,clip.duration-t)/.05;
   ref.slerp(q,T.MathUtils.smoothstep(edge,0,1));times.push(t);values.push(...ref.toArray());
  }
  return new T.QuaternionKeyframeTrack(track.name,times,values);
 });
 cache.set(clip,result);return result;
}
