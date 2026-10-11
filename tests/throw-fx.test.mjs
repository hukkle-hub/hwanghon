/* 세라 투척 (문서 229 §33) — 날아가는 병이 어디에도 없었다. 판정은 그대로, 병이 접점 시각에 닿고 터진다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { throwPlan, arcAt, createThrowFx, THROW, THROW_KIND } from '../js/mmo/throw-fx.js';

test('병은 접점에 닿는다: 손을 떠나는 때 + 비행 = 접점 · 너무 이르면 비행을 줄인다', () => {
  for (const tc of [0.386, 0.6, 1.2]) { const p = throwPlan(tc); assert.ok(Math.abs(p.launch + p.flight - tc) < 1e-9, '접점 ' + tc); assert.ok(Math.abs(p.flight - THROW.FLIGHT) < 1e-9); }
  const e = throwPlan(0.186); assert.equal(e.launch, 0.05); assert.ok(Math.abs(e.flight - 0.136) < 1e-9, '연쇄 폭발은 접점이 일러 짧게');
});
test('포물선: 처음·끝은 두 점 · 가운데가 가장 높다', () => {
  const a = [0, 1.4, 0], b = [2, 0.9, 0]; assert.deepEqual(arcAt(a, b, 0), a); assert.deepEqual(arcAt(a, b, 1), b); assert.ok(Math.abs(arcAt(a, b, .5)[1] - ((a[1] + b[1]) / 2 + THROW.ARC)) < 1e-9, "가운데 = 평균 높이 + ARC"); assert.ok(arcAt(a, b, .5)[1] > Math.max(a[1], b[1]));
});
test('돌려 보기: 병 → 닿으면 터짐(연쇄는 두 번) → 사라짐', () => {
  const scene = new THREE.Scene(), F = createThrowFx(THREE, scene); let called = 0;
  F.throw(() => { called++; return [0, 1.4, 0]; }, [2, .9, 0], 0.386, 'chain');
  let bursts = 0, maxLive = 0; for (let t = 0; t < 2; t += 1 / 60) { F.tick(1 / 60); maxLive = Math.max(maxLive, F.live.length); bursts = Math.max(bursts, F.live.length); }
  assert.equal(called, 1, '손 위치는 떠날 때 한 번'); assert.equal(maxLive, THROW_KIND.chain.bursts, '연쇄 폭발은 두 번'); assert.equal(F.live.length, 0); assert.equal(F.jobs.length, 0); assert.equal(scene.children.length, 0, '다 치운다');
});
test('world3d: 세라 1·3번에만 · 판정은 그대로(접점 시각) · 매 프레임 돌린다', () => {
  const W = fs.readFileSync('world3d.html', 'utf8');
  assert.match(W, /if \(ME === 'sera' && \(i === 0 \|\| i === 2\)\) throwAt\(clip, i === 0 \? 'acid' : 'chain'\);/);
  assert.match(W, /tc = contactOf\(ME, clip\) \* hero\.clips\[clip\]\.duration;/); assert.match(W, /THROWFX\.tick\(dt\);/);
});
