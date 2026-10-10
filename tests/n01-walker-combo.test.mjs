import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
import {comboTell} from '../js/mmo/n01-combo-tell.js';import {WALKER_COMBO} from '../tools/monsters/build-walker-combo.mjs';
import * as T from '../vendor/three/three.module.js';import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
const M=createRequire(import.meta.url)('../server/field-mob-combat.cjs'),nav={safe:()=>false,legal:()=>true,canTraverse:()=>true,route:()=>null};
function setup(){const m={id:'w',catalogId:'G5_WALKER',x:0,z:0,alive:true,group:{area:{}}};return {m,a:M.reset(m,0),s:M.statsFor(m.catalogId),p:{id:'p',x:0,z:.85}};}
test('combo each point rechecks range/wall; interrupt or lost target cancels remaining damage',()=>{
 for(const kind of ['range','wall','stagger','target','disconnect']){const {m,a,s,p}=setup();M.tick(m,a,s,[p],0,nav);assert.equal(M.tick(m,a,s,[p],600,nav).damage,425);let players=[p],n=nav;
  if(kind==='range')p.z=2;if(kind==='wall')n={...nav,canTraverse:()=>false};if(kind==='stagger')M.stagger(a,2200);if(kind==='target')players=[{...p,id:'other'}];if(kind==='disconnect')players=[];
  assert.equal(M.tick(m,a,s,players,2300,n),null,kind);assert.equal(M.tick(m,a,s,[p],2350,nav),null,kind+' must not replay cancelled/missed hit');}
});
test('combo does not replay stale hits after clock suspension; facility budget stays300',()=>{
 const {m,a,s,p}=setup();M.tick(m,a,s,[p],0,nav);const h=M.tick(m,a,s,[p],2400,nav);assert.equal(h.hitIndex,2);assert.equal(h.damage,425);assert.equal(M.tick(m,a,s,[p],2401,nav),null);
 const q=setup(),context={facilities:[{id:'gate',kind:'gate',x:0,z:.85}]};M.tick(q.m,q.a,q.s,[],0,nav,context);const hs=[600,2300].map(t=>M.tick(q.m,q.a,q.s,[],t,nav,context));assert(hs.every(h=>h.targetKind==='gate'));assert.equal(hs.reduce((n,h)=>n+h.damage,0),300);
});
test('negative control: duplicated early second impact fails the20Hz schedule guard',()=>{
 const source=fs.readFileSync(new URL('../server/field-mob-combat.cjs',import.meta.url),'utf8'),bad=source.replace('offsetMs:2300','offsetMs:600');assert.notEqual(bad,source);const module={exports:{}};vm.runInNewContext(bad,{module,exports:module.exports});
 const guard=api=>{const {m,a,s,p}=setup(),times=[];for(let now=0;now<3700;now+=50)if(api.tick(m,a,s,[p],now,nav))times.push(now);assert.deepEqual(times,[600,2300]);};guard(M);assert.throws(()=>guard(module.exports),assert.AssertionError);
});
test('both telegraphs appear without restarting the combo animation',()=>{
 const expected=WALKER_COMBO.strikes.map(({offsetMs,scale})=>({offsetMs,scale}));assert.deepEqual(M.actionFor('G5_WALKER').strikes,expected);const copy=M.actionFor('G5_WALKER');copy.strikes[0].offsetMs=1;assert.deepEqual(M.actionFor('G5_WALKER').strikes,expected,'review metadata must not mutate the authoritative timing');
 const action={windupMs:600,strikes:WALKER_COMBO.strikes};assert.equal(comboTell(action,300).visible,true);assert.equal(comboTell(action,1000).visible,false);assert.deepEqual(comboTell(action,2000),{visible:true,remainingSeconds:.3,durationSeconds:.6});assert.equal(comboTell(action,2600).visible,false);assert.equal(comboTell({windupMs:600},2000),null);assert.throws(()=>assert.equal(comboTell({...action,strikes:[action.strikes[0]]},2000)?.visible,true));
});
test('actual skinned left/right fists contact at the two damage frames; not just bone coordinates',async()=>{
 const bytes=fs.readFileSync(new URL('../art/3d/monsters/n01-candidates/g5_walker.glb',import.meta.url)),n=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+n).toString().trim());assert.equal(json.asset.extras.walkerCombo.durationMs,3700);
 const loader=new GLTFLoader();loader.register(()=>({name:'no_texture_decode',loadTexture:()=>Promise.resolve(new T.Texture())}));const g=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const clip=g.animations.find(c=>c.name==='slow_combo');assert(Math.abs(clip.duration-3.7)<1e-5);const mixer=new T.AnimationMixer(g.scene),a=mixer.clipAction(clip);a.play();a.paused=true;
 function reach(side,time){a.time=time;mixer.update(0);g.scene.updateMatrixWorld(true);const hand=g.scene.getObjectByName(side+'_CC0Hand');hand.skeleton.update();const p=new T.Vector3();let r=-Infinity;for(let i=0;i<hand.geometry.attributes.position.count;i++){p.fromBufferAttribute(hand.geometry.attributes.position,i);hand.applyBoneTransform(i,p);p.applyMatrix4(hand.matrixWorld);const y=p.y-Math.max(.475,Math.min(1.425,p.y)),q=p.x*p.x+y*y;if(q<=.0625)r=Math.max(r,p.z+Math.sqrt(.0625-q));}return r;}
 for(const [side,time]of [['Left',.6],['Right',2.3]]){assert(reach(side,time)>=.849,side+' fails contact');assert(reach(side,time-1/30)<.849,side+' damage is late relative to first contact');}
 assert.throws(()=>assert(reach('Right',1.8)>=.849),'deliberately early right-hit must fail');mixer.stopAllAction();mixer.uncacheRoot(g.scene);
});
