// Deterministic actual skinned carry under solo hit/lean transforms.
import fs from 'node:fs';import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {Animated} from '../../js/party-avatar.js';
import {makePoser} from './pose-eval.mjs';
import {prepareFootSurface,footSurfaceNow} from '../../js/skinned-sole.js';
globalThis.window=globalThis;for(const n of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+n+'.js','utf8'));
const load=async f=>{const b=fs.readFileSync(f),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
export const report={at:new Date().toISOString(),visualApproval:false,models:{}};
for(const lod of [false,true]){
 const p=lod?'lod/':'',scene=new T.Scene(),h=new Animated(await load('art/3d/'+p+'kain_anim.glb'),scene,true,false,await load('art/3d/'+p+'gear/w_kain_greatsword.glb'),'kain'),bones={};
 h.model.traverse(b=>{if(b.isBone)bones[b.name.replace(/^mixamorig:?/,'')]=b;});h.trail?.dispose();h.trail=null;
 const feet=prepareFootSurface(h.model),row={frames:0,maxGap:0,maxResidual:0,maxWristBend:0,minClearance:Infinity,minSole:Infinity,bad:[]};
 for(const clip of ['hit','hit2','guardHit'])for(const direction of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  h.model.rotation.set(0,0,0);for(let j=0;j<30;j++)h.update({x:0,y:0,aim:Math.PI/2,hp:1,moving:false,guard:false,rollT:0},1/60,0);
  const c=h.clips[clip],pose=makePoser(h.model,c);
  for(let i=0;i<=60;i++){
   h.rig.restore();h.poseBridge.restore();pose(c.duration*i/60);h.poseBridge.apply(1/60,clip+direction);const lean=.30*(1-i/60)**2;h.model.rotation.set(lean*Math.cos(direction),0,lean*Math.sin(direction));h.root.rotation.y=direction*.3;h.root.updateMatrixWorld(true);
   h.rig.apply(null,false,clip==='guardHit',1/60,clip,null);h.root.updateMatrixWorld(true);
   h.poseBridge.capture();
   const origin=h.weapon.getWorldPosition(new T.Vector3()),axis=new T.Vector3(0,1,0).transformDirection(h.weapon.matrixWorld),palm=s=>bones[s+'Hand'].userData.gripPoint.clone().applyMatrix4(bones[s+'Hand'].matrixWorld),gap=Math.max(palm('Left').distanceTo(origin.clone().addScaledVector(axis,-.17)),palm('Right').distanceTo(origin)),d=h.rig.diagnostics,f=footSurfaceNow(feet);
   row.frames++;row.maxGap=Math.max(row.maxGap,gap);row.maxResidual=Math.max(row.maxResidual,d.RightResidual,d.LeftResidual);row.maxWristBend=Math.max(row.maxWristBend,d.RightWristBend,d.LeftWristBend);row.minClearance=Math.min(row.minClearance,d.RightTorsoClearance,d.LeftTorsoClearance);row.minSole=Math.min(row.minSole,f.Left,f.Right);
   if(gap>.001||Math.max(d.RightWristBend,d.LeftWristBend)>Math.PI/6||Math.min(d.RightTorsoClearance,d.LeftTorsoClearance)<.18)row.bad.push({clip,direction,phase:i/60,gap,right:d.RightResidual,left:d.LeftResidual,wrist:Math.max(d.RightWristBend,d.LeftWristBend),clearance:Math.min(d.RightTorsoClearance,d.LeftTorsoClearance)});
  }
 }
 report.models[lod?'mobile':'original']=row;h.dispose(scene);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){console.log(JSON.stringify(report,null,2));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');}
