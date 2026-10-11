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
  assert.match(F, /if \(asset\.n01Asset\) \(motion \|\| \(motion = createMobMotion\(THREE\)\)\)\.attach\(v\);/);
  assert.match(F, /motion\?\.before\(v\); v\.mixer\.update\(dt\); motion\?\.after\(v, dt\);/);
});
