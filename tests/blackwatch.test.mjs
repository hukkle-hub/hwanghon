import test from 'node:test';
import assert from 'node:assert/strict';
import { bwEmpty } from '../js/blackwatch.js';

/* 허수아비 던전에서 실제로 읽은 값 (915×412, 어깨 너머 카메라, explore 중).
   scratchpad/bwprobe.mjs 로 24초를 1초마다 재서 얻었다 — docs/design/52-restart-bug.md */
const REAL_DUMMY = [
  [[22,58],[32,65],[21,62],[16,212]],
  [[25,58],[32,65],[22,63],[16,27]],
  [[28,58],[32,65],[21,62],[16,63]],
  [[25,59],[32,65],[21,62],[16,153]],
  [[26,59],[32,66],[20,62],[16,102]],
];

test('허수아비를 도는 동안에는 «빈 프레임» 으로 보지 않는다', () => {
  for (const s of REAL_DUMMY) assert.equal(bwEmpty(s), false, JSON.stringify(s));
});

test('어두운 벽 하나가 네 곳을 다 채워도 색이 서로 다르면 빈 프레임이 아니다', () => {
  /* 패치마다 고르지만 서로 다른 밝기 — 벽·바닥·천장이 각자 그려진 상태 */
  assert.equal(bwEmpty([[18,19],[24,25],[31,32],[12,13]]), false);
});

test('아무것도 안 그려지면 잡는다 — 완전히 검은 화면', () => {
  assert.equal(bwEmpty([[0,0],[0,0],[0,0],[0,0]]), true);
});

test('배경색만 남은 화면도 잡는다 (검지 않아도)', () => {
  /* scene.background 0x10161a 만 남은 상태 — 가중 휘도 약 20.6 */
  assert.equal(bwEmpty([[20,21],[20,21],[20,21],[20,21]]), true);
  /* 밝은 회색 한 색도 마찬가지 */
  assert.equal(bwEmpty([[180,181],[180,181],[180,181],[180,181]]), true);
});

test('한 곳이라도 무늬가 있으면 빈 프레임이 아니다', () => {
  assert.equal(bwEmpty([[0,0],[0,0],[0,0],[0,40]]), false);
});

test('표본이 모자라면 판단하지 않는다', () => {
  assert.equal(bwEmpty([]), false);
  assert.equal(bwEmpty([[0,0]]), false);
});
