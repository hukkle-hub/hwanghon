/* N01 갈아 끼운 손 피부 (문서 229 §29) — 단색 CC0 손이 «푸르스름한 흰 장갑»: 손 재질만 얼굴·팔 톤 + 얼룩 무늬 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';

test('손 재질(CC0…Hands)만 고치고 몸·코어·방패는 그대로 · 두 번 걸어도 한 번', async () => {
  const ctx = { fillRect() {}, createRadialGradient: () => ({ addColorStop() {} }), beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
  globalThis.document = { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };
  const { fixN01Skin, SKIN } = await import('../js/mmo/n01-skin-fix.js');
  const mk = n => { const m = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(.42, .36, .35) }); m.name = n; return m; };
  const hands = mk('G5_WALKER_CC0Hands_PBR'), art = mk('CC0ArticulatedHands_PBR'), body = mk('G5_WALKER_Body_PBR'), core = mk('G5_WALKER_Core_PBR'), shield = mk('KNP_Shield_PBR');
  const g = new THREE.Group(); for (const m of [hands, art, body, core, shield]) g.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
  const n0 = SKIN.n; fixN01Skin(THREE, g); fixN01Skin(THREE, g); assert.equal(SKIN.n - n0, 2, '손 재질 둘만 · 한 번만');
  for (const m of [hands, art]) { assert.ok(m.map, m.name + ' 무늬'); assert.ok(m.color.b < .35 * .85, m.name + ' 덜 푸르게 ' + m.color.b); assert.ok(m.color.r > m.color.b, '붉은 쪽이 파랑보다'); }
  for (const m of [body, core, shield]) { assert.equal(m.map, null, m.name + ' 그대로'); assert.ok(Math.abs(m.color.b - .35) < 1e-6); }
  delete globalThis.document;
});
test('world3d: 종별 몸을 받자마자(예열 전) 손 피부를 고친다', () => {
  const W = fs.readFileSync('world3d.html', 'utf8');
  assert.match(W, /load\(a\.url\)\.then\(g=>\{fixN01Skin\(THREE,g\.scene\);if\(q\.get\('mr'\)!=='0'\)mobRim\(THREE,g\.scene\);window\.__warmMob\?\.\(g\);return g;\}\)/, '손 피부 · 밤 윤곽(§32) 둘 다 예열 전에');
});
