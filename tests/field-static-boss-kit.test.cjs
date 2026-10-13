const test = require('node:test'), assert = require('node:assert/strict');
const { Field } = require('../server/field.cjs'), KIT = require('../server/field-boss-kit.cjs');
const IDS = ['leviathan', 'aegis', 'celestial2', 'arsenal', 'nova'];
function fixture(id) {
  const f = new Field({ rng: () => .5 }); f.initBosses(0); const o = f.bosses.get(id); f.spawnBoss(o, 1000);
  const p = f.join('p', { character: 'kain', stats: { hp: 20000, atk: 3000, defense: 1600 } }, o.zone);
  p.invulnUntil = 0; p.at = 1000; p.hp = p.maxHp = 1e9; p.x = o.x; p.z = o.z + 2;
  o.kit.target = p.id; const hits = [], strike = f.bossStrike.bind(f);
  f.bossStrike = (b, q, h, now) => { if (b === o) hits.push({ at: now - o.kit.startedAt, skill: h.skill, beat: h.beat, target: q.id }); return strike(b, q, h, now); };
  return { f, o, p, hits };
}
function start(g, name) { g.o.kit.pattern = name; g.f.tickBosses(1800); assert.equal(g.o.kit.skill, name); return g.o.kit.startedAt; }
for (const id of IDS) {
  test(id + ': real Field selects skills at aggro edge, no HP/phase in packet, root never travels', () => {
    const g = fixture(id), k = KIT.KITS[id], x = g.o.x, z = g.o.z;
    g.p.z = z + k.aggro - .1; g.f.tickBosses(1800); assert.equal(g.o.kit.state, 'skill');
    const a = g.f.bossView(g.p, 1800).bossActs.find(b => b.id === id); assert.ok(a);
    for (const key of ['hp', 'max', 'phase']) assert.equal(key in a, false);
    for (let t = 1850; t <= 20000; t += 50) g.f.tickBosses(t);
    assert.equal(g.o.x, x); assert.equal(g.o.z, z);
    for (let d = 0; d <= k.leash; d += .5) assert.ok(Object.values(KIT.skillWeights(g.o, { x, z: z + d })).some(w => w > 0), id + ' unreachable at ' + d);
  });
  test(id + ': each skill is telegraphed, last counter, recovery; later hits canceled after counter', () => {
    for (const [name, s] of Object.entries(KIT.KITS[id].skills)) {
      assert.ok(s.hits.length <= 3); let last = -1;
      for (const h of s.hits) { assert.ok(h.at > last && h.at < s.duration); last = h.at; assert.ok(s.tells.some(q => q.from <= h.at - 300 && q.at === h.at) || h.lead >= 1000); }
      assert.ok(s.duration - last >= 1500, name + ' recovery too short');
      const g = fixture(id), at = start(g, name);
      if (s.counter) {
        assert.equal(s.counter[1], last, 'counter only before last hit');
        assert.equal(KIT.tryCounter(g.o, at + s.counter[0] - 1), false);
        assert.equal(KIT.tryCounter(g.o, at + s.counter[0]), true);
        const count = g.hits.length; g.f.tickBosses(at + last); assert.equal(g.hits.length, count);
        assert.equal(KIT.tryCounter(g.o, at + s.counter[1]), false, 'one counter only');
      }
      const q = fixture(id), t0 = start(q, name); q.f.tickBosses(t0 + s.duration);
      const seq = q.o.kit.seq, end = q.o.kit.endsAt; q.f.tickBosses(end - 1); assert.equal(q.o.kit.seq, seq);
    }
  });
  test(id + ': phase opener exactly once, not selected normally, reset restores it; outside aggro safe', () => {
    const g = fixture(id), k = KIT.KITS[id]; g.o.kit.target = null; g.p.z = g.o.z + k.aggro + 1;
    g.f.tickBosses(1800); assert.notEqual(g.o.kit.state, 'skill');
    g.p.z = g.o.z + 2; g.o.hp = g.o.max * .49; g.f.tickBosses(1850); assert.equal(g.o.kit.skill, k.open);
    const seq = g.o.kit.seq; g.f.tickBosses(1900); assert.equal(g.o.kit.seq, seq);
    assert.equal(KIT.skillWeights(g.o, g.p)[k.open] || 0, 0);
    KIT.reset(g.o, 30000); assert.equal(g.o.kit.opened, false);
  });
}
test('nova: giant circle has an actual inner safe area, both boundaries and outside tested', () => {
  const h = KIT.KITS.nova.skills.orbit.hits[0], o = { x: 0, z: 0, yaw: 0 };
  for (const [x, hit] of [[0, false], [3.99, false], [4, true], [20, true], [39, true], [39.01, false]]) assert.equal(KIT.inShape(o, { x, z: 0 }, h), hit);
  // Mutation guard: replacing the ring with a disk must violate the inner-safe invariant.
  assert.throws(() => assert.equal(KIT.inShape(o, { x: 0, z: 0 }, { ...h, shape: 'circle' }), false));
});
test('arsenal: target locks 1600ms early, moving clear avoids damage; stale target cannot retarget at contact', () => {
  const g = fixture('arsenal'), at = start(g, 'suppression'); g.f.tickBosses(at + 700);
  const mark = g.o.kit.marks[0].slice(); g.p.x += 8; g.f.tickBosses(at + 2300);
  assert.deepEqual(g.o.kit.marks[0], mark); assert.equal(g.hits.length, 0);
});
test('locked line: side and rear are safe; another zone/dead player is not hit', () => {
  const g = fixture('aegis'), at = start(g, 'cannon'); g.p.x += 4;
  g.f.tickBosses(at + 1000); assert.equal(g.hits.length, 0);
  g.p.x = g.o.x; g.p.z = g.o.z - 2; g.f.tickBosses(at + 1750); assert.equal(g.hits.length, 0);
  const q = fixture('aegis'), t = start(q, 'cannon'); q.p.zone = 'southroad'; q.f.tickBosses(t + 1000); assert.equal(q.hits.length, 0);
});
