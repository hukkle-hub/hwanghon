import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {repairAinClips} from '../js/ain-bind-repair.js';
import {AIN_SKILL_PATHS} from '../js/ain-two-hand.js';
import {Animated} from '../js/party-avatar.js';
const {Raid}=createRequire(import.meta.url)('../server/raid.cjs');
async function load(name){const b=await readFile('art/3d/'+name+'.glb'),l=new GLTFLoader();l.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('five skills have distinct paths; spin uses full-body rotation and resolve a guarded body',async()=>{
 assert.equal(new Set(Object.values(AIN_SKILL_PATHS).map(JSON.stringify)).size,5);
 const asset=await load('ain_anim'),original=asset.animations.map(c=>c.toJSON()),clips=repairAinClips(asset.animations,{changed:new Map()});
 /* 몸을 빌려 오는 둘. skill4 는 guard 를 그대로(값까지 같다), ult 는 smash 를 시간만 옮겨 쓴다. */
 for(const [name,source] of [['skill4','guard'],['ult','smash']]){
  const c=clips.find(c=>c.name===name),s=asset.animations.find(c=>c.name===source);
  assert.equal(c.duration,asset.animations.find(c=>c.name===name).duration);
  for(const t of c.tracks){const st=s.tracks.find(x=>x.name===t.name);assert.notEqual(t,st);assert.ok(t.times.length>=st.times.length);assert.ok(t.values.every(Number.isFinite));if(name==='skill4')assert.deepEqual(t.values,st.values);}
 }
 /* skill3(피의 회전)은 «자기 가로 베기 + 합성한 한 바퀴» 다 — 빌려 오지 않는다.
    골반만 다시 뜨고 팔·다리는 원본 그대로여야 한다 (docs/design/49 §8.3). */
 {
  const c=clips.find(c=>c.name==='skill3'),s=asset.animations.find(c=>c.name==='skill3');
  assert.equal(c.duration,s.duration);
  const hips=c.tracks.find(t=>/Hips\.quaternion$/.test(t.name));
  const hipsSrc=s.tracks.find(t=>/Hips\.quaternion$/.test(t.name));
  assert.ok(hips&&hipsSrc,'골반 쿼터니언 트랙이 있어야 한다');
  assert.notDeepEqual(Array.from(hips.values),Array.from(hipsSrc.values),'골반에 회전이 얹혀야 한다');
  assert.ok(hips.values.every(Number.isFinite));
  for(const t of c.tracks){
   if(/Hips\./.test(t.name))continue;
   const st=s.tracks.find(x=>x.name===t.name);
   if(st)assert.deepEqual(Array.from(t.values),Array.from(st.values),t.name+' 은 건드리지 않는다');
  }
 }
 assert.deepEqual(asset.animations.map(c=>c.toJSON()),original);
 const spin=clips.find(c=>c.name==='skill3').tracks.find(t=>/Hips.quaternion$/.test(t.name));
 const sample=spin.createInterpolant(),q=new T.Quaternion(),e=new T.Euler(0,0,0,'YXZ');let previous=0,total=0;
 for(let i=0;i<=240;i++){q.fromArray(sample.evaluate(i*clips.find(c=>c.name==='skill3').duration/240));const y=e.setFromQuaternion(q,'YXZ').y;if(i)total+=Math.atan2(Math.sin(y-previous),Math.cos(y-previous));previous=y;}
 assert.ok(Math.abs(total)>6,'spin must rotate the hips, not just the arms');
 q.fromArray(sample.evaluate(clips.find(c=>c.name==='skill3').duration*.55));assert.ok(Math.abs(e.setFromQuaternion(q,'YXZ').y)<.25,'face opponent at authoritative clip contact');
 assert.throws(()=>assert.deepEqual(AIN_SKILL_PATHS.skill1,AIN_SKILL_PATHS.skill3),'generic duplicate path must fail');
});
test('online utility skills are snapshot driven, expire and yield to gameplay',async()=>{
 const asset=await load('ain_anim'),weapon=await load('ain_scythe_tex'),scene=new T.Scene(),avatar=new Animated(asset,scene,true,false,weapon,'ain');
 try{for(const index of [1,3]){
  const r=new Raid('d01',[{id:'a',name:'A',character:'ain'}]),p=r.players.get('a');r.input('a',{type:'skill',index});
  assert.equal(p.action,null);assert.equal(p.gesture.clip,'skill'+(index+1));assert.equal(p.lock,0);
  const data=r.snapshot().players[0];for(let i=0;i<12;i++)avatar.update(data,1/60,.05);assert.equal(avatar.current.getClip().name,p.gesture.clip);assert.ok(avatar.rig.diagnostics.gripError<.003);
  avatar.update({...data,gesture:null},1/60,0);assert.notEqual(avatar.current.getClip().name,p.gesture.clip,'negative control: legacy snapshot misses utility animation');
  avatar.update({...data,hp:0},1/60,0);assert.equal(avatar.current.getClip().name,'death');
  for(let i=0;i<100;i++)r.tick(.01);assert.equal(p.gesture,null);
 }
 const r=new Raid('d01',[{id:'a',name:'A',character:'ain'}]),p=r.players.get('a');r.input('a',{type:'skill',index:3});r.input('a',{type:'attack'});r.tick(.01);assert.equal(p.gesture,null);assert.ok(p.action);
 }finally{avatar.dispose(scene);}
});
