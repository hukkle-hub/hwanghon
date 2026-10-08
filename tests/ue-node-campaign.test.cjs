/* 가상 길드 캠페인 (docs/design/201 §8) — 파티·직책 시뮬 + 실제 서버 규칙(node-store)으로 2주를 돌려
   «길드 고리» 가 도는지 본다: 파티원 보고가 다 받아지고, 함락·탈환이 일어나고, 관리권이 지난 주기 1위에게 가고,
   관리 길드가 정책·보급을 넣는다. 수치(누가 이기나)가 아니라 고리가 끊기지 않는지를 잰다. */
const test = require('node:test'), assert = require('node:assert/strict');
const { campaign } = require('../tools/ue/node-campaign.cjs');
test('캠페인: 2주 · 인원 보정 0.4 — 보고 오류 0, 함락과 탈환이 일어나고, 교착 0, 판 안 보급·탈환 철갑, 관리권·정책·보급이 돈다', () => {
  const c = campaign({ weeks: 2, partyScale: 0.4 });
  const errs = c.runs.flatMap(r => r.errors || []); assert.deepEqual(errs, [], '파티원 보고가 거절됐다');
  const n = k => c.runs.filter(r => r.result === k).length;
  assert.ok(n('fallen') >= 1, '두 주 동안 한 번도 안 무너졌다'); assert.ok(n('retaken') >= 1, '탈환이 없다');
  assert.equal(n('timeout'), 0, '시뮬이 900초 안에 못 끝낸 판이 있다 (교착 — UE 엔 시간 제한이 없으니 버그다)');
  const sup = c.runs.filter(r => r.supplyUsed).reduce((a, r) => a + r.supplyUsed.potionsFree + r.supplyUsed.potionsSupply, 0); assert.ok(sup > 0, '판 안에서 보급(회복약)을 한 번도 안 썼다');
  assert.ok(c.runs.some(r => r.kind === 'retake' && r.extraElites > 0), '탈환전에 점령 단계의 추가 철갑이 안 붙었다');
  const w2 = c.weeks[1]; assert.ok(w2.steward, '2주차 관리 길드가 없다'); assert.equal(w2.steward, w2.lastStandings[0].name, '관리 길드 = 지난 주기 1위');
  assert.ok(!/거절/.test(w2.policies) && w2.policies !== '없음', '관리 길드가 정책을 못 넣었다: ' + w2.policies);
});
