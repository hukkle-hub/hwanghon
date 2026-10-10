/* 기술표형 필드 보스 (문서 222) — 클레이브(field-boss-combat.cjs)의 서버 권위 AI 를 «보스별 기술표 한 장» 으로.
   디렉터: «지금 있는 보스 하나 먼저 하고 그걸 토대로 나머지도». 섀도우 팽부터 — 문서 181 §3 «그림자 난무 하나를 먼저».
   상태는 o.kit 에 둔다(클레이브 o.combat · 지배형 o.dom 과 섞이지 않게). 보스 체력·단계는 여기서도 내보내지 않는다.
   혼자 연습(world3d)은 이 파일을 그대로 불러 쓴다 — 서버와 같은 박자 · 같은 판정 · 같은 예고. */
const seq = (from, n, gap) => Array.from({ length: n }, (_, i) => from + i * gap);

/* 시간표는 2D 모션 스터디(tools/vfx/shadowfang-motion-study.html)·3D 애니매틱(문서 181 §6) 그대로.
   hits: 판정 · tells: 박자(예전 바닥 예고 — 지금은 준비 동작·소리만, style = 준비 모양) · winds: 준비 동작 창을 따로 줄 때 · wind: 기본 모양 · lift: 몸 높이(m) · move: 정면 이동(m) · cue: 클립 진행(0~1, 없으면 1:1) */
const SF_SET = { shape: 'cone', range: 4.0, angle: 2.09, damage: .022, heal: .015 };
const KITS = {
  shadowfang: {
    aggro: 16, leash: 24, walk: 3.1, ret: 3.8, engage: 4.0, recovery: [900, 700], phases: [.5], open: 'bloom',
    skills: {
      flurry: { clip: 'atk_sfflurry', duration: 6400, reach: 4.2,   /* 그림자 난무: 떠올라 5·5·7타 + 내리꽂기, 맞을 때마다 흡혈 */
        lift: [[900, 0], [1250, 2.4], [4750, 2.4], [5000, 0]],
        hits: [...seq(1250, 5, 140).map((at, i) => ({ at, ...SF_SET, aim: i === 0 })), ...seq(2550, 5, 140).map((at, i) => ({ at, ...SF_SET, aim: i === 0 })),
          ...seq(3850, 7, 120).map((at, i) => ({ at, ...SF_SET, aim: i === 0 })), { at: 4750, shape: 'circle', radius: 4, damage: .12, knock: 2.4 }],
        tells: [{ from: 0, at: 1250, to: 1810, shape: 'cone', range: 4.0, angle: 2.09, style: 'crouch' }, { from: 1950, at: 2550, to: 3110, shape: 'cone', range: 4.0, angle: 2.09, style: 'coil' },
          { from: 3250, at: 3850, to: 4570, shape: 'cone', range: 4.0, angle: 2.09, style: 'coil' }, { from: 4300, at: 4750, to: 4900, shape: 'circle', radius: 4, style: 'rear' }] },
      thrust: { clip: 'atk_charge', duration: 2770, reach: 9.4, wind: 'crouch',   /* 무음 찌르기: 1.25 s 완전히 멈췄다가 0.12 s 에 9 m */
        cue: [[0, 0], [1250, .28], [1370, .62], [1770, 1]], move: [[1250, 0], [1370, 9], [1770, 10.5]],
        hits: [{ at: 1250, shape: 'line', range: 9.6, width: 1.6, back: .4, damage: .24, knock: 3, heal: .015 }], counter: [1050, 1250],
        tells: [{ from: 0, at: 1250, to: 1370, shape: 'line', range: 9.6, width: 1.6, back: .4 }] },
      bloom: { clip: 'atk_sfbloom', duration: 6400, reach: 99, only: true, winds: [{ from: 0, at: 1000, style: 'rear' }, { from: 1600, at: 3200, style: 'brace' }],   /* 그림자 개화: 50 % 아래로 들어설 때 한 번 — 원 밖이 안전 */
        lift: [[1000, 0], [1600, 6], [3200, 6], [3400, 0]],
        hits: [{ at: 3200, shape: 'circle', radius: 2.6, damage: .18 }, { at: 3400, shape: 'circle', radius: 8, damage: .30, knock: 2 },
          ...seq(3900, 5, 500).map(at => ({ at, shape: 'circle', radius: 8, damage: .025, pool: true }))],
        tells: [{ from: 1600, at: 3400, to: 3600, shape: 'circle', radius: 8 }, { from: 3900, at: 3900, to: 6400, shape: 'circle', radius: 8, post: true }] },
    },
    weights: (d, phase) => d > 4.6 ? { thrust: 1 } : phase === 1 ? { flurry: 3, thrust: 2 } : { flurry: 4, thrust: 3 },
  },
  /* 실험체 09호 — 문서 181 §2·§7 · UE boss_skills.json(subject_09) 박자 그대로. 고유 규칙 «리듬 깨기»: 폭주 연타의 멈춤이 매번 0/0.2/0.4 s 다르다 */
  subject09: {
    aggro: 16, leash: 24, walk: 2.6, ret: 3.6, engage: 3.4, recovery: [1000, 800], phases: [.5], open: 'storm',
    skills: {
      frenzy: { clip: 'atk_s09frenzy', duration: 4000, reach: 3.6,   /* 폭주 연타: 빠른 2타 → 거의 멈춤 → 무거운 3타(마지막 강타) */
        jitter: { at: 1100, steps: [0, 200, 400] },   /* 멈춤 뒤 박자가 통째로 밀린다 — 외운 박자로는 못 피한다 */
        hits: [{ at: 550, shape: 'cone', range: 3.4, angle: 2.2, damage: .06 }, { at: 850, shape: 'cone', range: 3.4, angle: 2.2, damage: .06 },
          { at: 1950, shape: 'cone', range: 3.4, angle: 2.4, damage: .08, aim: true }, { at: 2200, shape: 'cone', range: 3.4, angle: 2.4, damage: .08 },
          { at: 2500, shape: 'cone', range: 3.8, angle: 2.6, damage: .16, knock: 2.6 }], counter: [2250, 2500],
        tells: [{ from: 0, at: 550, to: 850, shape: 'cone', range: 3.4, angle: 2.2, style: 'coil' }, { from: 1100, at: 1950, to: 2200, shape: 'cone', range: 3.4, angle: 2.4, style: 'coil' },
          { from: 2200, at: 2500, to: 2600, shape: 'cone', range: 3.8, angle: 2.6, style: 'rear' }] },
      storm: { clip: 'atk_s09storm', duration: 5200, reach: 30, only: true, winds: [{ from: 0, at: 1200, style: 'rear' }],   /* 방전 폭우: 50 % 아래로 들어설 때 — 하늘이 어두워지고 대상 발밑에 낙뢰 6발 */
        dim: [[0, 0], [1200, .62], [4700, .62], [5200, 0]],
        hits: seq(2800, 6, 350).map(at => ({ at, shape: 'circle', radius: 1.4, damage: .16, atTarget: true, lead: 1200 })),
        tells: [] },   /* 원은 marks 로 따로 그린다 (대상 자리에 찍힌 예고) */
    },
    weights: (d, phase) => d > 3.6 ? {} : { frenzy: 1 },
  },
  /* 정 장관 — 원작 EP26(문서 149 §3): 의전용 군도 · 변주 없는 원 · 정면 결계 3합 · 보지 않고 쳐내는 등 뒤 · 왼손이 그리는 각도.
     전용 동작은 tools/3d/jeong-clips.mjs 가 굽는다(문서 223). 고유 규칙 «외운 원»: 원은 매번 소수점까지 같고, 반격창은 네 번째 원에만 열린다 */
  jeong: {
    aggro: 14, leash: 22, walk: 2.2, ret: 3.2, engage: 3.2, recovery: [900, 750], phases: [], idleClip: 'idle_jeong', deathClip: 'death_jeong', prop: 'saber',
    skills: {
      circle: { clip: 'atk_jeong_circle', duration: 2800, reach: 3.2, counterEvery: 4, wind: 'coil',   /* 완성된 원: 감기 → 한 바퀴 — 같은 박자·같은 반경 */
        hits: [{ at: 1500, shape: 'circle', radius: 3.0, damage: .16, knock: 2.2 }], counter: [1250, 1500],
        tells: [{ from: 550, at: 1500, to: 1650, shape: 'circle', radius: 3.0 }] },
      triple: { clip: 'atk_jeong_triple', duration: 2600, reach: 3.4,   /* 결계 가르기: 정면 3합, 한 걸음씩 */
        move: [[500, 0], [750, .3], [1280, .55], [1820, .85]],
        hits: [{ at: 750, shape: 'cone', range: 2.8, angle: 1.3, damage: .08 }, { at: 1280, shape: 'cone', range: 2.8, angle: 1.3, damage: .08 },
          { at: 1820, shape: 'cone', range: 3.2, angle: 1.0, damage: .15, knock: 2.4 }],
        tells: [{ from: 350, at: 750, to: 800, shape: 'cone', range: 2.8, angle: 1.3, style: 'coil' }, { from: 900, at: 1280, to: 1330, shape: 'cone', range: 2.8, angle: 1.3, style: 'coil' },
          { from: 1400, at: 1820, to: 1900, shape: 'cone', range: 3.2, angle: 1.0, style: 'rear' }] },
      back: { clip: 'atk_jeong_back', duration: 1500, reach: 3.4, behind: true, wind: 'coil',   /* 다 아는 검: 등 뒤의 대상을 고개도 안 돌리고 */
        hits: [{ at: 450, shape: 'cone', range: 3.0, angle: 2.4, damage: .14, knock: 2.6, turn: Math.PI }],
        tells: [{ from: 120, at: 450, to: 520, shape: 'cone', range: 3.0, angle: 2.4, turn: Math.PI }] },
      command: { clip: 'atk_jeong_command', duration: 2400, reach: 12, wind: 'rear',   /* 지휘 — 각도: 왼손이 그은 각도로 의장대의 그림자 셋이 파고든다 */
        hits: [-.32, 0, .32].map((yawOff, i) => ({ at: 1500 + i * 150, shape: 'line', range: 12, width: 1.4, back: 0, damage: .12, yawOff })),
        tells: [{ from: 600, at: 1500, to: 1850, shape: 'lines', range: 12, width: 1.4, offs: [-.32, 0, .32] }] },
    },
    weights: (d, phase, rel) => rel > 1.9 && d < 3.4 ? { back: 1 } : d > 4.2 ? { command: 1 } : { circle: 2, triple: 3 },
  },
};
const round2 = n => +n.toFixed(2), angle = (x, z) => Math.atan2(x, z), dAng = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const kitOf = o => KITS[o && o.id] || null, k = kitOf;
function enabled(o) { return !!kitOf(o); }
function phaseOf(o) { const k = kitOf(o), max = Math.max(1, Number(o?.max) || 1), r = Math.max(0, Math.min(max, Number.isFinite(o?.hp) ? o.hp : max)) / max; let p = 1; for (const t of (k && k.phases) || []) if (r <= t) p++; return p; }
/* 시간표 곡선: [[t, v], …] 사이를 곧게 */
function curve(pts, t) { if (!pts || !pts.length) return 0; if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return v0 + (v1 - v0) * (t - t0) / Math.max(1, t1 - t0); } return pts[pts.length - 1][1]; }

function setup(o, now = Date.now()) {
  if (!enabled(o)) return null; o.homeX = o.homeX ?? o.x; o.homeZ = o.homeZ ?? o.z;
  o.kit = { state: 'idle', skill: '', seq: 0, startedAt: now, endsAt: now + 700, lastAt: now, yaw: o.yaw || 0, target: null, hitIndex: 0, fromX: o.x, fromZ: o.z, countered: false, phase: phaseOf(o), opened: false, history: [], pattern: null };
  o.yaw = o.kit.yaw; return o.kit;
}
function reset(o, now = Date.now()) { if (enabled(o)) { if (Number.isFinite(o.homeX)) { o.x = o.homeX; o.z = o.homeZ; } setup(o, now); } }
function setState(o, state, now, duration = 0, extra = {}) { const a = o.kit; a.state = state; a.skill = extra.skill || ''; a.startedAt = now; a.endsAt = now + duration; a.seq++; a.hitIndex = 0; a.countered = false; a.recovering = false; Object.assign(a, extra); return a; }
const live = (field, o) => [...field.players.values()].filter(p => p.zone === o.zone && !p.dead && Number.isFinite(p.hp));
function nearest(field, o, r) { let best = null, bd = Infinity; for (const p of live(field, o)) { const d = Math.hypot(p.x - o.x, p.z - o.z); if (d < bd) { best = p; bd = d; } } return bd <= r ? { p: best, d: bd } : null; }
function target(field, o) { const id = o.kit.target, p = id && field.players.get(id); return p && p.zone === o.zone && !p.dead ? p : null; }
function turn(o, x, z, max) { const d = dAng(angle(x - o.x, z - o.z), o.yaw || 0); o.yaw = (o.yaw || 0) + Math.max(-max, Math.min(max, d)); o.kit.yaw = o.yaw; }
function move(o, x, z, speed, dt) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz); if (d < 1e-5) return d; const n = Math.min(d, speed * dt); o.x += dx / d * n; o.z += dz / d * n; return d - n; }
function inShape(o, p, h) {
  const dx = p.x - o.x, dz = p.z - o.z, fx = Math.sin(o.yaw || 0), fz = Math.cos(o.yaw || 0), f = dx * fx + dz * fz, s = dx * fz - dz * fx;
  if (h.shape === 'circle') return dx * dx + dz * dz <= h.radius * h.radius;
  if (h.shape === 'line') return f >= -(h.back || 0) && f <= h.range && Math.abs(s) <= h.width * .5;
  if (h.shape === 'cone') return f >= 0 && Math.hypot(dx, dz) <= h.range && Math.abs(Math.atan2(s, f)) <= h.angle * .5;
  return false;
}
function skillWeights(o, p) {
  const k = kitOf(o), a = o.kit, d = Math.hypot(p.x - o.x, p.z - o.z), rel = Math.abs(dAng(angle(p.x - o.x, p.z - o.z), o.yaw || 0)), w = { ...k.weights(d, phaseOf(o), rel) };   /* rel: 대상이 정면에서 몇 rad — 등 뒤 기술용 */
  for (const id of Object.keys(w)) { const s = k.skills[id]; if (!s || s.only || d > s.reach + .15) w[id] = 0; }
  const last = a.history[a.history.length - 1]; if (last && w[last] > 0 && Object.keys(w).filter(id => w[id] > 0).length > 1) w[last] *= .3;   /* 같은 기술 연달아는 드물게 */
  return w;
}
function choose(field, o, p) {
  const k = kitOf(o), a = o.kit;
  if (a.pattern && k.skills[a.pattern]) { const f = a.pattern; a.pattern = null; return f; }   /* 시험·검수가 기술을 고르는 통로 */
  const w = skillWeights(o, p), ids = Object.keys(w); let total = 0; for (const id of ids) total += Math.max(0, w[id]); if (total <= 0) return null;
  let r = Math.max(0, Math.min(.999999, Number(field?.rng?.()) || 0)) * total; for (const id of ids) { r -= Math.max(0, w[id]); if (r < 0) return id; } return ids.find(id => w[id] > 0) || null;
}
function begin(field, o, p, now, skill) {
  const def = kitOf(o).skills[skill]; if (p && !def.behind) turn(o, p.x, p.z, Math.PI);   /* 등 뒤 기술은 돌아서지 않는다 — «보지도 않고» */
  const j = def.jitter, shift = j ? j.steps[Math.min(j.steps.length - 1, Math.floor(Math.max(0, Math.min(.999999, Number(field?.rng?.()) || 0)) * j.steps.length))] : 0;
  let live = true; if (def.counterEvery) { const c = o.kit.counts || (o.kit.counts = {}); c[skill] = (c[skill] || 0) + 1; live = c[skill] % def.counterEvery === 0; }   /* 외운 원: 네 번째마다 */
  setState(o, 'skill', now, def.duration + shift, { skill, target: p ? p.id : null, fromX: o.x, fromZ: o.z, shift, marks: [], counterLive: live });
  const h = o.kit.history; h.push(skill); while (h.length > 4) h.shift();
}
function finish(o, now) { const k = kitOf(o), rec = k.recovery[Math.min(k.recovery.length, phaseOf(o)) - 1]; setState(o, 'idle', now, rec, { target: null, recovering: true }); }
function skillTick(field, o, now) {
  const a = o.kit, def = kitOf(o).skills[a.skill]; if (!def) { finish(o, now); return; }
  const t = now - a.startedAt;
  if (def.move) { const dist = curve(def.move, t); o.x = a.fromX + Math.sin(o.yaw) * dist; o.z = a.fromZ + Math.cos(o.yaw) * dist; }   /* 돌진: 예고 때 잠근 방향으로만 */
  const at = h => h.at + (def.jitter && h.at >= def.jitter.at ? a.shift || 0 : 0);   /* 리듬 깨기: 멈춤 뒤 박자만 민다 */
  /* 대상 발밑 표식: 판정 lead ms 전에 그 순간의 대상 자리를 찍어 둔다 (화면은 marks 를 보고 원을 그린다) */
  for (let i = 0; i < def.hits.length; i++) { const h = def.hits[i]; if (!h.atTarget || a.marks[i] || t < at(h) - h.lead) continue; const p = target(field, o) || nearest(field, o, k(o).leash)?.p; a.marks[i] = p ? [round2(p.x), round2(p.z)] : [round2(o.x), round2(o.z)]; }
  while (a.hitIndex < def.hits.length && t >= at(def.hits[a.hitIndex])) {
    const h = def.hits[a.hitIndex]; a.hitIndex++;
    if (h.aim) { const p = target(field, o); if (p) turn(o, p.x, p.z, Math.PI / 2); }   /* 난무: 세트마다 방향을 다시 잡는다 (숨 동안 틀어짐) */
    const mk = h.atTarget && a.marks[a.hitIndex - 1], yh = (o.yaw || 0) + (h.turn || 0) + (h.yawOff || 0), origin = mk ? { x: mk[0], z: mk[1], yaw: 0 } : def.move && h.shape === 'line' ? { x: a.fromX, z: a.fromZ, yaw: yh } : { x: o.x, z: o.z, yaw: yh }, hit = { ...h, skill: a.skill, beat: a.hitIndex, beats: def.hits.length };
    for (const p of live(field, o)) if (inShape(origin, p, hit)) { const r = field.bossStrike(o, p, hit, now);
      if (h.heal && r && r.amount > 0) o.hp = Math.min(o.max, (o.hp || 0) + Math.round(o.max * h.heal)); }   /* 흡혈: 맞힌 만큼 보스가 회복 (보스 고유 규칙, 문서 181 §1 ④) */
  }
  if (now >= a.endsAt) finish(o, now);
}
function tick(field, o, now = Date.now()) {
  if (!enabled(o) || !o.alive) return; if (!o.kit) setup(o, now);
  const k = kitOf(o), a = o.kit, dt = Math.min(.1, Math.max(0, (now - a.lastAt) / 1000)); a.lastAt = now;
  const ph = phaseOf(o); if (ph !== a.phase) { a.phase = ph; }
  if (a.state === 'skill') { skillTick(field, o, now); return; }
  if (a.state === 'stagger') { if (now >= a.endsAt) finish(o, now); return; }
  /* 단계 문턱을 넘으면 «여는 기술» 을 한 번 (섀도우 팽: 그림자 개화) — 누가 근처에 있을 때만 */
  if (k.open && !a.opened && a.phase > 1) { const n = nearest(field, o, k.leash); if (n) { a.opened = true; begin(field, o, n.p, now, k.open); return; } }
  /* finish clears the target; nearest() must not replace this idle with walk
     (and reset endsAt) before the configured recovery has elapsed. */
  if (a.recovering && now < a.endsAt) return;
  const t = target(field, o), homeD = Math.hypot(o.x - o.homeX, o.z - o.homeZ);
  if (t) { const d = Math.hypot(t.x - o.x, t.z - o.z);
    if (d > k.leash || homeD > k.leash) setState(o, 'return', now, 0, { target: null });
    else if (now >= a.endsAt) { const s = choose(field, o, t); if (s) { begin(field, o, t, now, s); return; }
      if (a.state !== 'walk') setState(o, 'walk', now, 0, { target: t.id }); turn(o, t.x, t.z, dt * 3); move(o, t.x, t.z, k.walk, dt); return; }
    else return; }
  if (a.state === 'return' || homeD > 1) { if (a.state !== 'return') setState(o, 'return', now, 0, { target: null }); turn(o, o.homeX, o.homeZ, dt * 3.2);
    if (move(o, o.homeX, o.homeZ, k.ret, dt) <= .08) { o.x = o.homeX; o.z = o.homeZ; setState(o, 'idle', now, 650, { target: null }); } return; }
  const n = nearest(field, o, k.aggro); if (n) { a.target = n.p.id; if (a.state !== 'walk') setState(o, 'walk', now, 0, { target: n.p.id }); }
  else if (a.state !== 'idle') setState(o, 'idle', now, 0, { target: null });
}
function tryCounter(o, now = Date.now()) {
  const a = o && o.kit, def = a && kitOf(o).skills[a.skill]; if (!a || a.state !== 'skill' || !def?.counter || a.countered || a.counterLive === false) return false;
  const sh = def.jitter && def.counter[0] >= def.jitter.at ? a.shift || 0 : 0, t = now - a.startedAt - sh; if (t < def.counter[0] || t > def.counter[1]) return false;
  a.countered = true; setState(o, 'stagger', now, 1350, { skill: a.skill, target: null }); return true;
}
function view(o) {
  if (!enabled(o) || !o.alive || !o.kit) return null; const a = o.kit, def = kitOf(o).skills[a.skill], c = a.counterLive === false ? null : def?.counter, sk = a.state === 'skill';
  return { id: o.id, ai: 'kit', x: round2(o.x), z: round2(o.z), yaw: round2(o.yaw || 0), motion: a.state, skill: a.skill, seq: a.seq, startedAt: a.startedAt, endsAt: a.endsAt,
    fromX: sk ? round2(a.fromX) : 0, fromZ: sk ? round2(a.fromZ) : 0, shift: sk ? a.shift || 0 : 0, marks: sk && a.marks && a.marks.length ? a.marks.map(m => m || null) : undefined,
    counterOpen: c && sk ? a.startedAt + c[0] + (def.jitter && c[0] >= def.jitter.at ? a.shift || 0 : 0) : 0, counterClose: c && sk ? a.startedAt + c[1] + (def.jitter && c[0] >= def.jitter.at ? a.shift || 0 : 0) : 0 };
}
module.exports = { KITS, enabled, shiftAt: (def, a, at) => at + (def.jitter && at >= def.jitter.at ? (a && a.shift) || 0 : 0), phaseOf, curve, setup, reset, tick, tryCounter, view, inShape, skillWeights };
