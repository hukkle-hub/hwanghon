import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {HERO_LOCOMOTION_DATA} from '../js/hero-locomotion-data.js';
import {movementSpeed,approachSpeed,gaitWeights,applyHeroLocomotionClips,createHeroLocomotion} from '../js/hero-locomotion.js';
import {Animated} from '../js/party-avatar.js';
import {prepareFootSurface,footSurfaceNow} from '../js/skinned-sole.js';
import {createCoupledPoseBridge} from '../js/coupled-pose-bridge.js';
globalThis.window=globalThis;
for(const n of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+n+'.js','utf8'));
async function load(file){const b=fs.readFileSync(file),loader=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])loader.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}

test('continuous stick speed and acceleration have no former 55% speed jump',()=>{
 assert.ok(movementSpeed(.551)-movementSpeed(.549)<.02);
 assert.equal(movementSpeed(2),4.8);assert.equal(movementSpeed(-1),0);assert.equal(movementSpeed(NaN),0);
 let speed=0;for(let i=0;i<120;i++)speed=approachSpeed(speed,4.8,1/60);
 assert.ok(speed>4.79&&speed<4.8);assert.equal(approachSpeed(.01,0,1/60),0);
 for(let s=0;s<=5;s+=.05){const w=gaitWeights(s);assert.ok(Object.values(w).every(v=>v>=0&&v<=1));assert.ok(Math.abs(w.idle+w.walk+w.run-1)<1e-10);}
 // Negative control: old discontinuity is not an acceptable speed mapping.
 const old=m=>m<.55?2.2:4.6;assert.ok(old(.551)-old(.549)>2);
});
test('all 16 retargeted loops are finite, unit quaternions, in-place and seam closed',()=>{
 for(const [char,clips]of Object.entries(HERO_LOCOMOTION_DATA))for(const [name,d]of Object.entries(clips)){
  assert.match(d.source,/CC0/);assert.ok(d.times.length>=30);assert.equal(d.times[0],0);assert.ok(Math.abs(d.times.at(-1)-d.duration)<1e-5);
  for(let i=0;i<d.times.length;i++){if(i)assert.ok(d.times[i]>d.times[i-1]);assert.equal(d.hips[i*3],d.hips[0]);assert.equal(d.hips[i*3+2],d.hips[2]);}
  for(const [bone,v]of Object.entries(d.tracks)){assert.equal(v.length,d.times.length*4);assert.ok(v.every(Number.isFinite));for(let i=0;i<v.length;i+=4)assert.ok(Math.abs(Math.hypot(...v.slice(i,i+4))-1)<1e-5,char+name+bone);assert.ok(new T.Quaternion().fromArray(v).angleTo(new T.Quaternion().fromArray(v,v.length-4))<.001);}
 }
});
test('distance clock retains phase through walk/run/combat/stop; actions remain mixer-owned',async()=>{
 const asset=await load('art/3d/lod/ryu_anim.glb'),model=asset.scene,old=asset.animations.find(c=>c.name==='attack1'),clips=Object.fromEntries(applyHeroLocomotionClips(model,asset.animations,'ryu').map(c=>[c.name,c])),l=createHeroLocomotion(model,clips);
 assert.equal(clips.attack1,old);assert.equal(l.select(0,false),'travelIdle');assert.equal(l.select(0,true),'combatIdle');assert.equal(l.select(1.5,true),'walk');assert.equal(l.select(4.8,false),'run');
 let expected=0,previous=0;for(const speed of [1.5,1.5,4.8,4.8,1.5,0,0,1.5]){l.restore();l.apply(1/60,{speed,combat:true});const d=l.diagnostics;expected=(expected+speed/60/d.cycleDistance)%1;assert.ok(Math.abs(d.phase-expected)<1e-9);if(!speed)assert.equal(d.phase,previous);previous=d.phase;}
 l.restore();const hip=model.getObjectByName('Hips')||model.getObjectByName('mixamorig:Hips');if(hip){hip.position.y=123;l.apply(1/60,{active:false});assert.equal(hip.position.y,123);}
 // Negative control: selecting a new gait must not reset a nonzero phase.
 assert.notEqual(l.diagnostics.phase,0);
});
test('production Animated carries weapons and keeps original/mobile soles above floor across movement transitions',async()=>{
 for(const char of ['ain','kain','ryu','sera'])for(const lod of [true,false]){
  const p=lod?'lod/':'',weapon=char==='ain'?'ain_scythe_tex':p+'gear/'+({kain:'w_kain_greatsword',ryu:'w_ash_dirk',sera:'w_sera_flask'}[char]);
  const scene=new T.Scene(),h=new Animated(await load('art/3d/'+p+char+'_anim.glb'),scene,true,false,await load('art/3d/'+weapon+'.glb'),char),feet=prepareFootSurface(h.model);h.trail?.dispose();h.trail=null;let speed=0,z=0;
  for(let i=0;i<300;i++){const target=i<60?0:i<120?1.5:i<240?4.8:0;speed=approachSpeed(speed,target,1/60);z+=speed/60;h.update({x:0,y:z*27.5,aim:Math.PI/2,hp:1,moving:speed>.01,speed,combat:i>150,guard:false,rollT:0},1/60,0);h.root.updateMatrixWorld(true);if(i%10===0){const sole=footSurfaceNow(feet);assert.ok(Math.min(sole.Left,sole.Right)>=-.002,char+' sole');if(['ain','kain'].includes(char))assert.ok(Math.max(h.rig.diagnostics.gripError||0,h.rig.diagnostics.rightGripError||0)<.003,char+' grip');}assert.ok(h.model.matrixWorld.elements.every(Number.isFinite));}
  assert.equal(h.model.userData.locomotionVersion,58);h.dispose(scene);
 }
});

test('gait blending does not extend authored attack connection past its 220 ms budget',()=>{
 const model=new T.Group(),bone=new T.Bone();bone.name='Hips';model.add(bone);model.userData.locomotionVersion=58;
 const bridge=createCoupledPoseBridge(model);bridge.apply(1/60,'walk');bridge.capture();
 bone.position.y=1;model.userData.locomotionActive=false;
 for(let i=0;i<15;i++){bridge.restore();bone.position.y=1;bridge.apply(1/60,'attack1');bridge.capture();}
 assert.equal(bridge.transition,null);assert.equal(bone.position.y,1);
 model.userData.locomotionActive=true;bridge.apply(1/60,'run');bridge.capture();
 assert.ok(bridge.transition); // Negative control: a started connection must not disappear immediately.
 for(let i=0;i<19;i++){bridge.restore();bridge.apply(1/60,'run');bridge.capture();}
 assert.equal(bridge.transition,null);
});
