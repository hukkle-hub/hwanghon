import test from 'node:test';
import assert from 'node:assert/strict';
import {CLAVE_WALK_CONTACTS,claveWalkContact} from '../js/mmo/boss-motion.js';

const CLIP=5/6, RATE=.82, LOOP=CLIP/RATE;

test('클레이브 발 접점은 벽시계가 아니라 실제 walk 액션 위상을 따른다',()=>{
 assert.deepEqual(CLAVE_WALK_CONTACTS,[.121,.638]);
 const expected=CLAVE_WALK_CONTACTS.map(p=>p*LOOP);
 for(const fps of [30,60,120]){
  let prev=null;const events=[];
  for(let t=0;t<LOOP+1/fps;t+=1/fps){const phase=(t/LOOP)%1,foot=claveWalkContact(prev,phase);if(foot>=0)events.push({foot,t});prev=phase;}
  assert.deepEqual(events.map(e=>e.foot),[0,1],fps+' fps에서도 왼발·오른발 한 번씩');
  for(let i=0;i<2;i++)assert.ok(Math.abs(events[i].t-expected[i])<=.025,fps+' fps 접점 오차 25ms 안');
 }
});

test('walk 루프 경계를 넘겨도 발 사건을 중복하거나 빠뜨리지 않는다',()=>{
 assert.equal(claveWalkContact(.99,.02),-1,'경계 자체에는 발 접점이 없다');
 assert.equal(claveWalkContact(.02,.13),0,'경계 뒤 왼발');
 assert.equal(claveWalkContact(.60,.65),1,'오른발');
 assert.equal(claveWalkContact(null,.12),0,'프레임 고정 검수도 실제 왼발 자세를 찾는다');
 assert.equal(claveWalkContact(null,.636),1,'프레임 고정 검수도 실제 오른발 자세를 찾는다');
});
