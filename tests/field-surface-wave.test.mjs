import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import kit from '../server/field-boss-kit.cjs';
import contact from '../server/field-surface-contact.cjs';
import wave from '../server/field-surface-wave.cjs';
import {createGillWaveStudy} from '../tools/3d/leviathan-gill-wave-study.mjs';
const profile=JSON.parse(fs.readFileSync(new URL('../art/review/part1/leviathan-gill-contact.json',import.meta.url)));
const skill=kit.KITS.leviathan.skills.gill,cones=contact.bindSurfaceContactProfile(profile).contacts(skill,skill.hits[0]);
const point=(d,id='p')=>({id,x:cones[0].origin.x+Math.sin(cones[0].yaw)*d,z:cones[0].origin.z+Math.cos(cones[0].yaw)*d});

test('water clock reaches7m only after220ms; no early, lingering, cancelled or dead damage',()=>{
 for(const t of [-1,NaN,0,1699,1700,1921,2550,3300])assert.equal(wave.surfaceWaveFrame(skill,t).damage,false);
 assert.equal(wave.surfaceWaveFrame(skill,1810).front,.5);
 assert.equal(wave.surfaceWaveFrame(skill,1920).front,1);
 assert.equal(contact.containsSurfaceContact(wave.waveContacts(cones,wave.surfaceWaveFrame(skill,1810)),point(5)),false);
 assert.equal(contact.containsSurfaceContact(wave.waveContacts(cones,wave.surfaceWaveFrame(skill,1900)),point(5)),true);
 for(const state of [{cancelled:true},{dying:true}])assert.equal(wave.surfaceWaveFrame(skill,1810,state).phase,'off');
 const shifted={...skill,hits:[{...skill.hits[0],at:1800}]};assert.equal(wave.surfaceWaveFrame(shifted,1910).front,.5);
 assert.throws(()=>assert.equal(wave.surfaceWaveFrame(skill,1700).front,1),'old instantaneous full range must fail');
});

test('per-cast ledger is union-once, handles20Hz endpoint crossing and permanently stops on cancellation',()=>{
 const targets=[point(1,'near'),point(5,'far'),point(6.99,'edge')],window=wave.createSurfaceWaveHitWindow([...cones,cones[0]],skill);
 assert.deepEqual(window.step(1700,targets),[]);
 assert.deepEqual(window.step(1750,targets).map(p=>p.id),[]);
 assert.deepEqual(window.step(1800,targets).map(p=>p.id),['near']);
 assert.deepEqual(window.step(1850,targets).map(p=>p.id),['far']);
 assert.deepEqual(window.step(1900,targets).map(p=>p.id),[]);
 assert.deepEqual(window.step(1950,targets).map(p=>p.id),['edge']);
 assert.deepEqual(window.step(2000,targets),[]);assert.deepEqual(window.step(1750,targets),[]);
 for(const state of [{cancelled:true},{dying:true}]){
  const w=wave.createSurfaceWaveHitWindow(cones,skill);w.step(1700,targets);assert.deepEqual(w.step(1800,targets,state),[]);assert.deepEqual(w.step(1900,targets),[]);
 }
 const a=wave.createSurfaceWaveHitWindow(cones,skill),b=wave.createSurfaceWaveHitWindow(cones,skill);
 assert.equal(a.step(1920,targets).length,3);assert.equal(b.step(1920,targets).length,3);
 assert.equal(wave.createSurfaceWaveHitWindow(cones,{...skill,clip:'idle'}),null);
 assert.equal(wave.createSurfaceWaveHitWindow(null,skill),null);
 assert.deepEqual(wave.waveContacts(null,wave.surfaceWaveFrame(skill,1800)),[]);
});

test('rendered fan vertices have exactly the same metre footprint as contact clock, both quality modes',async()=>{
 const oldLocation=globalThis.location,oldFetch=globalThis.fetch;
 try{
  globalThis.location={href:import.meta.url};globalThis.fetch=async url=>({ok:true,text:async()=>fs.readFileSync(new URL(url),'utf8'),json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
  for(const reduced of [false,true]){
   const scene=new T.Scene(),fx=await createGillWaveStudy(scene,{reduced}),meshes=[...fx.streams],geometries=meshes.map(m=>m.geometry);
   for(const t of [1701,1750,1810,1900,1920,2100,2549,1810]){
    fx.update(skill,t);assert.equal(fx.group.visible,true);scene.updateMatrixWorld(true);
    const frame=wave.surfaceWaveFrame(skill,t);
    fx.streams.forEach((m,i)=>{
     assert.equal(m.geometry,geometries[i]);const p=m.geometry.attributes.position,segments=reduced?24:48;
     for(let n=0;n<p.count;n++)assert.ok(Number.isFinite(p.getX(n))&&Number.isFinite(p.getY(n))&&Number.isFinite(p.getZ(n)));
     for(let n=p.count-segments-1;n<p.count;n++){
      assert.ok(Math.abs(Math.hypot(p.getX(n)-cones[i].origin.x,p.getZ(n)-cones[i].origin.z)-cones[i].range*frame.front)<1e-6);
     }
     assert.equal(m.material.uniforms.opacity.value,frame.opacity);
    });
   }
   for(const state of [{cancelled:true},{dying:true}]){fx.update(skill,1810,state);assert.equal(fx.group.visible,false)}
   fx.update({...skill,clip:'idle'},1810);assert.equal(fx.group.visible,false);
   fx.update(skill,2550);assert.equal(fx.group.visible,false);fx.update(skill,0);assert.equal(fx.group.visible,false);
   let disposals=0;meshes.forEach(m=>{m.geometry.addEventListener('dispose',()=>disposals++);m.material.addEventListener('dispose',()=>disposals++)});
   fx.dispose();fx.dispose();assert.equal(disposals,4);assert.equal(scene.children.length,0);
  }
 }finally{if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;globalThis.fetch=oldFetch;}
});
