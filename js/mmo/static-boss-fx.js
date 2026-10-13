/* Mechanical/core attacks: a charged muzzle, suspended shard, and released volume.
   No floor timer or combat authority. All geometry follows the shared skill clock.
   Bounded pools; death/reset clears even a paused effect. */
import * as T from '../../vendor/three/three.module.js';
const COLORS = { leviathan: 0x54dabf, aegis: 0x7fbaff, celestial2: 0xffedb9, arsenal: 0xff9e5c, nova: 0x80eaff };
const Y = new T.Vector3(0, 1, 0);
export function createStaticBossFX(o, scene, floor, reduced) {
  const color = COLORS[o.b.id]; if (!color) return null;
  const group = new T.Group(); group.name = 'BossAttackVolumes'; group.userData.noCam = true; scene.add(group);
  const material = () => new T.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: T.AdditiveBlending });
  const mesh = geo => { const m = new T.Mesh(geo, material()); m.visible = false; m.userData.noCam = true; group.add(m); return m; };
  const core = mesh(new T.IcosahedronGeometry(1, 1));
  const pool = Array.from({ length: 3 }, () => ({ beam: mesh(new T.CylinderGeometry(1, 1, 1, 8)), shard: mesh(new T.OctahedronGeometry(1)), wave: mesh(new T.TorusGeometry(1, .045, 6, 48)), inner: mesh(new T.TorusGeometry(1, .045, 6, 48)) }));
  const arcs = new Map();
  for (const s of Object.values(o.kfx.kit.skills)) for (const h of s.hits) if (h.shape === 'cone' && !arcs.has(h.angle)) {
    const geometry = new T.CylinderGeometry(1, 1, .4, 32, 1, true, -h.angle * .5, h.angle);
    const m = mesh(geometry); m.material.side = T.DoubleSide; arcs.set(h.angle, m);
  }
  const start = new T.Vector3(), end = new T.Vector3(), axis = new T.Vector3();
  const clear = () => group.children.forEach(m => { m.visible = false; });
  function update(a, skill, t) {
    clear(); if (!skill || !a || o.stage?.dying) return;
    const height = Math.max(1, o.h || 3), x = o.root.position.x, z = o.root.position.z;
    const next = skill.hits.find(h => t < h.at);
    if (next) { core.visible = true; core.position.set(x, floor + height * .55 + (o.b.fly || 0), z); core.scale.setScalar(Math.min(height * .14, .7) * (1 + .16 * Math.sin(t * .004))); core.material.opacity = reduced ? .22 : .4; }
    skill.hits.forEach((h, i) => {
      const p = pool[i % pool.length], age = t - h.at, tell = skill.tells?.find(q => q.at === h.at), lead = h.lead || (tell ? h.at - tell.from : 700);
      if (age < -lead || age > 320) return;
      const power = age < 0 ? Math.min(1, 1 + age / lead) : Math.max(0, 1 - age / 320), yaw = a.yaw + (h.yawOff || 0) + (h.turn || 0);
      if (h.atTarget) {
        const mk = a.marks?.[i]; if (!mk) return;
        p.shard.visible = true; p.shard.position.set(mk[0], floor + (age < 0 ? .7 + 3 * Math.min(1, -age / 200) : .7), mk[1]);
        p.shard.scale.set(.20 + power * .2, .65, .20 + power * .2); p.shard.rotation.y = t * .002; p.shard.material.opacity = .65;
        if (age >= 0) { p.wave.visible = true; p.wave.position.set(mk[0], floor + .4, mk[1]); p.wave.rotation.x = Math.PI / 2; p.wave.scale.setScalar(h.radius); p.wave.material.opacity = power * .65; }
      } else if (h.shape === 'line') {
        start.set(x, floor + height * .55 + (o.b.fly || 0), z); end.set(x + Math.sin(yaw) * h.range, floor + .65, z + Math.cos(yaw) * h.range); axis.subVectors(end, start);
        const length = axis.length(); p.beam.visible = true; p.beam.position.copy(start).add(end).multiplyScalar(.5); p.beam.quaternion.setFromUnitVectors(Y, axis.normalize());
        // Narrow energy alignment is on the weapon axis, never a floor rectangle.
        const r = age < 0 ? .012 + .025 * power : h.width * .5;
        p.beam.scale.set(r, length, r); p.beam.material.opacity = (age < 0 ? .2 + power * .22 : power * .5) * (reduced ? .6 : 1);
      } else if (age >= 0 && h.shape === 'cone') {
        const arc = arcs.get(h.angle); arc.visible = true; arc.position.set(x, floor + .6, z); arc.rotation.y = yaw; arc.scale.set(h.range, 1, h.range); arc.material.opacity = power * (reduced ? .3 : .6);
      } else if (age >= 0) {
        p.wave.visible = true; p.wave.position.set(x, floor + .6, z); p.wave.rotation.x = Math.PI / 2;
        p.wave.scale.setScalar(h.radius || h.range); p.wave.material.opacity = power * (reduced ? .3 : .6);
        if (h.shape === 'annulus') { p.inner.visible = true; p.inner.position.copy(p.wave.position); p.inner.rotation.copy(p.wave.rotation); p.inner.scale.setScalar(h.inner); p.inner.material.opacity = p.wave.material.opacity; }
      }
    });
  }
  return { group, pool, clear, update, dispose() { clear(); for (const m of group.children) { m.geometry.dispose(); m.material.dispose(); } group.removeFromParent(); } };
}
