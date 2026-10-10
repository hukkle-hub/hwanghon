// Actual online Animated.update pipeline, in addition to explicit-track audit.
import fs from 'node:fs';import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import * as T from '../../vendor/three/three.module.js';import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {Animated} from '../../js/party-avatar.js';import {fieldHeroAction} from '../../js/mmo/hero-motion.js';import {makePoser} from './pose-eval.mjs';
import {prepareArmSurface,armSurfaceNow} from './arm-surface-audit.mjs';
import {prepareFootSurface,footSurfaceNow} from './foot-surface-audit.mjs';
globalThis.window=globalThis;for(const f of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+f+'.js','utf8'));
const load=async f=>{const b=fs.readFileSync(f),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const fps=Number(process.argv.find(s=>s.startsWith('--fps='))?.split('=')[1]||60);if(![20,30,60,120].includes(fps))throw Error('Unsupported audit rate');
export const report={at:new Date().toISOString(),fps,visualApproval:false,models:{}};const out=report;
for(const lod of [false,true]){
 const scene=new T.Scene(),p=lod?'lod/':'',asset=await load('art/3d/'+p+'kain_anim.glb'),weapon=await load('art/3d/'+p+'gear/w_kain_greatsword.glb'),h=new Animated(asset,scene,true,false,weapon,'kain'),reference=new Animated(asset,scene,true,false,weapon,'kain'),bones={},rb={},prev={},dt=1/fps;
 h.trail.dispose();h.trail=null;h.model.traverse(b=>{if(b.isBone)bones[b.name.replace(/^mixamorig:?/,'')]=b;});reference.model.traverse(b=>{if(b.isBone)rb[b.name.replace(/^mixamorig:?/,'')]=b;});
 const surfaces=prepareArmSurface(h.model),regions=Object.fromEntries(['Left','Right'].map(side=>[side,prepareArmSurface(h.model,{side,boundary:true})]));
 const feet=prepareFootSurface(h.model);
 const sourceArms={},apply=h.rig.apply;h.rig.apply=(...args)=>{for(const k of ['RightArm','RightForeArm','LeftArm','LeftForeArm'])sourceArms[k]=bones[k].quaternion.clone();return apply(...args);};
 const rows={},base={x:0,y:0,aim:Math.PI/2,hp:1,rollT:0,moving:false,guard:false},steps=[['idle',1]];
 for(const n of ['attack1','attack2','attack3','smash','counter','exec','skill1','skill2','skill3','skill4','ult'])steps.push([n,h.clips[n].duration],['idle',.4]);
 steps.push(['run',.5],['idle',.4],['guard',.5],['idle',.4],['roll',.32],['idle',.4],['skill1',h.clips.skill1.duration*.55],['roll',.32],['idle',.4]);
 let serial=0,oldWeapon=null;
 for(const[n,duration]of steps){const key=n+'-'+serial++,row=rows[key]={maxArmRate:0,maxGripGap:0,maxRightGripGap:0,maxBodyTrackError:0,maxSourceArmError:0,maxSwordSpeed:0,maxWristBend:0,minUpperClearance:Infinity,minForeClearance:Infinity,maxCollapsedFraction:0,maxStretchedFraction:0,maxSeamCollapse:0,maxSeamStretch:0,frames:0,sourceErrors:[]};const clip=h.clips[n],pose=makePoser(reference.model,clip);
  row.minFootHeight=Infinity;row.maxSupportFootHeight=-Infinity;row.maxFootSink=0;row.transitionAliased=false;row.visibleBufferReused=true;row.transitionSnapshotMutations=0;const timings=[];
  for(let i=0;i<Math.ceil(duration/dt);i++){
   const time=Math.min(duration,i*dt),a=fieldHeroAction('kain',clip,time,key);if(a)a.clipHit=a.hitAt/a.duration;const data={...base,moving:n==='run',guard:n==='guard',rollT:n==='roll'?Math.max(.00001,.32-time):0,action:a};
   const oldBuffer=h.poseBridge?.presentedPose,oldTransition=h.poseBridge?.transition?.pose,oldFrozen=oldTransition?.map(([,p,q,s])=>[...p.toArray(),...q.toArray(),...s.toArray()]),t0=performance.now();h.update(data,dt,0);timings.push(performance.now()-t0);
   if(oldBuffer&&oldBuffer!==h.poseBridge?.presentedPose)row.visibleBufferReused=false;row.transitionAliased ||= h.poseBridge?.transition?.pose===h.poseBridge?.presentedPose;
   if(oldTransition&&oldTransition===h.poseBridge?.transition?.pose)for(let j=0;j<oldTransition.length;j++){const[,p,q,s]=oldTransition[j],now=[...p.toArray(),...q.toArray(),...s.toArray()];for(let k=0;k<now.length;k++)if(now[k]!==oldFrozen[j][k])row.transitionSnapshotMutations++;}
   if(!Number.isFinite(h.current.time))throw Error('Invalid runtime clock '+key);h.root.updateMatrixWorld(true);pose(h.current.time);
   if(a&&time>.24)for(const k of ['Hips','Spine','RightUpLeg','LeftUpLeg'])row.maxBodyTrackError=Math.max(row.maxBodyTrackError,bones[k].quaternion.angleTo(rb[k].quaternion));
   if(a&&time>.24)for(const k of Object.keys(sourceArms)){const error=sourceArms[k].angleTo(rb[k].quaternion);row.maxSourceArmError=Math.max(row.maxSourceArmError,error);if(error>.05)row.sourceErrors.push([time,k,error]);}
   const diag=h.rig.diagnostics;for(const side of ['Left','Right']){row.maxWristBend=Math.max(row.maxWristBend,diag[side+'WristBend']);row.minUpperClearance=Math.min(row.minUpperClearance,diag[side+'UpperArmClearance']);row.minForeClearance=Math.min(row.minForeClearance,diag[side+'TorsoClearance']);}
   if(i%4===0){const f=footSurfaceNow(feet),min=Math.min(f.Left,f.Right);row.minFootHeight=Math.min(row.minFootHeight,min);row.maxSupportFootHeight=Math.max(row.maxSupportFootHeight,min);row.maxFootSink=Math.max(row.maxFootSink,-min);const s=armSurfaceNow(surfaces);row.maxCollapsedFraction=Math.max(row.maxCollapsedFraction,s.collapsedFraction);row.maxStretchedFraction=Math.max(row.maxStretchedFraction,s.stretchedFraction);for(const region of Object.values(regions)){const seam=armSurfaceNow(region);row.maxSeamCollapse=Math.max(row.maxSeamCollapse,seam.collapsedFraction);row.maxSeamStretch=Math.max(row.maxSeamStretch,seam.stretchedFraction);}}
   for(const k of ['RightArm','RightForeArm','LeftArm','LeftForeArm']){const q=bones[k].getWorldQuaternion(new T.Quaternion());if(prev[k]){const rate=q.angleTo(prev[k])/dt;if(rate>row.maxArmRate){row.maxArmRate=rate;row.peak=k+'@'+time.toFixed(3);}}prev[k]=q;}
   const origin=h.weapon.getWorldPosition(new T.Vector3()),axis=new T.Vector3(0,1,0).transformDirection(h.weapon.matrixWorld),palm=s=>bones[s+'Hand'].userData.gripPoint.clone().applyMatrix4(bones[s+'Hand'].matrixWorld);
   row.maxGripGap=Math.max(row.maxGripGap,palm('Left').distanceTo(origin.clone().addScaledVector(axis,-.17)));row.maxRightGripGap=Math.max(row.maxRightGripGap,palm('Right').distanceTo(origin));
   if(oldWeapon)row.maxSwordSpeed=Math.max(row.maxSwordSpeed,oldWeapon.distanceTo(origin)/dt);oldWeapon=origin;row.frames++;
  }timings.sort((a,b)=>a-b);row.updateCpuMs={mean:timings.reduce((a,b)=>a+b,0)/timings.length,p95:timings[Math.floor(timings.length*.95)],max:timings.at(-1),note:'Local Node CPU only; not GPU/render, network or S25 device measurement'};
 }out.models[lod?'mobile':'original']=rows;h.dispose(scene);reference.dispose(scene);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){console.log(JSON.stringify(out,null,2));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n');}
