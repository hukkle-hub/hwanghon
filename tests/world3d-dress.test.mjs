/* 3D 필드 장비 겉모습 (문서 214) — TW_LOOKS 로 갑옷만(noMain) · 코트 밑 몸 숨김이 쥔 손 모프(상대값)를 지킨다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const w = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8'), L = fs.readFileSync(new URL('../js/looks.js', import.meta.url), 'utf8');

test('코트 밑 몸 숨김(hideUnder)이 새 지오메트리에 morphTargetsRelative 를 옮긴다 — 빠지면 몸이 원점으로 끌려가 사라진다', () => {
  const body = L.slice(L.indexOf('function hideUnder'), L.indexOf('function restoreBodies'));
  assert.match(body, /g\.morphAttributes=g0\.morphAttributes;\s*g\.morphTargetsRelative=g0\.morphTargetsRelative;/);
});
test('noMain: 무기를 이미 쥔 아바타엔 기본 낫을 또 달지 않는다', () => {
  assert.match(L, /if\(opts\.noMain\)\{\}/); assert.match(L, /if\(!opts\.noMain&&DUAL\[mainBase\]/);
  assert.match(w, /TW_LOOKS\.attach\(THREE, loader, root, eq, \{ charId: ME, noMain: true/);
});
test('3D 연결: 입장·profile 마다 다시 입되 같은 옷은 다시 만들지 않는다 · main 은 빼고', () => {
  assert.match(w, /dressMe\(net\.profile\);/); assert.match(w, /if \(m\.type === 'profile' && m\.profile\) dressMe\(m\.profile\);/);
  assert.match(w, /if \(key === dressKey\) return;/); assert.match(w, /delete eq\.main;/);
});
