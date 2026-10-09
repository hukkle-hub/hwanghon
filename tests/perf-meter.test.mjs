/* 휴대폰 무게 표시 (문서 211) — 호출·삼각형은 «한 프레임 전체 합». 화면 합성 뒤 마지막 패스만 읽던 옛 표시는 호출 1 · 삼각형 0k 였다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPerfMeter } from '../js/mmo/perf-meter.js';

test('한 프레임에 여러 번 그려도(그림자·장면·합성) 합을 센다 · 30초마다 요약', () => {
  const info = { autoReset: true, render: { calls: 0, triangles: 0 }, reset() { this.render.calls = 0; this.render.triangles = 0; } };
  const renderer = { info, getPixelRatio: () => 2 }, el = { textContent: '' }, draw = (c, t) => { if (info.autoReset) info.reset(); info.render.calls += c; info.render.triangles += t; };
  let now = 0; const real = performance.now; performance.now = () => now;
  try { const m = createPerfMeter({ renderer, el });
    assert.equal(info.autoReset, false, '자동 비우기를 안 껐다 — 마지막 패스만 남는다');
    for (let s = 0; s < 31; s++) for (let f = 0; f < 30; f++) { m.begin(); draw(200, 400000); draw(80, 70000); draw(1, 2); now += 1000 / 30; m.end(); }
    assert.equal(m.stats.calls, 281); assert.equal(m.stats.tris, 470002); assert.ok(Math.abs(m.stats.fps - 30) < 1, m.stats.fps);
    assert.match(el.textContent, /콜 281 · 삼각형 470k/); assert.match(m.stats.summary, /30초 평균 30 · 가장 낮은 1초 3\d/);
  } finally { performance.now = real; }
});

test('두 화면 연결: ?debug=1 표시 · 틱 처음 begin · 그린 뒤 end', () => {
  for (const f of ['mmo.html', 'world3d.html']) { const s = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    assert.match(s, /createPerfMeter\(\{ renderer/, f); assert.match(s, /function tick\(\)\s*\{ perf\.begin\(\);/, f + ' 틱 처음에 비우지 않는다'); assert.match(s, /perf\.end\(\)/, f); }
});
