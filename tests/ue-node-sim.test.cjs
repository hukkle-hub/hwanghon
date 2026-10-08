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
test('시뮬: NPC 대피 명령은 포로를 줄인다 (기능을 버리고 안전 — 문서 201 §3)', () => {
  const cnt = r => Object.values(r.npcs).filter(s => s === 'missing').length;
  const base = cnt(run({})), evac = cnt(run({ evacuate: true }));
  assert.ok(evac <= base - 2, '대피해도 포로가 ' + base + ' → ' + evac);
});
test('시뮬: 무너진 시설은 판 중에 다시 서지 않는다 — 기술자가 무너진 정문을 1%씩 살려 영영 안 끝나던 교착 (UE HWNodeNpc 와 같이 고침)', () => {
  for (const [name, o] of [['기술자→정문', { tech: 'gate' }], ['기술자→정문 · 탈환 요새', { tech: 'gate', retake: true, difficulty: 1.65, extraElites: 2 }]]) {
    const r = run({ ...o, maxTime: 900 }), downs = {};
    for (const e of r.events) if (e.kind === 'facility' && e.to === 'destroyed') downs[e.id] = (downs[e.id] || 0) + 1;
    for (const [id, n] of Object.entries(downs)) assert.equal(n, 1, name + ': ' + id + ' 가 ' + n + '번 무너졌다');
    assert.notEqual(r.result, 'timeout', name + ': 판이 안 끝난다');
  }
});
test('시뮬: 탈환전 — 점령 단계의 추가 철갑이 마지막 웨이브에 붙고, 통신센터를 잃으면 탈환 실패(fallen)', () => {
  const base = run({}), ret = run({ retake: true, difficulty: 1.65, extraElites: 2, maxTime: 900 });
  assert.equal(ret.spawned, base.spawned + 2, '추가 철갑 ' + (ret.spawned - base.spawned));
  assert.equal(ret.opt.retake, true); assert.equal(ret.opt.extraElites, 2);
  const lone = run({ player: null, retake: true, difficulty: 1.3, extraElites: 1 });
  assert.equal(lone.result, 'fallen'); assert.ok(lone.events.some(e => /탈환 실패/.test(e.text)), '탈환 실패 사건이 없다');
});
test('시뮬: 판 안 보급 — 회복약(정책 무료분 먼저)은 쓰러짐을 줄이고, 포탑 수리는 수리·보급 권한자만 보급 2로 한다', () => {
  const weak = { dps: 600, counter: 0.35 }, none = run({ player: weak, supply: 0 }), some = run({ player: weak, supply: 12 });
  assert.ok(some.player.deaths < none.player.deaths, '보급 12 인데 쓰러짐이 ' + none.player.deaths + ' → ' + some.player.deaths);
  assert.ok(some.supplyUsed.potionsSupply > 0 && some.supplyLeft === 12 - some.supplyUsed.potionsSupply, JSON.stringify(some.supplyUsed));
  const med = run({ player: weak, supply: 2, policies: ['medical_stock'] });
  assert.equal(med.supplyUsed.potionsFree, 3, '의료 비축 무료 회복약 3개를 먼저 써야 한다'); assert.ok(med.supplyUsed.potionsSupply <= 2);
  assert.deepEqual(run({ player: weak }).supplyUsed, { potionsFree: 0, potionsSupply: 0, turretRepairs: 0 }, '보급을 안 넘긴 옛 판이 바뀌었다');
  /* 포탑은 지금 배치에선 안 맞는다 — 노림 반경 손잡이를 넓혀 맞게 하고 본다 */
  const hit = run({ player: weak, supply: 12, turretAggro: 1100 }), member = run({ party: [{ name: 'm', guildRole: 'member', dps: 600 }], supply: 12, turretAggro: 1100 });
  assert.ok(hit.supplyUsed.turretRepairs > 0, '포탑 수리를 안 했다'); assert.equal(hit.party[0].ledger.supply, 2 * hit.supplyUsed.turretRepairs, '포탑 수리 공헌 = 보급 2');
  assert.equal(member.supplyUsed.turretRepairs, 0, '권한 없는 길드원이 포탑을 고쳤다');
  /* 서울 제작(용산·구로)이 다 무너지면 수리량이 절반 (HWNodeRules::RegionEffects) — 수리 한 번당 HP 로 잰다 */
  const broken = run({ player: weak, supply: 12, turretAggro: 1100, region: [1, 1, 0] }), per = r => r.turretRepairHp / r.supplyUsed.turretRepairs;
  assert.ok(broken.supplyUsed.turretRepairs > 0 && per(broken) <= per(hit) * 0.55, '제작 0 인데 수리량 ' + Math.round(per(broken)) + ' / ' + Math.round(per(hit)));
});
