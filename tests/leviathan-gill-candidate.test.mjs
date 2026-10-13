import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makePoser} from '../tools/3d/pose-eval.mjs';
const source=new URL('../art/3d/part1/leviathan_static.glb',import.meta.url),candidate=new URL('../art/review/part1/leviathan-gill-candidate.glb',import.meta.url);
const parse=b=>{const n=b.readUInt32LE(12);return{j:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n,28+n+b.readUInt32LE(20+n))}};
async function load(){const b=fs.readFileSync(candidate),loader=new GLTFLoader();loader.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')}

test('gill review candidate preserves source geometry UV materials and binary prefix; no game registration',()=>{
 const s=parse(fs.readFileSync(source)),c=parse(fs.readFileSync(candidate));
 assert.ok(c.bin.subarray(0,s.bin.length).equals(s.bin));
 assert.deepEqual(c.j.meshes[0].primitives[0].attributes,s.j.meshes[0].primitives[0].attributes);
 for(const key of ['images','textures','materials'])assert.deepEqual(c.j[key],s.j[key]);
 assert.deepEqual(c.j.animations.map(a=>a.name),s.j.animations.map(a=>a.name));
 assert.equal(c.j.extras.reviewOnly,true);
 assert.ok(!fs.readFileSync(new URL('../js/mmo/zones.js',import.meta.url),'utf8').includes('leviathan-gill-candidate'));
});

test('makePoser evaluates paired actual morphs at repeated held frames and clears on every other clip',async()=>{
 const gl=await load(),m=gl.scene.getObjectByName('Boss_Mesh'),clip=gl.animations.find(c=>c.name==='atk_gill'),pose=makePoser(gl.scene,clip);
 assert.equal(m.morphTargetInfluences.length,2);
 for(const t of [1.5,1.5,1.6]){m.morphTargetInfluences.fill(0);pose(t);assert.deepEqual(m.morphTargetInfluences,[1,1]);}
 for(const t of [0,.5,2.6,3.3]){pose(t);assert.deepEqual(m.morphTargetInfluences,[0,0]);}
 for(const c of gl.animations.filter(c=>c!==clip)){pose(1.5);makePoser(gl.scene,c)(c.duration*.5);assert.deepEqual(m.morphTargetInfluences,[0,0],c.name);}
 // Deliberate broken evaluator: applying transforms alone cannot pass the hold.
 m.morphTargetInfluences.fill(0);assert.throws(()=>assert.deepEqual(m.morphTargetInfluences,[1,1]));
});

test('actual deformed surface: mouth tail midline stay fixed, seam twins stay welded, no extreme edge expansion',async t=>{
 const gl=await load(),m=gl.scene.getObjectByName('Boss_Mesh'),g=m.geometry,p=g.getAttribute('position'),idx=g.index;
 const pose=makePoser(gl.scene,gl.animations.find(c=>c.name==='atk_gill')),a=new T.Vector3(),b=new T.Vector3();
 let maxRatio=1,maxShift=0,checked=0;
 const twins=new Map();for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].join(',');if(!twins.has(key))twins.set(key,[]);twins.get(key).push(i)}
 for(const time of [0,.8,1.15,1.42,1.6,1.7,1.8,1.9,2.3,2.55,3.3]){
  pose(time);const points=Array.from({length:p.count},(_,i)=>m.getVertexPosition(i,new T.Vector3()));
  for(let i=0;i<p.count;i++){
   const v=points[i],d=v.distanceTo(a.fromBufferAttribute(p,i));assert.ok(v.toArray().every(Number.isFinite));maxShift=Math.max(maxShift,d);
   if(p.getZ(i)>=5.57||p.getZ(i)<=3.55||Math.abs(p.getX(i))<=.34)assert.ok(d<1e-7,'face/tail/core must stay fixed');
  }
  for(const ids of twins.values())for(let i=1;i<ids.length;i++)assert.ok(points[ids[0]].distanceTo(points[ids[i]])<1e-7,'UV seam split');
  for(let i=0;i<idx.count;i+=3)for(let e=0;e<3;e++){
   const u=idx.getX(i+e),v=idx.getX(i+(e+1)%3),base=a.fromBufferAttribute(p,u).distanceTo(b.fromBufferAttribute(p,v));
   if(base<1e-5)continue;const ratio=points[u].distanceTo(points[v])/base;assert.ok(ratio<2.5&&ratio>.25,`edge ${u}/${v} at ${time}: ${ratio}`);maxRatio=Math.max(maxRatio,ratio);checked++;
  }
 }
 assert.ok(maxShift>.15&&maxShift<.3);assert.ok(checked>100000);
 t.diagnostic(JSON.stringify({maxRatio,maxShift,checked,note:'numerical guard only; expanded video review required'}));
});
