/* 그림자 대리 (문서 229 §42) — 지역 전체 인스턴스(나무·바위)를 통째로 그림자 지도에 그리던 것 → 플레이어 64 m 안 것만 담은 사본이 그림자를 드리운다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { createShadowProxies } from '../js/mmo/shadow-proxy.js';
function field(n = 100, alpha = false) {
  const s = new THREE.Scene(), tex = new THREE.Texture(), m = new THREE.MeshStandardMaterial(alpha ? { map: tex, alphaTest: .5, side: THREE.DoubleSide } : {}), im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 2, 1), m, n), M = new THREE.Matrix4();
  for (let i = 0; i < n; i++) im.setMatrixAt(i, M.makeTranslation(i * 4, 1, 0)); im.castShadow = true; s.add(im); return { s, im };   /* 0, 4, 8 … 396 m 줄 */
}
test('반경 안 것만 그림자 사본에 · 원본은 그림자를 끈다 · 움직이면 다시 고른다', () => {
  const { s, im } = field(), S = createShadowProxies(THREE, s, null, { radius: 20 });
  const p = s.children.find(o => o.name === 'shadowProxy'); assert.ok(p); assert.equal(im.castShadow, false); assert.equal(p.castShadow, true);
  S.update({ x: 0, z: 0 }); assert.equal(p.count, 6, '0~20 m (+상자 반지름) — 0,4,…,20'); const v = new THREE.Matrix4(), t = new THREE.Vector3();
  p.getMatrixAt(5, v); t.setFromMatrixPosition(v); assert.equal(t.x, 20);
  S.update({ x: 1, z: 0 }); assert.equal(S.uploads, 1, '4 m 안 움직이면 다시 안 고른다');
  S.update({ x: 200, z: 0 }); assert.equal(p.count, 11, '180~220'); p.getMatrixAt(0, v); t.setFromMatrixPosition(v); assert.equal(t.x, 180);
  S.off(); assert.equal(im.castShadow, true); assert.ok(!s.children.includes(p));
});
test('화면엔 안 그린다(색·깊이 안 씀) · 잎 카드는 map·alphaTest 를 가져가 구멍대로 그림자 · 레이어는 그대로(r170 은 그림자 패스도 화면 카메라 레이어로 거른다)', () => {
  const { s } = field(30, true); createShadowProxies(THREE, s, null); const p = s.children.find(o => o.name === 'shadowProxy');
  assert.equal(p.material.colorWrite, false); assert.equal(p.material.depthWrite, false); assert.ok(p.material.map); assert.equal(p.material.alphaTest, .5); assert.equal(p.material.side, THREE.DoubleSide);
  assert.equal(p.layers.mask, 1, '레이어 1 로 숨기면 그림자까지 사라졌다');
  const few = field(10); createShadowProxies(THREE, few.s, null); assert.equal(few.im.castShadow, true, '적은 것(24 미만)은 그대로');
});
test('world3d: 지은 직후(안개 숨기기와 같이) 만들고 매 프레임 플레이어 자리로 · ?sp=0', () => {
  const w = fs.readFileSync('world3d.html', 'utf8'), at = w.indexOf('createShadowProxies(THREE, scene');
  assert.ok(at > w.indexOf('const MERGE = ') && at < w.indexOf('createCityLife(THREE, scene'), '움직이는 무리(까마귀)가 들어오기 전');
  assert.match(w, /q\.get\('sp'\) !== '0'/); assert.match(w, /if \(SPROX\) SPROX\.update\(root\.position\);/);
});
