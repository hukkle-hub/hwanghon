/* 기술표형 보스의 화면 (문서 222) — 서버 기술표를 그대로 읽어 클립 시각·예고·표식·번개·어둠을 그린다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as THREE from '../vendor/three/three.module.js';
import { setupKitMotion, applyKitAction, prepareKitMotion, updateKitMotion, hideKitMotion } from '../js/mmo/kit-motion.js';
const KIT = createRequire(import.meta.url)('../server/field-boss-kit.cjs');

function boss(id) { const scene = new THREE.Scene(), root = new THREE.Group(), model = new THREE.Group(); root.add(model); scene.add(root);
  const tr = n => new THREE.NumberKeyframeTrack('.position[x]', [0, n], [0, 1]), clips = Object.values(KIT.KITS[id].skills).map(s => new THREE.AnimationClip(s.clip, s.clip === 'atk_s09frenzy' ? 4.03 : 5.23, [tr(4)]));
  clips.push(new THREE.AnimationClip('idle', .83, [tr(.83)]), new THREE.AnimationClip('walk', .83, [tr(.83)]), new THREE.AnimationClip('death', 2.1, [tr(2.1)]));
  const o = { b: { id }, root, model }; setupKitMotion(o, { animations: clips }, model, scene, KIT.KITS[id]); return o; }
const act = (o, skill, extra = {}) => ({ id: o.b.id, ai: 'kit', x: 0, z: 0, yaw: 0, motion: 'skill', skill, seq: 7, startedAt: 1000, endsAt: 9000, fromX: 0, fromZ: 0, shift: 0, counterOpen: 0, counterClose: 0, ...extra });

test('리듬 깨기: 멈춤(1.1 s) 뒤 클립은 shift 만큼 멈춤 자세를 붙들고, 예고 차오름도 그만큼 밀린다', () => {
  const o = boss('subject09'); applyKitAction(o, act(o, 'frenzy', { shift: 400 }), 1000); const a = o.kacts.atk_s09frenzy;
  prepareKitMotion(o, 1000 + 1300); assert.ok(Math.abs(a.time - 1.1) < 1e-6, '1.3 s 인데 1.1 s 자세 ' + a.time);
  prepareKitMotion(o, 1000 + 2000); assert.ok(Math.abs(a.time - 1.6) < 1e-6);
  updateKitMotion(o, .016, 1000 + 1950); const op0 = o.kfx.warnMat.opacity; updateKitMotion(o, .016, 1000 + 2350); assert.ok(o.kfx.warnMat.opacity > op0, '밀린 박자(2.35 s)에 가장 짙다');
  const b = boss('subject09'); applyKitAction(b, act(b, 'frenzy', { shift: 0 }), 1000); updateKitMotion(b, .016, 1000 + 1950); assert.ok(b.kfx.warnMat.opacity > op0 + .1, '안 밀리면 1.95 s 에 이미 짙다');
});

test('대상 자리 표식: 판정 1.2 s 전부터 그 자리에 원 · 판정 순간 번개 + 충격 · 새 표식마다 경고음', () => {
  const o = boss('subject09'), marks = [[5, 6], [7, 8]]; applyKitAction(o, act(o, 'storm', { marks }), 1000);
  let ev = updateKitMotion(o, .016, 1000 + 1500); assert.equal(o.kfx.marks[0].fm.visible, false, '1.6 s 전엔 없다');
  ev = updateKitMotion(o, .016, 1000 + 1700); assert.ok(o.kfx.marks[0].fm.visible); assert.equal(o.kfx.marks[0].fm.position.x, 5); assert.ok(ev.tele, '새 표식 경고음');
  ev = updateKitMotion(o, .016, 1000 + 2810); assert.ok(ev.impact); assert.deepEqual(ev.bolt, [5, 6]); assert.ok(o.kfx.bolts.some(b => b.m.visible && b.m.position.x === 5));
  assert.ok(o.kfx.dim > .5, '하늘이 어둡다 ' + o.kfx.dim); hideKitMotion(o); assert.equal(o.kfx.dim, 0); assert.ok(o.kfx.marks.every(m => !m.fm.visible));
});

test('섀도우 팽: 표식·번개 풀을 만들지 않는다 (atTarget 판정이 없는 보스) · 떠오름은 몸만 올린다', () => {
  const o = boss('shadowfang'); assert.equal(o.kfx.marks.length, 0); applyKitAction(o, act(o, 'flurry'), 1000); updateKitMotion(o, .016, 1000 + 2600);
  assert.ok(Math.abs(o.model.position.y - 2.4) < 1e-6); assert.equal(o.root.position.y, 0, '판정 자리(root)는 땅에');
});

test('정 장관: 대기·처치는 전용 클립 · 등 뒤 예고는 뒤로(π) · 지휘는 세 줄 한 장(선분 쌍)', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(), model = new THREE.Group(); root.add(model); scene.add(root);
  const tr = n => new THREE.NumberKeyframeTrack('.position[x]', [0, n], [0, 1]), names = ['idle', 'walk', 'death', 'idle_jeong', 'death_jeong', ...Object.values(KIT.KITS.jeong.skills).map(s => s.clip)];
  const o = { b: { id: 'jeong' }, root, model }; setupKitMotion(o, { animations: names.map(n => new THREE.AnimationClip(n, 1.5, [tr(1.5)])) }, model, scene, KIT.KITS.jeong);
  assert.equal(o.kfx.clip.getClip().name, 'idle_jeong'); assert.equal(o.deathClip.name, 'death_jeong');
  applyKitAction(o, act(o, 'back', { yaw: .4 }), 1000); updateKitMotion(o, .016, 1000 + 300); assert.ok(o.kfx.warning.visible); assert.ok(Math.abs(o.kfx.warning.rotation.y - (.4 + Math.PI)) < 1e-6, '등 뒤로');
  const g = o.kfx.geos.command[0]; assert.ok(o.kfx.warningOutline.isLineSegments); const one = o.kfx.geos.triple[0].line.attributes.position.count;
  assert.equal(g.line.attributes.position.count, 3 * 8, '사각형 셋 = 선분 12개'); assert.ok(one > 0);
});
