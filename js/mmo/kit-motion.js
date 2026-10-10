/* 기술표형 보스의 화면 (문서 222·224) — server/field-boss-kit.cjs 의 기술표를 그대로 읽어 그린다.
   판정·위치·시계는 서버(혼자 연습은 같은 모듈)가 정하고, 여기서는 클립 시각 · 몸 높이(떠오름) · 돌진 · 준비 동작(windup.js). 바닥 예고는 없다(문서 224).
   boss-stage.js 가 읽는 이름표(telling · warnSeq · warnBeat · ringPool · floor · glow)는 클레이브(boss-motion)와 같게 단다. */
import * as THREE from '../../vendor/three/three.module.js';
import { applyWind } from './windup.js';

const curve = (pts, t) => { if (!pts || !pts.length) return 0; if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return v0 + (v1 - v0) * (t - t0) / Math.max(1, t1 - t0); } return pts[pts.length - 1][1]; };
const S = (def, a, at) => at + (def && def.jitter && at >= def.jitter.at ? (a && a.shift) || 0 : 0);   /* 리듬 깨기: 멈춤 뒤 박자만 민다 (서버와 같은 식) */
/* 준비 동작 창: winds 가 있으면 그대로, 없으면 tells(바닥 예고였던 박자) — 모양은 tell.style · skill.wind · 'brace' 순 */
function winds(skill, a) { if (!skill) return null; const src = skill.winds || (skill.tells || []).filter(q => !q.post);
  return src.map(q => ({ from: S(skill, a, q.from), at: S(skill, a, q.at), style: q.style || skill.wind || 'brace' })); }
const yawLerp = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;


export function setupKitMotion(o, gl, model, scene, kit, floor = 0, reduced = false) {
  o.mixer = new THREE.AnimationMixer(model); o.kacts = {};
  for (const c of gl.animations) o.kacts[c.name] = o.mixer.clipAction(c);
  o.deathClip = gl.animations.find(c => c.name === (kit.deathClip || 'death')) || gl.animations.find(c => /^death$/i.test(c.name)) || null;   /* boss-stage 사망 장면 — 정 장관은 군도를 짚고 선 채 */
  /* 바닥 예고 도형은 만들지 않는다 (문서 224) */
  const ringPool = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9b7bff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.visible = false; m.userData.noCam = true; scene.add(m); ringPool.push({ m, active: false, t: 0, life: .7, r: 1 }); }
  /* 번개(공격 그 자체) — atTarget 판정이 있는 보스만 */
  const bolts = []; if (Object.values(kit.skills).some(s => s.hits.some(h => h.atTarget))) for (let i = 0; i < 8; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.09, .22, 16, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8e8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    b.visible = false; b.userData.noCam = true; scene.add(b); bolts.push({ m: b, t: 9 }); }
  let chest = null; model.traverse(b => { if (!chest && b.isBone && /Spine2$/.test(b.name)) chest = b; });
  const glow = new THREE.PointLight(0x9b7bff, 0, 7, 1.6); glow.userData.keepLit = true; (chest || model).add(glow);   /* 가슴 균열 — 유일한 예고 빛 (문서 181) */
  o.kfx = { kit, bolts, dim: 0, telling: false, warnSeq: -1, warnBeat: -1, ringPool, ringActive: 0, floor, glow, baseY: model.position.y, reduced, clip: null, seq: NaN, hitIdx: 0, from: null };
  play(o, kit.idleClip || 'idle', true); return o.kfx;
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
    else play(o, a.motion === 'walk' || a.motion === 'return' ? 'walk' : (fx.kit.idleClip || 'idle'), true); }
}
/* mixer.update 전에 — 서버 시계로 클립 시각을 정한다 (헤드리스·느린 기기에서도 박자가 같다) */
export function prepareKitMotion(o, now) {
  const fx = o.kfx, a = o.netAct; if (!fx || !a || a.motion !== 'skill') return; const def = fx.kit.skills[a.skill], act = def && o.kacts[def.clip]; if (!act) return;
  const t0 = Math.max(0, now - a.startedAt), j = def.jitter, t = j && t0 > j.at ? Math.max(j.at, t0 - (a.shift || 0)) : t0;   /* 리듬 깨기: 멈춤 자세를 그만큼 더 붙든다 */
  const dur = act.getClip().duration; act.paused = true; act.time = def.cue ? curve(def.cue, t) * dur : Math.min(dur - 1e-3, t / 1000);
}
export function updateKitMotion(o, dt, now) {
  const fx = o.kfx, a = o.netAct, ev = {}; if (!fx) return ev; const dying = !!(o.stage && o.stage.dying);
  const skill = a && a.motion === 'skill' ? fx.kit.skills[a.skill] : null, t = a ? Math.max(0, now - a.startedAt) : 0;
  if (a && !dying) {
    if (skill && skill.move && fx.from) { const d = curve(skill.move, t); o.root.position.x = fx.from.x + Math.sin(a.yaw) * d; o.root.position.z = fx.from.z + Math.cos(a.yaw) * d; o.root.rotation.y = a.yaw; }
    else { const k = Math.min(1, dt * (skill ? 14 : 9)); o.root.position.x += (a.x - o.root.position.x) * k; o.root.position.z += (a.z - o.root.position.z) * k; o.root.rotation.y = yawLerp(o.root.rotation.y, a.yaw, Math.min(1, dt * (skill ? 12 : 4))); }
    if (o.model) o.model.position.y = fx.baseY + (skill && skill.lift ? curve(skill.lift, t) : 0);   /* 떠오름: 몸만 올린다 — 판정 자리(x,z)는 그대로 */
  }
  /* 바닥 예고는 없다 (디렉터 «의미 없어» — 문서 224). 같은 박자로 몸이 준비 동작을 한다(windup.js). 지금 박자는 소리(boss-stage)용으로만 셈 */
  let tell = -1; if (skill && skill.tells && !dying) for (let i = 0; i < skill.tells.length; i++) { const q = skill.tells[i]; if (!q.post && t >= S(skill, a, q.from) && t <= S(skill, a, q.at)) tell = i; }
  fx.telling = tell >= 0; if (fx.telling) { fx.warnSeq = a.seq; fx.warnBeat = tell; }
  if (o.wind) applyWind(o, dying ? null : winds(skill, a), t, fx.reduced);
  { const q = tell >= 0 && skill.tells[tell], p = q ? Math.max(0, Math.min(1, (t - S(skill, a, q.from)) / Math.max(1, S(skill, a, q.at) - S(skill, a, q.from)))) : 0;   /* 가슴 균열 — 몸의 일부(바닥 표시 아님) */
    fx.glow.intensity += ((q ? 1 + p * 4 : skill ? 1.6 : .6) - fx.glow.intensity) * Math.min(1, dt * 6); }
  /* 무거운 판정이 지나가면 충격(카메라 킥·고리) — 난무 잔타는 빼고 */
  if (skill && !dying) while (fx.hitIdx < skill.hits.length && t >= S(skill, a, skill.hits[fx.hitIdx].at)) { const i = fx.hitIdx++, h = skill.hits[i], mk = h.atTarget && a.marks && a.marks[i];
    if (mk) { const b = fx.bolts.find(q => q.t > .3) || fx.bolts[0]; if (b) { b.t = 0; b.m.position.set(mk[0], fx.floor + 8, mk[1]); b.m.visible = true; } ring(fx, mk[0], mk[1], h.radius * 1.6); ev.impact = true; ev.bolt = mk; }   /* 낙뢰 */
    else if (!h.pool && h.damage >= .1) { ev.impact = true; ring(fx, o.root.position.x, o.root.position.z, h.radius || 3); } }
  /* 대상 발밑 표식은 그리지 않는다 — 찍히는 순간 경고음만 (낙뢰 자체는 공격이라 그린다) */
  if (skill && !dying && a.marks) skill.hits.forEach((h, i) => { const mk = a.marks[i]; if (!h.atTarget || !mk) return; const hit = S(skill, a, h.at);
    if (t >= hit - h.lead && t < hit) { const key = a.seq + ':' + i; if (fx.markKey !== key) { fx.markKey = key; ev.tele = true; } } });
  for (const b of fx.bolts) if (b.t <= .3) { b.t += dt; b.m.material.opacity = Math.max(0, 1 - b.t / .25) * (fx.reduced ? .5 : 1); b.m.scale.x = b.m.scale.z = 1 + (fx.reduced ? 0 : Math.random() * .6); if (b.t > .3) b.m.visible = false; }
  fx.dim = skill && skill.dim && !dying ? curve(skill.dim, t) : Math.max(0, fx.dim - dt * 1.5);   /* 방전 폭우: 하늘이 어두워진다 — boss-stage 가 화면에 깐다 */
  for (const r of fx.ringPool) if (r.active) { r.t += dt; const k = Math.min(1, r.t / r.life); r.m.scale.setScalar(fx.reduced ? r.r : r.r * (.25 + .75 * k)); r.m.material.opacity = (1 - k) * .85; if (k >= 1) { r.active = false; r.m.visible = false; fx.ringActive = Math.max(0, fx.ringActive - 1); } }
  return ev;
}
function ring(fx, x, z, r) { const p = fx.ringPool.find(q => !q.active) || fx.ringPool[0]; p.active = true; p.t = 0; p.life = .7; p.r = r; p.m.visible = true; p.m.position.set(x, fx.floor + .06, z); fx.ringActive++; }
export function hideKitMotion(o) { const fx = o.kfx; if (!fx) return; fx.telling = false; fx.dim = 0; if (o.wind) applyWind(o, null, 0); fx.glow.intensity = 0; o.netAct = null; fx.seq = NaN; if (o.model) o.model.position.y = fx.baseY; }
