import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {sampleAction,makeRigAdapter} from '../js/combat-motion.js';
import {prepareTrainingMotion,sampleBossAttack} from '../js/boss-motion.js';
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
 /* 범용 어댑터의 그립 보정은 «원본 클립이 이미 두 손으로 쥐고 있을 때» 만 조금 당긴다.
    3타는 Meshy 찌르기(docs/design/74)라 끝에서 왼손이 자루를 놓는다(0.11 m). 게임은
    아인에게 늘 양손 어댑터(makeAinRigAdapter)를 쓰고, 그 그립은 tests/ain-two-hand 가
    3타 포함 0.003 m 미만으로 잡는다 — 여기서는 변환이 유한한지·발만 본다. */
 const MESHY=new Set(['attack3']);
 let maxGrip=0,maxFoot=0;
 for(const name of ['idle','run','guard','attack1','attack2','attack3','smash','ult','roll','hit','death']){
  const clip=g.animations.find(c=>c.name===name);assert.ok(clip,name);mixer.stopAllAction();const act=mixer.clipAction(clip);act.play();act.paused=true;
  for(let i=0;i<40;i++){
   rig.restore();act.time=clip.duration*i/40;mixer.update(0);const a=/attack|smash|ult/.test(name)?{id:name,duration:1,elapsed:i/40,kind:'attack'}:null;
   rig.apply(a,name==='run'||name==='roll',name==='guard',.01);
   if(!MESHY.has(name))maxGrip=Math.max(maxGrip,rig.diagnostics.gripError);maxFoot=Math.max(maxFoot,rig.diagnostics.footError);
   g.scene.traverse(o=>{if(o.isBone){assert.ok(o.matrixWorld.elements.every(Number.isFinite),name+':'+o.name);assert.ok(Math.abs(o.quaternion.length()-1)<1e-5);}});
  }
 }
 t.diagnostic(`Maximum grip error ${maxGrip.toFixed(3)}m; foot target error ${maxFoot.toFixed(3)}m`);
 assert.ok(maxGrip<.05,`grip slipped ${maxGrip}m`);assert.ok(maxFoot<.12,`foot error ${maxFoot}m`);
});
test('scarecrow contains anticipation, hit, stagger, down, recovery and death clips',async()=>{
 const g=await model('art/3d/boss_anim.glb');for(const name of ['idle','walk','atk_hammer','atk_bolt','atk_scythe','hit','stagger','down','up','death'])assert.ok(g.animations.some(c=>c.name===name),name);
});
test('training attacks are horizontally in-place, retain vertical motion and preserve original GLB',async()=>{
 const raw=await model('art/3d/boss_anim.glb'),original=raw.animations.map(c=>c.toJSON());
 const asset=prepareTrainingMotion(raw);assert.equal(prepareTrainingMotion(raw),asset);
 for(const name of ['atk_hammer','atk_bolt','atk_scythe']){
  const a=asset.animations.find(c=>c.name===name),b=raw.animations.find(c=>c.name===name);
  const track=a.tracks.find(t=>/(^|mixamorig:?|[.:])Hips\.position$/.test(t.name));assert.ok(track,name);
  const source=b.tracks.find(t=>t.name===track.name);
  for(let i=0;i<track.values.length;i+=3){
   assert.equal(track.values[i],track.values[0]);assert.equal(track.values[i+2],track.values[2]);
   assert.equal(track.values[i+1],source.values[i+1]);
  }
 }
 assert.deepEqual(raw.animations.map(c=>c.toJSON()),original);
});
test('both boss renderers meet at the same contact pose, then recover; links release scrubbing',()=>{
 for(const hitFrac of [.48,.35,.30])for(const duration of [1,1.458333,2.375]){
  const spec={hitFrac},contact=duration*hitFrac;
  assert.equal(sampleBossAttack(spec,duration,{state:'telegraph',windup:0}),0);
  assert.equal(sampleBossAttack(spec,duration,{state:'telegraph',windup:1}),contact);
  assert.equal(sampleBossAttack(spec,duration,{state:'recover',recovery:.72,recoveryDur:.72}),contact);
  assert.equal(sampleBossAttack(spec,duration,{state:'recover',recovery:0,recoveryDur:.72}),duration);
  assert.equal(sampleBossAttack(spec,duration,{state:'link'}),null);
  assert.equal(sampleBossAttack(spec,duration,{state:'stagger'}),null);
  assert.ok(Number.isFinite(sampleBossAttack(spec,duration,{state:'recover',recovery:0,recoveryDur:0})));
 }
});
test('calibrated thrust marker is near maximum forward hand extension after removing root motion',async()=>{
 const g=prepareTrainingMotion(await model('art/3d/boss_anim.glb')),mixer=new THREE.AnimationMixer(g.scene);
 let hand;g.scene.traverse(o=>{if(o.isBone&&/RightHand$/.test(o.name))hand=o;});assert.ok(hand);
 const clip=g.animations.find(c=>c.name==='atk_bolt'),action=mixer.clipAction(clip);
 action.play();action.paused=true;let max=-Infinity,contact;
 for(let i=0;i<=200;i++){action.time=clip.duration*i/200;mixer.update(0);g.scene.updateMatrixWorld(true);
  const z=hand.getWorldPosition(new THREE.Vector3()).z;max=Math.max(max,z);if(i===70)contact=z;
 }
 assert.ok(max-contact<.04,'thrust marker must remain within 4cm of forward extension');
});
