import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makePoser} from '../tools/3d/pose-eval.mjs';
import {createInterruptPoseStudy} from '../tools/3d/interrupt-pose-study.mjs';
async function load(){const b=fs.readFileSync(new URL('../art/review/part1/leviathan-gill-candidate.glb',import.meta.url)),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')}
function vertices(root){const m=root.getObjectByName('Boss_Mesh'),a=[];root.updateMatrixWorld(true);for(let i=0;i<m.geometry.attributes.position.count;i+=113)a.push(m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrixWorld));return a}
const distance=(a,b)=>Math.max(...a.map((p,i)=>p.distanceTo(b[i])));
test('interruption keeps exact source pose, closes gills continuously, reaches authored idle, supports reverse seeks',async t=>{
 const gl=await load(),r=gl.scene,study=createInterruptPoseStudy(r,gl.animations),clip=gl.animations.find(c=>c.name==='atk_gill');
 const original=makePoser(r,clip),idle=makePoser(r,gl.animations.find(c=>c.name==='idle'));
 let maxJump=0;
 for(const cancel of [0,.65,1.42,1.7,1.82,2.4]){
  original(cancel);const expected=vertices(r);
  assert.equal(study.pose('atk_gill',cancel,cancel),'interrupt');assert.ok(distance(expected,vertices(r))<1e-9);
  for(const edge of [cancel,cancel+.18,cancel+1.1,cancel+1.35]){
   study.pose('atk_gill',Math.max(0,edge-1e-5),cancel);const before=vertices(r);
   study.pose('atk_gill',edge+1e-5,cancel);maxJump=Math.max(maxJump,distance(before,vertices(r)));
  }
  let end;for(let dt=0;dt<=1.6;dt+=1/60){study.pose('atk_gill',cancel+dt,cancel);end=vertices(r);assert.ok(end.every(v=>v.toArray().every(Number.isFinite)))}
  assert.equal(study.pose('atk_gill',cancel+1.6,cancel),'idle');const final=vertices(r);idle(.5);assert.ok(distance(final,vertices(r))<1e-8);
  study.pose('atk_gill',cancel+.08,cancel);const forward=vertices(r);study.pose('atk_gill',cancel+1.6,cancel);study.pose('atk_gill',cancel+.08,cancel);assert.ok(distance(forward,vertices(r))<1e-9);
 }
 assert.ok(maxJump<.001,`raw mesh discontinuity ${maxJump}`);
 original(1.42);const open=vertices(r);study.pose('atk_gill',2.2,1.42);const closed=vertices(r);
 assert.ok(distance(open,closed)>.03,'negative control: an unchanged attack pose must be detected');
 assert.throws(()=>assert.ok(distance(open,closed)<1e-9));
 assert.deepEqual(r.getObjectByName('Boss_Mesh').morphTargetInfluences,[0,0]);
 t.diagnostic(JSON.stringify({maxBoundaryJumpRawUnits:maxJump,fullBodyVertexSamples:vertices(r).length}));
});
test('uncancelled tracks unchanged; clip switch clears morphs; invalid input rejected',async()=>{
 const gl=await load(),r=gl.scene,study=createInterruptPoseStudy(r,gl.animations);
 for(const name of ['atk_gill','atk_pressure','atk_tidal'])for(const t of [0,.6,1.7,2.3]){
  makePoser(r,gl.animations.find(c=>c.name===name))(t);const expected=vertices(r);study.pose(name,t);assert.ok(distance(expected,vertices(r))<1e-9);
 }
 study.pose('atk_gill',1.5);study.pose('atk_pressure',0);assert.deepEqual(r.getObjectByName('Boss_Mesh').morphTargetInfluences,[0,0]);
 assert.ok(Math.abs(study.duration('atk_gill',1.82)-3.67)<1e-6);
 assert.throws(()=>study.pose('missing',0));assert.throws(()=>study.pose('atk_gill',NaN));
 assert.throws(()=>createInterruptPoseStudy(r,gl.animations,{blendIn:2}));
});
