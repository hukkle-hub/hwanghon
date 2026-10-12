/* 높이 안개 (문서 230 §6) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { installHeightFog, heightFogOd, HFOG } from '../js/mmo/height-fog.js';

const K = .01, H = 5;
test('낮을수록 짙고 높으면 맑다 — 건물 꼭대기 · 산등성이가 안개 위로 솟는다', () => {
  const at = y => heightFogOd(K, H, 0, 1.6, y, 80);   /* 눈높이에서 80 m 앞 */
  assert.ok(at(0) > at(10) && at(10) > at(40), `${at(0).toFixed(3)} > ${at(10).toFixed(3)} > ${at(40).toFixed(3)}`);
  assert.ok(1 - Math.exp(-at(0)) > .35, '땅은 80 m 에서 눈에 띄게 뿌옇다 ' + (1 - Math.exp(-at(0))).toFixed(2));
  assert.ok(1 - Math.exp(-at(60)) < .15, '60 m 높이 꼭대기는 맑다 ' + (1 - Math.exp(-at(60))).toFixed(2));
});
test('가까운 것(영웅 6 m)은 거의 안 가린다 · 거리에 비례 · 수평 광선도 이어진다', () => {
  assert.ok(1 - Math.exp(-heightFogOd(K, H, 0, 2.5, 1, 6)) < .06);
  assert.ok(Math.abs(heightFogOd(K, H, 0, 2, 2.005, 50) - heightFogOd(K, H, 0, 2, 2, 50)) < 1e-4, 'dy → 0 극한이 이어진다');
  assert.ok(Math.abs(heightFogOd(K, H, 0, 2, 0, 100) - 2 * heightFogOd(K, H, 0, 2, 0, 50)) < 1e-9);
});
test('three 안개 조각에 꽂힌다 · 한 번만 · 사용자 셰이더도 쓸 수 있게 mvPosition 으로', () => {
  const v0 = THREE.ShaderChunk.fog_vertex; installHeightFog(THREE, { k: K, h: H }); installHeightFog(THREE, { k: .5 });
  assert.equal(HFOG.k, K, '두 번째 부름은 무시'); const C = THREE.ShaderChunk;
  assert.match(C.fog_vertex, /vFogWY = dot\( viewMatrix\[ 1 \]\.xyz, mvPosition\.xyz \) \+ cameraPosition\.y;/); assert.doesNotMatch(C.fog_vertex, /transformed/, '연기 · 먼지 셰이더엔 transformed 가 없다');
  assert.equal((C.fog_fragment.match(/hfOd/g) || []).length, 2); assert.match(C.fog_pars_fragment, /#define HF_K 0\.01000/); assert.notEqual(C.fog_vertex, v0);
  /* 셰이더 식 = JS 식: 같은 글자가 들어 있다 */
  assert.match(C.fog_fragment, /hfKk \* vFogDepth \* \( abs\( hfDy \) > 0\.01 \? HF_H \* \( hfEc - hfEp \) \/ hfDy : hfEc \)/);
  assert.match(C.fog_fragment, /hfKk \*= clamp\( HF_N0 \/ max\( fogNear, 0\.5 \), 1\.0, 4\.0 \)/, '날씨 안개가 fogNear 로 깔린 안개를 짙게 (문서 230 §15)'); assert.match(C.fog_fragment, /#ifndef FOG_EXP2/, '지수 안개엔 fogNear 가 없다');
});
test('3D 필드만 · 지역별 짙기 · ?hf=0 으로 끈다 · 첫 그리기 전에', () => {
  const W = fs.readFileSync('world3d.html', 'utf8'), i = W.indexOf('installHeightFog(THREE, {'), r = W.indexOf('requestAnimationFrame(tick)');
  assert.match(W, /if \(CINE && q\.get\('hf'\) !== '0'\) installHeightFog\(THREE, \{ k: \+\(q\.get\('hfk'\) \|\| HF_ZONE\[ZONE\] \|\| \.012\)/);
  assert.ok(i > 0 && i < r, '재질이 컴파일되기 전');
  for (const f of ['js/game3d.js', 'mmo.html']) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /installHeightFog/, f + ' 은 그대로');
});
