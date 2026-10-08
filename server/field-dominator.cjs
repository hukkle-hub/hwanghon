/* 2급 지배형 필드 전투 — 서버 권위 추적·예고·타격 (docs/design/204). 클레이브(field-boss-combat.cjs)와 섞이지 않게 o.dom 에 둔다.
   «터무니없이 강하게» (디렉터 2026-10-08): 한 대에 최대 HP 의 32%, 지배 파동은 반경 7 m 에 52% — 혼자 맞서면 두세 대에 쓰러진다.
   예고는 정직하게: 베기 0.7초, 파동 1.3초 (바닥 고리). 피하기(회피 무적)로 넘긴다. 체력은 여기서도 내보내지 않는다. */
const FM = require('./field-monsters.cjs');

const SKILLS = {
  rend:     { duration: 1500, tell: 700,  hits: [{ at: 700,  shape: 'cone',   range: 3.8, angle: 1.7, damage: .32, knock: 1.4 }] },
  rend2:    { duration: 1300, tell: 450,  hits: [{ at: 450,  shape: 'cone',   range: 4.2, angle: 2.0, damage: .26, knock: 1.8 }] },   /* 이어 베기 — 짧은 예고 */
  dominate: { duration: 2600, tell: 1300, hits: [{ at: 1300, shape: 'circle', radius: 7,  damage: .52, knock: 3.2 }] },              /* 지배 파동 */
};
const AGGRO = 16, LEASH = 26, REACH = 3.4, CHASE = 3.6, RETURN = 4.5, RECOVER = 650, FOLLOW_CHANCE = .45, PULSE_EVERY = 3;
const r2 = n => +n.toFixed(2);
const deltaAngle = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function enabled(o) { return !!(o && FM.FIELD_MONSTERS[o.id] && FM.FIELD_MONSTERS[o.id].ai === 'dominator'); }
function setup(o, now = Date.now()) {
  if (!enabled(o)) return null;
  o.homeX = o.homeX ?? o.x; o.homeZ = o.homeZ ?? o.z;
  o.dom = { state: 'idle', skill: '', seq: 0, startedAt: now, endsAt: now + 600, lastAt: now, target: null, fired: 0, swings: 0 };
  o.yaw = o.yaw || 0; return o.dom;
}
function reset(o, now = Date.now()) { if (!enabled(o)) return; o.x = o.homeX ?? o.x; o.z = o.homeZ ?? o.z; setup(o, now); }
function set(o, state, now, duration, extra = {}) { Object.assign(o.dom, { state, skill: '', startedAt: now, endsAt: now + duration, fired: 0 }, extra); o.dom.seq++; }
const live = (field, o) => [...field.players.values()].filter(p => p.zone === o.zone && !p.dead);
function inShape(o, p, h) {
  const dx = p.x - o.x, dz = p.z - o.z;
  if (h.shape === 'circle') return dx * dx + dz * dz <= h.radius * h.radius;
  const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), f = dx * fx + dz * fz, s = dx * fz - dz * fx;
  return f >= 0 && Math.hypot(dx, dz) <= h.range && Math.abs(Math.atan2(s, f)) <= h.angle * .5;
}
function face(o, x, z, max) { const want = Math.atan2(x - o.x, z - o.z); o.yaw += Math.max(-max, Math.min(max, deltaAngle(want, o.yaw))); }
function step(o, x, z, speed, dt) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz); if (d < 1e-4) return 0; const n = Math.min(d, speed * dt); o.x += dx / d * n; o.z += dz / d * n; return d - n; }
/* 다음 기술: 셋째 공격마다, 또는 둘 이상이 7 m 안이면 지배 파동. 베기 뒤엔 이어 베기 45% */
function pick(field, o, near) {
  const crowd = live(field, o).filter(p => Math.hypot(p.x - o.x, p.z - o.z) <= SKILLS.dominate.hits[0].radius).length;
  if (o.dom.swings > 0 && o.dom.swings % PULSE_EVERY === 0 || crowd >= 2) return 'dominate';
  return 'rend';
}
function tick(field, o, now = Date.now()) {
  if (!enabled(o) || !o.alive) return; if (!o.dom) setup(o, now);
  const a = o.dom, dt = Math.min(.1, Math.max(0, (now - a.lastAt) / 1000)); a.lastAt = now;
  if (a.state === 'skill') {
    const def = SKILLS[a.skill], el = now - a.startedAt;
    while (a.fired < def.hits.length && el >= def.hits[a.fired].at) {
      const hit = { ...def.hits[a.fired], skill: a.skill, beat: a.fired + 1, beats: def.hits.length }; a.fired++;
      for (const p of live(field, o)) if (inShape(o, p, hit)) field.bossStrike(o, p, hit, now);
    }
    if (now >= a.endsAt) {
      const t = a.target && field.players.get(a.target);
      if (a.skill === 'rend' && t && !t.dead && field.rng() < FOLLOW_CHANCE && Math.hypot(t.x - o.x, t.z - o.z) <= SKILLS.rend2.hits[0].range + .5) {
        face(o, t.x, t.z, Math.PI); set(o, 'skill', now, SKILLS.rend2.duration, { skill: 'rend2', target: t.id }); return;
      }
      set(o, 'idle', now, RECOVER, { target: null });
    }
    return;
  }
  if (now < a.endsAt && a.state === 'idle') return;   /* 회복 */
  const home = Math.hypot(o.x - o.homeX, o.z - o.homeZ);
  let best = null, bd = Infinity;
  for (const p of live(field, o)) { const d = Math.hypot(p.x - o.x, p.z - o.z); if (d < bd && Math.hypot(p.x - o.homeX, p.z - o.homeZ) <= LEASH) { bd = d; best = p; } }
  if (!best || bd > AGGRO) {
    if (home > .5) { if (a.state !== 'return') set(o, 'return', now, 0); face(o, o.homeX, o.homeZ, 6 * dt); step(o, o.homeX, o.homeZ, RETURN, dt); }
    else if (a.state !== 'idle') set(o, 'idle', now, 0);
    return;
  }
  if (bd <= REACH) {
    const skill = pick(field, o, bd); face(o, best.x, best.z, Math.PI); a.swings++;
    set(o, 'skill', now, SKILLS[skill].duration, { skill, target: best.id }); return;
  }
  if (a.state !== 'walk') set(o, 'walk', now, 0, { target: best.id });
  face(o, best.x, best.z, 7 * dt); step(o, best.x, best.z, CHASE, dt);
}
/* 화면용: 자리·방향·동작·예고 시각. 체력은 없다 */
function view(o) {
  if (!enabled(o) || !o.alive || !o.dom) return null; const a = o.dom, def = SKILLS[a.skill];
  return { id: o.id, x: r2(o.x), z: r2(o.z), yaw: r2(o.yaw || 0), motion: a.state, skill: a.skill, seq: a.seq, startedAt: a.startedAt, endsAt: a.endsAt,
    tell: def ? a.startedAt + def.tell : 0, shape: def ? def.hits[0].shape : '', radius: def ? (def.hits[0].radius || def.hits[0].range) : 0, ai: 'dominator' };
}
module.exports = { SKILLS, AGGRO, LEASH, REACH, CHASE, enabled, setup, reset, tick, view, inShape };
