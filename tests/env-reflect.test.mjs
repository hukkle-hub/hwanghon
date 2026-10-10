/* 유리에 비치는 도시 (문서 229 §12) — 굽는 동안 유리 반사를 끄고(되먹임) 끝나면 큐브를 넘긴다 · 시간대가 바뀌면 다시 굽는다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { createEnvReflect } from '../js/mmo/env-reflect.js';
import { FACADE_U, patchFacadeMaterial } from '../js/mmo/facade-shader.js';

test('큐브 굽기: 굽는 동안 uEnvK 0 · 숨길 것 숨김 · 끝나면 큐브와 세기를 넘긴다', () => {
  const scene = new THREE.Scene(), hidden = new THREE.Object3D(); let seen = null;
  const R = createEnvReflect(THREE, {}, scene, { at: { x: 5, z: -3 }, size: 16, hide: [hidden] });
  assert.ok(R.dirty, '처음엔 구워야 한다'); assert.equal(R.cam.position.y, 22); assert.equal(R.cam.position.x, 5);
  R.cam.update = () => { seen = { k: FACADE_U.uEnvK.value, vis: hidden.visible }; };
  FACADE_U.uEnvK.value = 0; R.bake();
  assert.deepEqual(seen, { k: 0, vis: false }, '굽는 동안 유리가 지난 큐브를 비추면 되먹임');
  assert.equal(hidden.visible, true); assert.equal(FACADE_U.uEnvCube.value, R.rt.texture); assert.ok(FACADE_U.uEnvK.value > 0.5); assert.equal(R.dirty, false);
  R.bake(); assert.equal(seen.k, 0, '두 번째 굽기도'); FACADE_U.uEnvK.value = 0; FACADE_U.uEnvCube.value = null;
});
test('유리 셰이더가 큐브를 읽고 · world3d 는 필드에서만 · 시간대가 바뀌면 다시', () => {
  const m = patchFacadeMaterial(THREE, new THREE.MeshStandardMaterial(), { curtain: true }), L = THREE.ShaderLib.standard;
  const sh = { uniforms: THREE.UniformsUtils.clone(L.uniforms), vertexShader: L.vertexShader, fragmentShader: L.fragmentShader }; m.onBeforeCompile(sh);
  assert.match(sh.fragmentShader, /uniform samplerCube uEnvCube; uniform float uEnvK;/);
  assert.match(sh.fragmentShader, /textureCube\(uEnvCube, reflect\(V, Nw\)\)/); assert.ok(sh.uniforms.uEnvK === FACADE_U.uEnvK);
  const w = fs.readFileSync('world3d.html', 'utf8');
  assert.match(w, /const REFL = q\.get\('refl'\) !== '0' && q\.get\('im'\) !== '0' && \(env\.kind \|\| Z\.kind \|\| meta\.kind\) === 'field' \? createEnvReflect\(/);
  assert.match(w, /if \(o\.name !== todName\) \{ todName = o\.name; if \(REFL\) REFL\.dirty = true;/);
  assert.match(w, /if \(REFL && REFL\.dirty\) \{ REFL\.bake\(\);/);
});
