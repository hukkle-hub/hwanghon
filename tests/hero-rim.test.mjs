/* 밤 영웅 달빛 윤곽 (문서 229 §24) — 밤에 영웅이 검은 그림자였다. 영웅 재질에만 윤곽 + 앞면 밝힘, 세기는 시간대 lampK */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { heroRim, heroRimK, HERO_RIM } from '../js/mmo/hero-rim.js';

const compile = m => { const L = THREE.ShaderLib.standard, sh = { uniforms: THREE.UniformsUtils.clone(L.uniforms), vertexShader: L.vertexShader, fragmentShader: L.fragmentShader }; m.onBeforeCompile(sh, null); return sh; };
test('윤곽: 표준 재질에 끼워 넣고 · 앞 패치를 잇고 · 두 번 붙이지 않는다', () => {
  const g = new THREE.Group(), prev = new THREE.MeshStandardMaterial(); let called = 0;
  prev.onBeforeCompile = () => { called++; }; prev.customProgramCacheKey = () => 'wind';
  g.add(new THREE.Mesh(new THREE.BoxGeometry(), prev), new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  const n0 = HERO_RIM.n; heroRim(THREE, g); heroRim(THREE, g); assert.equal(HERO_RIM.n - n0, 1, '표준 재질 하나만 · 한 번만');
  const sh = compile(prev); assert.equal(called, 1, '앞 패치(wind.js 천)를 이어 부른다');
  assert.match(sh.fragmentShader, /uniform float uHeroRimK; uniform vec3 uHeroRimC;/);
  assert.match(sh.fragmentShader, /vec3 hn = normalize\(vNormal\);/, '기하 법선 — 법선 지도는 반짝이 가루 얼룩');
  assert.match(sh.fragmentShader, /totalEmissiveRadiance \+= uHeroRimK \* \(uHeroRimC \* pow\(hf, 3\.0\) \* 0\.6 \+ diffuseColor\.rgb \* uHeroRimC \* 0\.35\)/);
  assert.ok(sh.uniforms.uHeroRimK === HERO_RIM.uK, '공용 세기 — 시간대가 한 번에 바꾼다');
  assert.equal(prev.customProgramCacheKey(), 'hero-rimwind', '캐시 키에 앞 패치 키');
  assert.ok(g.children[1].material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile, '기본 재질은 그대로');
});
test('세기: 낮 0 · 새벽 0 · 황혼 약하게 · 밤 0.32 (0.5 는 은빛 조각상)', () => {
  assert.equal(heroRimK(0), 0); assert.equal(heroRimK(0.6), 0); assert.ok(heroRimK(1) < 0.11, '황혼 ' + heroRimK(1)); assert.ok(Math.abs(heroRimK(1.9) - 0.32) < 1e-9); assert.ok(heroRimK(3) <= 0.32);
});
test('world3d: 영웅·새 장비에 붙이고(예열 컴파일 전) · 시간대가 세기를 · ?hr=0 으로 끔', () => {
  const W = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8');
  assert.match(W, /if \(q\.get\('hr'\) !== '0'\) heroRim\(THREE, root\);/);
  const wl = W.slice(W.indexOf('function watchLooks'), W.indexOf('function watchLooks') + 1600);
  assert.ok(wl.indexOf('heroRim(THREE, root)') > 0 && wl.indexOf('heroRim(THREE, root)') < wl.indexOf('preCompile(o)'), '영웅 전체를 훑는다(갈아 끼운 재질까지) — 예열 컴파일 전에');
  assert.match(W, /HERO_RIM\.uK\.value = heroRimK\(o\.lampK\);/);
  assert.match(wl, /for \(const r of remotes\.values\(\)\) if \(r\.a\) heroRim\(THREE, r\.a\.root\);/, '다른 사람도 밤에 검은 그림자가 되지 않게');
});
