/* 외형 화면의 「속옷 차림」 배선 — 단추 · 주소 · 뷰어 분기 · 서비스 워커 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('외형 화면에 「속옷 차림」 단추가 있다', () => {
  const h = read('looks.html');
  assert.match(h, /id="lk-bare"/, '단추가 없다');
  assert.match(h, /aria-pressed/, '눌림 상태를 읽어 줄 수 없다');
});

test('단추를 누르면 주소에 body=1 이 붙는다', () => {
  const js = read('js/looks-screen.js');
  assert.match(js, /bare\s*=\s*false/, '상태 변수가 없다');
  assert.match(js, /bare\?'&body=1':''/, 'iframe 주소에 body=1 이 안 붙는다');
  assert.match(js, /\$\('lk-bare'\)\.addEventListener/, '단추에 동작이 안 걸렸다');
  assert.match(js, /loadFrame\(\)/, '눌러도 모델을 다시 안 받는다');
});

test('뷰어가 body=1 을 알아듣고 맨몸 모델을 받는다', () => {
  const v = read('viewer.html');
  assert.match(v, /BARE\s*=\s*q\.get\('body'\)==='1'/, 'body 매개변수를 안 읽는다');
  assert.match(v, /BARE\?'_body':'_anim'/, '맨몸 글턴으로 안 바꾼다');
  assert.match(v, /function applyEquip\(\)\{ if\(BARE\) return;/,
    '맨몸인데 장비를 덧입히면 몸 위에 갑옷이 뜬다');
});

test('네 몸이 서비스 워커에 등록돼 있다 — 비행기 모드에서도 보여야 한다', () => {
  const sw = read('sw.js');
  for (const c of ['ain', 'kain', 'ryu', 'sera'])
    assert.ok(sw.includes(`art/3d/${c}_body.glb`), `${c}_body.glb 가 ASSETS 에 없다`);
});

test('장비 목록·저장값은 건드리지 않는다 — 보기만 바꾸는 기능이다', () => {
  const js = read('js/looks-screen.js');
  const block = js.slice(js.indexOf("$('lk-bare')"), js.indexOf("$('lk-bare')") + 600);
  assert.ok(!/unequip|setDye|clearDye|equip\(/.test(block),
    '속옷 보기가 장비를 실제로 벗기고 있다');
});
