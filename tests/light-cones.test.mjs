/* 가로등 빛 기둥 (문서 229 §11) — 높은 가로등에만 · 낮엔 0 · 원뿔이 등 밑에서 땅까지 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { addLightCones } from '../js/mmo/light-cones.js';

const pl = (x, y, z, d) => { const l = new THREE.PointLight(0xffd29a, 10, d); l.position.set(x, y, z); return l; };
test('빛 기둥: 4 m 넘고 닿는 거리 12 m 넘는 등만 — 벽 간판(7 m)·결정 불빛(0.8 m 높이)은 뺀다', () => {
  const scene = new THREE.Scene(), C = addLightCones(THREE, scene, [pl(0, 8, 0, 18), pl(10, 5, 0, 14), pl(20, 4.5, 0, 7), pl(30, 0.8, 0, 7)]);
  assert.equal(C.count, 2); assert.ok(scene.children.includes(C.mesh)); assert.ok(C.mesh.userData.noCam, '카메라 막이에 걸리면 안 된다');
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); C.mesh.getMatrixAt(0, m); m.decompose(p, q, s);
  assert.ok(Math.abs(p.x) < 1e-6 && p.y < 0.1 && Math.abs(s.y - 7.9) < 0.01, `원뿔은 땅에서 등 밑까지 (y ${p.y} 높이 ${s.y})`);
  assert.ok(C.mesh.material.blending === THREE.AdditiveBlending && C.mesh.material.depthWrite === false, '더하기 섞기 · 깊이 안 씀');
  C.set(0); assert.equal(C.mesh.material.uniforms.uK.value, 0, '낮(lampK 0)엔 안 보인다'); C.set(1.9); assert.ok(C.mesh.material.uniforms.uK.value > 0.5);
  assert.equal(addLightCones(THREE, new THREE.Scene(), [pl(0, 0.8, 0, 7)]), null, '해당 등이 없으면 아무것도 안 만든다');
});
test('빛 기둥: world3d 가 필드에서만 · ?lc=0 으로 끄고 · 시간대가 세기를', () => {
  const w = fs.readFileSync('world3d.html', 'utf8');
  assert.match(w, /const CONES = q\.get\('lc'\) !== '0' && \(env\.kind \|\| Z\.kind \|\| meta\.kind\) === 'field' \? addLightCones\(THREE, scene, pointData\) : null;/);
  assert.match(w, /if \(CONES\) CONES\.set\(o\.lampK\);/);
  assert.ok(w.indexOf('addLightCones(THREE, scene, pointData)') > w.indexOf('for (const L of pointData) L.parent.remove(L);'), '점광원을 떼어 낸 뒤에 — 원뿔은 모든 등에');
});
