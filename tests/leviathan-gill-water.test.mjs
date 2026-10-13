import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makePoser} from '../tools/3d/pose-eval.mjs';
import {createGillWaterStudy,gillWaterPhase} from '../tools/3d/leviathan-gill-water.mjs';
import {createRequire} from 'node:module';
const kit=createRequire(import.meta.url)('../server/field-boss-kit.cjs').KITS.leviathan,s=kit.skills.gill;
async function load(){const b=fs.readFileSync(new URL('../art/review/part1/leviathan-gill-candidate.glb',import.meta.url)),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')}
test('gill water uses hit clock with distinct preparation, discharge and cleanup; no early damaging-looking jet',()=>{
 for(const t of [-1,0,649,2550,3300,Infinity,NaN]){const p=gillWaterPhase(s,t);assert.equal(p.release,0);assert.equal(p.gather,0);}
 for(const t of [1000,1450,1699]){const p=gillWaterPhase(s,t);assert.ok(p.gather>0);assert.equal(p.release,0);}
 assert.equal(gillWaterPhase(s,1700).release,1);assert.equal(gillWaterPhase(s,1700).gather,0);
 assert.ok(gillWaterPhase(s,2000).release>gillWaterPhase(s,2400).release);
 assert.equal(gillWaterPhase(kit.skills.pressure,1700).release,0);
 const shifted={...s,hits:[{at:1900}]};assert.equal(gillWaterPhase(shifted,1700).release,0);assert.equal(gillWaterPhase(shifted,1900).release,1);
 assert.throws(()=>assert.equal(gillWaterPhase(s,1699).release,1));
});
test('pooled water follows actual surface each frame, bounds resources, resets and disposes',async()=>{
 const gl=await load(),scene=new T.Scene();scene.add(gl.scene);const pose=makePoser(gl.scene,gl.animations.find(c=>c.name==='atk_gill'));
 for(const reduced of [false,true]){
  const fx=createGillWaterStudy(gl.scene,scene,{reduced}),objects=fx.group.children.slice(),attrs=objects.map(o=>o.geometry.attributes.position);
  assert.deepEqual(fx.budget,reduced?{drawCalls:4,sheetTriangles:96,droplets:40}:{drawCalls:4,sheetTriangles:192,droplets:96});
  const foam=fx.streams[0].drops.material.map;assert.equal(fx.streams[1].drops.material.map,foam);
  assert.equal(foam.image.data[3],0);assert.ok(foam.image.data[(16*32+16)*4+3]>250);
  for(let t=0;t<=3300;t+=25){
   pose(t/1000);gl.scene.position.set(t*.0001,0,-t*.0002);fx.update(s,t);
   assert.deepEqual(fx.group.children,objects);objects.forEach((o,i)=>assert.equal(o.geometry.attributes.position,attrs[i]));
   for(const a of fx.streams){
    if(a.sheet.visible){
     const p=a.sheet.geometry.attributes.position;
     assert.equal(a.sheet.geometry.index.count/3,fx.budget.sheetTriangles/2);
     for(const offset of [0,p.count/2]){
      const left=new T.Vector3().fromBufferAttribute(p,offset),right=new T.Vector3().fromBufferAttribute(p,offset+1),start=left.add(right).multiplyScalar(.5);
      assert.ok(start.distanceTo(a.emitter.worldPosition(new T.Vector3()))<1e-5);
     }
     const axis0=new T.Vector3().fromBufferAttribute(p,1).sub(new T.Vector3().fromBufferAttribute(p,0)).normalize();
     const axis1=new T.Vector3().fromBufferAttribute(p,p.count/2+1).sub(new T.Vector3().fromBufferAttribute(p,p.count/2)).normalize();
     assert.ok(Math.abs(axis0.dot(axis1))<1e-4,'crossed sheets must not collapse to parallel planes');
    }
    for(const obj of [a.sheet,a.drops])assert.ok(Array.from(obj.geometry.attributes.position.array).every(Number.isFinite));
   }
  }
  for(const options of [{cancelled:true},{dying:true}]){pose(1.8);fx.update(s,1800);assert.equal(fx.group.visible,true);fx.update(s,1800,options);assert.equal(fx.group.visible,false);}
  fx.update(s,1800);fx.update(kit.skills.pressure,1800);assert.equal(fx.group.visible,false);
  fx.update(s,1800);const before=Array.from(fx.streams[0].drops.geometry.attributes.position.array);fx.update(s,0);fx.update(s,1800);assert.deepEqual(Array.from(fx.streams[0].drops.geometry.attributes.position.array),before);
  let disposed=0,textureDisposed=0;foam.addEventListener('dispose',()=>textureDisposed++);objects.forEach(o=>o.geometry.addEventListener('dispose',()=>disposed++));fx.dispose();fx.dispose();fx.update(s,1800);assert.equal(disposed,4);assert.equal(textureDisposed,1);assert.equal(fx.group.parent,null);assert.equal(fx.group.visible,false);
 }
 assert.equal(createGillWaterStudy(new T.Group(),scene),null);
});
