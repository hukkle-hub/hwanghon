/* Park/Dropper recovered canon and combat authoring module.
 * Not registered in live KITS until the recovered models and clips pass visual QA.
 * All arguments are authoritative simulation data, NEVER raw client messages.
 * Pure CJS: usable through loadCjs, no Node APIs and no wall-clock reads.
 */
const cone = (at, damage, range = 3.2, angle = 1.5) => ({ at, shape: 'cone', range, angle, damage });
const tell = (from, at, style = 'coil') => ({ from, at, to: at + 150, style });
const PARK = {
  source: 'UEIntroProject/HwanghonBossData.cpp:399-417',
  design: 'docs/story/source/design/bosses/ueintro_sheets/T_BossArt_GeneralPark.jpg',
  height: 1.89, idleClip: 'idle_park', deathClip: 'death_park_salute',
  reactionClips: { cancel: 'cancel_park', stagger: 'stagger' },
  skills: {
    atk_cqc: { name: '군용 도검 CQC 2단 베기', clip: 'atk_cqc', duration: 2850, reach: 3.4,
      hits: [cone(650, .08), cone(1200, .14, 3.4)], tells: [tell(0, 650), tell(800, 1200)], counter: [1000, 1200] },
    atk_arm_strike: { name: '좌측 나노 의수 강타', clip: 'atk_arm_strike', duration: 2550, reach: 2.8,
      hits: [cone(950, .18, 2.8, 1.1)], tells: [tell(0, 950, 'brace')], counter: [750, 950] },
    sk_parry_riposte: { name: '패링 후 반격', clip: 'sk_parry_riposte', duration: 2500, reach: 3.5, reactive: true,
      hits: [cone(850, .20, 3.5, .9)], tells: [tell(0, 850, 'brace')], counter: [650, 850] },
    sk_arm_shock: { name: '의수 충격 파쇄', clip: 'sk_arm_shock', duration: 2800, reach: 5,
      hits: [{ at: 1200, shape: 'line', range: 5, width: 1.4, damage: .21, knock: 2 }], tells: [tell(0, 1200, 'brace')], counter: [1000, 1200] },
    sk_shield_panel: { name: '전술 방패 패널', clip: 'sk_shield_panel', duration: 2200, reach: 3.2,
      guard: [300, 1100], guardArc: 1.6, hits: [cone(1200, .09, 3.2, 1.6)], tells: [tell(0, 1200, 'brace')] },
    aoe_ten_slash: { name: '10연속 전술 사선 베기', clip: 'aoe_ten_slash', duration: 5850, reach: 4,
      hits: Array.from({ length: 10 }, (_, i) => cone(900 + i * 350, i === 9 ? .12 : .025, 4, 1.6)),
      tells: Array.from({ length: 10 }, (_, i) => tell(i ? 700 + i * 350 : 0, 900 + i * 350)), counter: [3850, 4050] },
    aoe_arm_quake: { name: '의수 전장 파쇄', clip: 'aoe_arm_quake', duration: 3700, reach: 6,
      hits: [{ at: 2000, shape: 'circle', radius: 6, damage: .26, knock: 3 }], tells: [tell(0, 2000, 'rear')], counter: [1750, 2000] },
  },
};
const DROPPER = {
  source: 'docs/design/145-canon-ep04-05-16-17.md#2', count: 4,
  idleClip: 'dropper_ceiling_hang', deathClip: 'dropper_death', fleeClip: 'dropper_flee',
  skills: {
    drop_ambush: { name: '천장 낙하 기습', clip: 'dropper_drop_impact', duration: 2400, reach: 10,
      // No inhalation or manufactured ground telegraph. Ceiling travel/pipe sound
      // belongs before release; position locks at release, not at contact.
      tells: [], winds: [], lift: [[0, 4.5], [200, 4.30], [400, 3.70], [600, 2.70], [800, 1.30], [958, 0], [1350, 0], [2400, 0]],
      hits: [{ at: 958, shape: 'circle', radius: 1.6, damage: .24, atTarget: true, lead: 958 }],
    },
  },
};

const finite = n => Number.isFinite(n);
const pos = p => p && finite(p.x) && finite(p.z);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const live = (p, zone) => pos(p) && p.id && p.zone === zone && p.dead === false && finite(p.hp) && p.hp > 0;
function rear(b, p) { const a = Math.atan2(p.x - b.x, p.z - b.z) - b.yaw; return Math.cos(a) < -.5; }

// Source tactic: light read -> commit to bright decoy -> dark nape cut ->
// relight second cut. Timings/ranges below are explicit local tuning, not novel facts.
function createPark(zone) { return { zone, now: -Infinity, state: 'read', target: null, until: 0, actor: null, seen: new Map(), seq: 0 }; }
function stepPark(s, now) {
  if (!finite(now) || now < s.now) return false;
  s.now = now;
  for (const [id, at] of s.seen) if (now - at > 10000) s.seen.delete(id);
  if (s.state !== 'read' && s.state !== 'defeated' && now > s.until) {
    s.state = 'read'; s.target = s.actor = null; s.seq++;
  }
  return true;
}
function readFlare(s, b, p, event, now) {
  if (!stepPark(s, now) || s.state !== 'read' || !pos(b) || !finite(b.yaw) || !live(p, s.zone)) return false;
  if (!event || typeof event.id !== 'string' || !event.id || event.id.length > 128 || !finite(event.at) || event.at > now || now - event.at > 150 || event.power !== 'lit') return false;
  const key = p.id + ':' + event.id;
  if (s.seen.has(key) || distance(b, p) > 4 || s.seen.size >= 128) return false;
  s.seen.set(key, now); s.target = p.id; s.state = 'committed'; s.until = now + 1600; s.seq++;
  s.aim = { x: p.x, z: p.z }; // the whole premise: cannot turn toward the dark flanker
  return true;
}
function napeHit(s, b, p, event, now) {
  if (!stepPark(s, now) || s.state === 'defeated' || !pos(b) || !finite(b.yaw) || !live(p, s.zone) || distance(b, p) > 2.8 || !rear(b, p)) return 'rejected';
  if (!event || event.part !== 'nape' || typeof event.id !== 'string' || !event.id || event.id.length > 128 || !finite(event.at) || event.at > now || now - event.at > 150) return 'rejected';
  const key = p.id + ':' + event.id;
  if (s.seen.has(key) || s.seen.size >= 128) return 'rejected';
  if (s.state === 'committed' && p.id !== s.target && event.power === 'dark') {
    s.seen.set(key, now); s.state = 'grooved'; s.actor = p.id; s.until = now + 1400; s.seq++; return 'shallow';
  }
  if (s.state === 'grooved' && s.actor === p.id && event.power === 'lit') {
    s.seen.set(key, now); s.state = 'defeated'; s.seq++; return 'decisive';
  }
  return 'rejected';
}

function createDroppers(zone, points) {
  if (!Array.isArray(points) || points.length !== 4 || !points.every(pos)) throw Error('Four authoritative ceiling anchors required');
  return { zone, now: -Infinity, wave: 0, outcome: null, cut: false,
    actors: points.map((p, i) => ({ id: 'dropper-' + i, x: p.x, z: p.z, state: 'hang', at: 0, mark: null, struck: false })) };
}
function releaseDrop(s, index, p, now) {
  if (!finite(now) || now < s.now || s.outcome || !live(p, s.zone)) return false;
  const a = s.actors[index]; if (!a || a.state !== 'hang' || distance(a, p) > 10) return false;
  s.now = now; a.state = 'fall'; a.at = now; a.mark = { x: p.x, z: p.z }; return true;
}
function tickDrops(s, players, now, strike) {
  if (!finite(now) || now < s.now || s.outcome) return; s.now = now;
  for (const a of s.actors) {
    if (a.state !== 'fall' || a.struck || now - a.at < 958) continue;
    a.struck = true; a.state = 'land'; a.x = a.mark.x; a.z = a.mark.z;
    for (const p of players) if (live(p, s.zone) && distance(a, p) <= 1.6) strike(a, p, DROPPER.skills.drop_ambush.hits[0], now);
  }
}
function k3Sweep(s, p, band, now) {
  // Resolved by server equipment + weapon contact. One sweep must cover three;
  // the fourth survives/flees. Repeated ordinary hits cannot clear the episode.
  if (!finite(now) || now < s.now || s.outcome || s.cut || !live(p, s.zone) || !band || band.k3 !== true || !finite(band.min) || !finite(band.max) || band.min < 0 || band.max <= band.min) return false;
  const top = band.top ?? 1.8;
  if (!finite(top) || top < 0 || top > 5) return false;
  const hit = s.actors.filter(a => {
    if (a.state !== 'fall' && a.state !== 'land') return false;
    const seconds = Math.max(0, now - a.at) / 1000;
    const y = a.state === 'land' ? 0 : Math.max(0, 4.5 - 4.905 * seconds * seconds);
    return y <= top && distance(a.mark || a, p) >= band.min && distance(a.mark || a, p) <= band.max;
  });
  if (hit.length !== 3) return false; // do not silently kill only three of four contacts
  s.now = now; s.cut = true; s.outcome = 'three_down_one_fled';
  for (const a of s.actors) a.state = hit.includes(a) ? 'dead' : 'flee';
  return true;
}
module.exports = { PARK, DROPPER, createPark, stepPark, readFlare, napeHit, createDroppers, releaseDrop, tickDrops, k3Sweep };
