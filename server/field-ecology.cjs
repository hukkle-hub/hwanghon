/* Document 208: shared server/offline population state, not combat balance.
   No file, clock, network, reward or model access. The caller owns authoritative
   damage/rewards and calls defeat() once after a verified kill. Runtime wiring
   and real GLBs are separate integration gates; this module alone is not a game. */
const SAFE = require('../js/mmo/safe-zones.js');
const { planRoute } = require('./field-ecology-route.cjs');
const DEFAULT_POLICY = Object.freeze({ rareMinMs: 600000, rareMaxMs: 1200000, respawnMs: 30000, corpseMs: 2000, patrolSpeed: 1.6, snapshotLimit: 20 });
const finitePoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function pointSegment(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l)) : 0;
  return distance(p, [a[0] + t * dx, a[1] + t * dz]);
}
function crosses(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const x = cross(a, b, c), y = cross(a, b, d), u = cross(c, d, a), v = cross(c, d, b);
  return ((x > 0 && y < 0) || (x < 0 && y > 0)) && ((u > 0 && v < 0) || (u < 0 && v > 0));
}
function touches(area, a, b, radius = .6) {
  if (area.circle) return pointSegment(area.circle, a, b) <= area.circle[2] + radius;
  if (!area.poly) return false;
  if (SAFE.inArea(area, ...a) || SAFE.inArea(area, ...b)) return true;
  for (let i = 0; i < area.poly.length; i++) {
    const c = area.poly[i], d = area.poly[(i + 1) % area.poly.length];
    if (crosses(a, b, c, d) || Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b)) <= radius) return true;
  }
  return false;
}
class Ecology {
  constructor({ zone, catalog, now, rng, collide, owner = null, policy = {} }) {
    if (!zone || typeof zone.id !== 'string' || !Number.isFinite(now) || typeof rng !== 'function' || typeof collide !== 'function') throw Error('Ecology needs zone, authoritative clock, RNG and shared terrain collision');
    this.zone = zone; this.rng = rng; this.collide = collide; this.owner = owner;
    this.policy = { ...DEFAULT_POLICY, ...policy };
    const p = this.policy;
    if (!(Number.isFinite(p.rareMinMs) && p.rareMinMs >= 1000 && Number.isFinite(p.rareMaxMs) && p.rareMaxMs >= p.rareMinMs &&
      Number.isFinite(p.respawnMs) && p.respawnMs >= 1000 && Number.isFinite(p.corpseMs) && p.corpseMs >= 0 && p.corpseMs < p.respawnMs &&
      Number.isFinite(p.patrolSpeed) && p.patrolSpeed > 0 && p.patrolSpeed <= 5 && Number.isInteger(p.snapshotLimit) && p.snapshotLimit >= 1 && p.snapshotLimit <= 20)) throw Error('Invalid ecology policy');
    this.catalog = new Map(catalog.map(m => [m.MonsterId, m]));
    if (this.catalog.size !== catalog.length) throw Error('Duplicate MonsterId');
    this.groups = []; this.mobs = new Map(); this.generations = new Map(); this.night = false; this.invasion = false; this.lastTick = now;
    this.areas = structuredClone((zone.areas || []).filter(a => a.kind === 'hunt' && a.pool));
    this.anchorAdjustments = [];
    const ids = new Set();
    for (const area of this.areas) {
      if (typeof area.id !== 'string' || ids.has(area.id)) throw Error('Missing/duplicate hunt area id'); ids.add(area.id);
      if (!Array.isArray(area.pool.common) || !area.pool.common.length || !Array.isArray(area.pool.rare) || !Array.isArray(area.pool.regions)) throw Error('Invalid hunt pool');
      for (const [kind, pool] of [['common', area.pool.common], ['rare', area.pool.rare]]) for (const id of pool) {
        const m = this.catalog.get(id);
        if (!m || (kind === 'common' ? m.Grade !== 5 || !m.SpawnContext.includes('OpenWorld') : ![3, 4].includes(m.Grade) || !m.SpawnContext.includes('OpenWorldRare'))) throw Error('Invalid ' + kind + ' MonsterId: ' + id);
      }
      if (!area.eco || area.eco.nests?.length !== 3 || area.eco.patrol?.length !== 4 || ![...area.eco.nests, ...area.eco.patrol].every(finitePoint)) throw Error('Invalid ecology anchors');
      for (const kind of ['nests', 'patrol']) area.eco[kind] = area.eco[kind].map((q, index) => {
        if (this.legal(area, q)) return q;
        // Approved anchors were tested as points; allow <=1.5m clearance repair
        // only if the original center is legal. Never move or overwrite the map.
        if (this.legal(area, q, 0)) for (let r = .25; r <= 1.5; r += .25) for (let i = 0; i < 16; i++) {
          const t = i * Math.PI / 8, fit = [q[0] + r * Math.sin(t), q[1] + r * Math.cos(t)];
          if (this.legal(area, fit)) { this.anchorAdjustments.push({ area: area.id, kind, index, from: [...q], to: [...fit] }); return fit; }
        }
        throw Error('Blocked ecology anchor: ' + area.id);
      });
      area.eco.nests.forEach((anchor, i) => this.addGroup(area, 'nest', i, anchor, now));
      this.addGroup(area, 'patrol', 0, area.eco.patrol[0], now);
    }
    this.nextRare = new Map(this.areas.map(a => [a.id, now + this.interval()]));
  }
  roll() { const n = this.rng(); if (!Number.isFinite(n) || n < 0 || n >= 1) throw Error('RNG must return [0, 1)'); return n; }
  interval() { return this.policy.rareMinMs + this.roll() * (this.policy.rareMaxMs - this.policy.rareMinMs); }
  blockedAreas() {
    const safe = !SAFE.isHub(this.zone.areas) || this.owner?.kind === 'guild';
    return (this.zone.areas || []).filter(a => a.kind === 'safe' || a.kind === 'combat' || (a.kind === 'rest' && safe));
  }
  legal(area, point, margin = .6) {
    if (!finitePoint(point) || !SAFE.inArea(area, ...point) || this.blockedAreas().some(a => touches(a, point, point, margin))) return false;
    const p = { x: point[0], z: point[1] }; this.collide(p, .6);
    return Number.isFinite(p.x) && Number.isFinite(p.z) && Math.hypot(p.x - point[0], p.z - point[1]) < .05;
  }
  canTraverse(area, a, b) {
    if (!finitePoint(a) || !finitePoint(b) || this.blockedAreas().some(s => touches(s, a, b))) return false;
    const n = Math.ceil(distance(a, b) / .25);
    if (n > 4000) return false; // bounded terrain sampling; never teleport over an unchecked segment
    for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; if (!this.legal(area, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) return false; }
    return true;
  }
  route(area, a, b) {
    const legal = q => this.legal(area, q), traverse = (p, q) => this.canTraverse(area, p, q);
    return planRoute(a, b, legal, traverse) || planRoute(a, b, legal, traverse, { step: 1, budget: 12000 });
  }
  pool(group, rare = false) {
    const area = group.area, base = [...area.pool[rare ? 'rare' : 'common']];
    const regional = m => m.RegionAffinity.some(r => area.pool.regions.includes(r));
    if (this.invasion && !rare && group.kind === 'nest' && group.index === 0) {
      return [...this.catalog.values()].filter(m => m.Grade === 5 && regional(m) && m.SpawnContext.includes('NodeInvasion')).map(m => m.MonsterId);
    }
    if (this.night) {
      const id = rare ? 'G4_SILENCER' : 'G5_STALKER', m = this.catalog.get(id);
      // NightEvent is a distinct approved context; do not pretend SILENCER was OpenWorldRare.
      if (m && regional(m) && m.SpawnContext.includes('NightEvent') && (!rare || area.lv[0] >= 20)) base.push(id, id, id);
    }
    return base;
  }
  addGroup(area, kind, index, anchor, now) {
    const group = { id: this.zone.id + ':' + area.id + ':' + kind + index, area, kind, index, anchor: [...anchor], count: 2 + Math.floor(this.roll() * 3), rare: false, point: 1, mobIds: [], blockedPatrol: false, routes: new Map() };
    this.groups.push(group); this.fill(group, now); return group;
  }
  position(group, slot) {
    const anchor = group.kind === 'patrol' ? group.area.eco.patrol[(group.point + 3) % 4] : group.anchor;
    const occupied = group.mobIds.map(id => this.mobs.get(id)).filter(m => m?.alive).map(m => [m.x, m.z]);
    const free = p => this.legal(group.area, p) && occupied.every(q => distance(p, q) >= .35);
    for (const radius of [.65, .9, 1.2, 1.6, 0]) for (let i = 0; i < 12; i++) {
      const a = (slot * 2.399963 + i * Math.PI / 6), q = [anchor[0] + Math.sin(a) * radius, anchor[1] + Math.cos(a) * radius];
      if (free(q)) return q;
    }
    throw Error('Cannot safely place group: ' + group.id);
  }
  fill(group, now) {
    const anchor = group.kind === 'patrol' ? group.area.eco.patrol[(group.point + 3) % 4] : group.anchor;
    if (!this.legal(group.area, anchor)) return; // ownership change may turn a former battlefield into a sanctuary
    const pool = this.pool(group, group.rare); if (!pool.length) return;
    const count = group.rare ? 1 : group.count;
    for (let slot = 0; slot < count; slot++) {
      const id = group.id + ':' + slot, old = this.mobs.get(id);
      if (old && (old.alive || now < old.respawnAt)) continue;
      const at = this.position(group, slot), catalogId = pool[Math.floor(this.roll() * pool.length)];
      const generation = (this.generations.get(id) || 0) + 1; this.generations.set(id, generation);
      const m = { id, catalogId, group, x: at[0], z: at[1], alive: true, anim: 'idle', generation, engaged: false, deadAt: 0, respawnAt: 0, routePoint: 0 };
      this.mobs.set(id, m); if (!group.mobIds.includes(id)) group.mobIds.push(id);
    }
  }
  defeat(id, now) {
    if (!Number.isFinite(now) || now < this.lastTick) throw Error('Invalid defeat time');
    const m = this.mobs.get(id); if (!m || !m.alive) return false;
    m.alive = false; m.engaged = false; m.anim = 'die'; m.deadAt = now; m.respawnAt = now + this.policy.respawnMs; return true;
  }
  replace(group, rare, now) {
    for (const id of group.mobIds) this.mobs.delete(id);
    group.mobIds = []; group.rare = rare; group.point = 1; this.fill(group, now);
  }
  tick(now, { night = this.night, invasion = this.invasion, owner = this.owner } = {}) {
    if (!Number.isFinite(now) || now < this.lastTick) throw Error('Clock must be monotonic');
    const dt = Math.min(.1, (now - this.lastTick) / 1000); this.lastTick = now;
    if (this.owner?.kind !== owner?.kind) for (const g of this.groups) { g.routes.clear(); for (const id of g.mobIds) { const m = this.mobs.get(id); if (m) m.routePoint = 0; } }
    this.night = !!night; this.invasion = !!invasion; this.owner = owner;
    for (const group of this.groups) {
      if (group.rare && group.mobIds.every(id => { const m = this.mobs.get(id); return !m?.alive && now >= m.respawnAt; })) this.replace(group, false, now);
      else this.fill(group, now);
      if (group.kind !== 'patrol') continue;
      if (group.mobIds.some(id => { const m = this.mobs.get(id); return m?.alive && m.engaged; })) {
        for (const id of group.mobIds) { const m = this.mobs.get(id); if (m?.alive && !m.engaged) m.anim = 'idle'; }
        continue;
      }
      const anchors = group.area.eco.patrol;
      if (!group.routes.has(group.point)) group.routes.set(group.point, this.route(group.area, anchors[(group.point + 3) % 4], anchors[group.point]));
      const route = group.routes.get(group.point);
      const moving = group.mobIds.map(id => this.mobs.get(id)).filter(m => m?.alive && !m.engaged);
      if (!route) { group.blockedPatrol = true; for (const m of moving) m.anim = 'idle'; continue; }
      let arrived = moving.length > 0; group.blockedPatrol = false;
      for (const m of moving) {
        const a = [m.x, m.z];
        while (m.routePoint < route.length - 1 && distance(a, route[m.routePoint]) <= .25) m.routePoint++;
        const goal = route[m.routePoint], d = distance(a, goal);
        if (m.routePoint === route.length - 1 && d <= .25) { m.anim = 'idle'; continue; }
        arrived = false;
        const step = Math.min(d, this.policy.patrolSpeed * dt), q = [a[0] + (goal[0] - a[0]) / d * step, a[1] + (goal[1] - a[1]) / d * step];
        if (step > 0 && this.canTraverse(group.area, a, q)) { [m.x, m.z] = q; m.anim = 'walk'; }
        else { m.anim = 'idle'; if (step > 0) group.blockedPatrol = true; }
      }
      if (arrived) { group.point = (group.point + 1) % 4; for (const m of moving) m.routePoint = 0; }
    }
    for (const area of this.areas) if (now >= this.nextRare.get(area.id)) {
      const groups = this.groups.filter(g => g.area === area && g.kind === 'nest');
      if (groups.some(g => g.rare)) { this.nextRare.set(area.id, now + this.interval()); continue; }
      const eligible = groups.filter(g => this.legal(g.area, g.anchor) && this.pool(g, true).length && g.mobIds.every(id => !this.mobs.get(id)?.engaged));
      if (eligible.length) { this.replace(eligible[Math.floor(this.roll() * eligible.length)], true, now); this.nextRare.set(area.id, now + this.interval()); }
      else this.nextRare.set(area.id, now + 1000); // do not erase a group during its fight
    }
  }
  // Occupancy only, NOT HP%. Field integration must supply authoritative HP/damage.
  snapshot(x, z, now, radius = 28) {
    if (![x, z, now, radius].every(Number.isFinite) || radius <= 0 || radius > 28) throw Error('Invalid AOI');
    return [...this.mobs.values()].filter(m => (m.alive || now - m.deadAt <= this.policy.corpseMs) && Math.hypot(m.x - x, m.z - z) <= radius && this.legal(m.group.area, [m.x, m.z]))
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z) || a.id.localeCompare(b.id))
      .slice(0, this.policy.snapshotLimit).map(m => ({ id: m.id, catalogId: m.catalogId, x: +m.x.toFixed(2), z: +m.z.toFixed(2), alive: m.alive, anim: m.anim, generation: m.generation }));
  }
}
module.exports = { Ecology, DEFAULT_POLICY, touches };
