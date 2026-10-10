import fs from 'node:fs';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {Animated} from '../../js/party-avatar.js';
import {fieldHeroAction} from '../../js/mmo/hero-motion.js';
import {prepareArmSurface,armSurfaceNow} from './arm-surface-audit.mjs';
import {makePoser} from './pose-eval.mjs';

globalThis.window=globalThis;
for(const f of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+f+'.js','utf8'));
const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
export function armPoseNow(bones){
 const pos=n=>bones[n].getWorldPosition(V()),up=pos('Spine2').sub(pos('Hips')).normalize(),left=pos('LeftArm').sub(pos('RightArm')).normalize();
 return {elbowDrops:Object.fromEntries(['Right','Left'].map(s=>[s,pos(s+'Arm').sub(pos(s+'ForeArm')).dot(up)])),signedElbowSpacing:pos('LeftForeArm').sub(pos('RightForeArm')).dot(left)};
}
const load=async f=>{const raw=fs.readFileSync(f),loader=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])loader.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return loader.parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');};
const isCLI=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
export const report={at:new Date().toISOString(),scope:['attack1','attack2','attack3','smash','counter','exec'],models:{},rejectedCounterSourcePose:{},rejectedRightArmPose:{}};
for(const lod of [false,true]){
 const scene=new T.Scene(),prefix=lod?'lod/':'',h=new Animated(await load('art/3d/'+prefix+'kain_anim.glb'),scene,true,false,await load('art/3d/'+prefix+'gear/w_kain_greatsword.glb'),'kain'),bones={};
 h.model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
 const surfaces=prepareArmSurface(h.model),regions=Object.fromEntries(['Right','Left'].map(side=>[side,prepareArmSurface(h.model,{side,boundary:true})])),result={};
 for(const name of report.scope){
  h.play(name,name);h.current.paused=true;const c=h.current.getClip(),N=240,dt=c.duration/N,prev={},pose=makePoser(h.model,c);
  const r={duration:c.duration,leftAxisGap:0,leftGripGap:0,rightGap:0,wristDegrees:0,upperClearance:Infinity,foreClearance:Infinity,elbowSeparation:Infinity,minSignedElbowSpacing:Infinity,maxArmRate:0,stretchedFraction:0,collapsedFraction:0,bladeContact:Infinity};
  r.collapsedAreaFraction=0;r.armBoundaries=Object.fromEntries(['Right','Left'].map(s=>[s,{stretchedFraction:0,collapsedFraction:0,collapsedAreaFraction:0}]));
  const hit=c.userData?.contactPhase??TW_DUNGEONS.RULES.motion.clipContactsByChar.kain[name]??TW_DUNGEONS.RULES.motion.clipContacts[name];
  for(let i=0;i<=N;i++){
   h.armBlend?.restore();h.rig.restore();h.current.time=c.duration*i/N;pose(h.current.time);h.rig.apply(fieldHeroAction('kain',c,h.current.time,name),false,false,dt,name);
   if(h.rig.diagnostics.source==='legacy')h.armBlend?.apply(dt);
   h.root.updateMatrixWorld(true);
   const origin=h.weapon.getWorldPosition(V()),axis=V().set(0,1,0).transformDirection(h.weapon.matrixWorld),left=bones.LeftHand.localToWorld(bones.LeftHand.userData.gripPoint.clone()),right=bones.RightHand.localToWorld(bones.RightHand.userData.gripPoint.clone()),d=left.clone().sub(origin);
   r.leftAxisGap=Math.max(r.leftAxisGap,d.clone().addScaledVector(axis,-d.dot(axis)).length());
   r.leftGripGap=Math.max(r.leftGripGap,left.distanceTo(origin.clone().addScaledVector(axis,-.17)));r.rightGap=Math.max(r.rightGap,right.distanceTo(origin));
   for(const side of ['Right','Left']){const angle=T.MathUtils.radToDeg(h.rig.diagnostics[side+'WristBend']||0);if(angle>r.wristDegrees){r.wristDegrees=angle;r.wristPeak=side+'@'+(i/N).toFixed(3);}}
   const base=bones.Hips.getWorldPosition(V()),body=bones.Spine2.getWorldPosition(V()).sub(base),distance=p=>p.distanceTo(base.clone().addScaledVector(body,T.MathUtils.clamp(p.clone().sub(base).dot(body)/body.lengthSq(),0,1)));
   for(const side of ['Right','Left']){
    const a=bones[side+'Arm'].getWorldPosition(V()),b=bones[side+'ForeArm'].getWorldPosition(V()),c=bones[side+'Hand'].getWorldPosition(V());
    for(let j=2;j<=8;j++)r.upperClearance=Math.min(r.upperClearance,distance(a.clone().lerp(b,j/8)));
    for(let j=0;j<=8;j++)r.foreClearance=Math.min(r.foreClearance,distance(b.clone().lerp(c,j/8)));
   }
   r.elbowSeparation=Math.min(r.elbowSeparation,bones.LeftForeArm.getWorldPosition(V()).distanceTo(bones.RightForeArm.getWorldPosition(V())));
   const shape=armPoseNow(bones);r.minSignedElbowSpacing=Math.min(r.minSignedElbowSpacing,shape.signedElbowSpacing);if(Math.round(hit*N)===i)r.contactPose=shape;
   for(const n of ['RightArm','RightForeArm','LeftArm','LeftForeArm']){const q=bones[n].quaternion.clone().normalize();if(prev[n]){const rate=prev[n].angleTo(q)/dt;if(rate>r.maxArmRate){r.maxArmRate=rate;r.ratePeak=n+'@'+(i/N).toFixed(3);}}prev[n]=q;}
   if(i%4===0){const s=armSurfaceNow(surfaces);for(const k of ['stretchedFraction','collapsedFraction','collapsedAreaFraction'])r[k]=Math.max(r[k],s[k]);for(const[side,prepared]of Object.entries(regions)){const region=armSurfaceNow(prepared);for(const k of ['stretchedFraction','collapsedFraction','collapsedAreaFraction'])r.armBoundaries[side][k]=Math.max(r.armBoundaries[side][k],region[k]);}}
   if(Math.round(hit*N)===i){const target=V().set(0,1.65,1.4),tri=new T.Triangle(),near=V();h.weapon.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,index=o.geometry.index;for(let k=0;k<(index?.count||p.count);k+=3){const vs=[tri.a,tri.b,tri.c];for(let j=0;j<3;j++)vs[j].fromBufferAttribute(p,index?index.getX(k+j):k+j).applyMatrix4(o.matrixWorld);if(!vs.every(v=>v.clone().sub(origin).dot(axis)>.3))continue;tri.closestPointToPoint(target,near);r.bladeContact=Math.min(r.bladeContact,near.distanceTo(target));}});}
  }
  result[name]=r;if(isCLI)console.log(lod?'mobile':'original',name,JSON.stringify(r));
 }
 report.models[lod?'mobile':'original']=result;
 // The rejected counter was the unmodified ultimate lift at phase .337.
 // Keep that real source geometry as a negative control, not fabricated stats.
 h.play('ult','rejected-source');h.current.paused=true;h.rig.restore();h.current.time=h.current.getClip().duration*.337;makePoser(h.model,h.current.getClip())(h.current.time);h.rig.apply(fieldHeroAction('kain',h.current.getClip(),h.current.time,'rejected-source'),false,false,1/120,'ult');h.root.updateMatrixWorld(true);report.rejectedCounterSourcePose[lod?'mobile':'original']=armPoseNow(bones);
 // Actual last deployed counter, rejected by the director for its right arm.
 const rejected=JSON.parse(fs.readFileSync('tests/fixtures/kain-rejected-counter-contact.json','utf8'));
 h.rig.restore();for(const[n,q]of Object.entries(rejected.tracks))bones[n].quaternion.fromArray(q);bones.Hips.position.fromArray(rejected.hips);h.root.updateMatrixWorld(true);report.rejectedRightArmPose[lod?'mobile':'original']=armPoseNow(bones);h.dispose(scene);
}
if(isCLI&&process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
