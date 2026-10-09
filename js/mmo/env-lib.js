/* 황혼 2D 맵 MMORPG — 실측 필드 장면 부품 (docs/design/185 §6.7)
   강남(env-osm.js)·남산(env-namsan.js)에서 쓰던 부품을 존 여럿이 같이 쓰게 모은 것.
   env-field.js 가 존 설정(js/mmo/zones.js)대로 이 부품을 골라 세운다.
   모든 함수는 ctx = { THREE, scene, R, ST, FROM, W, walk, tc, lights, blockers, clear } 를 받는다. */
export const PITCH = 55 * Math.PI / 180;
export const SCREEN_ANG = 28 * Math.PI / 180;
/* 3D 필드(world3d)에서만 모양을 다듬는다 — 굽기(위에서 본 2D 그림)·자리·막이는 그대로 (문서 215) */
let VIEW3D = false; export function setView3d(v) { VIEW3D = !!v; }
/* 울퉁불퉁한 덩어리: 다면체를 한 번 쪼개고 꼭짓점을 «자리로 만든 해시» 로 흔든다. 장면 난수(R)를 안 써서 뒤따르는 모든 자리가 그대로이고,
   같은 자리의 꼭짓점은 같이 움직여 면 사이가 벌어지지 않는다. radial: 가운데서 바깥으로만(바위·덤불) · 아니면 세 축(콘크리트 덩이) */
export function lumpy(geo, amp, seed, radial = true) { const P = geo.attributes.position, v = [0, 0, 0];
  const h = (x, y, z, k) => { let n = Math.imul((Math.round(x * 1000) * 73856093) ^ (Math.round(y * 1000) * 19349663) ^ (Math.round(z * 1000) * 83492791) ^ (seed * 2654435761 + k * 40503), 2246822519); n ^= n >>> 15; return ((n >>> 0) % 10007) / 10007 - 0.5; };
  for (let i = 0; i < P.count; i++) { v[0] = P.getX(i); v[1] = P.getY(i); v[2] = P.getZ(i); const [x, y, z] = v;
    if (radial) { const k = 1 + amp * 2 * h(x, y, z, 0); P.setXYZ(i, x * k, y * k * (y < 0 ? 0.7 : 1), z * k); }   /* 아래쪽은 눌러 바닥에 앉힌다 */
    else P.setXYZ(i, x + amp * 2 * h(x, y, z, 1), y + amp * 2 * h(x, y, z, 2), z + amp * 2 * h(x, y, z, 3)); }
  P.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo; }
/* 거친 표면 무늬(바위·콘크리트 덩이) — 고정 씨앗이라 장면 난수(R)를 안 건드린다. 밝은 회색이라 재질 색을 거의 그대로 둔다 */
let GRIT = null; export function gritTex(THREE) { if (GRIT) return GRIT; const r = rng(977);
  GRIT = canvasTex(THREE, 128, 128, (g, w, h) => { g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { const v = 120 + r() * 135 | 0; g.fillStyle = `rgba(${v},${v},${v},${0.35 + r() * 0.45})`; const s = 1 + r() * 3; g.fillRect(r() * w, r() * h, s, s); }
    g.strokeStyle = 'rgba(40,40,40,.55)'; g.lineWidth = 1; for (let i = 0; i < 7; i++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - .5) * 40; y += (r() - .5) * 40; g.lineTo(x, y); } g.stroke(); } }, [2, 2]);
  return GRIT; }
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export const inPoly = (p, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
export const segDist = (p, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / L2)); return Math.hypot(p[0] - a[0] - u * vx, p[1] - a[1] - u * vz); };
const unclose = pts => { if (pts.length > 2 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop(); return pts; };

export function canvasTex(THREE, w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); return t; }

/* ---------- 하늘·빛 ---------- 원작 «보라와 핏빛이 뒤엉킨 황혼». fog: 여의도 «안개 협곡» 처럼 흐린 존 */
export function sky(ctx, o = {}) { const { THREE, scene, W } = ctx;
  const s = { top: '#2a1838', horizon: '#7a2a3a', fog: o.fog || '#3a2238' }; scene.background = new THREE.Color(s.fog);
  scene.add(new THREE.HemisphereLight(o.hemi || 0xc09ad0, o.ground || 0x4a2c30, o.hemiI ?? 3.2));
  const west = W([-1, 0]), sunDir = new THREE.Vector3(west[0], Math.tan((o.sunAlt ?? 14) * Math.PI / 180), west[1]).normalize();
  const sun = new THREE.DirectionalLight(o.sunColor || 0xff9a60, o.sunI ?? 4.2); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
  return { sky: s, sun: { dir: [sunDir.x, sunDir.y, sunDir.z], color: '#ff8a50' }, sunLight: sun }; }

/* ---------- 텍스처 ---------- */
export function textures(ctx) { const { THREE, R } = ctx, T = (w, h, d, r) => canvasTex(THREE, w, h, d, r);
  const noise = (g, w, h, base, amp, n) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const v = amp[0] + R() * amp[1] | 0; g.fillStyle = `rgba(${v},${v},${v + 3},${0.35 + R() * 0.4})`; g.fillRect(R() * w, R() * h, 2, 2); } };
  const asphalt = T(512, 512, (g, w, h) => { noise(g, w, h, '#34353c', [40, 34], 9000); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
    for (let i = 0; i < 10; i++) { g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - .5) * 90; y += (R() - .5) * 90; g.lineTo(x, y); } g.stroke(); } }, [1 / 8, 1 / 8]);
  const paver = T(256, 256, (g, w, h) => { g.fillStyle = '#4c484a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 16; x < w; x += 32) { const v = 66 + R() * 12 | 0; g.fillStyle = R() < 0.1 ? `rgb(${v + 16},${v - 4},${v - 6})` : `rgb(${v},${v - 2},${v})`; g.fillRect(x + 1, y + 1, 30, 14); } }, [1 / 1.6, 1 / 1.6]);
  /* 숲 바닥 — 남산과 같은 낙엽·흙. 잔무늬를 줄여 webp 가 덜 무겁게 (남산은 장당 68 KB 였다) */
  const forest = T(512, 512, (g, w, h) => { g.fillStyle = '#2e2622'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const r = R(); g.fillStyle = r < 0.45 ? `rgba(${90 + R() * 40 | 0},${50 + R() * 26 | 0},${30 + R() * 18 | 0},.4)` : r < 0.8 ? `rgba(${40 + R() * 20 | 0},${52 + R() * 20 | 0},${34 + R() * 12 | 0},.45)` : 'rgba(20,16,14,.45)';
      const s = 4 + R() * 7; g.fillRect(R() * w, R() * h, s, s * (0.4 + R())); } }, [1 / 4, 1 / 4]);
  const concrete = T(256, 256, (g, w, h) => { noise(g, w, h, '#5a5856', [70, 30], 2500); g.strokeStyle = 'rgba(20,20,20,.35)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke(); } }, [1 / 4, 1 / 4]);
  const grass = T(256, 256, (g, w, h) => { g.fillStyle = '#2c3424'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${50 + R() * 30 | 0},${60 + R() * 30 | 0},${36 + R() * 14 | 0},.5)`; g.fillRect(R() * w, R() * h, 3, 5); } }, [1 / 3, 1 / 3]);
  const sand = T(256, 256, (g, w, h) => { noise(g, w, h, '#6a5e4c', [90, 40], 3000); }, [1 / 3, 1 / 3]);
  const facades = [0, 1, 2, 3].map(k => T(256, 256, (g, w, h) => {
    const wall = ['#3a3a44', '#45424a', '#2e3440', '#4a4440'][k]; g.fillStyle = wall; g.fillRect(0, 0, w, h);
    const glass = ['#1a2230', '#202a38', '#151c26', '#2a2a30'][k];
    for (let fy = 0; fy < 4; fy++) for (let fx = 0; fx < 8; fx++) { const x = fx * 32, y = fy * 64; g.fillStyle = glass; g.fillRect(x + 3, y + 10, 26, 44);
      const r = R(); if (r < 0.05) { g.fillStyle = R() < .6 ? '#ffcf7a' : '#7ad8ff'; g.fillRect(x + 3, y + 10, 26, 44); } else if (r < 0.35) { g.fillStyle = 'rgba(255,140,90,.18)'; g.fillRect(x + 3, y + 10, 26, 22); } }
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let fy = 0; fy < 4; fy++) g.fillRect(0, fy * 64 + 58, w, 6); }, [1 / 14.4, 1 / 14.4]));
  /* 유리 커튼월 — 여의도·판교 고층 */
  const curtain = T(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a3a50'); gr.addColorStop(1, '#1a2230'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,180,200,.35)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 21) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let i = 0; i < 6; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,200,120,.5)' : 'rgba(120,200,255,.35)'; g.fillRect((R() * 12 | 0) * 21 + 1, (R() * 4 | 0) * 64 + 1, 19, 62); } }, [1 / 14.4, 1 / 14.4]);
  return { asphalt, paver, forest, concrete, grass, sand, facades, curtain }; }

/* ---------- 땅 ---------- */
export function ground(ctx, tex, size = 2400) { const { THREE, scene } = ctx; const t = tex.clone(); t.needsUpdate = true; t.repeat.set(size * tex.repeat.x, size * tex.repeat.y);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, metalness: 0.05 })); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m); return m; }
export function flatPoly(ctx, pts, mat, y = 0.01) { const { THREE, scene } = ctx; const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1]))));
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, g.attributes.position.getX(i), g.attributes.position.getY(i));
  const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m); return m; }

/* ---------- 띠(리본): 중심선을 폭만큼 펼친다 ---------- */
export function ribbon(THREE, pts, width, y) { const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    pos.push(pts[i][0] - dz * width / 2, y, pts[i][1] + dx * width / 2, pts[i][0] + dz * width / 2, y, pts[i][1] - dx * width / 2);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } }   /* 위를 보게 감는다 */
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i], pos[i + 2]); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; }
const near = (ctx, pts, pad) => pts.some(p => { const [s, t] = ctx.ST(p); return s > ctx.walk.s0 - pad && s < ctx.walk.s1 + pad && t > ctx.walk.t0 - pad && t < ctx.walk.t1 + pad; });

/* ---------- 도로: 간선은 차선·점선, 보행로·계단은 흙/블록 ---------- */
export function roads(ctx, osm, tex) { const { THREE, scene, W } = ctx;
  const roadM = new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.34, metalness: 0.25 }), busM = new THREE.MeshStandardMaterial({ color: 0x6a2a2a, roughness: 0.6 });
  const pathM = new THREE.MeshStandardMaterial({ map: tex.paver, roughness: 0.75 }), stepM = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9 });
  const LANE = { motorway: 3.5, trunk: 3.4, primary: 3.3, primary_link: 3.3, secondary: 3.2, secondary_link: 3.2, tertiary: 3.1, motorway_link: 3.4, trunk_link: 3.4 };
  const dashM = new THREE.MeshStandardMaterial({ color: 0xc8c8b8, roughness: 0.7, transparent: true, opacity: 0.55 }), out = [];
  const dashed = (pts, off, solid) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 0.5) continue; dx /= L; dz /= L;
      const step = solid ? L : 6, len = solid ? L : 3; for (let d = 0; d + len <= L + 1e-3; d += step) { const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.12), dashM); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(dz, dx);
        m.position.set(a[0] + dx * (d + len / 2) - dz * off, 0.03, a[1] + dz * (d + len / 2) + dx * off); scene.add(m); } } };
  for (const r of osm.roads) { if (r.tunnel || r.layer < 0 || r.kind === 'platform') continue; const pts = r.line.map(W); if (!near(ctx, pts, 80)) continue;
    let width, mat = roadM, y = 0.02, lanes = r.lanes || (/motorway|trunk/.test(r.kind) ? 4 : 2);
    if (LANE[r.kind]) width = lanes * LANE[r.kind];
    else if (r.kind === 'busway') { width = 3.6; mat = busM; y = 0.025; }
    else if (/residential|unclassified|living_street/.test(r.kind)) width = r.width || 7;
    else if (r.kind === 'service') width = r.width || 4.5;
    else if (/footway|path|pedestrian|steps|cycleway|track/.test(r.kind)) { width = r.width || (r.kind === 'pedestrian' ? 5 : r.kind === 'track' ? 3 : 2.4); mat = pathM; y = 0.025; }
    else continue;
    const m = new THREE.Mesh(ribbon(THREE, pts, width, y), mat); m.receiveShadow = true; scene.add(m); out.push({ r, width, pts });
    ctx.clear.push({ pts, r: width / 2 + 1.2 });
    if (LANE[r.kind] && lanes > 1) { for (let k = 1; k < lanes; k++) dashed(pts, -width / 2 + k * width / lanes); dashed(pts, -width / 2 + 0.2, true); dashed(pts, width / 2 - 0.2, true); }
    if (r.kind === 'steps') for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.4) continue;
      for (let d = 0.2; d < L; d += 0.42) { const st = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.1), stepM); st.position.set(a[0] + dx / L * d, 0.05, a[1] + dz / L * d); st.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2; scene.add(st); } } }
  return out; }
export function nearestRoad(roadsW, p, kinds) { let best = null; for (const rw of roadsW) { if (kinds && !kinds.includes(rw.r.kind)) continue;
    for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1;
      const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / L2)), qx = a[0] + vx * u, qz = a[1] + vz * u, d = Math.hypot(p[0] - qx, p[1] - qz);
      if (!best || d < best.d) best = { d, q: [qx, qz], dir: Math.atan2(vz, vx), rw }; } } return best; }

/* ---------- 땅 쓰임: 풀밭·물·모래·주차장·공항 포장 ---------- */
export function areas(ctx, osm, tex) { const { THREE, W } = ctx, waters = [];
  const M = { grass: new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 1 }), sand: new THREE.MeshStandardMaterial({ map: tex.sand, roughness: 1 }), conc: new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.85 }),
    water: new THREE.MeshStandardMaterial({ color: 0x1a2c38, roughness: 0.06, metalness: 0.5 }), forest: new THREE.MeshStandardMaterial({ map: tex.forest, roughness: 1 }) };
  for (const a of osm.areas) { const pts = unclose(a.poly.map(W)); if (pts.length < 3 || !near(ctx, pts, 120)) continue; const k = a.kind || '';
    if (/^water$|reservoir|basin|riverbank/.test(k)) { flatPoly(ctx, pts, M.water, 0.012); waters.push(pts); }
    else if (/park|grass|meadow|garden|pitch|village_green|recreation|golf/.test(k)) flatPoly(ctx, pts, M.grass, 0.008);
    else if (/beach|sand|bare_rock|scree/.test(k)) flatPoly(ctx, pts, M.sand, 0.008);
    else if (/military/.test(k)) flatPoly(ctx, pts, M.forest, 0.006);   /* 실재 군 시설은 그리지 않는다 — 모양이 드러나지 않게 숲 바닥으로 (남태령 넓히기에서 콘크리트 판이 통째로 드러났다) */
    else if (/farmland|orchard|vineyard/.test(k)) flatPoly(ctx, pts, M.grass, 0.006);
    else if (/parking|aero:apron|aero:runway|aero:taxiway|man:pier|man:breakwater|industrial|railway|construction/.test(k)) flatPoly(ctx, pts, M.conc, 0.006); }
  /* 물은 못 들어간다 — 띠 안에 걸치면 막는다 */
  for (const w of waters) if (near(ctx, w, 2)) ctx.blockers.push({ poly: w.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]), water: true });
  return { waters }; }

/* 해안선 막힘: 처음↔끝 현의 오른쪽으로 2 km 닫는 다각형은 해안선이 곶을 감아 돌면 땅을 덮는다 — 고흥(해안선 1,148 점, 현 5.9 km)은
   걷는 띠 전체가 «바다 안» 이 되어 첫 걸음에 275 m 밀려났다 (3D 필드 전 지역 점검에서 발견, 문서 206 §7).
   걷는 띠는 땅이다 → 닫은 바다가 띠의 절반 넘게 덮으면 틀린 것으로 보고, 해안선 바다 쪽(진행 방향 오른쪽) 150 m 띠로 막는다 */
export const COAST_STRIP = 150;
export function coastStrip(pts, w = COAST_STRIP) { const off = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [p[0] - dz / L * w, p[1] + dx / L * w]; }); return [...pts, ...off.reverse()]; }
export function inPolyXZ(x, z, P) { let s = false; for (let a = 0, c = P.length - 1; a < P.length; c = a++) { const A = P[a], C = P[c]; if ((A[1] > z) !== (C[1] > z) && x < (C[0] - A[0]) * (z - A[1]) / (C[1] - A[1]) + A[0]) s = !s; } return s; }
export function bandCover(FROM, walk, P) { let n = 0, k = 0; for (let i = 0; i <= 20; i++) for (let j = 0; j <= 12; j++) { const [x, z] = FROM(walk.s0 + (walk.s1 - walk.s0) * i / 20, walk.t0 + (walk.t1 - walk.t0) * j / 12); n++; if (inPolyXZ(x, z, P)) k++; } return k / n; }
function coastBlock(ctx, pts, closed) { if (!ctx.FROM || !ctx.walk) return closed; return bandCover(ctx.FROM, ctx.walk, closed) > 0.5 ? coastStrip(pts) : closed; }

/* ---------- 선: 철길(자갈·침목·레일), 강(폭), 활주로, 방파제(테트라포드) ---------- */
export function lines(ctx, osm) { const { THREE, scene, W, R } = ctx;
  const ballastM = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 1 }), railM = new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.3, metalness: 0.9 }), sleeperM = new THREE.MeshStandardMaterial({ color: 0x3a2e26, roughness: 0.9 });
  const waterM = new THREE.MeshStandardMaterial({ color: 0x1a2c38, roughness: 0.06, metalness: 0.5 }), runM = new THREE.MeshStandardMaterial({ color: 0x3e3e42, roughness: 0.6 }), markM = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.6 });
  const tetraM = new THREE.MeshStandardMaterial({ color: 0x8a8682, roughness: 0.85 }), tetraG = new THREE.TetrahedronGeometry(1.1, 0);
  let n = 0;
  for (const l of osm.lines || []) { if (l.tunnel || l.layer < 0) continue; const pts = l.line.map(W); if (!near(ctx, pts, 80)) continue; n++;
    if (/^rail:(rail|subway|light_rail|narrow_gauge|tram)/.test(l.kind)) { scene.add(new THREE.Mesh(ribbon(THREE, pts, 3.2, 0.03), ballastM));
      for (const off of [-0.72, 0.72]) { const sh = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [p[0] - dz / L * off, p[1] + dx / L * off]; });
        const m = new THREE.Mesh(ribbon(THREE, sh, 0.12, 0.2), railM); scene.add(m); }
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); for (let d = 0.3; d < L; d += 0.7) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.22), sleeperM); s.position.set(a[0] + dx / L * d, 0.1, a[1] + dz / L * d); s.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2; scene.add(s); } } }
    else if (/^water:(river|canal|stream|ditch|drain)/.test(l.kind)) { const w = l.width || (/river|canal/.test(l.kind) ? 18 : 3); const m = new THREE.Mesh(ribbon(THREE, pts, w, 0.012), waterM); scene.add(m);
      if (w > 4) ctx.blockers.push({ line: pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]), w: w / 2, water: true }); }
    else if (/^aero:(runway|taxiway)/.test(l.kind)) { const w = l.width || (/runway/.test(l.kind) ? 45 : 18); scene.add(new THREE.Mesh(ribbon(THREE, pts, w, 0.02), runM));
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); for (let d = 10; d < L; d += 60) { const s = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.9), markM); s.rotation.x = -Math.PI / 2; s.rotation.z = -Math.atan2(dz, dx); s.position.set(a[0] + dx / L * d, 0.03, a[1] + dz / L * d); scene.add(s); } } }
    else if (l.kind === 'coastline') { /* 해안선: OSM 은 길 방향의 왼쪽이 땅 — 오른쪽으로 2 km 밀어 바다 다각형을 닫는다 */
      const a0 = pts[0], a1 = pts.at(-1), dx = a1[0] - a0[0], dz = a1[1] - a0[1], L0 = Math.hypot(dx, dz) || 1, rx = -dz / L0 * 2000, rz = dx / L0 * 2000;
      const poly = [...pts, [a1[0] + rx, a1[1] + rz], [a0[0] + rx, a0[1] + rz]]; flatPoly(ctx, poly, waterM, 0.012);
      ctx.blockers.push({ poly: coastBlock(ctx, pts, poly).map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]), water: true }); }
    else if (/^man:(pier|breakwater|groyne|dyke)/.test(l.kind)) { scene.add(new THREE.Mesh(ribbon(THREE, pts, 8, 0.6), runM));
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); for (let d = 0; d < L; d += 2.2) for (const side of [-1, 1]) { const t4 = new THREE.Mesh(tetraG, tetraM); t4.position.set(a[0] + dx / L * d - dz / L * 5.5 * side, 0.6, a[1] + dz / L * d + dx / L * 5.5 * side); t4.rotation.set(R() * 3, R() * 3, R() * 3); t4.castShadow = true; scene.add(t4); } } } }
  return n; }

/* ---------- 건물: 실측 윤곽 × 높이, 가까운 쪽(화면 아래)은 1층으로 잘라 길을 가리지 않게 ---------- */
export function buildings(ctx, osm, tex, o = {}) { const { THREE, scene, R, W, ST, tc } = ctx, out = [];
  const facadeMats = tex.facades.map(t => new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0.25 }));
  const curtainM = new THREE.MeshStandardMaterial({ map: tex.curtain, emissiveMap: tex.curtain, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.15, metalness: 0.6 });
  const roofM = new THREE.MeshStandardMaterial({ color: 0x2a2830, roughness: 0.9 }), cutM = new THREE.MeshStandardMaterial({ color: 0x2c2a32, roughness: 0.95 });
  const area = poly => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
  for (const b of osm.buildings) { if (b.under) continue; const pts = unclose(b.poly.map(W)); if (pts.length < 3 || !near(ctx, pts, o.pad ?? 50)) continue;
    const ar = area(pts); let h = b.height || (b.levels ? b.levels * 3.6 : (ar > 900 ? 22 + R() * 20 : ar > 300 ? 12 + R() * 12 : 7 + R() * 7)); h = Math.min(h, o.maxH || 260);
    const cst = pts.reduce((a, p) => { const st = ST(p); return [a[0] + st[0] / pts.length, a[1] + st[1] / pts.length]; }, [0, 0]), full = h, nearSide = cst[1] < (o.cutT ?? tc); if (nearSide) h = Math.min(h, 4.2);
    /* 넓은 필드: 걷는 구역 안 건물은 «무너진 저층» — 원작의 폐허 서울. 고층이 그대로면 그 뒤가 통째로 가려진다(55° 에서 높이 × 0.7 m) */
    const ruined = !nearSide && o.ruin && o.ruin(cst); if (ruined) h = Math.min(h, o.ruinH[0] + R() * (o.ruinH[1] - o.ruinH[0]));
    if (o.skip && o.skip(pts, b)) continue;
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1]))), { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const tall = full > 45 && o.curtain;
    const mesh = new THREE.Mesh(geo, [nearSide || ruined ? cutM : roofM, tall && !ruined ? curtainM : facadeMats[(b.id >>> 3) % 4]]); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    ctx.blockers.push({ poly: pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) }); out.push({ pts, h, full, near: nearSide, ruined, cst, id: b.id }); ctx.clear.push({ pts: [...pts, pts[0]], r: 1.5 }); }
  return out; }
export const inBuilding = (built, p) => built.some(b => inPoly(p, b.pts));

/* ---------- 나무: 인스턴스로. 걷는 띠 안은 드문드문(갓이 인물을 가리면 안 된다) ---------- */
export function trees(ctx, pts, o = {}) { const { THREE, scene, R } = ctx, n = pts.length; if (!n) return 0;
  const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 4.2, 6), canopyG = VIEW3D ? lumpy(new THREE.IcosahedronGeometry(1.9, 0), 0.14, 14) : new THREE.IcosahedronGeometry(1.9, 0), pineG = new THREE.ConeGeometry(1.6, 4.6, 7);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1 }), leafMs = (o.leaves || [0x3a3e2a, 0x2c3426, 0x4a3e2c, 0x5a3424]).map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, n), canopy = leafMs.map(m => new THREE.InstancedMesh(canopyG, m, n)), pines = new THREE.InstancedMesh(pineG, leafMs[1], n);
  const mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), V = (x, y, z) => new THREE.Vector3(x, y, z), cnt = leafMs.map(() => 0); let np = 0, nd = 0;
  pts.forEach((p, i) => { const k = 0.8 + R() * 0.6; mtx.compose(V(p[0], 2.1 * k, p[1]), q4.setFromEuler(e.set((R() - .5) * 0.15, R() * 6, (R() - .5) * 0.15)), V(k, k, k)); trunks.setMatrixAt(i, mtx);
    if (o.dead && R() < o.dead) { nd++; }   /* 죽은 나무 — 갓 없이 줄기만 */
    else if (R() < (o.pine ?? 0.3)) { mtx.compose(V(p[0], 4.6 * k, p[1]), q4.setFromEuler(e.set(0, R() * 6, 0)), V(k, k, k)); pines.setMatrixAt(np++, mtx); }
    else { const c = (R() * leafMs.length) | 0; mtx.compose(V(p[0], 4.7 * k, p[1]), q4.setFromEuler(e.set(R(), R() * 6, R())), V(k * (1 + R() * 0.4), k * (0.8 + R() * 0.3), k * (1 + R() * 0.4))); canopy[c].setMatrixAt(cnt[c]++, mtx); }
    if (o.block && o.block(p)) ctx.blockers.push({ x: +p[0].toFixed(2), z: +p[1].toFixed(2), hw: 0.3, hd: 0.3, rot: 0 }); });
  canopy.forEach((m, c) => { m.count = cnt[c]; }); pines.count = np;
  for (const m of [trunks, pines, ...canopy]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); } return n; }
/* 나무 자리: 격자 + 흔들기. 길·건물·물·지정 원은 비운다 */
export function treeSpots(ctx, region, o = {}) { const { R, FROM } = ctx, out = []; const step = o.step || 3.4;
  for (let s = region.s0; s < region.s1; s += step) for (let t = region.t0; t < region.t1; t += step) { const p = FROM(s + (R() - .5) * step * 0.8, t + (R() - .5) * step * 0.8);
    if (R() > (o.density ?? 0.88)) continue; if (o.keep && !o.keep(p)) continue; if (isClear(ctx, p)) continue; out.push(p); } return out; }
export function isClear(ctx, p, pad = 0) { for (const c of ctx.clear) { for (let i = 1; i < c.pts.length; i++) if (segDist(p, c.pts[i - 1], c.pts[i]) < c.r + pad) return true; if (c.pts.length === 1 && Math.hypot(p[0] - c.pts[0][0], p[1] - c.pts[0][1]) < c.r + pad) return true; } return false; }

/* ---------- 주황 결정 («무릎 높이로») · 죽은 가로수 ---------- */
export function crystals(ctx, spots, o = {}) { const { THREE, scene, R } = ctx; const crysM = new THREE.MeshStandardMaterial({ color: o.color || 0xffa040, emissive: o.emissive || 0xff6a10, emissiveIntensity: 1.6, roughness: 0.15, transparent: true, opacity: 0.88 });
  const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.22, 1, 0.22); let n = 0;
  for (const p of spots) { const h = (o.h || 0.55) * 1.5; for (let i = 0; i < 4 + (R() * 3 | 0); i++) { const m = new THREE.Mesh(g, crysM); const s = h * (0.5 + R() * 0.6); m.scale.set(1 + R(), s, 1 + R()); m.position.set(p[0] + (R() - .5) * 0.7, s * 0.6, p[1] + (R() - .5) * 0.7); m.rotation.set((R() - .5) * 0.7, R() * 3, (R() - .5) * 0.7); m.castShadow = true; scene.add(m); }
    if (n++ % 3 === 0) { const L = new THREE.PointLight(o.light || 0xff7a20, 7, 7, 1.8); L.position.set(p[0], 0.8, p[1]); scene.add(L); ctx.lights.push({ x: p[0], y: 0.8, z: p[1], color: '#ff7a20', intensity: 5, distance: 6 }); }
    ctx.blockers.push({ x: +p[0].toFixed(2), z: +p[1].toFixed(2), hw: 0.4, hd: 0.4, rot: 0 }); } return n; }

/* ---------- 멈춘 차 (원작 «차선을 지킨 채 멈춰 있었다») ---------- */
export function cars(ctx, roadsW, o = {}) { const { THREE, scene, R, ST, walk } = ctx;
  const prof = (pts, w, bv) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: w, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -w / 2); return g; };
  const CAR = { sedan: { body: [[-2.3, 0.3], [2.3, 0.3], [2.35, 0.75], [1.4, 0.85], [-1.6, 0.85], [-2.3, 0.78]], glass: [[-1.25, 0.84], [0.95, 0.84], [0.45, 1.35], [-0.9, 1.35]], w: 1.78 },
    suv: { body: [[-2.35, 0.35], [2.35, 0.35], [2.4, 0.95], [1.55, 1.05], [-2.35, 1.05]], glass: [[-2.2, 1.04], [1.2, 1.04], [0.75, 1.7], [-2.15, 1.7]], w: 1.88 },
    truck: { body: [[-3.6, 0.45], [3.6, 0.45], [3.6, 2.9], [-1.6, 2.9], [-1.6, 1.9], [-3.6, 1.9]], glass: [[2.2, 1.6], [3.55, 1.6], [3.55, 2.4], [2.2, 2.4]], w: 2.3 } };
  const geos = {}; for (const [k, c] of Object.entries(CAR)) geos[k] = { body: prof(c.body, c.w - 0.12, 0.06), glass: prof(c.glass, c.w - 0.28, 0.05), w: c.w, len: Math.abs(c.body[1][0] - c.body[0][0]) };
  const wheelG = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14); wheelG.rotateX(Math.PI / 2); const wheelM = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.8 });
  const cabM = new THREE.MeshStandardMaterial({ color: 0x3a4658, roughness: 0.12, metalness: 0.4 }), cols = [0xd8d8dc, 0x1a1a1e, 0x8a8c94, 0x5a1418, 0x1c2a40, 0xe8e8ea, 0x2a2a2e, 0x6a6c72];
  const kinds = o.kinds || ['motorway', 'trunk', 'primary', 'primary_link', 'secondary']; let n = 0;
  for (const rw of roadsW) { if (!kinds.includes(rw.r.kind)) continue; const lanes = rw.r.lanes || (/motorway|trunk/.test(rw.r.kind) ? 4 : 2);
    for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 6) continue; const ux = dx / L, uz = dz / L, dir = Math.atan2(dz, dx);
      for (let ln = 0; ln < lanes; ln++) { const off = -rw.width / 2 + (ln + 0.5) * rw.width / lanes;
        for (let d = 4 + R() * 6; d < L - 4; d += 6.4 + (R() < (o.gap ?? 0.55) ? 10 + R() * 26 : R() * 1.5)) {
          const cx = a[0] + ux * d - uz * off, cz = a[1] + uz * d + ux * off, [cs, ct] = ST([cx, cz]); if (cs < walk.s0 - 30 || cs > walk.s1 + 30 || ct < walk.t0 - 30 || ct > walk.t1 + 30) continue;
          if (o.avoid && o.avoid([cx, cz])) continue;
          const type = R() < (o.trucks ?? 0.08) ? 'truck' : R() < 0.6 ? 'sedan' : 'suv', cg = geos[type], g = new THREE.Group();
          const bm = new THREE.MeshStandardMaterial({ color: cols[(R() * cols.length) | 0], roughness: 0.25, metalness: 0.7 }); g.add(new THREE.Mesh(cg.body, bm), new THREE.Mesh(cg.glass, cabM));
          for (const x of [-cg.len * 0.32, cg.len * 0.32]) for (const z of [-cg.w / 2 + 0.1, cg.w / 2 - 0.1]) { const w = new THREE.Mesh(wheelG, wheelM); w.position.set(x, 0.33, z); g.add(w); }
          if (o.wreck && R() < o.wreck) { g.rotation.z = (R() - .5) * 0.3; bm.color.multiplyScalar(0.45); }   /* 폐차장 — 녹슬고 기운 차 */
          g.position.set(cx, 0, cz); g.rotation.y = -dir + (o.wreck ? (R() - .5) * 0.6 : 0); g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(g);
          ctx.blockers.push({ x: +cx.toFixed(2), z: +cz.toFixed(2), hw: cg.len / 2, hd: cg.w / 2, rot: -dir }); n++; } } } }
  return n; }

/* ---------- 보이는 경계: 띠 가장자리 — 도시는 방호벽·철망·«통제구역», 숲은 나무 난간·«출입금지» ---------- */
export function boundary(ctx, o = {}) { const { THREE, scene, FROM, walk } = ctx, T = (w, h, d) => canvasTex(THREE, w, h, d);
  const urban = o.style !== 'fence';
  const jerseyM = new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.85 }), fenceM = new THREE.MeshStandardMaterial({ color: 0x5a5c62, roughness: 0.4, metalness: 0.7, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const tapeM = new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.6, emissive: 0x3a0806 }), poleM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 }), woodM = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
  const word = urban ? '통제구역' : '출입금지';
  const warn = T(256, 128, (g, w, h) => { g.fillStyle = '#b8241e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#fff'; g.font = '900 52px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(word, w / 2, h / 2 + 2); });
  const jG = new THREE.BoxGeometry(2.0, 0.85, 0.5), fG = new THREE.PlaneGeometry(2.0, 1.4), pG = new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), tG = new THREE.BoxGeometry(2.0, 0.08, 0.02);
  let n = 0;
  function piece(s, t, ang, sign) { const p = FROM(s, t); if (o.skip && o.skip(p)) return; const g = new THREE.Group();
    if (urban) { const j = new THREE.Mesh(jG, jerseyM); j.position.y = 0.425; g.add(j); const f = new THREE.Mesh(fG, fenceM); f.position.y = 1.55; g.add(f);
      for (const y of [1.2, 2.1]) { const tp = new THREE.Mesh(tG, tapeM); tp.position.y = y; g.add(tp); } for (const x of [-1, 1]) { const po = new THREE.Mesh(pG, poleM); po.position.set(x, 1.15, 0); g.add(po); } }
    else { for (const x of [-1, 1]) { const po = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.14), woodM); po.position.set(x, 0.6, 0); g.add(po); } for (const y of [0.55, 1.05]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.08), y > 1 ? woodM : tapeM); rl.position.y = y; g.add(rl); } }
    if (sign) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(urban ? 1.4 : 1.0, urban ? 0.7 : 0.5), new THREE.MeshBasicMaterial({ map: warn })); sg.position.set(0, urban ? 1.5 : 0.8, urban ? 0.27 : 0.09); g.add(sg); const s2 = sg.clone(); s2.rotation.y = Math.PI; s2.position.z = -sg.position.z; g.add(s2); }
    g.position.set(p[0], 0, p[1]); g.rotation.y = ang; g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(g); n++; }
  const gap = (s, t) => (o.gaps || []).some(g => Math.hypot(g[0] - s, g[1] - t) < 5);
  for (const t of [walk.t0 - 0.6, walk.t1 + 0.6]) for (let s = walk.s0; s <= walk.s1; s += 2.05) if (!gap(s, t)) piece(s, t, SCREEN_ANG, n % 9 === 0);
  for (const [end, ds] of [['s0', -0.6], ['s1', 0.6]]) for (let t = walk.t0; t <= walk.t1; t += 2.05) { const s = walk[end] + ds; if (!gap(walk[end], t)) piece(s, t, SCREEN_ANG + Math.PI / 2, n % 5 === 0); }
  /* 끝 판: «통제구역 — ○○ 방면» */
  for (const end of ['s0', 's1']) { const txt = o.closed?.[end]; if (!txt) continue; const tex = T(512, 128, (g, w, h) => { g.fillStyle = '#1a1a1e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d83a2a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#ffd8c0'; g.font = '900 44px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2); });
    const p = FROM(walk[end] + (end === 's1' ? 1.2 : -1.2), walk.t0 + (walk.t1 - walk.t0) * 0.28), m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); m.color.setScalar(1.3);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), m); pl.position.set(p[0], 3.0, p[1]); pl.rotation.y = SCREEN_ANG + Math.PI / 2 + (end === 's1' ? Math.PI : 0); scene.add(pl); }
  return n; }

/* ---------- 문: 맨바닥 자리 찾기(시선 레이캐스트) · 바닥 원 ---------- */
export function bareSpot(ctx, st0, o = {}) { const { THREE, scene, FROM, walk } = ctx; const ray = new THREE.Raycaster(), Dv = new THREE.Vector3(0, -Math.sin(PITCH), -Math.cos(PITCH));
  scene.updateMatrixWorld(true); const objs = scene.children.filter(c => !c.isLight);
  const bare = p => { ray.set(new THREE.Vector3(p[0], 0, p[1]).addScaledVector(Dv, -150), Dv); const hit = ray.intersectObjects(objs, true).find(h => h.object.visible && !h.object.isLight); return !hit || hit.point.y < 0.12; };
  for (const r of [0, 2, 3, 4, 5, 6, 8, 10]) for (let k = 0; k < (r ? 16 : 1); k++) { const a = k / 16 * Math.PI * 2, st = [st0[0] + Math.cos(a) * r, st0[1] + Math.sin(a) * r];
    if (st[1] < walk.t0 + 2 || st[1] > walk.t1 - 2 || st[0] < walk.s0 + 1 || st[0] > walk.s1 - 1) continue; if (o.ok && !o.ok(st)) continue;
    if ([[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]].every(([ds, dt]) => bare(FROM(st[0] + ds, st[1] + dt)))) return st; }
  return st0; }
export function gateRing(ctx, p, r = 3.2, color = 0x40d8ff) { const { THREE, scene } = ctx; const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.25, r, 48), new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.8 })); m.rotation.x = -Math.PI / 2; m.position.set(p[0], 0.05, p[1]); scene.add(m); }

/* ---------- 가로등 (몇몇만 켜짐) ---------- */
export function lamps(ctx, spots, o = {}) { const { THREE, scene } = ctx; const poleM = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.5, metalness: 0.6 }); let n = 0;
  for (const p of spots) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.2, 6), poleM); pole.position.set(p[0], 2.6, p[1]); pole.castShadow = true; scene.add(pole); ctx.blockers.push({ x: +p[0].toFixed(2), z: +p[1].toFixed(2), hw: 0.2, hd: 0.2, rot: 0 });
    const lit = n % 3 !== 1; const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: lit ? (o.color || 0xffe0a0) : 0x3a3a3a, toneMapped: false })); head.position.set(p[0], 5.25, p[1]); scene.add(head);
    if (lit) { const L = new THREE.PointLight(o.color || 0xffd890, 9, 14, 1.5); L.position.set(p[0], 5, p[1]); scene.add(L); ctx.lights.push({ x: p[0], y: 5, z: p[1], color: '#ffd890', intensity: 7, distance: 12 }); } n++; }
  return n; }

/* ---------- 큰 글자 판 (간판·표지) ---------- */
export function board(ctx, p, text, o = {}) { const { THREE, scene } = ctx; const tex = canvasTex(THREE, 512, 128, (g, w, h) => { g.fillStyle = o.bg || '#14161c'; g.fillRect(0, 0, w, h); g.strokeStyle = o.edge || '#d8b030'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = o.fg || '#ffe8b0'; let f = o.font || 50; const font = () => { g.font = '900 ' + f + 'px "Noto Sans KR",sans-serif'; }; font(); while (g.measureText(text).width > w - 34 && f > 14) { f -= 2; font(); }   /* 긴 글은 판에 맞게 줄인다 (판교 안내문이 잘렸다) */
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3); });
  const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); m.color.setScalar(o.bright ?? 1.2); const pl = new THREE.Mesh(new THREE.PlaneGeometry(o.w || 5, (o.w || 5) / 4), m);
  pl.position.set(p[0], o.y ?? 4, p[1]); pl.rotation.y = o.rot ?? 0; scene.add(pl); return pl; }

/* ---------- 그림 범위: 걷는 띠 + 먼 쪽 벽 높이 ---------- */
export function extent(ctx, o = {}) { const { FROM, walk } = ctx, out = []; const H = o.h ?? 18;
  for (let s = walk.s0 - 8; s <= walk.s1 + 8; s += 4) for (let t = walk.t0 - 8; t <= walk.t1 + 10; t += 4) { const p = FROM(s, t); out.push([p[0], 0, p[1]]); if (t > walk.t1 - 2) out.push([p[0], H, p[1]]); }
  return out; }

/* ---------- 넓은 필드 땅 꾸미기 (디렉터 2026-10-06 «필드를 넓게») ----------
   띠를 넓히면 빈 바닥이 넓게 드러난다 — 흙·풀·낙엽 얼룩, 바위·덤불·쓰러진 통나무, (도시) 잔해 더미·드럼통·폐타이어.
   덤불은 1 m 아래라 인물을 가리지 않는다. 큰 바위·통나무·잔해는 막는다. 값잡음(noise2)으로 뭉치게 — 고르게 뿌리면 벽지 같다. */
export function noise2(R, cell = 40) { const g = new Map(), v = (i, j) => { const k = i + ',' + j; if (!g.has(k)) g.set(k, R()); return g.get(k); };
  const sm = t => t * t * (3 - 2 * t);
  return (x, z) => { const fx = x / cell, fz = z / cell, i = Math.floor(fx), j = Math.floor(fz), u = sm(fx - i), w = sm(fz - j);
    return (v(i, j) * (1 - u) + v(i + 1, j) * u) * (1 - w) + (v(i, j + 1) * (1 - u) + v(i + 1, j + 1) * u) * w; }; }
export function dress(ctx, region, tex, o = {}) { const { THREE, scene, R, FROM } = ctx, keep = o.keep || (() => true), N = noise2(R, o.cell || 36);
  const A = (region.s1 - region.s0) * (region.t1 - region.t0), pick = n => { const out = []; for (let i = 0; i < n * 4 && out.length < n; i++) { const p = FROM(region.s0 + R() * (region.s1 - region.s0), region.t0 + R() * (region.t1 - region.t0)); if (!keep(p) || isClear(ctx, p, 0.5)) continue; out.push(p); } return out; };
  const stat = {};
  /* 1) 얼룩 — 낙엽·흙·풀. 모양이 둥글면 티가 나서 꼭짓점마다 반지름을 흔든다 */
  const patchM = (o.patches || ['forest', 'sand', 'grass']).map(k => new THREE.MeshStandardMaterial({ map: tex[k], roughness: 1, color: k === 'sand' ? 0x8a7a6a : 0xffffff, transparent: true, opacity: 0.85 }));
  let np = 0; for (const p of pick(Math.round(A / (o.patchEvery || 700)))) { const r = 3 + R() * 10, n = 9, pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r * (0.6 + R() * 0.6); pts.push([p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr]); }
    flatPoly(ctx, pts, patchM[(R() * patchM.length) | 0], 0.003 + R() * 0.002); np++; } stat.patches = np;
  const inst = (geo, mats, spots, place) => { const per = mats.map(() => []); spots.forEach(p => per[(R() * mats.length) | 0].push(p));
    per.forEach((ps, k) => { if (!ps.length) return; const m = new THREE.InstancedMesh(geo, mats[k], ps.length), mtx = new THREE.Matrix4(); ps.forEach((p, i) => { place(p, mtx); m.setMatrixAt(i, mtx); }); m.castShadow = true; m.receiveShadow = true; scene.add(m); }); return spots.length; };
  const q4 = new THREE.Quaternion(), e = new THREE.Euler(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  /* 2) 바위 — 뭉친 곳에 많이. 큰 것만 막는다 */
  const rockG = VIEW3D ? lumpy(new THREE.IcosahedronGeometry(1, 1), 0.22, 11) : new THREE.DodecahedronGeometry(1, 0), rockM = (o.rockColors || (o.urban ? [0x6a6662, 0x5a5856, 0x4c4a48] : [0x5a4a3e, 0x6a5a4a, 0x4a3e36])).map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true, map: VIEW3D ? gritTex(THREE) : null }));
  const rocks = pick(Math.round(A / (o.rockEvery || 160))).filter(p => R() < 0.25 + N(p[0], p[1]) * 1.2);
  stat.rocks = inst(rockG, rockM, rocks, (p, mtx) => { const k = 0.35 + Math.pow(R(), 2.2) * 1.5; mtx.compose(V(p[0], k * 0.25, p[1]), q4.setFromEuler(e.set(R() * 0.6, R() * 6, R() * 0.6)), V(k * (0.8 + R() * 0.6), k * (0.45 + R() * 0.35), k * (0.8 + R() * 0.6)));
    if (k > 0.9) ctx.blockers.push({ x: +p[0].toFixed(2), z: +p[1].toFixed(2), hw: k * 0.8, hd: k * 0.8, rot: 0 }); });
  /* 3) 덤불 — 무릎 높이(인물을 가리지 않는다) */
  const bushG = VIEW3D ? lumpy(new THREE.IcosahedronGeometry(0.7, 0), 0.18, 12) : new THREE.IcosahedronGeometry(0.7, 0), bushM = (o.bushColors || [0x2e3a26, 0x3a3424, 0x4a2e22]).map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
  const bushes = pick(Math.round(A / (o.bushEvery || 45))).filter(p => R() < 0.2 + N(p[0] + 500, p[1]) * 1.3);
  stat.bushes = inst(bushG, bushM, bushes, (p, mtx) => { const k = 0.6 + R() * 0.7; mtx.compose(V(p[0], 0.3 * k, p[1]), q4.setFromEuler(e.set(0, R() * 6, 0)), V(k * (1 + R() * 0.5), k * (0.55 + R() * 0.25), k * (1 + R() * 0.5))); });
  /* 4) 쓰러진 통나무 (숲) */
  if (o.logs !== false) { const logG = new THREE.CylinderGeometry(0.22, 0.3, 1, 7), logM = [new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 1 })];
    stat.logs = inst(logG, logM, pick(Math.round(A / (o.logEvery || 600))), (p, mtx) => { const len = 2 + R() * 3, ry = R() * Math.PI; mtx.compose(V(p[0], 0.25, p[1]), q4.setFromEuler(e.set(0, ry, Math.PI / 2, 'YXZ')), V(1, len, 1));
      ctx.blockers.push({ x: +p[0].toFixed(2), z: +p[1].toFixed(2), hw: len / 2, hd: 0.3, rot: ry }); }); }
  /* 5) 도시 잔해 — 콘크리트 덩이 더미 · 드럼통 · 폐타이어 */
  if (o.urban) { const chunkG = VIEW3D ? lumpy(new THREE.BoxGeometry(1, 1, 1), 0.12, 13, false) : new THREE.BoxGeometry(1, 1, 1), chunkM = [0x6a6662, 0x5a5652, 0x4a4442].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, map: VIEW3D ? gritTex(THREE) : null }));
    const piles = pick(Math.round(A / (o.pileEvery || 500))), chunks = []; for (const p of piles) { const n = 5 + (R() * 8 | 0), r = 1.2 + R() * 1.6; for (let i = 0; i < n; i++) chunks.push([p[0] + (R() - .5) * r * 2, p[1] + (R() - .5) * r * 2]); ctx.blockers.push({ x: +p[0].toFixed(2), z: +p[1].toFixed(2), hw: r * 0.7, hd: r * 0.7, rot: 0 }); }
    stat.rubble = inst(chunkG, chunkM, chunks, (p, mtx) => { const k = 0.3 + R() * 0.9; mtx.compose(V(p[0], k * 0.35, p[1]), q4.setFromEuler(e.set(R(), R() * 6, R())), V(k * (1 + R()), k * (0.5 + R() * 0.6), k * (0.8 + R()))); });
    const drumG = new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), drumM = [0x6a3a22, 0x2a4a5a, 0x5a5a2a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.5 }));
    stat.drums = inst(drumG, drumM, pick(Math.round(A / (o.drumEvery || 900))), (p, mtx) => { const fall = R() < 0.3; mtx.compose(V(p[0], fall ? 0.3 : 0.45, p[1]), q4.setFromEuler(e.set(fall ? Math.PI / 2 : 0, R() * 6, 0)), V(1, 1, 1)); });
    const tireG = new THREE.TorusGeometry(0.34, 0.13, 6, 12), tireM = [new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 })];
    stat.tires = inst(tireG, tireM, pick(Math.round(A / (o.tireEvery || 900))), (p, mtx) => { mtx.compose(V(p[0], 0.13, p[1]), q4.setFromEuler(e.set(Math.PI / 2, 0, R() * 6)), V(1, 1, 1)); }); }
  return stat; }
