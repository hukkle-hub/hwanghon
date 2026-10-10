/* 필드 손맛 (문서 205) — 솔로(game3d)와 같은 표(js/dungeons.js RULES)로 «날이 닿는 프레임» 에 효과를 모은다.
   v11 규칙: 판정보다 효과가 먼저 나오지 않는다 · 궤적은 실제 무기 궤도 · 접점에 충격·소리·히트스톱이 한 덩어리 · 평타 효과는 짧고 얇게.
   서버 판정은 그대로다 (누를 때 보낸다 — 클레이브 반격 창을 바꾸지 않는다). 화면만 접점 시각으로 미룬다.
   히트스톱은 «화면에서만» 멈춘다 (v11: 온라인은 시뮬을 멈추지 않고 표시만) — 서버 시계·위치 보정은 그대로 흐른다.
   시간은 전부 게임 시간(tick 의 dt)으로 센다 — setTimeout 은 헤드리스(초당 1~2프레임)에서 동작보다 먼저 터진다 (CLAUDE.md §1).
   궤적은 내 영웅만 (v11 MMO 주의: 주변 플레이어 연출은 단순화). */
import * as THREE from '../../vendor/three/three.module.js';
import { WeaponTrail, trailStyle } from '../weapon-trail.js';

const RULES = () => globalThis.TW_DUNGEONS?.RULES || {};
/* 클립 안 접점 위치(0~1) — 솔로와 같은 표. 캐릭터별 값이 먼저 */
export function contactOf(char, clip) { const m = RULES().motion || {}; return m.clipContactsByChar?.[char]?.[clip] ?? m.clipContacts?.[clip] ?? 0.4; }
/* 히트스톱 길이(초) — 솔로 표 × 무기 리듬 (대검은 길게, 쌍단검은 짧게) */
export function stopFor(kind, char) { const hs = RULES().hitstop || {}, rh = RULES().rhythm?.[char]; return (hs[kind] ?? hs.light ?? 0.09) * (rh?.stop ?? 1); }
/* 궤적이 켜지는 구간(초) — js/combat-quality.js trailActive 와 같다: 접점 60% 지점부터 접점 + 0.22 s */
export function trailWindow(hitAt) { return [hitAt * 0.6, hitAt + 0.22]; }
export function swingTrailActive(s){return !!s&&s.at.some(t=>{const w=trailWindow(t);return s.t>=w[0]&&s.t<=w[1];});}

let GLOW = null;
function glow() { if (GLOW || typeof document === 'undefined') return GLOW;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return (GLOW = new THREE.CanvasTexture(c)); }

export function createFieldFeel(scene, { reduced = false, sfx = () => globalThis.TW_SFX, react = null } = {}) {
  const queue = [], stops = new Map(), sparks = [], swingers = new Set(); let trail = null, trailOwner = null, last = null;
  const api = {
    /* 휘두름 시작: 접점 시각(초)·궤적 색을 정해 둔다. hits = 스킬 접점들 [[위치,비중]...] (피의 회전 2타) */
    swing(h, clip, { char = h.id, kind = 'light', hits = null } = {}) {
      const a = h.act?.[clip], dur = a ? a.getClip().duration : 1, at = (hits && hits.length ? hits.map(x => x[0]) : [contactOf(char, clip)]).map(u => u * dur);
      h.swing = { clip, kind, char, t: 0, dur, at, hitAt: at[0] }; swingers.add(h);
      if (h === trailOwner && trail) { const st = trailStyle(kind === 'skill' ? 'skill' : 'light'); trail.set(st[0], st[1]); }
      return h.swing; },
    /* k 번째 접점까지 남은 시간(초). 휘두르지 않았으면 0 — 바로 */
    contactDelay(h, k = 0) { const s = h.swing; if (!s) return 0; return Math.max(0, (s.at[Math.min(k, s.at.length - 1)] ?? s.hitAt) - s.t); },
    schedule(sec, fn) { queue.push({ t: Math.max(0, sec), fn }); },
    /* k 번째 접점에 — 휘두름 «자체의 시계» 로 잰다. 히트스톱 동안은 이 시계도 멈추므로 피의 회전 2타가 앞당겨지지 않는다.
       휘두름이 끝났거나 다른 동작으로 바뀌었으면(서버 답이 늦게 왔다) 바로 */
    atContact(h, k, fn) { queue.push({ h, k, sw: h.swing, fn }); },
    /* 접점: 불꽃(접점 중심, 작게) + 히트스톱(나와 맞은 쪽 둘 다) + 소리(원하면). 반환 = 멈춘 시간 */
    impact(h, target, { kind = null, crit = false, counter = false, point = null, sound = true } = {}) {
      const k = counter ? 'perfect' : kind || (h.swing?.kind === 'skill' ? 'smash' : crit ? 'chain' : 'light'), stop = stopFor(k, h.swing?.char || h.id);
      if (!reduced) { stops.set(h, Math.max(stops.get(h) || 0, stop)); if (target) stops.set(target, Math.max(stops.get(target) || 0, stop)); }
      const p = point || api.contactPoint(h, target); if (p) api.burst(p, counter ? 0xfff1c8 : crit ? 0xffc070 : 0xffe2b0, counter ? 1.5 : crit ? 1.2 : 1);
      if (sound) sfx()?.play?.(counter ? 'counter' : 'hit', counter || { heavy: crit || k !== 'light', material: 'flesh', tier: crit ? 'crit' : k === 'light' ? 'light' : 'heavy' });
      last = { kind: k, stop, crit, counter, at: p && [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] };
      if (react && target) react(h, target, last);   /* 대상 반응 (지배형 움찔) — 같은 접점 프레임에 */
      return stop; },
    /* 접점 자리: 맞은 쪽 몸 겉면(내 쪽으로 0.45 m), 가슴 높이 */
    contactPoint(h, target) { const a = h.root?.position, b = target?.root?.position; if (!a) return null; if (!b) return new THREE.Vector3(a.x, 1.2, a.z);
      const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz) || 1, y = Math.min(1.5, Math.max(0.9, (target.h || 2.2) * 0.5));
      return new THREE.Vector3(b.x + dx / d * Math.min(0.45, d * .5), y, b.z + dz / d * Math.min(0.45, d * .5)); },
    burst(p, color = 0xffe2b0, size = 1) { if (reduced || !glow()) return; const n = Math.round(7 * size);
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: .9 }));
      core.position.copy(p); core.scale.setScalar(.38 * size); core.renderOrder = 4; scene.add(core); sparks.push({ o: core, t: 0, life: .11, v: null, s0: .38 * size, grow: 1.4 });
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, up = .3 + Math.random() * .9, sp = 3 + Math.random() * 4 * size;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        s.position.copy(p); s.scale.set(.09, .09, 1); s.renderOrder = 4; scene.add(s);
        sparks.push({ o: s, t: 0, life: .16 + Math.random() * .12, v: new THREE.Vector3(Math.cos(a) * sp, up * sp * .6, Math.sin(a) * sp), s0: .09 }); } },
    /* 이 물체의 애니메이션 배속 — 히트스톱 중엔 0 */
    rate(o) { return (stops.get(o) || 0) > 0 ? 0 : 1; },
    stopped(o) { return (stops.get(o) || 0) > 0; },
    /* 내 영웅의 무기에 궤적을 단다 (무기 GLB 가 늦게 붙으므로 onMain 에서 다시 부른다) */
    attachTrail(h) { if (!trail) trail = new WeaponTrail(scene); trailOwner = h; },
    tick(dt) {
      for (const [o, t] of stops) { const r = t - dt; if (r > 0) stops.set(o, r); else stops.delete(o); }
      for (const h of swingers) { if (!h.swing) { swingers.delete(h); continue; } h.swing.t += dt * api.rate(h); if (h.swing.t > h.swing.dur) { h.swing = null; swingers.delete(h); } }
      for (let i = 0; i < queue.length; i++) { const q = queue[i]; let due;
        if (q.h) { const sw = q.sw; due = !sw || q.h.swing !== sw || sw.t >= (sw.at[Math.min(q.k, sw.at.length - 1)] ?? sw.hitAt) - 1e-9; }
        else { q.t -= dt; due = q.t <= 0; }
        if (due) { queue.splice(i--, 1); try { q.fn(); } catch (e) { console.warn('[feel]', e); } } }
      if (trail && trailOwner) { const on=swingTrailActive(trailOwner.swing); trail.tick(dt * api.rate(trailOwner), trailOwner.weapon || null, on); }
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t += dt; const k = s.t / s.life;
        if (s.v) { s.o.position.addScaledVector(s.v, dt); s.v.multiplyScalar(Math.max(0, 1 - dt * 6)); s.v.y -= 9 * dt; s.o.scale.set(s.s0 * (1 + k), s.s0 * (1 + k), 1); }
        else s.o.scale.setScalar(s.s0 * (1 + k * (s.grow || 0)));
        s.o.material.opacity = Math.max(0, 1 - k) * (s.v ? 1 : .9);
        if (k >= 1) { scene.remove(s.o); s.o.material.dispose(); sparks.splice(i, 1); } } },
    get last() { return last; }, get pending() { return queue.length; }, get sparks() { return sparks.length; }, get trail() { return trail; },
  };
  return api;
}
