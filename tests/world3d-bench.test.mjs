/* 휴대폰 무게 재기 코스 (문서 220 §17) — ?bench=1: 장면마다 예열 뒤 프레임을 세고 한 줄 요약 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBench } from '../js/mmo/bench.js';
test('코스: 장면을 차례로 · 예열 시간은 세지 않는다 · 평균·최저·장면별 요약', () => {
  const seen = [], B = createBench([{ name: 'A' }, { name: 'B' }], { warm: 1000, hold: 3000, apply: v => seen.push(v.name) });
  let t = 0; B.tick(t);   /* 첫 장면 */
  for (; t <= 1000; t += 100) B.tick(t);   /* 예열: 초당 10 */
  for (; t <= 4100; t += 1000 / 30) B.tick(t);   /* 재기: 초당 30 */
  for (let k = 0; k < 400 && !B.done; k++) { t += 1000 / 15; B.tick(t); }   /* B: 초당 15 */
  assert.deepEqual(seen, ['A', 'B']); assert.ok(B.done);
  const [a, b] = B.results; assert.ok(Math.abs(a.fps - 30) < 1.5, 'A ' + a.fps); assert.ok(Math.abs(b.fps - 15) < 1.5, 'B ' + b.fps);
  assert.match(B.summary('기기'), /^평균 2\d fps · 가장 낮은 1초 1\d\nA 30 \(최저 \d+\) · B 15 \(최저 \d+\)\n기기$/);
});
test('world3d: ?bench=1 이면 코스 · 결과 카드(복사 · 다시) · 황혼 고정', () => {
  const W = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8');
  assert.match(W, /const BENCH = q\.get\('bench'\) === '1'/); assert.match(W, /BENCH\.tick\(performance\.now\(\)\)/); assert.match(W, /cp\.textContent = '복사'/);
  assert.match(W, /DAYC\.fixed = tOf\('dusk'\)/); assert.match(W, /#benchCard:not\(\[hidden\]\)/);
});

test('낮은 가로 화면(디렉터 폰 750×298): 스킬을 공격 왼쪽 두 줄로 — 위 끝이 바닥에서 182 px 아래 (미니맵과 안 겹침)', () => {
  const W = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8'), m = W.match(/@media \(orientation:landscape\) and \(max-height:360px\)\{([\s\S]*?)\n\}/); assert.ok(m, '낮은 가로 규칙');
  const tops = [...m[1].matchAll(/#(sk\d|pot|dodge|atk)\{[^}]*bottom:calc\(max\(14px,env\(safe-area-inset-bottom\)\) \+ (\d+)px\)/g)].map(x => [x[1], +x[2] + (x[1] === 'atk' ? 84 : 64) + 14]);
  assert.equal(tops.length, 7, '7 단추'); for (const [id, top] of tops) assert.ok(top <= 182, `${id} 위 끝 ${top}px — 298 화면에서 미니맵(아래 끝 ~106)에 닿는다`);
  assert.match(W, /body #osm\{ right:auto; left:12px;/, '출처 규칙이 뒤의 #osm 에 덮이지 않게');
});
