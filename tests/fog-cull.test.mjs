/* 안개 너머는 안 그린다 (문서 229 §14) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { createFogCull } from '../js/mmo/fog-cull.js';

const box = (x, z, mat = new THREE.MeshStandardMaterial()) => { const m = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mat); m.position.set(x, 1, z); return m; };
test('정적 메시: 안개 끝 + 여유 밖은 숨기고 안으로 오면 다시 · 안개를 안 받는 것(실루엣·ShaderMaterial)은 그대로', () => {
  const s = new THREE.Scene(), near = box(50, 0), far = box(400, 0), sil = box(500, 0, new THREE.MeshBasicMaterial({ fog: false })), sh = box(600, 0, new THREE.ShaderMaterial());
  s.add(near, far, sil, sh); const F = createFogCull(THREE, s);
  assert.equal(F.meshes, 2, '실루엣·셰이더는 모으지 않는다');
  F.update(new THREE.Vector3(0, 2, 0), 230); assert.equal(near.visible, true); assert.equal(far.visible, false); assert.equal(sil.visible, true); assert.equal(sh.visible, true); assert.equal(F.hidden, 1);
  F.update(new THREE.Vector3(300, 2, 0), 230); assert.equal(far.visible, true, '가까이 오면 다시 보인다');
  F.update(new THREE.Vector3(-170, 2, 0), 230); assert.equal(near.visible, true, '여유(25 m) 안: 220+1.7 < 255');
  near.visible = false; F.update(new THREE.Vector3(0, 2, 0), 230); assert.equal(near.visible, false, '남이 일부러 숨긴 것을 되살렸다');
});
test('정적 인스턴스: 가까운 것만 앞으로 모아 count 를 줄이고 · 고른 것이 같으면 다시 올리지 않는다 · 남이 행렬을 고치면 손 뗀다', () => {
  const s = new THREE.Scene(), im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial(), 40), M = new THREE.Matrix4();
  for (let i = 0; i < 40; i++) im.setMatrixAt(i, M.makeTranslation(i * 20, 0, 0)); s.add(im);
  const dyn = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial(), 30); for (let i = 0; i < 30; i++) dyn.setMatrixAt(i, M.makeTranslation(i * 30, 0, 0)); s.add(dyn);
  const F = createFogCull(THREE, s); assert.equal(F.inst, 2);
  F.update(new THREE.Vector3(0, 0, 0), 230); assert.equal(im.count, 13, '0..240 m 안의 13 개 (x = 0,20,…,240)'); const p = new THREE.Vector3(); im.getMatrixAt(12, M); p.setFromMatrixPosition(M); assert.equal(p.x, 240);
  const up = F.uploads; F.update(new THREE.Vector3(1, 0, 0), 230); assert.equal(F.uploads, up, '같으면 안 올린다');
  F.update(new THREE.Vector3(780, 0, 0), 230); assert.equal(im.count, 13); im.getMatrixAt(0, M); p.setFromMatrixPosition(M); assert.equal(p.x, 540, '반대쪽 끝으로 가면 그쪽 것');
  dyn.instanceMatrix.needsUpdate = true; F.update(new THREE.Vector3(0, 0, 0), 230); assert.equal(dyn.count, 30, '움직이는 무리는 원래 개수로 돌려 둔다');
});
test('world3d: 지은 직후에 모으고(플레이어·까마귀 전) · 10 프레임마다 · ?fc=0', () => {
  const w = fs.readFileSync('world3d.html', 'utf8'), at = w.indexOf('createFogCull(THREE, scene');
  assert.ok(at > 0 && at < w.indexOf('createCityLife(THREE, scene') && at < w.indexOf('root.position.set(sp.x, 0, sp.z)'), '움직이는 것이 들어오기 전에');
  assert.match(w, /const FOGC = q\.get\('fc'\) !== '0' && scene\.fog/); assert.match(w, /if \(FOGC && \(frames % 10 === 0 \|\| frames < 3\)\) FOGC\.update\(cam\.position, scene\.fog\.far\);/);
});
