import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {createReviewPoser} from '../tools/3d/boss-close-review.mjs';
// Explicit rejected-fixture override is for the manual negative-control run.
async function load(name){const file=name==='celestial-rest-study'&&process.env.HW_CELESTIAL_REST_NEGATIVE?process.env.HW_CELESTIAL_REST_NEGATIVE:new URL('../art/review/part1/'+name+'.glb',import.meta.url),b=fs.readFileSync(file),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('arm release preserves attacks and early collapse, relaxes hands separately and keeps the whole surface grounded',async t=>{
 const source=fs.readFileSync(new URL('../art/review/part1/celestial-fall-study.glb',import.meta.url));
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'d5133857c290dd1dc3c485573d74f7226600d1a0bf33360cabeac4ea6e220420');
 const a=await load('celestial-fall-study'),b=await load('celestial-rest-study'),am=a.scene.getObjectByName('Boss_Mesh'),m=b.scene.getObjectByName('Boss_Mesh'),pa=createReviewPoser(a.scene,a.animations),pb=createReviewPoser(b.scene,b.animations),p=m.geometry.attributes.position,ix=m.geometry.index,v=new T.Vector3(),u=new T.Vector3();
 for(const c of a.animations)for(let s=0;s<(c.name==='death'?1.30:c.duration);s+=.13){pa(c.name,s);pb(c.name,s);for(let i=0;i<p.count;i+=127)assert.ok(am.getVertexPosition(i,v).applyMatrix4(am.matrixWorld).distanceTo(m.getVertexPosition(i,u).applyMatrix4(m.matrixWorld))<1e-5,'an earlier pose changed');}
 function hands(mesh){const ys=[0,0],ns=[0,0];for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);if(Math.abs(x)>.40&&Math.abs(x)<.70&&y>1.2&&y<1.65){const s=x>0?1:0;ys[s]+=mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld).y;ns[s]++;}}return ys.map((n,i)=>n/ns[i]);}
 pa('death',2.6);pb('death',2.6);const oldHands=hands(am),newHands=hands(m);
 const relaxed=ys=>ys.forEach((y,i)=>assert.ok(y<oldHands[i]-.20,'hand stays hooked above the body'));
 relaxed(newHands);assert.throws(()=>relaxed(oldHands)); // Old braced corpse must fail this requirement.
 pa('death',1.6);pb('death',1.6);const earlyOld=hands(am),earlyNew=hands(m),drop=earlyOld.map((y,i)=>y-earlyNew[i]);
 assert.ok(drop[0]>drop[1]+.10,'both arms relaxed in lockstep');
 let lowest=Infinity,highest=-Infinity,minEdge=1,maxEdge=1,maxStep=0,last=null;
 for(let frame=0;frame<=1248;frame++){
  pb('death',frame/480);b.scene.updateMatrixWorld(true);let low=Infinity;const pts=[];
  if(frame%48===0){pa('death',frame/480);for(let i=0;i<p.count;i+=31)if(Math.abs(p.getX(i))<.22&&p.getY(i)>2.8)assert.ok(am.getVertexPosition(i,v).applyMatrix4(am.matrixWorld).distanceTo(m.getVertexPosition(i,u).applyMatrix4(m.matrixWorld))<1e-5,'relaxing a hand lifted the established torso/head contact');}
  for(let i=0;i<p.count;i++){m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld);low=Math.min(low,v.y);if(frame%48===0)pts.push(v.clone());if(i%127===0&&last)maxStep=Math.max(maxStep,v.distanceTo(last[i/127]));}
  lowest=Math.min(lowest,low);highest=Math.max(highest,low);assert.ok(low>=-.002&&low<=.002,`surface contact failed at frame${frame}: ${low}`);
  last=Array.from({length:Math.ceil(p.count/127)},(_,i)=>m.getVertexPosition(i*127,new T.Vector3()).applyMatrix4(m.matrixWorld));
  if(frame%48===0)for(let i=0;i<ix.count;i+=3)for(let k=0;k<3;k++){const ai=ix.getX(i+k),bi=ix.getX(i+(k+1)%3),d=v.fromBufferAttribute(p,ai).distanceTo(u.fromBufferAttribute(p,bi));if(d<.002)continue;const ratio=pts[ai].distanceTo(pts[bi])/d;minEdge=Math.min(minEdge,ratio);maxEdge=Math.max(maxEdge,ratio);assert.ok(ratio>.35&&ratio<2,'arm release tears or crushes the connected surface');}
 }
 assert.ok(maxStep<.035,'surface jumped more than3.5cm at480Hz');
 const end=last;pb('death',2.30);b.scene.updateMatrixWorld(true);for(let i=0;i<end.length;i++)assert.ok(m.getVertexPosition(i*127,v).applyMatrix4(m.matrixWorld).distanceTo(end[i])<1e-6,'corpse keeps moving after settling');
 const pivot=b.scene.getObjectByName('KitMechanicalMotion');pivot.position.y=0;b.scene.updateMatrixWorld(true);let bad=Infinity;for(let i=0;i<p.count;i++)bad=Math.min(bad,m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld).y);assert.throws(()=>assert.ok(bad>=-.002));
 assert.ok(!fs.readFileSync(new URL('../js/mmo/zones.js',import.meta.url),'utf8').includes('celestial-rest-study'));
 t.diagnostic(JSON.stringify({oldHands,newHands,earlyAsymmetricDrop:drop,lowest,highest,minEdge,maxEdge,maxStep,visualApproved:false}));
});
