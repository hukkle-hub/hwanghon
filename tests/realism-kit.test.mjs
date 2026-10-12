/* 사실감 (문서 230 §7~§10) — 잎 카드 나무 · 바위 · 건물 낡음 · 사진 텍스처 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { leafCrownGeo, pineCardGeo } from '../js/mmo/tree-kit.js';
import { rockGeo } from '../js/mmo/rock-kit.js';
import { PH_NAMES } from '../js/mmo/ph-tex.js';

test('잎 카드 갓 36 장 · 소나무 38 장 — 옛 다면체와 삼각형이 비슷하다', () => {
  const a = leafCrownGeo(THREE), b = pineCardGeo(THREE);
  assert.equal(a.index.count / 6, 36); assert.equal(b.index.count / 6, 38);
  assert.ok(a.index.count / 3 <= 80 && b.index.count / 3 <= 80, '옛 갓 80 삼각형 안');
  const b0 = b.boundingBox; assert.ok(b0.max.y - b0.min.y > 3.5 && b0.max.x - b0.min.x < 4.2, '소나무는 키가 크고 폭이 좁은 원뿔 — 접시가 아니다');
});
test('바위: 꼭짓점을 나눠 써서 부드러운 노멀 · 바닥이 눌려 앉음 · 같은 씨앗은 같은 모양', () => {
  const g = rockGeo(THREE, 11), P = g.attributes.position; assert.ok(g.index && P.count < g.index.count / 3, '면마다 따로인 꼭짓점이면 평평한 음영(보석)');
  let minY = 9; for (let i = 0; i < P.count; i++) minY = Math.min(minY, P.getY(i)); assert.ok(minY > -.4, '밑동이 바닥에 앉는다 ' + minY.toFixed(2));
  assert.deepEqual(Array.from(rockGeo(THREE, 11).attributes.position.array.slice(0, 30)), Array.from(P.array.slice(0, 30)));
  assert.equal(g.index.count / 3, 180, '휴대폰 예산 — 바위 한 개 180 삼각형');
});
test('바위 셰이더: 사진(세 방향 투영 + 노멀) · 이끼 · 흙 · 금 · 전처리 줄이 깨지지 않는다', () => {
  const src = fs.readFileSync('js/mmo/rock-kit.js', 'utf8');
  assert.match(src, /phTex\(THREE, 'rock_boulder_dry', 'diff'\)/); assert.match(src, /#include <normal_fragment_maps>/); assert.match(src, /customProgramCacheKey = \(\) => 'rock-' \+ moss\.toFixed\(2\) \+ \(PD \? '-ph' : ''\)/);
  for (const line of src.split('\n')) if (/^#(endif|else)/.test(line)) assert.match(line, /^#(endif|else)\s*(`\);)?$/, '전처리 줄 뒤에 코드가 붙으면 셰이더가 안 만들어진다: ' + line.slice(0, 40));
});
test('사진 텍스처: CC0 출처 · 512 px · 휴대폰에 가볍게', () => {
  const R = fs.readFileSync('art/tex/ph/README.txt', 'utf8'); assert.match(R, /CC0/);
  let total = 0; for (const n of PH_NAMES) { assert.match(R, new RegExp(n)); for (const m of ['diff', 'nor_gl', 'rough']) { const f = `art/tex/ph/${n}_${m}.jpg`; assert.ok(fs.existsSync(f), f); const sz = fs.statSync(f).size; total += sz; assert.ok(sz < 160000, f + ' ' + sz); } }
  assert.ok(total < 700000, '합 ' + total);
});
test('건물 낡음: 빗물 자국 · 밑동 흙 · 이끼 · 깨진 창 위 그을음 — NO_WEATHER 로 끄면 다른 프로그램', () => {
  const F = fs.readFileSync('js/mmo/facade-shader.js', 'utf8');
  assert.match(F, /#ifndef NO_WEATHER/); assert.match(F, /float drip = /); assert.match(F, /float soot = step\(0\.9, fh1\(bid \+ 11\.0\)\)/);
  assert.match(F, /\+ \(m\.defines && 'NO_WEATHER' in m\.defines \? '-nw' : ''\)/, '끈 재질이 켠 재질 프로그램을 같이 쓰면 안 된다');
  assert.match(F, /phTex\(THREE, 'concrete_wall_006', 'diff'/);
});
test('3D 만 · ?tc=0 이면 옛 나무 · 바위 · 벽', () => {
  const W = fs.readFileSync('world3d.html', 'utf8'); assert.match(W, /TREE_CARDS\.on = FACADE_PHOTO\.on = q\.get\('tc'\) !== '0';/);
  const E = fs.readFileSync('js/mmo/env-lib.js', 'utf8'); assert.match(E, /const CARDS = VIEW3D && o\.cards !== false && TREE_CARDS\.on/); assert.match(E, /const RK = VIEW3D && TREE_CARDS\.on/);
  assert.match(fs.readFileSync('js/mmo/env-namsan.js', 'utf8'), /const CARDS = L\.isView3d\(\) && L\.TREE_CARDS\.on/, '남산은 나무를 따로 만든다 — 같이 바꿔야(처음엔 빠져 남산이 그대로였다)');
});
