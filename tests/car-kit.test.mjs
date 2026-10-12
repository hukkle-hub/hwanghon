/* 버려진 차 (문서 230 §4) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { buildCar, CAR_TYPES } from '../js/mmo/car-kit.js';

const rng = s => { let x = s >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };
const tris = g => { let t = 0; g.traverse(m => { if (m.isMesh) { const gg = m.geometry; t += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } }); return t; };
const many = (type, n = 300, opt) => Array.from({ length: n }, (_, i) => buildCar(THREE, type, rng(i * 7919 + 1), opt));

test('종류마다 만들어지고 삼각형 예산 안', () => {
  for (const t of Object.keys(CAR_TYPES)) { const cars = many(t, 40); const worst = Math.max(...cars.map(tris)); assert.ok(worst <= (t === 'bus' ? 500 : 900), `${t} 최악 ${worst} 삼각형`); }
});
test('바퀴가 땅에 닿는다(멀쩡한 차) · 바퀴집 안에 있다', () => {
  for (const t of ['sedan', 'suv', 'mini']) { const c = many(t, 200).find(g => !g.userData.car.burned && !g.userData.car.flat); const T = CAR_TYPES[t];
    const tires = c.children.filter(m => m.geometry.type === 'CylinderGeometry' && m.geometry.parameters.radiusTop === T.wr), b = new THREE.Box3(); for (const m of tires) b.expandByObject(m);
    assert.equal(tires.length, 4, t); assert.ok(Math.abs(b.min.y) < .01, `${t} 바퀴 바닥 ${b.min.y.toFixed(3)}`);
    const body = new THREE.Box3().setFromObject(c.children[0]); assert.ok(body.min.y > .2, `${t} 몸 바닥이 바퀴 중심보다 위 — 바퀴가 몸에 파묻히지 않는다 (${body.min.y.toFixed(2)})`);
    for (const m of tires) { m.geometry.computeBoundingBox(); const cx = (m.geometry.boundingBox.min.x + m.geometry.boundingBox.max.x) / 2; assert.ok(Math.abs(Math.abs(cx) - T.wx) < .01, '바퀴가 바퀴집 자리'); } }
});
test('탄 차는 유리 · 타이어가 없고 주저앉는다 · 펑크는 한쪽으로 기운다', () => {
  const cars = many('sedan', 400), burned = cars.filter(g => g.userData.car.burned), flat = cars.filter(g => g.userData.car.flat);
  assert.ok(burned.length > 5 && burned.length < 60, '탄 차 비율 ' + burned.length); assert.ok(flat.length > 20, '펑크 ' + flat.length);
  for (const g of burned) { assert.ok(!g.children.some(m => m.geometry.type === 'CylinderGeometry' && m.geometry.parameters.radiusTop === CAR_TYPES.sedan.wr), '타이어 없음'); assert.ok(!g.children.some(m => m.material.metalness === .55 && m.material.roughness === .1), '유리 없음'); assert.ok(g.position.y < 0); }
  for (const g of flat) assert.ok(Math.abs(g.rotation.x) > .03 && g.position.y < 0);
});
test('재질을 차끼리 나눠 쓴다 — 합치기(mergeStatic)가 색별로 묶을 수 있게', () => {
  const mats = new Set(); for (const t of Object.keys(CAR_TYPES)) for (const g of many(t, 100)) g.traverse(m => { if (m.isMesh) mats.add(m.material); });
  for (const g of many('sedan', 100, { wreck: true })) g.traverse(m => { if (m.isMesh) mats.add(m.material); });
  assert.ok(mats.size <= 4, '재질 ' + mats.size + ' 개 (차 1,700 대) — 칠 2 · 유리 · 부품');
});
test('3D 에서만 · 모양 난수는 자리에서 — 장면 난수 R 을 더 쓰지 않는다', () => {
  const E = fs.readFileSync('js/mmo/env-lib.js', 'utf8'), O = fs.readFileSync('js/mmo/env-osm.js', 'utf8');
  assert.match(E, /buildCar\(THREE, type, LR, \{ wreck: wr \}\)/); assert.match(O, /buildCar\(THREE, type, LR\)/);
  assert.match(O, /if \(k === 'busway' && CAR3D\) \{ R\(\); kit\('bus'\);/, '버스: 옛 색 고르기 R() 하나를 그대로 쓴다');
  for (const src of [E, O]) assert.match(src, /const LR = \(\) => \(\(sd = \(sd \* 1664525 \+ 1013904223\) >>> 0\) \/ 4294967296\);/);
});
