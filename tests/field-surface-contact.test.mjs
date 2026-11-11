import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makePoser} from '../tools/3d/pose-eval.mjs';
import {GILL_SOCKETS} from '../tools/3d/leviathan-gill-sockets.mjs';
import {bindBossSurfaceEmitter} from '../js/mmo/boss-emitter.js';
import {bakeGillContactProfile} from '../tools/3d/bake-gill-contact-profile.mjs';
import {loadCjs} from '../js/mmo/cjs-browser.js';
import {createGillContactStudy} from '../tools/3d/leviathan-gill-contact-study.mjs';
import contact from '../server/field-surface-contact.cjs';
import kit from '../server/field-boss-kit.cjs';
const profile=JSON.parse(fs.readFileSync(new URL('../art/review/part1/leviathan-gill-contact.json',import.meta.url)));
const skill=kit.KITS.leviathan.skills.gill,hit=skill.hits[0];
const {bindSurfaceContactProfile,containsSurfaceContact}=contact;
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
async function load(){const b=fs.readFileSync(new URL('../'+profile.source,import.meta.url)),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')}

test('review profile is a reproducible extraction from current candidate, not hand-fit points',async()=>{
 assert.deepEqual(await bakeGillContactProfile(),profile);
 assert.equal(profile.reviewOnly,true);
 // A changed GLB cannot silently reuse the old contact profile.
 const stale=structuredClone(profile);stale.surfaces[0].vertices[0].deltas[0][0]+=.01;
 assert.throws(()=>assert.deepEqual(stale,profile));
});

test('pure contact surfaces match makePoser skin over full clip and reversed seeks',async t=>{
 const gl=await load(),model=gl.scene,box=new T.Box3().setFromObject(model);
 model.scale.setScalar(3.5/(box.max.y-box.min.y));box.setFromObject(model);
 model.position.set(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);
 const holder=new T.Group();holder.add(model);holder.position.set(17,0,-11);
 const pose=makePoser(model,gl.animations.find(c=>c.name===profile.clip));
 const sockets=GILL_SOCKETS.map(s=>bindBossSurfaceEmitter(model,s)),bound=bindSurfaceContactProfile(profile);
 let maxPositionError=0,maxNormalError=0,samples=0,restDrift=0;
 const times=Array.from({length:Math.floor(profile.duration/5)+1},(_,i)=>i*5);
 times.push(hit.at,profile.duration,...times.slice().reverse());
 for(const time of times){
  pose(time/1000);const actual=bound.at(time,17,-11);
  assert.equal(actual.length,2);
  for(let i=0;i<2;i++){
   const expected=sockets[i].worldPosition(new T.Vector3()).toArray(),normal=sockets[i].worldNormal(new T.Vector3()).toArray();
   maxPositionError=Math.max(maxPositionError,distance(actual[i].position,expected));
   maxNormalError=Math.max(maxNormalError,distance(actual[i].normal,normal));
   restDrift=Math.max(restDrift,distance(actual[i].position,bound.at(0,17,-11)[i].position));samples++;
  }
 }
 assert.ok(maxPositionError<1e-5,String(maxPositionError));assert.ok(maxNormalError<1e-5,String(maxNormalError));
 assert.ok(restDrift>.1);assert.throws(()=>assert.ok(restDrift<1e-5));
 t.diagnostic(JSON.stringify({samples,maxPositionError,maxNormalError,restDrift}));
});

test('paired contact cones use actual outward normals, preserve supplied range and never double count',()=>{
 const b=bindSurfaceContactProfile(profile),cones=b.contacts(skill,hit,17,-11),surfaces=b.at(hit.at,17,-11);
 assert.equal(cones.length,2);
 cones.forEach((c,i)=>{
  assert.equal(c.range,hit.range);assert.equal(c.angle,hit.angle);
  assert.ok(distance([c.origin.x,c.origin.y,c.origin.z],surfaces[i].position)<1e-10);
  const point=(d,angle=0)=>({x:c.origin.x+Math.sin(c.yaw+angle)*d,z:c.origin.z+Math.cos(c.yaw+angle)*d});
  assert.equal(containsSurfaceContact([c],point(3)),true);
  assert.equal(containsSurfaceContact([c],point(hit.range+.001)),false);
  assert.equal(containsSurfaceContact([c],point(3,hit.angle/2-.0001)),true);
  assert.equal(containsSurfaceContact([c],point(3,hit.angle/2+.0001)),false);
  assert.equal(containsSurfaceContact([c],point(-1)),false);
  // Deliberately duplicate a nozzle: union still yields one victim entry.
  assert.equal([point(3)].filter(p=>containsSurfaceContact([c,c],p)).length,1);
 });
 assert.ok(Math.sin(cones[0].yaw)<0);assert.ok(Math.sin(cones[1].yaw)>0);
 assert.equal(containsSurfaceContact(cones,{x:17,z:-11}),false,'body-root target is not an outward gill target');
 assert.deepEqual(b.contacts({...skill,clip:'atk_pressure'},hit),[]);
 assert.deepEqual(b.contacts(skill,{...hit}),[],'foreign contact is rejected');
});

test('invalid profiles, times and cone inputs fail closed; validated data is isolated from mutation',()=>{
 for(const mutate of [p=>p.reviewOnly=false,p=>p.scale=NaN,p=>p.offset=[0,0],p=>p.rotation.values[0]=1,
  p=>p.weights.times[1]=0,p=>p.weights.values.pop(),p=>p.surfaces[0].barycentric[0]=-.1,
  p=>p.surfaces[0].vertices[1].rest=[...p.surfaces[0].vertices[0].rest],p=>p.surfaces[1].name=p.surfaces[0].name,
  p=>p.duration+=1,p=>p.surfaces[0].vertices[0].deltas=[]]){
  const p=structuredClone(profile);mutate(p);assert.equal(bindSurfaceContactProfile(p),null);
 }
 const p=structuredClone(profile),b=bindSurfaceContactProfile(p),before=b.at(1700);
 p.weights.values.fill(99);p.surfaces[0].vertices[0].rest.fill(99);assert.deepEqual(b.at(1700),before);
 for(const time of [-1,NaN,Infinity,profile.duration+1])assert.deepEqual(b.at(time),[]);
 assert.deepEqual(b.at(1700,NaN,0),[]);
 for(const mutate of [h=>h.range=NaN,h=>h.angle=0,h=>h.atTarget=true,h=>h.at=-1,h=>h.shape='line']){
  const s=structuredClone(skill);mutate(s.hits[0]);assert.deepEqual(b.contacts(s,s.hits[0]),[]);
 }
 assert.equal(containsSurfaceContact([{origin:{x:0,z:0},yaw:NaN,range:7,angle:2.5}],{x:1,z:1}),false);
 assert.equal(containsSurfaceContact(b.contacts(skill,hit),{x:NaN,z:1}),false);
});

test('real loadCjs executes the same pure contact module with identical results',async()=>{
 const oldLocation=globalThis.location,oldFetch=globalThis.fetch;
 try{
  globalThis.location={href:new URL('../js/mmo/cjs-browser.js',import.meta.url).href};
  globalThis.fetch=async url=>({ok:true,text:async()=>fs.readFileSync(new URL(url),'utf8'),json:async()=>JSON.parse(fs.readFileSync(new URL(url),'utf8'))});
  const browser=await loadCjs('../../server/field-surface-contact.cjs');
  const a=bindSurfaceContactProfile(profile),b=browser.bindSurfaceContactProfile(profile);
  for(const time of [0,1200,1700,1777,profile.duration])assert.deepEqual(a.at(time,10,-4),b.at(time,10,-4));
  const cones=a.contacts(skill,hit);assert.deepEqual(cones,b.contacts(skill,hit));
  for(let x=-12;x<=12;x++)for(let z=-12;z<=20;z++)assert.equal(containsSurfaceContact(cones,{x,z}),browser.containsSurfaceContact(cones,{x,z}));
  const scene=new T.Scene(),study=await createGillContactStudy(scene,skill);scene.updateMatrixWorld(true);
  assert.equal(study.group.visible,false);assert.equal(study.group.children.length,4);
  study.cones.forEach((c,i)=>{
   const line=study.group.children[i*2],p=line.geometry.attributes.position;
   const origin=new T.Vector3().fromBufferAttribute(p,0).applyMatrix4(line.matrixWorld);
   const expected=[c.origin.x,.025,c.origin.z].map((v,j)=>(v-profile.offset[j])/profile.scale);
   assert.ok(distance(origin.toArray(),expected)<1e-6);
   for(let n=1;n<=65;n++){
    const point=new T.Vector3().fromBufferAttribute(p,n).applyMatrix4(line.matrixWorld);
    assert.ok(Math.abs(point.distanceTo(origin)*profile.scale-hit.range)<1e-6,'outline uses metres, not raw asset units');
   }
  });
  let disposed=0;study.group.children.forEach(o=>{o.geometry.addEventListener('dispose',()=>disposed++);o.material.addEventListener('dispose',()=>disposed++)});
  study.dispose();assert.equal(scene.children.length,0);assert.equal(disposed,8);
 }finally{if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;globalThis.fetch=oldFetch;}
});
