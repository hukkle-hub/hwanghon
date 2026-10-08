/* 필드 손맛 (문서 205) — 솔로와 같은 표로 «날이 닿는 프레임» 에 효과·히트스톱이 모이는지.
   v11 규칙: 판정보다 효과가 먼저 나오지 않는다 · 궤적은 실제 날 · 히트스톱은 화면만 (게임 시간으로 센다). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = globalThis; require('../js/dungeons.js'); const Q = require('../js/combat-quality.js');
const { contactOf, stopFor, trailWindow, createFieldFeel } = await import('../js/mmo/field-feel.js');
const R = globalThis.TW_DUNGEONS.RULES;
const hero = (id = 'ain', dur = 1.12) => ({ id, root: { position: { x: 0, y: 0, z: 0 } }, act: { attack1: { getClip: () => ({ duration: dur }) }, skill3: { getClip: () => ({ duration: 1.6 }) } } });
const scene = { add() {}, remove() {} };

test('필드 손맛: 접점·히트스톱·궤적 구간이 솔로 표(js/dungeons.js)와 같다', () => {
  assert.equal(contactOf('ain', 'attack2'), R.motion.clipContactsByChar.ain.attack2, '캐릭터별 접점이 먼저');
  assert.equal(contactOf('ain', 'attack1'), R.motion.clipContacts.attack1, '없으면 공통 접점');
  assert.equal(stopFor('light', 'ain'), R.hitstop.light);
  assert.ok(Math.abs(stopFor('light', 'kain') - R.hitstop.light * R.rhythm.kain.stop) < 1e-9, '대검은 무기 리듬만큼 길게');
  for (const hitAt of [.2, .43, .8]) { const [a, b] = trailWindow(hitAt);   /* combat-quality.trailActive 와 같은 구간 */
    for (const t of [a - .01, a + .01, b - .01, b + .01]) assert.equal(t >= a && t <= b, Q.trailActive({ elapsed: t, hitAt, duration: 9 }), 'trail ' + hitAt + '@' + t); }
});

test('필드 손맛: 효과는 누를 때가 아니라 접점 시각에 — 게임 시간으로 세고, 접점에서 나와 맞은 쪽이 함께 멈춘다', () => {
  const sounds = [], reacts = [], F = createFieldFeel(scene, { sfx: () => ({ play: (n, d) => sounds.push(n) }), react: (h, t, i) => reacts.push(i.kind) });
  const me = hero(), boss = { root: { position: { x: 0, y: 0, z: 2 } }, h: 2.2 };
  const s = F.swing(me, 'attack1'), hitAt = contactOf('ain', 'attack1') * 1.12; assert.ok(Math.abs(s.hitAt - hitAt) < 1e-9);
  let fired = null; F.atContact(me, 0, () => { fired = s.t; F.impact(me, boss, {}); });
  let t = 0; while (fired === null && t < 2) { F.tick(0.05); t += 0.05; }
  assert.ok(fired !== null, '접점 효과가 안 나왔다');
  assert.ok(Math.abs(t - hitAt) <= 0.05 + 1e-9, '접점 시각에 나와야 한다: ' + t.toFixed(3) + ' vs ' + hitAt.toFixed(3));
  assert.ok(t >= hitAt - 1e-9, '판정(접점)보다 효과가 먼저 나왔다');
  assert.deepEqual(sounds, ['hit']); assert.deepEqual(reacts, ['light'], '대상 반응도 같은 접점에');
  assert.equal(F.rate(me), 0, '접점에서 내가 멈춘다'); assert.equal(F.rate(boss), 0, '맞은 쪽도 멈춘다');
  const t0 = me.swing.t; F.tick(0.05); assert.equal(me.swing.t, t0, '히트스톱 중엔 내 동작 시간이 안 간다');
  F.tick(R.hitstop.light); assert.equal(F.rate(me), 1, '히트스톱이 풀린다'); assert.equal(F.rate(boss), 1);
  /* 서버 답이 접점보다 늦으면 바로 */
  me.swing.t = 5; assert.equal(F.contactDelay(me), 0);
});

test('필드 손맛: 피의 회전 2타는 두 접점에 따로, 반격은 더 길게 멈춘다, 움직임 줄이기면 멈추지 않는다', () => {
  const F = createFieldFeel(scene, { sfx: () => null }), me = hero();
  F.swing(me, 'skill3', { kind: 'skill', hits: [[.55, .55], [.8, .45]] });
  assert.ok(Math.abs(F.contactDelay(me, 0) - .55 * 1.6) < 1e-9 && Math.abs(F.contactDelay(me, 1) - .8 * 1.6) < 1e-9);
  /* 첫 접점 히트스톱 동안 휘두름 시계가 멈춘다 → 둘째 접점도 «휘두름 시각» 0.8 에 (벽시계로 세면 히트스톱만큼 앞당겨졌다) */
  const got = []; [0, 1].forEach(k => F.atContact(me, k, () => { got.push(+me.swing.t.toFixed(3)); F.impact(me, null, {}); }));
  for (let i = 0; i < 150 && got.length < 2; i++) F.tick(0.02);
  assert.equal(got.length, 2); assert.ok(got[0] >= .55 * 1.6 - 1e-9 && got[0] < .55 * 1.6 + .021, '1타 ' + got[0]); assert.ok(got[1] >= .8 * 1.6 - 1e-9 && got[1] < .8 * 1.6 + .021, '2타가 앞당겨졌다 ' + got[1]);
  /* 휘두름이 끝난 뒤 온 서버 답은 바로 */
  const m3 = hero(); let late = 0; F.swing(m3, 'attack1'); m3.swing = null; F.atContact(m3, 0, () => late++); F.tick(0); assert.equal(late, 1);
  assert.ok(F.impact(me, null, { counter: true }) > F.impact(hero(), null, {}), '반격 히트스톱이 평타보다 길어야');
  const G = createFieldFeel(scene, { reduced: true, sfx: () => null }), m2 = hero(); G.swing(m2, 'attack1'); G.impact(m2, null, {}); assert.equal(G.rate(m2), 1, '움직임 줄이기 설정에선 멈추지 않는다');
});

test('필드 화면(mmo.html): 타격 효과를 접점 예약으로 — setTimeout(누른 뒤 고정 ms)이 아니다 · 낫은 솔로와 같은 장착', () => {
  const src = fs.readFileSync(path.join(ROOT, 'mmo.html'), 'utf8');
  const off = src.slice(src.indexOf('function hitBoss('), src.indexOf('/* 바닥 장비'));
  assert.ok(off.length > 100 && !/setTimeout/.test(off), '오프라인 타격이 벽시계 setTimeout 을 쓴다');
  assert.match(off, /feel\.atContact\(me,k,/, '오프라인 타격이 접점 예약을 안 쓴다');
  const on = src.slice(src.indexOf("if(m.type==='bossHit')"), src.indexOf("if(m.type==='bossHit')") + 700);
  assert.match(on, /feel\.atContact\(me,0,/, '온라인 타격 답이 접점까지 기다리지 않는다');
  assert.match(src, /feel\.swing\(me,'attack1'\)/); assert.match(src, /feel\.swing\(me,clip,/);
  assert.match(src, /prepareMain:\(model,spec\)=>h\.id==='ain'&&spec\.glb==='art\/3d\/ain_scythe_tex\.glb'\?mountAinScythe\(model\)/, '낫 날 표식이 없으면 궤적이 자루를 따른다');
  assert.match(src, /h\.mixer\.update\(h\.me\?dt\*feel\.rate\(h\):dt\)/, '히트스톱이 내 동작에 안 걸린다');
});
