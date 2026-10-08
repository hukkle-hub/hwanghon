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
/* GuildWorld v04 웨이브(5급 6종 36체)부터 솔로 DPS 1000 은 세 시드 모두 무너진다 — 길드 작전용 판이라 «버틸 수 있다» 는 2인 파티로 본다
   (솔로가 버텨야 하는지는 디렉터가 정할 균형, 문서 203 §5) */
const DUO = [{ name: 'A', job: 'gate', guildRole: 'leader', dps: 1000, counter: 0.35 }, { name: 'B', job: 'escort', guildRole: 'combat', dps: 1000, counter: 0.35 }];
test('시뮬: 거점은 혼자 지켜지지 않고(플레이어 없으면 함락), 2인 파티면 버틸 수 있다', () => {
  assert.equal(run({ player: null }).result, 'fallen');
  for (const seed of [7, 11, 23]) assert.equal(S.simulate(N, { party: DUO, seed }).result, 'held', '2인 파티 시드 ' + seed);
});
test('시뮬: 포탑이 실제로 싸운다 — 기본 판 피해의 40% 이상 (사거리가 정문 앞·중앙 대로를 덮는다)', () => {
  const r = run({}), all = r.dealt.player + r.dealt.turret + (r.dealt.guard || 0);
  assert.ok(r.dealt.turret / all >= 0.4, '포탑 피해 ' + Math.round(100 * r.dealt.turret / all) + '%');
});
test('시뮬: 전략이 숫자를 바꾼다 — 정문 강화는 정문을, 바리케이드는 NPC 를 지킨다', () => {
  const base = run({}), gate = run({ policies: ['gate_reinforce'] }), bar = run({ barricades: ['barricade_west', 'barricade_east'] });
  /* v04: W3 파괴형 2 + 보행형이 정문을 두 배 빨리 친다 — 같은 ×1.5 체력이 사는 시간이 20초 → 14.7초로 줄었다. 늦추는지만 본다 */
  assert.ok(at(gate, /south_gate 무너짐/) - at(base, /south_gate 무너짐/) >= 10, '정문 강화가 정문을 10초도 못 늦춘다');
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
  /* 마지막 웨이브(W5, 200초)까지 가야 추가 철갑이 붙는다 — v04 웨이브에선 솔로 탈환이 그 전에 무너져 2인 파티로 본다 */
  const base = run({ party: DUO }), ret = run({ party: DUO, retake: true, difficulty: 1.65, extraElites: 2, maxTime: 900 });
  assert.equal(ret.spawned, base.spawned + 2, '추가 철갑 ' + (ret.spawned - base.spawned));
  assert.equal(ret.opt.retake, true); assert.equal(ret.opt.extraElites, 2);
  const lone = run({ player: null, retake: true, difficulty: 1.3, extraElites: 1 });
  assert.equal(lone.result, 'fallen'); assert.ok(lone.events.some(e => /탈환 실패/.test(e.text)), '탈환 실패 사건이 없다');
});
test('시뮬: 판 안 보급 — 회복약(정책 무료분 먼저)은 쓰러짐을 줄이고, 포탑 수리는 수리·보급 권한자만 보급 2로 한다', () => {
  const weak = { dps: 600, counter: 0.35 }, none = run({ player: weak, supply: 0 }), some = run({ player: weak, supply: 12 });
  /* 성문 앞 전선(문서 203 §9)부터는 회복약으로 오래 버티면 판이 길어져 노출도 는다 — «쓰러짐 횟수» 는 지표가 아니다.
     첫 쓰러짐이 늦어지고, 쓰러지기까지 맞는 횟수가 는다로 본다 */
  const firstDown = r => (r.events.find(e => e.kind === 'player') || { t: Infinity }).t, perDeath = r => r.player.hitsTaken / Math.max(1, r.player.deaths);
  assert.ok(firstDown(some) > firstDown(none) + 30, '보급 12 인데 첫 쓰러짐이 ' + firstDown(none) + ' → ' + firstDown(some));
  assert.ok(perDeath(some) > perDeath(none) * 1.3, '쓰러짐당 맞은 횟수 ' + perDeath(none).toFixed(1) + ' → ' + perDeath(some).toFixed(1));
  assert.ok(some.supplyUsed.potionsSupply > 0 && some.supplyLeft === 12 - some.supplyUsed.potionsSupply, JSON.stringify(some.supplyUsed));
  const med = run({ player: weak, supply: 2, policies: ['medical_stock'] });
  assert.equal(med.supplyUsed.potionsFree, 3, '의료 비축 무료 회복약 3개를 먼저 써야 한다'); assert.ok(med.supplyUsed.potionsSupply <= 2);
  assert.deepEqual(run({ player: weak }).supplyUsed, { potionsFree: 0, potionsSupply: 0, turretRepairs: 0 }, '보급을 안 넘긴 옛 판이 바뀌었다');
  /* 포탑은 지금 배치에선 안 맞는다 — 노림 반경 손잡이를 넓혀 맞게 하고 본다. v04 웨이브에선 1100 이면 포탑이 245초에야 반이 깎여
     그 전에 회복약이 보급 12를 다 쓴다 → 1500 (234초에 반, 보급이 남아 있다).
     성문 앞 전선(문서 203 §9)에선 적이 플레이어와 싸우느라 포탑이 거의 안 맞는다 — 수리 «규칙» 은 전선과 상관없으니 옛 벽 정문(wallGate)으로 본다 */
  const hit = run({ player: weak, supply: 12, turretAggro: 1500, wallGate: true }), member = run({ party: [{ name: 'm', guildRole: 'member', dps: 600 }], supply: 12, turretAggro: 1500, wallGate: true });
  assert.ok(hit.supplyUsed.turretRepairs > 0, '포탑 수리를 안 했다'); assert.equal(hit.party[0].ledger.supply, 2 * hit.supplyUsed.turretRepairs, '포탑 수리 공헌 = 보급 2');
  assert.equal(member.supplyUsed.turretRepairs, 0, '권한 없는 길드원이 포탑을 고쳤다');
  /* 서울 제작(용산·구로)이 다 무너지면 수리량이 절반 (HWNodeRules::RegionEffects) — 수리 한 번당 HP 로 잰다 */
  const broken = run({ player: weak, supply: 12, turretAggro: 1500, wallGate: true, region: [1, 1, 0] }), per = r => r.turretRepairHp / r.supplyUsed.turretRepairs;
  assert.ok(broken.supplyUsed.turretRepairs > 0 && per(broken) <= per(hit) * 0.55, '제작 0 인데 수리량 ' + Math.round(per(broken)) + ' / ' + Math.round(per(hit)));
});
/* GuildWorld v04~v06: 5급 6종 — PIE 판정(N01_PIE_Scenario_v06.json pass_conditions)을 시뮬에서 먼저 */
test('시뮬: 5급 6종 PIE 증명 — 여섯 역할·전부 5급·파괴→발전기·추적→NPC·철갑→정문·공진 걸림/풀림·정문 앞 전투 (2인, 기술자 없이)', () => {
  for (const seed of [7, 11, 23]) {
    const r = S.simulate(N, { party: DUO, seed });
    assert.equal(r.threatGrade, 5);
    for (const c of r.tier5.checks) assert.ok(c.pass, '시드 ' + seed + ': FAIL ' + c.name);
    assert.ok(r.events.some(e => e.kind === 'aura' && e.to === 'on') && r.events.some(e => e.kind === 'aura' && e.to === 'off'), '공진 사건이 없다');
  }
  /* 옛 «모두 막는 벽» 정문: 플레이어가 안에 갇혀 정문 앞 전투가 없고, 정문이 W3 에 무너져 철갑이 정문을 볼 일도 없다 — 판정이 FAIL 로 짚어야 한다 (거짓 PASS 금지) */
  const wall = S.simulate(N, { party: DUO, wallGate: true });
  assert.equal(wall.tier5.checks.find(c => /Armored/.test(c.name)).pass, false);
  assert.equal(wall.tier5.checks.find(c => /MainGate/.test(c.name)).pass, false);
});
test('시뮬: 공진은 0.4초마다 다시 재고, 공진형이 죽으면 곁의 적 이동이 ×1.1 → ×1 로 돌아온다', () => {
  const r = S.simulate(N, { party: DUO, debug: true }), res = r._enemies.find(e => e.role === 'resonator');
  assert.ok(res && res.dead, '공진형이 안 죽었다'); 
  /* 공진형이 죽은 뒤 첫 프레임(1초 간격)에는 누구도 공진 받지 않는다 */
  const after = r.frames.find(f => f.t >= res.diedAt + 0.5);
  assert.ok(after && after.e.every(e => e[6] === 0), '공진형이 죽었는데 공진이 남았다 ' + JSON.stringify(after && after.e.filter(e => e[6])));
  const before = r.frames.filter(f => f.t < res.diedAt).some(f => f.e.some(e => e[6] === 1 && e[2] !== 5));
  assert.ok(before, '공진형이 살아 있을 때 공진 받은 적이 없다');
});
/* GuildWorld v07 + 디렉터 결정 A (문서 203 §9): 정문은 아군을 통과시키고 적만 막는다 — 인원이 정문 수명을 바꾼다 */
test('시뮬: 성문 앞 전선 — 플레이어가 정문 밖에서 싸우고, 인원이 많을수록 정문이 오래 서며, 무너지면 방어선이 광장으로 물러난다', () => {
  const gateDown = r => (r.events.find(e => e.kind === 'facility' && e.id === 'south_gate') || { t: Infinity }).t;
  const none = run({ player: null }), solo = run({}), duo = S.simulate(N, { party: DUO }), wall = S.simulate(N, { party: DUO, wallGate: true });
  assert.ok(gateDown(solo) > gateDown(none) + 30, '솔로가 정문을 30초도 못 늘린다 ' + gateDown(none) + ' → ' + gateDown(solo));
  assert.ok(gateDown(duo) >= gateDown(solo), '2인이 솔로보다 정문을 빨리 잃는다');
  assert.ok(gateDown(wall) < gateDown(duo), '벽 정문인데 정문이 더 오래 선다 — 통과가 안 먹혔다');
  /* 정문이 무너진 판: v07 대로 방어선 사건이 남는다 */
  assert.ok(solo.events.some(e => e.kind === 'line' && e.id === 'central_plaza'), '정문이 무너졌는데 방어선이 광장으로 안 물러났다');
  assert.equal(none.line, 'comms_final', '발전기까지 무너진 판의 마지막 방어선');
});
