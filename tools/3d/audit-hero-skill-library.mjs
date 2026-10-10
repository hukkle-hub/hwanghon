import fs from 'node:fs';import vm from 'node:vm';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {Animated} from '../../js/party-avatar.js';
import {fieldHeroAction} from '../../js/mmo/hero-motion.js';
globalThis.window=globalThis;vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));vm.runInThisContext(fs.readFileSync('js/dungeons.js','utf8'));
async function load(file){const b=fs.readFileSync(file),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const scene=new T.Scene(),h=new Animated(await load('art/3d/ain_anim.glb'),scene,true,false,await load('art/3d/ain_scythe_tex.glb'),'ain'),report={};
const tip=h.weapon.getObjectByName('AinBladeTip');
for(const name of ['skill1','skill2','skill3','skill4','ult','counter']){
 h.play(name,name);h.current.paused=true;const c=h.current.getClip(),positions=[],vel=[],N=240,prev={};let step=0,gap=0,peakJoint='';
 for(let i=0;i<=N;i++){
  const time=c.duration*i/N;h.rig.restore();h.current.time=time;h.mixer.update(c.duration/N);
  h.rig.apply(fieldHeroAction('ain',c,time,name),false,false,c.duration/N,name);h.root.updateMatrixWorld(true);
  positions.push(tip.getWorldPosition(new T.Vector3()));gap=Math.max(gap,h.rig.diagnostics.gripError);
  for(const n of ['RightArm','RightForeArm','LeftArm','LeftForeArm']){const q=h.rig.bones[n].quaternion;if(prev[n]&&prev[n].angleTo(q)>step){step=prev[n].angleTo(q);peakJoint=n+'@'+(i/N).toFixed(3);}prev[n]=q.clone();}
  if(i)vel.push({phase:i/N,speed:positions[i].distanceTo(positions[i-1])*N/c.duration});
 }
 const peaks=[];for(const p of vel.sort((a,b)=>b.speed-a.speed)){if(peaks.every(q=>Math.abs(q.phase-p.phase)>.12))peaks.push(p);if(peaks.length===4)break;}
 report[name]={duration:c.duration,peaks,stepDegrees:T.MathUtils.radToDeg(step),peakJoint,palmGap:gap,tipFloor:Math.min(...positions.map(p=>p.y)),travel:positions.slice(1).reduce((a,p,i)=>a+p.distanceTo(positions[i]),0)};
}
console.log(JSON.stringify(report,null,2));h.dispose(scene);
