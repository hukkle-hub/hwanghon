import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {walkerCadence} from '../js/mmo/n01-motion-cadence.js';import {motionFor} from '../js/mmo/n01-body-catalog.js';
const M=createRequire(import.meta.url)('../server/field-mob-combat.cjs'),nav={safe:()=>false,legal:()=>true,canTraverse:()=>true,route:()=>null};
test('Walker jab-cross: two host impacts600/2300ms, total850, no duplicate or early restart',()=>{
 const m={id:'w',catalogId:'G5_WALKER',x:0,z:0,alive:true,group:{area:{}}},a=M.reset(m,0),s=M.statsFor(m.catalogId),p={id:'p',x:0,z:.8};
 const hits=[];for(let now=0;now<3700;now+=50){const h=M.tick(m,a,s,[p],now,nav);if(h)hits.push({now,...h});assert.equal(a.seq,1);assert.equal(m.anim,'attack');}assert.equal(a.action.windupMs,600);assert.equal(a.action.recoveryMs,3100);assert.deepEqual(hits.map(h=>h.now),[600,2300]);assert.deepEqual(hits.map(h=>h.hitIndex),[1,2]);assert.equal(hits.reduce((n,h)=>n+h.damage,0),850);assert.notEqual(hits[0].beat,hits[1].beat);assert(hits.every(h=>h.skill==='slow_combo'));assert.equal(M.tick(m,a,s,[p],3700,nav),null);assert.equal(a.seq,2);assert.equal(a.phase,'windup');
});
test('Walker cannot hit a torso 2m away with a 0.6m fist; damage/speed other roles unchanged',()=>{
 assert.equal(M.statsFor('G5_WALKER').reach,.85);assert.equal(M.statsFor('G5_WALKER').speed,2.85);assert.equal(M.statsFor('G5_WALKER').damage,850);assert.equal(M.statsFor('G5_STALKER').reach,2.2);
 const m={id:'w',catalogId:'G5_WALKER',x:0,z:0,alive:true,group:{area:{}}},a=M.reset(m,0);M.tick(m,a,M.statsFor(m.catalogId),[{id:'p',x:0,z:2}],0,nav);assert.equal(a.phase,'chase');assert.equal(a.action,null);
});
test('Walker patrol and chase pick authored walk/jog; metadata never mutates authoritative action',()=>{
 const a={action:null,seq:0,lastTick:0};for(const engaged of [false,true]){const meta=M.visualAction({catalogId:'G5_WALKER',anim:'walk',engaged},a);assert.equal(motionFor('walk',meta,['walk','jog'],'G5_WALKER'),engaged?'jog':'walk');}assert.equal(a.action,null);assert.equal(motionFor('walk',{locomotion:'run'},['walk'],'G5_WALKER'),'walk');
});
test('Measured cadence respects m/s, model scale and only locomotion; wrong normal speed is rejected',()=>{
 assert(Math.abs(walkerCadence('walk',1.6)-1.623827)<.001);assert(Math.abs(walkerCadence('jog',2.85)-.99154)<.001);assert.equal(walkerCadence('slow_combo',2.85),1);assert.equal(walkerCadence('walk',NaN),1);assert.equal(walkerCadence('walk',1.6,0),1);assert.equal(walkerCadence('walk',1.6,2),walkerCadence('walk',.8));const check=n=>assert(Math.abs(n-walkerCadence('walk',1.6))<.01);assert.throws(()=>check(1));
});
