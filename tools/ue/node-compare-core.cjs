/* UE 판 ↔ 시뮬 판 대조 (docs/design/201 §8) — 두 hwnode-run/1 기록에서 «핵심 순간» 을 뽑아 나란히 놓고 어긋난 것을 짚는다.
   UE 는 보스 단계까지 기록하므로 첫 «막음/함락» 에서 자른다(시뮬은 거기서 끝난다).
   플레이어 실력은 기록에 없어서, 플레이어 피해 몫이 UE 와 가장 가까운 DPS 로 시뮬을 돌린다 (fitDps). */
const S = require('./node-sim.cjs');

function trim(run) {
  const end = run.events.find(e => e.kind === 'state' && (e.to === 'held' || e.to === 'fallen'));
  if (!end) return run;
  return { ...run, result: end.to, t: end.t, events: run.events.filter(e => e.t <= end.t), frames: (run.frames || []).filter(f => f.t <= end.t + 0.5) };
}
const share = run => { const d = run.dealt || {}, all = (d.player || 0) + (d.turret || 0) + (d.guard || 0); return all > 0 ? (d.player || 0) / all : 0; };

/* 핵심 순간: 키 → {t | 값}. 같은 키가 여러 번이면 첫 번 */
function moments(run) {
  const r = trim(run), m = new Map(), first = (k, t) => { if (!m.has(k)) m.set(k, t); };
  for (const e of r.events) {
    if (e.kind === 'wave') first('웨이브 ' + e.id, e.t);
    if (e.kind === 'facility' && e.to === 'destroyed') first(e.id + ' 무너짐', e.t);
    if (e.kind === 'aura') first(e.to === 'on' ? '공진 시작' : '공진 해제', e.t);   /* 공진형 오라 (문서 203 §2) */
    if (e.kind === 'supply') first(e.id === 'potion' ? '첫 회복약' : e.id + ' 수리', e.t);
    if (e.kind === 'npc' && (e.to === 'injured' || e.to === 'missing' || e.to === 'rescued')) first(e.id + ' ' + ({ injured: '부상', missing: '포로', rescued: '구조' })[e.to], e.t);
  }
  const deaths = r.events.filter(e => e.kind === 'player' && e.to === 'dead').length;
  const missing = new Set(r.events.filter(e => e.kind === 'npc' && e.to === 'missing').map(e => e.id)).size;
  return { result: r.result, t: r.t, times: m, deaths, missing, share: share(r), turretShare: (() => { const d = r.dealt || {}, all = (d.player || 0) + (d.turret || 0) + (d.guard || 0); return all > 0 ? (d.turret || 0) / all : 0; })() };
}

/* 어긋남: 한쪽에만 있거나, 시각 차가 15초와 20% 중 큰 것을 넘으면 */
function compare(a, b) {
  const A = moments(a), B = moments(b), keys = [...new Set([...A.times.keys(), ...B.times.keys()])];
  const order = k => (k.startsWith('웨이브') ? 0 : k.includes('무너짐') ? 1 : 2);
  keys.sort((x, y) => order(x) - order(y) || (Math.min(A.times.get(x) ?? 1e9, B.times.get(x) ?? 1e9) - Math.min(A.times.get(y) ?? 1e9, B.times.get(y) ?? 1e9)));
  const rows = keys.map(k => { const ta = A.times.get(k), tb = B.times.get(k);
    const off = ta == null || tb == null || Math.abs(ta - tb) > Math.max(15, 0.2 * Math.max(ta, tb));
    return { key: k, a: ta ?? null, b: tb ?? null, delta: ta != null && tb != null ? +(tb - ta).toFixed(1) : null, off }; });
  const sums = [
    { key: '결과', a: A.result + ' ' + A.t + '초', b: B.result + ' ' + B.t + '초', off: A.result !== B.result },
    { key: 'NPC 포로 (명)', a: A.missing, b: B.missing, off: Math.abs(A.missing - B.missing) >= 2 },
    { key: '플레이어 사망', a: A.deaths, b: B.deaths, off: Math.abs(A.deaths - B.deaths) >= 3 },
    { key: '포탑 피해 몫', a: Math.round(100 * A.turretShare) + '%', b: Math.round(100 * B.turretShare) + '%', off: Math.abs(A.turretShare - B.turretShare) > 0.2 },
  ];
  return { rows, sums, off: rows.filter(r => r.off).length + sums.filter(r => r.off).length };
}

/* UE 기록의 조건으로 시뮬을 돌린다. 플레이어 DPS 는 플레이어 피해 몫이 가장 가까운 값 */
function simFor(ue, N = S.load(ue.node || 'namsan_n01'), dpsList = Array.from({ length: 24 }, (_, i) => 300 + i * 100)) {
  const o = ue.opt || {}, base = { policies: o.policies || [], barricades: o.barricades || [], tech: o.tech || null, evacuate: !!o.evacuate,
    retake: !!o.retake, difficulty: o.difficulty || 1, extraElites: o.extraElites || 0, waveScale: o.waveScale || 1, supply: o.supply, region: o.region, maxTime: o.retake || (o.waveScale || 1) > 1 ? 900 : 400 };   /* waveScale: 길드 작전 (문서 203 §10) */
  const target = share(trim(ue));
  if (!(ue.dealt && ue.dealt.player > 0)) return { run: S.simulate(N, { ...base, player: null }), dps: null };
  let best = null;
  for (const dps of dpsList) { const run = S.simulate(N, { ...base, player: { dps, counter: 0.35 } }), d = Math.abs(share(run) - target);
    if (!best || d < best.d) best = { run, dps, d }; }
  return { run: best.run, dps: best.dps };
}

function table(cmp, la = 'UE', lb = '시뮬') {
  const f = v => v == null ? '—' : typeof v === 'number' ? v + '초' : v;
  const L = ['| 항목 | ' + la + ' | ' + lb + ' | 차이 | |', '|---|---|---|---|---|'];
  for (const r of cmp.sums) L.push('| ' + r.key + ' | ' + r.a + ' | ' + r.b + ' | | ' + (r.off ? '⚠' : '') + ' |');
  for (const r of cmp.rows) L.push('| ' + r.key + ' | ' + f(r.a) + ' | ' + f(r.b) + ' | ' + (r.delta == null ? (r.a == null ? lb + '에만' : la + '에만') : (r.delta > 0 ? '+' : '') + r.delta + '초') + ' | ' + (r.off ? '⚠' : '') + ' |');
  return L.join('\n');
}

module.exports = { trim, moments, compare, simFor, table, share };
