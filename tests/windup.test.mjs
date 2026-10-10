/* 준비 동작 (문서 224) — 바닥 예고 대신 보스 몸이 기술을 알린다. 감기·웅크림·젖힘 → 판정 순간 터짐 → 제자리 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { STYLES, addWindRig, windAt, applyWind } from '../js/mmo/windup.js';
import { CLAVE_MOTIONS, CLAVE_WINDS } from '../js/mmo/boss-motion.js';
import { DOM_WIND } from '../js/mmo/dominator-motion.js';

const rig = () => { const root = new THREE.Group(), model = new THREE.Group(); model.position.set(.1, .2, .3); root.add(model); const o = { root, model, h: 3 }; addWindRig(THREE, o); return o; };

test('틀은 뿌리와 몸 사이에 끼고 몸의 자기 위치는 안 건드린다 · 두 번 불러도 하나', () => {
  const o = rig(); assert.equal(o.model.parent, o.wind.g); assert.equal(o.wind.g.parent, o.root); assert.deepEqual(o.model.position.toArray(), [.1, .2, .3]);
  const g = o.wind.g; addWindRig(THREE, o); assert.equal(o.wind.g, g); assert.equal(o.root.children.length, 1);
});

test('준비: 시작 전 0 · 창의 85 % 에 다 감김 · 판정 뒤 180 ms 안에 터졌다가 제자리', () => {
  const o = rig(), w = [{ from: 1000, at: 2000, style: 'coil' }], g = o.wind.g;
  applyWind(o, w, 900, true); assert.equal(g.rotation.y, 0);
  applyWind(o, w, 1425, true); const half = g.rotation.y; assert.ok(half > .05 && half < STYLES.coil.twist - .05, '반쯤 ' + half);
  applyWind(o, w, 1900, true); assert.ok(Math.abs(g.rotation.y - STYLES.coil.twist) < 1e-9, '다 감김');
  applyWind(o, w, 2060, true); assert.ok(g.rotation.y < STYLES.coil.twist, '터지는 중'); assert.ok(g.rotation.x > 0, '앞으로 쏟아짐 ' + g.rotation.x);
  applyWind(o, w, 2200, true); assert.equal(g.rotation.y, 0); assert.equal(g.rotation.x, 0); assert.deepEqual(g.scale.toArray(), [1, 1, 1]);
});

test('모양마다 다르게 읽힌다: 웅크림 = 낮아지고 숙임 · 젖힘 = 뒤로 · 감기 = 비틂', () => {
  const at = s => { const o = rig();   /* 웅크림 = 눌림(발밑 원점) */ applyWind(o, [{ from: 0, at: 1000, style: s }], 950, true); return o.wind.g; };
  const c = at('crouch'), r = at('rear'), k = at('coil');
  assert.ok(c.scale.y < .92 && c.rotation.x > .15, '웅크림'); assert.ok(r.rotation.x < -.2, '젖힘'); assert.ok(k.rotation.y > .4, '감기');
  assert.ok(1 - c.scale.y > (1 - r.scale.y) * 2, '웅크림이 젖힘보다 훨씬 눌린다');
  for (const g of [c, r, k]) assert.equal(g.position.y, 0, '틀을 내리지 않는다 — 발이 바닥에 파묻힌다');
});

test('떨림은 끝무렵에만, 움직임 줄이기면 없음', () => {
  const w = [{ from: 0, at: 1000, style: 'brace' }], o = rig(); applyWind(o, w, 300); assert.equal(o.wind.g.position.x, 0, '처음엔 떨지 않는다');
  let moved = 0; for (let t = 880; t < 1000; t += 7) { applyWind(o, w, t); moved = Math.max(moved, Math.abs(o.wind.g.position.x)); } assert.ok(moved > 0, '끝무렵 떨림');
  const q = rig(); for (let t = 880; t < 1000; t += 7) { applyWind(q, w, t, true); assert.equal(q.wind.g.position.x, 0); }
});

test('창 고르기: 겹치지 않은 창이 차례로 · 창 밖은 null', () => {
  const w = [{ from: 0, at: 500, style: 'coil' }, { from: 800, at: 1200, style: 'rear' }];
  assert.equal(windAt(w, 300).w.style, 'coil'); assert.equal(windAt(w, 600).r > 0, true); assert.equal(windAt(w, 750), null); assert.equal(windAt(w, 1000).w.style, 'rear'); assert.equal(windAt(w, 1500), null);
});

test('클레이브: 판정마다 창 하나 · 창 끝 = 판정 시각 · 첫 판정 전 0.7 s 이상 준비', () => {
  for (const [skill, def] of Object.entries(CLAVE_MOTIONS)) { const w = CLAVE_WINDS[skill]; assert.ok(w, skill);
    assert.deepEqual(w.map(x => x.at), def.hits.map(h => h.at), skill + ' 창 끝 = 판정'); for (const x of w) assert.ok(STYLES[x.style] && x.from < x.at, skill);
    assert.ok(w[0].at - w[0].from >= 700, skill + ' 준비가 짧다'); }
});

test('지배형: 기술마다 준비 모양이 있다 (베기 = 감기, 파동 = 젖힘)', () => {
  const src = readFileSync(new URL('../js/mmo/dominator-motion.js', import.meta.url), 'utf8'), geo = src.match(/o\.dom\.geo = \{([^}]*)\}/)[1].match(/(\w+):/g).map(s => s.slice(0, -1));
  for (const k of geo) assert.ok(STYLES[DOM_WIND[k]], k); assert.equal(DOM_WIND.dominate, 'rear'); assert.equal(DOM_WIND.rend, 'coil');
});

test('3D 필드: 클레이브·지배형은 바닥 예고를 끄고 모든 AI 보스에 준비 동작 틀을 단다', () => {
  const w = readFileSync(new URL('../world3d.html', import.meta.url), 'utf8');
  assert.match(w, /setupBossMotion\(o, gl, r, scene, 0, \{ telegraph: false \}\); addWindRig\(THREE, o\);/);
  assert.match(w, /setupDominator\(o, \{ scene: r, animations: g\.animations \}, scene, 0, \{ telegraph: false \}\); addWindRig\(THREE, o\);/);
  assert.match(w, /setupKitMotion\([^)]*\); addWindRig\(THREE, o\);/);
});

test('필드 몬스터(telegraph:false): 공격해도 발밑 고리가 없고, 예고 창 동안 몸이 버텼다가 판정 뒤 제자리 · 2D(기본값)는 고리 그대로', async () => {
  const { createMobView } = await import('../js/mmo/field-mobs.js');
  const old = globalThis.document, element = () => ({ style: {}, firstChild: { style: {} }, appendChild() {}, remove() {}, innerHTML: '' }); globalThis.document = { createElement: element };
  try { const mk = async telegraph => { const sc = new THREE.Group(); sc.add(new THREE.Mesh(new THREE.BoxGeometry(.3, 1.8, .2), new THREE.MeshStandardMaterial()));
      const asset = { scene: sc, animations: ['idle', 'walk', 'attack1'].map(n => new THREE.AnimationClip(n, 1.4, [])) };
      const view = createMobView({ THREE, clone: s => s.clone(true), scene: new THREE.Scene(), loadBody: async () => asset, hud: element(), tagAt() {}, catalog: [{ id: 'G5_WALKER', name: '보행', grade: 5 }], telegraph }); await Promise.resolve(); return view; };
    const row = (anim, seq) => ({ id: 'z:w:0', catalogId: 'G5_WALKER', x: 0, z: 0, alive: true, generation: 1, anim, seq, action: anim === 'attack' ? { key: 'swipe', seq, elapsedMs: 0, windupMs: 600 } : null });
    const v3 = await mk(false); v3.update([row('idle', 1)], .016); v3.update([row('attack', 2)], .3); v3.update([row('attack', 2)], .016); const v = v3.views.get('z:w:0');   /* 틀은 지난 프레임의 클립 시각을 본다 */
    assert.equal(v.warn, null, '고리 없음'); assert.ok(v.wind, '준비 틀'); assert.ok(v.wind.g.rotation.x < -.03, '버팀(뒤로 젖힘) ' + v.wind.g.rotation.x);
    v3.update([row('attack', 2)], .5); v3.update([row('attack', 2)], .016); assert.equal(v.wind.g.rotation.x, 0, '판정 뒤 제자리'); v3.update([], .01);
    const v2 = await mk(undefined); v2.update([row('idle', 1)], .016); v2.update([row('attack', 2)], .1); const w = v2.views.get('z:w:0');
    assert.ok(w.warn && w.warn.visible, '2D 는 고리 그대로'); assert.equal(w.wind, undefined); v2.update([], .01);
  } finally { globalThis.document = old; }
});
