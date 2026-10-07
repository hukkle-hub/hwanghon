/* 황혼 2D 맵 MMORPG — 실측 필드 빌더 (docs/design/185 §6.7)
   존 설정(js/mmo/zones.js 의 field)대로 env-lib 부품을 세운다. 여의도·남태령·판교·남행 국도·계룡·고흥.
   build(THREE, scene, osm, zone) → map.json 재료 (bake-map.html) */
import * as L from './env-lib.js';
import { frameOf } from './env-osm.js';
export const PITCH = L.PITCH;

const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); return Math.hypot(p[0] - a[0] - dx * u, p[1] - a[1] - dz * u); };

export function build(THREE, scene, osm, zone) {
  const F = zone.field || {}, R = L.rng(F.seed || 20261010), lights = [], blockers = [], clear = [];
  const fr = frameOf(THREE, osm, { farSide: F.farSide || {} }), { ST, FROM, W } = fr, tc = F.tc ?? 0;
  const walk = { ...F.walk };
  const ctx = { THREE, scene, R, ST, FROM, W, walk, tc, lights, blockers, clear };
  const inBand = (p, pad = 0) => { const [s, t] = ST(p); return s > walk.s0 - pad && s < walk.s1 + pad && t > walk.t0 - pad && t < walk.t1 + pad; };
  const pos = a => a.osm ? W(a.osm) : a.ll ? W([(a.ll[1] - osm.origin.lon) * 111320 * Math.cos(osm.origin.lat * Math.PI / 180), -(a.ll[0] - osm.origin.lat) * 110540]) : FROM(a.st[0], a.st[1]);
  const stOf = a => a.end ? [walk[a.end] + (a.end === 's1' ? -3 : 3), a.t ?? (walk.t0 + walk.t1) / 2] : ST(pos(a));

  /* ---------- 하늘·땅·텍스처 ---------- */
  const S = L.sky(ctx, F.sky || {}), tex = L.textures(ctx);
  L.ground(ctx, tex[F.ground || 'paver']);
  const ar = L.areas(ctx, osm, tex), nLines = L.lines(ctx, osm);
  const roadsW = L.roads(ctx, osm, tex);
  /* 미리 비울 곳: 문·출발점·보스 자리 (나무·차·결정이 서지 않게) */
  const reserve = [];   /* 차도 피해야 하는 곳 (길 둘레 clear 와 따로 — 차는 길 위에 서야 하니까) */
  for (const g of F.gates || []) { const p = FROM(...stOf(g.at)); clear.push({ pts: [p], r: 7 }); reserve.push([p, 8]); }
  for (const b of F.bosses || []) { const p = FROM(...stOf(b.at)); clear.push({ pts: [p], r: Math.min(b.r || 16, 22) * 0.6 }); reserve.push([p, 8]); }
  if (F.spawn) { const p = FROM(...stOf(F.spawn)); clear.push({ pts: [p], r: 5 }); reserve.push([p, 6]); }
  const built = L.buildings(ctx, osm, tex, { curtain: F.curtain, cutT: F.cutT ?? tc, maxH: F.maxH,
    ruin: F.ruin ? cst => cst[1] > walk.t0 - 4 && cst[1] < walk.t1 + 4 && cst[0] > walk.s0 - 4 && cst[0] < walk.s1 + 4 : null, ruinH: (F.ruin && F.ruin.h) || [4.5, 9], skip: F.skipBuilding ? (pts, b) => F.skipBuilding(pts, b, ctx) : null });

  /* ---------- 존 고유 소품 (원작 장소) ---------- */
  const steel = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.4, metalness: 0.7 }), conc = new THREE.MeshStandardMaterial({ color: 0x7a7672, roughness: 0.85 }), rust = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.8, metalness: 0.4 }), dark = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 1 });
  const box = (w, h, d, m, x, y, z, ry = 0, block = true) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = true; b.receiveShadow = true; scene.add(b); if (block) blockers.push({ x: +x.toFixed(2), z: +z.toFixed(2), hw: w / 2, hd: d / 2, rot: ry }); return b; };
  const A = L.SCREEN_ANG;
  const PROPS = {
    /* 요금소 + 하이패스 (남태령 «요금소의 차단기… 하이패스 표지판» L8293) */
    toll(p, o) { const w = o.w || 34;   /* 지붕 판은 넣지 않는다 — 위에서 보는 화면이라 그 밑을 걷는 인물이 통째로 가려졌다(남태령 첫 굽기). 부스·차단기·기둥 위 표지만 */
      for (const k of [-w / 2, w / 2]) { const q = [p[0] + Math.cos(-(A + Math.PI / 2)) * k, p[1] + Math.sin(-(A + Math.PI / 2)) * k]; box(0.5, 6.5, 0.5, steel, q[0], 3.25, q[1], A); } for (let k = -w / 2 + 3; k <= w / 2 - 3; k += 4.6) { const q = [p[0] + Math.cos(A + Math.PI / 2) * k * 0 + Math.sin(-A - Math.PI / 2) * 0, p[1]]; const qq = [p[0] + Math.cos(-(A + Math.PI / 2)) * k, p[1] + Math.sin(-(A + Math.PI / 2)) * k]; box(1.4, 2.6, 2.2, steel, qq[0], 1.3, qq[1], A); const bar = box(3.4, 0.1, 0.1, new THREE.MeshStandardMaterial({ color: 0xd83a2a }), qq[0] + 1.6, 1.1, qq[1], A, false); bar.rotation.z = 0.6; }
      const sp = [p[0] + Math.cos(-(A + Math.PI / 2)) * (-w / 2), p[1] + Math.sin(-(A + Math.PI / 2)) * (-w / 2)]; L.board(ctx, sp, '하이패스', { y: 6.2, w: 4, bg: '#1a3a7a', edge: '#40a0ff', fg: '#ffffff' }); },   /* 표지는 길가 기둥 위에 */
    /* 중계소: 능선 위 철탑 + 낮은 콘크리트 건물 (L8530) */
    relay(p, o) { box(8, 3.2, 6, conc, p[0], 1.6, p[1], A); const h = o.h || 40; for (const [dx, dz] of [[-2, -2], [2, -2], [2, 2], [-2, 2]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h, 6), steel); leg.position.set(p[0] + 7 + dx * (1 - 0.5), h / 2, p[1] + dz); leg.rotation.z = dx * 0.03; leg.rotation.x = -dz * 0.03; leg.castShadow = true; scene.add(leg); }
      for (let y = 4; y < h; y += 4) { const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6 - y / h * 1.6, 0.06, 4, 4), steel); ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 4; ring.position.set(p[0] + 7, y, p[1]); scene.add(ring); }
      blockers.push({ x: p[0] + 7, z: p[1], hw: 2.5, hd: 2.5, rot: 0 }); const lamp = new THREE.PointLight(0xff3a2a, 6, 10, 1.6); lamp.position.set(p[0] + 7, h, p[1]); scene.add(lamp); },
    /* 폐주유소 — 지붕·주유기 (야영지 L8594) */
    gas(p, o) {   /* 지붕 판은 빼고 기둥·주유기만 — 지붕 밑을 걷는 인물이 가려졌다 (tests/map-height «가려지는 자리») */ for (const dx of [-6, 0, 6]) { const q = [p[0] + Math.cos(-A) * dx, p[1] + Math.sin(-A) * dx]; box(0.5, 5, 0.5, steel, q[0], 2.5, q[1], A); box(0.9, 1.6, 0.6, new THREE.MeshStandardMaterial({ color: 0x3a6a3a }), q[0] + 1.2, 0.8, q[1], A); }
      L.board(ctx, [p[0], p[1] - 6], '주유소', { y: 6.2, w: 4, bg: '#0a2a1a', edge: '#40d880', fg: '#a0ffc0' }); const f = new THREE.PointLight(0xff8a40, 8, 8, 1.6); f.position.set(p[0] + 4, 1.2, p[1] + 3); scene.add(f); lights.push({ x: p[0] + 4, y: 1.2, z: p[1] + 3, color: '#ff8a40', intensity: 6, distance: 7 }); },
    /* 폐차장 — 녹슨 차 무더기 (L8751) */
    scrap(p, o) { const n = o.n || 24; for (let i = 0; i < n; i++) { const q = [p[0] + (R() - .5) * (o.r || 24), p[1] + (R() - .5) * (o.r || 24)]; if (L.isClear(ctx, q)) continue; const st = R() < 0.4 ? 2 : 1;
        for (let k = 0; k < st; k++) box(4.4, 1.3, 1.8, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.05 + R() * 0.05, 0.4, 0.2 + R() * 0.12), roughness: 0.9, metalness: 0.3 }), q[0], 0.65 + k * 1.3, q[1], R() * 3, k === 0); }
      const bus = box(11, 3, 2.5, new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.9 }), p[0] + (o.r || 24) * 0.4, 1.5, p[1], A + 0.3); bus.rotation.z = 0.05; },
    /* 물류창고 + 앞마당 (섀도우 팽 L10681) — 뒤집힌 수레, 속 빈 방호복 */
    warehouse(p, o) { const w = o.w || 60, d = o.d || 30, h = o.h || 12; box(w, h, d, new THREE.MeshStandardMaterial({ color: o.color ?? 0x8a8c90, roughness: 0.6, metalness: 0.4 }), p[0], h / 2, p[1], A);
      for (let k = -w / 2 + 5; k < w / 2 - 3; k += 8) { const q = [p[0] + Math.cos(-A) * k + Math.sin(A) * (-d / 2 - 0.1) * 0, p[1] + Math.sin(-A) * k]; const front = [q[0] - Math.sin(A) * 0 + Math.cos(A + Math.PI / 2) * 0, q[1]]; }
      L.board(ctx, [p[0] - Math.sin(A) * 0, p[1] + d / 2 * Math.cos(A) + 0.3], o.label || '물류센터', { y: h - 2, w: 10, bg: '#1a1a1e', edge: '#d8d8d0', fg: '#e8e8e0' });
      for (let i = 0; i < 6; i++) { const q = [p[0] + (R() - .5) * w * 0.8, p[1] + d * 0.5 + 4 + R() * 14]; if (L.isClear(ctx, q)) continue; box(1.6, 0.8, 1.0, rust, q[0], 0.4, q[1], R() * 3); }
      for (let i = 0; i < 5; i++) { const q = [p[0] + (R() - .5) * w * 0.7, p[1] + d * 0.5 + 3 + R() * 12]; if (L.isClear(ctx, q)) continue; const suit = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.1, 4, 8), new THREE.MeshStandardMaterial({ color: 0xd8c040, roughness: 0.8 })); suit.position.set(q[0], 0.3, q[1]); suit.rotation.z = Math.PI / 2; suit.rotation.y = R() * 3; scene.add(suit); } },
    /* 철책 + 초소 (계룡 «철책선» L12420 · 고흥 외곽 L14070) */
    milfence(p, o) { const len = o.len || 120, ang = A + (o.across ? Math.PI / 2 : 0), dx = Math.cos(-ang), dz = Math.sin(-ang); const meshM = new THREE.MeshStandardMaterial({ color: 0x6a6c70, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
      for (let k = -len / 2; k < len / 2; k += 3) { const q = [p[0] + dx * k, p[1] + dz * k]; if (L.isClear(ctx, q, -2)) continue; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), steel); post.position.set(q[0], 1.6, q[1]); scene.add(post);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.8), meshM); m.position.set(q[0] + dx * 1.5, 1.5, q[1] + dz * 1.5); m.rotation.y = ang; scene.add(m); const wire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 4, 12), steel); wire.position.set(q[0] + dx * 1.5, 3.2, q[1] + dz * 1.5); wire.rotation.y = ang; scene.add(wire);
        blockers.push({ x: +(q[0] + dx * 1.5).toFixed(2), z: +(q[1] + dz * 1.5).toFixed(2), hw: 1.55, hd: 0.15, rot: ang }); }
      for (const k of [-len / 3, len / 3]) { const q = [p[0] + dx * k + dz * 4, p[1] + dz * k - dx * 4]; box(3, 3, 3, conc, q[0], 1.5, q[1], ang); box(3.6, 0.3, 3.6, dark, q[0], 3.15, q[1], ang, false); const lamp = new THREE.PointLight(0xffe0a0, 8, 12, 1.5); lamp.position.set(q[0], 3.8, q[1]); scene.add(lamp); lights.push({ x: q[0], y: 3.8, z: q[1], color: '#ffe0a0', intensity: 6, distance: 10 }); } },
    /* 산 밑동의 아가리 (계룡 관문 L12462) — 바위 벽 + 검은 입 + 스텐실 */
    maw(p, o) { const rock = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 1, flatShading: true }); for (let i = 0; i < 14; i++) { const q = [p[0] + (i - 7) * 3.2, p[1] - 6 - R() * 3]; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(3 + R() * 3, 0), rock); r.position.set(q[0], 3 + R() * 4, q[1]); r.castShadow = true; scene.add(r); blockers.push({ x: +q[0].toFixed(2), z: +q[1].toFixed(2), hw: 2.6, hd: 2.6, rot: 0 }); }
      /* 둔덕 뒤는 산비탈 — 걷는 곳이 아니다. 넓힌 남태령에서 둔덕(최고 13 m) 뒤 칸들이 통째로 가려졌다(tests/map-height) */
      blockers.push({ x: +p[0].toFixed(2), z: +(p[1] - 17).toFixed(2), hw: 25, hd: 11, rot: 0 });
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshBasicMaterial({ color: 0x020203 })); mouth.position.set(p[0], 4, p[1] - 3.2); scene.add(mouth); const arch = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.6, 6, 16, Math.PI), conc); arch.position.set(p[0], 0.5, p[1] - 3.0); scene.add(arch);
      L.board(ctx, [p[0], p[1] - 3.1], o.label || '제03수거대', { y: 9, w: 6, bg: '#1a1a1e', edge: '#d8d8d0', fg: '#d8d8d0', rot: 0 }); for (const dx of [-5, 5]) { const g = new THREE.PointLight(0x60ff9a, 6, 9, 1.6); g.position.set(p[0] + dx, 1.5, p[1] - 1); scene.add(g); lights.push({ x: p[0] + dx, y: 1.5, z: p[1] - 1, color: '#60ff9a', intensity: 5, distance: 8 }); } },
    /* 발사대 탑 (고흥 «바다를 등지고 선 발사대의 탑» L14058) — 탑은 그림 범위 위로 넘어간다 */
    launch(p, o) { const h = o.h || 60, d = 5; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const leg = box(1.4, h, 1.4, steel, p[0] + a * d, h / 2, p[1] + b * d, 0); }
      for (let y = 3; y < h; y += 4) for (const [a, b, c, e] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) { const mx = p[0] + (a + c) / 2 * d, mz = p[1] + (b + e) / 2 * d, len = Math.hypot((c - a) * d, (e - b) * d); const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.25, 0.25), steel); bar.position.set(mx, y, mz); bar.rotation.y = -Math.atan2((e - b), (c - a)); scene.add(bar); }
      box(16, 1, 16, conc, p[0], 0.5, p[1], 0, false); const rocket = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, h * 0.7, 16), new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.4 })); rocket.position.set(p[0] + d + 3, h * 0.35 + 1, p[1]); rocket.castShadow = true; scene.add(rocket); blockers.push({ x: p[0] + d + 3, z: p[1], hw: 1.6, hd: 1.6, rot: 0 }); },
    /* 3층 높이 LED 광고판 (여의도 L6012 — 배경, 부서지지 않음) */
    led(p, o) { const t2 = L.canvasTex(THREE, 512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3a0a5a'); gr.addColorStop(1, '#0a4a6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#ff6ad0'; g.shadowColor = '#ff6ad0'; g.shadowBlur = 20; g.font = '900 72px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.fillText(o.text || '여의도', w / 2, h / 2 + 24); });
      const m = new THREE.MeshBasicMaterial({ map: t2, toneMapped: false }); m.color.setScalar(1.4); const pl = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), m); pl.position.set(p[0], 9, p[1]); scene.add(pl); },
    /* 안개 (여의도 «가시거리 스무 걸음» L6012) — 낮게 깔린 반투명 층. 굽는 그림에 들어간다 */
    mist(p, o) { const mt = L.canvasTex(THREE, 256, 256, (g, w, h) => { for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h, r = 30 + R() * 60, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(210,200,220,.35)'); gr.addColorStop(1, 'rgba(210,200,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
      mt.wrapS = mt.wrapT = THREE.RepeatWrapping; mt.repeat.set(8, 8); for (const y of o.layers || [1.6, 3.4]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(o.size || 600, o.size || 600), new THREE.MeshBasicMaterial({ map: mt, transparent: true, depthWrite: false, opacity: o.opacity || 0.5 })); m.rotation.x = -Math.PI / 2; m.position.set(p[0], y, p[1]); scene.add(m); } },
    /* 큰 글자 판 */
    sign(p, o) { L.board(ctx, p, o.text, { y: o.y ?? 4, w: o.w || 6, bg: o.bg, edge: o.edge, fg: o.fg }); },
    /* 결정 무더기 («사람 키만 해서» — 남산 소월로 L4096 · 고흥 결정 산) */
    crystals(p, o) { const spots = []; for (let i = 0; i < (o.n || 8); i++) spots.push([p[0] + (R() - .5) * (o.r || 10), p[1] + (R() - .5) * (o.r || 10)]); L.crystals(ctx, spots.filter(q => !L.isClear(ctx, q)), { h: o.h || 0.55 }); },
    /* 가드레일 (남태령 «가드레일 사이 무릎 높이에 낚싯줄과 깡통» L8329) */
    guardrail(p, o) { const len = o.len || 200, ang = A + (o.across ? Math.PI / 2 : 0), dx = Math.cos(-ang), dz = Math.sin(-ang); for (let k = -len / 2; k < len / 2; k += 4) { const q = [p[0] + dx * k, p[1] + dz * k]; if (L.isClear(ctx, q, -3)) continue; box(4, 0.35, 0.12, steel, q[0] + dx * 2, 0.75, q[1] + dz * 2, ang, false); const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), steel); post.position.set(q[0], 0.4, q[1]); scene.add(post); } },
  };
  for (const pr of F.props || []) { if (pr.at.gate) continue; const f = PROPS[pr.k]; if (!f) { console.warn('[env-field] 모르는 소품', pr.k); continue; } f(pos(pr.at), pr); }

  /* ---------- 숲·결정·차·가로등 ---------- */
  const tf = F.trees || {};
  /* 바다(해안선 다각형)·강 띠도 물이다 — ar.waters 는 OSM 물 다각형뿐이라 해운대 첫 미리보기에서 바다 위에 나무가 줄지어 섰다 */
  const wet = p => blockers.some(b => b.water && (b.poly ? L.inPoly(p, b.poly) : b.line && b.line.some((q, i) => i && segDist(p, b.line[i - 1], q) < b.w)));
  /* 넓은 필드: 나무를 숲과 빈터로 뭉친다 (고르게 뿌리면 어디나 같아 보인다) */
  const grove = F.dress ? L.noise2(L.rng((F.seed || 1) + 77), 55) : null;
  /* 나무 갓(높이 3.8~9.7 m)은 55° 에서 그 뒤(화면 위, 월드 −z) 0~10 m 땅을 가린다. 깊이 굽기가 인스턴스를 빠뜨려 몰랐다가(문서 192 §9) 고치고 나니
     띠 안 숲 덩이가 걷는 칸을 통째로 덮고(남태령 57칸) 출발점이 갓 밑(6.4 m)이었다 → 띠 안 나무는 서로 10 m 넘게, 출발점·문·보스의 카메라 쪽 0~11 m 에는 나무를 두지 않는다 */
  const bandTrees = [], spaced = p => { if (bandTrees.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 10)) return false; bandTrees.push(p); return true; };
  /* 띠 가까운 쪽(카메라 쪽, t0) 바로 바깥 7 m 도 비운다 — 그 나무 갓이 띠 가장자리 칸을 덮었다(판교 s −96 t −316) */
  const shades = p => reserve.some(([q]) => Math.abs(p[0] - q[0]) < 6 && p[1] - q[1] > -3 && p[1] - q[1] < 11) || (t => t > walk.t0 - 7 && t < walk.t0 + 1)(ST(p)[1]);
  /* 띠 안 나무 바로 뒤(화면 위, 월드 −z) 14 m 안에 건물이 있으면 두지 않는다 — 갓이 가리는 0~10 m 가 건물 벽에 끼인 좁은 칸이라
     하나만 덮어도 칸의 70% 를 넘었다(여의도 s −176 t −110). 난수는 그대로 쓰고(R() 다음에 거른다) 거른 나무만 빠진다 */
  const wedged = p => { for (let k = 2; k <= 14; k += 1.5) if (L.inBuilding(built, [p[0], p[1] - k])) return true; return false; };
  if (tf.density) { const spots = L.treeSpots(ctx, { s0: walk.s0 - 40, s1: walk.s1 + 40, t0: walk.t0 - 30, t1: walk.t1 + 34 }, { density: tf.density, step: tf.step,
      keep: p => !L.inBuilding(built, p) && !ar.waters.some(w => L.inPoly(p, w)) && !wet(p) && !shades(p) && (!inBand(p, 1) || (R() < (tf.inBand ?? 0.14) * (grove ? Math.min(2.4, Math.max(0, (grove(p[0], p[1]) - 0.45) * 7)) : 1) && !wedged(p) && spaced(p))) && (!tf.only || tf.only(p, ctx)) });
    L.trees(ctx, spots, { leaves: tf.leaves, pine: tf.pine, dead: tf.dead, block: p => inBand(p, 1) }); }
  if (F.cars) L.cars(ctx, roadsW, { ...F.cars, avoid: p => reserve.some(([q, r]) => Math.hypot(p[0] - q[0], p[1] - q[1]) < r) });
  if (F.dress) { const st = L.dress(ctx, { s0: walk.s0, s1: walk.s1, t0: walk.t0, t1: walk.t1 }, tex, { ...F.dress, keep: p => !L.inBuilding(built, p) && !ar.waters.some(w => L.inPoly(p, w)) && !wet(p) });
    console.log('[env-field] 땅 꾸미기', JSON.stringify(st)); }
  if (F.crystals) { const spots = []; for (let i = 0; i < F.crystals * 3 && spots.length < F.crystals; i++) { const p = FROM(walk.s0 + R() * (walk.s1 - walk.s0), walk.t0 + R() * (walk.t1 - walk.t0)); if (L.isClear(ctx, p) || L.inBuilding(built, p) || blockers.some(b => b.poly && L.inPoly(p, b.poly))) continue; spots.push(p); } L.crystals(ctx, spots, { h: F.crystalH || 0.55 }); }
  if (F.lamps !== false) { const spots = []; for (let s = walk.s0 + 8; s < walk.s1 - 8; s += F.lampStep || 26) { const p = FROM(s, (F.lampT ?? walk.t0 + 2)); if (!L.inBuilding(built, p)) spots.push(p); } L.lamps(ctx, spots); }

  /* ---------- 문 · 보스 · 경계 ---------- */
  const gates = (F.gates || []).map(g => { const st = L.bareSpot(ctx, stOf(g.at)), p = FROM(st[0], st[1]); return { id: g.id, x: +p[0].toFixed(2), z: +p[1].toFixed(2), r: g.r || 3.2, to: g.to, label: g.label, kind: g.kind || 'zone', st }; });
  for (const g of gates) if (g.kind === 'zone') L.gateRing(ctx, [g.x, g.z], g.r);
  /* 문에 붙는 소품(안내문 등) — 문은 맨바닥 자리를 찾아 움직이므로 문 자리를 기준으로 (판교 봉인 안내문이 건물 안에 묻혔다) */
  for (const pr of F.props || []) { if (!pr.at.gate) continue; const g = gates.find(x => x.id === pr.at.gate); if (!g) continue; PROPS[pr.k](FROM(g.st[0] + (pr.at.ds || 0), g.st[1] + (pr.at.dt || 0)), pr); }
  const nb = L.boundary(ctx, { style: F.boundary?.style || 'urban', closed: F.boundary?.closed, gaps: gates.filter(g => g.st[0] < walk.s0 + 6 || g.st[0] > walk.s1 - 6).map(g => [g.st[0] < walk.s0 + 6 ? walk.s0 : walk.s1, g.st[1]]),
    skip: p => L.inBuilding(built, p) || ar.waters.some(w => L.inPoly(p, w)) });
  /* 보스 자리도 맨바닥에 — 여의도 첫 굽기는 에이지스 자리가 멈춘 차 위(0.86 m)였다 (tests/map-height) */
  const bosses = (F.bosses || []).map(b => { const st = L.bareSpot(ctx, stOf(b.at)), p = FROM(st[0], st[1]); const { at, ...rest } = b; return { ...rest, x: +p[0].toFixed(2), z: +p[1].toFixed(2) }; });
  const spSt = F.spawn ? stOf(F.spawn) : (gates[0] ? [gates[0].st[0] + (gates[0].st[0] < (walk.s0 + walk.s1) / 2 ? 6 : -6), gates[0].st[1]] : [(walk.s0 + walk.s1) / 2, (walk.t0 + walk.t1) / 2]), sp = FROM(spSt[0], spSt[1]);
  const areasOut = [...gates.map(g => ({ kind: 'safe', circle: [g.x, g.z, 6] })), ...bosses.map(b => ({ kind: 'combat', circle: [b.x, b.z, b.r] }))];
  /* 정체 구간: 트럭이 뭉쳐 벽이 된 곳은 지나갈 수 없다 — 그 뒤 칸이 통째로 가려졌다(남행 국도, tests/map-height). 그림은 그대로, 막이만 */
  for (const j of F.jams || []) { const p = FROM(j.st[0], j.st[1]); blockers.push({ x: +p[0].toFixed(2), z: +p[1].toFixed(2), hw: j.hw || 4.5, hd: j.hd || 4.5, rot: L.SCREEN_ANG }); }
  const extentPts = L.extent(ctx, { h: F.extentH ?? 18 }); for (const pr of F.props || []) if (pr.k === 'launch' || pr.k === 'relay') { const p = pos(pr.at); extentPts.push([p[0], Math.min(pr.h || 40, 50), p[1]]); }
  console.info('[env-field]', zone.id, '건물', built.length, '도로', roadsW.length, '선', nLines, '경계', nb, '문', gates.map(g => g.id).join(','), '막힘', blockers.length);
  return { kind: 'field', title: zone.title, lights, blockers, extentPts, road: { ang: L.SCREEN_ANG }, walk, spawn: { x: +sp[0].toFixed(2), z: +sp[1].toFixed(2) },
    sky: S.sky, sun: S.sun, sunLight: S.sunLight, gates: gates.map(({ st, ...g }) => g), bosses, areas: areasOut, rules: zone.rules || {}, restart: zone.restart || null, exits: [], license: osm.license, water: null, mist: F.mist || null };
}
