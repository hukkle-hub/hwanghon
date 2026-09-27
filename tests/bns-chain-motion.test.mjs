import test from 'node:test';
import assert from 'node:assert/strict';
import {AIN_BNS_CHAIN,transitionFor,CINEMA_STYLE} from '../js/character-cinema.js';

test('아인 2타는 1·3타보다 준비 비율이 작다',()=>{
  assert.ok(AIN_BNS_CHAIN.attack2.prep<AIN_BNS_CHAIN.attack1.prep);
  assert.ok(AIN_BNS_CHAIN.attack2.prep<AIN_BNS_CHAIN.attack3.prep);
});

test('아인 3타는 기본 3타 중 body drive와 follow가 가장 크다',()=>{
  assert.ok(AIN_BNS_CHAIN.attack3.drive>AIN_BNS_CHAIN.attack2.drive);
  assert.ok(CINEMA_STYLE.ain.attack.attack3.follow>CINEMA_STYLE.ain.attack.attack2.follow);
  assert.ok(CINEMA_STYLE.ain.attack.attack3.snap>CINEMA_STYLE.ain.attack.attack2.snap);
});

test('2타는 반대 방향, 3타는 다시 원방향으로 연결',()=>{
  assert.equal(AIN_BNS_CHAIN.attack1.side,1);
  assert.equal(AIN_BNS_CHAIN.attack2.side,-1);
  assert.equal(AIN_BNS_CHAIN.attack3.side,1);
});

test('아인 기본 공격 visual blend는 50ms, finisher는 85ms',()=>{
  assert.equal(transitionFor('ain','attack1').in,.050);
  assert.equal(transitionFor('ain','attack3').in,.050);
  assert.equal(transitionFor('ain','smash').in,.085);
});

test('presentation 계층만 바꾸고 combat timing 상수는 이 모듈에 없다',()=>{
  assert.equal('hitAt' in AIN_BNS_CHAIN.attack1,false);
  assert.equal('duration' in AIN_BNS_CHAIN.attack1,false);
});
