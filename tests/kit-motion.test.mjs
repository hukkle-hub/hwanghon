/* 기술표형 보스의 화면 (문서 222) — 서버 기술표를 그대로 읽어 클립 시각·준비 동작·번개·어둠을 그린다. 바닥 예고는 없다 (문서 224) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as THREE from '../vendor/three/three.module.js';
import { addWindRig } from '../js/mmo/windup.js';
import { setupKitMotion, applyKitAction, prepareKitMotion, updateKitMotion, hideKitMotion } from '../js/mmo/kit-motion.js';
const KIT = createRequire(import.meta.url)('../server/field-boss-kit.cjs');

function boss(id) { const scene = new THREE.Scene(), root = new THREE.Group(), model = new THREE.Group(); root.add(model); scene.add(root);
  const tr = n => new THREE.NumberKeyframeTrack('.position[x]', [0, n], [0, 1]), clips = Object.values(KIT.KITS[id].skills).map(s => new THREE.AnimationClip(s.clip, s.clip === 'atk_s09frenzy' ? 4.03 : 5.23, [tr(4)]));
  clips.push(new THREE.AnimationClip('idle', .83, [tr(.83)]), new THREE.AnimationClip('walk', .83, [tr(.83)]), new THREE.AnimationClip('death', 2.1, [tr(2.1)]));
  const o = { b: { id }, root, model }; setupKitMotion(o, { animations: clips }, model, scene, KIT.KITS[id]); o.h = 2; addWindRig(THREE, o); return o; }
const act = (o, skill, extra = {}) => ({ id: o.b.id, ai: 'kit', x: 0, z: 0, yaw: 0, motion: 'skill', skill, seq: 7, startedAt: 1000, endsAt: 9000, fromX: 0, fromZ: 0, shift: 0, counterOpen: 0, counterClose: 0, ...extra });

/* 바닥 예고가 없다 = 기술 도중 장면에 보이는 메시가 하나도 없다 (몸은 Group 뿐인 가짜) */
const shown = scene => { let n = 0; scene.traverse(m => { if (m.isMesh && m.visible && m.material && m.material.opacity > 0) n++; }); return n; };

test('리듬 깨기: 멈춤(1.1 s) 뒤 클립은 shift 만큼 멈춤 자세를 붙들고, 준비 동작(감기)도 그만큼 밀린다', () => {
  const o = boss('subject09'); applyKitAction(o, act(o, 'frenzy', { shift: 400 }), 1000); const a = o.kacts.atk_s09frenzy;
  prepareKitMotion(o, 1000 + 1300); assert.ok(Math.abs(a.time - 1.1) < 1e-6, '1.3 s 인데 1.1 s 자세 ' + a.time);
  prepareKitMotion(o, 1000 + 2000); assert.ok(Math.abs(a.time - 1.6) < 1e-6);
  updateKitMotion(o, .016, 1000 + 1900); const late = o.wind.g.rotation.y;
  const b = boss('subject09'); applyKitAction(b, act(b, 'frenzy', { shift: 0 }), 1000); updateKitMotion(b, .016, 1000 + 1900); const full = b.wind.g.rotation.y;
  assert.ok(full > .4, '안 밀리면 1.9 s 에 다 감겼다 ' + full); assert.ok(late < full - .1, '밀리면 아직 감는 중 ' + late);
  assert.ok(o.kfx.telling, '박자는 센다(기합음)');
});

test('방전 폭우: 대상 자리 원은 없다 — 하늘이 어두워지고 젖힘 준비 뒤 판정 순간 번개만 · 새 박자마다 소리 이벤트', () => {
  const o = boss('subject09'), scene = o.root.parent, marks = [[5, 6], [7, 8]]; applyKitAction(o, act(o, 'storm', { marks }), 1000);
  let ev = updateKitMotion(o, .016, 1000 + 900); assert.ok(o.wind.g.rotation.x < -.15, '젖힌다 ' + o.wind.g.rotation.x); assert.equal(shown(scene), 0, '바닥에 아무것도');
  ev = updateKitMotion(o, .016, 1000 + 1700); assert.equal(shown(scene), 0, '표식 없음'); assert.ok(ev.tele, '새 표식 소리');
  ev = updateKitMotion(o, .016, 1000 + 2810); assert.ok(ev.impact); assert.deepEqual(ev.bolt, [5, 6]); assert.ok(o.kfx.bolts.some(b => b.m.visible && b.m.position.x === 5), '번개(공격 자체)는 그린다');
  assert.ok(o.kfx.dim > .5, '하늘이 어둡다 ' + o.kfx.dim); hideKitMotion(o); assert.equal(o.kfx.dim, 0); assert.equal(o.wind.g.rotation.x, 0, '숨기면 몸 틀도 제자리');
});

test('기술표형 보스 전부: 어떤 기술의 어떤 순간에도 바닥 예고 메시가 없다 · 판정 전에는 몸 틀이 움직인다', () => {
  for (const id of Object.keys(KIT.KITS)) for (const [name, sk] of Object.entries(KIT.KITS[id].skills)) {
    const o = boss(id), scene = o.root.parent; applyKitAction(o, act(o, name, { marks: [[3, 3]] }), 1000); let moved = 0;
    for (let t = 0; t < sk.duration; t += 50) { updateKitMotion(o, .016, 1000 + t); const g = o.wind.g; if (t < sk.hits[0].at) moved = Math.max(moved, Math.abs(g.rotation.x) + Math.abs(g.rotation.y) + Math.abs(g.position.y));
      for (const b of [...o.kfx.bolts, ...o.kfx.ringPool]) b.m.visible = false;   /* 번개·충격파는 판정 «뒤» 의 공격 그 자체 */
      assert.equal(shown(scene), 0, `${id}.${name} ${t} ms 에 바닥 표시`); }
    assert.ok(moved > .05, `${id}.${name}: 첫 판정 전 준비 동작이 없다 ${moved}`); }
});

test('섀도우 팽: 번개 풀을 만들지 않는다 (atTarget 판정이 없는 보스) · 떠오름은 몸만 올린다', () => {
  const o = boss('shadowfang'); assert.equal(o.kfx.bolts.length, 0); applyKitAction(o, act(o, 'flurry'), 1000); updateKitMotion(o, .016, 1000 + 2600);
  assert.ok(Math.abs(o.model.position.y - 2.4) < 1e-6); assert.equal(o.root.position.y, 0, '판정 자리(root)는 땅에');
});

test('정 장관: 대기·처치는 전용 클립 · 등 뒤 베기는 감았다가(0.12~0.45 s) 판정 뒤 제자리', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(), model = new THREE.Group(); root.add(model); scene.add(root);
  const tr = n => new THREE.NumberKeyframeTrack('.position[x]', [0, n], [0, 1]), names = ['idle', 'walk', 'death', 'idle_jeong', 'death_jeong', ...Object.values(KIT.KITS.jeong.skills).map(s => s.clip)];
  const o = { b: { id: 'jeong' }, root, model, h: 2 }; setupKitMotion(o, { animations: names.map(n => new THREE.AnimationClip(n, 1.5, [tr(1.5)])) }, model, scene, KIT.KITS.jeong); addWindRig(THREE, o);
  assert.equal(o.kfx.clip.getClip().name, 'idle_jeong'); assert.equal(o.deathClip.name, 'death_jeong'); assert.equal(o.kfx.warning, undefined, '예고판 자체가 없다');
  applyKitAction(o, act(o, 'back', { yaw: .4 }), 1000); updateKitMotion(o, .016, 1000 + 400); assert.ok(o.wind.g.rotation.y > .3, '감는다 ' + o.wind.g.rotation.y);
  updateKitMotion(o, .016, 1000 + 900); assert.equal(o.wind.g.rotation.y, 0, '터진 뒤 제자리');
});
