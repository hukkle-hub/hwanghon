/* 거점 방어전 시뮬레이터 (docs/design/201 §9) — 언리얼 없이 «한 판» 을 돌려 본다.
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
  const walls = bs.filter(b => b.kind === 'wall').map(b => ({ c: b.center, h: b.half, wkind: b.wkind }));
  const P = v => H.pt(N, v);
  const events = [], frames = [], log = (t, kind, text) => events.push({ t: +t.toFixed(1), kind, text });

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
  const floorAt = (x, y, z) => H.floorAt(bs, x, y, z);
  function inSolid(x, y, footZ) {
    const z0 = footZ + 10, z1 = footZ + 2 * CAPSULE_HALF - 10;
    for (const w of walls) if (Math.abs(x - w.c[0]) < w.h[0] + BODY_R && Math.abs(y - w.c[1]) < w.h[1] + BODY_R && z1 > w.c[2] - w.h[2] && z0 < w.c[2] + w.h[2]) return true;
    for (const f of fac) if (solidFac(f) && Math.abs(x - f.c[0]) < f.h[0] + BODY_R && Math.abs(y - f.c[1]) < f.h[1] + BODY_R && z1 > f.c[2] - f.h[2] && z0 < f.c[2] + f.h[2]) return true;
    return false;
  }
  /* 한 걸음: 막히면 x·y 따로 미끄러진다. 발 높이(foot)를 들고 다닌다. 턱 45 cm 이상·땅 없음 = 막힘 */
  function step(body, dir, dist) {
    const tryAt = (dx, dy) => { const x = body.p[0] + dx, y = body.p[1] + dy, fz = floorAt(x, y, body.foot);
      if (fz == null || fz - body.foot > 45 || inSolid(x, y, fz)) return false; body.p = [x, y, fz + CAPSULE_HALF]; body.foot = fz; return true; };
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
  const fx = () => C.npcEffects(npcStates(), pe);
  /* 기술자 명령 (PathFromTechnicianTo) */
  if (opt.tech) { const tech = npcs.find(n => n.role === 'technician'), main = N.routes.main.map(P), path = [...N.routes[tech.route].map(P)].reverse();
    if (main.length) path.push(main[main.length - 1]);
    if (opt.tech === 'generator') path.push(...N.routes.generator.map(P)); else if (opt.tech === 'comms') path.push(...N.routes.comms.map(P));
    else for (let i = main.length - 1; i >= 1; i--) path.push(main[i]);
    tech.order = { kind: opt.tech, path, i: 0 }; }

  /* ── 플레이어 ── */
  const pl = opt.player ? { ...place(P(N.player_start)), hp: PLAYER.health, deadFor: -1, deaths: 0, acc: 0, target: null, think: 0, kills: 0, rescues: 0, counters: 0, hitsTaken: 0 } : null;
  const playerAlive = () => pl && pl.deadFor < 0;

  /* ── 적 ── */
  const enemies = []; let serial = 0;
  const waves = C.waveRunner(), m = R.machine({ commsHoldToFall: N.comms_hold_to_fall || 20 }); m.state = 'invasion';
  let reserveLeft = 0, reserveUsed = false;
  function spawn(role) { const s = serial++, rr = N.role_routes[role], name = Array.isArray(rr) ? rr[s % rr.length] : rr || 'main', route = (N.routes[name] || []).map(P);
    const base = role === 'runner' && route.length ? route[0] : P(N.spawns[s % N.spawns.length]), ang = s * 2.39996;
    const st = C.roleStats(role), b = place([base[0] + Math.cos(ang) * 160, base[1] + Math.sin(ang) * 160, base[2]]);
    enemies.push({ id: s, role, st, ...b, hp: st.health, max: st.health, route, ri: 0, ext: [], ei: 0, tk: 'none', ov: null, phase: 'move', left: 0, cd: 0, think: 0,
      flanked: false, armor: C.eliteArmor(), dead: false, byPlayer: false, stuck: 0, lastP: [...b.p] }); }
  const view = (from, flanked) => ({ player: playerAlive() ? d2(from, pl.p) : -1,
    gate: standing(gate) ? surf(gate, from) : -1, generator: standing(facility('generator')) ? surf(facility('generator'), from) : -1,
    comms: standing(facility('comms')) ? surf(facility('comms'), from) : -1, npc: (n => n ? d2(from, n.p) : -1)(nearestNpc(from)), flanked });
  function targetPoint(k, from) {
    if (k === 'player' && pl) return pl.p;
    if (k === 'npc') { const n = nearestNpc(from); return n ? n.p : from; }
    const f = facility(k); if (f) return [Math.max(f.c[0] - f.h[0], Math.min(f.c[0] + f.h[0], from[0])), Math.max(f.c[1] - f.h[1], Math.min(f.c[1] + f.h[1], from[1])), from[2]];
    return from; }
  /* AHWNodeDirector::ExtensionFor — 목표의 길 끝까지 길 그래프의 최단 경로 (UHWNodeConfig::PathBetween) */
  const graph = GR.build(N);
  function extensionFor(k, from) {
    if (k === 'npc') { const n = nearestNpc(from); if (!n) return []; const p = GR.path(graph, from, n.p); return p.length ? p : (N.routes[n.route] || []).map(P); }   // NPC 는 지금 자리로
    const name = k === 'generator' ? 'generator' : k === 'comms' ? 'comms' : null;
    const r = name && N.routes[name] ? N.routes[name].map(P) : []; if (!r.length) return [];
    const p = GR.path(graph, from, r[r.length - 1]); return p.length ? p : r; }
  const segHits = (a, b, f) => { for (let k = 0; k <= 40; k++) { const p = lerp(a, b, k / 40); if (Math.abs(p[0] - f.c[0]) <= f.h[0] + 40 && Math.abs(p[1] - f.c[1]) <= f.h[1] + 40 && Math.abs(p[2] - f.c[2]) <= f.h[2] + 200) return true; } return false; };
  const barricadeOnPath = (a, b) => fac.find(f => f.kind === 'barricade' && standing(f) && segHits(a, b, f)) || null;
  const turretNear = (at, r) => fac.find(f => f.kind === 'turret' && standing(f) && surf(f, at) <= r) || null;
  const reach = (e, k) => k === 'player' ? (e.role === 'armored_elite' ? 230 : 170) : k === 'npc' ? 160 : (k === 'gate' || k === 'generator' || k === 'comms') ? 140 : 0;
  const direct = e => (e.tk === 'player' || e.tk === 'gate') && d2(e.p, targetPoint(e.tk, e.p)) <= DIRECT;   // IsDirectApproach
  const hasWaypoint = e => !direct(e) && (e.ri < e.route.length || e.ei < e.ext.length);
  function goal(e) { if (direct(e)) return targetPoint(e.tk, e.p);
    if (e.ri < e.route.length) return e.route[e.ri]; if (e.ei < e.ext.length) return e.ext[e.ei];
    return e.tk === 'none' ? e.p : targetPoint(e.tk, e.p); }

  function damageFacility(f, amount, t) { if (!standing(f)) return; f.hp -= amount;
    if (f.hp <= 0) { f.hp = 0; log(t, 'facility', f.id + ' 무너짐');
      if (f.kind === 'generator' && !reserveUsed) { reserveLeft = pe.reservePowerSeconds; reserveUsed = true; } } }
  const dealt = { player: 0, turret: 0, guard: 0 };
  function hurtEnemy(e, amount, byPlayer, t, who = byPlayer ? 'player' : e.killer) { if (e.dead) return; e.byPlayer = byPlayer; const d = Math.min(e.hp, amount * e.armor.damageScale(e.st.armorScale)); dealt[who] = (dealt[who] || 0) + d; e.hp -= d;
    if (e.hp <= 0) { e.dead = true; e.hp = 0; e.diedAt = t; if (byPlayer && pl) pl.kills++; e.killer = byPlayer ? 'player' : e.killer || 'node'; waves.enemyDied(waves.clock); } }
  function npcHurt(n, amount, t) { const before = n.life.state; if (!n.life.applyDamage(amount)) return;
    log(t, 'npc', n.role + ' ' + before + ' → ' + n.life.state);
    if (n.life.state === 'missing') { n.order = null; Object.assign(n, place(P(N.holding_spot))); } }

  function think(e) {
    if (e.role === 'runner' && !e.flanked && e.p[1] > gateY + 200) e.flanked = true;
    const v = view(e.p, e.flanked); let next = C.chooseTarget(e.role, v);
    if (next !== 'none' && next !== 'gate') { const g = targetPoint(next, e.p);
      if (C.blockedByGate(e.p[1], g[1], gateY, standing(gate), e.role, e.flanked)) next = 'gate'; }
    if (next !== e.tk) { e.tk = next; e.ext = extensionFor(next, e.ri < e.route.length ? e.route[e.route.length - 1] : e.p); e.ei = 0; }
    else if (e.tk !== 'none' && e.ri >= e.route.length && e.ei >= e.ext.length && d2(e.p, targetPoint(e.tk, e.p)) > DIRECT) { e.ext = extensionFor(e.tk, e.p); e.ei = 0; }
    e.ov = null;
    if (e.tk !== 'player') e.ov = barricadeOnPath(e.p, goal(e));
    if (!e.ov && (e.role === 'normal' || e.role === 'armored_elite') && (v.player < 0 || v.player > 600)) e.ov = turretNear(e.p, 380);
  }
  function strike(e, t) {
    e.cd = e.st.attackCooldown;
    if (e.ov) { if (standing(e.ov) && surf(e.ov, e.p) <= 200) damageFacility(e.ov, e.st.facilityDamage, t); return; }
    if (e.tk === 'player') { if (!playerAlive() || d2(e.p, pl.p) > reach(e, 'player') + 60) return;
      if (rand() < opt.player.counter) { const perfect = rand() < 0.4; e.armor.onCountered(perfect ? 'perfect' : 'normal'); e.phase = 'stagger'; e.left = e.role === 'armored_elite' ? 1.4 : 1.0; pl.counters++; return; }
      pl.hp -= e.st.damage; pl.hitsTaken++; if (pl.hp <= 0) { pl.hp = 0; pl.deadFor = 0; pl.deaths++; log(t, 'player', '플레이어 쓰러짐'); } return; }
    if (e.tk === 'npc') { const n = nearestNpc(e.p); if (n && d2(e.p, n.p) <= reach(e, 'npc') + 60) npcHurt(n, e.st.damage, t); return; }
    const f = facility(e.tk); if (f && surf(f, e.p) <= reach(e, e.tk) + 60) damageFacility(f, e.st.facilityDamage, t);
  }
  function tickEnemy(e, dt, t) {
    e.armor.tick(dt); e.cd = Math.max(0, e.cd - dt);
    if (e.phase !== 'move') { e.attackT = t; e.left -= dt; if (e.left > 0) return;
      if (e.phase === 'windup') { strike(e, t); if (e.phase === 'windup') { e.phase = 'recover'; e.left = 0.35; } return; }
      e.phase = 'move'; }
    e.think -= dt; if (e.think <= 0) { think(e); e.think = 0.4; }
    const windup = () => { if (e.cd <= 0) { e.phase = 'windup'; e.left = windupFor(e.role); } };
    if (e.ov) { if (!standing(e.ov)) e.ov = null; else { if (surf(e.ov, e.p) <= 140) { windup(); e.attackT = t; return; }
      const f = e.ov, face = [Math.max(f.c[0] - f.h[0], Math.min(f.c[0] + f.h[0], e.p[0])), Math.max(f.c[1] - f.h[1], Math.min(f.c[1] + f.h[1], e.p[1]))];
      step(e, dirTo(e.p, face), e.st.speed * dt); return; } }
    if (e.tk !== 'none') { const f = (e.tk === 'gate' || e.tk === 'generator' || e.tk === 'comms') ? facility(e.tk) : null;
      const dist = f ? surf(f, e.p) : d2(e.p, targetPoint(e.tk, e.p));
      if (dist <= reach(e, e.tk)) { windup(); e.attackT = t; return; } }
    /* 220 cm «도착» 은 웨이포인트에만 — 정문(사거리 140)·플레이어(170)를 그 반경에서 멈추면 영원히 못 친다 (UE 에서 고친 버그) */
    const g = goal(e);
    if (hasWaypoint(e) && d2(g, e.p) < 220) { if (e.ri < e.route.length) e.ri++; else e.ei++; return; }
    step(e, dirTo(e.p, g), e.st.speed * dt);
  }

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
  function clearLine(a, b) { const L = d2(a, b), n = Math.max(1, Math.ceil(L / 100)); let foot = a[2] - CAPSULE_HALF;
    for (let k = 1; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n, fz = floorAt(x, y, foot);
      if (fz == null || fz - foot > 45 || inSolid(x, y, fz)) return false; foot = fz; } return true; }
  function walkTo(body, to, dist) {
    body.repath = (body.repath || 0) - opt.dt;
    if (body.repath <= 0 || !body.way) { body.repath = 1; body.way = clearLine(body.p, to) ? [] : GR.path(graph, body.p, to); body.wi = 0; }
    while (body.wi < body.way.length && d2(body.p, body.way[body.wi]) < 150) body.wi++;
    const g = body.wi < body.way.length ? body.way[body.wi] : to; step(body, dirTo(body.p, g), dist);
  }
  /* ── 플레이어 자동 조종: 시설·NPC 를 치는 적 > 철갑 > 가까운 적. 웨이브 사이엔 포로 구조 ── */
  function tickPlayer(dt, t) {
    if (!pl) return;
    if (pl.deadFor >= 0) { pl.deadFor += dt; if (pl.deadFor >= PLAYER.respawn) { Object.assign(pl, place(P(N.player_start))); pl.hp = PLAYER.health; pl.deadFor = -1; } return; }
    pl.think -= dt;
    if (pl.think <= 0) { pl.think = 0.5; let best = null, bs2 = Infinity;
      for (const e of enemies) { if (e.dead) continue; let s = d2(pl.p, e.p);
        if (e.tk !== 'player' && e.tk !== 'none' || e.ov) s -= 1500; if (e.role === 'armored_elite') s -= 500; if (e.stuck > 6) s += 4000;
        if (s < bs2) { bs2 = s; best = e; } }
      pl.target = best; }
    const captive = npcs.find(n => n.life.state === 'missing');
    if (!pl.target && captive) { const hs = P(N.holding_spot);
      if (d2(pl.p, hs) < 300) { captive.life.rescue(); Object.assign(captive, place(captive.home)); pl.rescues++; log(t, 'npc', captive.role + ' 구조'); }
      else walkTo(pl, hs, PLAYER.speed * dt); return; }
    const e = pl.target; if (!e || e.dead) return;
    if (d2(pl.p, e.p) <= PLAYER.reach) { pl.acc += opt.player.dps * dt; if (pl.acc >= opt.player.dps * 0.5) { hurtEnemy(e, pl.acc, true, t); pl.acc = 0; } return; }
    walkTo(pl, e.p, PLAYER.speed * dt);
  }

  /* ── NPC: 회복·기술자 ── */
  function tickNpcs(dt, t) {
    for (const n of npcs) { if (n.life.tick(dt)) log(t, 'npc', n.role + ' 회복'); }
    const tech = npcs.find(n => n.role === 'technician'); if (!tech || !tech.order || tech.life.state === 'missing') return;
    const f = facility(tech.order.kind); if (f && surf(f, tech.p) <= 220) { if (f.hp < f.max) { const was = f.hp; f.hp = Math.min(f.max, f.hp + C.technicianRepairPerSecond(tech.life.state) * dt); tech.repaired = (tech.repaired || 0) + f.hp - was; } return; }
    const o = tech.order; if (o.i >= o.path.length) return; const g = o.path[o.i];
    if (d2(tech.p, g) < 180) { o.i++; return; } step(tech, dirTo(tech.p, g), 420 * dt);
  }

  /* ── 한 판 ── */
  let t = 0, nextFrame = 0, result = null, power = 3;
  const prep = C.prepSeconds(fx(), pe);
  log(0, 'state', '준비 ' + prep + '초 (판은 침공부터 잰다)');
  while (t < opt.maxTime && !result) {
    const dt = opt.dt; t += dt;
    const w = waves.tick(dt); if (w >= 0) { for (const r of C.ROLES) for (let k = 0; k < C.WAVES[w].count[r]; k++) spawn(r); log(t, 'wave', '웨이브 ' + (w + 1) + ' (' + C.waveSize(C.WAVES[w]) + ')'); }
    tickPlayer(dt, t);
    for (const e of enemies) if (!e.dead) { tickEnemy(e, dt, t); if (d2(e.p, e.lastP) > 50) { e.lastP = [...e.p]; e.stuckSince = t; } e.stuck = t - Math.max(e.stuckSince ?? t, e.attackT ?? 0); }
    tickNpcs(dt, t);
    power = defences(dt, t);
    const comms = facility('comms'), onComms = enemies.some(e => !e.dead && e.tk === 'comms' && comms && surf(comms, e.p) <= (N.comms_hold_radius || 900));   // EnemyOnComms: 통신센터를 노리는 적만
    if (R.tickInvasion(m, dt, comms && comms.hp <= 0, onComms)) { result = 'fallen'; log(t, 'state', '함락 — ' + (comms.hp <= 0 ? '통신센터 파괴' : '통신센터 20초 점거')); }
    if (!result && waves.done()) { result = 'held'; log(t, 'state', '웨이브 4개 막음 → 보스 단계'); }
    if (t >= nextFrame) { nextFrame += opt.frameEvery;
      frames.push({ t: +t.toFixed(1), power, e: enemies.filter(e => !e.dead).map(e => [Math.round(e.p[0]), Math.round(e.p[1]), C.ROLES.indexOf(e.role), +(e.hp / e.max).toFixed(2), e.tk[0], e.stuck > 6 ? 1 : 0]),
        f: fac.map(f => +(f.hp / f.max).toFixed(3)), n: npcs.map(n => [Math.round(n.p[0]), Math.round(n.p[1]), n.life.state[0]]),
        p: pl ? [Math.round(pl.p[0]), Math.round(pl.p[1]), +(pl.hp / PLAYER.health).toFixed(2), pl.deadFor >= 0 ? 1 : 0] : null }); }
  }
  if (!result) result = 'timeout';
  const dead = enemies.filter(e => e.dead), stuck = enemies.filter(e => !e.dead && e.stuck > 10);
  const hp = k => { const f = facility(k); return f ? Math.round(100 * f.hp / f.max) : null; };
  return { ...(opt.debug ? { _enemies: enemies, _npcs: npcs } : {}), result, t: +t.toFixed(1), prep, opt: { policies: opt.policies, barricades: opt.barricades, tech: opt.tech, player: opt.player },
    gate: hp('gate'), generator: hp('generator'), comms: hp('comms'), turrets: fac.filter(f => f.kind === 'turret' && standing(f)).length,
    barricades: fac.filter(f => f.kind === 'barricade').map(f => f.id + ':' + Math.round(100 * f.hp / f.max)),
    kills: { player: dead.filter(e => e.killer === 'player').length, turret: dead.filter(e => e.killer === 'turret').length, guard: dead.filter(e => e.killer === 'guard').length },
    dealt: Object.fromEntries(Object.entries(dealt).map(([k, v]) => [k, Math.round(v)])), spawned: enemies.length, alive: enemies.length - dead.length, stuck: stuck.map(e => e.role + '@' + Math.round(e.p[0]) + ',' + Math.round(e.p[1]) + ' →' + e.tk),
    npcs: npcStates(), player: pl ? { deaths: pl.deaths, counters: pl.counters, hitsTaken: pl.hitsTaken, rescues: pl.rescues } : null,
    repaired: Math.round(npcs.find(n => n.role === 'technician')?.repaired || 0),
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
}
