/* 필드 회피 끊기 (문서 229 §30) — 던전 combat.js 처럼 날이 지나간 직후부터 회피로 끊는다. 필드는 클립 끝까지 막아 카인 지면 강타(4.88 s)에서 4.9 초를 갇혔다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defCancelAt } from '../js/mmo/field-feel.js';

test('회피가 열리는 때: 마지막 접점 + 날 0.22 s + 0.06 s · 접점 없으면 40 % · 클립을 넘지 않는다', () => {
  assert.ok(Math.abs(defCancelAt(4.88, [0.475]) - (0.475 * 4.88 + 0.28)) < 1e-9, '카인 지면 강타 2.60 s');
  assert.ok(Math.abs(defCancelAt(3.44, [0.229, 0.554]) - (0.554 * 3.44 + 0.28)) < 1e-9, '두 접점이면 마지막 것');
  assert.equal(defCancelAt(1.85, null), 1.85 * 0.4); assert.equal(defCancelAt(0.5, []), 0.3, '짧아도 0.3 s 는 묶는다');
  assert.equal(defCancelAt(1.6, [0.95]), 1.6, '클립보다 늦지 않게');
});
test('world3d: 회피와 회피 기술은 날이 지나간 뒤 끊고 · 공격·일반 기술 연계는 그대로 클립 끝', () => {
  const W = fs.readFileSync('world3d.html', 'utf8');
  assert.match(W, /function dodge\(\) \{[^\n]*if \(\(busy > 0 && busyT < busyDef\) \|\| P\.dead/);
  assert.match(W, /function castSkill\(i\) \{[^\n]*\(busy > 0 && !\(d\.dodge && busyT >= busyDef\)\)/);
  assert.match(W, /function attack\(\) \{[^\n]*if \(busy > 0 \|\| P\.dead\) return;/, '공격 연계는 늦게(몬헌) — 끊지 않는다');
  assert.match(W, /busy = hero\.clips\[clip\]\.duration; busyT = 0; busyDef = defCancelAt\(busy, d\.ev && d\.ev\.hits && d\.ev\.hits\.map\(h => h\[0\]\)\);/);
  assert.match(W, /if \(busy > 0\) \{ busy -= dt; busyT \+= dt; \}/);
});
