/* 맞은 몸만 번쩍 (문서 229 §43) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { ownMaterials, flashHit, flashTick, disposeFlash, FLASH } from '../js/mmo/mob-flash.js';
function body() { const core = new THREE.MeshStandardMaterial({ color: 0x6f0712, emissive: 0x99050d }), skin = new THREE.MeshStandardMaterial({ color: 0xffffff });   /* glTF 처럼 발광 세기 1 · 몸은 발광색 검정 */
  skin.onBeforeCompile = () => {}; skin.customProgramCacheKey = () => 'mob-rim';
  const g = new THREE.Group(), a = new THREE.Mesh(new THREE.BoxGeometry(), [core, skin]), b = new THREE.Mesh(new THREE.BoxGeometry(), skin); g.add(a, b); return { g, core, skin, a, b }; }
test('마리마다 재질 복제 — 원본(종끼리 공유)은 그대로 · 셰이더 패치·캐시 열쇠는 넘겨 프로그램이 늘지 않는다', () => {
  const B = body(), F = ownMaterials(THREE, B.g);
  assert.notEqual(B.a.material[1], B.skin); assert.equal(B.a.material[1].onBeforeCompile, B.skin.onBeforeCompile); assert.equal(B.a.material[1].customProgramCacheKey(), 'mob-rim');
  assert.equal(F.mats.length, 3); flashHit(F); flashTick(F, 0); assert.equal(B.skin.color.getHex(), 0xffffff, '원본은 안 건드린다');
});
test('맞는 순간 바탕색 ×6 · 발광은 «원래 + 흰빛 0.12» (세기 1 인 몸을 0.76 회색으로 만들지 않는다) · 0.14 s 뒤 정확히 원래대로', () => {
  const B = body(), F = ownMaterials(THREE, B.g), skin = B.a.material[1], core = B.a.material[0], c0 = core.color.clone();
  flashHit(F); flashTick(F, 0);
  assert.ok(Math.abs(core.color.r - c0.r * (1 + FLASH.color)) < 1e-6, '바탕색을 곱해 밝힌다');
  assert.ok(skin.emissive.r <= FLASH.glow + 1e-6 && skin.emissive.r > .1, '몸 발광 = 흰빛 0.12 만 ' + skin.emissive.r.toFixed(3)); assert.equal(skin.emissiveIntensity, 1);
  flashTick(F, .07); assert.ok(skin.emissive.r < FLASH.glow * .3, '제곱으로 빨리 식는다');
  flashTick(F, .1); assert.equal(skin.emissive.getHex(), 0); assert.equal(skin.emissiveIntensity, 1); assert.equal(core.emissive.getHex(), 0x99050d); assert.ok(core.color.equals(c0)); assert.equal(F.on, false);
  assert.equal(flashTick(F, .1), 0, '꺼진 뒤엔 일하지 않는다'); disposeFlash(F);
});
test('field-mobs: N01 몸만 복제 · 체력이 줄면(온라인 패킷 · 혼자 연습 둘 다) 번쩍 · 지울 때 재질도 버린다', () => {
  const F = fs.readFileSync('js/mmo/field-mobs.js', 'utf8');
  assert.match(F, /if \(asset\.n01Asset\) \{ \(motion \|\| \(motion = createMobMotion\(THREE\)\)\)\.attach\(v\); v\.flash = ownMaterials\(THREE, v\.model\); \}/);
  assert.match(F, /if \(Number\.isFinite\(s\.hp\)\) setHp\(v, s\.hp\);/); assert.match(F, /hurt\(id, hp\) \{ const v = views\.get\(id\); if \(v\) setHp\(v,/);
  assert.match(F, /function setHp\(v, hp\) \{ if \(hp < v\.hp - \.01\) flashHit\(v\.flash\); v\.hp = hp; \}/); assert.match(F, /flashTick\(v\.flash, dt\)/); assert.match(F, /disposeFlash\(v\.flash\);/);
});
