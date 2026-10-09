import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createCollide } from '../js/mmo/field-collide.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url), { Ecology, touches } = require('../server/field-ecology.cjs');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/ref/monster-catalog-v10/MonsterRoster_v10.json'))).Monsters;
const seed = n => () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
const fixture = () => ({ id: 'fixture', areas: [{ id: 'hunt', kind: 'hunt', lv: [45, 48], circle: [0, 0, 30],
  pool: { common: ['G5_WALKER', 'G5_HOOKHAND'], rare: [catalog.find(m => m.Grade === 4 && m.SpawnContext.includes('OpenWorldRare')).MonsterId, 'G3_BLACKBLADE'], regions: ['Urban'] },
  eco: { nests: [[-10, -10], [0, -10], [10, -10]], patrol: [[-10, 10], [10, 10], [10, 20], [-10, 20]] } }] });
const make = (extra = {}) => {
  const zone = fixture();
  return new Ecology({ zone, catalog, now: 0, rng: seed(42), collide: () => {}, ...extra });
};

test('three 2–4-member nests and one patrol use the same canonical MonsterIds deterministically', () => {
  const a = make(), b = make();
  assert.equal(a.groups.length, 4);
  assert.equal(a.groups.filter(g => g.kind === 'nest').length, 3);
  assert.equal(a.groups.filter(g => g.kind === 'patrol').length, 1);
  for (const g of a.groups) { assert.ok(g.count >= 2 && g.count <= 4); assert.equal(g.mobIds.length, g.count); }
  assert.deepEqual(a.snapshot(0, 0, 0), b.snapshot(0, 0, 0));
  assert.ok([...a.mobs.values()].every(m => catalog.some(c => c.MonsterId === m.catalogId && c.Grade === 5)));
});

test('patrol traverses all four corners, monotonically clocked and capped at 100 ms movement per tick', () => {
  const e = make(), group = e.groups.find(g => g.kind === 'patrol'), seen = new Set();
  for (let t = 50; t <= 90000; t += 50) { e.tick(t); seen.add(group.point); }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3]);
  const m = e.mobs.get(group.mobIds[0]), before = [m.x, m.z]; e.tick(1e7);
  assert.ok(Math.hypot(m.x - before[0], m.z - before[1]) <= .160001);
  assert.throws(() => e.tick(100), /monotonic/);
});

test('defeat is once only, corpse expires, respawn has a new generation and uses the current night pool', () => {
  const e = make(), m = [...e.mobs.values()][0], gen = m.generation;
  assert.equal(e.defeat(m.id, 10), true); assert.equal(e.defeat(m.id, 11), false);
  assert.equal(e.snapshot(m.x, m.z, 12).find(n => n.id === m.id).anim, 'die');
  assert.ok(!e.snapshot(m.x, m.z, 2011).some(n => n.id === m.id));
  e.tick(30009, { night: true }); assert.equal(e.mobs.get(m.id).alive, false);
  e.tick(30010); assert.equal(e.mobs.get(m.id).alive, true); assert.equal(e.mobs.get(m.id).generation, gen + 1);
  assert.ok(e.pool(m.group).filter(id => id === 'G5_STALKER').length >= 3);
  e.tick(30011, { night: false }); assert.equal(e.pool(m.group).includes('G5_STALKER'), false);
});

test('rare replaces exactly one nest, never patrol or an engaged group; no second concurrent rare nest', () => {
  const e = make(), before = e.mobs.size, nests = e.groups.filter(g => g.kind === 'nest');
  const deadline = e.nextRare.get('hunt'); assert.ok(deadline >= 600000 && deadline < 1200000);
  for (const g of nests) for (const id of g.mobIds) e.mobs.get(id).engaged = true;
  e.tick(deadline); assert.equal(e.groups.filter(g => g.rare).length, 0); assert.equal(e.mobs.size, before);
  for (const id of nests[1].mobIds) e.mobs.get(id).engaged = false;
  e.tick(deadline + 1000, { night: true });
  const rare = e.groups.filter(g => g.rare); assert.equal(rare.length, 1); assert.equal(rare[0], nests[1]); assert.equal(rare[0].mobIds.length, 1);
  const id = rare[0].mobIds[0], first = e.mobs.get(id);
  assert.ok([3, 4].includes(catalog.find(m => m.MonsterId === first.catalogId).Grade));
  const second = e.nextRare.get('hunt'); e.tick(second); assert.equal(e.groups.filter(g => g.rare).length, 1);
  assert.equal(e.defeat(id, second + 10), true); e.tick(second + 30010);
  assert.equal(rare[0].rare, false); assert.equal(rare[0].mobIds.length, rare[0].count);
  assert.ok(e.mobs.get(id).generation > first.generation, 'replacement reused a stale generation');
});

test('night and invasion pools use approved contexts, preserve species identity and leave other nests unchanged', () => {
  const e = make(), nests = e.groups.filter(g => g.kind === 'nest'), patrol = e.groups.find(g => g.kind === 'patrol');
  const normal = e.pool(nests[1]); e.tick(1, { night: true, invasion: true });
  assert.ok(e.pool(nests[0]).every(id => catalog.find(m => m.MonsterId === id).SpawnContext.includes('NodeInvasion')));
  assert.ok(e.pool(nests[1]).includes('G5_HOOKHAND')); assert.ok(e.pool(patrol).includes('G5_HOOKHAND'));
  assert.ok(e.pool(nests[1], true).includes('G4_SILENCER'));
  const silencer = catalog.find(m => m.MonsterId === 'G4_SILENCER'); assert.ok(!silencer.SpawnContext.includes('OpenWorldRare'), 'do not rewrite canon to force a night species into a daytime context');
  e.tick(2, { night: false, invasion: false }); assert.deepEqual(e.pool(nests[1]), normal);
});

test('safe zones block entire segments, including a thin crossing whose endpoints are both legal', () => {
  const e = make(), area = e.areas[0];
  e.zone.areas.push({ kind: 'rest', circle: [0, 10, .01] });
  assert.equal(e.legal(area, [-10, 10]), true); assert.equal(e.legal(area, [10, 10]), true);
  assert.equal(e.canTraverse(area, [-10, 10], [10, 10]), false);
  assert.equal(touches({ poly: [[-.01, 9], [.01, 9], [.01, 11], [-.01, 11]] }, [-10, 10], [10, 10]), true);
  e.zone.areas.push({ kind: 'siege', circle: [0, 0, 1] });
  assert.equal(e.canTraverse(area, [-10, 10], [10, 10]), true, 'boss-occupied hub is not safe');
  e.tick(1, { owner: { kind: 'guild' } }); assert.equal(e.canTraverse(area, [-10, 10], [10, 10]), false);
});

test('blocked patrol stops rather than teleporting across terrain or a sanctuary', () => {
  const e = make(), g = e.groups.find(g => g.kind === 'patrol');
  e.zone.areas.push({ kind: 'rest', poly: [[-5, -29], [5, -29], [5, 29], [-5, 29]] });
  for (let t = 50; t <= 10000; t += 50) e.tick(t);
  assert.equal(g.blockedPatrol, true);
  for (const id of g.mobIds) assert.ok(e.mobs.get(id).x < -5.6);
});

test('patrol detours around an obstacle, every segment is checked, and combat pauses the whole group', () => {
  const e = make(), g = e.groups.find(g => g.kind === 'patrol');
  e.zone.areas.push({ kind: 'rest', circle: [0, 10, 3] });
  const route = e.route(g.area, [-10, 10], [10, 10]);
  assert.ok(route && route.length > 2);
  for (let i = 1; i < route.length; i++) assert.equal(e.canTraverse(g.area, route[i - 1], route[i]), true);
  for (let t = 50; t <= 5000; t += 50) e.tick(t);
  const before = g.mobIds.map(id => ({ x: e.mobs.get(id).x, z: e.mobs.get(id).z }));
  e.mobs.get(g.mobIds[0]).engaged = true;
  for (let t = 5050; t <= 6000; t += 50) e.tick(t);
  assert.deepEqual(g.mobIds.map(id => ({ x: e.mobs.get(id).x, z: e.mobs.get(id).z })), before);
  const { planRoute } = require('../server/field-ecology-route.cjs');
  assert.equal(planRoute([-10, 10], [10, 10], p => e.legal(g.area, p), (a, b) => e.canTraverse(g.area, a, b), { budget: 1 }), null);
});

test('a respawning patrol member joins the current segment instead of teleporting from the original corner', () => {
  const e = make(), g = e.groups.find(g => g.kind === 'patrol'); g.point = 3;
  const m = e.mobs.get(g.mobIds[0]); e.defeat(m.id, 0);
  e.tick(30000); const fresh = e.mobs.get(m.id), expected = g.area.eco.patrol[2];
  assert.ok(Math.hypot(fresh.x - expected[0], fresh.z - expected[1]) < 2);
  assert.ok(fresh.generation > m.generation);
});

test('a captured hub suspends unsafe respawns and rare replacements instead of entering the new sanctuary', () => {
  const zone = fixture(); zone.areas.push({ kind: 'siege', circle: [0, 0, 1] }, { kind: 'rest', circle: [0, 0, 29] });
  const e = make({ zone }); for (const m of e.mobs.values()) e.defeat(m.id, 0);
  assert.doesNotThrow(() => e.tick(2000000, { owner: { kind: 'guild' } }));
  assert.deepEqual(e.snapshot(0, 0, 2000000), []);
  assert.ok([...e.mobs.values()].every(m => !m.alive));
});

test('AOI is nearest-first, max 28 m, at most 20 records; malformed policy, RNG, IDs and anchors fail closed', () => {
  const e = make(); assert.ok(e.snapshot(0, 0, 0).length <= 20); assert.deepEqual(e.snapshot(1000, 1000, 0), []);
  const d = e.snapshot(0, 0, 0).map(m => Math.hypot(m.x, m.z)); assert.deepEqual(d, [...d].sort((a, b) => a - b));
  assert.throws(() => e.snapshot(0, 0, 0, 100));
  assert.throws(() => make({ policy: { rareMinMs: -1 } })); assert.throws(() => make({ policy: { snapshotLimit: 21 } }));
  assert.throws(() => make({ rng: () => NaN })); assert.throws(() => make({ rng: () => 1 }));
  assert.throws(() => make({ collide: null }));
  for (const [breakZone, message] of [
    [z => { z.areas[0].pool.common = ['G2_DOM_THORNCROWN']; }, /Invalid common MonsterId/],
    [z => { z.areas[0].pool.rare = ['MISSING']; }, /Invalid rare MonsterId/],
    [z => { z.areas[0].eco.nests[0] = [Infinity, 0]; }, /Invalid ecology anchors/],
    [z => { z.areas[0].eco.patrol.pop(); }, /Invalid ecology anchors/],
    [z => { z.areas.push(structuredClone(z.areas[0])); }, /duplicate hunt area/],
    [z => { z.areas[0].eco.nests[0] = [100, 100]; }, /Blocked ecology anchor/],
  ]) { const zone = fixture(); breakZone(zone); assert.throws(() => make({ zone }), message); }
});

test('real map pools spawn inside all 45 approved hunts with shared terrain collision; source maps stay unchanged', () => {
  let hunts = 0, mobs = 0;
  for (const name of fs.readdirSync(path.join(root, 'maps/2d')).sort()) {
    const f = path.join(root, 'maps/2d', name, 'map.json'); if (!fs.existsSync(f)) continue;
    const raw = fs.readFileSync(f, 'utf8'), map = JSON.parse(raw), areas = (map.areas || []).filter(a => a.kind === 'hunt' && a.pool);
    if (!areas.length) continue;
    const e = new Ecology({ zone: { ...map, id: name }, catalog, now: 0, rng: seed(12), collide: createCollide(map).collide });
    hunts += areas.length; mobs += e.mobs.size;
    for (const m of e.mobs.values()) assert.equal(e.legal(m.group.area, [m.x, m.z]), true, name + ':' + m.id);
    for (let t = 50; t <= 3000; t += 50) e.tick(t);
    for (const m of e.mobs.values()) assert.equal(e.legal(m.group.area, [m.x, m.z]), true, name + ':' + m.id);
    assert.equal(fs.readFileSync(f, 'utf8'), raw);
  }
  assert.equal(hunts, 45); assert.ok(mobs >= hunts * 8 && mobs <= hunts * 16);
});

test('same production module loads through the real browser CommonJS bridge with no node builtins', async () => {
  const bridge = fs.readFileSync(path.join(root, 'js/mmo/cjs-browser.js'), 'utf8');
  const requested = [], fetch = async url => { requested.push(url); const rel = new URL(url).pathname.slice(1); return { text: async () => fs.readFileSync(path.join(root, rel), 'utf8') }; };
  const load = new Function('fetch', 'location', bridge.replace('export function loadCjs', 'function loadCjs') + '\nreturn loadCjs;')(fetch, { href: 'https://test.local/world3d.html' });
  const browser = await load('/server/field-ecology.cjs');
  const server = make(), client = new browser.Ecology({ zone: structuredClone(server.zone), catalog, now: 0, rng: seed(42), collide: () => {} });
  for (let t = 50; t <= 3000; t += 50) { server.tick(t); client.tick(t); }
  assert.deepEqual(server.snapshot(0, 0, 3000), client.snapshot(0, 0, 3000));
  assert.deepEqual(requested.sort(), ['https://test.local/js/mmo/safe-zones.js', 'https://test.local/server/field-ecology-route.cjs', 'https://test.local/server/field-ecology.cjs']);
});
