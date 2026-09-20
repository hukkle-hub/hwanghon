import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import * as T from '../vendor/three/three.module.js';import{GLTFLoader}from'../vendor/three/GLTFLoader.js';
import{repairAinBind,repairAinClips}from'../js/ain-bind-repair.js';import{makeAinRigAdapter}from'../js/ain-two-hand.js';import{mountAinScythe,measureAinBladeContact}from'../js/ain-scythe-mount.js';
async function load(name){const b=await readFile('art/3d/'+name+'.glb'),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('authored attack contact intersects measured training core envelope without root drift',async t=>{
 const g=await load('ain_anim'),w=await load('ain_scythe_tex'),root=new T.Group();root.add(g.scene);g.scene.scale.setScalar(1.14);const report=repairAinBind(g.scene),clips=repairAinClips(g.animations,report);
 let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});const weapon=new T.Group();weapon.add(mountAinScythe(w.scene));slot.add(weapon);weapon.scale.setScalar(1/slot.getWorldScale(new T.Vector3()).x);
 const rig=makeAinRigAdapter(g.scene,root,slot),mixer=new T.AnimationMixer(g.scene);
 for(const [name,contact,target]of [['skill1',.5,[-.16,2.4,.5]],['skill3',.55,[-.16,2.4,.5]],['ult',.5,[.08,2.49,.48]]]){
  rig.restore();mixer.stopAllAction();const c=clips.find(c=>c.name===name),a=mixer.clipAction(c);a.play();a.paused=true;a.time=c.duration*contact;mixer.update(0);rig.apply({id:1,clip:name,elapsed:.5,hitAt:.5,duration:1.2},false,false,0,name);
  assert.ok(Math.abs(rig.bones.Hips.position.x-report.hipsRest.x)<1e-6);assert.ok(Math.abs(rig.bones.Hips.position.z-report.hipsRest.z)<1e-6);
  const p=new T.Vector3(...target),hit=measureAinBladeContact(weapon,p);t.diagnostic(name+' core distance '+hit.distance.toFixed(4)+'m');assert.ok(hit.distance<.39,name+' blade misses measured core');
  assert.ok(measureAinBladeContact(weapon,p.clone().add(new T.Vector3(0,3,0))).distance>1,'unreachable high target must fail');
 }
});
