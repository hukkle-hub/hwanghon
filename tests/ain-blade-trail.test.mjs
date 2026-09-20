import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import * as T from '../vendor/three/three.module.js';import{GLTFLoader}from'../vendor/three/GLTFLoader.js';
import{mountAinScythe,measureAinBladeContact}from'../js/ain-scythe-mount.js';import{WeaponTrail}from'../js/weapon-trail.js';
test('Ain trail follows measured blade instead of shaft, including transformed avatars and weapon replacement',async()=>{
 const b=await readFile('art/3d/ain_scythe_tex.glb'),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));const g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const mount=mountAinScythe(g.scene),weapon=new T.Group(),scene=new T.Scene();weapon.add(mount);scene.add(weapon);const trail=new WeaponTrail(scene);
 try{weapon.position.set(3,2,-5);weapon.rotation.set(.5,.8,-.4);weapon.scale.setScalar(1.14);trail.measure(weapon);trail._push(weapon);
 const [base,tip]=trail.pts[0];assert.ok(base.distanceTo(weapon.getObjectByName('AinBladeRoot').getWorldPosition(new T.Vector3()))<1e-7);assert.ok(tip.distanceTo(weapon.getObjectByName('AinBladeTip').getWorldPosition(new T.Vector3()))<1e-7);
 const local=weapon.worldToLocal(tip.clone());assert.ok(local.x<-.6,'negative control: old trail x=0 is not the blade');assert.ok(base.distanceTo(tip)>.5);
 const contact=measureAinBladeContact(weapon,tip);assert.ok(contact.distance<1e-6,'a measured blade vertex must touch its triangle');
 assert.ok(measureAinBladeContact(weapon,tip.clone().add(new T.Vector3(0,5,0))).distance>3,'separated target must not count as contact');
 const replacement=new T.Group();replacement.add(new T.Mesh(new T.BoxGeometry(.02,2,.02)));trail.tick(.016,replacement,false);assert.equal(trail.bladeTip,undefined);assert.equal(trail.pts.length,0);
 }finally{trail.dispose();}
});
