import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {createInterruptPoseStudy} from '../tools/3d/interrupt-pose-study.mjs';
import api from '../tools/3d/body-footprint.cjs';
import scenario from '../tools/3d/gill-target-scenario.cjs';
import contact from '../server/field-surface-contact.cjs';
import kit from '../server/field-boss-kit.cjs';
import {Field} from '../server/field.cjs';
const profile=JSON.parse(fs.readFileSync(new URL('../art/review/part1/leviathan-body-footprint.json',import.meta.url)));
const body=api.bindBodyFootprint(profile),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('convex capsule separation handles interiors, vertices, boundaries, idempotence and invalid profiles',()=>{
 const square=api.bindBodyFootprint({reviewOnly:true,hull:api.convexHull([{x:-1,z:-1},{x:1,z:-1},{x:1,z:1},{x:-1,z:1}])});
 for(const p of [{x:0,z:0},{x:1,z:0},{x:1.1,z:1.1},{x:-.9,z:.9},{x:3,z:0}]){
  const q=square.resolve(p);assert.ok(square.query(q).signedDistance>=.25-1e-8);
  assert.equal(square.resolve(q).moved,0);
 }
 assert.deepEqual(square.resolve({x:3,z:0}),{x:3,z:0,moved:0});
 const swept=square.move({x:-3,z:0},{x:3,z:0});assert.ok(swept.x<-1.25,'must not teleport through whole body');
 assert.deepEqual(square.move({x:-3,z:3},{x:3,z:3}),{x:3,z:3,moved:0});
 assert.equal(square.move({x:-1.3,z:0},{x:-3,z:0}).x,-3,'can move away');
 assert.throws(()=>assert.ok(square.query({x:0,z:0}).signedDistance>=.22),'no-op negative control');
 assert.equal(api.bindBodyFootprint({...profile,reviewOnly:false}),null);
 assert.equal(api.bindBodyFootprint({...profile,hull:[...profile.hull].reverse()}),null);
 assert.equal(api.bindBodyFootprint({...profile,hull:[{x:NaN,z:0},...profile.hull]}),null);
 assert.throws(()=>square.resolve({x:NaN,z:0}));assert.throws(()=>square.resolve({x:0,z:0},-1));
});
test('slide preserves tangent travel without tunneling, speed gain, corner creep or input mutation',()=>{
 const square=api.bindBodyFootprint({reviewOnly:true,hull:api.convexHull([{x:-1,z:-1},{x:1,z:-1},{x:1,z:1},{x:-1,z:1}])});
 const from={x:-2,z:-.5},to={x:0,z:.5},s=square.slide(from,to),stopped=square.move(from,to);
 assert.ok(Math.abs(s.x+1.25)<1e-7);assert.ok(Math.abs(s.z-.5)<1e-7);
 assert.ok(s.z-stopped.z>.5,'old stop-only solver must fail tangent progress');
 assert.deepEqual(from,{x:-2,z:-.5});assert.deepEqual(to,{x:0,z:.5});
 assert.ok(square.slide({x:-3,z:0},{x:3,z:0}).x<-1.25);
 for(const start of [{x:0,z:0},{x:1.18,z:1.18},{x:1.25,z:1.25},{x:1.25,z:0}]){
  const q=square.slide(start,{x:0,z:0});assert.ok(square.query(q).signedDistance>=.25-1e-7);
 }
 let p={x:-1.25,z:0};for(let i=0;i<1000;i++)p=square.slide(p,{x:p.x+.1,z:p.z});
 assert.ok(p.x<=-1.25&&Math.abs(p.z)<1e-9,'head-on contact must not creep');
 assert.equal(square.slide(p,{x:-3,z:0}).x,-3);
 for(let i=0;i<500;i++){
  const angle=i*2.399963,start={x:3*Math.cos(angle),z:3*Math.sin(angle)},end={x:2*Math.cos(angle+2.1),z:2*Math.sin(angle+2.1)};
  const q=square.slide(start,end);
  assert.ok(square.query(q).signedDistance>=.25-1e-7);
  assert.ok(Math.hypot(q.x-start.x,q.z-start.z)<=Math.hypot(end.x-start.x,end.z-start.z)+1e-7);
  assert.deepEqual(square.slide(start,end),q);
 }
 assert.throws(()=>square.slide(from,{x:NaN,z:0}));assert.throws(()=>square.slide(from,to,-1));
});

test('baked footprint matches candidate provenance and contains off-grid actual deformed vertices',async t=>{
 const bytes=fs.readFileSync(new URL('../art/review/part1/leviathan-gill-candidate.glb',import.meta.url));
 assert.equal(hash(bytes),profile.sourceSha256);
 assert.equal(hash(fs.readFileSync(new URL('../tools/3d/interrupt-pose-study.mjs',import.meta.url))),profile.poseCodeSha256);
 const l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const gl=await l.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const m=gl.scene.getObjectByName('Boss_Mesh'),pose=createInterruptPoseStudy(gl.scene,gl.animations),v=new T.Vector3();
 let maxOutside=0,samples=0;
 for(const clip of gl.animations)for(const f of [.127,.413,.773]){
  pose.pose(clip.name,clip.duration*f);gl.scene.updateMatrixWorld(true);
  for(let i=0;i<m.geometry.attributes.position.count;i++){
   m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld);
   const q=body.query({x:v.x*profile.scale+profile.offset[0],z:v.z*profile.scale+profile.offset[2]});
   maxOutside=Math.max(maxOutside,q.signedDistance);samples++;
  }
 }
 assert.ok(maxOutside<.003,`off-grid envelope escape ${maxOutside}m`);
 t.diagnostic(JSON.stringify({samples,maxOutsideMetres:maxOutside,bodyHeightModel:'conservative infinite vertical column, not3D collision'}));
});
test('incremental diagonal probe slides, stops after input ends and keeps strike/cancel semantics',t=>{
 const cp=JSON.parse(fs.readFileSync(new URL('../art/review/part1/leviathan-gill-contact.json',import.meta.url)));
 const skill=kit.KITS.leviathan.skills.gill,cones=contact.bindSurfaceContactProfile(cp).contacts(skill,skill.hits[0]);
 const bodyProbe={start:{x:Math.min(...body.hull.map(p=>p.x))-2,z:cones[0].origin.z},end:{x:0,z:cones[0].origin.z+3},incremental:true};
 const run=(mode,until,cancelAt=Infinity,withDamage=false)=>{
  const prev=new Map();let maxStep=0;
  const constrain=p=>{const before=prev.get(p.id),q=before?body[mode](before,p):body.resolve(p);
   if(before&&p.id==='body_probe')maxStep=Math.max(maxStep,Math.hypot(q.x-before.x,q.z-before.z));
   p.x=q.x;p.z=q.z;prev.set(p.id,{x:p.x,z:p.z});
  };
  const strike=(p,h,at)=>withDamage?Field.prototype.bossStrike.call({zones:new Map(),clamp(){}},{id:'leviathan',x:0,z:0},p,h,at):{evade:at<p.dodgeUntil};
  return{...scenario.runGillTargetScenario(cones,skill,until,{constrain,bodyProbe,cancelAt,strike}),maxStep};
 };
 const sliding=run('slide',1400),stopped=run('move',1400),p=sliding.targets[5];
 assert.ok(Math.hypot(p.x-stopped.targets[5].x,p.z-stopped.targets[5].z)>.3,'stop negative control loses tangential travel');
 assert.ok(sliding.maxStep<=Math.hypot(bodyProbe.end.x-bodyProbe.start.x,3)/28+1e-7,'no blocked-distance catchup acceleration');
 assert.deepEqual(run('slide',2600).targets[5],p,'no movement without input or damage');
 for(let t=0;t<=2600;t+=37)assert.ok(body.query(run('slide',t).targets[5]).signedDistance>=.25-1e-7);
 const combat=run('slide',2600,Infinity,true);
 assert.equal(new Set(combat.events.map(e=>e.id)).size,combat.events.length);
 assert.ok(combat.events.some(e=>e.id==='dodge'&&e.result.evade));
 assert.ok(!combat.events.some(e=>['late','outside'].includes(e.id)));
 assert.equal(run('slide',2600,1700,true).events.length,0);
 assert.deepEqual(run('slide',2600,Infinity,true),combat);
 t.diagnostic(JSON.stringify({sliding:p,stopped:stopped.targets[5],maxStep:sliding.maxStep,events:combat.events.map(e=>({id:e.id,at:e.at,evade:!!e.result.evade}))}));
});

test('resolved targets use same positions for real Field strikes; collision off is an overlap negative control',t=>{
 const cp=JSON.parse(fs.readFileSync(new URL('../art/review/part1/leviathan-gill-contact.json',import.meta.url)));
 const skill=kit.KITS.leviathan.skills.gill,cones=contact.bindSurfaceContactProfile(cp).contacts(skill,skill.hits[0]);
 const raw=scenario.runGillTargetScenario(cones,skill,0);assert.ok(body.query(raw.targets[0]).signedDistance>.69,'old near marker was visual overlap, NOT physical penetration');
 const bodyProbe={start:{x:Math.min(...body.hull.map(p=>p.x))-2,z:cones[0].origin.z},end:{x:0,z:cones[0].origin.z}};
 assert.ok(body.query(scenario.runGillTargetScenario(cones,skill,1400,{bodyProbe}).targets[5]).signedDistance<0,'unconstrained moving probe penetrates');
 const buildConstraint=()=>{const prev=new Map();return p=>{const q=prev.has(p.id)?body.move(prev.get(p.id),p):body.resolve(p);Object.assign(p,q);prev.set(p.id,{x:p.x,z:p.z})}};
 const strike=(p,h,at)=>Field.prototype.bossStrike.call({zones:new Map(),clamp(){}},{id:'leviathan',x:0,z:0},p,h,at);
 const result=scenario.runGillTargetScenario(cones,skill,2600,{constrain:buildConstraint(),strike,bodyProbe});
 for(const p of result.targets)assert.ok(body.query(p).signedDistance>=.25-1e-7,`overlap ${p.id}`);
 assert.equal(new Set(result.events.map(e=>e.id)).size,result.events.length);
 assert.ok(result.events.some(e=>e.id==='near'));assert.ok(result.events.some(e=>e.id==='dodge'&&e.result.evade));
 assert.ok(!result.events.some(e=>e.id==='outside'||e.id==='late'));
 assert.equal(scenario.runGillTargetScenario(cones,skill,2600,{constrain:buildConstraint(),strike,cancelAt:1700}).events.length,0);
 assert.deepEqual(scenario.runGillTargetScenario(cones,skill,2600,{constrain:buildConstraint(),strike,bodyProbe}),result);
 t.diagnostic(JSON.stringify(result.events.map(e=>({id:e.id,at:e.at,evade:!!e.result.evade}))));
});
