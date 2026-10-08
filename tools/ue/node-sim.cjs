/* 거점 방어전 시뮬레이터 (docs/design/201 §8) — 언리얼 없이 «한 판» 을 돌려 본다.
   같은 맵(Content/Data/node_<id>.json, tools/ue/node-graybox.js 의 상자)과 같은 규칙(node-combat-rules.cjs ↔ HWNodeRules.h,
   벡터로 대조)을 쓰고, 적·포탑·NPC 의 판단은 AHWNodeEnemy / AHWNodeDirector 를 줄 단위로 옮겼다:
     - 적: 0.4초마다 Think (ChooseTarget → BlockedByGate → 길 위 바리케이드 → 380 안의 포탑), 예비 동작 → 타격 → 회복 0.35초
     - 이동: AddMovementInput 처럼 목표점으로 곧장 (내비메시 없음) — 벽·시설 상자에 막히면 미끄러지고, 못 가면 «막힘» 으로 센다
     - 포탑: 발전기 전력(예비 전력 포함) × 320/s, 15 m, 0.25초마다 한 방 · 무장 경비 150/s 12 m
   다른 점(정직하게): 적끼리 밀치지 않는다, 가속 없음, 플레이어는 단순한 자동 조종(아래 PLAYER)이다.
   플레이어 DPS 는 UE 코드에서 값을 못 찾아(애셋에 있다) 인자로 받아 범위로 잰다.

     node tools/ue/node-sim.cjs                       # 기본 판 몇 가지를 표로
     node tools/ue/node-sim.cjs --json out.json ...   # 한 판의 프레임 기록 (tools/ue/node-sim.html 이 그린다) */
const fs = require('fs'), path = require('path');
const H = require('./node-graybox.js'), GR = require('./node-graph.js'), C = require('./node-combat-rules.cjs'), R = require('../../server/node-rules.cjs');
const DATA = path.join(__dirname, '..', '..', 'ue', 'HwanghonCombatUE', 'Content', 'Data');
const load = id => JSON.parse(fs.readFileSync(path.join(DATA, 'node_' + id + '.json'), 'utf8'));

/* 결정적 난수 (반격 성공 여부) */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const PLAYER = { health: 24450, speed: 600, reach: 220, respawn: 5 };
const WINDUP = { runner: 0.35, breaker: 0.7, armored_elite: 0.8 }, windupFor = r => WINDUP[r] ?? 0.45;
const CAPSULE_HALF = 88, BODY_R = 40, DIRECT = 1500;   // DirectApproachCm

function simulate(N, o = {}) {
  const opt = { policies: [], barricades: [], tech: null, player: { dps: 1000, counter: 0.35 }, dt: 0.1, maxTime: 400, frameEvery: 1, seed: 7, ...o };
  const rand = rng(opt.seed), pe = R.policyEffects(opt.policies), bs = H.blocks(N);
  const diff = Math.max(0.1, opt.difficulty || 1);   // 탈환전 난이도 (AHWNodeEnemy::Configure 의 Difficulty — 체력·피해 배율)
  const extraElites = Math.max(0, opt.extraElites | 0);   // 탈환전: 마지막 웨이브에 붙는 철갑 (HWNodeRules::OccupationExtraElites)
  /* 보급 (판 시작 때 남은 점수 — UE 기록 opt.supply 와 같은 뜻, 바리케이드는 이미 뺀 값). 없으면(undefined) 보급을 안 쓰는 옛 판 */
  const useSupply = opt.supply != null; let supply = useSupply ? Math.max(0, opt.supply | 0) : 0, freePotions = useSupply ? pe.extraPotions : 0;
  const supplyUsed = { potionsFree: 0, potionsSupply: 0, turretRepairs: 0 }, repairedTurretHp = { v: 0 };
  /* 서울 망 (?HWRegion= 물류·정찰·제작, 문서 202 §2.5): 판 안에선 제작 → 포탑 수리량만 (준비 시간은 시뮬이 침공부터 재고, 보급 상한은 서버가 배정에서 건다) */
  const region = Array.isArray(opt.region) ? opt.region : [1, 1, 1], rfx = R.regionEffects(...region);
  const partyN = (opt.party || (opt.player ? [1] : [])).length, hpScale = 1 + (opt.partyScale || 0) * Math.max(0, partyN - 1);   // 인원 보정 (문서 201 §8 — 값은 캠페인으로 고른다)
  const walls = bs.filter(b => b.kind === 'wall').map(b => ({ c: b.center, h: b.half, wkind: b.wkind }));
  const P = v => H.pt(N, v);
  const events = [], frames = [], log = (t, kind, text, id = null, to = null) => events.push({ t: +t.toFixed(1), kind, id, to, text });   /* id·to: UE 기록(hwnode-run/1)과 견주는 구조 필드 */

  /* ── 시설 (AHWNodeFacility: 위치 = 바닥 + 반높이) ── */
  const fac = [];
  for (const f of N.facilities) { let max = f.hp;
    if (f.kind === 'gate') max *= pe.gateHealthScale;
    if (f.kind === 'generator' || f.kind === 'turret') max *= pe.generatorHealthScale;
    const a = P(f.at); fac.push({ id: f.id, kind: f.kind, c: [a[0], a[1], a[2] + f.half[2]], h: f.half, max, hp: max, acc: 0 }); }
  for (const s of N.barricade_slots || []) if (opt.barricades.includes(s.id))
    fac.push({ id: s.id, kind: 'barricade', c: [s.at[0], s.at[1], s.at[2] + s.half[2]], h: s.half, max: s.hp, hp: s.hp });
  const facility = k => fac.find(f => f.kind === k);
  const standing = f => f && f.hp > 0;
  const surf = (f, p) => Math.hypot(Math.max(0, Math.abs(p[0] - f.c[0]) - f.h[0]), Math.max(0, Math.abs(p[1] - f.c[1]) - f.h[1]));
  const solidFac = f => !(f.hp <= 0 && (f.kind === 'gate' || f.kind === 'barricade'));   // 무너진 정문·바리케이드만 지나간다
  const gate = facility('gate'), gateY = gate ? gate.c[1] : -1e9;

  /* ── 땅과 벽 ── */
  const floorAt = (x, y, z) => H.floorAt(bs, x, y, z), standAt = (x, y, foot) => H.standAt(bs, x, y, foot);   /* 걸음은 standAt (올라설 수 있는 가장 높은 면) */
  /* passGate: 정문은 아군(플레이어)을 통과시키고 적만 막는다 — 성문 앞 전선 (문서 203 §9). opt.wallGate 면 옛 «모두 막는 벽» */
  function inSolid(x, y, footZ, passGate = false) {
    const z0 = footZ + 10, z1 = footZ + 2 * CAPSULE_HALF - 10;
    for (const w of walls) if (Math.abs(x - w.c[0]) < w.h[0] + BODY_R && Math.abs(y - w.c[1]) < w.h[1] + BODY_R && z1 > w.c[2] - w.h[2] && z0 < w.c[2] + w.h[2]) return true;
    for (const f of fac) if (solidFac(f) && !(passGate && f.kind === 'gate') && Math.abs(x - f.c[0]) < f.h[0] + BODY_R && Math.abs(y - f.c[1]) < f.h[1] + BODY_R && z1 > f.c[2] - f.h[2] && z0 < f.c[2] + f.h[2]) return true;
    return false;
  }
  /* 한 걸음: 막히면 x·y 따로 미끄러진다. 발 높이(foot)를 들고 다닌다. 턱 45 cm 이상·땅 없음 = 막힘 */
  function step(body, dir, dist) {
    const tryAt = (dx, dy) => { const x = body.p[0] + dx, y = body.p[1] + dy, fz = standAt(x, y, body.foot);
      if (fz == null || fz - body.foot > 45 || inSolid(x, y, fz, !!body.passGate)) return false; body.p = [x, y, fz + CAPSULE_HALF]; body.foot = fz; return true; };
    const dx = dir[0] * dist, dy = dir[1] * dist;
    if (tryAt(dx, dy)) return true;
    if (Math.abs(dx) > 1e-3 && tryAt(dx, 0)) return true;
    if (Math.abs(dy) > 1e-3 && tryAt(0, dy)) return true;
    return false;
  }
  const dirTo = (from, to) => { const x = to[0] - from[0], y = to[1] - from[1], l = Math.hypot(x, y); return l < 1e-6 ? [0, 0] : [x / l, y / l]; };
  const place = (p) => { const fz = floorAt(p[0], p[1], p[2]); return { p: [p[0], p[1], (fz ?? p[2]) + CAPSULE_HALF], foot: fz ?? p[2] }; };

  /* ── NPC ── */
  const npcs = N.npcs.map(d => { const b = place(P(d.at)); return { id: d.id, role: d.role, route: d.route, home: P(d.at), ...b,
    life: C.npcLife(C.npcMaxHealth(d.role, pe.npcsArmed)), order: null }; });
  const npcStates = () => Object.fromEntries(npcs.map(n => [n.role, n.life.state]));
  const nearestNpc = from => { let best = null, bd = Infinity; for (const n of npcs) if (n.life.targetable()) { const d = d2(from, n.p); if (d < bd) { bd = d; best = n; } } return best; };
  /* 적이 노리는 NPC (AHWNodeDirector::PreferredNpc · HWNodeRules::NpcPickScore): 추적형은 기술자·의무관을 무겁게 */
  const npcFor = (from, role) => { if (role !== 'stalker') return nearestNpc(from); let best = null, bs = -Infinity;
    for (const n of npcs) if (n.life.targetable()) { const sc = C.npcPickScore(role, n.role, d2(from, n.p)); if (sc > bs) { bs = sc; best = n; } } return best; };
  const fx = () => C.npcEffects(npcStates(), pe);
  /* 기술자 명령 (PathFromTechnicianTo) */
  if (opt.tech) { const tech = npcs.find(n => n.role === 'technician'), main = N.routes.main.map(P), path = [...N.routes[tech.route].map(P)].reverse();
    if (main.length) path.push(main[main.length - 1]);
    if (opt.tech === 'generator') path.push(...N.routes.generator.map(P)); else if (opt.tech === 'comms') path.push(...N.routes.comms.map(P));
    else { for (let i = main.length - 1; i >= 1; i--) path.push(main[i]);
      const gt = fac.find(f => f.kind === 'gate'); if (gt) path.push([gt.c[0], gt.c[1] + gt.h[1] + 80, path[path.length - 1][2]]); }   /* 정문 안쪽 면까지 (수리 사거리 220) */
    tech.order = { kind: opt.tech, path, i: 0 }; }
  /* 대피 명령: 경비·기술자만 빼고 대피 자리로 (자리마다 조금씩 비켜 선다). 대가 — 의무실·정찰탑·통신센터의 기능 (시뮬엔 플레이어 회복·예보가 없어 «안전» 쪽만 잰다) */
  if (opt.evacuate && N.shelter_point) npcs.filter(n => n.role !== 'guard' && n.role !== 'technician').forEach((n, i) => { const c = P(N.shelter_point); n.evac = [c[0] + (i - 1.5) * 220, c[1] + 150, c[2]]; });

  /* ── 플레이어 (파티) ── opt.party = [{ name, job, guildRole, dps, counter }] · opt.player 는 혼자 하는 판(정문 수비)
     job: gate(정문·시설을 치는 적) · escort(NPC 를 노리는 적) · rescue(포로 구조 먼저) · generator(발전기·통신)
     guildRole: leader·vice·combat·supply·craft·member — 핑(지휘)·바리케이드(보급)·기술자 수리(수리) 공헌이 직책을 따른다 */
  const party = opt.party || (opt.player ? [{ name: 'player', job: 'gate', guildRole: 'leader', ...opt.player }] : []);
  const blankLedger = () => Object.fromEntries(R.CATEGORIES.map(c => [c, 0]));
  const pls = party.map((q, i) => { const sp = P(N.player_start), b = place(party.length > 1 ? [sp[0] + (i % 4 - 1.5) * 160, sp[1] - Math.floor(i / 4) * 160, sp[2]] : sp);   /* 혼자면 출발점 그대로 */
    return { ...q, job: q.job || 'gate', guildRole: q.guildRole || 'member', counter: q.counter ?? 0.35, ...b, hp: PLAYER.health, deadFor: -1, deaths: 0, acc: 0, target: null, think: i * 0.05,
      kills: 0, rescues: 0, counters: 0, hitsTaken: 0, dealt: 0, ledger: blankLedger(), lastPing: -99, passGate: !opt.wallGate }; });
  const pl = pls[0] || null;
  const alive = q => q && q.deadFor < 0;
  const playerAlive = () => pls.some(alive);
  const nearestPlayer = from => { let best = null, bd = Infinity; for (const q of pls) if (alive(q)) { const d = d2(from, q.p); if (d < bd) { bd = d; best = q; } } return best; };
  const can = (q, perm) => R.hasPermission(q.guildRole, perm);
  const pings = [];
  /* 준비 단계의 공헌 (UE 감독과 같은 셈): 바리케이드 = 지은 사람 보급 +3, 기술자 명령 = 명령한 사람의 수리 */
  const builder = pls.find(q => can(q, 'invest_facility') || can(q, 'allocate_supply')), orderer = pls.find(q => can(q, 'order_npc'));
  if (builder) builder.ledger.supply += 3 * opt.barricades.length;

  /* ── 적 ── */
  const enemies = []; let serial = 0; const proof = C.tier5Evidence();   /* v06 PIE 판정과 같은 증거 */
  const waves = C.waveRunner(), m = R.machine({ commsHoldToFall: N.comms_hold_to_fall || 20 }); m.state = opt.retake ? 'retaking' : 'invasion';
  let reserveLeft = 0, reserveUsed = false;
  function spawn(role) { const s = serial++, rr = N.role_routes[role], name = Array.isArray(rr) ? rr[s % rr.length] : rr || 'main', route = (N.routes[name] || []).map(P);
    /* 측면 길: 길 입구 «뒤» 150 에서 60 만 흩는다 (AHWNodeDirector::SpawnEnemy) — 입구에서 160 을 흩으면 길섶으로 떨어진 질주형이
       경사로 옆면(발판보다 64 높다, 턱 45 초과)에 붙어 못 올라갔다 (W5 의 32번) */
    const own = C.goesRoundTheFlank(role) && route.length, ang = s * 2.39996;   /* 질주형·추적형은 측면 길 입구에서 */
    const back = own && route.length > 1 ? dirTo(route[1], route[0]) : [0, 0], base = own ? [route[0][0] + back[0] * 150, route[0][1] + back[1] * 150, route[0][2]] : P(N.spawns[s % N.spawns.length]);
    const sc = own ? 60 : 160, st = C.roleStats(role), b = place([base[0] + Math.cos(ang) * sc, base[1] + Math.sin(ang) * sc, base[2]]);
    enemies.push({ id: s, role, st, ...b, hp: st.health * diff * hpScale, max: st.health * diff * hpScale, route, ri: 0, ext: [], ei: 0, tk: 'none', ov: null, phase: 'move', left: 0, cd: 0, think: 0,
      own: !!own, flanked: false, armor: C.eliteArmor(), dead: false, byPlayer: false, stuck: 0, lastP: [...b.p], res: 0, blow: 0, attack: null, grade: C.THREAT_GRADE, archetype: C.ARCHETYPE[role] });
    proof.noteSpawn(role, C.THREAT_GRADE); }
  /* 공진형이 서 있을 자리: 3000 안의 무리(공진형 제외) 중심, 없으면 가장 가까운 무리 하나 — 그 뒤 350 (HWNodeRules::ResonatorHoldPoint) */
  function packOf(e) { let n = 0, sx = 0, sy = 0, near = null, nd = Infinity; const gs = standing(gate);
    for (const x of enemies) { if (x.dead || x === e || x.role === 'resonator') continue;
      if (gs && (e.p[1] < gateY) !== (x.p[1] < gateY)) continue;   /* 서 있는 정문 건너편(측면을 돈 질주형)은 무리가 아니다 — 끌려가 정문을 쳤다 (코드 리뷰) */ const d = d2(e.p, x.p); if (d < nd) { nd = d; near = x; } if (d <= C.RESONATOR_PACK_RADIUS) { n++; sx += x.p[0]; sy += x.p[1]; } }
    return n ? [sx / n, sy / n] : near ? [near.p[0], near.p[1]] : null; }
  function holdPoint(e) { const c = packOf(e); if (!c) return null; const h = C.resonatorHoldPoint(e.p, c); return [h[0], h[1], e.p[2]]; }
  const view = (from, flanked, e) => ({ player: (q => q ? d2(from, q.p) : -1)(nearestPlayer(from)),
    gate: standing(gate) ? surf(gate, from) : -1, generator: standing(facility('generator')) ? surf(facility('generator'), from) : -1,
    comms: standing(facility('comms')) ? surf(facility('comms'), from) : -1, npc: (n => n ? d2(from, n.p) : -1)(npcFor(from, e && e.role)),
    ally: e && e.role === 'resonator' ? (h => h ? d2(from, h) : -1)(holdPoint(e)) : -1, flanked });
  function targetPoint(k, from, e) {
    if (k === 'player') { const q = nearestPlayer(from); return q ? q.p : from; }
    if (k === 'npc') { const n = npcFor(from, e && e.role); return n ? n.p : from; }
    if (k === 'ally') { const h = e && holdPoint(e); return h || from; }
    const f = facility(k); if (f) return [Math.max(f.c[0] - f.h[0], Math.min(f.c[0] + f.h[0], from[0])), Math.max(f.c[1] - f.h[1], Math.min(f.c[1] + f.h[1], from[1])), from[2]];
    return from; }
  /* AHWNodeDirector::ExtensionFor — 목표의 길 끝까지 길 그래프의 최단 경로 (UHWNodeConfig::PathBetween) */
  const graph = GR.build(N);
  function extensionFor(k, from, role) {
    if (k === 'npc') { const n = npcFor(from, role); if (!n) return []; const p = GR.path(graph, from, n.p); return p.length ? p : (N.routes[n.route] || []).map(P); }   // NPC 는 지금 자리로
    const name = k === 'generator' ? 'generator' : k === 'comms' ? 'comms' : null;
    const r = name && N.routes[name] ? N.routes[name].map(P) : []; if (!r.length) return [];
    const p = GR.path(graph, from, r[r.length - 1]); return p.length ? p : r; }
  const segHits = (a, b, f) => { for (let k = 0; k <= 40; k++) { const p = lerp(a, b, k / 40); if (Math.abs(p[0] - f.c[0]) <= f.h[0] + 40 && Math.abs(p[1] - f.c[1]) <= f.h[1] + 40 && Math.abs(p[2] - f.c[2]) <= f.h[2] + 200) return true; } return false; };
  const barricadeOnPath = (a, b) => fac.find(f => f.kind === 'barricade' && standing(f) && segHits(a, b, f)) || null;
  const turretNear = (at, r) => fac.find(f => f.kind === 'turret' && standing(f) && surf(f, at) <= r) || null;
  const reach = (e, k) => k === 'player' ? (e.role === 'armored_elite' ? 230 : 170) : k === 'npc' ? 160 : (k === 'gate' || k === 'generator' || k === 'comms') ? 140 : k === 'ally' ? 80 : 0;
  const direct = e => (e.tk === 'player' || e.tk === 'gate' || e.tk === 'ally') && d2(e.p, targetPoint(e.tk, e.p, e)) <= DIRECT;   // IsDirectApproach
  const hasWaypoint = e => !direct(e) && (e.ri < e.route.length || e.ei < e.ext.length);
  function goal(e) { if (direct(e)) return targetPoint(e.tk, e.p, e);
    if (e.ri < e.route.length) return e.route[e.ri]; if (e.ei < e.ext.length) return e.ext[e.ei];
    return e.tk === 'none' ? e.p : targetPoint(e.tk, e.p, e); }

  const facHits = {};   /* 시설이 누구에게 얼마나 맞았나 (정문을 누가 부수나 — 문서 203 §9) */
  function damageFacility(f, amount, t, by) { if (!standing(f)) return; if (by) { const k = f.kind + ':' + by; facHits[k] = (facHits[k] || 0) + Math.min(amount, f.hp); } f.hp -= amount;
    if (f.hp <= 0) { f.hp = 0; log(t, 'facility', f.id + ' 무너짐', f.id, 'destroyed');
      if (f.kind === 'generator' && !reserveUsed) { reserveLeft = pe.reservePowerSeconds; reserveUsed = true; } } }
  const dealt = { player: 0, turret: 0, guard: 0 };
  /* 처치 공헌 (AHWNodeDirector::ReportKill): 처치 가중 · 공격 중이던 적이면 방어 · 핑 15초·8 m 안이면 핑 찍은 사람의 지휘 */
  function creditKill(q, e, t) {
    const w = C.killWeight(e.role); q.ledger.kill += w; q.kills++;
    /* 방어 = 거점을 공격하던 적(시설·바리케이드·포탑·NPC)을 막음 — 어디서 잡든 (UE ReportKill bWasAttacking) */
    const attacking = !!e.ov || ['gate', 'generator', 'comms', 'npc'].includes(e.tk);
    q.ledger.defense += C.defenseCredit(e.role, attacking ? 0 : -1);
    const pg = pings.find(g => C.pingCredits(t - g.t, d2(e.p, g.at))); if (pg) pg.by.ledger.command += 1;
  }
  function hurtEnemy(e, amount, byPlayer, t, who = byPlayer ? 'player' : e.killer, by = null) { if (e.dead) return;
    if (byPlayer) proof.noteDefenderHit(e.p[1], gateY, standing(gate));   /* v07: 정문 앞 전투 */ e.byPlayer = byPlayer; const d = Math.min(e.hp, amount * e.armor.damageScale(e.st.armorScale)); dealt[who] = (dealt[who] || 0) + d; e.hp -= d; if (by) by.dealt += d;
    if (e.hp <= 0) { e.dead = true; e.hp = 0; e.diedAt = t; if (byPlayer && by) creditKill(by, e, t); e.killer = byPlayer ? 'player' : e.killer || 'node'; waves.enemyDied(waves.clock); } }
  function npcHurt(n, amount, t) { const before = n.life.state; if (!n.life.applyDamage(amount)) return;
    log(t, 'npc', n.role + ' ' + before + ' → ' + n.life.state, n.role, n.life.state);
    if (n.life.state === 'missing') { n.order = null; Object.assign(n, place(P(N.holding_spot))); } }

  function think(e) {
    if (C.goesRoundTheFlank(e.role) && !e.flanked && e.p[1] > gateY + 200) e.flanked = true;
    const v = view(e.p, e.flanked, e); let next = C.chooseTarget(e.role, v);
    if (next !== e.raw) { e.raw = next; proof.noteTarget(e.role, next); }   /* 판정은 정문 차단 «전» 의 판단 (selects) — UE 와 같이 */
    if (next !== 'none' && next !== 'gate') { const g = targetPoint(next, e.p, e);
      if (C.blockedByGate(e.p[1], g[1], gateY, standing(gate), e.role, e.flanked)) next = 'gate'; }
    if (next !== e.tk) { e.tk = next; e.ext = extensionFor(next, e.ri < e.route.length ? e.route[e.route.length - 1] : e.p, e.role); e.ei = 0; }
    else if (e.tk !== 'none' && e.ri >= e.route.length && e.ei >= e.ext.length && d2(e.p, targetPoint(e.tk, e.p, e)) > DIRECT) { e.ext = extensionFor(e.tk, e.p, e.role); e.ei = 0; }
    e.ov = null;
    if (e.tk !== 'player') e.ov = barricadeOnPath(e.p, goal(e));
    if (!e.ov && (e.role === 'normal' || e.role === 'armored_elite') && (v.player < 0 || v.player > 600)) e.ov = turretNear(e.p, opt.turretAggro ?? 380);   /* UE AHWNodeEnemy::Think 380 — 손잡이 (지금 배치에선 포탑이 한 번도 안 맞는다, 문서 201 §8) */
  }
  function strike(e, t) {
    e.cd = e.st.attackCooldown;
    const atk = C.resonanceAttack(e.res), blow = e.attack; e.attack = null; if (e.role === 'armored_elite') e.blow++;   /* 공진: 공격 ×1.12 · 철갑: 다음 공격으로 */
    if (e.ov) { if (standing(e.ov) && surf(e.ov, e.p) <= 200) damageFacility(e.ov, e.st.facilityDamage * diff * atk, t, e.role); return; }
    if (e.tk === 'player') { const q = nearestPlayer(e.p); if (!q || d2(e.p, q.p) > reach(e, 'player') + 60) return;
      /* 철갑 내려찍기는 카운터가 안 된다 — 같은 손 실력(counter)으로 피한다고 친다 */
      if (blow && !C.counterAllowed(blow)) { if (rand() < q.counter) { q.dodges = (q.dodges || 0) + 1; return; } }
      else if (rand() < q.counter) { const perfect = rand() < 0.4, g = perfect ? 'perfect' : 'normal';
        e.armor.onCountered(blow ? C.armoredCrackGrade(blow, g) : g); e.phase = 'stagger'; e.left = blow ? C.armoredStaggerSeconds(blow, g) : e.role === 'armored_elite' ? 1.4 : 1.0; q.counters++; return; }
      q.hp -= e.st.damage * diff * atk; q.hitsTaken++; if (q.hp <= 0) { q.hp = 0; q.deadFor = 0; q.deaths++; log(t, 'player', (pls.length > 1 ? q.name + ' ' : '플레이어 ') + '쓰러짐', pls.length > 1 ? q.name : 'player', 'dead'); } return; }
    if (e.tk === 'npc') { const n = npcFor(e.p, e.role); if (n && d2(e.p, n.p) <= reach(e, 'npc') + 60) npcHurt(n, e.st.damage * atk, t); return; }
    if (e.tk === 'ally') return;
    const f = facility(e.tk); if (f && surf(f, e.p) <= reach(e, e.tk) + 60) damageFacility(f, e.st.facilityDamage * diff * atk, t, e.role);
  }
  function tickEnemy(e, dt, t) {
    e.armor.tick(dt); e.cd = Math.max(0, e.cd - dt);
    if (e.phase !== 'move') { e.attackT = t; e.left -= dt; if (e.left > 0) return;
      if (e.phase === 'windup') { strike(e, t); if (e.phase === 'windup') { e.phase = 'recover'; e.left = 0.35; } return; }
      e.phase = 'move'; }
    e.think -= dt; if (e.think <= 0) { think(e); e.think = C.thinkSeconds(e.role); }
    const windup = () => { if (e.cd <= 0) { e.phase = 'windup';
      if (e.role === 'armored_elite') { e.attack = C.armoredAttackAt(e.blow); e.left = C.armoredWindupSeconds(e.attack); } else e.left = windupFor(e.role); } };
    if (e.ov) { if (!standing(e.ov)) e.ov = null; else { if (surf(e.ov, e.p) <= 140) { windup(); e.attackT = t; return; }
      const f = e.ov, face = [Math.max(f.c[0] - f.h[0], Math.min(f.c[0] + f.h[0], e.p[0])), Math.max(f.c[1] - f.h[1], Math.min(f.c[1] + f.h[1], e.p[1]))];
      step(e, dirTo(e.p, face), e.st.speed * C.resonanceMove(e.res) * dt); return; } }
    if (e.tk !== 'none') { const f = (e.tk === 'gate' || e.tk === 'generator' || e.tk === 'comms') ? facility(e.tk) : null;
      const dist = f ? surf(f, e.p) : d2(e.p, targetPoint(e.tk, e.p, e));
      if (dist <= reach(e, e.tk)) { if (e.tk === 'ally') { e.attackT = t; return; } windup(); e.attackT = t; return; } }   /* 공진형: 무리 뒤 자리에 섰다 — 친 게 아니라 «머문다» (막힘 아님) */
    /* 220 cm «도착» 은 웨이포인트에만 — 정문(사거리 140)·플레이어(170)를 그 반경에서 멈추면 영원히 못 친다 (UE 에서 고친 버그) */
    const g = goal(e);
    /* 측면 길 입구(첫 지점)는 60 — 220 이면 축에서 비낀 채 꺾어 경사로 옆면(턱 64)에 붙는다 (UE AHWNodeEnemy::StepMove 와 같이) */
    if (hasWaypoint(e) && d2(g, e.p) < (e.own && e.ri === 0 ? 60 : 220)) { if (e.ri < e.route.length) e.ri++; else e.ei++; return; }
    step(e, dirTo(e.p, g), e.st.speed * C.resonanceMove(e.res) * dt);
  }
  /* 공진 (AHWNodeDirector::RefreshResonance): 0.4초마다, 살아 있는 공진형 1800 안의 다른 감염체 — 중첩 1 */
  let resLeft = 0, resOn = false, livingRes = 0; const resLog = { on: 0, maxAffected: 0 };
  function resonance(dt, t) { resLeft -= dt; if (resLeft > 0) return; resLeft = C.RESONANCE.refresh;
    const rs = enemies.filter(x => !x.dead && x.role === 'resonator'); let affected = 0;
    for (const e of enemies) { if (e.dead) continue; const n = rs.filter(r => r !== e && C.inResonance(e.role, d2(e.p, r.p))).length; const was = e.res; e.res = C.resonanceStacks(n); proof.noteResonance(was, e.res, rs.length < livingRes); if (e.res) affected++; }
    livingRes = rs.length;
    if (affected) resLog.on += C.RESONANCE.refresh; resLog.maxAffected = Math.max(resLog.maxAffected, affected);
    if (!!affected !== resOn) { resOn = !!affected; log(t, 'aura', resOn ? '공진 시작 (' + affected + ')' : '공진 해제', 'resonator', resOn ? 'on' : 'off'); } }

  /* ── 포탑 · 경비 (TickDefences) ── */
  const acc = new Map();
  function defences(dt, t) {
    const gen = facility('generator'); reserveLeft = Math.max(0, reserveLeft - dt);
    const power = C.effectivePower(gen ? gen.hp / gen.max : 0, reserveLeft), dps = C.turretDps(power), nf = fx(), shooters = [];
    for (const f of fac) if (f.kind === 'turret' && standing(f) && dps > 0) shooters.push({ key: f.id, at: f.c, dps, range: C.TURRET_RANGE, who: 'turret' });
    const guard = npcs.find(n => n.role === 'guard');
    if (guard && nf.guardDps > 0 && guard.life.targetable()) shooters.push({ key: 'guard', at: guard.p, dps: nf.guardDps, range: 1200, who: 'guard' });
    for (const s of shooters) { let tgt = null, best = s.range;
      for (const e of enemies) { if (e.dead || Math.abs(e.p[2] - s.at[2]) > 700) continue; const d = d2(e.p, s.at); if (d < best) { best = d; tgt = e; } }
      if (!tgt) continue; const a = (acc.get(s.key) || 0) + s.dps * dt; if (a < s.dps * 0.25) { acc.set(s.key, a); continue; }
      tgt.killer = s.who; hurtEnemy(tgt, a, false, t, s.who); acc.set(s.key, 0); }
    return power;
  }

  /* 사람은 길을 안다: 곧장 갈 수 있으면 곧장, 아니면 길 그래프로 (1초마다 다시 짠다) */
  function clearLine(a, b, passGate = false) { const L = d2(a, b), n = Math.max(1, Math.ceil(L / 100)); let foot = a[2] - CAPSULE_HALF;
    for (let k = 1; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n, fz = standAt(x, y, foot);
      if (fz == null || fz - foot > 45 || inSolid(x, y, fz, passGate)) return false; foot = fz; } return true; }
  function walkTo(body, to, dist) {
    body.repath = (body.repath || 0) - opt.dt;
    const pg = !!body.passGate;
    if (body.repath <= 0 || !body.way) { body.repath = 1; body.way = clearLine(body.p, to, pg) ? [] : GR.path(graph, body.p, to); body.wi = 0;
      /* 벽에 미끄러져 첫 마디가 벽 너머면, 보이는 다음 마디부터 */
      while (body.way.length >= 2 && !clearLine(body.p, body.way[0], pg) && clearLine(body.p, body.way[1], pg)) body.way.shift(); }
    while (body.wi < body.way.length && d2(body.p, body.way[body.wi]) < 150) body.wi++;
    const g = body.wi < body.way.length ? body.way[body.wi] : to; step(body, dirTo(body.p, g), dist);
  }
  /* ── 플레이어 자동 조종 (직책별) ──
     gate: 시설·NPC 를 치는 적 > 철갑 > 가까운 적 · escort: NPC 를 노리는 적, 할 일 없으면 위험한 NPC 곁 · rescue: 포로가 있으면 먼저 구조
     generator: 발전기·통신을 노리는 적, 할 일 없으면 발전기 곁. 핑 권한이 있으면 붙은 적 위에 15초마다 핑 (지휘 공헌) */
  const HOME = { gate: P(N.player_start), escort: N.shelter_point ? P(N.shelter_point) : P(N.player_start), rescue: N.shelter_point ? P(N.shelter_point) : P(N.player_start),
    generator: N.routes.generator ? P(N.routes.generator[N.routes.generator.length - 1]) : P(N.player_start) };
  const genF = () => facility('generator');
  function score(q, e) { let s2 = d2(q.p, e.p);
    if (q.job === 'gate') { if (e.tk !== 'player' && e.tk !== 'none' || e.ov) s2 -= 1500; if (e.role === 'armored_elite') s2 -= 500; }
    else if (q.job === 'escort' || q.job === 'rescue') { if (e.tk === 'npc') s2 -= 4000; else { const n = nearestNpc(e.p); if (n && d2(n.p, e.p) < 1500) s2 -= 1500; else s2 += 2500; } }
    else if (q.job === 'generator') { const g = genF(); if (e.tk === 'generator' || e.tk === 'comms') s2 -= 4000; else if (g && surf(g, e.p) < 2500) s2 -= 1500; else s2 += 2500; }
    if (e.stuck > 6) s2 += 4000; return s2; }
  /* 보급 쓰임 (AHWNodeDirector::HandleInteract 4·6): 회복약은 체력 35% 아래에서 (정책 무료분 먼저, 그다음 보급 1),
     포탑 수리는 수리·보급 권한자가 절반 아래로 내려간(또는 부서진) 포탑으로 가서 (보급 2, 절반 회복) */
  const REACH_G = 500;
  function drinkIfLow(q, t) {
    if (!useSupply || q.hp >= PLAYER.health * 0.35) return;
    const src = C.potionSource(freePotions, supply); if (src === 'none') return;
    if (src === 'free') { freePotions--; supplyUsed.potionsFree++; } else { supply -= C.SUPPLY_COST.potion; supplyUsed.potionsSupply++; }
    q.hp = Math.min(PLAYER.health, q.hp + PLAYER.health * C.POTION_HEAL_FRACTION); log(t, 'supply', (pls.length > 1 ? q.name + ' ' : '') + '회복약 (' + (src === 'free' ? '무료' : '보급') + ')', 'potion', src);
  }
  function repairTurret(q, dt, t) {
    if (!useSupply || q !== builder || supply < C.SUPPLY_COST.turret_repair) return false;
    const tr = fac.find(f => f.kind === 'turret' && f.hp <= f.max * C.TURRET_REPAIR_BELOW); if (!tr) return false;
    if (surf(tr, q.p) > REACH_G - 50) { walkTo(q, tr.c, PLAYER.speed * dt); return true; }
    supply -= C.SUPPLY_COST.turret_repair; supplyUsed.turretRepairs++; { const was = tr.hp; tr.hp = Math.min(tr.max, tr.hp + tr.max * C.TURRET_REPAIR_FRACTION * rfx.turretRepairScale); repairedTurretHp.v += tr.hp - was; }
    q.ledger.supply += C.SUPPLY_COST.turret_repair; log(t, 'supply', tr.id + ' 수리 (보급 ' + C.SUPPLY_COST.turret_repair + ')', tr.id, 'turret_repair'); return true;
  }
  function tickOne(q, dt, t) {
    if (q.deadFor >= 0) { q.deadFor += dt; if (q.deadFor >= PLAYER.respawn) { Object.assign(q, place(P(N.player_start))); q.hp = PLAYER.health; q.deadFor = -1; q.way = null; } return; }
    drinkIfLow(q, t);
    if (repairTurret(q, dt, t)) return;
    q.think -= dt;
    if (q.think <= 0) { q.think = 0.5; let best = null, bs2 = Infinity;
      for (const e of enemies) { if (e.dead) continue; const s2 = score(q, e); if (s2 < bs2) { bs2 = s2; best = e; } }
      q.target = best && (q.job === 'gate' || bs2 < 6000) ? best : null; }
    const captive = npcs.find(n => n.life.state === 'missing');
    if (captive && (q.job === 'rescue' || !q.target)) { const hs = P(N.holding_spot);
      if (d2(q.p, hs) < 300) { captive.life.rescue(); Object.assign(captive, place(captive.home)); q.rescues++; q.ledger.npc_rescue += 1; log(t, 'npc', captive.role + ' 구조', captive.role, 'rescued'); }
      else walkTo(q, hs, PLAYER.speed * dt); return; }
    const e = q.target;
    if (!e || e.dead) { if (q.job !== 'gate') { let home = HOME[q.job];
        if (q.job !== 'generator') { let risk = null, rd = Infinity; for (const n of npcs) if (n.life.targetable()) for (const x of enemies) if (!x.dead) { const d = d2(n.p, x.p); if (d < rd) { rd = d; risk = n; } } if (risk) home = risk.p; }
        if (d2(q.p, home) > 250) walkTo(q, home, PLAYER.speed * dt); } return; }
    if (d2(q.p, e.p) <= PLAYER.reach) {
      if (can(q, 'ping') && t - q.lastPing >= C.PING_LIFE) { pings.push({ at: [...q.p], t, by: q }); q.lastPing = t; }
      q.acc += q.dps * dt; if (q.acc >= q.dps * 0.5) { hurtEnemy(e, q.acc, true, t, 'player', q); q.acc = 0; } return; }
    walkTo(q, e.p, PLAYER.speed * dt);
  }
  function tickPlayer(dt, t) { for (const q of pls) tickOne(q, dt, t); }

  /* ── NPC: 회복·기술자 ── */
  function tickNpcs(dt, t) {
    for (const n of npcs) { if (n.life.tick(dt)) log(t, 'npc', n.role + ' 회복', n.role, 'normal');
      if (n.evac && n.life.state !== 'missing' && !(n.role === 'technician' && n.order) && d2(n.p, n.evac) > 150) walkTo(n, n.evac, 420 * dt); }
    const tech = npcs.find(n => n.role === 'technician'); if (!tech || !tech.order || tech.life.state === 'missing') return;
    const f = facility(tech.order.kind); if (f && surf(f, tech.p) <= 220) { if (f.hp > 0 && f.hp < f.max) {   /* 서 있을 때만 — 무너진 정문을 1%씩 살리면 영영 안 무너진다 (UE HWNodeNpc 와 같이 고침) */ const was = f.hp; f.hp = Math.min(f.max, f.hp + C.technicianRepairPerSecond(tech.life.state) * dt); tech.repaired = (tech.repaired || 0) + f.hp - was; if (orderer) orderer.ledger.repair += (f.hp - was) / 100; } return; }
    const o = tech.order; if (o.i >= o.path.length) return; const g = o.path[o.i];
    if (d2(tech.p, g) < (o.i === o.path.length - 1 ? 60 : 180)) { o.i++; return; } step(tech, dirTo(tech.p, g), 420 * dt);   /* 마지막 = 일할 자리: 바짝 붙는다 */
  }

  /* ── 한 판 ── */
  let t = 0, nextFrame = 0, result = null, power = 3, line = 'main_gate';
  const prep = C.prepSeconds(fx(), pe);
  log(0, 'state', '준비 ' + prep + '초 (판은 침공부터 잰다)');
  while (t < opt.maxTime && !result) {
    const dt = opt.dt; t += dt;
    const w = waves.tick(dt); if (w >= 0) { for (const r of C.ROLES) for (let k = 0; k < C.WAVES[w].count[r]; k++) spawn(r);
      log(t, 'spawn', C.WAVES[w].id + ' ' + C.ROLES.filter(r => C.WAVES[w].count[r]).map(r => C.ARCHETYPE[r] + '×' + C.WAVES[w].count[r]).join(' ') + ' ThreatGrade=' + C.THREAT_GRADE, C.WAVES[w].id, 'T' + C.THREAT_GRADE);
      if (w === C.WAVES.length - 1 && extraElites > 0) { waves.alive += extraElites; for (let k = 0; k < extraElites; k++) spawn('armored_elite'); }   /* AHWNodeDirector::SpawnWave */
      log(t, 'wave', '웨이브 ' + (w + 1) + ' (' + C.waveSize(C.WAVES[w]) + ')', String(w + 1), 'spawned'); }
    tickPlayer(dt, t);
    for (const e of enemies) if (!e.dead) { tickEnemy(e, dt, t); if (d2(e.p, e.lastP) > 50) { e.lastP = [...e.p]; e.stuckSince = t; } e.stuck = t - Math.max(e.stuckSince ?? t, e.attackT ?? 0); }
    tickNpcs(dt, t);
    resonance(dt, t);
    { const ln = C.defenseLine(standing(gate), standing(facility('generator')));   /* v07 방어선 이동 — UE RunEvent("line") 와 같이 */
      if (ln !== line) { line = ln; log(t, 'line', ln === 'central_plaza' ? '방어선 → 중앙 광장' : ln === 'comms_final' ? '방어선 → 통신 최종선' : '방어선 → 정문', ln, 'line'); } }
    power = defences(dt, t);
    const comms = facility('comms'), onComms = enemies.some(e => !e.dead && e.tk === 'comms' && comms && surf(comms, e.p) <= (N.comms_hold_radius || 900));   // EnemyOnComms: 통신센터를 노리는 적만
    if ((opt.retake ? R.tickRetake : R.tickInvasion)(m, dt, comms && comms.hp <= 0, onComms)) { result = 'fallen'; log(t, 'state', (opt.retake ? '탈환 실패 — ' : '함락 — ') + (comms.hp <= 0 ? '통신센터 파괴' : '통신센터 20초 점거'), 'node', 'fallen'); }
    if (!result && waves.done()) { result = 'held'; log(t, 'state', '웨이브 ' + C.WAVES.length + '개 막음 → 보스 단계', 'node', 'held'); }
    if (t >= nextFrame) { nextFrame += opt.frameEvery;
      frames.push({ t: +t.toFixed(1), power, e: enemies.filter(e => !e.dead).map(e => [Math.round(e.p[0]), Math.round(e.p[1]), C.ROLES.indexOf(e.role), +(e.hp / e.max).toFixed(2), e.tk === 'generator' ? 'e' : e.tk[0], e.stuck > 6 ? 1 : 0, e.res]),   /* e = 발전기 (g 는 정문) — UE TargetKey 와 같이 */
        f: fac.map(f => +(f.hp / f.max).toFixed(3)), n: npcs.map(n => [Math.round(n.p[0]), Math.round(n.p[1]), n.life.state[0]]),
        p: pl ? [Math.round(pl.p[0]), Math.round(pl.p[1]), +(pl.hp / PLAYER.health).toFixed(2), pl.deadFor >= 0 ? 1 : 0] : null,
        ...(pls.length > 1 ? { ps: pls.map(q => [Math.round(q.p[0]), Math.round(q.p[1]), +(q.hp / PLAYER.health).toFixed(2), q.deadFor >= 0 ? 1 : 0]) } : {}) }); }
  }
  if (!result) result = 'timeout';
  const dead = enemies.filter(e => e.dead), stuck = enemies.filter(e => !e.dead && e.stuck > 10);
  const hp = k => { const f = facility(k); return f ? Math.round(100 * f.hp / f.max) : null; };
  return { format: 'hwnode-run/1', source: 'sim', node: N.id, evacuate: !!opt.evacuate, ...(opt.debug ? { _enemies: enemies, _npcs: npcs } : {}), result, t: +t.toFixed(1), prep, opt: { policies: opt.policies, barricades: opt.barricades, tech: opt.tech, evacuate: !!opt.evacuate, wallGate: !!opt.wallGate, player: opt.player, difficulty: diff, extraElites, retake: !!opt.retake, supply: useSupply ? opt.supply : undefined, region, partyScale: opt.partyScale || 0, party: opt.party ? opt.party.map(q => ({ name: q.name, job: q.job, guildRole: q.guildRole, dps: q.dps })) : undefined },
    gate: hp('gate'), generator: hp('generator'), comms: hp('comms'), turrets: fac.filter(f => f.kind === 'turret' && standing(f)).length,
    barricades: fac.filter(f => f.kind === 'barricade').map(f => f.id + ':' + Math.round(100 * f.hp / f.max)),
    kills: { player: dead.filter(e => e.killer === 'player').length, turret: dead.filter(e => e.killer === 'turret').length, guard: dead.filter(e => e.killer === 'guard').length },
    dealt: Object.fromEntries(Object.entries(dealt).map(([k, v]) => [k, Math.round(v)])), spawned: enemies.length, alive: enemies.length - dead.length, stuck: stuck.map(e => e.role + '@' + Math.round(e.p[0]) + ',' + Math.round(e.p[1]) + ' →' + e.tk),
    line,
    facilityHits: Object.fromEntries(Object.entries(facHits).map(([k, v]) => [k, Math.round(v)])),
    threatGrade: C.THREAT_GRADE, tier5: { pass: proof.pass(), checks: proof.report() }, resonance: { seconds: +resLog.on.toFixed(1), maxAffected: resLog.maxAffected },
    npcs: npcStates(), player: pl ? { deaths: pls.reduce((a, q) => a + q.deaths, 0), counters: pls.reduce((a, q) => a + q.counters, 0), hitsTaken: pls.reduce((a, q) => a + q.hitsTaken, 0), dodges: pls.reduce((a, q) => a + (q.dodges || 0), 0), rescues: pls.reduce((a, q) => a + q.rescues, 0) } : null,
    party: pls.map(q => ({ name: q.name, job: q.job, guildRole: q.guildRole, dps: q.dps, deaths: q.deaths, kills: q.kills, rescues: q.rescues, dealt: Math.round(q.dealt),
      ledger: Object.fromEntries(Object.entries(q.ledger).map(([k, v]) => [k, +v.toFixed(2)])) })), difficulty: diff,
    repaired: Math.round(npcs.find(n => n.role === 'technician')?.repaired || 0), supplyUsed, turretRepairHp: Math.round(repairedTurretHp.v), supplyLeft: supply, freePotionsLeft: freePotions,
    events, frames, facilities: fac.map(f => ({ id: f.id, kind: f.kind, c: f.c, h: f.h })), npcIds: npcs.map(n => n.role) };
}

module.exports = { simulate, load };

if (require.main === module) {
  const a = process.argv.slice(2), get = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const N = load(get('--node') || 'namsan_n01');
  if (get('--json')) {
    const o = JSON.parse(get('--opts') || '{}'), r = simulate(N, o);
    fs.writeFileSync(get('--json'), JSON.stringify(r)); console.log(r.result, r.t, 's', JSON.stringify(r.kills), 'stuck', r.stuck.length); return;
  }
  const row = (name, o) => { const r = simulate(N, o);
    console.log([name.padEnd(30), r.result.padEnd(7), String(r.t).padStart(5) + 's', ('정문 ' + r.gate + '%').padEnd(9), ('발전 ' + r.generator + '%').padEnd(9), ('통신 ' + r.comms + '%').padEnd(9),
      '포탑 ' + r.turrets, '피해 P' + Math.round(r.dealt.player / 1000) + 'k/T' + Math.round(r.dealt.turret / 1000) + 'k/G' + Math.round((r.dealt.guard || 0) / 1000) + 'k', r.player ? '사망 ' + r.player.deaths : '', '막힘 ' + r.stuck.length,
      Object.entries(r.npcs).filter(([, s]) => s !== 'normal').map(([k, s]) => k + ':' + s).join(' ')].join('  ')); return r; };
  row('플레이어 없음 (포탑만)', { player: null });
  for (const dps of [600, 1000, 1600]) row('플레이어 DPS ' + dps, { player: { dps, counter: 0.35 } });
  row('정문강화+예비전력 · DPS 1000', { policies: ['gate_reinforce', 'reserve_power'], player: { dps: 1000, counter: 0.35 } });
  row('바리케이드 2 · DPS 1000', { barricades: ['barricade_west', 'barricade_east'], player: { dps: 1000, counter: 0.35 } });
  row('NPC무장+정찰 · DPS 1000', { policies: ['arm_npcs', 'scouting'], player: { dps: 1000, counter: 0.35 } });
  row('기술자→정문 · DPS 1000', { tech: 'gate', player: { dps: 1000, counter: 0.35 } });
  row('NPC 대피 · DPS 1000', { evacuate: true, player: { dps: 1000, counter: 0.35 } });
  row('NPC 대피+바리케이드 · DPS 1000', { evacuate: true, barricades: ['barricade_west', 'barricade_east'], player: { dps: 1000, counter: 0.35 } });
}
