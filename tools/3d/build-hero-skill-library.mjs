// Reproducible read-only retarget of local Mixamo takes. Generated animation
// data is separate from original body/skin/clothes assets.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {repairAinBind,repairAinClips} from '../../js/ain-bind-repair.js';
import {aimScytheBlade,makeAinRigAdapter} from '../../js/ain-two-hand.js';
let readyPose;
async function bookendAin(clip){
 if(!readyPose){
  const bytes=await readFile('art/3d/ain_anim.glb'),loader=new GLTFLoader();loader.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
  const asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const root=new T.Group();root.add(asset.scene);
  const repair=repairAinBind(asset.scene),clips=repairAinClips(asset.animations,repair),bones={};asset.scene.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
  const rig=makeAinRigAdapter(asset.scene,root,bones.RightHandSlot),mixer=new T.AnimationMixer(asset.scene);mixer.clipAction(clips.find(c=>c.name==='idle')).play();
  for(let i=0;i<30;i++){rig.restore();mixer.update(1/60);rig.apply(null,false,false,1/60,'idle');}
  readyPose={rotations:Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,b.quaternion.clone()])),hips:bones.Hips.position.clone(),weaponPosition:bones.RightHandSlot.getWorldPosition(new T.Vector3()).add(bones.LeftHandSlot.getWorldPosition(new T.Vector3())).multiplyScalar(.5),weaponRotation:bones.RightHandSlot.getWorldQuaternion(new T.Quaternion())};
 }
 const entry=clip.name==='skill2'?.10:clip.name==='counter'?.16:.24,exit=['skill1','skill3','ult','counter'].includes(clip.name)?.40:.22,original=clip.duration,times=[],tracks=Object.fromEntries(Object.keys(clip.tracks).map(n=>[n,[]])),hips=[],weaponPositions=[],weaponRotations=[];
 const add=(time,phase,index)=>{
  times.push(+time.toFixed(5));
  const ease=phase==null?null:T.MathUtils.smootherstep(phase,0,1);
  for(const [name,values]of Object.entries(clip.tracks)){
   const q=new T.Quaternion().fromArray(values,index*4);
   if(ease!=null)q.slerp(readyPose.rotations[name],ease);
   q.toArray(tracks[name],tracks[name].length);
  }
  const p=new T.Vector3().fromArray(clip.hips,index*3);if(ease!=null)p.lerp(readyPose.hips,ease);p.toArray(hips,hips.length);
  const wp=new T.Vector3().fromArray(clip.weaponPositions,index*3),wq=new T.Quaternion().fromArray(clip.weaponRotations,index*4);
  if(ease!=null){wp.lerp(readyPose.weaponPosition,ease);wq.slerp(readyPose.weaponRotation,ease);}
  wp.toArray(weaponPositions,weaponPositions.length);wq.toArray(weaponRotations,weaponRotations.length);
 };
 for(let k=0;k<8;k++)add(entry*k/8,1-k/8,0);
 for(let i=0;i<clip.times.length;i++)add(entry+clip.times[i],null,i);
 for(let k=1;k<=8;k++)add(entry+original+exit*k/8,k/8,clip.times.length-1);
 clip.times=times;clip.tracks=tracks;clip.hips=hips;clip.weaponPositions=weaponPositions;clip.weaponRotations=weaponRotations;clip.duration=entry+original+exit;clip.entry=entry;clip.exit=exit;
}
async function calibrateAinGrip(clip){
 const bytes=await readFile('art/3d/ain_anim.glb'),loader=new GLTFLoader();loader.register(()=>({name:'nr',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');repairAinBind(asset.scene);
 const b={};asset.scene.traverse(o=>{if(o.isBone)b[o.name.replace(/^mixamorig:?/,'')]=o;});
 const i=Math.round((clip.times.length-1)*.12);
 for(const [n,values]of Object.entries(clip.tracks))if(b[n])b[n].quaternion.fromArray(values,i*4);
 b.Hips.position.fromArray(clip.hips,i*3);asset.scene.updateMatrixWorld(true);
 const palm=side=>b[side+'HandSlot'].getWorldPosition(new T.Vector3()),axis=palm('Right').sub(palm('Left')).normalize();
 clip.weaponLocal=b.RightHand.getWorldQuaternion(new T.Quaternion()).invert().multiply(aimScytheBlade(axis)).toArray();
 clip.weaponPositions=[];clip.weaponRotations=[];
 for(let k=0;k<clip.times.length;k++){
  for(const [name,values]of Object.entries(clip.tracks))if(b[name])b[name].quaternion.fromArray(values,k*4);
  b.Hips.position.fromArray(clip.hips,k*3);asset.scene.updateMatrixWorld(true);
  const q=b.RightHand.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().fromArray(clip.weaponLocal));
  const p=palm('Right').addScaledVector(new T.Vector3(0,1,0).applyQuaternion(q),-.16);
  p.toArray(clip.weaponPositions,clip.weaponPositions.length);q.toArray(clip.weaponRotations,clip.weaponRotations.length);
 }
}
const sourceDir=resolve(process.argv[2]),output=resolve('js/hero-skill-data.js');
const catalog=JSON.parse(await readFile('art/anim/mixamo_heroes/clips.json','utf8'));
const data={};
await mkdir(resolve(sourceDir,'retarget'),{recursive:true});
for(const [char,entries]of Object.entries(catalog)){
 if(char.startsWith('_'))continue;
 data[char]={};
 for(const [key,label]of Object.entries(entries)){
  const name=key==='R'?'ult':'skill'+key,out=resolve(sourceDir,'retarget',`${char}-${name}.json`);
  const args=['tools/3d/meshy-retarget.mjs',resolve(sourceDir,`${char}_${key}.glb`),name,'--rig','mixamo','--fps','30','--target',`art/3d/${char}_anim.glb`,'--out',out];
  // Great Sword Slash contains three separate cuts. Skill 1 is ONE deliberate
  // cut, not three damage-less extra swings or a triple-speed whole take.
  if(char==='ain'&&key==='1')args.splice(3,0,'0','1.4');
  if(char==='ain')args.push('--ain-repair');
  const result=spawnSync(process.execPath,args,{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr);
  const clip=JSON.parse(await readFile(out,'utf8'));clip.sourceLabel=label;
  if(char==='ain'){await calibrateAinGrip(clip);await bookendAin(clip);}
  data[char][name]=clip;
  console.log(char,name,clip.duration,label);
 }
 if(char==='ain'){
  const out=resolve(sourceDir,'retarget','ain-counter.json');
  const result=spawnSync(process.execPath,['tools/3d/meshy-retarget.mjs',resolve(sourceDir,'ain_1.glb'),'counter','0.43','1.4','--rig','mixamo','--fps','30','--target','art/3d/ain_anim.glb','--ain-repair','--out',out],{encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr);
  data.ain.counter=JSON.parse(await readFile(out,'utf8'));data.ain.counter.sourceLabel='Great Sword Slash · riposte';
  await calibrateAinGrip(data.ain.counter);
  await bookendAin(data.ain.counter);
 }
}
await writeFile(output,'// Generated by tools/3d/build-hero-skill-library.mjs; original GLBs untouched.\nexport const HERO_SKILL_DATA='+JSON.stringify({ain:data.ain})+';\n');
