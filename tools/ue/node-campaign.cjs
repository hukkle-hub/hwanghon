/* 가상 길드 캠페인 (docs/design/201 §8) — 남산 N-01 을 길드 여럿이 몇 주 동안 지키고 빼앗는다.
   판은 시뮬레이터(node-sim.cjs, 파티·직책)로 돌리고, 결과는 «실제 서버 코드» (server/node-store.cjs, 메모리 저장소)로 보고한다.
   그래서 관리권(지난 주기 공헌)·정책(관리 길드 길드장)·보급(보급대장)·함락 시간·탈환 난이도가 서버 규칙 그대로 돈다.

     node tools/ue/node-campaign.cjs [--weeks 3] [--json .node-sim/campaign.json]

   길드마다 성향이 다르다: 준비형(바리케이드·대피·기술자 명령) / 공격형(센 화력, 준비 없음) / 소규모(셋, 약함).
   매일 저녁 20·21·22시에 한 길드씩 들어간다. 출석은 사람마다 80% (씨앗 고정 난수). */
const fs = require('fs'), path = require('path');
const S = require('./node-sim.cjs'), C = require('./node-combat-rules.cjs'), R = require('../../server/node-rules.cjs');
const { Store } = require('../../server/store.cjs'), NODE = require('../../server/node-store.cjs');
const N_ID = 'namsan_n01', H = NODE.HOUR, W = NODE.WEEK, DAY = 24 * H;

const GUILDS = [
  { name: '황혼단', style: '준비형', hour: 20, prep: { barricades: true, evacuate: true, tech: 'gate' }, wants: ['gate_reinforce', 'scouting', 'medical_stock'],
    members: [['한별', 'leader', 'gate', 1100], ['유나', 'vice', 'gate', 1000], ['도윤', 'combat', 'escort', 1000], ['서리', 'supply', 'rescue', 800], ['민재', 'craft', 'generator', 900], ['하람', 'member', 'escort', 800]] },
  { name: '새벽단', style: '공격형', hour: 21, prep: { barricades: false, evacuate: false, tech: null }, wants: ['arm_npcs', 'reserve_power', 'scouting'],
    members: [['강토', 'leader', 'gate', 1600], ['세린', 'vice', 'gate', 1500], ['루오', 'combat', 'gate', 1400], ['진우', 'supply', 'generator', 1300], ['태오', 'craft', 'gate', 1300], ['비안', 'member', 'gate', 1200]] },
  { name: '잿빛단', style: '소규모', hour: 22, prep: { barricades: true, evacuate: false, tech: null }, wants: ['gate_reinforce', 'arm_npcs', 'scouting'],
    members: [['오름', 'leader', 'gate', 700], ['솔이', 'craft', 'escort', 700], ['은재', 'member', 'rescue', 600]] },
];

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function campaign({ weeks = 3, startPeriod = 200, partyScale = 0, log = () => {} } = {}) {
  const store = new Store(null), N = S.load(N_ID), rand = rng(1234);
  /* 길드와 사람: 실제 계정·길드·직책 (임원 = 부길드장, 대장 셋은 node-store guildAssign) */
  for (const g of GUILDS) {
    g.ids = g.members.map(([name]) => { const p = store.guest(name).profile; store.chooseName(p.id, name, 'ain'); return p.id; });
    store.createGuild(g.ids[0], g.name); const code = store.guild(g.ids[0]).code;
    g.ids.slice(1).forEach(id => store.joinGuild(id, code));
    g.members.forEach(([, role], i) => { if (role === 'vice') store.statement("INSERT INTO guild_roles VALUES(?,?,'officer') ON CONFLICT(player) DO UPDATE SET role='officer'").run(g.ids[i], store.guild(g.ids[0]).id);
      if (['combat', 'supply', 'craft'].includes(role)) store.guildAssign(g.ids[0], g.ids[i], role); });
  }
  const runs = [], weeksOut = [], states = [];
  let lastState = null;
  const t0 = startPeriod * W;
  for (let day = 0; day < weeks * 7; day++) {
    const dayStart = t0 + day * DAY;
    /* 주기 첫날: 관리 길드가 정책을 고르고 보급대장이 보급을 넣는다 (서버가 권한·예산·상한을 검사) */
    if (day % 7 === 0) {
      const v = store.nodeView(N_ID, dayStart + 1);
      const sg = v.steward && GUILDS.find(g => g.name === v.steward.name);
      let policyNote = '없음', supplyNote = 0;
      if (sg) { try { store.nodePolicy(sg.ids[0], N_ID, sg.wants, dayStart + 2); policyNote = sg.wants.join(', '); } catch (e) { policyNote = '거절: ' + e.message; }
        const cap = sg.members.findIndex(m => m[1] === 'supply');
        if (cap >= 0) for (let k = 0; k < 4; k++) { try { store.nodeSupply(sg.ids[cap], N_ID, 3, dayStart + 3 + k); supplyNote += 3; } catch (e) { break; } } }
      const prev = v.period - 1, standings = store.nodeStandings(N_ID, prev, 5);
      weeksOut.push({ week: day / 7 + 1, period: v.period, steward: v.steward ? v.steward.name : null, lastStandings: standings, policies: policyNote, supply: supplyNote });
      log(`\n── ${day / 7 + 1}주차 (주기 ${v.period}) — 관리 길드 ${v.steward ? v.steward.name : '없음'} · 정책 ${policyNote} · 보급 ${supplyNote}`
        + (standings.length ? ` · 지난 주기 순위 ${standings.map((s, i) => (i + 1) + '.' + s.name + ' ' + s.score).join(' ')}` : ''));
    }
    for (const g of GUILDS) {
      const at = dayStart + g.hour * H, v = store.nodeView(N_ID, at, g.ids[0]);
      if (v.state !== lastState) { states.push({ t: (at - t0) / H, state: v.state, tier: v.tier }); lastState = v.state; }
      const kind = v.state === 'retakeable' ? 'retake' : ['stable', 'uneasy', 'alert'].includes(v.state) ? 'defence' : null;
      if (!kind) { runs.push({ day, hour: g.hour, guild: g.name, kind: 'wait', note: v.state + ' · 탈환까지 ' + v.retakeIn.toFixed(1) + '시간' }); log(`  ${day + 1}일 ${g.hour}시 ${g.name}: 기다림 (${v.state}, 탈환까지 ${v.retakeIn.toFixed(1)}시간)`); continue; }
      /* 출석 80%, 최소 둘 */
      let present = g.members.map((m, i) => ({ m, i })).filter(() => rand() < 0.8); if (present.length < 2) present = g.members.slice(0, 2).map((m, i) => ({ m, i }));
      const party = present.map(({ m: [name, guildRole, job, dps] }) => ({ name, guildRole, job, dps, counter: 0.35 }));
      const canBuild = party.some(q => R.hasPermission(q.guildRole, 'invest_facility') || R.hasPermission(q.guildRole, 'allocate_supply'));
      const canOrder = party.some(q => R.hasPermission(q.guildRole, 'order_npc'));
      const supplyPts = v.supply > 0 ? v.supply : (N.supply_default || 6);
      const barricades = g.prep.barricades && canBuild ? ['barricade_west', 'barricade_east'].slice(0, Math.min(2, Math.floor(supplyPts / 3))) : [];
      const difficulty = kind === 'retake' ? v.difficulty : 1, extraElites = kind === 'retake' ? v.extraElites : 0;
      const supplyLeft = supplyPts - barricades.length * C.SUPPLY_COST.barricade;   /* 나머지는 판 안에서: 회복약 1 · 포탑 수리 2 (UE HandleInteract) */
      /* 탈환전엔 시간 제한이 없다 (UE 도 없다) — 900초까지 본다 */
      const r = S.simulate(N, { party, policies: v.policies, barricades, tech: g.prep.tech && canOrder ? g.prep.tech : null, evacuate: g.prep.evacuate && canOrder, difficulty, extraElites, retake: kind === 'retake',
        supply: supplyLeft, partyScale, seed: day * 31 + g.hour, maxTime: 900 });
      /* UE 판엔 시간 제한이 없다: 시뮬이 900초 안에 못 끝낸 판은 결과가 아니라 «막힌 판» 이다 — 보고하지 않고 센다
         (전에는 400초 초과를 함락으로 셌다. 기술자가 무너진 정문을 되살리는 교착이 그렇게 «함락» 으로 숨어 있었다) */
      if (r.result === 'timeout') { runs.push({ day, hour: g.hour, guild: g.name, kind, result: 'timeout', t: r.t, attendees: party.length, errors: [] }); log(`  ${day + 1}일 ${g.hour}시 ${g.name}: 시뮬 시간 초과 (${r.t}초) — 보고 안 함`); continue; }
      const outcome = kind === 'retake' ? (r.result === 'held' ? 'retaken' : 'retake_failed') : (r.result === 'held' ? 'held' : 'fallen');
      /* 파티원 각자 보고 (사람마다 1분 간격, 같은 판 10분 안) */
      const errs = [];
      present.forEach(({ i }, k) => { const q = r.party[k]; try { store.nodeReport(g.ids[i], N_ID, { outcome, contrib: q.ledger }, at + 6 * 60e3 + k * 61e3); } catch (e) { errs.push(q.name + ': ' + e.message); } });
      { const after = store.nodeView(N_ID, at + 15 * 60e3); if (after.state !== lastState) { states.push({ t: (at + 15 * 60e3 - t0) / H, state: after.state, tier: after.tier }); lastState = after.state; } }   /* 판 직후 상태 (밤사이 함락이 띠에 보이게) */
      const captives = Object.values(r.npcs).filter(s => s === 'missing').length;
      runs.push({ day, hour: g.hour, guild: g.name, kind, difficulty, extraElites, supply: supplyLeft, supplyUsed: r.supplyUsed, deaths: r.player ? r.player.deaths : 0, result: outcome, t: r.t, attendees: party.length, barricades: barricades.length, evacuate: g.prep.evacuate && canOrder, policies: v.policies, captives,
        gate: (r.events.find(e => e.id === 'south_gate' && e.to === 'destroyed') || {}).t ?? null, errors: errs });
      log(`  ${day + 1}일 ${g.hour}시 ${g.name}(${party.length}명${kind === 'retake' ? ' · 탈환전 ×' + difficulty + (extraElites ? ' 철갑+' + extraElites : '') : ''}): ${({ held: '막음', fallen: '함락', retaken: '탈환', retake_failed: '탈환 실패' })[outcome]} ${r.t}초 · 포로 ${captives}`
        + (barricades.length ? ' · 바리케이드 ' + barricades.length : '') + ` · 보급 ${supplyLeft}→${r.supplyLeft} (약 ${r.supplyUsed.potionsFree + r.supplyUsed.potionsSupply} · 포탑 ${r.supplyUsed.turretRepairs}) · 쓰러짐 ${r.player ? r.player.deaths : 0}` + (errs.length ? ' · 보고 오류 ' + errs.join('; ') : ''));
    }
  }
  const end = store.nodeView(N_ID, t0 + weeks * 7 * DAY + 1);
  return { partyScale, guilds: GUILDS.map(g => ({ name: g.name, style: g.style, hour: g.hour, members: g.members.length })), runs, weeks: weeksOut, states, end: { steward: end.steward, state: end.state, lastStandings: store.nodeStandings(N_ID, end.period - 1, 5) } };
}

module.exports = { campaign, GUILDS };

if (require.main === module) {
  const a = process.argv.slice(2), get = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const out = campaign({ weeks: +(get('--weeks') || 3), partyScale: +(get('--party-scale') || 0), log: s => console.log(s) });
  const by = {}; for (const r of out.runs) { const b = by[r.guild] = by[r.guild] || { runs: 0, held: 0, fallen: 0, retaken: 0, failed: 0, wait: 0 };
    if (r.kind === 'wait') b.wait++; else { b.runs++; const k = { held: 'held', fallen: 'fallen', retaken: 'retaken', retake_failed: 'failed', timeout: 'timeout' }[r.result]; b[k] = (b[k] || 0) + 1; } }
  console.log('\n── 길드별'); for (const [k, b] of Object.entries(by)) console.log(`  ${k}: 판 ${b.runs} · 막음 ${b.held} · 함락 ${b.fallen} · 탈환 ${b.retaken} · 탈환 실패 ${b.failed} · 기다림 ${b.wait}${b.timeout ? ' · 시간 초과 ' + b.timeout : ''}`);
  console.log(`── 끝: 관리 길드 ${out.end.steward ? out.end.steward.name : '없음'} · 상태 ${out.end.state}`);
  const file = get('--json') || path.join(__dirname, '..', '..', '.node-sim', 'campaign.json');
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(out)); console.log('기록 ' + file);
}
