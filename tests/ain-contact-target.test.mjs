import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import * as T from '../vendor/three/three.module.js';import{GLTFLoader}from'../vendor/three/GLTFLoader.js';
import{repairAinBind,repairAinClips}from'../js/ain-bind-repair.js';import{makeAinRigAdapter}from'../js/ain-two-hand.js';import{mountAinScythe,measureAinBladeContact,nearestAinBladePoint}from'../js/ain-scythe-mount.js';
async function load(name){const b=await readFile('art/3d/'+name+'.glb'),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('authored attack contact intersects measured training core envelope without root drift',async t=>{
 const g=await load('ain_anim'),w=await load('ain_scythe_tex'),root=new T.Group();root.add(g.scene);g.scene.scale.setScalar(1.14);const report=repairAinBind(g.scene),clips=repairAinClips(g.animations,report);
 let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});const weapon=new T.Group();weapon.add(mountAinScythe(w.scene));slot.add(weapon);weapon.scale.setScalar(1/slot.getWorldScale(new T.Vector3()).x);
 const rig=makeAinRigAdapter(g.scene,root,slot),mixer=new T.AnimationMixer(g.scene);
 for(const [name,contact,target]of [['skill1',.5,[-.16,2.4,.5]],['skill3',.55,[-.16,2.4,.5]],['ult',.5,[.08,2.49,.48]]]){
  rig.restore();mixer.stopAllAction();const c=clips.find(c=>c.name===name),a=mixer.clipAction(c);a.play();a.paused=true;a.time=c.duration*contact;mixer.update(0);rig.apply({id:1,clip:name,elapsed:.5,hitAt:.5,duration:1.2},false,false,0,name);
  assert.ok(Math.abs(rig.bones.Hips.position.x-report.hipsRest.x)<1e-6);assert.ok(Math.abs(rig.bones.Hips.position.z-report.hipsRest.z)<1e-6);
  const p=new T.Vector3(...target),hit=measureAinBladeContact(weapon,p);t.diagnostic(name+' core distance '+hit.distance.toFixed(4)+'m');assert.ok(hit.distance<.39,name+' blade misses measured core');
  const visual=nearestAinBladePoint(weapon,p);assert.ok(visual&&visual.distance>=hit.distance-1e-5&&visual.distance<hit.distance+.12,'bounded surface cloud must approximate the real blade');
  for(const dz of [-.10,0,.10])for(const dy of [-.04,0,.04]){
   const d=measureAinBladeContact(weapon,p.clone().add(new T.Vector3(0,dy,dz))).distance;
   assert.ok(d<.39,`${name}: distance offset ${dz}m / height offset ${dy}m misses (${d.toFixed(4)}m)`);
  }
  assert.ok(measureAinBladeContact(weapon,p.clone().add(new T.Vector3(0,3,0))).distance>1,'unreachable high target must fail');
  for(const [coords,radius] of [[[.11,2.58,.58],.39],[[.09,3.15,.89],.488]]){
   if(coords[1]>3&&name!=='skill1')continue; // Other high-strike silhouettes are not yet validated.
   rig.restore();mixer.update(0);const target=new T.Vector3(...coords);
   rig.apply({id:2,clip:name,elapsed:.5,hitAt:.5,duration:1.2},false,false,0,name);
   if(name==='skill1')assert.ok(measureAinBladeContact(weapon,target).distance>radius,'negative control: legacy pose must reproduce miss');
   rig.restore();mixer.update(0);
   rig.apply({id:2,clip:name,elapsed:.5,hitAt:.5,duration:1.2},false,false,0,name,target);
   const corrected=measureAinBladeContact(weapon,target).distance;t.diagnostic(name+' corrected '+coords[1]+'m: '+corrected.toFixed(4));
   assert.ok(corrected<radius,name+' adaptive contact misses '+coords);
   assert.ok(rig.diagnostics.gripError<.001,'both palms stay attached');
   root.position.set(4,0,-7);root.rotation.y=1.2;root.updateWorldMatrix(true,true);
   const worldTarget=root.localToWorld(target.clone());rig.restore();mixer.update(0);
   rig.apply({id:3,clip:name,elapsed:.5,hitAt:.5,duration:1.2},false,false,0,name,worldTarget);
   assert.ok(measureAinBladeContact(weapon,worldTarget).distance<radius,'translated/yawed target coordinate regression');
   root.position.set(0,0,0);root.rotation.y=0;root.updateWorldMatrix(true,true);
  }
 }
});

test('basic cuts, smash, counter and execution physically reach the raised training core',async t=>{
 const g=await load('ain_anim'),w=await load('ain_scythe_tex'),root=new T.Group();root.add(g.scene);g.scene.scale.setScalar(1.14);
 const repair=repairAinBind(g.scene),clips=repairAinClips(g.animations,repair);let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});
 const weapon=new T.Group();weapon.add(mountAinScythe(w.scene));slot.add(weapon);weapon.scale.setScalar(1/slot.getWorldScale(new T.Vector3()).x);
 const rig=makeAinRigAdapter(g.scene,root,slot),mixer=new T.AnimationMixer(g.scene);
 const contacts={attack1:.34,attack2:.44,attack3:.50,smash:.78,counter:.48,exec:.58};
 for(const [clip,contact]of Object.entries(contacts)){
  let max=0;
  for(const coords of [[0,2.4,.5],[.09,2.36,.45],[.11,2.58,.58]]){
   rig.restore();mixer.stopAllAction();const c=clips.find(c=>c.name===clip),act=mixer.clipAction(c);act.play();act.paused=true;act.time=c.duration*contact;mixer.update(0);
   const target=new T.Vector3(...coords);rig.apply({id:clip,clip,elapsed:.5,hitAt:.5,duration:1.2},false,false,0,clip,target);
   const d=measureAinBladeContact(weapon,target).distance;max=Math.max(max,d);assert.ok(d<.39,clip+' misses '+coords+': '+d);
   assert.ok(rig.diagnostics.gripError<.001);
  }
  t.diagnostic(clip+' maximum core distance '+max.toFixed(4)+'m');
 }
});
