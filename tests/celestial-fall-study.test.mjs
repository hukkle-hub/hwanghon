import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {createReviewPoser} from '../tools/3d/boss-close-review.mjs';
async function load(name){const b=fs.readFileSync(new URL('../art/review/part1/'+name+'.glb',import.meta.url)),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('grounded collapse preserves earlier clips, contacts the floor and holds its final pose',async t=>{
 const a=await load('celestial-response-study'),b=await load('celestial-fall-study'),am=a.scene.getObjectByName('Boss_Mesh'),m=b.scene.getObjectByName('Boss_Mesh'),pa=createReviewPoser(a.scene,a.animations),pb=createReviewPoser(b.scene,b.animations),p=m.geometry.attributes.position,ix=m.geometry.index,v=new T.Vector3(),u=new T.Vector3();
 for(const c of a.animations)for(let s=0;s<c.duration;s+=.13){pa(c.name,s);pb(c.name,s);for(let i=0;i<p.count;i+=131)assert.ok(am.getVertexPosition(i,v).distanceTo(m.getVertexPosition(i,u))<1e-6);}
 let lowest=Infinity,highest=-Infinity,minEdge=1,maxEdge=1,maxStep=0,last=null;
 for(let frame=0;frame<=1248;frame++){
  pb('death',frame/480);b.scene.updateMatrixWorld(true);let low=Infinity;const pts=[];
  for(let i=0;i<p.count;i++){m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld);low=Math.min(low,v.y);if(frame%48===0)pts.push(v.clone());if(i%127===0&&last)maxStep=Math.max(maxStep,v.distanceTo(last[i/127]));}
  lowest=Math.min(lowest,low);highest=Math.max(highest,low);assert.ok(low>=-.002&&low<=.002,`actual surface lost floor contact: frame=${frame}, y=${low}`);
  last=Array.from({length:Math.ceil(p.count/127)},(_,i)=>m.getVertexPosition(i*127,new T.Vector3()).applyMatrix4(m.matrixWorld));
  if(frame%48===0)for(let i=0;i<ix.count;i+=3)for(let k=0;k<3;k++){const ai=ix.getX(i+k),bi=ix.getX(i+(k+1)%3),d=v.fromBufferAttribute(p,ai).distanceTo(u.fromBufferAttribute(p,bi));if(d<.002)continue;const ratio=pts[ai].distanceTo(pts[bi])/d;minEdge=Math.min(minEdge,ratio);maxEdge=Math.max(maxEdge,ratio);assert.ok(ratio>.35&&ratio<2,'collapse stretched or crushed a triangle');}
 }
 assert.ok(maxStep<.035,'surface jumped more than3.5cm at480Hz');
 const end=last;pb('death',2.15);b.scene.updateMatrixWorld(true);for(let i=0;i<end.length;i++)assert.ok(m.getVertexPosition(i*127,v).applyMatrix4(m.matrixWorld).distanceTo(end[i])<1e-6,'corpse keeps moving');
 // Negative control: disabling support translation must penetrate the floor.
 const pivot=b.scene.getObjectByName('KitMechanicalMotion');pivot.position.y=0;b.scene.updateMatrixWorld(true);let bad=Infinity;for(let i=0;i<p.count;i++)bad=Math.min(bad,m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld).y);assert.throws(()=>assert.ok(bad>=-.002));
 assert.ok(!fs.readFileSync(new URL('../js/mmo/zones.js',import.meta.url),'utf8').includes('celestial-fall-study'));
 t.diagnostic(JSON.stringify({lowest,highest,minEdge,maxEdge,maxStep,visualApproved:false}));
});
