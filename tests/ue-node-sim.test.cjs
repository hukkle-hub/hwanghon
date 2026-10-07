/* 남산 N-01 방어전 시뮬레이터 난간 (docs/design/201 §8) — tools/ue/node-sim.cjs 로 4분 판을 헤드리스로 돌려,
   UE 를 띄우기 전에 «적이 끼인다·포탑이 놀고 있다·정책이 아무 일도 안 한다» 를 잡는다.
   수치(누가 이기는가)는 디렉터가 정할 균형이라 넓게 잡았다. 여기서 보는 건 «말이 되는가». */
const test = require('node:test'), assert = require('node:assert/strict');
const S = require('../tools/ue/node-sim.cjs'), N = S.load('namsan_n01');
const P = { dps: 1000, counter: 0.35 };
const run = o => S.simulate(N, { player: P, ...o });
const at = (r, re) => (r.events.find(e => re.test(e.text)) || { t: Infinity }).t;

test('시뮬: 어느 판에서도 적이 10초 넘게 끼이지 않는다 (길 그래프·직선 접근 15 m·도착 반경)', () => {
  for (const [name, o] of [['플레이어 없음', { player: null }], ['기본', {}], ['바리케이드', { barricades: ['barricade_west', 'barricade_east'] }], ['기술자→정문', { tech: 'gate' }], ['NPC 무장', { policies: ['arm_npcs', 'scouting'] }]]) {
    const r = run(o);
    assert.deepEqual(r.stuck, [], name + ': 끼인 적 ' + r.stuck.join(', '));
    assert.notEqual(r.result, 'timeout', name + ': 400초 안에 판이 끝나지 않았다');
  }
});
test('시뮬: 거점은 혼자 지켜지지 않고(플레이어 없으면 함락), 플레이어가 있으면 버틸 수 있다', () => {
  assert.equal(run({ player: null }).result, 'fallen');
  assert.equal(run({}).result, 'held');
});
test('시뮬: 포탑이 실제로 싸운다 — 기본 판 피해의 40% 이상 (사거리가 정문 앞·중앙 대로를 덮는다)', () => {
  const r = run({}), all = r.dealt.player + r.dealt.turret + (r.dealt.guard || 0);
  assert.ok(r.dealt.turret / all >= 0.4, '포탑 피해 ' + Math.round(100 * r.dealt.turret / all) + '%');
});
test('시뮬: 전략이 숫자를 바꾼다 — 정문 강화는 정문을, 바리케이드는 NPC 를 지킨다', () => {
  const base = run({}), gate = run({ policies: ['gate_reinforce'] }), bar = run({ barricades: ['barricade_west', 'barricade_east'] });
  assert.ok(at(gate, /south_gate 무너짐/) - at(base, /south_gate 무너짐/) >= 20, '정문 강화가 정문을 20초도 못 늦춘다');
  assert.ok(at(bar, /→ missing/) - at(base, /→ missing/) >= 30, '바리케이드가 첫 NPC 포로를 30초도 못 늦춘다');
  const armed = run({ policies: ['arm_npcs'] }); assert.ok(armed.dealt.guard > 0, 'NPC 무장인데 경비가 안 쏜다');
});
