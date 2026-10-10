/* 기술표형 보스의 화면 (문서 222) — server/field-boss-kit.cjs 의 기술표를 그대로 읽어 그린다.
   판정·위치·시계는 서버(혼자 연습은 같은 모듈)가 정하고, 여기서는 클립 시각 · 몸 높이(떠오름) · 돌진 · 바닥 예고만.
   boss-stage.js 가 읽는 이름표(warning · warningOutline · warnSeq · warnBeat · ringPool · floor · glow)는 클레이브(boss-motion)와 같게 단다. */
import * as THREE from '../../vendor/three/three.module.js';

const curve = (pts, t) => { if (!pts || !pts.length) return 0; if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return v0 + (v1 - v0) * (t - t0) / Math.max(1, t1 - t0); } return pts[pts.length - 1][1]; };
const yawLerp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

/* 예고 모양 — 보스 앞(+Z)을 기준으로 바닥(XZ)에 */
function shapeGeo(t) {
  if (t.shape === 'circle') return { fill: new THREE.CircleGeometry(t.radius, 56).rotateX(-Math.PI / 2), line: ringLine(t.radius, 0, Math.PI * 2, true) };
  if (t.shape === 'line') { const w = t.width / 2, b = -(t.back || 0), r = t.range, pts = [[-w, b], [w, b], [w, r], [-w, r]];
    const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, z]) => new THREE.Vector3(x, 0, z))); g.setIndex([0, 2, 1, 0, 3, 2]);
    return { fill: g, line: new THREE.BufferGeometry().setFromPoints([...pts, pts[0]].map(([x, z]) => new THREE.Vector3(x, 0, z))) }; }
  const a = t.angle / 2, n = 28, v = [new THREE.Vector3()], idx = [];   /* cone: 부채꼴 */
  for (let i = 0; i <= n; i++) { const q = -a + 2 * a * i / n; v.push(new THREE.Vector3(Math.sin(q) * t.range, 0, Math.cos(q) * t.range)); if (i) idx.push(0, i + 1, i); }
  const g = new THREE.BufferGeometry().setFromPoints(v); g.setIndex(idx);
  return { fill: g, line: new THREE.BufferGeometry().setFromPoints([v[0], ...v.slice(1), v[0]]) };
}
function ringLine(r, a0, a1) { const p = []; for (let i = 0; i <= 64; i++) { const q = a0 + (a1 - a0) * i / 64; p.push(new THREE.Vector3(Math.sin(q) * r, 0, Math.cos(q) * r)); } return new THREE.BufferGeometry().setFromPoints(p); }

export function setupKitMotion(o, gl, model, scene, kit, floor = 0, reduced = false) {
  o.mixer = new THREE.AnimationMixer(model); o.kacts = {};
  for (const c of gl.animations) o.kacts[c.name] = o.mixer.clipAction(c);
  o.deathClip = gl.animations.find(c => /^death$/i.test(c.name)) || null;   /* boss-stage 사망 장면 */
  const warnMat = new THREE.MeshBasicMaterial({ color: 0xff321d, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const warnLineMat = new THREE.LineBasicMaterial({ color: 0xff6948, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const warning = new THREE.Mesh(new THREE.BufferGeometry(), warnMat), warningOutline = new THREE.Line(new THREE.BufferGeometry(), warnLineMat);
  for (const m of [warning, warningOutline]) { m.visible = false; m.renderOrder = 4; m.userData.noCam = true; scene.add(m); }
  const geos = {}; for (const [id, s] of Object.entries(kit.skills)) geos[id] = (s.tells || []).map(shapeGeo);
  const ringPool = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9b7bff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.visible = false; m.userData.noCam = true; scene.add(m); ringPool.push({ m, active: false, t: 0, life: .7, r: 1 }); }
  let chest = null; model.traverse(b => { if (!chest && b.isBone && /Spine2$/.test(b.name)) chest = b; });
  const glow = new THREE.PointLight(0x9b7bff, 0, 7, 1.6); (chest || model).add(glow);   /* 가슴 균열 — 유일한 예고 빛 (문서 181) */
  o.kfx = { kit, warning, warningOutline, warnMat, warnLineMat, geos, warnSeq: -1, warnBeat: -1, ringPool, ringActive: 0, floor, glow, baseY: model.position.y, reduced, clip: null, seq: NaN, hitIdx: 0, from: null };
  play(o, 'idle', true); return o.kfx;
}
function play(o, name, loop, clamp = false) {
  const a = o.kacts[name] || o.kacts.idle; if (!a) return null; const fx = o.kfx; if (fx.clip === a) return a;
  a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce); a.clampWhenFinished = clamp || !loop; a.paused = false; a.timeScale = 1; a.fadeIn(.15).play();
  if (fx.clip) fx.clip.fadeOut(.15); fx.clip = a; return a;
}
export function applyKitAction(o, a, now) {
  if (!o.kfx || !a) return; const fx = o.kfx; o.netAct = a;
  if (fx.seq !== a.seq) { fx.seq = a.seq; fx.hitIdx = 0;
    if (a.motion === 'skill') { const def = fx.kit.skills[a.skill]; const act = play(o, def && def.clip, false, true); if (act) act.paused = true; fx.from = { x: a.fromX || a.x, z: a.fromZ || a.z }; o.root.position.x = fx.from.x; o.root.position.z = fx.from.z; o.root.rotation.y = a.yaw; }
    else if (a.motion === 'stagger') play(o, 'stagger', false, true);
    else play(o, a.motion === 'walk' || a.motion === 'return' ? 'walk' : 'idle', true); }
}
/* mixer.update 전에 — 서버 시계로 클립 시각을 정한다 (헤드리스·느린 기기에서도 박자가 같다) */
export function prepareKitMotion(o, now) {
  const fx = o.kfx, a = o.netAct; if (!fx || !a || a.motion !== 'skill') return; const def = fx.kit.skills[a.skill], act = def && o.kacts[def.clip]; if (!act) return;
  const t = Math.max(0, now - a.startedAt), dur = act.getClip().duration; act.paused = true; act.time = def.cue ? curve(def.cue, t) * dur : Math.min(dur - 1e-3, t / 1000);
}
export function updateKitMotion(o, dt, now) {
  const fx = o.kfx, a = o.netAct, ev = {}; if (!fx) return ev; const dying = !!(o.stage && o.stage.dying);
  const skill = a && a.motion === 'skill' ? fx.kit.skills[a.skill] : null, t = a ? Math.max(0, now - a.startedAt) : 0;
  if (a && !dying) {
    if (skill && skill.move && fx.from) { const d = curve(skill.move, t); o.root.position.x = fx.from.x + Math.sin(a.yaw) * d; o.root.position.z = fx.from.z + Math.cos(a.yaw) * d; o.root.rotation.y = a.yaw; }
    else { const k = Math.min(1, dt * (skill ? 14 : 9)); o.root.position.x += (a.x - o.root.position.x) * k; o.root.position.z += (a.z - o.root.position.z) * k; o.root.rotation.y = yawLerp(o.root.rotation.y, a.yaw, Math.min(1, dt * (skill ? 12 : 4))); }
    if (o.model) o.model.position.y = fx.baseY + (skill && skill.lift ? curve(skill.lift, t) : 0);   /* 떠오름: 몸만 올린다 — 판정 자리(x,z)는 그대로 */
  }
  /* 바닥 예고: 지금 걸린 tell 하나 — at 에 가장 짙고 to 에 사라진다 */
  let tell = -1; if (skill && skill.tells && !dying) for (let i = 0; i < skill.tells.length; i++) { const q = skill.tells[i]; if (t >= q.from && t <= q.to) tell = i; }
  if (tell >= 0) { const q = skill.tells[tell], g = fx.geos[a.skill][tell]; if (fx.warnSeq !== a.seq || fx.warnBeat !== tell) { fx.warning.geometry = g.fill; fx.warningOutline.geometry = g.line; fx.warnSeq = a.seq; fx.warnBeat = tell; }
    const p = q.at > q.from ? Math.max(0, Math.min(1, (t - q.from) / (q.at - q.from))) : 1, counter = a.counterOpen && now >= a.counterOpen && now <= a.counterClose;
    const ox = skill.move && fx.from ? fx.from.x : o.root.position.x, oz = skill.move && fx.from ? fx.from.z : o.root.position.z;
    fx.warning.visible = fx.warningOutline.visible = true; fx.warning.position.set(ox, fx.floor + .045, oz); fx.warningOutline.position.set(ox, fx.floor + .052, oz); fx.warning.rotation.y = fx.warningOutline.rotation.y = a.yaw;
    fx.warnMat.color.setHex(counter ? 0x64ddff : q.post ? 0x7a3cff : 0xff321d); fx.warnLineMat.color.setHex(counter ? 0x9decff : q.post ? 0xa98bff : 0xff6948);
    fx.warnMat.opacity = q.post ? .16 + (fx.reduced ? 0 : Math.sin(now * .01) * .04) : .08 + p * p * .3; fx.warnLineMat.opacity = q.post ? .5 : .55 + p * .45;
    fx.glow.intensity = (q.post ? 1 : 1 + p * 5) * (a.skill === 'thrust' && t > 1100 && t < 1250 ? 2.4 : 1); }   /* 찌르기: 1.1 s 에 번쩍 — 타이밍 신호 */
  else { fx.warning.visible = fx.warningOutline.visible = false; fx.glow.intensity += ((skill ? 2 : .6) - fx.glow.intensity) * Math.min(1, dt * 4); }
  /* 무거운 판정이 지나가면 충격(카메라 킥·고리) — 난무 잔타는 빼고 */
  if (skill && !dying) while (fx.hitIdx < skill.hits.length && t >= skill.hits[fx.hitIdx].at) { const h = skill.hits[fx.hitIdx++]; if (!h.pool && h.damage >= .1) { ev.impact = true; ring(fx, o.root.position.x, o.root.position.z, h.radius || 3); } }
  for (const r of fx.ringPool) if (r.active) { r.t += dt; const k = Math.min(1, r.t / r.life); r.m.scale.setScalar(fx.reduced ? r.r : r.r * (.25 + .75 * k)); r.m.material.opacity = (1 - k) * .85; if (k >= 1) { r.active = false; r.m.visible = false; fx.ringActive = Math.max(0, fx.ringActive - 1); } }
  return ev;
}
function ring(fx, x, z, r) { const p = fx.ringPool.find(q => !q.active) || fx.ringPool[0]; p.active = true; p.t = 0; p.life = .7; p.r = r; p.m.visible = true; p.m.position.set(x, fx.floor + .06, z); fx.ringActive++; }
export function hideKitMotion(o) { const fx = o.kfx; if (!fx) return; fx.warning.visible = fx.warningOutline.visible = false; fx.glow.intensity = 0; o.netAct = null; fx.seq = NaN; if (o.model) o.model.position.y = fx.baseY; }
