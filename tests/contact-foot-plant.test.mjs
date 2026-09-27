import test from 'node:test';
import assert from 'node:assert/strict';
import {contactPlantWeight} from '../js/character-cinema.js';
import {readFile} from 'node:fs/promises';

test('지지발 가중치는 접점에서 1이고 창 밖에서는 0',()=>{
  const hit=.24;
  assert.equal(contactPlantWeight(0,hit,.09,.08),0);
  assert.equal(contactPlantWeight(hit-.091,hit,.09,.08),0);
  assert.equal(contactPlantWeight(hit,hit,.09,.08),1);
  assert.equal(contactPlantWeight(hit+.081,hit,.09,.08),0);
});

test('접점 전후 가중치는 스무스하게 증가/감소',()=>{
  const hit=.40,pre=.14,post=.045;
  const a=contactPlantWeight(hit-pre*.75,hit,pre,post);
  const b=contactPlantWeight(hit-pre*.25,hit,pre,post);
  const c=contactPlantWeight(hit+post*.25,hit,pre,post);
  const d=contactPlantWeight(hit+post*.75,hit,pre,post);
  assert.ok(a<b&&b<1);
  assert.ok(c>d&&c<1);
});

test('게임 레이어는 아인 기본3타/스매시에서 덜 움직이는 한쪽 발만 잠근다',async()=>{
  const s=await readFile(new URL('../js/character-cinema.js',import.meta.url),'utf8');
  assert.match(s,/\/\^\(attack1\|attack2\|attack3\|smash\)\$\//);
  assert.match(s,/feet0\.L\.distanceTo\(plant\.prevL\)/);
  assert.match(s,/feet0\.R\.distanceTo\(plant\.prevR\)/);
  assert.match(s,/plant\.side=dL<=dR\?'L':'R'/);
  assert.ok(!s.includes("plant.side='both'"));
});

test('지지발 잠금은 root 이동이 아니라 다리 IK만 사용',async()=>{
  const s=await readFile(new URL('../js/character-cinema.js',import.meta.url),'utf8');
  const i=s.indexOf('function contactPlant(action,clip)');
  const block=s.slice(i,i+2200);
  assert.match(block,/solveLimb\(up,lo,ft,target,.86\)/);
  assert.ok(!block.includes('root.position'));
});
