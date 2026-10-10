/* 가짜 실내 창 (문서 229) — 셰이더 끼워 넣기가 모두 맞물리는지. three 의 청크 이름이 바뀌면 replace 가 조용히 실패해 창이 사라진다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { patchFacadeMaterial, FACADE_U } from '../js/mmo/facade-shader.js';

test('가짜 실내 창: 표준 재질 셰이더의 다섯 자리에 다 들어간다', () => {
  const m = patchFacadeMaterial(THREE, new THREE.MeshStandardMaterial()), L = THREE.ShaderLib.standard;
  const sh = { uniforms: THREE.UniformsUtils.clone(L.uniforms), vertexShader: L.vertexShader, fragmentShader: L.fragmentShader };
  m.onBeforeCompile(sh);
  assert.match(sh.vertexShader, /vFW = \(modelMatrix \* vec4\(transformed, 1\.0\)\)\.xyz/, '꼭짓점: 세계 좌표');
  for (const [k, re] of [['칸 셈', /vec2 cell = vec2\(s \/ 1\.8, y \/ 3\.6\)/], ['거칠기', /roughnessFactor = mix\(roughnessFactor, 0\.18, fGlass\)/], ['금속', /metalnessFactor = mix\(metalnessFactor, 0\.0, fGlass\)/], ['스스로 빛', /totalEmissiveRadiance \+= fEmit/], ['유니폼 선언', /uniform float uLampK/]])
    assert.match(sh.fragmentShader, re, k);
  assert.ok(sh.uniforms.uLampK === FACADE_U.uLampK, '시간대 유니폼은 공용 — world3d 가 밤낮으로 바꾼다');
  assert.equal(m.customProgramCacheKey(), 'facade-im');
});
test('가짜 실내 창: 3D 에서만 — 2D 굽기(mmo.html·bake-map) 는 그린 창 그대로', () => {
  const src = fs.readFileSync('js/mmo/env-osm.js', 'utf8');
  assert.match(src, /if \(L\.isView3d\(\) && CFG\.interior !== false\) facadeMats = /);
  assert.match(fs.readFileSync('world3d.html', 'utf8'), /interior: q\.get\('im'\) !== '0'/);
  assert.match(fs.readFileSync('world3d.html', 'utf8'), /FACADE_U\.uLampK\.value = o\.lampK/);
});
