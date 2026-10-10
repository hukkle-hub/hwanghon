// Deterministic 60 Hz ready -> complete action -> ready playback, both LODs.
// This detects connection snaps which isolated action/contact checks miss.
import fs from 'node:fs';import vm from 'node:vm';import {pathToFileURL} from 'node:url';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';import {makePoser} from './pose-eval.mjs';
import {Animated} from '../../js/party-avatar.js';import {fieldHeroAction} from '../../js/mmo/hero-motion.js';
globalThis.window=globalThis;for(const f of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+f+'.js','utf8'));
export const report={at:new Date().toISOString(),dt:1/60,models:{},visualApproval:false};
const loadGlb=async file=>{const raw=fs.readFileSync(file),loader=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])loader.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return loader.parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
for(const lod of [false,true]){
 const prefix=lod?'lod/':'',asset=await loadGlb('art/3d/'+prefix+'kain_anim.glb'),weapon=await loadGlb('art/3d/'+prefix+'gear/w_kain_greatsword.glb'),rows={};
 for(const name of ['attack1','attack2','attack3','smash','counter','exec','skill1','skill2','skill3','skill4','ult']){
  const scene=new T.Scene(),h=new Animated(asset,scene,true,false,weapon,'kain'),bones={};h.model.traverse(b=>{if(b.isBone)bones[b.name.replace(/^mixamorig:?/,'')]=b;});
  const clip=h.clips[name],idle=h.clips.idle,pose=makePoser(h.model,clip),ready=makePoser(h.model,idle),dt=report.dt,previous={};
  const result={duration:clip.duration,maxArmRate:0,maxSwordRate:0,maxSwordSpeed:0,gripGap:0,rightGripGap:0,stages:{}};let swordQ=null,swordP=null;
  const step=(stage,time)=>{
   h.rig.restore();if(stage==='action')pose(time);else ready(time%idle.duration);
   h.rig.apply(stage==='action'?fieldHeroAction('kain',clip,time,name):null,false,false,dt,stage==='action'?name:'idle');h.root.updateMatrixWorld(true);
   const row=result.stages[stage]??={maxArmRate:0,maxSwordRate:0,maxSwordSpeed:0};let frameArmRate=0;
   for(const n of ['RightArm','RightForeArm','LeftArm','LeftForeArm']){const q=bones[n].getWorldQuaternion(new T.Quaternion());if(previous[n]){const rate=q.angleTo(previous[n])/dt;frameArmRate=Math.max(frameArmRate,rate);if(rate>result.maxArmRate){result.maxArmRate=rate;result.peak=n+' '+stage+'@'+time.toFixed(3);}row.maxArmRate=Math.max(row.maxArmRate,rate);}previous[n]=q;}
   const q=h.weapon.getWorldQuaternion(new T.Quaternion()),p=h.weapon.getWorldPosition(new T.Vector3());
   if(swordQ){const rate=q.angleTo(swordQ)/dt,speed=p.distanceTo(swordP)/dt;result.maxSwordRate=Math.max(result.maxSwordRate,rate);result.maxSwordSpeed=Math.max(result.maxSwordSpeed,speed);row.maxSwordRate=Math.max(row.maxSwordRate,rate);row.maxSwordSpeed=Math.max(row.maxSwordSpeed,speed);if(time===0&&stage!=='ready')result[stage+'Boundary']={maxArmRate:frameArmRate,maxSwordRate:rate,maxSwordSpeed:speed};}swordQ=q;swordP=p;
   result.gripGap=Math.max(result.gripGap,h.rig.diagnostics.gripError||0);result.rightGripGap=Math.max(result.rightGripGap,h.rig.diagnostics.rightGripError||0);
  };
  for(let i=0;i<60;i++)step('ready',i*dt);
  const frames=Math.ceil(clip.duration/dt);for(let i=0;i<=frames;i++)step('action',Math.min(clip.duration,i*dt));
  for(let i=0;i<90;i++)step('recovery',i*dt);
  rows[name]=result;h.dispose(scene);
 }
 report.models[lod?'mobile':'original']=rows;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){console.log(JSON.stringify(report,null,2));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');}
