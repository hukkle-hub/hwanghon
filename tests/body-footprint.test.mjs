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
