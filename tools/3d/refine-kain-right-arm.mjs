// Refine an archived reviewed take; never mutate shared character/wardrobe GLBs.
// Sample explicitly: paused AnimationMixer does not reliably restore IK bones.
import fs from 'node:fs';import vm from 'node:vm';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import * as T from '../../vendor/three/three.module.js';import {loadGlb} from './stretch-audit.mjs';import {makePoser} from './pose-eval.mjs';
import {Animated} from '../../js/party-avatar.js';import {fieldHeroAction} from '../../js/mmo/hero-motion.js';import {HERO_MELEE_DATA} from '../../js/hero-melee-data.js';
globalThis.window=globalThis;for(const f of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+f+'.js','utf8'));
const input=(await import(pathToFileURL(resolve(process.argv[2])).href)).HERO_MELEE_DATA;
if(Object.values(input.kain).some(c=>c.rightArmRefined))throw Error('Use the archived pre-repair takes, not previous output.');
HERO_MELEE_DATA.kain=input.kain;
const asset=await loadGlb('art/3d/kain_anim.glb'),weapon=await loadGlb('art/3d/gear/w_kain_greatsword.glb'),V=()=>new T.Vector3(),Q=()=>new T.Quaternion(),out={};
for(const[name,src]of Object.entries(input.kain)){
 const h=new Animated(asset,new T.Scene(),true,false,weapon,'kain'),b={};h.model.traverse(o=>{if(o.isBone)b[o.name.replace(/^mixamorig:?/,'')]=o;});
 const clip=h.clips[name],pose=makePoser(h.model,clip),data=h.model.userData.heroSkillMotion[name],sourcePosition=data.position,sourceRotation=data.rotation;
 h.play('idle');for(let i=0;i<120;i++){h.rig.restore();h.mixer.update(1/60);h.rig.apply(null,false,false,1/60,'idle');}h.rig.restore();
 data.weaponBaked=false;data.explicitWeaponPath=true;data.naturalArms=true;data.naturalCenterWeight=100000;
 const ready=V().set(0,1.10,.36),readyQ=Q().setFromUnitVectors(V().set(0,1,0),V().set(-.65,.55,.52).normalize()),readyWeight=t=>Math.max(1-T.MathUtils.smootherstep(t,0,.30),T.MathUtils.smootherstep(t,src.duration-.55,src.duration));
 data.position={evaluate:t=>{const p=V().fromArray(sourcePosition.evaluate(t)),w=Math.sin(Math.PI*t/src.duration)**2;p.z-=.17*w;p.y-=.09*w;return p.lerp(ready,readyWeight(t)).toArray();}};
 data.rotation={evaluate:t=>Q().fromArray(sourceRotation.evaluate(t)).slerp(readyQ,readyWeight(t)).normalize().toArray()};
 const c={...structuredClone(src),rightArmRefined:true,tracks:Object.fromEntries(Object.keys(src.tracks).map(n=>[n,[]])),hips:[],weaponPositions:[],weaponRotations:[]};
 for(let i=0;i<src.times.length;i++){
  const time=src.times[i],dt=i?time-src.times[i-1]:1/120;h.rig.restore();pose(time);h.rig.apply(fieldHeroAction('kain',clip,time,name),false,false,dt,name);h.root.updateMatrixWorld(true);
  for(const[n,a]of Object.entries(c.tracks))b[n].quaternion.toArray(a,a.length);b.Hips.position.toArray(c.hips,c.hips.length);
  const q=h.weapon.getWorldQuaternion(Q()),p=h.weapon.getWorldPosition(V()).addScaledVector(V().set(0,1,0).applyQuaternion(q),-.085);h.model.worldToLocal(p).toArray(c.weaponPositions,c.weaponPositions.length);h.model.getWorldQuaternion(Q()).invert().multiply(q).normalize().toArray(c.weaponRotations,c.weaponRotations.length);
 }
 // Finish in the same ready grip, then filter the recorded coupled pose.
 for(let i=0;i<c.times.length;i++){const w=T.MathUtils.smootherstep(c.times[i],c.duration-.20,c.duration);if(!w)continue;for(const a of Object.values(c.tracks))Q().fromArray(a,i*4).slerp(Q().fromArray(a),w).normalize().toArray(a,i*4);for(const a of [c.hips,c.weaponPositions])V().fromArray(a,i*3).lerp(V().fromArray(a),w).toArray(a,i*3);Q().fromArray(c.weaponRotations,i*4).slerp(Q().fromArray(c.weaponRotations),w).normalize().toArray(c.weaponRotations,i*4);}
 const arrays=[...Object.entries(c.tracks).filter(([n])=>/(Arm|ForeArm|Hand)$/.test(n)).map(([,a])=>[a,4]),[c.weaponPositions,3],[c.weaponRotations,4]];
 for(let pass=0;pass<24;pass++)for(const[a,stride]of arrays){const old=a.slice();for(let i=1;i<c.times.length-1;i++){if(stride===4){const q=Q().fromArray(old,i*4),mean=Q().fromArray(old,(i-1)*4).slerp(Q().fromArray(old,(i+1)*4),.5);q.slerp(mean,.5).normalize().toArray(a,i*4);}else for(let k=0;k<3;k++)a[i*3+k]=.5*old[i*3+k]+.25*(old[(i-1)*3+k]+old[(i+1)*3+k]);}}
 out[name]=c;console.log('refined',name);h.dispose(h.root.parent);
}
// Project the filtered poses back onto the coupled rigid grip. Filtering an
// elbow independently can put the wrist/forearm through the chest between keys.
HERO_MELEE_DATA.kain=out;
for(const[name,c]of Object.entries(out)){
 const h=new Animated(asset,new T.Scene(),true,false,weapon,'kain'),b={};h.model.traverse(o=>{if(o.isBone)b[o.name.replace(/^mixamorig:?/,'')]=o;});const clip=h.clips[name],pose=makePoser(h.model,clip),data=h.model.userData.heroSkillMotion[name];data.naturalArms=true;data.naturalCenterWeight=10000;
 for(let i=0;i<c.times.length;i++){
  const t=c.times[i],dt=i?t-c.times[i-1]:1/120;h.rig.restore();pose(t);if(i===0){data.weaponBaked=true;h.rig.apply(fieldHeroAction('kain',clip,t,name),false,false,dt,name);}data.weaponBaked=false;data.explicitWeaponPath=true;
  for(let j=0;j<8;j++){h.rig.restore();pose(t);h.rig.apply(fieldHeroAction('kain',clip,t,name),false,false,dt/8,name);}h.root.updateMatrixWorld(true);
  for(const[n,a]of Object.entries(c.tracks))b[n].quaternion.toArray(a,i*4);const q=h.weapon.getWorldQuaternion(Q()),p=h.weapon.getWorldPosition(V()).addScaledVector(V().set(0,1,0).applyQuaternion(q),-.085);h.model.worldToLocal(p).toArray(c.weaponPositions,i*3);h.model.getWorldQuaternion(Q()).invert().multiply(q).normalize().toArray(c.weaponRotations,i*4);
 }
 h.dispose(h.root.parent);
}
// The support arm's old axial roll folds the elbow skin on the sparse mobile
// mesh. A bounded -20 degree humeral roll was compared against +/-10/20 degrees
// on both actual meshes. Compensate the forearm: joint positions, palms and the
// rigid blade do not move. This is a skin orientation correction, not scaling.
const probeRig=new Animated(asset,new T.Scene(),true,false,weapon,'kain'),probeBones={};probeRig.model.traverse(o=>{if(o.isBone)probeBones[o.name.replace(/^mixamorig:?/,'')]=o;});
const roll=new T.Quaternion().setFromAxisAngle(probeBones.LeftForeArm.position.clone().normalize(),-.35),undo=roll.clone().invert();
for(const c of Object.values(out)){for(let i=0;i<c.times.length;i++){Q().fromArray(c.tracks.LeftArm,i*4).multiply(roll).normalize().toArray(c.tracks.LeftArm,i*4);undo.clone().multiply(Q().fromArray(c.tracks.LeftForeArm,i*4)).normalize().toArray(c.tracks.LeftForeArm,i*4);}}
probeRig.dispose(probeRig.root.parent);
for(const c of Object.values(out)){
 for(let i=0;i<c.times.length;i++){const w=T.MathUtils.smootherstep(c.times[i],c.duration-.35,c.duration);if(!w)continue;for(const a of Object.values(c.tracks))Q().fromArray(a,i*4).slerp(Q().fromArray(a),w).normalize().toArray(a,i*4);for(const a of [c.hips,c.weaponPositions])V().fromArray(a,i*3).lerp(V().fromArray(a),w).toArray(a,i*3);Q().fromArray(c.weaponRotations,i*4).slerp(Q().fromArray(c.weaponRotations),w).normalize().toArray(c.weaponRotations,i*4);}
 for(const a of [...Object.values(c.tracks),c.hips,c.weaponPositions,c.weaponRotations])for(let i=0;i<a.length;i++)a[i]=+a[i].toFixed(7);
}
fs.writeFileSync(process.argv[3]||'js/hero-melee-data.js','// Offline-authored two-hand greatsword takes with corrected right-arm reach; shared GLBs and combat clocks unchanged.\nexport const HERO_MELEE_DATA='+JSON.stringify({kain:out})+';\n');
