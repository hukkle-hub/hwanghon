/* 3D 필드 시간대 (문서 217) — 48분 한 바퀴. 황혼은 존이 정한 지금 모습 그대로, 밤에도 보이게, 바퀴 이음새가 끊기지 않게 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { createDayCycle, keyAt, phaseAt, tOf, KEYS, PAL, DAY_LEN, NAMES } from '../js/mmo/daycycle.js';

const base = () => ({ top: new THREE.Color('#2a1838'), hor: new THREE.Color('#7a2a3a'), fog: new THREE.Color('#3a2238'), sun: new THREE.Color(0xff9a60), sunc: new THREE.Color('#ff8a50'), hemi: new THREE.Color(0xc09ad0), ground: new THREE.Color(0x4a2c30),
  sunI: 4.2, hemiI: 3.2, fillI: 0.9, exp: 1.55, alt: 14, westX: -0.8, westZ: 0.6 });
const run = t => { let o = null; const c = createDayCycle(THREE, base(), x => { o = { ...x, fog: x.fog.clone(), sun: x.sun.clone(), dir: x.dir.clone() }; }); c.at(t); return o; };

test('황혼 한가운데는 존이 정한 지금 값 그대로 — «우리 느낌» 이 기본', () => {
  const o = run(tOf('dusk')), b = base();
  assert.equal(o.name, '황혼'); assert.equal(o.fog.getHex(), b.fog.getHex()); assert.equal(o.sun.getHex(), b.sun.getHex());
  assert.equal(o.sunI, b.sunI); assert.equal(o.hemiI, b.hemiI); assert.equal(o.exp, b.exp); assert.equal(o.lampK, 1);
  const w = new THREE.Vector3(b.westX, 0, b.westZ).normalize(), alt = Math.asin(o.dir.y) * 180 / Math.PI;
  assert.ok(Math.abs(alt - 14) < 1e-6, '해 높이 ' + alt); assert.ok(o.dir.x / Math.cos(alt * Math.PI / 180) - w.x < 1e-6, '해가 서쪽이 아니다');
});

test('황혼이 바퀴에서 가장 길다', () => {
  const span = {}; for (let i = 0; i < 2000; i++) { const n = keyAt(i / 2000).name; span[n] = (span[n] || 0) + 1; }
  assert.deepEqual(Object.keys(span).sort(), Object.values(NAMES).sort(), '네 시간대가 다 나와야 한다');
  for (const n of ['밤', '새벽', '낮']) assert.ok(span['황혼'] > span[n], `황혼(${span['황혼']}) 이 ${n}(${span[n]}) 보다 짧다`);
});

test('바퀴는 끊기지 않는다 — 이음새(1 → 0)와 열쇠 사이에서 0.5초 걸음에 색·세기가 튀지 않는다', () => {
  const step = 500 / DAY_LEN; let prev = run(0);
  for (let t = step; t <= 1 + 1e-9; t += step) { const o = run(t % 1);
    assert.ok(Math.abs(o.sunI - prev.sunI) < 0.05 && Math.abs(o.exp - prev.exp) < 0.02 && Math.abs(o.lampK - prev.lampK) < 0.05, '튐 t=' + t.toFixed(4));
    assert.ok(o.dir.angleTo(prev.dir) < 0.03, '해가 튐 t=' + t.toFixed(4)); prev = o; }
  assert.equal(KEYS[0][1], KEYS.at(-1)[1], '처음과 끝 열쇠가 같아야 이어진다');
});

test('밤에도 보인다 — 반구광·노출이 바닥으로 안 떨어지고 가로등은 켜진다, 낮엔 꺼진다', () => {
  const n = run(tOf('night')), d = run(tOf('day'));
  assert.equal(n.name, '밤'); assert.ok(n.hemiI >= base().hemiI * 0.4, '밤 반구광이 너무 어둡다'); assert.ok(n.exp >= 1.5); assert.ok(n.lampK > 1);
  assert.equal(d.name, '낮'); assert.equal(d.lampK, 0); assert.ok(d.exp <= 1.1, '낮 노출이 높으면 하얗게 날아간다');
  assert.ok(d.dir.y > Math.sin(40 * Math.PI / 180), '낮 해는 높다');
});

test('시각 → 바퀴 위치, 이름/숫자로 고정', () => {
  assert.equal(phaseAt(0), 0); assert.equal(phaseAt(DAY_LEN / 2), 0.5); assert.equal(phaseAt(-DAY_LEN / 4), 0.75);
  assert.equal(keyAt(tOf('밤')).name, '밤'); assert.equal(keyAt(tOf('night')).name, '밤'); assert.equal(tOf('0.3'), 0.3); assert.equal(tOf(''), null); assert.equal(tOf('xyz'), null);
  for (const k of Object.keys(PAL)) assert.equal(keyAt(tOf(k)).name, NAMES[k]);
});

test('world3d 연결: 실내는 안 돌림 · 서버 시각 · 가로등 세기 · ?tod 고정', () => {
  const s = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8');
  assert.match(s, /const DAYC = sun && hemiL && \(env\.kind \|\| Z\.kind \|\| meta\.kind\) === 'field' \?/, '실내(던전·벙커)는 시간대를 돌리지 않는다');
  assert.match(s, /DAYC\.update\(net \? sclock\.now\(\) : Date\.now\(\)\)/, '온라인은 서버 시각 — 같은 필드는 같은 하늘');
  assert.match(s, /L\.intensity = l\.intensity \* lampK;/, '가로등이 시간대 세기를 따른다');
  assert.match(s, /DAYC\.fixed = tOf\(q\.get\('tod'\)\)/);
  assert.ok(!/daycycle/.test(fs.readFileSync(new URL('../mmo.html', import.meta.url), 'utf8')), '2D 필드는 손대지 않는다');
});
