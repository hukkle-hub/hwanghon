import * as T from '../vendor/three/three.module.js';
import {HERO_SKILL_DATA} from './hero-skill-data.js';

// Applied after bind repair but before constructing any AnimationMixer action.
// The same full-body take drives hips, legs, shoulders AND the weapon solver.
export function applyHeroSkillClips(model,clips,character){
 // Other takes are retained as source candidates, not silently released before
 // weapon-specific choreography and real-mesh visual review are complete.
 if(character!=='ain')return clips;
 const data=HERO_SKILL_DATA[character];if(!data)return clips;
 const bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
 const motion={};
 const result=clips.map(old=>{
  const src=data[old.name];if(!src)return old;
  const tracks=[];
  for(const [name,values]of Object.entries(src.tracks))if(bones[name])tracks.push(new T.QuaternionKeyframeTrack(bones[name].name+'.quaternion',src.times,values));
  tracks.push(new T.VectorKeyframeTrack(bones.Hips.name+'.position',src.times,src.hips));
  const clip=new T.AnimationClip(old.name,src.duration,tracks);
  clip.userData={source:'mixamo:'+src.sourceLabel,fullBody:true,weaponLocal:src.weaponLocal,duration:src.duration,entry:src.entry,exit:src.exit};
  motion[old.name]={...clip.userData,position:new T.VectorKeyframeTrack('weapon.position',src.times,src.weaponPositions).createInterpolant(),rotation:new T.QuaternionKeyframeTrack('weapon.quaternion',src.times,src.weaponRotations).createInterpolant()};
  return clip;
 });
 model.userData.heroSkillMotion=motion;
 return result;
}
