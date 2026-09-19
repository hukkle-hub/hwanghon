import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {prepareMarshMotion,detachBossPiece,bossAttackSpec,bossPartPieces} from '../js/marsh-motion.js';
import vm from 'node:vm';
/* 아레나 데이터 — 연계 비트가 어느 클립을 가리키는지는 «데이터» 가 정한다 */
const ctx={window:{},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console,document:{dispatchEvent(){}},CustomEvent:function(){}};
vm.createContext(ctx);
for(const n of ['world','items','save','dungeons'])vm.runInContext(fs.readFileSync(new URL('../js/'+n+'.js',import.meta.url),'utf8'),ctx,{filename:n});
const MARSH=ctx.window.TW_DUNGEONS.ARENAS.marsh;
const bytes=fs.readFileSync(new URL('../art/3d/boss_marsh.glb',import.meta.url));
const raw=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const asset=prepareMarshMotion(raw);
const v2bytes=fs.readFileSync(new URL('../art/3d/boss_marsh_v2.glb',import.meta.url));
const v2raw=await new GLTFLoader().parseAsync(v2bytes.buffer.slice(v2bytes.byteOffset,v2bytes.byteOffset+v2bytes.byteLength),'');
const v2=prepareMarshMotion(v2raw);
test('Morbus GLB has all combat bones, detachable parts and finite animation poses',()=>{
 for(const name of ['Head','Spine1','FR_Low','Tail2','Spine','Spine2','piece_back','piece_legf','piece_tail'])
   assert.ok(asset.scene.getObjectByName(name),name);
 const mixer=new T.AnimationMixer(asset.scene);
 for(const name of ['idle','walk','atk_bolt','atk_flame','atk_hammer','atk_scythe','atk_drop','hit','stagger','down','up','death']){
   const clip=asset.animations.find(c=>c.name===name);assert.ok(clip,name);
   mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();action.paused=true;
   for(let i=0;i<=30;i++){action.time=clip.duration*i/30;mixer.update(0);asset.scene.updateMatrixWorld(true);
     asset.scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),name));
   }
 }
 mixer.stopAllAction();
});
test('charge is in-place horizontally without mutating the original asset',()=>{
 const before=raw.animations.find(c=>c.name==='atk_bolt').tracks.find(t=>t.name==='Hips.position');
 const after=asset.animations.find(c=>c.name==='atk_bolt').tracks.find(t=>t.name==='Hips.position');
 assert.ok(before&&after);
 assert.ok(before.values.some((v,i)=>i%3===2&&Math.abs(v-before.values[2])>.01));
 for(let i=0;i<after.values.length;i+=3){
   assert.equal(after.values[i],after.values[0]);assert.equal(after.values[i+2],after.values[2]);
   assert.equal(after.values[i+1],before.values[i+1]);
 }
 assert.equal(prepareMarshMotion(raw),asset);
});
test('prepareMarshMotion no longer synthesises clips: every beat has a real one in the GLB',()=>{
 /* 예전에는 atk_drop 한 편을 잘라 2·3타를 «만들어» 썼다. 이제 리그가 비트마다 따로 굽는다. */
 assert.equal(v2.animations.length,v2raw.animations.length);
 for(const name of ['atk_bolt_b','atk_drop','atk_drop_b','atk_drop_c'])
   assert.ok(v2.animations.some(c=>c.name===name),name);
 for(const gone of ['atk_drop_left','atk_drop_finish'])
   assert.equal(v2.animations.some(c=>c.name===gone),false,gone);
 /* 연계 클립은 1타를 다시 튼 것이 아니라 실제로 다른 동작이다 */
 /* evaluate() 는 타입배열을 돌려준다 — Array.flat() 은 타입배열을 펴지 않아
    그대로 두면 비교가 전부 NaN 이 되어 «차이 없음» 으로 통과한다. Array.from 으로 옮긴다. */
 const at=(c,t)=>c.tracks.flatMap(k=>Array.from(k.createInterpolant().evaluate(c.duration*t)));
 for(const [base,chain] of [['atk_bolt','atk_bolt_b'],['atk_drop','atk_drop_b'],['atk_drop','atk_drop_c'],['atk_drop_b','atk_drop_c']]){
  const x=v2.animations.find(c=>c.name===base),y=v2.animations.find(c=>c.name===chain);
  let apart=0;
  for(const t of [.2,.35,.5,.65,.8]){const a=at(x,t),b=at(y,t);
   assert.equal(a.length,b.length);
   if(a.some((v,i)=>Math.abs(v-b[i])>.05))apart++;}
  assert.ok(apart>=3,base+' vs '+chain+': 서로 다른 구간이 '+apart+'개뿐');
 }
});
test('every strike clip reaches peak speed at its declared contact frame',()=>{
 /* sampleBossAttack 은 hitFrac 으로 «맞는 순간» 을 클립 시간에 맞춘다. 모션의 최고속이
    거기서 나지 않으면 이펙트와 그림이 어긋난다. 실측 오차는 전부 ±0.06 안. */
 const mixer=new T.AnimationMixer(v2.scene);
 const cases=[['bolt','Head'],['boltB','Head'],['hammer','FR_Foot'],['scythe','Tail3'],
              ['drop','FR_Foot'],['dropB','FL_Foot'],['dropC','FR_Foot']];
 for(const [icon,bone] of cases){
  const spec=MARSH.atk[icon];assert.ok(spec,icon);
  const clip=v2.animations.find(c=>c.name===spec.clip);assert.ok(clip,spec.clip);
  const o=v2.scene.getObjectByName(bone);assert.ok(o,bone);
  mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();action.paused=true;
  const N=120,pts=[];
  for(let i=0;i<=N;i++){action.time=clip.duration*i/N;mixer.update(0);v2.scene.updateMatrixWorld(true);
   pts.push(o.getWorldPosition(new T.Vector3()));}
  let best=-1,at=0;
  for(let i=1;i<N;i++){const d=pts[i+1].distanceTo(pts[i-1]);if(d>best){best=d;at=i/N;}}
  assert.ok(Math.abs(at-spec.hitFrac)<=.06,spec.clip+' 최고속 t='+at.toFixed(3)+' hitFrac='+spec.hitFrac);
 }
 mixer.stopAllAction();
});
test('detaching a scaled boss part preserves its complete world transform',()=>{
 const scene=new T.Scene(),root=new T.Group(),bone=new T.Group(),piece=new T.Group();
 scene.add(root);root.add(bone);bone.add(piece);root.scale.setScalar(.85);
 root.position.set(4,0,7);root.rotation.y=.7;bone.rotation.x=.3;piece.position.set(1,2,3);
 scene.updateMatrixWorld(true);const before=piece.matrixWorld.clone();
 detachBossPiece(piece,scene);scene.updateMatrixWorld(true);
 assert.equal(piece.parent,scene);
 piece.matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-before.elements[i])<1e-8));
});
test('chain beats are wired by data and each resolves to its own clip',()=>{
 /* 비트는 chain[].icon 으로 «자기 클립» 을 고른다 (beatsOf 가 {...def,...raw} 로 덮어쓴다).
    서버(server/raid.cjs)와 솔로(js/combat.js)가 같은 규칙을 쓰므로 한 곳만 검사하면 된다. */
 const stages=Object.fromEntries(MARSH.stages.map(s=>[s.id,s]));
 const beatIcons=pattern=>[pattern.icon,...(pattern.chain||[]).map(c=>c.icon||pattern.icon)];
 const bolt=stages.morbus.patterns.find(p=>p.icon==='bolt');
 assert.deepEqual(beatIcons(bolt),['bolt','boltB']);
 const drop=stages.rage.patterns.find(p=>p.icon==='drop');
 assert.deepEqual(beatIcons(drop),['drop','dropB','dropC']);
 /* 그 아이콘들이 실제로 서로 다른, GLB 에 있는 클립을 가리킨다 */
 const clips=new Set();
 for(const pattern of [bolt,drop])for(const [i,icon] of beatIcons(pattern).entries()){
  const spec=bossAttackSpec(MARSH,icon,i+1);
  assert.ok(v2.animations.some(c=>c.name===spec.clip),icon+' -> '+spec.clip);
  assert.equal(clips.has(spec.clip),false,'중복 클립 '+spec.clip);clips.add(spec.clip);
 }
 assert.equal(clips.size,5);
 /* 아이콘이 없는 비트와 모르는 아이콘은 1타 클립으로 떨어진다 (서버가 옛 데이터를 보내도 깨지지 않는다) */
 assert.equal(bossAttackSpec(MARSH,'drop',2).clip,'atk_drop');
 assert.equal(bossAttackSpec(MARSH,'nope',1),Object.values(MARSH.atk)[0]);
});
test('V2 is a bounded three-material rig with separately attached left/right armor',()=>{
 const materials=new Set();let triangles=0;
 v2.scene.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);
 triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
 assert.equal(materials.size,3);assert.ok(triangles<90000);assert.ok(v2bytes.length<1024*1024);
 const legs=bossPartPieces(v2.scene,'legf');assert.equal(legs.length,2);
 assert.notEqual(legs[0].parent,legs[1].parent);
 assert.equal(v2.animations.length,15);   /* 12 + 연계 전용 atk_bolt_b · atk_drop_b · atk_drop_c */
 const mixer=new T.AnimationMixer(v2.scene);
 for(const clip of v2.animations){
  mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();action.paused=true;
  for(let i=0;i<=24;i++){
   action.time=clip.duration*i/24;mixer.update(0);v2.scene.updateMatrixWorld(true);
   v2.scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),clip.name));
  }
 }
 mixer.stopAllAction();
 console.log('Morbus V2: '+triangles+' triangles, '+materials.size+' materials, '+v2bytes.length+' bytes');
});
