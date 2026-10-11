/* 밤 몬스터 윤곽 (문서 229 §32) — 영웅과 따로(버프 몸빛이 몬스터에 붙지 않게) · 영웅보다 약하게 · 시간대가 세기 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { mobRim, mobRimK, MOB_RIM } from '../js/mmo/mob-rim.js';
import { heroRimK, HERO_RIM } from '../js/mmo/hero-rim.js';

test('몬스터 재질: 자기 유니폼만(버프 몸빛 없음) · 한 번만 · 앞 패치를 잇는다', () => {
  const m = new THREE.MeshStandardMaterial(); let prev = 0; m.onBeforeCompile = () => { prev++; }; const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
  const n0 = MOB_RIM.n; mobRim(THREE, g); mobRim(THREE, g); assert.equal(MOB_RIM.n - n0, 1);
  const L = THREE.ShaderLib.standard, sh = { uniforms: THREE.UniformsUtils.clone(L.uniforms), vertexShader: L.vertexShader, fragmentShader: L.fragmentShader }; m.onBeforeCompile(sh, null);
  assert.equal(prev, 1); assert.ok(sh.uniforms.uMobRimK === MOB_RIM.uK); assert.ok(!('uBuffK' in sh.uniforms) && !/uBuffK/.test(sh.fragmentShader), '버프 몸빛이 몬스터에 붙으면 안 된다');
  assert.ok(MOB_RIM.uK !== HERO_RIM.uK, '영웅과 다른 세기');
});
test('세기: 낮 0 · 밤 0.2 — 영웅(0.32)보다 약하게', () => {
  assert.equal(mobRimK(0), 0); assert.ok(Math.abs(mobRimK(1.9) - 0.2) < 1e-9); assert.ok(mobRimK(1.9) < heroRimK(1.9));
});
test('world3d: 종별 몸을 받을 때 걸고 · 시간대가 세기 · ?mr=0 으로 끔', () => {
  const W = fs.readFileSync('world3d.html', 'utf8'); assert.match(W, /if\(q\.get\('mr'\)!=='0'\)mobRim\(THREE,g\.scene\);/); assert.match(W, /MOB_RIM\.uK\.value = mobRimK\(o\.lampK\);/);
});
