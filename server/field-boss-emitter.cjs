/* Pure shared asset-space emitter contract. No engine, filesystem or wall clock.
   Bounds/point belong to leviathan_static.glb; asset tests reject a stale fit.
   The fixed body faces +Z even when an attack targets a different direction. */
const LEVIATHAN = Object.freeze({
  node: 'Boss_Mesh', point: Object.freeze([0, .82, 6.08]), height: 3.5, pitch: .018,
  min: Object.freeze([-1.162315011024475, -.0016982397064566612, -6.701409339904785]),
  max: Object.freeze([1.1694018840789795, 2.2015380859375, 6.701724052429199]),
});
function recoilAt(profile, skill, t) {
  const keys = new Map([[0, 0], [skill.duration, 0]]);
  for (let i = 0; i < skill.hits.length; i++) {
    const h = skill.hits[i], from = Math.max(i ? skill.hits[i - 1].at + 320 : 0, h.at - 850);
    for (const [at, v] of [[from, 0], [h.at - 300, -profile.pitch], [h.at - 100, -profile.pitch], [h.at + 100, profile.pitch * .6], [h.at + 320, 0]]) keys.set(at, v);
  }
  const points = [...keys].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < points.length; i++) if (t <= points[i][0]) {
    const [a, x] = points[i - 1], [b, y] = points[i];
    return x + (y - x) * Math.max(0, (t - a) / (b - a));
  }
  return points.at(-1)[1];
}
function emitterPosition(profile, skill, t, x, z) {
  const k = profile.height / (profile.max[1] - profile.min[1]), pitch = recoilAt(profile, skill, t);
  const [px, py, pz] = profile.point;
  return { x: x + (px - (profile.min[0] + profile.max[0]) / 2) * k,
    y: (py * Math.cos(pitch) - pz * Math.sin(pitch) - profile.min[1]) * k,
    z: z + (py * Math.sin(pitch) + pz * Math.cos(pitch) - (profile.min[2] + profile.max[2]) / 2) * k };
}
function contactLine(profile, skill, h, x, z, yaw) {
  const start = emitterPosition(profile, skill, h.at, x, z);
  // Range and locked aim both begin at the visible mouth. Extending a line from
  // a new muzzle to an old root-based endpoint would miss the locked target.
  return { origin: { x: start.x, z: start.z, yaw }, range: h.range };
}
function canAimEmitter(profile, skill, x, z, target) {
  if (!profile || !skill.hits.every(h => h.shape === 'line' && !h.atTarget)) return true;
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.z)) return false;
  // The current fixed mesh faces +Z and has no animated neck. Do not fire
  // through it to chase a rear target. Check every recoil contact, not root yaw.
  // This is a geometric half-space guard, not a new attack/balance parameter.
  return skill.hits.every(h => target.z > emitterPosition(profile, skill, h.at, x, z).z);
}
module.exports = { LEVIATHAN, recoilAt, emitterPosition, contactLine, canAimEmitter };
