// Author from immutable reviewed input; connect skeleton AND rigid weapon.
// Keep source clocks, hit windows, shared meshes and other heroes untouched.
import fs from 'node:fs';import vm from 'node:vm';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import * as T from '../../vendor/three/three.module.js';import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {makePoser} from './pose-eval.mjs';import {Animated} from '../../js/party-avatar.js';import {fieldHeroAction} from '../../js/mmo/hero-motion.js';
import {HERO_SKILL_DATA} from '../../js/hero-skill-data.js';import {HERO_MELEE_DATA} from '../../js/hero-melee-data.js';
import {prepareFootSurface,footSurfaceNow} from './foot-surface-audit.mjs';
if(!process.argv[2]||!process.argv[3])throw Error('Provide archived skill and melee input files.');
const skills=structuredClone((await import(pathToFileURL(resolve(process.argv[2])).href)).HERO_SKILL_DATA),melee=structuredClone((await import(pathToFileURL(resolve(process.argv[3])).href)).HERO_MELEE_DATA);
if(Object.values({...skills.kain,...melee.kain}).some(c=>c.readyConnected))throw Error('Do not feed authored output back as source.');
HERO_SKILL_DATA.kain=skills.kain;HERO_MELEE_DATA.kain=melee.kain;
globalThis.window=globalThis;for(const f of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+f+'.js','utf8'));
const load=async file=>{const raw=fs.readFileSync(file),loader=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])loader.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return loader.parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
const asset=await load('art/3d/kain_anim.glb'),weapon=await load('art/3d/gear/w_kain_greatsword.glb'),V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
for(const[name,source]of Object.entries({...skills.kain,...melee.kain})){
 const scene=new T.Scene(),h=new Animated(asset,scene,true,false,weapon,'kain'),bones={};h.model.traverse(b=>{if(b.isBone)bones[b.name.replace(/^mixamorig:?/,'')]=b;});
 const idle=makePoser(h.model,h.clips.idle);for(let i=0;i<120;i++){h.rig.restore();idle(0);h.rig.apply(null,false,false,1/120,'idle');}h.root.updateMatrixWorld(true);
 const ready=Object.fromEntries(Object.keys(source.tracks).map(n=>[n,bones[n].quaternion.clone()])),readyHips=bones.Hips.position.clone(),readyQ=h.model.getWorldQuaternion(Q()).invert().multiply(h.weapon.getWorldQuaternion(Q())).normalize(),readyP=h.weapon.getWorldPosition(V()).addScaledVector(V().set(0,1,0).applyQuaternion(h.weapon.getWorldQuaternion(Q())),-.085);h.model.worldToLocal(readyP);
 const clip=h.clips[name],pose=makePoser(h.model,clip),data=h.model.userData.heroSkillMotion[name],position=data.position,rotation=data.rotation;
 const weight=t=>Math.max(1-T.MathUtils.smootherstep(t,0,Math.max(.30,source.entry||0)),T.MathUtils.smootherstep(t,source.duration-Math.max(.50,source.exit||0),source.duration));
 data.position={evaluate:t=>V().fromArray(position.evaluate(t)).lerp(readyP,weight(t)).toArray()};data.rotation={evaluate:t=>Q().fromArray(rotation.evaluate(t)).normalize().slerp(readyQ,weight(t)).normalize().toArray()};
 const result={...structuredClone(source),readyConnected:true,tracks:Object.fromEntries(Object.keys(source.tracks).map(n=>[n,[]])),hips:[],weaponPositions:[],weaponRotations:[]};
 for(let i=0;i<source.times.length;i++){
  const t=source.times[i],w=weight(t);h.rig.restore();pose(t);for(const[n,q]of Object.entries(ready))bones[n].quaternion.normalize().slerp(q,w);bones.Hips.position.lerp(readyHips,w);
  h.rig.apply(fieldHeroAction('kain',clip,t,name),false,false,i?t-source.times[i-1]:1/120,name);h.root.updateMatrixWorld(true);
  for(const[n,a]of Object.entries(result.tracks))bones[n].quaternion.normalize().toArray(a,a.length);bones.Hips.position.toArray(result.hips,result.hips.length);
  const q=h.weapon.getWorldQuaternion(Q()),p=h.weapon.getWorldPosition(V()).addScaledVector(V().set(0,1,0).applyQuaternion(q),-.085);h.model.worldToLocal(p).toArray(result.weaponPositions,result.weaponPositions.length);h.model.getWorldQuaternion(Q()).invert().multiply(q).normalize().toArray(result.weaponRotations,result.weaponRotations.length);
 }
 if(process.argv.includes('--natural-specials')&&skills.kain[name]){
  skills.kain[name]=result;
  const rscene=new T.Scene(),rh=new Animated(asset,rscene,true,false,weapon,'kain'),rb={};rh.model.traverse(b=>{if(b.isBone)rb[b.name.replace(/^mixamorig:?/,'')]=b;});
  const rc=rh.clips[name],rp=makePoser(rh.model,rc),rd=rh.model.userData.heroSkillMotion[name];rd.naturalArms=true;rd.naturalCenterWeight=10000;rd.upperClearanceWeight=3e6;
  if(name==='skill3'){const position=rd.position,contact=TW_DUNGEONS.SKILLS.kain[2].ev.hits[0][0];rd.position={evaluate:t=>{const p=V().fromArray(position.evaluate(t));p.y+=.0225*(1-T.MathUtils.smootherstep(Math.abs(t/rd.duration-contact),.02,.10));return p.toArray();}};}
  // Seed exactly from the coupled ready pose, then author a lowered elbow hint
  // into the take. Runtime still plays a cheap baked rigid-grip solution.
  rp(0);rh.rig.apply(fieldHeroAction('kain',rc,0,name),false,false,1/120,name);rd.weaponBaked=false;rd.explicitWeaponPath=true;
  for(let i=0;i<result.times.length;i++){
   const t=result.times[i],dt=i?t-result.times[i-1]:1/120;
   for(let j=0;j<8;j++){rh.rig.restore();rp(t);rh.rig.apply(fieldHeroAction('kain',rc,t,name),false,false,dt/8,name);}rh.root.updateMatrixWorld(true);
   for(const[n,a]of Object.entries(result.tracks))rb[n].quaternion.normalize().toArray(a,i*4);
   const q=rh.weapon.getWorldQuaternion(Q()),p=rh.weapon.getWorldPosition(V()).addScaledVector(V().set(0,1,0).applyQuaternion(q),-.085);rh.model.worldToLocal(p).toArray(result.weaponPositions,i*3);rh.model.getWorldQuaternion(Q()).invert().multiply(q).normalize().toArray(result.weaponRotations,i*4);
  }rh.dispose(rscene);result.naturalSpecialArms=true;
  // Remove solver-history roll drift before returning to the same ready pose.
  for(let i=0;i<result.times.length;i++){const w=T.MathUtils.smootherstep(result.times[i],result.duration-.40,result.duration);if(!w)continue;for(const a of Object.values(result.tracks))Q().fromArray(a,i*4).slerp(Q().fromArray(a),w).normalize().toArray(a,i*4);for(const a of [result.hips,result.weaponPositions])V().fromArray(a,i*3).lerp(V().fromArray(a),w).toArray(a,i*3);Q().fromArray(result.weaponRotations,i*4).slerp(Q().fromArray(result.weaponRotations),w).normalize().toArray(result.weaponRotations,i*4);}
  if(name==='skill1'){
   // The clearance-constrained elbow changes branch sharply during the forward
   // cut. Filter the SAME short window of the whole body AND rigid weapon,
   // not independent hands; runtime resolves both grips against this path.
   const qa=[...Object.values(result.tracks),result.weaponRotations],va=[result.hips,result.weaponPositions];
   for(const a of [...qa,...va]){const src=a.slice(),quat=qa.includes(a),stride=quat?4:3;for(let i=0;i<result.times.length;i++){const phase=result.times[i]/result.duration,w=T.MathUtils.smootherstep(phase,.36,.40)*(1-T.MathUtils.smootherstep(phase,.45,.49));if(!w)continue;const ref=quat?Q().fromArray(src,i*4):null,sum=Array(stride).fill(0);let total=0;for(let j=-4;j<=4;j++){const k=T.MathUtils.clamp(i+j,0,result.times.length-1),weight=Math.exp(-j*j/8),sign=quat&&ref.dot(Q().fromArray(src,k*4))<0?-1:1;total+=weight;for(let n=0;n<stride;n++)sum[n]+=src[k*stride+n]*weight*sign;}for(let n=0;n<stride;n++)sum[n]/=total;if(quat)ref.slerp(Q().fromArray(sum).normalize(),w).normalize().toArray(a,i*4);else V().fromArray(src,i*3).lerp(V().fromArray(sum),w).toArray(a,i*3);}}
  }
 }
 // The sparse right biceps seam folds during skill1's follow-through; skill4's
 // shoulder seam over-stretches late in its landing. Probe both actual LODs,
 // then compensate upper-arm axial roll without moving the elbow, wrist or
 // blade. Fade it with the coupled ready connection, never add a boundary jump.
 const rollAngle=process.argv.includes('--natural-specials')?0:{skill1:.6,skill4:.25}[name];if(rollAngle){const axis=bones.RightForeArm.position.clone().normalize();for(let i=0;i<result.times.length;i++){const roll=Q().setFromAxisAngle(axis,rollAngle*(1-weight(result.times[i])));Q().fromArray(result.tracks.RightArm,i*4).multiply(roll).normalize().toArray(result.tracks.RightArm,i*4);roll.invert().multiply(Q().fromArray(result.tracks.RightForeArm,i*4)).normalize().toArray(result.tracks.RightForeArm,i*4);}}
 // Actual 60 Hz runtime revealed a narrow left shoulder seam stretch in the
 // ultimate which sparse clip samples missed. Compensated axial roll keeps
 // elbow/wrist positions and the forearm world orientation unchanged.
 if(name==='ult'&&process.argv.includes('--natural-specials')){const axis=bones.LeftForeArm.position.clone().normalize();for(let i=0;i<result.times.length;i++){const p=result.times[i]/result.duration,w=T.MathUtils.smootherstep(p,.24,.29)*(1-T.MathUtils.smootherstep(p,.36,.41)),roll=Q().setFromAxisAngle(axis,-.30*w);Q().fromArray(result.tracks.LeftArm,i*4).multiply(roll).normalize().toArray(result.tracks.LeftArm,i*4);roll.invert().multiply(Q().fromArray(result.tracks.LeftForeArm,i*4)).normalize().toArray(result.tracks.LeftForeArm,i*4);}}
 // Correct actual sole penetration in the source, translating the FULL body
 // and rigid sword together. Preserve authored airborne motion, joint angles,
 // hit clocks and endpoints. A conservative two-pass local max filter gives
 // continuous support across sparse keys without lowering a safe sample.
 const feet=prepareFootSurface(h.model),groundClip=new T.AnimationClip(name,result.duration,[...Object.entries(result.tracks).map(([n,a])=>new T.QuaternionKeyframeTrack(bones[n].name+'.quaternion',result.times,a)),new T.VectorKeyframeTrack(bones.Hips.name+'.position',result.times,result.hips)]),groundPose=makePoser(h.model,groundClip),raise=[];
 for(const t of result.times){groundPose(t);h.root.updateMatrixWorld(true);const f=footSurfaceNow(feet);raise.push(Math.max(0,.001-Math.min(f.Left,f.Right))/h.model.getWorldScale(V()).y);}
 for(let i=0;i<raise.length;i++){let lift=raise[i];for(let j=-2;j<=2;j++){const k=i+j;if(k>=0&&k<raise.length)lift=Math.max(lift,raise[k]*Math.exp(-j*j/3));}result.hips[i*3+1]+=lift;result.weaponPositions[i*3+1]+=lift;}
 result.soleGrounded=true;
 for(const a of [...Object.values(result.tracks),result.hips,result.weaponPositions,result.weaponRotations])for(let i=0;i<a.length;i++)a[i]=+a[i].toFixed(7);
 if(skills.kain[name])skills.kain[name]=result;else melee.kain[name]=result;h.dispose(scene);console.log('connected',name);
}
fs.writeFileSync('js/hero-skill-data.js','// Full-body skill takes with coupled Kain ready connections; shared GLBs and clocks unchanged.\nexport const HERO_SKILL_DATA='+JSON.stringify(skills)+';\n');
fs.writeFileSync('js/hero-melee-data.js','// Full-body melee takes with coupled Kain ready connections; shared GLBs and clocks unchanged.\nexport const HERO_MELEE_DATA='+JSON.stringify(melee)+';\n');
