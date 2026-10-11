/* 피해 숫자 · 무리 이름표 (문서 229 §48) — 같은 높이에서 떠 겹쳐 읽을 수 없었다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('숫자 층은 이름표 위 · 싸우는 무리 이름표는 흐리게 · 막 뜬 같은 종류는 지금 높이 위로 한 칸', () => {
  const w = fs.readFileSync('world3d.html', 'utf8'), F = fs.readFileSync('js/mmo/field-mobs.js', 'utf8');
  assert.match(w, /#dmgs\{ position:absolute; inset:0; z-index:3; pointer-events:none; \}/); assert.match(w, /\.tag\.mob\.fight\{ opacity:\.35; \}/);
  assert.match(F, /const fight = live\.some\(x => x\.hp < 100 \|\| x\.cur === 'attack' \|\| x\.cur === 'hit'\);[^\n]*v\.tag\.classList\?\.toggle\('fight', fight\)/);
  assert.match(w, /top = Math\.max\(top, f\.y \+ f\.t \* \.9\)/, '출발 높이가 아니라 지금 떠 있는 높이'); assert.match(w, /y: top > -Infinity \? Math\.max\(y, top \+ \.45\) : y/);
  const tick = /function floatTick[^\n]*v3\.set\(f\.x, f\.y \+ f\.t \* ([\d.]+), f\.z\)/.exec(w); assert.ok(tick && tick[1] === '.9', '떠오르는 속도가 쌓기 계산(.9)과 같아야 한다');
});
