import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makePoser} from '../tools/3d/pose-eval.mjs';
import {GILL_SOCKETS} from '../tools/3d/leviathan-gill-sockets.mjs';
import {bindBossEmitter,bindBossSurfaceEmitter} from '../js/mmo/boss-emitter.js';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{LEVIATHAN,emitterPosition}=require('../server/field-boss-emitter.cjs'),KIT=require('../server/field-boss-kit.cjs');
async function load(){const b=fs.readFileSync(new URL('../art/review/part1/leviathan-gill-candidate.glb',import.meta.url)),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')}
const close=(a,b)=>assert.ok(a.distanceTo(b)<1e-6,`${a.toArray()} vs ${b.toArray()}`);

test('actual fan sockets follow all morphed vertices and transformed parents, not fixed rest points',async t=>{
 const gl=await load(),m=gl.scene.getObjectByName('Boss_Mesh'),parent=new T.Group();parent.add(gl.scene);
 parent.position.set(17,2,-13);parent.rotation.set(.1,.65,.05);parent.scale.set(1.3,.9,1.6);
 let maximumDrift=0,samples=0;
 for(const spec of GILL_SOCKETS){
  const socket=bindBossSurfaceEmitter(gl.scene,spec);assert.ok(socket);
  const rest=new T.Vector3();spec.surface.rest.forEach((r,i)=>rest.addScaledVector(new T.Vector3(...r),spec.surface.weights[i]));
  for(const clip of gl.animations){
   const pose=makePoser(gl.scene,clip);
   for(let time=0;time<=clip.duration;time+=1/60){
    pose(time);pose(time);const actual=socket.worldPosition(new T.Vector3()),expected=new T.Vector3(),verts=[];
    for(let i=0;i<3;i++){
     const id=spec.surface.vertices[i],v=new T.Vector3().fromBufferAttribute(m.geometry.attributes.position,id);
     for(let j=0;j<2;j++)v.addScaledVector(new T.Vector3().fromBufferAttribute(m.geometry.morphAttributes.position[j],id),m.morphTargetInfluences[j]);
     v.applyMatrix4(m.matrixWorld);verts.push(v);expected.addScaledVector(v,spec.surface.weights[i]);
    }
    close(actual,expected);
    const normal=new T.Triangle(...verts).getNormal(new T.Vector3());close(socket.worldNormal(new T.Vector3()),normal);
    close(socket.worldPosition(new T.Vector3()),expected); // normal scratch must not corrupt next sample
    maximumDrift=Math.max(maximumDrift,actual.distanceTo(rest.clone().applyMatrix4(m.matrixWorld)));samples++;
   }
  }
 }
 assert.ok(maximumDrift>.1);assert.ok(samples>1000);
 // The old fixed-local-point implementation demonstrably fails on the open fan.
 assert.throws(()=>assert.ok(maximumDrift<1e-6));t.diagnostic(JSON.stringify({samples,maximumDrift}));
});

test('surface binding rejects stale topology, LOD, altered rest geometry and malformed weights',async()=>{
 const gl=await load();
 for(const mutate of [s=>s.node='missing',s=>s.surface.vertexCount--,s=>s.surface.triangle++,s=>s.surface.vertices[0]++,s=>s.surface.rest[0][0]+=.01,s=>s.surface.weights[0]=NaN,s=>s.surface.weights[0]=-.1,s=>s.surface.weights[0]=1,s=>s.surface.rest=[]]){
  const spec=structuredClone(GILL_SOCKETS[0]);mutate(spec);assert.equal(bindBossSurfaceEmitter(gl.scene,spec),null);
 }
 const spec=structuredClone(GILL_SOCKETS[0]),a=bindBossSurfaceEmitter(gl.scene,spec),before=a.worldPosition(new T.Vector3());
 spec.surface.weights.fill(0);spec.surface.vertices.fill(0);close(a.worldPosition(new T.Vector3()),before);
});

test('candidate expanded bounds do not move normalized mouth relative to authoritative source contract',async t=>{
 const gl=await load(),model=gl.scene,box=new T.Box3().setFromObject(model),k=LEVIATHAN.height/(box.max.y-box.min.y);
 assert.ok(box.min.x<LEVIATHAN.min[0] && box.max.x>LEVIATHAN.max[0]); // real morph bound expansion is exercised
 model.scale.setScalar(k);box.setFromObject(model);model.position.set(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);
 const root=new T.Group();root.add(model);root.position.set(17,0,-11);const mouth=bindBossEmitter(model,LEVIATHAN);let maxError=0,samples=0;
 for(const skill of Object.values(KIT.KITS.leviathan.skills)){
  const pose=makePoser(model,gl.animations.find(c=>c.name===skill.clip));
  for(const time of [...Array.from({length:Math.ceil(skill.duration/25)},(_,i)=>i*25),...skill.hits.map(h=>h.at),skill.duration]){
   pose(time/1000);const expected=emitterPosition(LEVIATHAN,skill,time,17,-11),actual=mouth.worldPosition(new T.Vector3());
   const error=actual.distanceTo(new T.Vector3(expected.x,expected.y,expected.z));assert.ok(error<1e-5);maxError=Math.max(maxError,error);samples++;
  }
 }
 assert.ok(samples>450);t.diagnostic(JSON.stringify({maxError,samples,note:'mouth only; gill damage still not integrated'}));
});
