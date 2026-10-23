import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makePoser} from '../tools/3d/pose-eval.mjs';
const source=new URL('../art/3d/part1/celestial_static.glb',import.meta.url),candidate=new URL('../art/review/part1/celestial-wing-study.glb',import.meta.url);
const parse=b=>{const n=b.readUInt32LE(12);return{j:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n,28+n+b.readUInt32LE(20+n))}};
test('wing candidate preserves source body/UV/materials and mechanical tracks, never registers live',()=>{
 const s=parse(fs.readFileSync(source)),c=parse(fs.readFileSync(candidate));assert.ok(c.bin.subarray(0,s.bin.length).equals(s.bin));
 for(const key of ['attributes','indices'])assert.deepEqual(c.j.meshes[0].primitives[0][key],s.j.meshes[0].primitives[0][key]);
 for(const key of ['images','textures','materials','nodes'])assert.deepEqual(c.j[key],s.j[key]);
 for(let i=0;i<s.j.animations.length;i++){const a=s.j.animations[i],b=c.j.animations[i];assert.deepEqual(b.channels.slice(0,a.channels.length),a.channels);assert.deepEqual(b.samplers.slice(0,a.samplers.length),a.samplers);}
 assert.equal(c.j.extras.reviewOnly,true);assert.ok(!fs.readFileSync(new URL('../js/mmo/zones.js',import.meta.url),'utf8').includes('celestial-wing-study'));
});
test('actual wing surface: contact drive, fixed torso and limbs, welded UV seams, bounded stretch',async t=>{
 const bytes=fs.readFileSync(candidate),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));const gl=await l.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const m=gl.scene.getObjectByName('Boss_Mesh'),p=m.geometry.attributes.position,ix=m.geometry.index,pose=makePoser(gl.scene,gl.animations.find(c=>c.name==='atk_gust')),v=new T.Vector3(),u=new T.Vector3(),twins=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].join(',');if(!twins.has(key))twins.set(key,[]);twins.get(key).push(i);}
 let minRatio=1,maxRatio=1,maxShift=0,edges=0;
 for(const time of [0,.7,.9,1,1.18,1.5,1.7,1.8,2.05,2.8,3.4]){
  pose(time);const points=Array.from({length:p.count},(_,i)=>m.getVertexPosition(i,new T.Vector3()));
  // Outer membrane tips extend below 1.15m; height alone is not a leg mask.
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),d=points[i].distanceTo(v.fromBufferAttribute(p,i));maxShift=Math.max(maxShift,d);assert.ok(points[i].toArray().every(Number.isFinite));if(Math.abs(x)<=.4||y<=.7||(y<=2.35&&Math.abs(x)<=.8))assert.ok(d<1e-6,`body/legs/inner arms fixed ${i} ${x},${y}`);}
  for(const ids of twins.values())for(let i=1;i<ids.length;i++)assert.ok(points[ids[0]].distanceTo(points[ids[i]])<1e-6,'UV seam split');
  for(let i=0;i<ix.count;i+=3)for(let k=0;k<3;k++){const a=ix.getX(i+k),b=ix.getX(i+(k+1)%3),d=v.fromBufferAttribute(p,a).distanceTo(u.fromBufferAttribute(p,b));if(d<.002)continue;const ratio=points[a].distanceTo(points[b])/d;minRatio=Math.min(minRatio,ratio);maxRatio=Math.max(maxRatio,ratio);assert.ok(ratio>.35&&ratio<2,`stretched edge ${a}/${b} at ${time}: ${ratio}`);edges++;}
 }
 for(const time of [1,1.8]){m.morphTargetInfluences.fill(0);pose(time);assert.ok(m.morphTargetInfluences[1]>.999,'drive at authoritative hit');}
 pose(3.4);assert.ok(m.morphTargetInfluences.every(w=>Math.abs(w)<1e-7));
 for(const clip of gl.animations){const evaluate=makePoser(gl.scene,clip);for(let time=0;time<=clip.duration;time+=1/60){evaluate(time);assert.ok(m.morphTargetInfluences.every(w=>Number.isFinite(w)&&w>=0&&w<=1.000001));assert.ok(m.morphTargetInfluences.reduce((a,b)=>a+b,0)<=1.000001,'gather and drive must not double-deform');}evaluate(clip.duration);assert.ok(m.morphTargetInfluences.every(w=>Math.abs(w)<1e-7),'return to neutral');}
 m.morphTargetInfluences.fill(0);assert.throws(()=>assert.ok(m.morphTargetInfluences[1]>.999),'deliberately omitted morph must fail');
 assert.ok(maxShift>.5);t.diagnostic(JSON.stringify({minRatio,maxRatio,maxShift,edges,visualApproved:false}));
});
