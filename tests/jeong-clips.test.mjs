/* 정 장관 전용 동작 (문서 223) — 디렉터 «얼굴 일그러졌네»: 얼굴(머리뼈 가중치 > 0.6) 삼각형 변이 자세에서 10 % 넘게 늘거나 줄면 안 된다.
   고치기 전: 등 뒤 베기 72 % · 처치 58 % · 원 39 %. 고개를 목뼈에 몰고(얼굴은 머리 60 %·목 32 % 로 묶여 있다) 가슴 기준 ±50°·숙임 24° 로 묶었다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { CLIPS, faceAudit } = await import('../tools/3d/jeong-clips.mjs');

test('얼굴 감사: 모든 전용 클립에서 얼굴 변 늘어남 10 % 미만', () => {
  const bad = []; for (const [n, c] of Object.entries(CLIPS)) { const r = faceAudit(n, c, 1 / 10); if (r.worst >= .1) bad.push(`${n} ${Math.round(r.worst * 100)}% @${r.at}s`); }
  assert.deepEqual(bad, []);
});

test('GLB 에 전용 클립이 다 구워져 있고, 칼 방향(슬롯) 트랙이 있다 — 손 메시는 손 뼈에 가중치가 없어 칼 방향은 슬롯으로', () => {
  const b = fs.readFileSync('art/3d/part1/minister_jeong_candidate.glb'), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  const slot = j.nodes.findIndex(n => /RightHandSlot$/.test(n.name));
  for (const n of Object.keys(CLIPS)) { const a = j.animations.find(x => x.name === n); assert.ok(a, n); assert.ok(a.channels.some(c => c.target.node === slot && c.target.path === 'rotation'), n + ' 슬롯 트랙'); }
  assert.ok(b.length < 4.2e6, 'GLB 가 다시 구울 때마다 커지지 않는다 ' + b.length);
});
