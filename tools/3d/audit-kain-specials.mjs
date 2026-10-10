// Exhaustive diagnostics, not approval. Do not stop at the first bad frame.
import fs from 'node:fs';import vm from 'node:vm';
import * as T from '../../vendor/three/three.module.js';import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {Animated} from '../../js/party-avatar.js';import {fieldHeroAction} from '../../js/mmo/hero-motion.js';import {makePoser} from './pose-eval.mjs';
import {HERO_SKILL_DATA} from '../../js/hero-skill-data.js';import {prepareArmSurface,armSurfaceNow} from './arm-surface-audit.mjs';
globalThis.window=globalThis;for(const f of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+f+'.js','utf8'));
const load=async f=>{const b=fs.readFileSync(f),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const out={at:new Date().toISOString(),visualApproval:false,models:{}};
function bladeDistance(weapon,target){let best=Infinity;const origin=weapon.getWorldPosition(new T.Vector3()),axis=new T.Vector3(0,1,0).transformDirection(weapon.matrixWorld),tri=new T.Triangle(),near=new T.Vector3();weapon.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,idx=o.geometry.index;for(let i=0;i<(idx?.count||p.count);i+=3){const v=[tri.a,tri.b,tri.c];for(let j=0;j<3;j++)v[j].fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld);if(!v.every(p=>p.clone().sub(origin).dot(axis)>.30))continue;tri.closestPointToPoint(target,near);if(near.distanceTo(target)<best){best=near.distanceTo(target);bladeDistance.near=near.clone();}}});return best;}
for(const lod of [false,true]){
 const scene=new T.Scene(),p=lod?'lod/':'',h=new Animated(await load('art/3d/'+p+'kain_anim.glb'),scene,true,false,await load('art/3d/'+p+'gear/w_kain_greatsword.glb'),'kain'),bones={};h.model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
 const surfaces={all:prepareArmSurface(h.model),Right:prepareArmSurface(h.model,{side:'Right',boundary:true}),Left:prepareArmSurface(h.model,{side:'Left',boundary:true})},rows={};
 for(const[name,c]of Object.entries(HERO_SKILL_DATA.kain)){
  const pose=makePoser(h.model,h.clips[name]),prev={},r={min:{},max:{},faults:[]},measure=(bucket,k,value,t)=>{if(r[bucket][k]===undefined||(bucket==='min'?value<r[bucket][k].value:value>r[bucket][k].value))r[bucket][k]={value,phase:t};};
  for(let i=0;i<=240;i++){
   const t=c.duration*i/240;h.rig.restore();pose(t);h.rig.apply(fieldHeroAction('kain',h.clips[name],t,name),false,false,c.duration/240,name);h.root.updateMatrixWorld(true);const d=h.rig.diagnostics;
   for(const side of ['Left','Right'])for(const k of ['TorsoClearance','UpperArmClearance']){measure('min',side+k,d[side+k],i/240);if(d[side+k]<=.18)r.faults.push([i/240,side+k,d[side+k]]);}
   for(const side of ['Left','Right'])measure('max',side+'WristBend',d[side+'WristBend'],i/240);
   const ev=name==='ult'?TW_DUNGEONS.SKILLS.kainUlt.ev:TW_DUNGEONS.SKILLS.kain[Number(name.at(-1))-1].ev;
   if(ev.hits?.some(([f])=>Math.round(f*240)===i)){const distance=bladeDistance(h.weapon,new T.Vector3(0,1.65,1.4));measure('max','bladeContactDistance',distance,i/240);if(distance>=.39)r.faults.push([i/240,'bladeContactDistance',distance,'nearest',bladeDistance.near.toArray()]);}
   for(const n of ['RightArm','RightForeArm','LeftArm','LeftForeArm']){const q=bones[n].quaternion.clone().normalize();if(prev[n]){const rate=q.angleTo(prev[n])/(c.duration/240);measure('max',n+'Rate',rate,i/240);if(rate>=20)r.faults.push([i/240,n+'Rate',rate]);}prev[n]=q;}
   if(i%4===0)for(const[k,region]of Object.entries(surfaces)){const s=armSurfaceNow(region);for(const prop of ['collapsedFraction','stretchedFraction','collapsedAreaFraction'])measure('max',k+prop,s[prop],i/240);}
  }rows[name]=r;
 }out.models[lod?'mobile':'original']=rows;h.dispose(scene);
}
console.log(JSON.stringify(out,null,2));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n');
