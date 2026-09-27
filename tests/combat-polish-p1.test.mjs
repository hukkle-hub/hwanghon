import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const cc=await readFile(new URL('../js/character-cinema.js',import.meta.url),'utf8');
const game=await readFile(new URL('../js/game3d.js',import.meta.url),'utf8');

test('아인 1·2·3타 전신 연기 위계: 2타는 작은 감기, 3타는 가장 큰 snap/follow',()=>{
  assert.match(cc,/attack1:\{coil:\.110,snap:\.110,follow:\.140,drop:\.034\}/);   /* P8 값 */
  assert.match(cc,/attack2:\{coil:\.035,snap:\.135,follow:\.160,drop:\.028\}/);
  assert.match(cc,/attack3:\{coil:\.100,snap:\.170,follow:\.215,drop:\.050\}/);
});

test('전신 연기 레이어가 고정 46%가 아니라 실제 hitAt에 동기화',()=>{
  assert.match(cc,/Number\.isFinite\(a\.hitAt\)\?a\.hitAt\/dur/);
  assert.ok(!cc.includes("u<.46?smooth"));
  assert.match(cc,/Math\.exp\(-Math\.pow\(\(u-contact\)\/iw,2\)\)/);
});

test('공격은 골반 선행 + 접점 전후 상체 구동, 발은 기존 replant 유지',()=>{
  assert.match(cc,/ry\('Hips',-side\*cfg\.coil\*pre\*\.42/);
  assert.match(cc,/rx\('Hips',cfg\.snap\*strike\*\.12\*drive\)/);   /* P8 drive */
  assert.match(cc,/replant\(\);/);
});

test('1.2~2.1m 근접 락온에서 카메라가 물러나고 위·옆으로 분리',()=>{
  assert.match(game,/nearK=battle&&locked\?Math\.max\(0,Math\.min\(1,\(2\.1-gap\)\/0\.9\)\):0/);
  assert.match(game,/pitchWant\+=0\.055\*nearK/);
  assert.match(game,/fd\+=nearK\*\(MOBILE\?0\.45:0\.58\)/);
  assert.match(game,/sOff\+=0\.30\*nearK/);
  assert.match(game,/lOff-=0\.08\*nearK/);
});

test('근접 자동 회전 정지 반경을 1.6m로 넓혀 관통 뒤 급회전을 줄인다',()=>{
  assert.match(game,/fight:\{ dist:2\.6, shoulder:1\.7, lookSide:-0\.1, near:1\.6/);
});
