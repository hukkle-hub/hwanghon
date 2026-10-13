const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../server/field-boss-canon.cjs');
const KIT = require('../server/field-boss-kit.cjs');
const player = (id, x, z) => ({ id, x, z, zone: 'test', dead: false, hp: 100 });
const boss = { x: 0, z: 0, yaw: 0 };
const event = (id, power, at) => ({ id, power, at, part: 'nape' });
test('recovers all seven UE skill IDs; timings are usable and counter is final-contact only', () => {
  assert.deepEqual(Object.keys(C.PARK.skills), ['atk_cqc', 'atk_arm_strike', 'sk_parry_riposte', 'sk_arm_shock', 'sk_shield_panel', 'aoe_ten_slash', 'aoe_arm_quake']);
  for (const s of Object.values(C.PARK.skills)) {
    let last = -1;
    for (const h of s.hits) { assert.ok(h.at > last && h.at < s.duration); last = h.at; assert.ok(s.tells.some(t => t.from < h.at && t.at === h.at)); }
    assert.ok(s.duration - last >= 1000);
    if (s.counter) assert.equal(s.counter[1], last);
  }
  assert.equal(C.PARK.skills.aoe_ten_slash.hits.length, 10);
  assert.equal(KIT.enabled({ id: 'park' }), false, 'no invisible production attacker');
  assert.equal(KIT.enabled({ id: 'dropper' }), false);
});
test('Park: bright decoy locks aim, dark nape then relit second hit only', () => {
  const s = C.createPark('test'), decoy = player('kain', 0, 2), ain = player('ain', 0, -2);
  assert.equal(C.readFlare(s, boss, decoy, event('1', 'lit', 0), 0), true);
  decoy.x = 3; assert.deepEqual(s.aim, { x: 0, z: 2 });
  assert.equal(C.readFlare(s, boss, ain, event('2', 'lit', 200), 200), false, 'no mid-counter retarget');
  assert.equal(C.napeHit(s, boss, ain, event('3', 'lit', 300), 300), 'rejected');
  assert.equal(C.napeHit(s, boss, ain, event('3', 'dark', 300), 300), 'shallow');
  assert.equal(C.napeHit(s, boss, ain, event('3', 'lit', 400), 400), 'rejected', 'replay');
  assert.equal(C.napeHit(s, boss, ain, event('4', 'lit', 500), 500), 'decisive');
  assert.equal(C.napeHit(s, boss, ain, event('5', 'lit', 600), 600), 'rejected');
});
test('Park: invalid time/position, dark attacks, stale/future events and other zones cannot trigger counters', () => {
  for (const [p, e, now] of [
    [player('p', 0, 2), event('a', 'dark', 0), 0],
    [player('p', 0, 2), event('a', 'lit', -151), 0],
    [player('p', 0, 2), event('a', 'lit', 1), 0],
    [player('p', 0, 4.01), event('a', 'lit', 0), 0],
    [player('p', NaN, 0), event('a', 'lit', 0), 0],
    [{ ...player('p', 0, 2), zone: 'other' }, event('a', 'lit', 0), 0],
    [{ ...player('p', 0, 2), dead: true }, event('a', 'lit', 0), 0],
    [player('p', 0, 2), event('a', 'lit', 0), NaN],
  ]) assert.equal(C.readFlare(C.createPark('test'), boss, p, e, now), false);
});
test('Park: front, wrong part, wrong actor, no bait and expired opening fail; clock never rewinds', () => {
  const s = C.createPark('test'), bait = player('bait', 0, 2), a = player('a', 0, -2);
  assert.equal(C.napeHit(s, boss, a, event('a', 'dark', 0), 0), 'rejected');
  C.readFlare(s, boss, bait, event('b', 'lit', 10), 10);
  assert.equal(C.napeHit(s, boss, { ...a, z: 2 }, event('c', 'dark', 20), 20), 'rejected');
  assert.equal(C.napeHit(s, boss, a, { ...event('c', 'dark', 20), part: 'chest' }, 20), 'rejected');
  assert.equal(C.napeHit(s, boss, a, event('c', 'dark', 20), 20), 'shallow');
  assert.equal(C.napeHit(s, boss, { ...a, id: 'other' }, event('d', 'lit', 50), 50), 'rejected');
  assert.equal(C.napeHit(s, boss, a, event('e', 'lit', 1421), 1421), 'rejected');
  assert.equal(s.state, 'read'); assert.equal(C.stepPark(s, 100), false);
  assert.equal(s.now, 1421);
});
const anchors = [{ x: 0, z: 2 }, { x: 1, z: 2 }, { x: -1, z: 2 }, { x: 8, z: 0 }];
test('Dropper: no body windup; falling curve accelerates to ground, not behind it', () => {
  const s = C.DROPPER.skills.drop_ambush;
  assert.deepEqual(s.tells, []); assert.deepEqual(s.winds, []);
  assert.equal(KIT.curve(s.lift, 958), 0);
  assert.ok(KIT.curve(s.lift, 600) - KIT.curve(s.lift, 800) > KIT.curve(s.lift, 0) - KIT.curve(s.lift, 200));
  assert.equal(KIT.curve(s.lift, 5000), 0);
});
test('Dropper: impact once, locked position, dodge adapter retained, no other-zone/dead hits', () => {
  const s = C.createDroppers('test', anchors), a = player('a', 0, 2), b = player('b', 0, 2), hits = [];
  assert.equal(C.releaseDrop(s, 0, a, 0), true); a.x = 5;
  const ps = [a, b, { ...b, id: 'dead', dead: true }, { ...b, id: 'else', zone: 'other' }];
  C.tickDrops(s, ps, 957, (...h) => hits.push(h)); assert.equal(hits.length, 0);
  C.tickDrops(s, ps, 958, (...h) => hits.push(h)); assert.equal(hits.length, 1); assert.equal(hits[0][1].id, 'b');
  C.tickDrops(s, ps, 2000, (...h) => hits.push(h)); assert.equal(hits.length, 1);
  assert.equal(C.releaseDrop(s, 0, a, 2001), false);
});
test('Dropper: K-3 sweep must actually contact three; fourth flees, no all-four massacre', () => {
  const make = () => { const s = C.createDroppers('test', anchors); for (let i = 0; i < 4; i++) C.releaseDrop(s, i, player('p' + i, anchors[i].x, anchors[i].z), 0); return s; };
  const p = player('ain', 0, 0), s = make();
  assert.equal(C.k3Sweep(s, p, { k3: true, min: 1, max: 3 }, 100), false, 'still above weapon height');
  assert.equal(C.k3Sweep(s, p, { k3: false, min: 1, max: 3 }, 100), false);
  assert.equal(C.k3Sweep(s, p, { k3: true, min: 1, max: 1.5 }, 100), false);
  assert.equal(C.k3Sweep(make(), p, { k3: true, min: 1, max: 10 }, 1000), false);
  assert.equal(C.k3Sweep(s, p, { k3: true, min: 1, max: 3 }, 1000), true);
  assert.deepEqual(s.actors.map(a => a.state), ['dead', 'dead', 'dead', 'flee']);
  assert.equal(C.k3Sweep(s, p, { k3: true, min: 1, max: 3 }, 100), false);
  C.tickDrops(s, [p], 5000, () => assert.fail('post-result damage'));
});
test('negative mutations: missing blackout rule or moving target lock violates contract', () => {
  const s = C.createPark('test'), p = player('p', 0, 2);
  assert.throws(() => assert.equal(C.readFlare(s, boss, p, event('a', 'dark', 0), 0), true));
  const d = C.createDroppers('test', anchors); C.releaseDrop(d, 0, p, 0); p.x = 9;
  assert.throws(() => assert.deepEqual(d.actors[0].mark, { x: p.x, z: p.z }));
});
