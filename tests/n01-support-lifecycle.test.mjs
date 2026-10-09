import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import * as THREE from '../vendor/three/three.module.js';import {createMobView} from '../js/mmo/field-mobs.js';
const M=createRequire(import.meta.url)('../server/field-mob-combat.cjs');
const nav={legal:()=>true,safe:()=>false,canTraverse:()=>true,route:()=>null};
test('Resonator casts on each stationary hold entry, never every tick; relocation/hit permits a fresh gesture',()=>{
 const m={id:'r',catalogId:'G5_RESONATOR',x:0,z:0,alive:true,group:{area:{}}},a=M.reset(m,0),s=M.statsFor(m.catalogId),ctx={allies:[{id:'w',catalogId:'G5_WALKER',x:3.5,z:0,alive:true}]};
 M.tick(m,a,s,[],0,nav,ctx);assert.equal(a.action.key,'aura_cast');const first=a.seq;
 for(let t=50;t<=3000;t+=50)M.tick(m,a,s,[],t,nav,ctx);assert.equal(a.seq,first);
 ctx.allies[0].x=8;for(let t=3050;t<=6000;t+=50)M.tick(m,a,s,[],t,nav,ctx);assert.equal(a.seq,first+1);assert.equal(a.action.key,'aura_cast');
 M.stagger(a,6000);M.tick(m,a,s,[],6050,nav,ctx);assert.equal(m.anim,'hit');M.tick(m,a,s,[],6200,nav,ctx);assert.equal(a.action.key,'aura_cast');assert.equal(a.seq,first+3);
 assert.equal(s.damage,640);assert.equal(s.speed,2.9);assert.equal(a.resonanceAttack,1);
});
async function fixture(){
 const old=globalThis.document,element=()=>({style:{},firstChild:{style:{}},appendChild(){},remove(){},innerHTML:''});globalThis.document={createElement:element};
 const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(.3,1.8,.2),new THREE.MeshStandardMaterial()));
 const asset={scene,animations:[new THREE.AnimationClip('idle',4,[]),new THREE.AnimationClip('aura_cast',2.4,[])]};
 const view=createMobView({THREE,clone:s=>s.clone(true),scene:new THREE.Scene(),loadBody:async()=>asset,hud:element(),tagAt(){},catalog:[{id:'G5_RESONATOR',name:'공진자',grade:5}]});await Promise.resolve();
 const row=(seq,elapsedMs)=>({id:'g:r:0',catalogId:'G5_RESONATOR',x:0,z:0,alive:true,generation:1,anim:'idle',seq,action:{key:'aura_cast',clip:'aura_cast',support:true,seq,elapsedMs,windupMs:600}});
 return {view,row,v:()=>view.views.get('g:r:0'),restore(){view.update([],.01);globalThis.document=old;}};
}
test('actual Three.js view finishes aura to idle and ignores stale repeats, but plays a new hold sequence',async()=>{
 const f=await fixture();try{
  f.view.update([f.row(1,0)],.1);assert.equal(f.v().cur,'support');assert.equal(f.v().current.getClip().name,'aura_cast');assert.equal(f.v().warn,null);
  f.view.update([f.row(1,2400)],.1);assert.equal(f.v().cur,'idle');assert.equal(f.v().current.getClip().name,'idle');
  f.view.update([f.row(1,0)],.1);assert.equal(f.v().cur,'idle');
  f.view.update([f.row(2,0)],.1);assert.equal(f.v().cur,'support');assert.equal(f.v().supportPlaybackSeq,2);
 }finally{f.restore();}
});
test('a late join after aura completion starts idle, and the mixer itself can finish an action without fresh elapsed metadata',async()=>{
 const f=await fixture();try{
  f.view.update([f.row(1,2500)],.01);assert.equal(f.v().cur,'idle');
  f.view.update([f.row(2,0)],2.5);f.view.update([f.row(2,0)],.01);assert.equal(f.v().cur,'idle');
  // Negative control: losing the sequence guard visibly replays stale support.
  f.v().supportFinishedSeq=undefined;f.view.update([f.row(2,0)],.01);assert.throws(()=>assert.equal(f.v().cur,'idle'));
 }finally{f.restore();}
});
