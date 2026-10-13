import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {createReviewPoser} from '../tools/3d/boss-close-review.mjs';
import {setupKitMotion,applyKitAction,prepareKitMotion} from '../js/mmo/kit-motion.js';
const url=n=>new URL('../art/review/part1/'+n+'.glb',import.meta.url);
async function load(name){const b=fs.readFileSync(url(name)),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('split wing responses preserve source skill surfaces and keep inner anatomy fixed',async t=>{
 const s=await load('celestial-wing-study'),c=await load('celestial-response-study'),sm=s.scene.getObjectByName('Boss_Mesh'),cm=c.scene.getObjectByName('Boss_Mesh'),sp=createReviewPoser(s.scene,s.animations),cp=createReviewPoser(c.scene,c.animations),p=cm.geometry.attributes.position,ix=cm.geometry.index,v=new T.Vector3(),u=new T.Vector3();
 for(const clip of s.animations)for(let time=0;time<=clip.duration;time+=.1){sp(clip.name,time);cp(clip.name,time);for(let i=0;i<p.count;i+=17)assert.ok(sm.getVertexPosition(i,v).distanceTo(cm.getVertexPosition(i,u))<1e-6,'existing skill shape changed');}
 let min=1,max=1,asymmetric=false;
 for(const name of ['hit','cancel','dodge']){
  const clip=c.animations.find(a=>a.name===name);assert.ok(clip);
  for(let time=0;time<=clip.duration;time+=1/60){cp(name,time);const w=cm.morphTargetInfluences;assert.ok(w[0]+w[1]<=1.000001&&w[2]+w[3]<=1.000001);asymmetric ||= Math.abs(w[0]-w[2])>.2;
   for(let i=0;i<p.count;i+=13)if(Math.abs(p.getX(i))<=.4)assert.ok(cm.getVertexPosition(i,v).distanceTo(u.fromBufferAttribute(p,i))<1e-6,'face/core/body shape changed');
   // Every edge at response key region, plus 60Hz sampled vertices above.
   if(Math.round(time*60)%6===0){const pts=Array.from({length:p.count},(_,i)=>cm.getVertexPosition(i,new T.Vector3()));for(let i=0;i<ix.count;i+=3)for(let k=0;k<3;k++){const a=ix.getX(i+k),b=ix.getX(i+(k+1)%3),d=v.fromBufferAttribute(p,a).distanceTo(u.fromBufferAttribute(p,b));if(d<.002)continue;const ratio=pts[a].distanceTo(pts[b])/d;min=Math.min(min,ratio);max=Math.max(max,ratio);assert.ok(ratio>.35&&ratio<2);}}
  }
  cp(name,clip.duration);assert.ok(cm.morphTargetInfluences.every(w=>Math.abs(w)<1e-7));
 }
 assert.ok(asymmetric);cp('dodge',.3);const left=cm.morphTargetInfluences[0];cm.morphTargetInfluences[2]=left;assert.throws(()=>assert.ok(Math.abs(cm.morphTargetInfluences[0]-cm.morphTargetInfluences[2])>.2),'symmetrizing response must fail');
 assert.ok(!fs.readFileSync(new URL('../js/mmo/zones.js',import.meta.url),'utf8').includes('celestial-response-study'));t.diagnostic(JSON.stringify({min,max,visualApproved:false}));
});
test('actual mixer interruption reaches cancel and neutral without stale skill morphs',async()=>{
 const gl=await load('celestial-response-study'),scene=new T.Scene(),root=new T.Group();root.add(gl.scene);scene.add(root);const m=gl.scene.getObjectByName('Boss_Mesh'),o={b:{id:'review-response'},root,model:gl.scene};
 setupKitMotion(o,gl,gl.scene,scene,{skills:{gust:{clip:'atk_gust',hits:[]}}});
 for(const time of [.3,.9,1,1.7,1.8,2.6]){
  applyKitAction(o,{motion:'skill',skill:'gust',seq:(o.netAct?.seq||0)+1,startedAt:0},time*1000);prepareKitMotion(o,time*1000);o.mixer.update(.2);
  const before=m.morphTargetInfluences.slice(),at=time*1000;applyKitAction(o,{motion:'cancel',seq:o.netAct.seq+1,startedAt:at},at);prepareKitMotion(o,at);o.mixer.update(0);assert.ok(m.morphTargetInfluences.every((v,i)=>Math.abs(v-before[i])<1e-6),'interruption must not snap before time advances (float32 fade tolerance)');
  const points=()=>Array.from({length:Math.ceil(m.geometry.attributes.position.count/127)},(_,i)=>m.getVertexPosition(i*127,new T.Vector3()).applyMatrix4(m.matrixWorld));
  gl.scene.updateMatrixWorld(true);let previous=points();
  for(let n=1;n<=60;n++){prepareKitMotion(o,at+n*1000/60);o.mixer.update(1/60);gl.scene.updateMatrixWorld(true);assert.ok(m.morphTargetInfluences.every(Number.isFinite));const current=points();assert.ok(current.every((v,i)=>v.toArray().every(Number.isFinite)&&v.distanceTo(previous[i])<.25),'actual surface jumps >25cm per 60Hz frame');previous=current;}
  assert.ok(m.morphTargetInfluences.every(w=>Math.abs(w)<1e-6),'canceled skill remains in wing pose');
 }
});
