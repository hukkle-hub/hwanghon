import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {sampleAction,makeRigAdapter} from '../js/combat-motion.js';
async function model(path){
 const data=await readFile(path),loader=new GLTFLoader();
 // Geometry, skin weights and animations are real. Raster decoding is irrelevant to this test.
 loader.register(()=>({name:'test-no-raster',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
 return loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
}
test('clip contact and combat impact remain aligned at every attack speed',()=>{
 for(const speed of [.7,1,1.125,1.6]){const a={duration:.66/speed,hitAt:.24/speed,clipHit:.42,elapsed:.24/speed};assert.ok(Math.abs(sampleAction(a,1.9)-1.9*.42)<1e-10);a.elapsed=a.duration;assert.equal(sampleAction(a,1.9),1.9);}
});
test('real Ain rig: required clips, finite transforms and bounded grip correction',async t=>{
 const g=await model('art/3d/ain_anim.glb'),root=new THREE.Group();root.add(g.scene);
 let slot;g.scene.traverse(o=>{if(o.isBone&&/RightHandSlot/.test(o.name))slot=o;});assert.ok(slot);
 const rig=makeRigAdapter(g.scene,root,slot),mixer=new THREE.AnimationMixer(g.scene);
 for(const n of ['LeftArm','LeftForeArm','LeftHand','LeftUpLeg','LeftLeg','LeftFoot'])assert.ok(rig.bones[n],n);
 let maxGrip=0,maxFoot=0;
 for(const name of ['idle','run','guard','attack1','attack2','attack3','smash','ult','roll','hit','death']){
  const clip=g.animations.find(c=>c.name===name);assert.ok(clip,name);mixer.stopAllAction();const act=mixer.clipAction(clip);act.play();act.paused=true;
  for(let i=0;i<40;i++){
   rig.restore();act.time=clip.duration*i/40;mixer.update(0);const a=/attack|smash|ult/.test(name)?{id:name,duration:1,elapsed:i/40,kind:'attack'}:null;
   rig.apply(a,name==='run'||name==='roll',name==='guard',.01);
   maxGrip=Math.max(maxGrip,rig.diagnostics.gripError);maxFoot=Math.max(maxFoot,rig.diagnostics.footError);
   g.scene.traverse(o=>{if(o.isBone){assert.ok(o.matrixWorld.elements.every(Number.isFinite),name+':'+o.name);assert.ok(Math.abs(o.quaternion.length()-1)<1e-5);}});
  }
 }
 t.diagnostic(`Maximum grip error ${maxGrip.toFixed(3)}m; foot target error ${maxFoot.toFixed(3)}m`);
 assert.ok(maxGrip<.05,`grip slipped ${maxGrip}m`);assert.ok(maxFoot<.12,`foot error ${maxFoot}m`);
});
test('scarecrow contains anticipation, hit, stagger, down, recovery and death clips',async()=>{
 const g=await model('art/3d/boss_anim.glb');for(const name of ['idle','walk','atk_hammer','atk_bolt','atk_scythe','hit','stagger','down','up','death'])assert.ok(g.animations.some(c=>c.name===name),name);
});
