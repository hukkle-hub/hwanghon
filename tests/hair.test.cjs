/* 머리 장비 = 머리카락 가림 (docs/design/45).
   디렉터 결정: 「후드는 다 가려야지」 — 앞머리를 남기지 않고 통째로 숨긴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

require(path.join(ROOT, 'js/hair.js'));
const H = globalThis.TW_HAIR;

function mesh(name, matName) {
  return {isMesh: true, name: name, visible: true, material: matName == null ? null : {name: matName}};
}
function root(children) {
  return {traverse(fn) { fn(this); children.forEach(fn); }, children};
}

test('머리카락 조각을 재질 이름으로 알아본다 — VRoid 는 `..._HAIR`', () => {
  assert.ok(H.isHair(mesh('Body', 'F00_000_HairBack_00_HAIR')));
  assert.ok(H.isHair(mesh('x', 'ain_hair')));
  assert.ok(!H.isHair(mesh('Body', 'F00_001_01_Body_00_SKIN')));
  assert.ok(!H.isHair(mesh('Body', 'pbr_material')));
});

test('노드 이름으로도 알아본다 — 앞으로 받을 파일용', () => {
  assert.ok(H.isHair(mesh('hair', null)));
  assert.ok(H.isHair(mesh('hair_01', null)));
  assert.ok(H.isHair(mesh('ain_hair', null)));
  assert.ok(!H.isHair(mesh('hairline_decal', null)), '「hair」로 시작만 해서는 안 된다 — 경계가 있어야 한다');
  assert.ok(!H.isHair(mesh('chair', null)), 'chair 를 머리카락으로 보면 안 된다');
  assert.ok(!H.isHair({isMesh: false, name: 'hair'}), '메시가 아니면 아니다');
});

test('머리 칸에 뭐라도 끼면 숨긴다', () => {
  const hair = mesh('Hair', 'x_HAIR'), skin = mesh('Body', 'x_SKIN');
  const r = root([hair, skin]);
  H.sync(r, {head: 'a_hood'});
  assert.equal(hair.visible, false, '후드를 썼는데 머리카락이 보인다');
  assert.equal(skin.visible, true, '살까지 숨기면 안 된다');
  H.forget(r);
  H.sync(r, {head: null});
  assert.equal(hair.visible, true, '벗었는데 머리카락이 안 돌아온다');
});

test('머리 말고 다른 칸은 머리카락을 건드리지 않는다', () => {
  const hair = mesh('Hair', 'x_HAIR');
  const r = root([hair]);
  H.sync(r, {chest: 'a_reed_cuirass', main: 'w_hook_scythe'});
  assert.equal(hair.visible, true, '가슴 갑옷을 입었다고 대머리가 되면 안 된다');
});

test('머리카락이 몸에 붙어 있는 모델은 조용히 넘어간다 — 지금 아인이 그렇다', () => {
  const fused = mesh('Ain_Mesh', 'pbr_material');
  const r = root([fused]);
  const found = H.sync(r, {head: 'a_hood'});
  assert.equal(found, 0, '못 찾았는데 찾았다고 한다');
  assert.equal(fused.visible, true, '못 숨기는 모델을 통째로 숨겨 버렸다');
});

test('네 화면 모두에 규칙이 걸려 있다', () => {
  for (const f of ['viewer.html', 'js/lobby3d.js', 'js/portrait3d.js', 'js/game3d.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(s, /TW_HAIR\.sync\(/, `${f}: 머리카락 규칙이 안 걸렸다`);
  }
});

test('규칙을 쓰는 화면은 js/hair.js 를 불러온다', () => {
  for (const f of ['viewer.html', 'index.html', 'inventory.html', 'party.html',
                   'profile.html', 'recruit.html', 'result.html', 'game3d.html']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(s, /js\/hair\.js/, `${f}: hair.js 를 안 불러온다`);
  }
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /js\/hair\.js/,
    '서비스 워커에 없으면 비행기 모드에서 규칙이 빠진다');
});
