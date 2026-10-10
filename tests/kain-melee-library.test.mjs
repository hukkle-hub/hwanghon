import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {createRequire} from 'node:module';
import {HERO_MELEE_DATA} from '../js/hero-melee-data.js';
import {sampleAction} from '../js/combat-motion.js';
import {report} from '../tools/3d/audit-kain-melee.mjs';
const require=createRequire(import.meta.url),C=require('../server/content.cjs'),{createBattle}=require('../js/combat.js'),{Raid}=require('../server/raid.cjs'),copy=x=>JSON.parse(JSON.stringify(x));

test('Kain six melee takes: actual original/mobile skin, wrists and blade geometry at 241 samples',()=>{
 for(const[lod,clips]of Object.entries(report.models))for(const[name,r]of Object.entries(clips)){
  assert.ok(r.leftGripGap<.001&&r.rightGap<.001,name+' detached sword');
  assert.ok(r.wristDegrees<30,name+' bent wrist');
  assert.ok(r.upperClearance>.18&&r.foreClearance>.18,name+' arm buried in torso');
  // Tucked elbows may be closer than shoulder width. A forced 40 cm minimum
  // encouraged chicken-wing poses; test actual left/right crossing instead.
  assert.ok(r.elbowSeparation>.22&&r.minSignedElbowSpacing>.16,name+' crossed elbows');
  assert.ok(r.maxArmRate<20,name+' discontinuous arm');
  assert.ok(r.collapsedFraction<.006&&r.stretchedFraction<(lod==='mobile'?.015:.018),name+' collapsed/stretched arm surface');
  assert.ok(r.bladeContact<.39,name+' blade misses target');
  const bad={...r,leftGripGap:.2,collapsedFraction:.5,maxArmRate:90};
  assert.throws(()=>assert.ok(bad.leftGripGap<.001&&bad.collapsedFraction<.006&&bad.maxArmRate<20));
 }
 for(const clips of Object.values(report.models)){const d=clips.counter.contactPose.elbowDrops;assert.ok(d.Right>0&&d.Left>.20,'counter support elbow must remain lowered, lead arm must not shrug');}
});

test('Kain natural counter shape rejects the actual old lifted-elbow source',()=>{
 const accept=pose=>assert.ok(pose.elbowDrops.Right>0&&pose.elbowDrops.Left>.20,'raised support elbow');
 for(const lod of ['original','mobile']){accept(report.models[lod].counter.contactPose);assert.throws(()=>accept(report.rejectedCounterSourcePose[lod]));}
});

test('Kain recovery returns the coupled sword to ready instead of drifting behind the body',()=>{
 for(const c of Object.values(HERO_MELEE_DATA.kain)){
  assert.ok(new T.Vector3().fromArray(c.weaponPositions).distanceTo(new T.Vector3().fromArray(c.weaponPositions,c.weaponPositions.length-3))<.001,'ready grip drift');
  assert.ok(new T.Quaternion().fromArray(c.weaponRotations).normalize().angleTo(new T.Quaternion().fromArray(c.weaponRotations,c.weaponRotations.length-4).normalize())<.001,'ready blade roll');
 }
});

test('Kain six clocks: solo and online share contacts; no legacy clip compression',()=>{
 for(const[name,c]of Object.entries(HERO_MELEE_DATA.kain)){
  const profile=C.rules.motion.characterProfiles.kain[name];
  assert.equal(c.times[0],0);assert.equal(c.times.at(-1),c.duration);assert.equal(profile.duration,c.duration);
  assert.ok(Math.abs(profile.hit/profile.duration-c.contactPhase)<1e-10);
  assert.ok(Math.abs(C.rules.motion.clipContactsByChar.kain[name]-c.contactPhase)<1e-10);
  for(const aspd of [70,100,160]){
   const r=new Raid('d01',[{id:'k',character:'kain'}]);r.startFight();const p=r.players.get('k');p.stats.aspd=aspd;
   r.action(p,name==='counter'?'counter':name==='exec'?'exec':name==='smash'?'smash':'attack',1,0,{clip:name});const online=p.action;
   const b=createBattle({rules:copy(C.rules),dummy:{...copy(C.arenas.tutorial.stages[0]),patterns:[]},char:{...C.character,id:'kain',stats:{...C.character.stats,aspd,crit:0}},skills:C.skills.kain,ult:C.skills.kainUlt});
   if(name==='smash'||name==='attack1'){b.input(name==='smash'?'smash':'attack');const solo=b.snapshot().player.action;for(const f of ['hitAt','duration','cancelAt','clipHit'])assert.equal(solo[f],online[f]);b.tick(solo.hitAt-.011);assert.equal(b.metrics.hits,0);b.tick(.021);assert.ok(b.metrics.hits>0);const hits=b.metrics.hits;b.tick(.03);assert.equal(b.metrics.hits,hits);}
   assert.equal(online.duration,c.duration/(aspd/100));
   assert.ok(Math.abs(sampleAction({...online,elapsed:online.hitAt,fullBodyMocap:true},c.duration)-c.contactPhase*c.duration)<1e-8);
   assert.ok(Math.abs(sampleAction({...online,elapsed:online.duration,fullBodyMocap:true},c.duration)-c.duration)<1e-8);
  }
 }
 assert.match(fs.readFileSync('js/game3d.js','utf8'),/span=oc.userData\?\.fullBody\?1:/);
 assert.ok(fs.readFileSync('sw.js','utf8').includes('js/hero-melee-data.js'));
});
