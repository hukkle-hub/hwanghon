/* UE 판 기록(hwnode-run/1) ↔ 시뮬 대조 (docs/design/201 §8).
   언리얼을 여기서 못 돌리니, HWNodeDirector.cpp 의 «판 기록» 형식 문자열을 그대로 읽어 같은 printf 로 기록을 만들고
   (1) JSON 으로 읽히는지 (2) 대조 도구가 받는지 (3) 같은 판은 어긋남 0, 다른 판은 짚는지 본다. UE 쪽 형식이 깨지면 여기서 깨진다. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const K = require('../tools/ue/node-compare-core.cjs'), S = require('../tools/ue/node-sim.cjs'), N = S.load('namsan_n01');
const src = fs.readFileSync(path.join(__dirname, '..', 'ue', 'HwanghonCombatUE', 'Source', 'HwanghonCombatUE', 'Private', 'Node', 'HWNodeDirector.cpp'), 'utf8');
const section = src.slice(src.indexOf('// ---------------------------------------------------------------- run log (hwnode-run/1'));
/* FString::Printf( 뒤에 붙은 TEXT("…") 들을 이어 붙인 형식 문자열, 소스 순서대로 */
const formats = [...section.matchAll(/FString::Printf\(\s*((?:TEXT\("(?:[^"\\]|\\.)*"\)\s*)+)/g)]
  .map(m => [...m[1].matchAll(/TEXT\("((?:[^"\\]|\\.)*)"\)/g)].map(t => t[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')).join(''));
/* 아주 작은 printf: %s %d %c %.Nf */
const printf = (fmt, ...args) => { let i = 0; return fmt.replace(/%(\.\d+)?([sdcf])/g, (_, p, c) => { const v = args[i++]; if (c === 'f') return Number(v).toFixed(p ? +p.slice(1) : 6); if (c === 'd') return String(Math.round(v)); return String(v); }); };

function ueRun(sim, shift = {}) {
  /* 시뮬 판 하나를 UE 가 쓰는 형식 그대로 다시 쓴다 (사건 시각은 shift 로 옮겨 «다른 판» 을 만든다) */
  const [fPol, fBar, fTech, fOpt, fEv, fEnemy, fFac, fNpc, fPlayer, fFrame, fFacDef, fNpcId, fCheck, fJson] = formats;
  const opt = printf(fOpt, (sim.opt.policies || []).map(p => printf(fPol, p)).join(','), (sim.opt.barricades || []).map(b => printf(fBar, b)).join(','),
    sim.opt.tech ? printf(fTech, sim.opt.tech) : 'null', sim.opt.evacuate ? 'true' : 'false', 'leader', sim.opt.supply ?? 0, sim.opt.retake ? 'true' : 'false', sim.opt.difficulty || 1, sim.opt.extraElites || 0, ...(sim.opt.region || [1, 1, 1]));
  const ev = sim.events.filter(e => e.id != null).map(e => { const t = e.t + (shift[e.id + ' ' + e.to] || 0); return printf(fEv, t, e.kind, e.id, e.to, e.kind, e.id, e.to); });
  const frames = sim.frames.map(f => printf(fFrame, f.t, f.power, f.e.map(e => printf(fEnemy, e[0], e[1], e[2], e[3], e[4], e[6] || 0)).join(','),
    f.f.map(x => printf(fFac, x)).join(','), f.n.map(n => printf(fNpc, n[0], n[1], n[2])).join(','), f.p ? printf(fPlayer, f.p[0], f.p[1], f.p[2], f.p[3]) : 'null'));
  const fac = sim.facilities.map(x => printf(fFacDef, x.id, x.kind, ...x.c, ...x.h)).join(',');
  const checks = (sim.tier5 ? sim.tier5.checks : []).map(c => printf(fCheck, c.name, c.pass ? 'true' : 'false')).join(',');
  return printf(fJson, sim.node, sim.result, sim.t, opt, sim.threatGrade || 5, sim.tier5 && sim.tier5.pass ? 'true' : 'false', checks, sim.dealt.player, sim.dealt.turret, sim.dealt.guard || 0, sim.player ? sim.player.deaths : 0,
    fac, sim.npcIds.map(id => printf(fNpcId, id)).join(','), ev.join(','), frames.join(','));
}

test('UE 판 기록: 형식 문자열 14개가 소스에 있고, 그대로 만든 기록이 JSON 으로 읽힌다 (5급 증거·공진 포함)', () => {
  assert.ok(formats.length >= 14, '판 기록 형식 문자열 ' + formats.length + '개');
  const sim = S.simulate(N, { player: { dps: 1000, counter: 0.35 }, barricades: ['barricade_west'] });
  const ue = JSON.parse(ueRun(sim));
  assert.equal(ue.format, 'hwnode-run/1'); assert.equal(ue.source, 'ue');
  assert.deepEqual(ue.opt.barricades, ['barricade_west']); assert.equal(ue.frames.length, sim.frames.length);
  assert.equal(ue.frames[10].e.length, sim.frames[10].e.length);
  /* v04~v06: 등급 5 · PIE 일곱 항목 · 적마다 공진 단계(7번째 칸) */
  assert.equal(ue.threatGrade, 5); assert.equal(ue.tier5.checks.length, 8); assert.deepEqual(ue.tier5.checks, sim.tier5.checks);
  const f = ue.frames.find(fr => fr.e.some(e => e[6] > 0)); assert.ok(f, 'UE 기록에 공진 받은 적이 없다');
});
test('대조: 같은 판은 어긋남 0 · 정문이 60초 늦게 무너진 판은 짚는다 · 조건이 시뮬로 넘어간다', () => {
  const sim = S.simulate(N, { player: { dps: 1000, counter: 0.35 } });
  const same = K.compare(JSON.parse(ueRun(sim)), sim);
  assert.equal(same.off, 0, K.table(same));
  const late = K.compare(JSON.parse(ueRun(sim, { 'south_gate destroyed': 60 })), sim), row = late.rows.find(r => r.key === 'south_gate 무너짐');
  assert.ok(row && row.off && row.delta === -60, K.table(late));
  const ue = JSON.parse(ueRun(S.simulate(N, { player: { dps: 1000, counter: 0.35 }, evacuate: true, policies: ['gate_reinforce'] })));
  const fit = K.simFor(ue, N, [600, 1000, 1600]);
  assert.equal(fit.run.opt.evacuate, true); assert.deepEqual(fit.run.opt.policies, ['gate_reinforce']); assert.equal(fit.dps, 1000, '플레이어 피해 몫으로 DPS 를 맞춘다');
});
test('대조: 탈환전·보급 조건도 시뮬로 넘어가고, 회복약 사건이 핵심 순간에 잡힌다', () => {
  const sim = S.simulate(N, { player: { dps: 1000, counter: 0.35 }, retake: true, difficulty: 1.3, extraElites: 1, supply: 4, maxTime: 900 });
  const ue = JSON.parse(ueRun(sim));
  assert.equal(ue.opt.retake, true); assert.equal(ue.opt.difficulty, 1.3); assert.equal(ue.opt.extraElites, 1); assert.equal(ue.opt.supply, 4);
  const fit = K.simFor(ue, N, [1000]);
  assert.equal(fit.run.opt.retake, true); assert.equal(fit.run.opt.extraElites, 1); assert.equal(fit.run.opt.supply, 4);
  assert.deepEqual(ue.opt.region, [1, 1, 1]); assert.deepEqual(fit.run.opt.region, [1, 1, 1]); assert.equal(fit.run.spawned, sim.spawned);
  assert.ok(sim.supplyUsed.potionsSupply > 0, '회복약을 안 썼다'); const same = K.compare(ue, fit.run);
  assert.ok(same.rows.some(r => r.key === '첫 회복약'), K.table(same)); assert.equal(same.off, 0, K.table(same));
});
