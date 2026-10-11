/* 버프 표시 (문서 229 §31) — 결의·철벽·표식·회복 결계가 걸려도 몸에 표시가 없었다. 몸빛(hero-rim 버프 윤곽) + 발밑 고리, 끝 0.6 s 깜빡임 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { buffLevel, BLINK, FADE_OUT, BUFF_COLOR } from '../js/mmo/buff-fx.js';
import { heroRim, HERO_RIM } from '../js/mmo/hero-rim.js';

test('세기: 켜짐 0.15 s · 유지(맥동) · 끝 0.6 s 깜빡 · 0.2 s 꺼짐 · 그 밖 0', () => {
  assert.equal(buffLevel(-0.1, 2), 0); assert.ok(buffLevel(0.05, 2) < 0.4, '켜지는 중');
  for (const t of [0.3, 0.8, 1.2]) assert.ok(buffLevel(t, 2) >= 0.7, '유지 ' + t);
  const blink = []; for (let t = 2 - BLINK + 0.01; t < 2; t += 0.02) blink.push(buffLevel(t, 2)); assert.ok(Math.min(...blink) <= 0.31 && Math.max(...blink) >= 0.99, '끝 무렵 깜빡인다');
  assert.ok(buffLevel(2 + FADE_OUT / 2, 2) > 0 && buffLevel(2 + FADE_OUT / 2, 2) < 1); assert.equal(buffLevel(2 + FADE_OUT + 0.01, 2), 0);
  assert.deepEqual(Object.keys(BUFF_COLOR).sort(), ['ain', 'kain', 'ryu', 'sera'], '네 캐릭터 색');
});
test('몸빛: 영웅 재질 패치에 버프 윤곽 유니폼이 들어간다', () => {
  const m = new THREE.MeshStandardMaterial(), g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(), m)); heroRim(THREE, g);
  const L = THREE.ShaderLib.standard, sh = { uniforms: THREE.UniformsUtils.clone(L.uniforms), vertexShader: L.vertexShader, fragmentShader: L.fragmentShader }; m.onBeforeCompile(sh, null);
  assert.ok(sh.uniforms.uBuffK === HERO_RIM.uBuffK && sh.uniforms.uBuffC === HERO_RIM.uBuffC); assert.match(sh.fragmentShader, /totalEmissiveRadiance \+= uBuffK \* uBuffC \*/);
});
test('world3d: 버프 기술을 쓰면 켜고 · 매 프레임 돌리고 · 영웅 전체 재질을 훑는다', () => {
  const W = fs.readFileSync('world3d.html', 'utf8');
  assert.match(W, /if \(d\.buff && d\.buff\.reduce\) BUFF\.start\(BUFF_COLOR\[ME\] \|\| 0xffd28a, d\.buff\.dur \|\| 2\);/);
  assert.match(W, /  BUFF\.tick\(dt\);[^\n]*\n  if \(busy > 0\)/, 'if/else 사이에 끼우지 않는다 — 한 번 끼워 페이지가 SyntaxError');
  const B = fs.readFileSync('js/mmo/buff-fx.js', 'utf8'); assert.match(B, /g\.position\.y = \.1;/, '도로면 위로 — 0.035 m 는 도로 밑에 깔려 안 보였다');
});
