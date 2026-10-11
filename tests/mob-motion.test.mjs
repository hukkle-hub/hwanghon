/* 몬스터 몸짓 얹기 (문서 229 §28) — 디렉터 «너무 좀비처럼 서 있다». 클립 위에 뼈 몇 개를 더 돌리되 쌓이지 않고 · 발이 파묻히지 않고 · 방패 팔은 그대로 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { createMobMotion, MOTION } from '../js/mmo/mob-motion.js';

function rig(shield = false) {   /* 위로 선 사람 뼈대: 엉덩이 → 척추 셋 → 목 → 머리 · 어깨 → 위팔(아래로 늘어짐) → 아래팔 */
  const model = new THREE.Group(), mk = (n, p, y, x = 0) => { const b = new THREE.Bone(); b.name = 'mixamorig_' + n; b.position.set(x, y, 0); p.add(b); return b; };
  const hips = mk('Hips', model, 1), sp = mk('Spine', hips, .1), s1 = mk('Spine1', sp, .1), s2 = mk('Spine2', s1, .1), neck = mk('Neck', s2, .15); mk('Head', neck, .1);
  for (const [side, x] of [['Left', .2], ['Right', -.2]]) { const arm = mk(side + 'Arm', s2, .1, x); mk(side + 'ForeArm', arm, -.28); }
  const clip = { duration: 1.3 }, v = { model, root: new THREE.Group(), alive: true, cur: 'idle', seq: 0, current: { time: 0, getClip: () => clip }, named: shield ? { shield_bash: {} } : {}, action: null };
  v.root.add(model); return v;
}
const quats = v => { const o = {}; v.model.traverse(b => { if (b.isBone) o[b.name] = b.quaternion.toArray().map(x => +x.toFixed(6)).join(','); }); return o; };
test('얹고 걷어 내기: 수백 프레임 돌려도 트랙 없는 뼈에 회전이 쌓이지 않는다 · 발 높이(몸 y)는 그대로', () => {
  const M = createMobMotion(THREE), v = rig(); assert.ok(M.attach(v)); const rest = quats(v), y0 = v.model.position.y;
  for (let i = 0; i < 300; i++) { v.cur = i % 90 < 40 ? 'attack' : 'idle'; v.seq = Math.floor(i / 90); v.current.time = (i % 90) / 30; M.before(v); M.after(v, 1 / 30); assert.equal(v.model.position.y, y0, '몸째 내리면 발이 바닥에 파묻힌다'); }
  M.before(v); assert.deepEqual(quats(v), rest, '걷어 내면 처음 그대로'); assert.equal(v.model.position.z, 0);
});
test('비교전 대기는 숨만 · 교전하면 숙이고 팔을 든다 · 공격 중간엔 앞으로 디딘다', () => {
  const M = createMobMotion(THREE), v = rig(); M.attach(v); const rest = quats(v);
  M.before(v); M.after(v, 1 / 30); const calm = quats(v); assert.equal(calm.mixamorig_RightArm, rest.mixamorig_RightArm, '비교전엔 팔을 안 든다'); assert.notEqual(calm.mixamorig_Spine1, rest.mixamorig_Spine1, '숨');
  v.cur = 'attack'; v.seq = 1; let maxZ = 0; for (let i = 0; i < 40; i++) { v.current.time = Math.min(1.3, i / 30); M.before(v); M.after(v, 1 / 30); maxZ = Math.max(maxZ, v.model.position.z); }
  assert.ok(maxZ > .4, '덮치기 ' + maxZ); const fight = quats(v); assert.notEqual(fight.mixamorig_RightArm, rest.mixamorig_RightArm, '할퀼 채비');
  const hand = new THREE.Vector3(); v.model.getObjectByName('mixamorig_RightForeArm').getWorldPosition(hand); assert.ok(hand.z > 0, '팔은 앞(+Z)으로 든다 ' + hand.z.toFixed(3));
  MOTION.amp = 0; M.before(v); M.after(v, 1 / 30); assert.deepEqual(quats(v), rest, 'amp 0 이면 끔'); MOTION.amp = 1;
});
test('방패 든 몸(shield_bash 클립)은 팔을 안 돌린다 — 방패가 머리 위로 납작하게 돌아갔다', () => {
  const M = createMobMotion(THREE), v = rig(true); M.attach(v); const rest = quats(v); v.cur = 'attack'; v.seq = 1;
  for (let i = 0; i < 20; i++) { v.current.time = i / 30; M.before(v); M.after(v, 1 / 30); }
  const q = quats(v); assert.equal(q.mixamorig_RightArm, rest.mixamorig_RightArm); assert.equal(q.mixamorig_LeftArm, rest.mixamorig_LeftArm); assert.notEqual(q.mixamorig_Spine, rest.mixamorig_Spine, '몸통은 덮친다');
});
test('field-mobs: N01 몸에만 · 믹서 앞에서 걷고 뒤에서 얹는다', () => {
  const F = fs.readFileSync('js/mmo/field-mobs.js', 'utf8');
  assert.match(F, /if \(asset\.n01Asset\) \{ \(motion \|\| \(motion = createMobMotion\(THREE\)\)\)\.attach\(v\);/);
  assert.match(F, /motion\?\.before\(v\); v\.mixer\.update\(dt\); motion\?\.after\(v, dt\);/);
});
test('역할별 덮치기 (문서 229 §36): 추적형은 두 손 · 파쇄형은 젖힐 때 팔을 머리 위로 · 역할이 없으면 기본', async () => {
  const { styleOf, STYLE } = await import('../js/mmo/mob-motion.js'), { CATALOG } = await import('../js/mmo/monster-catalog.js'), cat = id => CATALOG.find(c => c.id === id);
  assert.equal(styleOf(cat('G5_STALKER')), STYLE.pounce); assert.equal(styleOf(cat('G5_RUNNER')), STYLE.flank); assert.equal(styleOf(cat('G5_BREAKER')), STYLE.slam);
  assert.equal(styleOf(cat('G5_ARMORED')), STYLE.charge); assert.equal(styleOf(cat('G5_RESONATOR')), STYLE.shove); assert.equal(styleOf(cat('G5_WALKER')), STYLE.swipe); assert.equal(styleOf(null), STYLE.swipe);
  const hand = (v, side) => { const p = new THREE.Vector3(); v.model.getObjectByName('mixamorig_' + side + 'ForeArm').getWorldPosition(p); return p; };
  const M = createMobMotion(THREE), a = rig(); a.cat = cat('G5_STALKER'); M.attach(a); a.cur = 'attack'; a.seq = 1; a.current.time = 1.3 * (.1 + .45 / 2); M.before(a); M.after(a, 1 / 30);
  assert.ok(hand(a, 'Left').z > .05 && hand(a, 'Right').z > .05, '추적자는 두 손을 앞으로');
  const b = rig(); b.cat = cat('G5_BREAKER'); M.attach(b); b.cur = 'attack'; b.seq = 1; b.current.time = 1.3 * (.35 / 2); M.before(b); M.after(b, 1 / 30);
  const hb = hand(b, 'Right'), sh = new THREE.Vector3(); b.model.getObjectByName('mixamorig_RightArm').getWorldPosition(sh); assert.ok(hb.y > sh.y, '파쇄자는 젖힐 때 팔이 어깨 위로 ' + (hb.y - sh.y).toFixed(3));
});
test('죽은 뒤엔 되돌리지 않는다 (문서 229 §37): 사망 클립이 멈춰 믹서가 뼈를 안 써도 시체가 «살아 있던 자세» 로 일어서지 않는다', () => {
  const M = createMobMotion(THREE), v = rig(); M.attach(v); const sp = v.model.getObjectByName('mixamorig_Spine'), lying = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.4);
  v.cur = 'attack'; v.seq = 1; for (let i = 0; i < 10; i++) { v.current.time = i / 30; M.before(v); M.after(v, 1 / 30); }
  v.alive = false; v.cur = 'die';
  for (let i = 0; i < 5; i++) { M.before(v); sp.quaternion.copy(lying); M.after(v, 1 / 30); }   /* 믹서가 눕는 자세를 쓰는 동안 */
  for (let i = 0; i < 5; i++) { M.before(v); M.after(v, 1 / 30); }   /* 클립 끝 — 값이 그대로라 믹서는 안 쓴다 */
  assert.ok(sp.quaternion.angleTo(lying) < 1e-6, '시체가 일어섰다 ' + sp.quaternion.angleTo(lying).toFixed(3));
});
test('맞음 움찔 (문서 229 §37): 짧은 맞음 클립(0.33 s)에 0.08 s 에 젖히고 밀려났다 0.5 s 에 돌아온다 · 긴 클립(0.93 s)엔 작게', async () => {
  const { flinch, HIT_K } = await import('../js/mmo/mob-motion.js');
  assert.equal(flinch(.08), 1); assert.equal(flinch(.5), 0); assert.equal(HIT_K(.33), 1); assert.ok(HIT_K(.93) < .3);
  const lean = dur => { const M = createMobMotion(THREE), v = rig(); M.attach(v); const clip = { duration: dur }; v.current.getClip = () => clip;
    for (let i = 0; i < 30; i++) { M.before(v); M.after(v, 1 / 30); } const rest = quats(v);
    v.cur = 'hit'; v.current.time = 0; let peak = 0, minZ = 0; const sp = v.model.getObjectByName('mixamorig_Head'), w = new THREE.Vector3(), w0 = new THREE.Vector3();
    M.before(v); v.model.updateMatrixWorld(true); sp.getWorldPosition(w0);
    for (let i = 0; i < 18; i++) { v.current.time = Math.min(dur, i / 30); M.before(v); M.after(v, 1 / 30); v.model.updateMatrixWorld(true); sp.getWorldPosition(w); peak = Math.min(peak, w.z - w0.z); minZ = Math.min(minZ, v.model.position.z); }
    return { peak, minZ, rest, v, M }; };
  const s = lean(.33), l = lean(.93);
  assert.ok(s.peak < -.05, '머리가 뒤로 ' + s.peak.toFixed(3)); assert.ok(s.minZ < -.1, '밀려남 ' + s.minZ.toFixed(3)); assert.ok(l.peak > s.peak * .5, '긴 클립엔 작게 ' + l.peak.toFixed(3));
});
test('가볍게 (문서 229 §39): 행렬을 다시 짜지 않고 쿼터니언만 — 몸이 돌고 커져도 팔은 몸 앞으로 든다', () => {
  const S = fs.readFileSync('js/mmo/mob-motion.js', 'utf8'); assert.doesNotMatch(S, /getWorld(Quaternion|Position)\(|updateMatrixWorld\(/, '24 마리 × 매 프레임 조상 행렬 다시 짜기 — 1 ms');
  const M = createMobMotion(THREE), v = rig(); v.root.rotation.y = Math.PI / 2; v.model.scale.setScalar(1.7); M.attach(v);
  const fa = v.model.getObjectByName('mixamorig_RightForeArm'), sh = v.model.getObjectByName('mixamorig_RightArm'), p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), o = new THREE.Vector3();
  const rel = out => { v.root.updateMatrixWorld(true); fa.getWorldPosition(out); sh.getWorldPosition(o); return out.sub(o); };   /* 어깨 기준 — 몸째 디딤(앞으로 0.6 m)은 빼고 팔만 */
  rel(p0); v.cur = 'attack'; v.seq = 1; for (let i = 0; i < 12; i++) { v.current.time = i / 30; M.before(v); M.after(v, 1 / 30); } rel(p1); assert.ok(p1.x - p0.x > .05, '몸 앞(세계 +X)으로 ' + (p1.x - p0.x).toFixed(3)); assert.ok(Math.abs(p1.z - p0.z) < Math.abs(p1.x - p0.x), '옆으로 새지 않는다');
});
