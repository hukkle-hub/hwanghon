/* 세로 화면 카메라 (문서 229 §50) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { createBossStage } from '../js/mmo/boss-stage.js';
test('세로(가로/세로 < 0.85)만 시야각 +18° · 거리 ×1.4 — 가로 화면은 그대로 · 처음 만들 때도 · 손가락 줌 값(camS.dist)은 안 바꾼다', () => {
  const w = fs.readFileSync('world3d.html', 'utf8');
  assert.match(w, /const PORTRAIT = a => a < 0\.85, fovFor = a => \(MOBILE \? 60 : 52\) \+ \(PORTRAIT\(a\) \? 18 : 0\), camDistK = \(\) => PORTRAIT\(cam\.aspect\) \? 1\.4 : 1;/);
  assert.match(w, /new THREE\.PerspectiveCamera\(fovFor\(innerWidth \/ innerHeight\)/); assert.match(w, /cam\.fov = fovFor\(cam\.aspect\); STAGE\.setBaseFov\(cam\.fov\);/);
  assert.equal((w.match(/cd = camS\.dist \* camDistK\(\)/g) || []).length, 2, '도입 장면 끝 자리와 평소 자리 둘 다'); assert.doesNotMatch(w, /camS\.dist \*= /);
  const hf = (v, a) => 2 * Math.atan(Math.tan(v * Math.PI / 360) * a) * 180 / Math.PI; assert.ok(hf(78, 412 / 839) > hf(60, 412 / 839) + 10, '세로 가로시야 ' + hf(60, .49).toFixed(0) + '° → ' + hf(78, .49).toFixed(0) + '°');
});
function fakeDoc() { const byId = {}; const el = tag => { const e = { tag, children: [], style: {}, dataset: {}, hidden: false, innerHTML: '', textContent: '', _id: '', cls: new Set(), get id() { return this._id; }, set id(v) { this._id = v; byId[v] = this; },
    classList: { add: c => e.cls.add(c), remove: c => e.cls.delete(c), toggle: (c, on) => (on ? e.cls.add(c) : e.cls.delete(c)), contains: c => e.cls.has(c) }, appendChild(c) { this.children.push(c); return c; }, getContext: () => null }; return e; };
  const doc = { head: el('head'), body: el('body'), createElement: el, getElementById: id => byId[id] || null }, hud = el('div'); hud.id = 'hud'; doc.body.appendChild(hud); return doc; }   /* tests/boss-stage.test.mjs 와 같은 가짜 문서 */
test('보스 연출: 시야 펀치가 세로 기준 시야각을 덮어쓰지 않는다 (setBaseFov)', () => {
  const cam = new THREE.PerspectiveCamera(60, .5, .1, 100), S = createBossStage({ THREE, scene: new THREE.Scene(), cam, doc: fakeDoc(), player: () => new THREE.Vector3(), reduced: false });
  S.setBaseFov(78); S.applyCamera(1 / 60); assert.equal(cam.fov, 78, '예전엔 만들 때 붙든 60 으로 매 프레임 되돌렸다');
});
