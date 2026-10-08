/* 황혼 2D 맵 MMORPG — 실내 던전 빌더 (docs/design/185 §6.7)
   OSM 이 없는 곳(벙커·지하 선로·공동구·연구소 지하·격납고 …)을 «방·통로 배치표» 로 세운다.
   좌표는 길 좌표 (s, t) — s 는 화면 대각선(오른쪽 위), t 는 건너편(위)이 + . 리니지 던전 층처럼 한 층 = 한 지역.
   spec (js/mmo/zones.js 의 indoor):
     rooms: [{ id, s:[s0,s1], t:[t0,t1], floor, h, light, props:[…] }]   — 겹치거나 맞닿은 벽은 자동으로 터진다(통로)
     water: 0.6 (게임이 그리는 물면 높이 — 굽지 않는다, 인물이 묻히면 안 된다 · tests/map-height.test.cjs)
     theme: { wall, floor, fog, hemi, flicker }
     gates · bosses · spawn: 방 id 와 그 안 (u, v) 비율(0~1) 로 찍는다 */
import { PITCH, SCREEN_ANG, rng, canvasTex, inPoly, bareSpot } from './env-lib.js';
export { PITCH };

export function build(THREE, scene, osm, zone) {
  const spec = zone.indoor, R = rng(spec.seed || 20261009), lights = [], blockers = [];
  const DIR = [Math.cos(SCREEN_ANG), -Math.sin(SCREEN_ANG)], SIDE = [-Math.sin(SCREEN_ANG), -Math.cos(SCREEN_ANG)];
  const FROM = (s, t) => [s * DIR[0] + t * SIDE[0], s * DIR[1] + t * SIDE[1]], ST = ([x, z]) => [x * DIR[0] + z * DIR[1], x * SIDE[0] + z * SIDE[1]];
  const T = (w, h, d, r) => canvasTex(THREE, w, h, d, r), th = spec.theme || {};
  const rooms = spec.rooms.map(r => ({ ...r, s0: Math.min(...r.s), s1: Math.max(...r.s), t0: Math.min(...r.t), t1: Math.max(...r.t) }));
  const roomById = id => rooms.find(r => r.id === id);
  const inRoom = (s, t, pad = 0) => rooms.some(r => s > r.s0 - pad && s < r.s1 + pad && t > r.t0 - pad && t < r.t1 + pad);
  const at = (id, u = 0.5, v = 0.5) => { const r = roomById(id); return FROM(r.s0 + (r.s1 - r.s0) * u, r.t0 + (r.t1 - r.t0) * v); };
  const box = (w, h, d, mat, x, y, z, rotY = 0, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = rotY; m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };
  const block = (x, z, hw, hd, rot = 0) => blockers.push({ x: +x.toFixed(2), z: +z.toFixed(2), hw: +hw.toFixed(2), hd: +hd.toFixed(2), rot: +rot.toFixed(4) });

  /* ---------- 재질 ---------- */
  const noise = (g, w, h, base, lo, amp, n) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const v = lo + R() * amp | 0; g.fillStyle = `rgba(${v},${v},${v + 2},.4)`; g.fillRect(R() * w, R() * h, 3, 3); } };
  const FLOORS = {
    concrete: T(256, 256, (g, w, h) => { noise(g, w, h, '#4a4846', 60, 30, 1800); g.strokeStyle = 'rgba(20,20,20,.4)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke(); } }, [1 / 4, 1 / 4]),
    tile: T(256, 256, (g, w, h) => { g.fillStyle = '#8a8c88'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(40,44,44,.6)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke(); } for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(60,50,40,.15)'; g.fillRect(R() * w, R() * h, 6, 6); } }, [1 / 2.4, 1 / 2.4]),
    terrazzo: T(256, 256, (g, w, h) => { noise(g, w, h, '#6a6660', 80, 70, 2400); }, [1 / 2.4, 1 / 2.4]),
    metal: T(256, 256, (g, w, h) => { g.fillStyle = '#4a4e52'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(30,32,34,.8)'; for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 8; x < w; x += 16) g.fillRect(x, y, 10, 3); }, [1 / 1.2, 1 / 1.2]),
    asphalt: T(256, 256, (g, w, h) => { noise(g, w, h, '#34353a', 40, 30, 3000); }, [1 / 4, 1 / 4]),
    mat: T(256, 256, (g, w, h) => { g.fillStyle = '#2a3a34'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.4)'; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } }, [1 / 2, 1 / 2]),
    gravel: T(256, 256, (g, w, h) => { noise(g, w, h, '#3e3a36', 50, 50, 5000); }, [1 / 2, 1 / 2]) };
  const floorMats = {}; const floorM = k => floorMats[k] || (floorMats[k] = new THREE.MeshStandardMaterial({ map: FLOORS[k] || FLOORS.concrete, roughness: k === 'metal' ? 0.4 : 0.22, metalness: k === 'metal' ? 0.6 : 0.12, color: th.floorTint || 0xa8b0b0 }));   /* 젖은 바닥 — 반사가 조금 */
  const wallTex = T(256, 128, (g, w, h) => { g.fillStyle = th.wall || '#3e3c40'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, h - 18, w, 18); g.fillStyle = th.stripe || 'rgba(90,120,110,.35)'; g.fillRect(0, h * 0.6, w, 6); for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(20,16,14,.18)'; g.fillRect(R() * w, R() * h, 4 + R() * 20, 2 + R() * 30); } });
  const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 }), cutM = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.9 }), steelM = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.4, metalness: 0.7 }), rustM = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.8, metalness: 0.4 });
  const woodM = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 }), clothM = new THREE.MeshStandardMaterial({ color: 0x4a4a5a, roughness: 1 }), glassM = new THREE.MeshStandardMaterial({ color: 0x5a7a88, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.4 });

  /* ---------- 바닥 ---------- */
  for (const r of rooms) { const pts = [[r.s0, r.t0], [r.s1, r.t0], [r.s1, r.t1], [r.s0, r.t1]].map(([s, t]) => FROM(s, t));
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])))); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, g.attributes.position.getX(i), g.attributes.position.getY(i));
    const m = new THREE.Mesh(g, floorM(r.floor || th.floor || 'concrete')); m.rotation.x = -Math.PI / 2; m.position.y = 0.001 * rooms.indexOf(r); m.receiveShadow = true; scene.add(m); }

  /* ---------- 벽: 방 둘레 1 m 조각. 다른 방이 맞닿은 곳은 터진다. 카메라 쪽 벽은 1 m 로 ---------- */
  let wallN = 0;
  for (const r of rooms) { const H = r.h || th.h || 3.6;
    const edges = [ { a: [r.s0, r.t0], b: [r.s1, r.t0], n: [0, -1] }, { a: [r.s1, r.t0], b: [r.s1, r.t1], n: [1, 0] }, { a: [r.s1, r.t1], b: [r.s0, r.t1], n: [0, 1] }, { a: [r.s0, r.t1], b: [r.s0, r.t0], n: [-1, 0] } ];
    for (const e of edges) { const L = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), k = Math.max(1, Math.round(L)); let run = null;
      const nW = [e.n[0] * DIR[0] + e.n[1] * SIDE[0], e.n[0] * DIR[1] + e.n[1] * SIDE[1]], cut = !zone.view3d && nW[1] > 0.35, h = cut ? Math.min(1.0, H) : H;   /* view3d(3D 필드, 문서 206): 카메라가 돌아가므로 자르지 않는다 */
      const flush = () => { if (!run) return; const [u0, u1] = run, sA = e.a[0] + (e.b[0] - e.a[0]) * u0, tA = e.a[1] + (e.b[1] - e.a[1]) * u0, sB = e.a[0] + (e.b[0] - e.a[0]) * u1, tB = e.a[1] + (e.b[1] - e.a[1]) * u1;
        const mid = FROM((sA + sB) / 2 + e.n[0] * 0.18, (tA + tB) / 2 + e.n[1] * 0.18), len = Math.hypot(sB - sA, tB - tA), along = e.n[0] === 0, rot = along ? SCREEN_ANG : SCREEN_ANG + Math.PI / 2;
        box(len + 0.05, h, 0.36, cut ? cutM : wallM, mid[0], h / 2, mid[1], rot); block(mid[0], mid[1], len / 2 + 0.03, 0.26, rot); wallN++; run = null; };
      for (let j = 0; j < k; j++) { const u0 = j / k, u1 = (j + 1) / k, um = (u0 + u1) / 2, s = e.a[0] + (e.b[0] - e.a[0]) * um, t = e.a[1] + (e.b[1] - e.a[1]) * um;
        const open = rooms.some(o => o !== r && s + e.n[0] * 0.6 > o.s0 && s + e.n[0] * 0.6 < o.s1 && t + e.n[1] * 0.6 > o.t0 && t + e.n[1] * 0.6 < o.t1);
        if (open) flush(); else run = run ? [run[0], u1] : [u0, u1]; }
      flush(); }
    if (zone.view3d) { const c = FROM((r.s0 + r.s1) / 2, (r.t0 + r.t1) / 2), ce = new THREE.Mesh(new THREE.BoxGeometry(r.s1 - r.s0 + 0.4, 0.12, r.t1 - r.t0 + 0.4), cutM); ce.position.set(c[0], H + 0.06, c[1]); ce.rotation.y = SCREEN_ANG; ce.receiveShadow = true; ce.userData.camBlock = true; scene.add(ce); } }   /* 천장 — 위에서 보는 굽기엔 없다 */

  /* ---------- 빛: 방마다 천장 등. light: 'fluo'(형광등) · 'red'(비상등) · 'warm'(드럼통 불·백열) · 'none' ---------- */
  const LCOL = { fluo: 0xdff4ff, red: 0xff3a2a, warm: 0xffa860, green: 0x60ff9a, blue: 0x60a8ff };
  for (const r of rooms) { const kind = r.light || th.light || 'fluo'; if (kind === 'none') continue; const col = LCOL[kind] || LCOL.fluo, step = r.lightStep || 9;
    for (let s = r.s0 + step / 2; s < r.s1; s += step) for (let t = r.t0 + step / 2; t < r.t1; t += step) { const p = FROM(s, t), y = Math.min((r.h || th.h || 3.6) - 0.2, 6);
      const L = new THREE.PointLight(col, kind === 'red' ? 8 : 14, step * 1.6, 1.4); L.position.set(p[0], y, p[1]); scene.add(L); lights.push({ x: p[0], y, z: p[1], color: '#' + new THREE.Color(col).getHexString(), intensity: kind === 'red' ? 6 : 10, distance: step * 1.4 });
      if (kind === 'fluo') box(1.4, 0.06, 0.14, new THREE.MeshBasicMaterial({ color: 0xeaf8ff, toneMapped: false }), p[0], y + 0.1, p[1], SCREEN_ANG, false); } }
  scene.add(new THREE.HemisphereLight(th.hemi || 0x9ab0c0, 0x1a1816, th.hemiI ?? 2.2));
  const key = new THREE.DirectionalLight(0xbfd8e8, 1.0); key.position.set(-3, 10, 4); scene.add(key);
  scene.background = new THREE.Color(th.fog || 0x040406);

  /* ---------- 소품 ---------- 방마다 props: [{ k, ... }] — 방 안 무작위 자리(벽에서 1.2 m 띄움) 또는 u,v 지정 */
  const spot = (r, o = {}) => { const u = o.u ?? (0.12 + R() * 0.76), v = o.v ?? (0.12 + R() * 0.76); return [r.s0 + (r.s1 - r.s0) * u, r.t0 + (r.t1 - r.t0) * v]; };
  const PROPS = {
    pillars(r, o) { const st = o.step || 8; for (let s = r.s0 + st / 2; s < r.s1 - 1; s += st) for (let t = r.t0 + st / 2; t < r.t1 - 1; t += st) { const p = FROM(s, t), H = r.h || th.h || 3.6; box(0.8, H, 0.8, o.mat === 'steel' ? steelM : darkM, p[0], H / 2, p[1], SCREEN_ANG); block(p[0], p[1], 0.4, 0.4, SCREEN_ANG); } },
    crates(r, o) { for (let i = 0; i < (o.n || 6); i++) { const [s, t] = spot(r, o), p = FROM(s, t), w = 0.9 + R() * 0.6; box(w, w * 0.8, w, woodM, p[0], w * 0.4, p[1], R() * 3); block(p[0], p[1], w / 2, w / 2, 0); } },
    drums(r, o) { for (let i = 0; i < (o.n || 4); i++) { const [s, t] = spot(r, o), p = FROM(s, t); const d = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), rustM); d.position.set(p[0], 0.45, p[1]); d.castShadow = true; scene.add(d); block(p[0], p[1], 0.32, 0.32);
        if (o.fire) { const f = new THREE.PointLight(0xff8a40, 8, 7, 1.6); f.position.set(p[0], 1.3, p[1]); scene.add(f); lights.push({ x: p[0], y: 1.3, z: p[1], color: '#ff8a40', intensity: 6, distance: 6 });
          const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false })); fl.position.set(p[0], 1.1, p[1]); scene.add(fl); } } },
    cots(r, o) { for (let i = 0; i < (o.n || 6); i++) { const [s, t] = spot(r, o), p = FROM(s, t); box(0.8, 0.4, 1.9, clothM, p[0], 0.2, p[1], SCREEN_ANG + (R() < 0.5 ? 0 : Math.PI / 2)); block(p[0], p[1], 0.5, 0.95, SCREEN_ANG); } },
    shelves(r, o) { for (let i = 0; i < (o.n || 4); i++) { const [s, t] = spot(r, o), p = FROM(s, t); box(2.2, 1.9, 0.6, steelM, p[0], 0.95, p[1], SCREEN_ANG + (o.along ? 0 : Math.PI / 2)); block(p[0], p[1], 1.1, 0.3, SCREEN_ANG + (o.along ? 0 : Math.PI / 2)); } },
    crt(r, o) { /* 인력사무소 — 벽 한 면이 CRT, 절반은 죽었다 */ const t = r.t1 - 0.6; for (let s = r.s0 + 1; s < r.s1 - 1; s += 0.9) for (let row = 0; row < 3; row++) { const p = FROM(s, t), live = R() < 0.5;
        box(0.8, 0.62, 0.5, darkM, p[0], 0.5 + row * 0.66, p[1], SCREEN_ANG, false); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46), new THREE.MeshBasicMaterial({ color: live ? (R() < 0.3 ? 0x60ff9a : 0x7ac8ff) : 0x0a0c0e, toneMapped: false }));
        const q = FROM(s, t - 0.26); sc.position.set(q[0], 0.5 + row * 0.66, q[1]); sc.rotation.y = Math.atan2(-SIDE[0], -SIDE[1]); scene.add(sc); } block(...FROM((r.s0 + r.s1) / 2, t), (r.s1 - r.s0) / 2, 0.3, SCREEN_ANG); },
    table(r, o) { const [s, t] = spot(r, { u: o.u ?? 0.5, v: o.v ?? 0.5 }), p = FROM(s, t); box(o.w || 2.4, 0.08, o.d || 1.2, woodM, p[0], 0.8, p[1], SCREEN_ANG); for (const dx of [-1, 1]) for (const dz of [-1, 1]) { const q = FROM(s + dx * ((o.w || 2.4) / 2 - 0.1), t + dz * ((o.d || 1.2) / 2 - 0.1)); box(0.08, 0.8, 0.08, woodM, q[0], 0.4, q[1]); } block(p[0], p[1], (o.w || 2.4) / 2, (o.d || 1.2) / 2, SCREEN_ANG);
      if (o.glow) { const L = new THREE.PointLight(0x40c8ff, 8, 6, 1.6); L.position.set(p[0], 1.4, p[1]); scene.add(L); lights.push({ x: p[0], y: 1.4, z: p[1], color: '#40c8ff', intensity: 6, distance: 6 }); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.02, 24), new THREE.MeshBasicMaterial({ color: 0x40c8ff, transparent: true, opacity: 0.5, toneMapped: false })); h.position.set(p[0], 0.9, p[1]); scene.add(h); } },
    forge(r, o) { /* 한 장인의 작업대 — 화로와 모루 */ const [s, t] = spot(r, { u: o.u ?? 0.5, v: o.v ?? 0.5 }), p = FROM(s, t); box(1.4, 1.0, 1.0, darkM, p[0], 0.5, p[1], SCREEN_ANG); const fire = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.6), new THREE.MeshBasicMaterial({ color: 0xff7020, toneMapped: false })); fire.position.set(p[0], 1.02, p[1]); fire.rotation.y = SCREEN_ANG; scene.add(fire);
      const L = new THREE.PointLight(0xff7a30, 14, 9, 1.4); L.position.set(p[0], 1.8, p[1]); scene.add(L); lights.push({ x: p[0], y: 1.8, z: p[1], color: '#ff7a30', intensity: 10, distance: 8 }); const q = FROM(s + 1.6, t); box(0.5, 0.7, 0.3, steelM, q[0], 0.35, q[1]); block(p[0], p[1], 1.2, 0.7, SCREEN_ANG); },
    posters(r, o) { /* 실종자 벽보 수백 장 — 먼 벽 */ const t = r.t1 - 0.2; for (let s = r.s0 + 0.5; s < r.s1 - 0.5; s += 0.32) for (let y = 0.9; y < 2.6; y += 0.36) { if (R() < 0.2) continue; const q = FROM(s + (R() - .5) * 0.1, t); const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.32), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.1, 0.1, 0.65 + R() * 0.25), roughness: 1 })); pl.position.set(q[0], y + (R() - .5) * 0.06, q[1]); pl.rotation.y = Math.atan2(-SIDE[0], -SIDE[1]) + (R() - .5) * 0.1; scene.add(pl); } },
    laundry(r, o) { for (let i = 0; i < (o.n || 4); i++) { const [s, t] = spot(r, o); const a = FROM(s - 2, t), b = FROM(s + 2, t); const line = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 4, 4), steelM); const c = FROM(s, t); line.position.set(c[0], 2.2, c[1]); line.rotation.z = Math.PI / 2; line.rotation.y = SCREEN_ANG; scene.add(line);
        for (let k = -1.6; k <= 1.6; k += 0.5) { if (R() < 0.3) continue; const q = FROM(s + k, t); const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(R(), 0.3, 0.45), roughness: 1, side: THREE.DoubleSide })); cl.position.set(q[0], 1.9, q[1]); cl.rotation.y = SCREEN_ANG; scene.add(cl); } } },
    vault(r, o) { /* 원형 금고문 (출격문 B-1, 지름 4.8 m) — 먼 벽에 세워 카메라를 본다 */ const s = r.s0 + (r.s1 - r.s0) * (o.u ?? 0.5), t = r.t1 - 0.45, p = FROM(s, t);
      const g = new THREE.Group(); g.position.set(p[0], 2.5, p[1]); g.rotation.y = Math.atan2(SIDE[0], SIDE[1]);   /* 로컬 +z = 벽 바깥(먼 쪽) */
      const d = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.5, 40), steelM); d.rotation.x = Math.PI / 2; g.add(d);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.2, 10, 40), rustM); ring.position.z = -0.25; g.add(ring);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, bolt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.2), rustM); bolt.position.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, -0.3); bolt.rotation.z = a; g.add(bolt); }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), rustM); hub.rotation.x = Math.PI / 2; hub.position.z = -0.35; g.add(hub);
      g.traverse(m => { if (m.isMesh) m.castShadow = true; }); scene.add(g); },
    rails(r, o) { /* 선로 — 자갈 + 레일 두 가닥 + 침목. s 방향 */ for (const tt of o.t || [(r.t0 + r.t1) / 2]) { const a = FROM(r.s0, tt), b = FROM(r.s1, tt), L = r.s1 - r.s0, c = FROM((r.s0 + r.s1) / 2, tt);
        box(L, 0.04, 3.0, new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 1 }), c[0], 0.02, c[1], SCREEN_ANG, false);
        for (const off of [-0.72, 0.72]) { const q = FROM((r.s0 + r.s1) / 2, tt + off); box(L, 0.14, 0.1, steelM, q[0], 0.18, q[1], SCREEN_ANG, false); }
        for (let s = r.s0 + 0.3; s < r.s1; s += 0.7) { const q = FROM(s, tt); box(0.22, 0.1, 2.4, woodM, q[0], 0.08, q[1], SCREEN_ANG, false); } } },
    platform(r, o) { /* 승강장 가장자리 — 노란 선, 스크린도어 */ const t = o.t ?? r.t0 + 0.3; for (let s = r.s0 + 1; s < r.s1 - 1; s += 1.9) { const q = FROM(s, t); box(1.8, 2.2, 0.08, glassM, q[0], 1.1, q[1], SCREEN_ANG, false); box(1.84, 0.08, 0.1, steelM, q[0], 2.2, q[1], SCREEN_ANG, false); }
      const y = FROM((r.s0 + r.s1) / 2, t - 0.5); box(r.s1 - r.s0, 0.01, 0.3, new THREE.MeshBasicMaterial({ color: 0xd8b030 }), y[0], 0.01, y[1], SCREEN_ANG, false); },
    pipes(r, o) { /* 벽을 따라 배관·케이블 다발 (공동구) */ for (const side of [r.t0 + 0.4, r.t1 - 0.4]) for (let k = 0; k < (o.n || 3); k++) { const c = FROM((r.s0 + r.s1) / 2, side), y = 0.6 + k * 0.45; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12 + R() * 0.08, 0.12, r.s1 - r.s0, 10), k % 2 ? steelM : rustM); p.position.set(c[0], y, c[1]); p.rotation.z = Math.PI / 2; p.rotation.y = SCREEN_ANG; p.castShadow = true; scene.add(p); } },
    parking(r, o) { /* 주차장 — 칸 선, 기둥, 서 있는 차 */ const lineM = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 }); for (let s = r.s0 + 1; s < r.s1 - 1; s += 2.6) for (const t of [r.t0 + 2.6, r.t1 - 2.6]) { const q = FROM(s, t); box(0.1, 0.01, 5, lineM, q[0], 0.012, q[1], SCREEN_ANG, false);
        if (R() < (o.cars ?? 0.4)) { const c = FROM(s + 1.3, t); box(1.8, 1.2, 4.4, new THREE.MeshStandardMaterial({ color: [0xd8d8dc, 0x1a1a1e, 0x8a8c94, 0x5a1418][(R() * 4) | 0], roughness: 0.3, metalness: 0.6 }), c[0], 0.6, c[1], SCREEN_ANG); block(c[0], c[1], 0.9, 2.2, SCREEN_ANG); } } },
    capsules(r, o) { /* 표본 캡슐 — 원형 홀 둘레 */ const c = [(r.s0 + r.s1) / 2, (r.t0 + r.t1) / 2], rad = Math.min(r.s1 - r.s0, r.t1 - r.t0) / 2 - 2; for (let k = 0; k < (o.n || 16); k++) { const a = k / (o.n || 16) * Math.PI * 2, s = c[0] + Math.cos(a) * rad, t = c[1] + Math.sin(a) * rad, p = FROM(s, t);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.4, 16), glassM); cap.position.set(p[0], 1.2, p[1]); scene.add(cap); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: 0x8a9a8a, roughness: 0.6, emissive: 0x0a2a1a })); body.position.set(p[0], 1.2, p[1]); scene.add(body);
        const L = new THREE.PointLight(0x60ffb0, 4, 4, 1.8); L.position.set(p[0], 0.3, p[1]); scene.add(L); block(p[0], p[1], 0.6, 0.6); } },
    vehicles(r, o) { /* 격납고 — 장갑차·자주포·트레일러 (엄폐물) */ for (let i = 0; i < (o.n || 8); i++) { const [s, t] = spot(r, o), p = FROM(s, t), big = R() < 0.4, rot = SCREEN_ANG + (R() < 0.5 ? 0 : Math.PI / 2);
        const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(big ? 7 : 6, 1.6, 3), new THREE.MeshStandardMaterial({ color: 0x4a5040, roughness: 0.7, metalness: 0.3 }))); g.children[0].position.y = 1.2;
        const tur = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 2.2), g.children[0].material); tur.position.set(-0.5, 2.4, 0); g.add(tur); if (big) { const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5, 8), steelM); gun.rotation.z = Math.PI / 2; gun.position.set(2.6, 2.5, 0); g.add(gun); }
        g.position.set(p[0], 0, p[1]); g.rotation.y = rot; g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(g); block(p[0], p[1], (big ? 7 : 6) / 2, 1.5, rot); } },
    machines(r, o) { /* 정비창 — 다관절 암, 공구 렉, 용접기 */ for (let i = 0; i < (o.n || 6); i++) { const [s, t] = spot(r, o), p = FROM(s, t); box(1.2, 1.4, 1.2, steelM, p[0], 0.7, p[1], R() * 3); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 0.25), new THREE.MeshStandardMaterial({ color: 0xd8a030, roughness: 0.5, metalness: 0.4 })); arm.position.set(p[0], 2.2, p[1]); arm.rotation.z = 0.5 + R() * 0.4; arm.castShadow = true; scene.add(arm); block(p[0], p[1], 0.7, 0.7); } },
    consoles(r, o) { /* 관제 콘솔 — 죽은 스크린, 이 년 전 각도의 의자 */ for (let s = r.s0 + 1.5; s < r.s1 - 1.5; s += 2.2) for (const v of o.rows || [0.35, 0.65]) { const t = r.t0 + (r.t1 - r.t0) * v, p = FROM(s, t); box(1.9, 0.9, 0.8, darkM, p[0], 0.45, p[1], SCREEN_ANG); const sc = FROM(s, t + 0.35); box(1.6, 0.7, 0.06, new THREE.MeshBasicMaterial({ color: R() < 0.15 ? 0x2a4a6a : 0x080a0c, toneMapped: false }), sc[0], 1.3, sc[1], SCREEN_ANG, false);
        const ch = FROM(s + (R() - .5), t - 0.9); box(0.5, 0.5, 0.5, clothM, ch[0], 0.45, ch[1], R() * 3); block(p[0], p[1], 0.95, 0.4, SCREEN_ANG); } },
    debris(r, o) { for (let i = 0; i < (o.n || 8); i++) { const [s, t] = spot(r, o), p = FROM(s, t), w = 0.6 + R() * 1.6; const m = box(w, 0.3 + R() * 0.7, w * (0.5 + R()), R() < 0.5 ? darkM : new THREE.MeshStandardMaterial({ color: 0x6a6660, roughness: 0.9 }), p[0], 0.25, p[1], R() * 3); m.rotation.set(R() - .5, R() * 3, R() - .5); block(p[0], p[1], w / 2, w / 2); } },
    shutters(r, o) { /* 내린 셔터 (막힌 길) — 지정 변 */ const shT = T(128, 128, (g, w, h) => { for (let y = 0; y < h; y += 8) { g.fillStyle = y % 16 ? '#7a7a80' : '#5a5a60'; g.fillRect(0, y, w, 8); } }); const sm = new THREE.MeshStandardMaterial({ map: shT, roughness: 0.5, metalness: 0.6 });
      const t = o.side === 'near' ? r.t0 + 0.3 : r.t1 - 0.3, s = r.s0 + (r.s1 - r.s0) * (o.u ?? 0.5), p = FROM(s, t); box(o.w || 4, 2.8, 0.1, sm, p[0], 1.4, p[1], SCREEN_ANG); },
    sign(r, o) { const [s, t] = [r.s0 + (r.s1 - r.s0) * (o.u ?? 0.5), r.t1 - 0.25], p = FROM(s, t); const tex = T(512, 128, (g, w, h) => { g.fillStyle = o.bg || '#0a0a0e'; g.fillRect(0, 0, w, h); g.strokeStyle = o.color || '#d8b030'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = o.color || '#ffe8b0'; g.shadowColor = o.color || '#ffe8b0'; g.shadowBlur = 10; let f = o.font || 48; const font = () => { g.font = '900 ' + f + 'px "Noto Sans KR",sans-serif'; }; font(); while (g.measureText(o.text).width > w - 34 && f > 14) { f -= 2; font(); } g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.text, w / 2, h / 2 + 3); });
      const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); m.color.setScalar(o.bright ?? 1.3); const pl = new THREE.Mesh(new THREE.PlaneGeometry(o.w || 4, (o.w || 4) / 4), m); pl.position.set(p[0], o.y ?? 2.8, p[1]); pl.rotation.y = Math.atan2(-SIDE[0], -SIDE[1]); scene.add(pl); },
    scratches(r, o) { const scT = T(256, 128, (g, w, h) => { g.strokeStyle = 'rgba(20,10,8,.9)'; g.lineWidth = 7; g.lineCap = 'round'; for (let k = 0; k < (o.lines || 3); k++) { g.beginPath(); g.moveTo(20, 30 + k * 26); g.lineTo(236, 42 + k * 26); g.stroke(); } });
      for (let i = 0; i < (o.n || 3); i++) { const s = r.s0 + 1 + R() * (r.s1 - r.s0 - 2), q = FROM(s, r.t1 - 0.2); const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ map: scT, transparent: true, depthWrite: false })); pl.position.set(q[0], 1.7, q[1]); pl.rotation.y = Math.atan2(-SIDE[0], -SIDE[1]); scene.add(pl); } },
    stairs(r, o) { /* 계단 (위층으로 — 문 자리) */ const s0 = o.side === 's0' ? r.s0 : r.s1 - 4; for (let k = 0; k < 8; k++) { const s = s0 + (o.side === 's0' ? k * 0.5 : (7 - k) * 0.5), c = FROM(s, (r.t0 + r.t1) / 2), h = 0.18 + k * 0.2; box(0.5, h, Math.min(5, r.t1 - r.t0 - 1), new THREE.MeshStandardMaterial({ color: 0x6a6660, roughness: 0.7 }), c[0], h / 2, c[1], SCREEN_ANG); } },
    gate(r, o) { /* 차수문 — 거대한 강철 문 (한강 터널) */ const s = r.s0 + (r.s1 - r.s0) * (o.u ?? 0.5); for (const tt of [r.t0 + 0.3, r.t1 - 0.3]) { const p = FROM(s, tt); box(1.2, r.h || 6, 1.2, rustM, p[0], (r.h || 6) / 2, p[1], SCREEN_ANG); }
      const top = FROM(s, (r.t0 + r.t1) / 2); box(1.0, 1.2, r.t1 - r.t0, steelM, top[0], (r.h || 6) - 0.6, top[1], SCREEN_ANG); const L = new THREE.PointLight(0xff3a2a, 10, 10, 1.4); L.position.set(top[0], (r.h || 6) - 1.4, top[1]); scene.add(L); lights.push({ x: top[0], y: (r.h || 6) - 1.4, z: top[1], color: '#ff3a2a', intensity: 8, distance: 9 }); },
    winch(r, o) { const [s, t] = spot(r, o), p = FROM(s, t); box(1.0, 1.0, 1.0, rustM, p[0], 0.5, p[1], SCREEN_ANG); const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16), steelM); drum.rotation.z = Math.PI / 2; drum.position.set(p[0], 1.2, p[1]); scene.add(drum); block(p[0], p[1], 0.6, 0.6); },
    tower(r, o) { /* 발사대 탑 기저 — 주각 4개 + 트러스 */ const c = [(r.s0 + r.s1) / 2, (r.t0 + r.t1) / 2], d = o.d || 6; for (const [ds, dt] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = FROM(c[0] + ds * d, c[1] + dt * d); box(1.4, r.h || 14, 1.4, steelM, p[0], (r.h || 14) / 2, p[1], SCREEN_ANG); block(p[0], p[1], 0.8, 0.8, SCREEN_ANG); }
      for (let y = 2; y < (r.h || 14); y += 3) for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { const pa = FROM(c[0] + a[0] * d, c[1] + a[1] * d), pb = FROM(c[0] + b[0] * d, c[1] + b[1] * d), m = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2], L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
        box(L, 0.25, 0.25, steelM, m[0], y, m[1], -Math.atan2(pb[1] - pa[1], pb[0] - pa[0]), false); } },
    crystal(r, o) { /* 결정 산 (나노-노바 코어) · 결정 덩이 */ const crysM = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a10, emissiveIntensity: 1.6, roughness: 0.15, transparent: true, opacity: 0.9 }); const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.4, 1, 0.4);
      for (let i = 0; i < (o.n || 12); i++) { const [s, t] = o.center ? [(r.s0 + r.s1) / 2 + (R() - .5) * (o.spread || 6), (r.t0 + r.t1) / 2 + (R() - .5) * (o.spread || 6)] : spot(r, o), p = FROM(s, t); let h = (o.h || 1.2) * (0.5 + R());
        /* view3d(3D 필드): 가운데(보스 자리) 반경 안 결정은 무릎 높이로 — 위에서 보는 굽기에선 보스 그림이 위에 덮이지만, 3D 에선 5 m 결정 숲이 보스를 통째로 가렸다 (문서 206 §9). 자리·막이·난수 순서는 그대로 */
        if (zone.view3d && o.center && Math.hypot(s - (r.s0 + r.s1) / 2, t - (r.t0 + r.t1) / 2) < (o.clear3d || 10)) h = Math.min(h, 0.9);
        const m = new THREE.Mesh(g, crysM); m.scale.set(1 + R(), h, 1 + R()); m.position.set(p[0], h * 0.7, p[1]); m.rotation.set((R() - .5) * 0.6, R() * 3, (R() - .5) * 0.6); m.castShadow = true; scene.add(m); block(p[0], p[1], 0.5, 0.5); }
      const c = at(r.id); const L = new THREE.PointLight(0xff7a20, 16, 18, 1.3); L.position.set(c[0], 3, c[1]); scene.add(L); lights.push({ x: c[0], y: 3, z: c[1], color: '#ff7a20', intensity: 12, distance: 16 }); },
    lockers(r, o) { const t = r.t1 - 0.5; for (let s = r.s0 + 0.8; s < r.s1 - 0.8; s += 0.7) { const p = FROM(s, t); box(0.6, 1.9, 0.5, steelM, p[0], 0.95, p[1], SCREEN_ANG); } block(...FROM((r.s0 + r.s1) / 2, t), (r.s1 - r.s0) / 2, 0.3, SCREEN_ANG); },
    dummy(r, o) { /* 짚단 허수아비 (사슬) */ const [s, t] = spot(r, o), p = FROM(s, t); const straw = new THREE.MeshStandardMaterial({ color: 0xb89a5a, roughness: 1 }); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.3, 10), straw); b.position.set(p[0], 0.95, p[1]); b.castShadow = true; scene.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), straw); hd.position.set(p[0], 1.8, p[1]); scene.add(hd); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), woodM); pole.position.set(p[0], 1.1, p[1]); scene.add(pole); block(p[0], p[1], 0.35, 0.35); },
    partitions(r, o) { for (let i = 0; i < (o.n || 6); i++) { const [s, t] = spot(r, o), p = FROM(s, t), rot = SCREEN_ANG + (R() < 0.5 ? 0 : Math.PI / 2); box(2.4, 1.5, 0.08, new THREE.MeshStandardMaterial({ color: 0x8a8c90, roughness: 0.7 }), p[0], 0.75, p[1], rot); block(p[0], p[1], 1.2, 0.08, rot); } },
    trees(r, o) { /* 실내 화분 나무가 유리를 민다 (판교 로비) */ for (let i = 0; i < (o.n || 4); i++) { const [s, t] = spot(r, o), p = FROM(s, t); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3, 6), woodM); tr.position.set(p[0], 1.5, p[1]); scene.add(tr); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.9, flatShading: true })); c.position.set(p[0], 3.2, p[1]); c.castShadow = true; scene.add(c); block(p[0], p[1], 0.3, 0.3); } },
  };
  for (const r of rooms) for (const pr of r.props || []) { const f = PROPS[pr.k]; if (f) f(r, pr); else console.warn('[env-indoor] 모르는 소품', pr.k); }

  /* ---------- 문 · 보스 · 출발점 ---------- */
  /* 문·출발점은 «맨바닥» 에 — 기둥·잔해 뒤면 인물이 가려진다 (tests/map-height.test.cjs 가 한강 터널 출발점 4.8 m 를 찾았다) */
  const wb = { s0: Math.min(...rooms.map(r => r.s0)), s1: Math.max(...rooms.map(r => r.s1)), t0: Math.min(...rooms.map(r => r.t0)), t1: Math.max(...rooms.map(r => r.t1)) };
  const bare = (id, u, v) => { const r = roomById(id), st0 = [r.s0 + (r.s1 - r.s0) * u, r.t0 + (r.t1 - r.t0) * v], st = bareSpot({ THREE, scene, FROM, walk: { s0: wb.s0 - 2, s1: wb.s1 + 2, t0: wb.t0 - 3, t1: wb.t1 + 3 } }, st0, { ok: q => inRoom(q[0], q[1], -1.4) }); return FROM(st[0], st[1]); };
  const gates = (zone.gates || []).map(g => { const p = bare(g.room, g.u ?? 0.5, g.v ?? 0.5); return { id: g.id, x: +p[0].toFixed(2), z: +p[1].toFixed(2), r: g.r || 2.6, to: g.to, label: g.label, kind: g.kind || 'zone' }; });
  for (const g of gates) { const m = new THREE.Mesh(new THREE.RingGeometry(g.r - 0.22, g.r, 48), new THREE.MeshBasicMaterial({ color: g.kind === 'dungeon' ? 0xff5a3a : 0x40d8ff, toneMapped: false, transparent: true, opacity: 0.8 })); m.rotation.x = -Math.PI / 2; m.position.set(g.x, 0.03, g.z); scene.add(m); }
  const bosses = (zone.bosses || []).map(b => { const p = at(b.room, b.u ?? 0.5, b.v ?? 0.5), r = roomById(b.room); return { ...b, room: undefined, u: undefined, v: undefined, x: +p[0].toFixed(2), z: +p[1].toFixed(2), r: b.r || Math.min(r.s1 - r.s0, r.t1 - r.t0) / 2 }; });
  const sp = zone.spawn ? bare(zone.spawn.room, zone.spawn.u ?? 0.5, zone.spawn.v ?? 0.5) : [gates[0].x, gates[0].z + 3];
  /* 안전 구역: 허브(rules.safe) 는 전부, 아니면 문 둘레 */
  const areas = zone.rules?.safe ? [{ kind: 'safe', all: true }] : gates.map(g => ({ kind: 'safe', circle: [g.x, g.z, 6] }));
  for (const b of bosses) areas.push({ kind: 'combat', circle: [b.x, b.z, b.r] });

  const s0 = Math.min(...rooms.map(r => r.s0)) - 0.5, s1 = Math.max(...rooms.map(r => r.s1)) + 0.5, t0 = Math.min(...rooms.map(r => r.t0)) - 0.5, t1 = Math.max(...rooms.map(r => r.t1)) + 0.5;
  const extentPts = []; for (let s = s0 - 2; s <= s1 + 2; s += 2) for (let t = t0 - 2; t <= t1 + 3; t += 2) { if (!inRoom(s, t, 2.5)) continue; const p = FROM(s, t); extentPts.push([p[0], 0, p[1]], [p[0], 6, p[1]]); }
  console.info('[env-indoor]', zone.id, '방', rooms.length, '벽', wallN, '빛', lights.length, '막힘', blockers.length);
  return { kind: zone.kind || 'dungeon', title: zone.title, lights, blockers, extentPts, road: { ang: SCREEN_ANG }, walk: { s0, s1, t0, t1 }, spawn: { x: +sp[0].toFixed(2), z: +sp[1].toFixed(2) },
    sky: { fog: '#' + new THREE.Color(th.fog || 0x040406).getHexString() }, sun: { dir: [-0.3, 0.9, 0.3], color: '#bfd8e8' }, water: spec.water ? { y: spec.water } : null, flicker: th.flicker || null,
    gates, bosses, areas, rules: zone.rules || {}, restart: zone.restart || null, exits: [], license: '' };
}
