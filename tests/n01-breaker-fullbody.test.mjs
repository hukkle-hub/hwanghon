import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
import {breakerCadence} from '../js/mmo/n01-motion-cadence.js';import {motionFor} from '../js/mmo/n01-body-catalog.js';
import * as T from '../vendor/three/three.module.js';import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import crypto from 'node:crypto';
const M=createRequire(import.meta.url)('../server/field-mob-combat.cjs'),nav={safe:()=>false,legal:()=>true,canTraverse:()=>true,route:()=>null};
function setup(){const m={id:'b',catalogId:'G5_BREAKER',x:0,z:0,alive:true,group:{area:{}}};return {m,a:M.reset(m,0),s:M.statsFor(m.catalogId),p:{id:'p',x:0,z:.92}};}
test('Breaker one strong strike:900ms tell,1300ms recovery; no second hit and existing damage budget',()=>{
 const q=setup(),hits=[];for(let t=0;t<2700;t+=50){const h=M.tick(q.m,q.a,q.s,[q.p],t,nav);if(h)hits.push({t,...h});assert.equal(q.a.seq,1);}assert.deepEqual(hits.map(h=>h.t),[900]);assert.equal(hits[0].damage,700);assert.equal(hits[0].skill,'heavy_slam');assert.equal(q.s.hp,7000);assert.equal(q.s.speed,2.4);assert.equal(q.s.cooldownMs,1800);assert.equal(q.a.action.recoveryMs,1300);assert.equal(M.actionFor('G5_BREAKER').windupMs,900);
 const f=setup(),ctx={facilities:[{...f.p,z:.88,id:'generator',kind:'generator'}]};M.tick(f.m,f.a,f.s,[],0,nav,ctx);assert.equal(M.tick(f.m,f.a,f.s,[],899,nav,ctx),null);const h=M.tick(f.m,f.a,f.s,[],900,nav,ctx);assert.equal(h.targetKind,'generator');assert.equal(h.damage,900);
});
test('Breaker physical range, walls and interruption prevent phantom damage',()=>{
 for(const mode of ['range','wall','stagger']){const q=setup();M.tick(q.m,q.a,q.s,[q.p],0,nav);let n=nav;if(mode==='range')q.p.z=2;if(mode==='wall')n={...nav,canTraverse:()=>false};if(mode==='stagger')M.stagger(q.a,850);assert.equal(M.tick(q.m,q.a,q.s,[q.p],900,n),null,mode);}
 const q=setup();q.p.z=2;M.tick(q.m,q.a,q.s,[q.p],0,nav);assert.equal(q.a.phase,'chase');assert.equal(q.a.action,null);
 const f=setup();M.tick(f.m,f.a,f.s,[],0,nav,{facilities:[{...f.p,id:'generator',kind:'generator'}]});assert.equal(f.a.phase,'chase','narrower facility is not a0.25m torso');assert.equal(f.a.action,null);assert.throws(()=>M.validateStats({...f.s,facilityReach:NaN}));
});
test('Breaker negative control: old600ms timing is rejected; module stays browser-pure',()=>{
 const src=fs.readFileSync(new URL('../server/field-mob-combat.cjs',import.meta.url),'utf8'),bad=src.replace("windupMs: catalogId==='G5_BREAKER'?900:600","windupMs: catalogId==='G5_BREAKER'?600:600");assert.notEqual(bad,src);
 const module={exports:{}};vm.runInNewContext(bad,{module,exports:module.exports});const guard=api=>{const q=setup(),times=[];for(let t=0;t<2200;t+=50)if(api.tick(q.m,q.a,api.statsFor(q.m.catalogId),[q.p],t,nav))times.push(t);assert.deepEqual(times,[900]);};guard(M);assert.throws(()=>guard(module.exports));
});
test('Breaker actual support cadence and packet metadata select walk/jog, never accelerate a strike',()=>{
 assert(Math.abs(breakerCadence('jog',2.4)-.725373)<.001);assert.equal(breakerCadence('structure_slam',2.4),1);assert.equal(breakerCadence('walk',NaN),1);assert.equal(breakerCadence('walk',1.6,2),breakerCadence('walk',.8));
 for(const engaged of [false,true]){const a={action:null,seq:0,lastTick:0},meta=M.visualAction({catalogId:'G5_BREAKER',anim:'walk',engaged},a);assert.equal(motionFor('walk',meta,['walk','jog'],'G5_BREAKER'),engaged?'jog':'walk');assert.equal(a.action,null);}
});
async function asset(suffix){const b=fs.readFileSync(new URL('../art/3d/monsters/n01-candidates/g5_breaker'+suffix+'.glb',import.meta.url)),json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12))),loader=new GLTFLoader();loader.register(()=>({name:'no_texture_decode',loadTexture:()=>Promise.resolve(new T.Texture())}));return {...await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),json};}
test('Breaker high retains original face/body/clothes position,normal,UV bytes; corruption is caught',()=>{
 const b=fs.readFileSync(new URL('../art/3d/monsters/n01-candidates/g5_breaker.glb',import.meta.url)),jl=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+jl)),bin=b.subarray(jl+28),p=g.meshes[g.nodes.find(n=>n.name==='G5_BREAKER_Body').mesh].primitives[0],expected={POSITION:'605a1a2d63f91345be6d0d7607778f3564391dce1482331c8af6199f90a0e2ab',NORMAL:'f1bbdd5f7f7e5640b6e9a26e1e8eb61f3df2e1cd740ea4d4e9fc8b5118f48017',TEXCOORD_0:'3d14a18fdde777a30ab3d952a2747a23b639e2e6ae18bfa2b606931b27636ce3'},hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 for(const [key,sha] of Object.entries(expected)){const a=g.accessors[p.attributes[key]],v=g.bufferViews[a.bufferView],size=(a.type==='VEC2'?2:3)*4,off=(v.byteOffset||0)+(a.byteOffset||0),bytes=Buffer.concat(Array.from({length:a.count},(_,i)=>bin.subarray(off+i*(v.byteStride||size),off+i*(v.byteStride||size)+size)));assert.equal(hash(bytes),sha);bytes[0]^=1;assert.throws(()=>assert.equal(hash(bytes),sha));}
});
test('high/mobile actual fist surfaces first reach0.92m torso at damage frame27, not peak bone speed',async()=>{
 for(const suffix of ['','_mobile']){const g=await asset(suffix);assert.equal(g.json.asset.extras.cc0FullbodyPilot,true);assert.equal(g.json.asset.extras.breakerStrike.contactFrame,27);const clip=g.animations.find(a=>a.name==='structure_slam'),mx=new T.AnimationMixer(g.scene),a=mx.clipAction(clip);assert(Math.abs(clip.duration-2.2)<1e-5);a.play();a.paused=true;
  function reach(t,facility=false){a.time=t;mx.update(0);g.scene.updateMatrixWorld(true);const hand=g.scene.getObjectByName('Right_CC0Hand'),p=new T.Vector3();hand.skeleton.update();let max=-Infinity;for(let i=0;i<hand.geometry.attributes.position.count;i++){p.fromBufferAttribute(hand.geometry.attributes.position,i);hand.applyBoneTransform(i,p);p.applyMatrix4(hand.matrixWorld);const y=p.y-Math.max(.475,Math.min(1.425,p.y)),r=p.x*p.x+y*y;if(facility){if(Math.abs(p.x)<=.225&&p.y>=0&&p.y<=1)max=Math.max(max,p.z+.175);}else if(r<=.0625)max=Math.max(max,p.z+Math.sqrt(.0625-r));}return max;}
  assert(reach(.9)>=.92);assert(reach(.9,true)>=.88);for(let f=0;f<27;f++){assert(reach(f/30)<.92,'early contact '+suffix+' '+f);assert(reach(f/30,true)<.88,'early facility contact '+suffix+' '+f);}assert.throws(()=>assert(reach(.6)>=.92),'deliberately early600ms contact rejected');mx.stopAllAction();
 }
});
test('high/mobile wrist bridges match actual body/hand skin throughout every standing motion frame',async()=>{
 for(const suffix of ['','_mobile']){const g=await asset(suffix);g.scene.updateMatrixWorld(true);const pairs=[];
  for(const spec of g.json.asset.extras.wristBridges){const bridge=g.scene.getObjectByName(spec.side+'_WristBridge'),body=g.scene.getObjectByName('G5_BREAKER_Body'),hand=g.scene.getObjectByName(spec.side+'_CC0Hand');assert.equal(bridge.geometry.attributes.position.count,spec.nativeBoundary+spec.handBoundary);
   for(let i=0;i<bridge.geometry.attributes.position.count;i++){const target=i<spec.nativeBoundary?body:hand,point=new T.Vector3().fromBufferAttribute(bridge.geometry.attributes.position,i).applyMatrix4(bridge.matrixWorld);let j=-1,error=Infinity;for(let k=0;k<target.geometry.attributes.position.count;k++){const p=new T.Vector3().fromBufferAttribute(target.geometry.attributes.position,k).applyMatrix4(target.matrixWorld),d=p.distanceTo(point);if(d<error){error=d;j=k;}}assert(error<1e-5,'rest seam mismatch');pairs.push({bridge,i,target,j});}
  }
  const mx=new T.AnimationMixer(g.scene),p=new T.Vector3(),q=new T.Vector3();let max=0;for(const name of ['idle','walk','jog','structure_slam','hit','die']){const clip=g.animations.find(a=>a.name===name),a=mx.clipAction(clip);a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();a.paused=true;for(let f=0;f<=Math.round(clip.duration*30);f++){a.time=Math.min(f/30,clip.duration);mx.update(0);g.scene.updateMatrixWorld(true);for(const {bridge,i,target,j} of pairs){bridge.skeleton.update();target.skeleton.update();p.fromBufferAttribute(bridge.geometry.attributes.position,i);bridge.applyBoneTransform(i,p);p.applyMatrix4(bridge.matrixWorld);q.fromBufferAttribute(target.geometry.attributes.position,j);target.applyBoneTransform(j,q);q.applyMatrix4(target.matrixWorld);max=Math.max(max,p.distanceTo(q));}}mx.stopAllAction();}
  const guard=n=>assert(n<.0001,'deforming seam gap '+n);guard(max);assert.throws(()=>guard(max+.01),'deliberate1cm gap rejected');
 }
});
