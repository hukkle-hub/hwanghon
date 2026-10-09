/* 3D 필드 가방 · 상점 · 창고 (문서 213) — 2D 가방을 옮긴 js/mmo/field-bag-ui.js · 서버(server/field-bag.cjs)는 그대로 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const w = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8'), ui = fs.readFileSync(new URL('../js/mmo/field-bag-ui.js', import.meta.url), 'utf8'), srv = fs.readFileSync(new URL('../server/field-bag.cjs', import.meta.url), 'utf8');

test('가방이 보내는 명령은 서버에 다 있다 (buy · sell · equip · unequip · use · deposit · withdraw)', () => {
  const ops = [...new Set([...ui.matchAll(/[^.]add\('(\w+)', '/g)].map(m => m[1]))];
  assert.ok(ops.length >= 7, ops.join(','));
  for (const op of ops) assert.match(srv, new RegExp("op===?'" + op + "'|'" + op + "'"), '서버에 없는 가방 명령: ' + op);
});
test('3D 연결: 접속 전에 가방을 만든다(입장 답을 받게) · 서버 답을 가방이 먼저 본다 · 안전 지대는 서버와 같은 규칙(거점 주인 포함)', () => {
  assert.ok(w.indexOf('const BAG = createBagUI(') > 0 && w.indexOf('const BAG = createBagUI(') < w.indexOf('net = await connectField'), '가방이 접속보다 늦게 생긴다 — 입장 때 오는 답을 못 받는다');
  assert.match(w, /if \(m\.type !== 'field' && typeof BAG !== 'undefined' && BAG\.onMessage\(m\)\) return;/);
  assert.match(w, /TW_SAFE\.safeArea\(meta\.areas, root\.position\.x, root\.position\.z, hubOwner\)/);
  assert.match(w, /<script src="js\/mmo\/safe-zones\.js"><\/script>/);
  assert.match(ui, /b\.disabled = \(b\.dataset\.t === 'shop' \|\| b\.dataset\.t === 'vault'\) && !s;/, '안전 지대 밖에서도 상점·창고가 열린다');
});
