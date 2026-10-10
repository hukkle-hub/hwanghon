/* 젖은 길 웅덩이 (문서 229 §10) — 셰이더 끼워 넣기가 맞물리는지 · world3d 의 땅 결 패치가 덮어쓰지 않고 잇는지 (처음엔 덮어써서 웅덩이가 하나도 없었다) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { patchPuddleMaterial, PUDDLE } from '../js/mmo/puddle-shader.js';
import { FACADE_U } from '../js/mmo/facade-shader.js';

const compile = m => { const L = THREE.ShaderLib.standard, sh = { uniforms: THREE.UniformsUtils.clone(L.uniforms), vertexShader: L.vertexShader, fragmentShader: L.fragmentShader }; m.onBeforeCompile(sh); return sh; };
test('웅덩이: 표준 재질 셰이더의 다섯 자리에 다 들어간다', () => {
  const m = patchPuddleMaterial(THREE, new THREE.MeshStandardMaterial()), sh = compile(m);
  assert.match(sh.vertexShader, /vPW = \(modelMatrix \* vec4\(transformed, 1\.0\)\)\.xyz/, '꼭짓점: 세계 좌표');
  for (const [k, re] of [['웅덩이 자리', /float pw = 1\.0 - smoothstep/], ['젖은 색', /diffuseColor\.rgb \*= mix\(1\.0, 0\.7, wet\)/], ['거칠기', /roughnessFactor = mix\(roughnessFactor, 0\.05, pw\)/], ['금속', /metalnessFactor = mix\(metalnessFactor, 0\.0, pw\)/], ['하늘 반사', /totalEmissiveRadiance \+= uSkyRefl \* pw/]])
    assert.match(sh.fragmentShader, re, k);
  assert.ok(sh.uniforms.uSkyRefl === FACADE_U.uSkyRefl, '하늘빛은 창과 같은 공용 유니폼');
  assert.equal(m.customProgramCacheKey(), 'puddle');
  PUDDLE.on = false; const m2 = new THREE.MeshStandardMaterial(); patchPuddleMaterial(THREE, m2); PUDDLE.on = true;
  assert.equal(m2.onBeforeCompile, THREE.Material.prototype.onBeforeCompile, '?wet=0 이면 손대지 않는다');
});
test('웅덩이: 3D 길에만 · 땅 결 패치는 앞 패치를 이어 부른다', () => {
  assert.match(fs.readFileSync('js/mmo/env-osm.js', 'utf8'), /if \(L\.isView3d\(\)\) patchPuddleMaterial\(THREE, roadMat\);/);
  assert.match(fs.readFileSync('js/mmo/env-lib.js', 'utf8'), /if \(VIEW3D\) patchPuddleMaterial\(THREE, roadM\);/);
  const w = fs.readFileSync('world3d.html', 'utf8');
  assert.match(w, /PUDDLE\.on = q\.get\('wet'\) !== '0';/);
  assert.match(w, /m\.onBeforeCompile = \(sh, r\) => \{ if \(prevBC\) prevBC\.call\(m, sh, r\);/, '땅 결이 웅덩이를 덮어쓴다');
  assert.match(w, /m\.customProgramCacheKey = \(\) => 'ground-macro' \+ prevKey;/, '셰이더 캐시 키가 웅덩이 유무를 구분해야');
});
