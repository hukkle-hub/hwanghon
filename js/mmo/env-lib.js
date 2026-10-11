/* 황혼 2D 맵 MMORPG — 실측 필드 장면 부품 (docs/design/185 §6.7)
   강남(env-osm.js)·남산(env-namsan.js)에서 쓰던 부품을 존 여럿이 같이 쓰게 모은 것.
   env-field.js 가 존 설정(js/mmo/zones.js)대로 이 부품을 골라 세운다.
   모든 함수는 ctx = { THREE, scene, R, ST, FROM, W, walk, tc, lights, blockers, clear } 를 받는다. */
import { patchPuddleMaterial, PUDDLE } from './puddle-shader.js';
import { mergeGeometries } from '../../vendor/three/BufferGeometryUtils.js';
import { SKY_REFL } from './sky-shader.js';
import { interiorFacadeMats, interiorCurtainMat, interiorBrickMats, pickFacade } from './facade-shader.js';   /* 3D 가짜 실내 창 (문서 229) — facade-shader 는 아무것도 import 하지 않는다 */
export const PITCH = 55 * Math.PI / 180;
export const SCREEN_ANG = 28 * Math.PI / 180;
/* 3D 필드(world3d)에서만 모양을 다듬는다 — 굽기(위에서 본 2D 그림)·자리·막이는 그대로 (문서 215) */
let VIEW3D = false; export function setView3d(v) { VIEW3D = !!v; }
let INTERIOR = true; export function setInterior(v) { INTERIOR = !!v; }   /* 3D 가짜 실내 창 켬/끔 — world3d ?im=0 (문서 229) */
/* 3D 땅 층 깊이 순서 (문서 220 §15): 땅 다각형끼리는 2 mm 차 — 16비트 깊이면 10 m 에서 15 mm 를 못 가려 «나중에 그린 것» 이 이긴다.
   결 셰이더로 프로그램 순서가 바뀌자 콘크리트가 풀밭을 덮었다(제주). 깊이 밀기 단위는 깊이 버퍼 최소 단위의 배수라 비트 수와 무관하게 순서를 고정한다.
   뒤 → 앞: 바닥판 +12 · 얼룩 +6 · 콘크리트·숲 0 · 풀·모래 −3 · 물 −6 · 길 −24 · 웅덩이 −30 · 차선·횡단보도 −36 */
export const LAYER = { ground: 12, patch: 6, low: 0, grass: -3, water: -6, road: -24, puddle: -30, paint: -36 };
export function layer(m, units) { if (!VIEW3D || !units) return m; m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = units; return m; }
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
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), layer(new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, metalness: 0.05 }), LAYER.ground)); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m); return m; }
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
  const roadM = new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.34, metalness: 0.25 }), busM = new THREE.MeshStandardMaterial({ color: 0x6a2a2a, roughness: 0.6 }); if (VIEW3D) patchPuddleMaterial(THREE, roadM);   /* 3D: 젖은 길 웅덩이 (문서 229 §10) */
  const pathM = new THREE.MeshStandardMaterial({ map: tex.paver, roughness: 0.75 }), stepM = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9 });
  const LANE = { motorway: 3.5, trunk: 3.4, primary: 3.3, primary_link: 3.3, secondary: 3.2, secondary_link: 3.2, tertiary: 3.1, motorway_link: 3.4, trunk_link: 3.4 };
  const dashM = new THREE.MeshStandardMaterial({ color: 0xc8c8b8, roughness: 0.7, transparent: true, opacity: 0.55 }), out = [];
  /* 3D: 길이 풀밭·광장 다각형보다 늘 위에 (1 cm 높이 차는 멀리선 깊이 정밀도가 모자라 그리는 순서 싸움 — 셰이더가 바뀌면 길이 통째로 사라졌다, 문서 220) */
  if (VIEW3D) for (const [m, k] of [[roadM, -4], [busM, -5], [pathM, -3], [stepM, -3], [dashM, -6]]) { m.polygonOffset = true; m.polygonOffsetFactor = 0; m.polygonOffsetUnits = k * 6; }   /* 기울기 비례(factor)는 비스듬한 바닥에서 너무 커져 침목·계단 같은 낮은 물체까지 덮었다 — 고정 몫(units)만: 깊이 공간에서 고정이라 멀수록 커진다 */
  const dashed = (pts, off, solid) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 0.5) continue; dx /= L; dz /= L;
      const step = solid ? L : 6, len = solid ? L : 3; for (let d = 0; d + len <= L + 1e-3; d += step) { const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.12), dashM); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(dz, dx);
        m.position.set(a[0] + dx * (d + len / 2) - dz * off, VIEW3D ? 0.075 : 0.03, a[1] + dz * (d + len / 2) + dx * off); scene.add(m); } } };
  for (const r of osm.roads) { if (r.tunnel || r.layer < 0 || r.kind === 'platform') continue; const pts = r.line.map(W); if (!near(ctx, pts, 80)) continue;
    let width, mat = roadM, y = 0.02, lanes = r.lanes || (/motorway|trunk/.test(r.kind) ? 4 : 2);
    if (LANE[r.kind]) width = lanes * LANE[r.kind];
    else if (r.kind === 'busway') { width = 3.6; mat = busM; y = 0.025; }
    else if (/residential|unclassified|living_street/.test(r.kind)) width = r.width || 7;
    else if (r.kind === 'service') width = r.width || 4.5;
    else if (/footway|path|pedestrian|steps|cycleway|track/.test(r.kind)) { width = r.width || (r.kind === 'pedestrian' ? 5 : r.kind === 'track' ? 3 : 2.4); mat = pathM; y = 0.025; }
    else continue;
    const m = new THREE.Mesh(ribbon(THREE, pts, width, VIEW3D ? y + 0.04 : y), mat); m.receiveShadow = true; scene.add(m); out.push({ r, width, pts });   /* 3D: 풀밭·광장 판보다 4 cm 위 — 1 cm 차는 순서 싸움에서 졌다 (문서 220) */
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
    water: VIEW3D ? waterMat(THREE) : new THREE.MeshStandardMaterial({ color: 0x1a2c38, roughness: 0.06, metalness: 0.5 }), forest: new THREE.MeshStandardMaterial({ map: tex.forest, roughness: 1 }) };
  layer(M.grass, LAYER.grass); layer(M.sand, LAYER.grass);   /* 3D 층 순서(LAYER): 풀·모래(0.008)는 콘크리트·숲(0.006, 0) 앞 — 높이 2 mm 차만으로는 16비트 깊이에서 그리는 순서가 이겼다 (문서 220 §15) */
  for (const a of osm.areas) { const pts = unclose(a.poly.map(W)); if (pts.length < 3 || !near(ctx, pts, 120)) continue; const k = a.kind || '';
    if (/^water$|reservoir|basin|riverbank/.test(k)) { flatPoly(ctx, pts, M.water, 0.012); waters.push(pts); if (VIEW3D) { const sg = signedArea(pts) > 0 ? 1 : -1; foamBand(ctx, [...pts, pts[0]], 0, sg * 2.2); } }   /* 3D: 물가 안쪽으로 거품 (돌아가는 방향에 따라 안쪽이 다르다) */
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
  const waterM = VIEW3D ? waterMat(THREE) : new THREE.MeshStandardMaterial({ color: 0x1a2c38, roughness: 0.06, metalness: 0.5 }), runM = new THREE.MeshStandardMaterial({ color: 0x3e3e42, roughness: 0.6 }), markM = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.6 });
  const tetraM = new THREE.MeshStandardMaterial({ color: 0x8a8682, roughness: 0.85 }), tetraG = new THREE.TetrahedronGeometry(1.1, 0);
  let n = 0;
  for (const l of osm.lines || []) { if (l.tunnel || l.layer < 0) continue; const pts = l.line.map(W); if (!near(ctx, pts, 80)) continue; n++;
    if (/^rail:(rail|subway|light_rail|narrow_gauge|tram)/.test(l.kind)) { scene.add(new THREE.Mesh(ribbon(THREE, pts, 3.2, 0.03), ballastM));
      for (const off of [-0.72, 0.72]) { const sh = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [p[0] - dz / L * off, p[1] + dx / L * off]; });
        const m = new THREE.Mesh(ribbon(THREE, sh, 0.12, 0.2), railM); scene.add(m); }
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); for (let d = 0.3; d < L; d += 0.7) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.22), sleeperM); s.position.set(a[0] + dx / L * d, 0.1, a[1] + dz / L * d); s.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2; scene.add(s); } } }
    else if (/^water:(river|canal|stream|ditch|drain)/.test(l.kind)) { const w = l.width || (/river|canal/.test(l.kind) ? 18 : 3); const m = new THREE.Mesh(ribbon(THREE, pts, w, 0.012), waterM); scene.add(m);
      if (VIEW3D && w > 4) { foamBand(ctx, pts, w / 2, w / 2 - 1.6); foamBand(ctx, pts, -w / 2, -w / 2 + 1.6); }   /* 강둑 두 쪽 */
      if (w > 4) ctx.blockers.push({ line: pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]), w: w / 2, water: true }); }
    else if (/^aero:(runway|taxiway)/.test(l.kind)) { const w = l.width || (/runway/.test(l.kind) ? 45 : 18); scene.add(new THREE.Mesh(ribbon(THREE, pts, w, 0.02), runM));
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); for (let d = 10; d < L; d += 60) { const s = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.9), markM); s.rotation.x = -Math.PI / 2; s.rotation.z = -Math.atan2(dz, dx); s.position.set(a[0] + dx / L * d, 0.03, a[1] + dz / L * d); scene.add(s); } } }
    else if (l.kind === 'coastline') { /* 해안선: OSM 은 길 방향의 왼쪽이 땅 — 오른쪽으로 2 km 밀어 바다 다각형을 닫는다 */
      const a0 = pts[0], a1 = pts.at(-1), dx = a1[0] - a0[0], dz = a1[1] - a0[1], L0 = Math.hypot(dx, dz) || 1, rx = -dz / L0 * 2000, rz = dx / L0 * 2000;
      const poly = [...pts, [a1[0] + rx, a1[1] + rz], [a0[0] + rx, a0[1] + rz]]; flatPoly(ctx, poly, waterM, 0.012);
      if (VIEW3D) { foamBand(ctx, pts, 0, 3.2); foamBand(ctx, pts, 6, 8.5, 0.028); }   /* 3D: 바다 쪽(오른쪽) 물가 거품 + 한 줄 더 바깥의 부서지는 물결 */
      ctx.blockers.push({ poly: coastBlock(ctx, pts, poly).map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]), water: true }); }
    else if (/^man:(pier|breakwater|groyne|dyke)/.test(l.kind)) { scene.add(new THREE.Mesh(ribbon(THREE, pts, 8, 0.6), runM));
      for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); for (let d = 0; d < L; d += 2.2) for (const side of [-1, 1]) { const t4 = new THREE.Mesh(tetraG, tetraM); t4.position.set(a[0] + dx / L * d - dz / L * 5.5 * side, 0.6, a[1] + dz / L * d + dx / L * 5.5 * side); t4.rotation.set(R() * 3, R() * 3, R() * 3); t4.castShadow = true; scene.add(t4); } } } }
  return n; }

/* ---------- 건물: 실측 윤곽 × 높이, 가까운 쪽(화면 아래)은 1층으로 잘라 길을 가리지 않게 ---------- */
export function buildings(ctx, osm, tex, o = {}) { const { THREE, scene, R, W, ST, tc } = ctx, out = []; let ruinRubbleM = null, ruinWallM = null;
  const brickMats = VIEW3D && INTERIOR && o.interior !== false ? interiorBrickMats(THREE) : null;   /* 저층 반은 붉은 벽돌 빌라 */
  const facadeMats = VIEW3D && INTERIOR && o.interior !== false ? interiorFacadeMats(THREE) : tex.facades.map(t => new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0.25 }));   /* 3D: 가짜 실내 창 */
  const curtainM = VIEW3D && INTERIOR && o.interior !== false ? interiorCurtainMat(THREE) : new THREE.MeshStandardMaterial({ map: tex.curtain, emissiveMap: tex.curtain, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.15, metalness: 0.6 });
  const roofM = new THREE.MeshStandardMaterial({ color: 0x2a2830, roughness: 0.9 }), cutM = new THREE.MeshStandardMaterial({ color: 0x2c2a32, roughness: 0.95 });
  const area = poly => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
  const far = [];
  for (const b of osm.buildings) { if (b.under) continue; const pts = unclose(b.poly.map(W)); if (pts.length < 3 || !near(ctx, pts, o.pad ?? 50)) { if (VIEW3D && pts.length >= 3 && near(ctx, pts, FAR_PAD)) far.push([pts, b]); continue; }
    const ar = area(pts); let h = b.height || (b.levels ? b.levels * 3.6 : (ar > 900 ? 22 + R() * 20 : ar > 300 ? 12 + R() * 12 : 7 + R() * 7)); h = Math.min(h, o.maxH || 260);
    const cst = pts.reduce((a, p) => { const st = ST(p); return [a[0] + st[0] / pts.length, a[1] + st[1] / pts.length]; }, [0, 0]), full = h, nearSide = cst[1] < (o.cutT ?? tc); if (nearSide) h = Math.min(h, 4.2);
    /* 넓은 필드: 걷는 구역 안 건물은 «무너진 저층» — 원작의 폐허 서울. 고층이 그대로면 그 뒤가 통째로 가려진다(55° 에서 높이 × 0.7 m) */
    const ruined = !nearSide && o.ruin && o.ruin(cst); if (ruined) h = Math.min(h, o.ruinH[0] + R() * (o.ruinH[1] - o.ruinH[0]));
    if (o.skip && o.skip(pts, b)) continue;
    if (VIEW3D && ruined) { ruinWallM = ruinWallM || tex.facades.map(t => new THREE.MeshStandardMaterial({ map: t, color: 0xe0d6d0, roughness: 0.75, metalness: 0.2, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.3 }));   /* 폐허 벽 — 창에 불이 켜져 있으면 안 된다 */
      ruinShell(THREE, scene, pts, h, b.id | 0, ruinWallM[(b.id >>> 3) % 4], cutM, ruinRubbleM || (ruinRubbleM = new THREE.MeshStandardMaterial({ color: 0x5a5652, roughness: 0.95, map: gritTex(THREE) })));
      ctx.blockers.push({ poly: pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) }); out.push({ pts, h, full, near: nearSide, ruined, cst, id: b.id }); ctx.clear.push({ pts: [...pts, pts[0]], r: 1.5 }); continue; }
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1]))), { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const tall = full > 45 && o.curtain;
    const mesh = new THREE.Mesh(geo, [nearSide || ruined ? cutM : roofM, tall && !ruined ? curtainM : pickFacade(facadeMats, brickMats, b.id, full)]); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    if (VIEW3D) addDeco(THREE, scene, buildingDeco(THREE, pts, h, b.id | 0, { roof: !nearSide && !ruined, shops: !tall, aptNo: aptLabel(b) }), b.id | 0);
    ctx.blockers.push({ poly: pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) }); out.push({ pts, h, full, near: nearSide, ruined, cst, id: b.id }); ctx.clear.push({ pts: [...pts, pts[0]], r: 1.5 }); }
  if (far.length) farCity(THREE, scene, far, tex, area);
  return out; }
/* ---------- 먼 도시 (3D 필드만, 문서 219) — 걷는 띠 밖 실제 OSM 건물을 지평선까지. 굽기는 띠 둘레 50 m 까지만 세워서 그 너머가 빈 땅이었다
   (3인칭은 늘 지평선이 보인다 — «도시가 끝난 판» 처럼 보였다). 높이는 OSM 층수 또는 건물 id 해시(장면 난수 R 안 씀) · 그림자·카메라 막이 없음 · 막이 없음(못 가는 곳) */
const FAR_PAD = 300; export const FAR = { n: 0, tris: 0 };
function farCity(THREE, scene, far, tex, area) {
  /* 창 불빛만 그린 발광 지도 (파사드와 같은 격자: 8 창 × 4 층 = 14.4 m) — 파사드 지도로 발광을 키우면 벽까지 밝아졌다. 밤엔 world3d 가 세기를 올린다 */
  const r = rng(5150), win = canvasTex(THREE, 256, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let fy = 0; fy < 4; fy++) for (let fx = 0; fx < 8; fx++) { const u = r(); if (u > 0.05) continue; g.fillStyle = u < 0.032 ? '#ffc874' : u < 0.042 ? '#ffe2b0' : '#8ad0ff';   /* 폐허 도시 — 창 20 % 가 켜져 있었다 → 5 % (문서 229 §18) */ g.fillRect(fx * 32 + 3, fy * 64 + 10, 26, 44); } }, [1 / 14.4, 1 / 14.4]);
  const mats = tex.facades.map(t => new THREE.MeshStandardMaterial({ map: t, emissiveMap: win, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.7, metalness: 0.2 })), roofM = new THREE.MeshStandardMaterial({ color: 0x24222a, roughness: 0.95 });
  for (const m of mats) m.userData.farGlow = 0.5;   /* 황혼 0.5 → 밤 ×2 · 낮 ×0.3 (city-life) */
  const cells = new Map(), put = (key, g) => { let l = cells.get(key); if (!l) cells.set(key, l = []); l.push(g); }, farApt = [];
  for (const [pts, b] of far) { const ar = area(pts), id = b.id | 0, u = hashU(id, 3, 9);
    const h = Math.min(120, b.height || (b.levels ? b.levels * 3.4 : ar > 900 ? 24 + u * 30 : ar > 300 ? 12 + u * 14 : 6 + u * 8));
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1]))), { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length, cell = Math.floor(cx / 160) + ',' + Math.floor(cz / 160);   /* 멀어서 160 m 칸이면 충분 — 64 m 는 메시가 300 개 늘었다 */
    /* 뽑아 올린 기하의 무리(0 = 지붕·바닥, 1 = 벽)를 따로 떼어 재질별로 — 재질 여럿인 메시는 static-merge 가 안 합친다 */
    for (const gr of g.groups) { const sub = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv']) sub.setAttribute(k, g.attributes[k]); sub.setIndex(Array.from(g.index ? g.index.array.slice(gr.start, gr.start + gr.count) : [...Array(gr.count)].map((_, i) => gr.start + i)));
      put(cell + '|' + (gr.materialIndex === 0 ? 'r' : 'w'), sub); FAR.tris += gr.count / 3; }
    const lab = aptLabel(b); if (lab && h >= 15) aptGlyphs(THREE, pts, h, lab, farApt);   /* 먼 아파트에도 동 번호 — 멀리서 보이는 게 본래 몫 (문서 229 §17) */
    if (h > 13 && hashU(id, 4, 9) < 0.3) (FAR.tops || (FAR.tops = [])).push([+cx.toFixed(1), +h.toFixed(1), +cz.toFixed(1)]);   /* 연기 기둥 후보 (city-life) */
    FAR.n++; }
  for (const [key, list] of cells) { const k = key.split('|')[1], g = mergeGeometries(list.map(x => x.toNonIndexed()), false); if (!g) continue;
    const [cx, cz] = key.split('|')[0].split(',').map(Number), m = new THREE.Mesh(g, k === 'r' ? roofM : mats[(Math.floor(hashU(cx, cz, 5) * 4)) % 4]);   /* 칸마다 파사드 하나 — 칸당 메시 둘 */ m.userData.noCam = true; m.userData.far = 1; scene.add(m); FAR.meshes = (FAR.meshes || 0) + 1; }
  if (farApt.length) { addDeco(THREE, scene, { aptno: farApt }, -1); } }
export const inBuilding = (built, p) => built.some(b => inPoly(p, b.pts));
/* 무너진 저층 (3D 필드만, 문서 216) — 납작한 상자 대신 «속 빈 벽체 + 들쭉날쭉 부서진 윗선 + 군데군데 빠진 벽 + 안쪽 잔해 더미».
   자리·높이 한도·막이(윤곽 그대로)는 굽기와 같고, 모양의 흔들림은 건물 id 해시로만 정한다(장면 난수 R 을 안 쓴다 — 뒤 자리가 그대로). */
const hashU = (a, b, c) => { let n = Math.imul((a | 0) ^ Math.imul(b + 1, 0x9E3779B1) ^ Math.imul(c + 7, 0x85EBCA77), 0xC2B2AE3D); n ^= n >>> 15; n = Math.imul(n, 0x27D4EB2F); n ^= n >>> 13; return (n >>> 0) / 4294967296; };
function boxUV(THREE, w, h, d) { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, n = g.attributes.normal;   /* 면마다 1 m = 텍스처 1 단위 (뽑아 올린 건물과 같은 눈금) */
  for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), U = ax > 0.5 ? d : w, V = ay > 0.5 ? d : h; uv.setXY(i, uv.getX(i) * U, uv.getY(i) * V); } return g; }
export const RUINS = [];   /* 검수용 — 3D 무너진 건물 자리 [x, z, 높이, 반지름] */
/* 벽 한 토막: 밑은 땅, 윗선은 왼끝 ha → 오른끝 hb 로 비스듬히 부서진 판. UV 는 벽을 따라 잰 거리(s0 부터) · 높이 — 토막이 바뀌어도 창 무늬가 이어진다 */
function wallPiece(THREE, L, T, ha, hb, s0) { const g = new THREE.BoxGeometry(L, 1, T), P = g.attributes.position, N = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i) > 0 ? (x < 0 ? ha : hb) : 0; P.setY(i, y);
    const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)); uv.setXY(i, ay > 0.5 ? s0 + x + L / 2 : ax > 0.5 ? P.getZ(i) : s0 + x + L / 2, ay > 0.5 ? P.getZ(i) : y); }
  g.computeVertexNormals(); return g; }
export function ruinShell(THREE, scene, pts, h, id, wallM, floorM, rubbleM) {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length, T = 0.4, walls = [], rubble = [], slabs = []; let s = 0, rad = 0;
  for (const p of pts) rad = Math.max(rad, Math.hypot(p[0] - cx, p[1] - cz));
  for (let e = 0; e < pts.length; e++) { const p = pts[e], q = pts[(e + 1) % pts.length], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz); if (L < 0.5) { s += L; continue; }
    let nx = -dz / L, nz = dx / L; if ((cx - p[0]) * nx + (cz - p[1]) * nz < 0) { nx = -nx; nz = -nz; }   /* 안쪽으로 벽 두께만큼 */
    const n = Math.max(1, Math.round(L / 2.6)), yaw = -Math.atan2(dz, dx), seg = L / n;
    /* 마디 높이: 이웃 토막과 대개 이어지고(윗선이 톱니처럼 오르내림), 가끔 뚝 끊긴다 */
    const hj = []; for (let k = 0; k <= n; k++) hj.push(h * (0.3 + 0.7 * hashU(id, e, k + 101)));
    for (let k = 0; k < n; k++) { const u = hashU(id, e, k); if (n > 2 && u < 0.14) continue;   /* 빠진 벽 — 안이 들여다보인다 */
      const brk = hashU(id, e, k + 606) < 0.3, ha = brk ? hj[k] * (0.4 + 0.4 * hashU(id, e, k + 707)) : hj[k], hb = hj[k + 1], hk = Math.max(ha, hb);
      const a = k / n, b = (k + 1) / n, mx = p[0] + dx * (a + b) / 2 + nx * T / 2, mz = p[1] + dz * (a + b) / 2 + nz * T / 2;
      const g = wallPiece(THREE, seg + 0.02, T, ha, hb, s + seg * k); g.rotateY(yaw); g.translate(mx, 0, mz); walls.push(g);
      /* 2층 바닥판 조각 — 벽이 3.6 m 넘게 남은 곳에만, 안쪽으로 1~2.5 m 삐져나와 살짝 처졌다 */
      if (Math.min(ha, hb) > 3.6 && hashU(id, e, k + 808) < 0.55) { const w = 1 + hashU(id, e, k + 909) * 1.5, sl = new THREE.BoxGeometry(seg * (0.6 + 0.4 * hashU(id, e, k + 111)), 0.22, w);
        sl.translate(0, 0, w / 2); sl.rotateX(0.05 + hashU(id, e, k + 222) * 0.18); sl.rotateY(yaw); const sx = nx * T, sz = nz * T;
        /* rotateY(yaw) 뒤 +z 가 안쪽(nx,nz)이나 바깥이 될 수 있다 — 바깥이면 뒤집는다 */
        if (Math.sin(yaw) * nx + Math.cos(yaw) * nz < 0) sl.rotateY(Math.PI) ;
        sl.translate(mx + sx, 3.2, mz + sz); slabs.push(sl); }
      if (hashU(id, e, k + 202) < 0.35) { const r = boxUV(THREE, 0.9 + hashU(id, e, k + 303), 0.5 + hashU(id, e, k + 404) * 0.7, 0.8); lumpy(r, 0.12, id + e + k, false);   /* 무너진 벽 밑 덩이 */
        r.rotateY(hashU(id, e, k + 505) * 6); r.translate(mx + nx * 0.9, 0.3, mz + nz * 0.9); rubble.push(r); } }
    s += L; }
  /* 안쪽 바닥 · 가운데 잔해 더미 */
  const fl = new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])))); fl.rotateX(-Math.PI / 2); fl.translate(0, 0.04, 0);
  for (let i = 0; i < 5; i++) { const r = boxUV(THREE, 1.2 + hashU(id, i, 9) * 1.4, 0.6 + hashU(id, i, 10) * 0.9, 1 + hashU(id, i, 11)); lumpy(r, 0.16, id * 7 + i, false);
    r.rotateY(hashU(id, i, 12) * 6); r.translate(cx + (hashU(id, i, 13) - 0.5) * 3, 0.35, cz + (hashU(id, i, 14) - 0.5) * 3); rubble.push(r); }
  const out = []; RUINS.push([+cx.toFixed(1), +cz.toFixed(1), +h.toFixed(1), +rad.toFixed(1)]);
  for (const [list, m] of [[walls, wallM], [rubble, rubbleM], [[fl, ...slabs], floorM]]) { if (!list.length) continue; for (const g of list) if (g.index) { const ng = g.toNonIndexed(); list[list.indexOf(g)] = ng; g.dispose(); }
    const g = mergeGeometries(list, false); list.forEach(x => x.dispose()); if (!g) continue;
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = m !== floorM || slabs.length > 0; mesh.receiveShadow = true; mesh.userData.ruin = id; scene.add(mesh); out.push(mesh); }
  return out; }

/* ---------- 멀쩡한 건물 꾸밈 (3D 필드만, 문서 218) — 옥상 난간·물탱크·실외기·안테나, 1층 상가 띠 · 간판 ----------
   전부 건물 id 해시로 정한다(장면 난수 R 을 안 쓴다). 막이는 그대로 — 난간·옥상 물건은 윤곽 안, 상가 띠·간판은 벽에서 0.06~0.5 m.
   카메라 막이(static-merge)에서는 뺀다(noCam) — 건물 상자가 이미 막는다. 그리기 호출은 합치기가 48 m 칸별로 묶는다. */
const SIGNS = ['약국', '편의점', 'PC방', '치킨', '노래방', '부동산', '식당', '세탁소', '미용실', '휴대폰', '안경', '분식', '철물점', '정육점', '마트', '의원'];
let DECO_TEX = null;
export function decoTex(THREE) { if (DECO_TEX) return DECO_TEX; const r = rng(4242);
  /* 상가 4종 (가로로 이어 붙인 한 장): 셔터 · 깨진 유리 · 뻥 뚫린 안 · 녹슨 셔터 반쯤 */
  const shop = canvasTex(THREE, 1024, 128, (g, w, h) => { for (let k = 0; k < 4; k++) { const x0 = k * 256;
    g.fillStyle = '#2a2628'; g.fillRect(x0, 0, 256, h); g.fillStyle = '#3c3836'; g.fillRect(x0, 0, 14, h); g.fillRect(x0 + 242, 0, 14, h); g.fillStyle = '#1c1a1c'; g.fillRect(x0, 0, 256, 14);   /* 기둥 · 윗 띠 */
    if (k === 0 || k === 3) { const top = k === 3 ? 18 + r() * 40 : 16; g.fillStyle = k === 3 ? '#0e0c0e' : '#5a5e66'; g.fillRect(x0 + 14, 14, 228, h - 14); g.fillStyle = '#6a6e76'; g.fillRect(x0 + 14, 14, 228, top - 14 + (k === 3 ? 0 : h));
      for (let y = 14; y < (k === 3 ? top : h); y += 5) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x0 + 14, y, 228, 2); }
      for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(${120 + r() * 50 | 0},${60 + r() * 20 | 0},30,${0.25 + r() * 0.3})`; g.fillRect(x0 + 14 + r() * 220, 14 + r() * 40, 3 + r() * 6, 30 + r() * 70); }   /* 녹물 */
      g.fillStyle = 'rgba(200,60,50,.55)'; g.font = 'bold 18px sans-serif'; if (r() < 0.6) g.fillText(['X', '출입금지', '생존자 있음', '→'][r() * 4 | 0], x0 + 40 + r() * 100, 60 + r() * 50); }
    else { g.fillStyle = k === 1 ? '#141c24' : '#080608'; g.fillRect(x0 + 14, 14, 228, h - 14); g.fillStyle = '#3c3836'; g.fillRect(x0 + 126, 14, 6, h - 14);
      if (k === 1) { g.strokeStyle = 'rgba(190,210,230,.45)'; g.lineWidth = 1.5; for (let i = 0; i < 4; i++) { const cx = x0 + 30 + r() * 200, cy = 30 + r() * 80; for (let j = 0; j < 6; j++) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (r() - .5) * 90, cy + (r() - .5) * 90); g.stroke(); } } } } } });
  /* 간판 16개 (4 × 4) — 바랜 바탕, 때, 떨어져 나간 귀퉁이 */
  const sign = canvasTex(THREE, 1024, 256, (g, w, h) => { const bgs = ['#b8302c', '#2a4a8a', '#d8b030', '#2a7a4a', '#e8e4dc', '#6a2a6a', '#d86a2a', '#1a1a1e'];
    for (let i = 0; i < 16; i++) { const x0 = (i % 4) * 256, y0 = (i / 4 | 0) * 64, bg = bgs[(i * 5) % bgs.length]; g.fillStyle = bg; g.fillRect(x0, y0, 256, 64);
      g.fillStyle = bg === '#e8e4dc' || bg === '#d8b030' ? '#1a1a1e' : '#f4f0e8'; g.font = '900 40px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(SIGNS[i], x0 + 128, y0 + 34);
      g.fillStyle = 'rgba(30,20,16,.35)'; for (let k = 0; k < 40; k++) g.fillRect(x0 + r() * 256, y0 + r() * 64, 2 + r() * 10, 2 + r() * 4);
      const gr = g.createLinearGradient(0, y0, 0, y0 + 64); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,10,8,.45)'); g.fillStyle = gr; g.fillRect(x0, y0, 256, 64);
      if (r() < 0.4) { g.fillStyle = '#141012'; g.beginPath(); const cx = x0 + (r() < .5 ? 0 : 256); g.moveTo(cx, y0); g.lineTo(cx + (cx > x0 ? -1 : 1) * (20 + r() * 50), y0); g.lineTo(cx, y0 + 20 + r() * 40); g.fill(); } } });
  /* 옥상 광고판 6종 (2 × 3) — 일반 문구만, 바래고 찢김 */
  const ADS = [['신축 아파트 분양', '#1a3a6a', '#f2e8c8'], ['휴대폰 최저가', '#c8282c', '#ffffff'], ['치킨 1+1', '#f0b020', '#3a1a0a'], ['대출 상담', '#2a6a4a', '#f2f2ea'], ['수강생 모집', '#6a2a7a', '#ffe8a0'], ['렌터카 24시', '#e8e4dc', '#1a2a5a']];
  const board = canvasTex(THREE, 1024, 768, (g, w, h) => { ADS.forEach(([txt, bg, fg], i) => { const x0 = (i % 2) * 512, y0 = (i / 2 | 0) * 256; g.fillStyle = bg; g.fillRect(x0, y0, 512, 256);
    g.fillStyle = fg; g.font = '900 64px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x0 + 256, y0 + 118); g.font = '700 26px "Noto Sans KR", sans-serif'; g.fillText('문의 환영', x0 + 256, y0 + 196);
    for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(20,14,10,${0.15 + r() * 0.3})`; g.fillRect(x0 + r() * 512, y0 + r() * 256, 4 + r() * 30, 2 + r() * 8); }
    const gr = g.createLinearGradient(0, y0, 0, y0 + 256); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,16,10,.5)'); g.fillStyle = gr; g.fillRect(x0, y0, 512, 256);
    if (r() < 0.6) { g.fillStyle = '#100c0e'; const tx = x0 + 60 + r() * 360; g.beginPath(); g.moveTo(tx, y0 + 256); g.lineTo(tx + 40 + r() * 80, y0 + 120 + r() * 80); g.lineTo(tx + 120 + r() * 60, y0 + 256); g.fill(); } }); });   /* 찢겨 나간 자리 */
  shop.repeat.set(1, 1); sign.repeat.set(1, 1); board.repeat.set(1, 1); return (DECO_TEX = { shop, sign, board }); }
/* 바깥 법선: 변 가운데에서 0.3 m 나가 본 점이 윤곽 밖이면 바깥 (오목한 윤곽도 맞다) */
const outN = (pts, p, q) => { const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L, mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2; return inPoly([mx + nx * 0.3, mz + nz * 0.3], pts) ? [-nx, -nz] : [nx, nz]; };
/* 판 하나(바깥을 보는 사각형) — u0~u1 · v0~v1 은 텍스처 자리 */
function quad(THREE, ax, az, bx, bz, y0, y1, u0, u1, v0, v1, nx, nz) { const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v1], 2));
  /* 앞면이 바깥(n)을 보도록 감는 방향을 고른다 */
  const ex = bx - ax, ez = bz - az, front = -ez * nx + ex * nz;   /* 0→1→2 의 면 법선 = (b-a) × 위 = (-ez, 0, ex) */
  g.setIndex(front > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]); return g; }
let DECO_M = null;
/* 세로 간판 (문서 229 §9) — 서울 밤거리의 세로 네온. 한 장에 8 칸(칸마다 글자 세로로), 세기는 world3d 시간대가 VSIGN.mat.emissiveIntensity 로 */
export const VSIGN = { mat: null, mats: {}, off: {}, at: [] };   /* mats: 지역 묶음별 재질 · at: 검수용 [x, 가운데 y, z, 법선 x, 법선 z] */ const VSIGN_TEX = {};
/* 지역마다 거리 얼굴이 다르다 (디렉터: «멈춘 도시» — 사람·차는 안 움직이니 간판이 지역을 말한다). world3d 가 setVsignTheme(ZONE) */
const VSIGN_SETS = {
  seoul: [['호', '프'], ['노', '래', '방'], ['P', 'C', '방'], ['치', '과'], ['약', '국'], ['모', '텔'], ['당', '구', '장'], ['학', '원']],
  coast: [['횟', '집'], ['모', '텔'], ['민', '박'], ['조', '개', '구', '이'], ['노', '래', '방'], ['약', '국'], ['횟', '센', '터'], ['호', '프']],
  office: [['약', '국'], ['치', '과'], ['커', '피'], ['은', '행'], ['안', '과'], ['편', '의', '점'], ['호', '프'], ['P', 'C', '방']],
  old: [['한', '식'], ['여', '관'], ['다', '방'], ['약', '국'], ['막', '걸', '리'], ['서', '점'], ['노', '래', '방'], ['국', '밥']] };
const VSIGN_ZONE = { busan: 'coast', haeundae: 'coast', yeosu: 'coast', mokpo: 'coast', sokcho: 'coast', gyeongpo: 'coast', jeju: 'coast', seogwipo: 'coast', goheung: 'coast',
  yeouido: 'office', pangyo: 'office', jeonju: 'old', gyeongju: 'old', suwon: 'old', chuncheon: 'old' };
let VSIGN_THEME = 'seoul'; export function setVsignTheme(zone) { VSIGN_THEME = VSIGN_ZONE[zone] || 'seoul'; return VSIGN_THEME; }
export const vsignTheme = () => VSIGN_THEME, vsignWords = (theme = VSIGN_THEME) => VSIGN_SETS[theme].map(t => t.join(''));
const VSIGN_COL = ['#ff3a6a', '#3ae0ff', '#ffd23a', '#4cff9a', '#4cff9a', '#ff4fd8', '#ffd23a', '#39a0ff'];
function vsignTex(THREE, theme = VSIGN_THEME) { if (VSIGN_TEX[theme]) return VSIGN_TEX[theme]; const TXT = VSIGN_SETS[theme]; return VSIGN_TEX[theme] = canvasTex(THREE, 512, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { const x0 = i * 64, col = VSIGN_COL[i];
    g.fillStyle = '#121014'; g.fillRect(x0, 0, 64, h); g.strokeStyle = col; g.lineWidth = 4; g.strokeRect(x0 + 5, 5, 54, h - 10);
    const t = TXT[i], step = (h - 30) / t.length, fs = t.length > 3 ? 40 : 44; g.fillStyle = col; g.font = '900 ' + fs + 'px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';   /* 네 글자(조개구이)는 조금 작게 */
    t.forEach((c, k) => g.fillText(c, x0 + 32, 15 + step * (k + 0.5))); } }); }
export const isView3d = () => VIEW3D;
/* 길을 보는 벽: 바깥 법선이 front(가장 가까운 길 위 점) 쪽을 가장 곧게 보는 6 m 넘는 벽 — 없으면 가장 긴 벽 */
const frontEdge = (pts, f) => { const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length; let best = -1, bs = -2;
  for (let e = 0; e < pts.length; e++) { const p = pts[e], q = pts[(e + 1) % pts.length], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz); if (L < 6) continue;
    const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2; let nx = dz / L, nz = -dx / L; if (nx * (mx - cx) + nz * (mz - cz) < 0) { nx = -nx; nz = -nz; }
    const fx = f[0] - mx, fz = f[1] - mz, fl = Math.hypot(fx, fz) || 1, sc = (nx * fx + nz * fz) / fl; if (sc > bs) { bs = sc; best = e; } }
  return bs > 0.5 ? best : -1; };
const longestEdge = pts => { let best = 0, bl = -1; for (let e = 0; e < pts.length; e++) { const p = pts[e], q = pts[(e + 1) % pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L > bl) { bl = L; best = e; } } return best; };
/* 아파트 동 번호 (문서 229 §17) — 한국 도시의 얼굴: 판상형 아파트 벽 끝 위쪽의 큰 «101». OSM 이름에 번호가 있으면 그 번호(여의도 «11동»·«101동», 해운대 «101»·«A»),
   없으면 101~115 를 id 해시로. 단지 이름(상표)은 쓰지 않는다. 글자판 한 장(0~9 A~F) · 글자마다 사각형 하나 · 꾸밈 메시에 같이 합친다 */
export function aptLabel(b) { if (!b || b.kind !== 'apartments') return null; const nm = String(b.name || '').trim();
  const m = /(?:^|[^0-9])(\d{1,4})\s*동?$/.exec(nm) || /^(\d{1,4})/.exec(nm); if (m) return m[1];
  const a = /^([A-Fa-f])\s*동?$/.exec(nm); if (a) return a[1].toUpperCase();
  return String(101 + Math.floor(hashU(b.id | 0, 17, 5) * 15)); }
const APT_CH = '0123456789ABCDEF'; let APT_TEX = null;
function aptTex(THREE) { if (APT_TEX) return APT_TEX; APT_TEX = canvasTex(THREE, 1024, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.font = '900 104px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 16; i++) { const x = i * 64 + 32; g.lineWidth = 12; g.strokeStyle = 'rgba(24,28,40,0.9)'; g.strokeText(APT_CH[i], x, 68, 60); g.fillStyle = '#ece6d6'; g.fillText(APT_CH[i], x, 68, 60); } }); return APT_TEX; }   /* 밝은 글자 + 짙은 테두리 — 벽이 어두워 남색 글자는 묻혔다 */
/* 동 번호: 15 m 넘는 아파트, 6 m 넘는 벽 중 가장 짧은 둘(판상형의 벽 끝) — 위에서 1.2 m 아래, 글자 높이 = 벽 길이 × 0.32 (3.2~6 m — 0.2·2.4~4.2 는 멀리서 점이었다), 벽에서 8 cm 밖 */
export function aptGlyphs(THREE, pts, h, aptNo, out) { const lab = String(aptNo).slice(0, 4), cx0 = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz0 = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const edges = []; for (let e = 0; e < pts.length; e++) { const p = pts[e], q = pts[(e + 1) % pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L >= 6) edges.push({ p, q, L }); }
    edges.sort((a, b) => a.L - b.L);
    for (const { p, q, L } of edges.slice(0, 2)) { const gh = Math.min(6, Math.max(3.2, L * 0.32)), gw = gh * 0.62, n = lab.length; if (h < gh + 8 || n * gw * 0.9 > L - 1) continue;
      const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L; let nx = uz, nz = -ux; if (nx * (mx - cx0) + nz * (mz - cz0) < 0) { nx = -nx; nz = -nz; }
      const th = Math.atan2(nx, nz), rx = Math.cos(th), rz = -Math.sin(th), yc = h - 1.2 - gh / 2;   /* 바깥에서 볼 때 오른쪽 = 판의 +x */
      if (APT.at.length < 200) APT.at.push([+mx.toFixed(1), +yc.toFixed(1), +mz.toFixed(1), +nx.toFixed(3), +nz.toFixed(3), lab]);
      for (let k = 0; k < n; k++) { const ci = APT_CH.indexOf(lab[k]); if (ci < 0) continue; const g = new THREE.PlaneGeometry(gw, gh), uv = g.attributes.uv; for (let t = 0; t < uv.count; t++) uv.setX(t, (ci + uv.getX(t)) / 16);
        const off = (k - (n - 1) / 2) * gw * 0.9; g.rotateY(th); g.translate(mx + nx * 0.08 + rx * off, yc, mz + nz * 0.08 + rz * off); out.push(g); } }
    APT.n++; return out; }
/* 꾸밈 조각을 재질별로 합쳐 장면에 — 건물 하나에 재질당 메시 하나 (뒤에서 static-merge 가 칸별로 다시 묶는다) */
export function addDeco(THREE, scene, P, id) { if (!DECO_M) { const dt = decoTex(THREE); DECO_M = { parapet: new THREE.MeshStandardMaterial({ color: 0x55505a, roughness: 0.85, map: gritTex(THREE) }), tank: new THREE.MeshStandardMaterial({ color: 0x3a6a86, roughness: 0.6, metalness: 0.1 }), ac: new THREE.MeshStandardMaterial({ color: 0x7c7c84, roughness: 0.7, metalness: 0.2 }),
    shop: new THREE.MeshStandardMaterial({ map: dt.shop, roughness: 0.8, metalness: 0.15 }), sign: new THREE.MeshStandardMaterial({ map: dt.sign, emissiveMap: dt.sign, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.6, metalness: 0.1 }), board: new THREE.MeshStandardMaterial({ map: dt.board, emissiveMap: dt.board, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.7, metalness: 0.1 }) }; }
  if (!DECO_M.aptno) { const at = aptTex(THREE); DECO_M.aptno = new THREE.MeshStandardMaterial({ map: at, transparent: true, depthWrite: false, alphaTest: 0.02, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }); }   /* 알파 섞기 — alphaTest 0.45 는 멀리서 작은 밉맵으로 내려가면 획이 배경과 평균돼 통째로 버려졌다(한 글자도 안 보였다) */
  if (!DECO_M.shed) DECO_M.shed = new THREE.MeshStandardMaterial({ color: 0xb4ab98, roughness: 0.9, map: gritTex(THREE) });   /* 옥탑방 벽 — 바랜 베이지 페인트(옥상 바닥 콘크리트와 같으면 묻혔다) */
  if (!DECO_M.moss) DECO_M.moss = new THREE.MeshStandardMaterial({ color: 0x3e4a2c, roughness: 0.95, flatShading: true });   /* 옥상 이끼 덤불 */
  if (!DECO_M.ledge) DECO_M.ledge = DECO_M.parapet;   /* 처마·층 띠는 난간과 같은 콘크리트 */
  if (!DECO_M.wallac) DECO_M.wallac = DECO_M.ac;   /* 창 밑 실외기는 옥상 실외기와 같은 재질 */
  if (!VSIGN.mats[VSIGN_THEME]) { const vt = vsignTex(THREE); VSIGN.mats[VSIGN_THEME] = new THREE.MeshStandardMaterial({ map: vt, emissiveMap: vt, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.1 }); }
  DECO_M.vsign = VSIGN.mat = VSIGN.mats[VSIGN_THEME];
  if (!VSIGN.off[VSIGN_THEME]) { const vt = vsignTex(THREE); VSIGN.off[VSIGN_THEME] = new THREE.MeshStandardMaterial({ map: vt, color: 0x6a6a70, roughness: 0.6, metalness: 0.1 }); }   /* 꺼진 네온: 발광 없이 바랜 색 */
  DECO_M.vsignOff = VSIGN.off[VSIGN_THEME];
  for (const k in P) { if (!P[k].length) continue; const g = mergeGeometries(P[k], false); P[k].forEach(x => x.dispose()); if (!g) continue;
    const m = new THREE.Mesh(g, DECO_M[k]); m.castShadow = k !== 'shop' && k !== 'sign' && k !== 'aptno'; m.receiveShadow = true; m.userData.noCam = true; m.userData.deco = id; scene.add(m); } }
export const ROOF = { shed: 0, mast: 0, dish: 0, moss: 0, at: [] };   /* at: [x, 옥상 높이, z, 종류] 검수용 */   /* 옥상 다양화 검수용 (문서 229 §19) */
export const APT = { n: 0, at: [] };   /* 동 번호 단 아파트 수 · at: 검수용 [x, 글자 가운데 y, z, 법선 x, 법선 z, 번호] */
export const DECOS = [];   /* 검수용 — 꾸민 건물 [x, z, 높이, 간판 수, 옥상?] */
export function buildingDeco(THREE, pts, h, id, o = {}) { const P = { parapet: [], tank: [], ac: [], shop: [], sign: [], board: [], ledge: [], wallac: [], vsign: [], vsignOff: [], aptno: [], moss: [], shed: [] };
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const vEdge = o.vsign === false ? -1 : o.front ? frontEdge(pts, o.front) : longestEdge(pts);
  let ar = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; ar += p[0] * q[1] - q[0] * p[1]; } ar = Math.abs(ar / 2);
  for (let e = 0; e < pts.length; e++) { const p = pts[e], q = pts[(e + 1) % pts.length], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz); if (L < 1) continue;
    const [nx, nz] = outN(pts, p, q), yaw = -Math.atan2(dz, dx);
    /* 옥상 난간 — 윤곽 안쪽으로 두께만큼 */
    if (o.roof) { const T = 0.22, ph = 0.75 + 0.25 * hashU(id, e, 31), g = new THREE.BoxGeometry(L, ph, T); g.rotateY(yaw); g.translate((p[0] + q[0]) / 2 - nx * T / 2, h + ph / 2, (p[1] + q[1]) / 2 - nz * T / 2); P.parapet.push(g); }
    /* 처마 띠(코니스)·1층 위 띠 — 벽에서 튀어나온 띠가 그늘 선을 만든다. 뽑아 올린 상자가 «건물» 로 읽히는 윤곽 (문서 229 §4) */
    if (o.ledge !== false) { const band = (y, th, out) => { const g = new THREE.BoxGeometry(L + out * 2, th, out + 0.06); g.rotateY(yaw); g.translate((p[0] + q[0]) / 2 + nx * (out / 2 - 0.03), y, (p[1] + q[1]) / 2 + nz * (out / 2 - 0.03)); P.ledge.push(g); };
      if (o.roof && h > 6) band(h - 0.2, 0.4, 0.32);
      if (o.shops && h > 6.5) band(3.62, 0.24, 0.22);
      if (o.roof && h > 30) for (let fy = 1; fy * 14.4 < h - 6; fy++) if (hashU(id, fy, 33) < 0.55) band(fy * 14.4 + 0.1, 0.18, 0.12); }   /* 높은 건물: 4 층마다 얇은 띠(건물마다 다르게) */
    /* 창 밑 실외기 — 한국 건물. 가짜 실내 창(facade-shader)과 같은 칸: 벽 따라 s = 위치·(nz, −nx) 의 1.8 m 칸, 층 3.6 m. 칸 가운데 창 아래 (문서 229 §6) */
    if (o.roof && o.wallAc !== false && h > 7 && h <= 45 && L >= 3) { const ux = dx / L, uz = dz / L, tx = nz, tz = -nx, s0 = p[0] * tx + p[1] * tz, ds = ux * tx + uz * tz;
      if (Math.abs(ds) > 0.5) for (let k = Math.ceil(Math.min(s0, s0 + ds * L) / 1.8 - 0.5); (k + 0.5) * 1.8 <= Math.max(s0, s0 + ds * L); k++) { const t = ((k + 0.5) * 1.8 - s0) / ds; if (t < 0.7 || t > L - 0.7) continue;
        for (let f = 1; (f + 1) * 3.6 <= h - 0.5 && f < 12; f++) { if (hashU(id * 31 + e, k, f + 101) > 0.11) continue;
          const g = new THREE.BoxGeometry(0.82, 0.55, 0.32); g.rotateY(yaw); g.translate(p[0] + ux * t + nx * 0.19, f * 3.6 + 0.33, p[1] + uz * t + nz * 0.19); P.wallac.push(g); } } }
    /* 세로 간판: 9~40 m 건물 60 % · 길을 보는 벽(없으면 가장 긴 벽)의 한쪽 끝, 벽에 직각으로 0.85 m 내밀어 1층 위부터 (건물 하나에 하나) */
    if (o.vsign !== false && h > 9 && h < 40 && e === vEdge && hashU(id, 12, 7) < 0.6 && L > 6) {
      const ux = dx / L, uz = dz / L, end = hashU(id, 13, 7) < 0.5 ? 1.2 : L - 1.2, H = Math.min(7.5, h - 5.2), cell = (hashU(id, 14, 7) * 8) | 0;
      const g = new THREE.BoxGeometry(0.16, H, 0.85), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) i < 8 ? uv.setXY(i, (cell + uv.getX(i)) / 8, uv.getY(i)) : uv.setXY(i, (cell + 0.11) / 8, 0.5);   /* 넓은 두 면(±x)만 글자 — 길 정면·위아래 좁은 면은 테두리 네온 색 한 줄 (글자가 찌그러져 찍혔다) */
      g.rotateY(yaw); g.translate(p[0] + ux * end + nx * 0.47, 4.3 + H / 2, p[1] + uz * end + nz * 0.47); (hashU(id, 15, 7) < 0.3 ? P.vsign : P.vsignOff).push(g);   /* 켜진 네온 30 % · 나머지는 꺼진 관 (문서 229 §18) */ VSIGN.at.push([p[0] + ux * end, 4.3 + H / 2, p[1] + uz * end, nx, nz]); }
    /* 1층 상가 — 4 m 한 칸, 벽에서 6 cm 밖. 간판은 그 위 */
    if (o.shops && L >= 3) { const n = Math.max(1, Math.round(L / 4)), seg = L / n, ux = dx / L, uz = dz / L, sh = Math.min(3.3, h - 0.3);
      for (let k = 0; k < n; k++) { const a0 = k * seg, a1 = (k + 1) * seg, kind = (hashU(id, e, k + 41) * 4) | 0, ox = nx * 0.06, oz = nz * 0.06;
        P.shop.push(quad(THREE, p[0] + ux * a0 + ox, p[1] + uz * a0 + oz, p[0] + ux * a1 + ox, p[1] + uz * a1 + oz, 0, sh, kind / 4, (kind + 1) / 4, 0, 1, nx, nz));
        if (o.signs === false || h < 4.6 || hashU(id, e, k + 51) > 0.62) continue;
        const cell = (hashU(id, e, k + 61) * 16) | 0, sw = seg * (0.7 + 0.25 * hashU(id, e, k + 71)), sy = 3.55, shh = 0.8, mid = (a0 + a1) / 2, sx = p[0] + ux * mid + nx * 0.18, sz = p[1] + uz * mid + nz * 0.18;
        const g = new THREE.BoxGeometry(sw, shh, 0.22), uv = g.attributes.uv, u0 = (cell % 4) / 4, v1 = 1 - (cell / 4 | 0) / 4, v0 = v1 - 0.25;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.25, v0 + uv.getY(i) * 0.25);
        if (hashU(id, e, k + 81) < 0.18) { g.translate(sw / 2, 0, 0); g.rotateZ((hashU(id, e, k + 91) < 0.5 ? -1 : 1) * (0.12 + 0.12 * hashU(id, e, k + 92))); g.translate(-sw / 2, 0, 0); }   /* 한쪽이 떨어져 기운 간판 */
        g.rotateY(yaw); if (Math.sin(yaw) * nx + Math.cos(yaw) * nz < 0) g.rotateY(Math.PI);   /* 앞면(+z)이 바깥을 보게 */
        g.translate(sx, sy + shh / 2, sz); P.sign.push(g); } } }
  if (o.roof) {
    const spot = (salt, m) => { for (let t = 0; t < 8; t++) { const x = cx + (hashU(id, salt, t) - 0.5) * Math.sqrt(ar) * 0.7, z = cz + (hashU(id, salt, t + 50) - 0.5) * Math.sqrt(ar) * 0.7; if (inPoly([x, z], pts) && pts.every((p, i) => segDist([x, z], p, pts[(i + 1) % pts.length]) > m)) return [x, z]; } return null; };
    if (ar > 60 && hashU(id, 1, 7) < 0.6) { const r = 0.85 + 0.45 * hashU(id, 2, 7), th = 1.5 + 0.7 * hashU(id, 3, 7), s0 = spot(11, r + 0.4); if (s0) { const g = new THREE.CylinderGeometry(r, r, th, 10); g.translate(s0[0], h + th / 2 + 0.25, s0[1]); P.tank.push(g);
      const st = new THREE.BoxGeometry(r * 1.6, 0.25, r * 1.6); st.translate(s0[0], h + 0.125, s0[1]); P.ac.push(st); } }   /* 물탱크 + 받침 */
    const nAc = ar > 40 ? 1 + ((hashU(id, 4, 7) * 4) | 0) : 0;
    for (let i = 0; i < nAc; i++) { const s1 = spot(21 + i, 0.8); if (!s1) continue; const g = new THREE.BoxGeometry(0.9, 0.7, 0.55); g.rotateY(hashU(id, 5, i) * 3.14); g.translate(s1[0], h + 0.35, s1[1]); P.ac.push(g); }
    if (h > 18 && hashU(id, 6, 7) < 0.3) { const s2 = spot(31, 0.6); if (s2) { const g = new THREE.BoxGeometry(0.12, 4 + 3 * hashU(id, 7, 7), 0.12); g.translate(s2[0], h + 2, s2[1]); P.ac.push(g); } }
    /* 옥상 다양화 (문서 229 §19) — 옥탑방 · 격자 안테나 · 위성 접시 · 이끼 덤불 */
    if (h > 9 && h < 30 && ar > 80 && hashU(id, 40, 7) < 0.35) { const s3 = spot(41, 2.4); if (s3) { const w = 3.2 + 1.4 * hashU(id, 42, 7), d = 2.6 + 1.0 * hashU(id, 43, 7), rh = 2.4, ry = hashU(id, 44, 7) * 3.14;   /* 옥탑방 — 한국 옥상 */
      const body = new THREE.BoxGeometry(w, rh, d); body.rotateY(ry); body.translate(s3[0], h + rh / 2, s3[1]); P.shed.push(body);
      const roof = new THREE.BoxGeometry(w + 0.5, 0.14, d + 0.5); roof.rotateY(ry); roof.translate(s3[0], h + rh + 0.07, s3[1]); P.tank.push(roof);   /* 파란 지붕 판 */
      const door = new THREE.BoxGeometry(0.85, 1.9, 0.06); door.translate(w * 0.22, 0.95 - rh / 2, d / 2 + 0.03); door.rotateY(ry); door.translate(s3[0], h + rh / 2, s3[1]); P.ac.push(door); ROOF.shed++; if (ROOF.at.length < 300) ROOF.at.push([+s3[0].toFixed(1), +h.toFixed(1), +s3[1].toFixed(1), 'shed']); } }
    if (h > 40 && hashU(id, 45, 7) < 0.4) { const s4 = spot(46, 1.2); if (s4) { const mh = 6 + 5 * hashU(id, 47, 7);   /* 격자 안테나 — 기둥 + 가로대 셋 */
      const m = new THREE.BoxGeometry(0.18, mh, 0.18); m.translate(s4[0], h + mh / 2, s4[1]); P.ac.push(m);
      for (let k = 1; k <= 3; k++) { const bw = 1.6 - k * 0.35, b = new THREE.BoxGeometry(bw, 0.07, 0.07); b.rotateY(hashU(id, 48, k) * 3.14); b.translate(s4[0], h + mh * (0.45 + k * 0.16), s4[1]); P.ac.push(b); } ROOF.mast++; if (ROOF.at.length < 300) ROOF.at.push([+s4[0].toFixed(1), +h.toFixed(1), +s4[1].toFixed(1), 'mast']); } }
    if (h > 10 && h < 45 && hashU(id, 49, 7) < 0.25) { const s5 = spot(50, 0.8); if (s5) { const dsh = new THREE.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.32); dsh.rotateX(-Math.PI / 2 + 0.6); dsh.rotateY(hashU(id, 51, 7) * 6.28); dsh.translate(s5[0], h + 0.9, s5[1]); P.ac.push(dsh);   /* 위성 접시 */
      const leg = new THREE.BoxGeometry(0.06, 0.8, 0.06); leg.translate(s5[0], h + 0.4, s5[1]); P.ac.push(leg); ROOF.dish++; } }
    if (ar > 50 && hashU(id, 52, 7) < 0.4) { const n = 2 + ((hashU(id, 53, 7) * 4) | 0); for (let k = 0; k < n; k++) { const s6 = spot(60 + k, 0.5); if (!s6) continue; const r = 0.45 + 0.5 * hashU(id, 54, k), g = new THREE.IcosahedronGeometry(r, 0); g.scale(1.3, 0.55, 1.1); g.translate(s6[0], h + r * 0.3, s6[1]); P.moss.push(g); } ROOF.moss++; }   /* 이끼·풀 덤불 — 자연이 옥상을 되찾는다 */
    /* 옥상 광고판: 15 m 넘는 건물 22% — 가장 긴 바깥 벽 쪽으로, 다리 둘 */
    if (h > 15 && hashU(id, 8, 7) < 0.22) { let best = -1, bl = 0; for (let e = 0; e < pts.length; e++) { const p = pts[e], q = pts[(e + 1) % pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L > bl) { bl = L; best = e; } }
      if (bl > 8) { const p = pts[best], q = pts[(best + 1) % pts.length], dx = q[0] - p[0], dz = q[1] - p[1], [nx, nz] = outN(pts, p, q), yaw = -Math.atan2(dz, dx), W = Math.min(9, bl * 0.7), H = W * 0.45, mx = (p[0] + q[0]) / 2 - nx * 1.2, mz = (p[1] + q[1]) / 2 - nz * 1.2;
        const cell = (hashU(id, 9, 7) * 6) | 0, g = new THREE.BoxGeometry(W, H, 0.25), uv = g.attributes.uv, u0 = (cell % 2) / 2, v1 = 1 - (cell / 2 | 0) / 3;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v1 - 1 / 3 + uv.getY(i) / 3);
        g.rotateY(yaw); if (Math.sin(yaw) * nx + Math.cos(yaw) * nz < 0) g.rotateY(Math.PI); g.translate(mx, h + 1.6 + H / 2, mz); P.board.push(g);
        for (const k of [-0.35, 0.35]) { const leg = new THREE.BoxGeometry(0.18, 1.7, 0.18); leg.translate(mx + dx / bl * W * k, h + 0.85, mz + dz / bl * W * k); P.ac.push(leg); } } } }
  DECOS.push([+cx.toFixed(1), +cz.toFixed(1), +h.toFixed(1), P.sign.length, !!o.roof, P.board.length]);
  if (o.aptNo && h >= 15) aptGlyphs(THREE, pts, h, o.aptNo, P.aptno);   /* 아파트 동 번호 (문서 229 §17) */
  return P; }

/* ---------- 거리 풍경 (3D 필드만, 문서 219) — 전봇대와 늘어진 전선 · 교차로 신호등 · 쓰레기 더미 · 버스 정류장 ----------
   한국 골목의 얼굴은 전봇대와 엉킨 전선이다. 전부 길·건물 자리에서 해시로 정한다(장면 난수 R 안 씀) · 막이 없음(서버 지도와 같게) · 카메라 막이 없음.
   메시는 하나하나 세우고(정적 합치기가 48 m 칸으로 묶는다), 전선(선)만 160 m 칸별로 직접 묶는다. */
export const STREET = { poles: 0, wires: 0, signals: 0, bags: 0, stops: 0, weeds: 0, puddles: 0, lamps: 0, at: {} };
export const STREETLAMP = { mat: null };   /* 가로등 머리 발광 — world3d 시간대가 세기를 (문서 229 §11) */   /* at: 검수용 자리 몇 개씩 */
const seeAt = (k, p) => { const l = STREET.at[k] || (STREET.at[k] = []); if (l.length < 4) l.push([+p[0].toFixed(1), +p[1].toFixed(1)]); };
export function street(ctx, roadsW, built, o = {}) { const { THREE, scene, ST, walk } = ctx, inBand = (p, pad) => { const [s, t] = ST(p); return s > walk.s0 - pad && s < walk.s1 + pad && t > walk.t0 - pad && t < walk.t1 + pad; };
  const carRoads = roadsW.filter(rw => !/footway|path|pedestrian|steps|cycleway|track/.test(rw.r.kind));
  const onRoad = p => carRoads.some(rw => { for (let i = 1; i < rw.pts.length; i++) if (segDist(p, rw.pts[i - 1], rw.pts[i]) < rw.width / 2 + 0.4) return true; return false; });   /* 일방통행 대로는 OSM 에서 두 줄 — 한 길의 길가가 옆 길의 차로다 */
  const solid = p => built.some(b => inPoly(p, b.pts)) || (o.waters || []).some(w => inPoly(p, w)) || onRoad(p);
  const conc = new THREE.MeshStandardMaterial({ color: 0x8a8682, roughness: 0.85, map: gritTex(THREE) }), steel = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.5, metalness: 0.6 }), dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.6 });
  const amber = new THREE.MeshStandardMaterial({ color: 0x3a2a10, emissive: 0xffa020, emissiveIntensity: 1.4 }); amber.userData.blink = 1.4; const bagM = [0x1c1c22, 0x2a3a5a, 0x3a3a34].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.05 }));
  const glass = new THREE.MeshStandardMaterial({ color: 0x8aa0b0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.35 }), stopSignM = new THREE.MeshStandardMaterial({ color: 0x2a5aa8, emissive: 0x2a5aa8, emissiveIntensity: 0.3 }), wireM = new THREE.LineBasicMaterial({ color: 0x0c0c10 });
  /* 소품은 재질 × 그림자 × 160 m 칸으로 직접 합친다 — 하나하나 세우면 정적 합치기(48 m 칸)에서 칸마다 재질 여럿이 남아 강남 호출 +44 였다 */
  const buckets = new Map(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), YAX = new THREE.Vector3(0, 1, 0);
  /* 불투명·발광 없는 재질은 꼭짓점 색 재질 하나로 — 칸마다 재질이 6 가지씩 남아 강남 소품 호출이 32 였다. 점멸등·표지(발광)·유리(투명)만 따로 */
  const vcM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.3 }), plain = m => !m.transparent && !(m.emissive && m.emissive.getHex() && m.emissiveIntensity > 0) && !m.map;
  const putG = (g0, mat, x, z, shadow) => { let g = g0.index ? g0.toNonIndexed() : g0, m = mat;
    if (plain(mat) || mat === conc) { const n = g.attributes.position.count, c = new Float32Array(n * 3), col = mat === conc ? new THREE.Color(0x8a8682) : mat.color; for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); m = vcM; }
    else if (g.attributes.color) g.deleteAttribute('color');
    const key = m.uuid + '|' + (shadow ? 1 : 0) + '|' + Math.floor(x / 160) + ',' + Math.floor(z / 160); let b = buckets.get(key); if (!b) buckets.set(key, b = { mat: m, shadow, list: [] }); b.list.push(g); };
  const add = (geo, mat, x, y, z, ry = 0, shadow = true) => { const g = geo.clone(); g.applyMatrix4(M4.compose(V.set(x, y, z), Q.setFromAxisAngle(YAX, ry), ONE)); putG(g, mat, x, z, shadow); return { userData: {} }; };   /* shadow: 작은 것(봉투·신호등 머리)은 그림자 패스를 아낀다 */
  const wires = new Map(), wire = (a, b) => { const key = Math.floor(a[0] / 160) + ',' + Math.floor(a[2] / 160); let l = wires.get(key); if (!l) wires.set(key, l = []);
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), sag = 0.35 + L * 0.018; for (let i = 0; i < 8; i++) { const u0 = i / 8, u1 = (i + 1) / 8, y = u => a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u);
      l.push(a[0] + (b[0] - a[0]) * u0, y(u0), a[2] + (b[2] - a[2]) * u0, a[0] + (b[0] - a[0]) * u1, y(u1), a[2] + (b[2] - a[2]) * u1); } STREET.wires++; };
  const poleG = new THREE.CylinderGeometry(0.13, 0.18, 10, 7); poleG.translate(0, 5, 0); const armG = new THREE.BoxGeometry(1.6, 0.12, 0.12), trafoG = new THREE.CylinderGeometry(0.32, 0.32, 0.9, 8);
  const VEH = /primary|secondary|tertiary|residential|unclassified|living_street|service/, MAJOR = /primary|secondary|tertiary/;
  const lampPoleG = new THREE.CylinderGeometry(0.09, 0.14, 8.5, 7); lampPoleG.translate(0, 4.25, 0); const lampArmG = new THREE.BoxGeometry(2.5, 0.1, 0.1), lampHeadG = new THREE.BoxGeometry(0.75, 0.16, 0.32);
  const lampOn = STREETLAMP.mat || (STREETLAMP.mat = new THREE.MeshStandardMaterial({ color: 0x3a3020, emissive: 0xffd8a0, emissiveIntensity: 1.6, roughness: 0.5 }));
  for (const rw of roadsW) { const k = rw.r.kind; if (!VEH.test(k)) continue; const id = rw.r.id | 0, side = hashU(id, 1, 1) < 0.5 ? -1 : 1, off = rw.width / 2 + 1.1;
    /* 전봇대: 골목·이면도로(대로는 지중화) — 28~34 m 간격, 한쪽 길가 */
    if (!MAJOR.test(k) || k === 'tertiary') { let prev = null, acc = 8 + hashU(id, 2, 2) * 12;
      for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.5) continue; const ux = dx / L, uz = dz / L;
        for (; acc < L; acc += 28 + hashU(id, i, acc | 0) * 6) { const p = [a[0] + ux * acc - uz * off * side, a[1] + uz * acc + ux * off * side]; if (!inBand(p, 40) || solid(p)) { prev = null; continue; }
          const ry = -Math.atan2(dz, dx); add(poleG, conc, p[0], 0, p[1]); add(armG, steel, p[0], 9.3, p[1], ry + Math.PI / 2); if (hashU(id, i, 7 + (acc | 0)) < 0.25) add(trafoG, steel, p[0] + uz * side * 0.35, 7.6, p[1] - ux * side * 0.35);
          STREET.poles++; seeAt('pole', p); if (prev) for (const [h, lat] of [[9.3, -0.7], [9.3, 0.7], [8.4, 0]]) wire([prev[0] - uz * lat, h, prev[1] + ux * lat], [p[0] - uz * lat, h, p[1] + ux * lat]); prev = p; }
        acc -= L; } }
    /* 가로등 (문서 229 §11): 큰길 양쪽 34~40 m 마다 엇갈려, 길가 0.8 m · 8.5 m 기둥에 2.4 m 팔을 차도 쪽으로. 셋 중 둘만 켜짐(폐허). 켜진 등은 점광원 — world3d 가 가까운 몇 개만 비추고 빛 기둥은 다 그린다 */
    if (MAJOR.test(k)) for (const sd of [-1, 1]) { let acc = (sd > 0 ? 6 : 24) + hashU(id, 21, sd + 2) * 10;
      for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.5) continue; const ux = dx / L, uz = dz / L, o4 = rw.width / 2 + 0.8;
        for (; acc < L; acc += 34 + hashU(id, i, 23 + (acc | 0)) * 6) { const p = [a[0] + ux * acc - uz * o4 * sd, a[1] + uz * acc + ux * o4 * sd]; if (!inBand(p, 30) || solid(p)) continue;
          const ry = -Math.atan2(dz, dx), inx = uz * sd, inz = -ux * sd, hx = p[0] + inx * 2.3, hz = p[1] + inz * 2.3, lit = hashU(id, i, 29 + (acc | 0)) < 0.3;   /* in = 차도 쪽 · 켜진 등 30 % (폐허 — 셋 중 둘은 너무 밝았다, 문서 229 §18) */
          add(lampPoleG, steel, p[0], 0, p[1]); add(lampArmG, steel, p[0] + inx * 1.2, 8.35, p[1] + inz * 1.2, ry + Math.PI / 2); add(lampHeadG, lit ? lampOn : dark, hx, 8.25, hz, ry + Math.PI / 2, false);
          if (lit) { const Lp = new THREE.PointLight(0xffd29a, 10, 18, 1.5); Lp.position.set(hx, 8.0, hz); scene.add(Lp); }
          STREET.lamps++; seeAt('lamp', p); } acc -= L; } }
    /* 버스 정류장: 큰길 160~220 m 마다, 길 쪽을 본다 */
    if (MAJOR.test(k)) { let acc = 40 + hashU(id, 3, 3) * 80;
      for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.5) continue; const ux = dx / L, uz = dz / L;
        for (; acc < L; acc += 160 + hashU(id, i, 9) * 60) { const o2 = rw.width / 2 + 2.4, p = [a[0] + ux * acc - uz * o2 * side, a[1] + uz * acc + ux * o2 * side]; if (!inBand(p, 6) || solid(p)) continue;
          const ry = -Math.atan2(dz, dx) + (side > 0 ? Math.PI : 0), bk = [p[0] - uz * side * 0.6, p[1] + ux * side * 0.6], g = new THREE.Group(); g.position.set(p[0], 0, p[1]); g.rotation.y = ry;
          const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 1.7), steel); roof.position.set(0, 2.6, 0); const back = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.9, 0.05), glass); back.position.set(0, 1.45, -0.75);
          const bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.45), steel); bench.position.set(0, 0.48, -0.45); const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), steel); p1.position.set(-2, 1.3, -0.75); const p2 = p1.clone(); p2.position.x = 2;
          const sg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.06), stopSignM); sg.position.set(2.3, 2.3, 0.4);
          g.add(roof, back, bench, p1, p2, sg); g.updateMatrixWorld(true); for (const m of [roof, back, bench, p1, p2, sg]) { const gg = m.geometry.clone(); gg.applyMatrix4(m.matrixWorld); putG(gg, m.material, p[0], p[1], m === roof); } STREET.stops++; seeAt('stop', p); void bk; } acc -= L; } }
    /* 쓰레기 더미: 길가 건물 쪽, 18~40 m 마다 35% */
    { let acc = 6 + hashU(id, 4, 4) * 20;
      for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.5) continue; const ux = dx / L, uz = dz / L;
        for (; acc < L; acc += 18 + hashU(id, i, 11 + (acc | 0)) * 22) { if (hashU(id, i, 13 + (acc | 0)) > 0.35) continue; const sd = hashU(id, i, 17 + (acc | 0)) < 0.5 ? -1 : 1, o3 = rw.width / 2 + 1.7, p = [a[0] + ux * acc - uz * o3 * sd, a[1] + uz * acc + ux * o3 * sd];
          if (!inBand(p, 10) || solid(p)) continue; seeAt('bags', p); const n = 3 + ((hashU(id, i, 19 + (acc | 0)) * 4) | 0), seed = id + i * 131 + (acc | 0);
          for (let j = 0; j < n; j++) { const r = 0.32 + hashU(seed, j, 1) * 0.22, g = new THREE.IcosahedronGeometry(r, 1); lumpy(g, r * 0.25, seed + j, true); g.scale(1, 0.8, 1);
            add(g, bagM[(hashU(seed, j, 2) * 3) | 0], p[0] + (hashU(seed, j, 3) - 0.5) * 1.4, r * 0.75 + (j > 3 ? 0.4 : 0), p[1] + (hashU(seed, j, 4) - 0.5) * 1.4, hashU(seed, j, 5) * 6, false); STREET.bags++; } } acc -= L; } } }
  /* 신호등: 큰길이 만나는 교차로(길 꼭짓점을 함께 쓰는 곳) — 꺼졌거나 노란 점멸 */
  const nodes = new Map(); for (const rw of roadsW) { if (!VEH.test(rw.r.kind) || /service/.test(rw.r.kind)) continue; for (const p of [rw.pts[0], rw.pts[rw.pts.length - 1], ...rw.pts]) { const key = p[0].toFixed(1) + ',' + p[1].toFixed(1); let n = nodes.get(key); if (!n) nodes.set(key, n = { p, roads: new Set(), major: false, w: 0 }); n.roads.add(rw); n.major ||= MAJOR.test(rw.r.kind); n.w = Math.max(n.w, rw.width); } }
  const sigPole = new THREE.CylinderGeometry(0.1, 0.12, 6, 7); sigPole.translate(0, 3, 0); const sigArm = new THREE.BoxGeometry(4.5, 0.12, 0.12); sigArm.translate(2.25, 0, 0); const head = new THREE.BoxGeometry(1.1, 0.38, 0.32), lamp = new THREE.SphereGeometry(0.11, 8, 6);
  for (const n of nodes.values()) { if (n.roads.size < 2 || !n.major || !inBand(n.p, 8)) continue; const id = Math.round(n.p[0] * 13 + n.p[1] * 7);
    for (const q of [0, 2]) { const ang = q * Math.PI / 2 + Math.PI / 4 + hashU(id, q, 1) * 0.2, d = (n.w / 2 + 1.4) * 1.55, p = [n.p[0] + Math.cos(ang) * d, n.p[1] + Math.sin(ang) * d];   /* 대각선 모퉁이 — 두 길 모두에서 길가로 */ if (solid(p)) continue;
      const ry = -ang + Math.PI; add(sigPole, steel, p[0], 0, p[1]); add(sigArm, steel, p[0], 5.7, p[1], ry); const hx = p[0] + Math.cos(ang + Math.PI) * 3.8, hz = p[1] + Math.sin(ang + Math.PI) * 3.8;
      add(head, dark, hx, 5.45, hz, ry, false); if (hashU(id, q, 2) < 0.6) add(lamp, amber, hx + Math.cos(ry) * 0.3, 5.45, hz - Math.sin(ry) * 0.3, 0, false).userData.blink = 1; STREET.signals++; seeAt('signal', p); } }
  /* 잡초: 건물 밑동·길가 — 자연이 도시를 되찾는다. 엇갈린 판 셋(알파 잘라내기) 인스턴스 하나 = 그리기 1번, 그림자 없음 */
  { const tufts = [], tuft = (x, z, k) => { if (inBand([x, z], 4) && !onRoad([x, z])) tufts.push([x, z, k]); };
    for (const b of built) { if (!inBand(b.pts[0], 30)) continue; for (let e = 0; e < b.pts.length; e++) { const p = b.pts[e], q = b.pts[(e + 1) % b.pts.length], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz); if (L < 1) continue;
      const nx = -dz / L, nz = dx / L, sg = inPoly([(p[0] + q[0]) / 2 + nx * 0.4, (p[1] + q[1]) / 2 + nz * 0.4], b.pts) ? -1 : 1;
      for (let d = 0.5; d < L; d += 1.0) { const h = hashU(Math.round(p[0] * 7 + p[1] * 11), e, d * 10 | 0); if (h < 0.62) tuft(p[0] + dx / L * d + nx * sg * (0.35 + h * 0.5), p[1] + dz / L * d + nz * sg * (0.35 + h * 0.5), h); } } }
    for (const rw of carRoads) { const id = rw.r.id | 0; for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 1) continue;
      for (let d = 1; d < L; d += 2.6) for (const sd of [-1, 1]) { const h = hashU(id, i * 2 + (sd > 0 ? 1 : 0), d * 10 | 0); if (h < 0.3) tuft(a[0] + dx / L * d - dz / L * sd * (rw.width / 2 + 0.3 + h), a[1] + dz / L * d + dx / L * sd * (rw.width / 2 + 0.3 + h), h); } } }
    if (tufts.length) { scene.add(tuftMesh(THREE, tufts)); STREET.weeds = tufts.length; } }
  /* 웅덩이 (문서 220 §8): 차도 가장자리(배수로 쪽)에 하늘을 비추는 얕은 물 + 젖은 테두리 — 비 온 뒤 폐허 거리. 자리는 해시, 막이 없음 */
  /* 셰이더 웅덩이(문서 229 §10)가 켜져 있으면 이 판들은 만들지 않는다 — 같은 길에 웅덩이가 두 겹이었고, 판은 하늘을 그대로 더해 낮에 하얀 얼음판처럼 보였다(해운대·여의도). ?wet=0 이면 예전대로 */
  if (o.puddles !== false && !PUDDLE.on) { const pm = waterMat(THREE, { calm: true }), wetM = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -27 });   /* 젖은 자국: 웅덩이 가장자리 0.4 → 바깥 0 (꼭짓점 알파) — 딱딱한 다각형이면 회색 판으로 보였다 */
    const blob = (cx, cz, ang, rx, rz, seed, k) => { const sh = new THREE.Shape(); for (let j = 0; j < 12; j++) { const a = j / 12 * Math.PI * 2, w = 0.72 + hashU(seed, j, 5) * 0.5, x = Math.cos(a) * rx * w * k, z = Math.sin(a) * rz * w * k, X = cx + x * Math.cos(ang) - z * Math.sin(ang), Z = cz + x * Math.sin(ang) + z * Math.cos(ang); j ? sh.lineTo(X, -Z) : sh.moveTo(X, -Z); }
      const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g; };
    const wetFan = (cx, cz, ang, rx, rz, seed) => { const pos = [cx, 0, cz], col = [0, 0, 0, 0.4], idx = [];
      for (let ring = 0; ring < 2; ring++) for (let j = 0; j < 12; j++) { const a = j / 12 * Math.PI * 2, w = (0.72 + hashU(seed, j, 5) * 0.5) * (ring ? 1.3 : 1), x = Math.cos(a) * rx * w, z = Math.sin(a) * rz * w; pos.push(cx + x * Math.cos(ang) - z * Math.sin(ang), 0, cz + x * Math.sin(ang) + z * Math.cos(ang)); col.push(0, 0, 0, ring ? 0 : 0.4); }
      for (let j = 0; j < 12; j++) { const a = 1 + j, b2 = 1 + (j + 1) % 12; idx.push(0, b2, a, a, b2, a + 12, b2, b2 + 12, a + 12); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); return g; };
    let np = 0; for (const rw of carRoads) { const id = rw.r.id | 0; for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 3) continue;
      for (let d = 2; d < L - 2; d += 11) { const h = hashU(id, i + 911, d * 10 | 0); if (h > 0.16) continue; const r = 0.6 + hashU(i, id, d | 0) * 1.0, sd = h < 0.08 ? -1 : 1, edge = rw.width / 2 - 0.25 - 1.2 * r;   /* 젖은 테두리 바깥(가로 1.2r · 세로 2.7r)까지 차도 안에 */
        if (edge < 0 || d < 2.7 * r + 0.3 || d > L - 2.7 * r - 0.3) continue; const off = edge * (1 - 0.5 * hashU(id, i, d | 0));
        const x = a[0] + dx / L * d - dz / L * sd * off, z = a[1] + dz / L * d + dx / L * sd * off; if (!inBand([x, z], 2)) continue;
        const ang = Math.atan2(dz, dx), seed = (id * 31 + i * 7 + (d | 0)) | 0;
        const wm = new THREE.Mesh(wetFan(x, z, ang, r * 1.7, r * 0.75, seed), wetM); wm.position.y = 0.078; wm.userData.noCam = true; wm.userData.puddle = true; scene.add(wm);
        const pw = new THREE.Mesh(blob(x, z, ang, r * 1.7, r * 0.75, seed, 1), pm); pw.position.y = 0.08; pw.userData.noCam = true; pw.userData.puddle = true; pw.receiveShadow = true; scene.add(pw); np++; } } }
    STREET.puddles = np; }
  for (const b of buckets.values()) { const g = mergeGeometries(b.list, false); b.list.forEach(x => x.dispose()); if (!g) continue; const m = new THREE.Mesh(g, b.mat); m.castShadow = b.shadow; m.receiveShadow = true; m.userData.noCam = true; m.userData.street = 1; scene.add(m); }
  for (const l of wires.values()) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(l, 3)); const m = new THREE.LineSegments(g, wireM); m.frustumCulled = true; m.userData.noCam = true; scene.add(m); }
  return STREET; }

/* ---------- 나무: 인스턴스로. 걷는 띠 안은 드문드문(갓이 인물을 가리면 안 된다) ---------- */
export function trees(ctx, pts, o = {}) { const { THREE, scene, R } = ctx, n = pts.length; if (!n) return 0;
  const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 4.2, 6), canopyG = VIEW3D ? crownGeo(THREE) : new THREE.IcosahedronGeometry(1.9, 0), pineG = VIEW3D ? pineGeo(THREE) : new THREE.ConeGeometry(1.6, 4.6, 7);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1 }), leafMs = (o.leaves || [0x3a3e2a, 0x2c3426, 0x4a3e2c, 0x5a3424]).map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, n), canopy = leafMs.map(m => new THREE.InstancedMesh(canopyG, m, n)), pines = new THREE.InstancedMesh(pineG, leafMs[1], n);
  const mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), V = (x, y, z) => new THREE.Vector3(x, y, z), cnt = leafMs.map(() => 0); let np = 0, nd = 0;
  pts.forEach((p, i) => { const k = 0.8 + R() * 0.6; mtx.compose(V(p[0], 2.1 * k, p[1]), q4.setFromEuler(e.set((R() - .5) * 0.15, R() * 6, (R() - .5) * 0.15)), V(k, k, k)); trunks.setMatrixAt(i, mtx);
    if (o.dead && R() < o.dead) { nd++; }   /* 죽은 나무 — 갓 없이 줄기만 */
    else if (R() < (o.pine ?? 0.3)) { mtx.compose(V(p[0], 4.6 * k, p[1]), q4.setFromEuler(e.set(0, R() * 6, 0)), V(k, k, k)); pines.setMatrixAt(np++, mtx); }
    else { const c = (R() * leafMs.length) | 0; mtx.compose(V(p[0], 4.7 * k, p[1]), q4.setFromEuler(e.set(R(), R() * 6, R())), V(k * (1 + R() * 0.4), k * (0.8 + R() * 0.3), k * (1 + R() * 0.4))); canopy[c].setMatrixAt(cnt[c]++, mtx); }
    if (o.block && o.block(p)) ctx.blockers.push({ x: +p[0].toFixed(2), z: +p[1].toFixed(2), hw: 0.3, hd: 0.3, rot: 0 }); });
  canopy.forEach((m, c) => { m.count = cnt[c]; }); pines.count = np;
  if (VIEW3D) { const c = new THREE.Color();   /* 그루마다 색을 조금씩 (해시 — 장면 난수 R 은 그대로) · 바람 */
    for (const m of [pines, ...canopy]) { for (let i = 0; i < m.count; i++) { const u = hashU(i, m.id, 3); m.setColorAt(i, c.setRGB(0.82 + u * 0.36, 0.86 + hashU(i, m.id, 4) * 0.28, 0.8 + hashU(i, m.id, 5) * 0.3)); } if (m.instanceColor) m.instanceColor.needsUpdate = true; windify(m.material); } }
  for (const m of [trunks, pines, ...canopy]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); } return n; }
/* 3D 나무 모양 (문서 220) — 장난감 같은 다면체 하나 대신: 활엽수는 울퉁불퉁한 덩어리 넷, 소나무는 3 층. 흔들림은 셰이더(바람) */
function crownGeo(THREE) { const parts = [[0, 0.2, 0, 1.35], [0.85, -0.25, 0.3, 1.05], [-0.7, -0.15, -0.45, 1.1], [0.1, 0.95, -0.2, 0.95]].map(([x, y, z, r], i) => { const g = lumpy(new THREE.IcosahedronGeometry(r, 0), 0.16, 30 + i); g.translate(x, y, z); return g.index ? g.toNonIndexed() : g; });
  const g = mergeGeometries(parts, false); g.computeVertexNormals(); return g; }
function pineGeo(THREE) { const parts = [[1.7, 2.2, -1.2], [1.3, 1.9, 0.1], [0.85, 1.6, 1.25]].map(([r, h, y], i) => { const g = new THREE.ConeGeometry(r, h, 7); lumpy(g, 0.08, 50 + i, false); g.translate(0, y, 0); return g.toNonIndexed(); });
  const g = mergeGeometries(parts, false); g.computeVertexNormals(); return g; }
function bushGeo(THREE) { const parts = [[0, 0.05, 0, 0.68], [0.58, -0.1, 0.18, 0.52], [-0.45, -0.08, -0.38, 0.55]].map(([x, y, z, r], i) => { const g = lumpy(new THREE.IcosahedronGeometry(r, 0), 0.16, 70 + i);   /* 덩어리 셋 × 20 면 — 세분 1 × 다섯(400 면)은 덤불 수천 그루라 삼각형이 2.5 배가 됐다 */ g.translate(x, y, z); return g.index ? g.toNonIndexed() : g; });
  const g = mergeGeometries(parts, false); g.computeVertexNormals(); return g; }
export const WIND = { value: 0 };   /* world3d 가 매 프레임 올린다 */
function windify(m) { if (m.userData.wind) return; m.userData.wind = true;
  m.onBeforeCompile = sh => { sh.uniforms.uWind = WIND; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n{ vec3 ip = instanceMatrix[3].xyz; float sw = sin(uWind * 1.3 + ip.x * 0.31 + ip.z * 0.23) + 0.5 * sin(uWind * 2.7 + ip.x * 0.7); float k = max(transformed.y + 2.0, 0.0) * 0.035; transformed.x += sw * k; transformed.z += cos(uWind * 1.1 + ip.z * 0.27) * k * 0.6; }\n#endif'); };
  m.customProgramCacheKey = () => 'wind'; }
/* 물 (문서 220 §6) — 금속성 0.5 판은 비출 환경이 없어 «남색 판» 이었고(해운대), 강은 해 반사만 번져 «주황 맨땅» 이었다(춘천).
   하늘을 비추는 수면: 움직이는 잔물결 법선 · 프레넬로 하늘(돔 색) 반사 · 해 반짝임. 하늘 색은 돔 uniform 을 그대로 가리킨다(world3d 가 이어 준다) → 시간대를 따라간다.
   물가엔 밀려왔다 빠지는 거품 띠(foamBand). 모양만 — 막이·장면 난수와 무관 */
export const WATER = { uTime: WIND, uTop: { value: null }, uHor: { value: null }, uFogc: { value: null }, uSun: { value: null }, uSunc: { value: null }, uRidge: { value: null } };
function waterDefaults(THREE) { const d = { uTop: 0x3a2a48, uHor: 0xd06a50, uFogc: 0x2a1a24, uSunc: 0xff8a50 }; for (const k in d) if (!WATER[k].value) WATER[k].value = new THREE.Color(d[k]); if (!WATER.uSun.value) WATER.uSun.value = new THREE.Vector3(0, 0.2, 1); if (!WATER.uRidge.value) WATER.uRidge.value = new THREE.Vector3(0.12, 0.07, 1); }
const WATER_PARS = 'uniform float uTime; uniform vec3 uTop, uHor, uFogc, uSun, uSunc; varying vec3 vWP;\n'
  + 'float wvN(vec2 p){ return sin(dot(p, vec2(0.204, 0.050)) + uTime * 0.7) * 0.55 + sin(dot(p, vec2(-0.212, 0.488)) + uTime * 1.0) * 0.5 + sin(dot(p, vec2(0.802, -0.791)) + uTime * 1.6) * 0.3'
  + ' + sin(dot(p, vec2(0.601, 2.241)) - uTime * 2.3) * 0.16 + sin(dot(p, vec2(-3.256, -1.739)) + uTime * 3.1) * 0.09; }\n';   /* 방향이 제각각인 다섯 물결 — 축 맞춘 물결은 반짝임이 격자로 줄 섰다 */
export function waterMat(THREE, { calm = false } = {}) { waterDefaults(THREE); const m = new THREE.MeshStandardMaterial({ color: calm ? 0x101418 : 0x0c161c, roughness: 0.42, metalness: 0, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: calm ? -30 : -6 }); m.userData.water = true; if (calm) m.userData.puddle = true;   /* calm: 길 웅덩이 — 길(-24)보다 앞 · 잔물결만 */   /* 바닥판(0 m)보다 1.2 cm 위인데 뒤로 밀면(+6) 멀리서 바닥에 덮였다(춘천 강) — 앞으로, 길(-24)보다는 약하게 */
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, WATER);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + WATER_PARS + SKY_REFL)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec3 wV = normalize(cameraPosition - vWP); float wD = length(cameraPosition - vWP); vec2 wq = vWP.xz; float we = 0.18;
float wgx = wvN(wq + vec2(we, 0.0)) - wvN(wq - vec2(we, 0.0)), wgz = wvN(wq + vec2(0.0, we)) - wvN(wq - vec2(0.0, we)), wA = ${calm ? '0.08' : '0.62'} / (1.0 + wD * 0.025);
vec3 wN = normalize(vec3(-wgx * wA, 1.0, -wgz * wA)); normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 wR = reflect(-wV, wN); float ry = wR.y, sd = max(dot(wR, normalize(uSun)), 0.0);
  vec3 sky = skyRefl(vec3(wR.x, max(ry, 0.0), wR.z));   /* 하늘 돔과 같은 능선이 거꾸로 비친다 */
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(wN, wV), 0.0), 5.0);
  float wh = smoothstep(-1.4, 1.4, wvN(wq)); totalEmissiveRadiance += sky * F * ${calm ? '0.55' : '0.8'} * (0.72 + 0.4 * wh) +   /* 물결 마루·골 밝기 차 — 노을 쪽 밝은 하늘이 고르게 비치면 «판» 이었다 */
    uSunc * (pow(sd, 420.0) * 5.0 + pow(sd, 40.0) * 0.18) * smoothstep(-0.05, 0.08, uSun.y);
  diffuseColor.rgb *= 1.0 - F; }`)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directSpecular *= 0.15;'); };   /* 거친 표준 반사가 해 쪽 수면을 통째로 주황으로 덮었다 — 반짝임은 물결 법선으로 따로 */
  m.customProgramCacheKey = () => calm ? 'water-calm' : 'water'; return m; }
/* 물가 거품 띠: 선을 오른쪽(+n = (-dz, dx))으로 o0 ~ o1 만큼 민 띠. uv = (따라간 거리, 띠 안쪽 0 → 바깥 1) */
let FOAM_M = null;
function foamMat(THREE) { if (FOAM_M) return FOAM_M; waterDefaults(THREE);
  FOAM_M = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, uniforms: { ...THREE.UniformsLib.fog, uTime: WATER.uTime, uHor: WATER.uHor, uTop: WATER.uTop },
    vertexShader: '#include <fog_pars_vertex>\nvarying vec2 vF; void main(){ vF = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
    fragmentShader: '#include <fog_pars_fragment>\nuniform float uTime; uniform vec3 uHor, uTop; varying vec2 vF;\n'
      + 'float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); } float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }\n'
      + 'void main(){ float sw = sin(uTime * 0.5 + n1(vF.x * 0.03) * 6.28) * 0.5 + 0.5, reach = 0.3 + 0.65 * sw;   /* 밀려왔다 빠진다 — 자리마다 박자가 다르게 */\n'
      + '  float edge = smoothstep(0.0, 0.1, vF.y) * (1.0 - smoothstep(reach * 0.55, reach, vF.y));\n'
      + '  float br = smoothstep(0.42, 0.8, n1(vF.x * 0.09 + uTime * 0.05) * 0.4 + n1(vF.x * 0.37 - uTime * 0.23 + vF.y * 3.0) * 0.35 + n1(vF.x * 1.7 + vF.y * 9.0 - uTime * 0.6) * 0.25);   /* 잘게 끊긴 거품 — 고르면 시멘트 턱처럼 보였다 */\n'
      + '  vec3 c = mix(uHor, vec3(1.0), 0.4) * (0.5 + 0.25 * dot(uTop, vec3(0.33)));\n'
      + '  gl_FragColor = vec4(c, edge * br * 0.42);\n#include <fog_fragment>\n}' });
  FOAM_M.userData.foam = true; return FOAM_M; }
export function foamBand(ctx, pts, o0, o1, y = 0.03) { const { THREE, scene } = ctx; if (pts.length < 2) return null; const pos = [], uv = [], idx = []; let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    pos.push(pts[i][0] - dz * o0, y, pts[i][1] + dx * o0, pts[i][0] - dz * o1, y, pts[i][1] + dx * o1); uv.push(s, 0, s, 1);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.Mesh(g, foamMat(THREE)); m.userData.noCam = true; m.renderOrder = 1; scene.add(m); return m; }
const signedArea = P => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] * P[i][1] - P[i][0] * P[j][1]); return a / 2; };
/* 풀포기 (문서 220 §7) — 엇갈린 판 셋(알파 잘라내기), 인스턴스 하나 = 그리기 1번. 길가 잡초와 사냥터 풀이 같이 쓴다.
   처음 잡초는 채도 0.45 · 명도 0.5~0.72 + 노란 결이라 노을빛에 형광 노랑 종이판이었다 → 올리브·마른풀 사이 낮은 채도. 밑동은 고정, 끝만 바람에 */
let TUFT = null;
function tuftParts(THREE) { if (TUFT) return TUFT;
  const tex = canvasTex(THREE, 64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = 3 + (i * 37 % 58), bend = ((i * 13) % 11) - 5; g.strokeStyle = ['#6e7a3c', '#8a8448', '#5a6232', '#9a8a5a'][i % 4]; g.lineWidth = 3 + (i % 2); g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + bend, h * 0.5, x + bend * 2, 4 + (i * 7 % 24)); g.stroke(); } });
  const geo = mergeGeometries([0, 1, 2].map(k => { const p = new THREE.PlaneGeometry(0.9, 0.7); p.translate(0, 0.35, 0); p.rotateY(k * Math.PI / 3); return p; }), false);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  mat.onBeforeCompile = sh => { sh.uniforms.uWind = WIND; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n{ vec3 ip = instanceMatrix[3].xyz; float k = transformed.y * transformed.y * 0.5; transformed.x += sin(uWind * 1.9 + ip.x * 0.5 + ip.z * 0.3) * k; transformed.z += cos(uWind * 1.5 + ip.z * 0.45) * k * 0.6; }\n#endif'); };
  mat.customProgramCacheKey = () => 'grass-wind'; mat.userData.tuft = true;
  return (TUFT = { geo, mat }); }
export function tuftMesh(THREE, tufts, size = 1) { const { geo, mat } = tuftParts(THREE), im = new THREE.InstancedMesh(geo, mat, tufts.length), m4 = new THREE.Matrix4(), S = new THREE.Matrix4(), c = new THREE.Color();
  tufts.forEach(([x, z, k], i) => { const sc = (0.8 + k * 1.2) * size; m4.makeRotationY(k * 40).premultiply(S.makeScale(sc, sc * (0.8 + k * 0.6), sc)).setPosition(x, 0, z); im.setMatrixAt(i, m4); im.setColorAt(i, c.setHSL(0.17 + k * 0.08, 0.2 + k * 0.08, 0.3 + k * 0.14)); });
  im.userData.noCam = true; im.castShadow = false; im.receiveShadow = true; return im; }
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
  /* 3D 도시 경계 (문서 220) — 빨간 줄 울타리가 끝없이 반복되면 «게임 벽» 이다. 기운 방호벽 · 녹슨 공사장 가림막 · 모래주머니 · 잔해를 해시로 섞는다(장면 난수 R 안 씀) */
  const V3 = VIEW3D && urban, conc3 = V3 && new THREE.MeshStandardMaterial({ color: 0x8e8a84, roughness: 0.9, map: gritTex(THREE) }), panelMs = V3 && [0x5a6a7a, 0x6a6e70, 0x4a5a52].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.3, map: gritTex(THREE) })), bagM3 = V3 && new THREE.MeshStandardMaterial({ color: 0x7a6e56, roughness: 0.95 });
  const panelG = V3 && (() => { const g = new THREE.BoxGeometry(2.04, 2.2, 0.06, 6, 1, 1), P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, P.getZ(i) + Math.sin(P.getX(i) * 9) * 0.03); g.computeVertexNormals(); g.translate(0, 1.1, 0); return g; })();   /* 골판 */
  function piece3(g, s, t) { const u = hashU(Math.round(s * 7), Math.round(t * 7), 3), v = hashU(Math.round(s * 7), Math.round(t * 7), 4);
    if (u < 0.45) { const j = new THREE.Mesh(jG, conc3); j.position.set((v - 0.5) * 0.3, 0.425 - (v < 0.2 ? 0.15 : 0), (v - 0.5) * 0.4); j.rotation.set(v < 0.2 ? 0.25 : 0, (v - 0.5) * 0.35, (u - 0.2) * 0.12); g.add(j); }   /* 방호벽 — 가끔 기울어 반쯤 묻힘 */
    else if (u < 0.75) { const pn = new THREE.Mesh(panelG, panelMs[(v * 3) | 0]); pn.rotation.set((v - 0.5) * 0.12, 0, (u - 0.6) * 0.15); g.add(pn); }   /* 공사장 가림막 */
    else if (u < 0.92) { for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(lumpy(new THREE.BoxGeometry(0.62, 0.24, 0.36, 2, 1, 1), 0.04, k + Math.round(s * 13), false), bagM3); b.position.set(-0.65 + (k % 3) * 0.64 + (k > 2 ? 0.3 : 0), 0.12 + (k > 2 ? 0.24 : 0), 0); b.rotation.y = (hashU(k, Math.round(s), 5) - 0.5) * 0.3; g.add(b); } }   /* 모래주머니 */
    else { const r = new THREE.Mesh(lumpy(new THREE.BoxGeometry(1.8, 0.7, 1.1, 2, 1, 2), 0.18, Math.round(s * 31 + t), false), conc3); r.position.y = 0.3; r.rotation.y = v * 3; g.add(r); } }   /* 잔해 */
  function piece(s, t, ang, sign) { const p = FROM(s, t); if (o.skip && o.skip(p)) return; const g = new THREE.Group();
    if (V3) { piece3(g, s, t); sign = sign && hashU(Math.round(s), Math.round(t), 9) < 0.5; }
    else if (urban) { const j = new THREE.Mesh(jG, jerseyM); j.position.y = 0.425; g.add(j); const f = new THREE.Mesh(fG, fenceM); f.position.y = 1.55; g.add(f);
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
  const bare = p => { ray.set(new THREE.Vector3(p[0], 0, p[1]).addScaledVector(Dv, -150), Dv); const hit = ray.intersectObjects(objs, true).find(h => h.object.visible && !h.object.isLight && !h.object.userData.noCam && !h.object.isLine);   /* 3D 만의 꾸밈·먼 도시·소품·전선(noCam)은 굽기에 없다 — 맞으면 문 자리가 서버 지도와 어긋난다(판교 → 수원 5 m) */ return !hit || hit.point.y < 0.12; };
  for (const r of [0, 2, 3, 4, 5, 6, 8, 10]) for (let k = 0; k < (r ? 16 : 1); k++) { const a = k / 16 * Math.PI * 2, st = [st0[0] + Math.cos(a) * r, st0[1] + Math.sin(a) * r];
    if (st[1] < walk.t0 + 2 || st[1] > walk.t1 - 2 || st[0] < walk.s0 + 1 || st[0] > walk.s1 - 1) continue; if (o.ok && !o.ok(st)) continue;
    if ([[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]].every(([ds, dt]) => bare(FROM(st[0] + ds, st[1] + dt)))) return st; }
  return st0; }
export function gateRing(ctx, p, r = 3.2, color = 0x40d8ff) { const { THREE, scene } = ctx; const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.25, r, 48), new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.8 })); m.rotation.x = -Math.PI / 2; m.position.set(p[0], 0.05, p[1]); scene.add(m); }

/* ---------- 가로등 (몇몇만 켜짐) ---------- */
export function lamps(ctx, spots, o = {}) { const { THREE, scene } = ctx; const poleM = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.5, metalness: 0.6 }); let n = 0;
  for (const p of spots) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.2, 6), poleM); pole.position.set(p[0], 2.6, p[1]); pole.castShadow = true; scene.add(pole); ctx.blockers.push({ x: +p[0].toFixed(2), z: +p[1].toFixed(2), hw: 0.2, hd: 0.2, rot: 0 });
    const lit = VIEW3D ? n % 3 === 0 : n % 3 !== 1; const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: lit ? (o.color || 0xffe0a0) : 0x3a3a3a, toneMapped: false })); head.position.set(p[0], 5.25, p[1]); scene.add(head);
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
  const patchM = (o.patches || ['forest', 'sand', 'grass']).map(k => layer(new THREE.MeshStandardMaterial({ map: tex[k], roughness: 1, color: k === 'sand' ? 0x8a7a6a : 0xffffff, transparent: true, opacity: 0.85 }), LAYER.patch));
  let np = 0; for (const p of pick(Math.round(A / (o.patchEvery || 700)))) { const r = 3 + R() * 10, n = 9, pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r * (0.6 + R() * 0.6); pts.push([p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr]); }
    flatPoly(ctx, pts, patchM[(R() * patchM.length) | 0], 0.003 + R() * 0.002); np++; } stat.patches = np;
  const made = [], inst = (geo, mats, spots, place) => { const per = mats.map(() => []); spots.forEach(p => per[(R() * mats.length) | 0].push(p));
    per.forEach((ps, k) => { if (!ps.length) return; const m = new THREE.InstancedMesh(geo, mats[k], ps.length), mtx = new THREE.Matrix4(); ps.forEach((p, i) => { place(p, mtx); m.setMatrixAt(i, mtx); }); m.castShadow = true; m.receiveShadow = true; scene.add(m); made.push(m); }); return spots.length; };
  const tint = (from, lo, span) => { const c = new THREE.Color(); for (const m of made.slice(from)) { for (let i = 0; i < m.count; i++) { const u = hashU(i, m.count, 7); m.setColorAt(i, c.setScalar(lo + u * span)); } if (m.instanceColor) m.instanceColor.needsUpdate = true; } };   /* 3D: 개체마다 밝기를 조금씩 (해시 — 장면 난수 안 씀) */
  const q4 = new THREE.Quaternion(), e = new THREE.Euler(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  /* 2) 바위 — 뭉친 곳에 많이. 큰 것만 막는다 */
  const rockG = VIEW3D ? lumpy(new THREE.IcosahedronGeometry(1, 1), 0.22, 11) : new THREE.DodecahedronGeometry(1, 0), rockM = (o.rockColors || (o.urban ? [0x6a6662, 0x5a5856, 0x4c4a48] : [0x5a4a3e, 0x6a5a4a, 0x4a3e36])).map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true, map: VIEW3D ? gritTex(THREE) : null }));
  const rocks = pick(Math.round(A / (o.rockEvery || 160))).filter(p => R() < 0.25 + N(p[0], p[1]) * 1.2);
  const rock0 = made.length; stat.rocks = inst(rockG, rockM, rocks, (p, mtx) => { const k = 0.35 + Math.pow(R(), 2.2) * 1.5; mtx.compose(V(p[0], k * (VIEW3D ? 0.1 : 0.25), p[1]),   /* 3D: 땅에 반쯤 묻는다 — 얹힌 돌은 소품처럼 보였다 */ q4.setFromEuler(e.set(R() * 0.6, R() * 6, R() * 0.6)), V(k * (0.8 + R() * 0.6), k * (0.45 + R() * 0.35), k * (0.8 + R() * 0.6)));
    if (k > 0.9) ctx.blockers.push({ x: +p[0].toFixed(2), z: +p[1].toFixed(2), hw: k * 0.8, hd: k * 0.8, rot: 0 }); });
  if (VIEW3D) tint(rock0, 0.78, 0.4);
  /* 3) 덤불 — 무릎 높이(인물을 가리지 않는다) */
  const bushG = VIEW3D ? bushGeo(THREE) : new THREE.IcosahedronGeometry(0.7, 0), bushM = (o.bushColors || [0x2e3a26, 0x3a3424, 0x4a2e22]).map(c => new THREE.MeshStandardMaterial({ color: VIEW3D ? new THREE.Color(c).lerp(new THREE.Color(0x2e3426), 0.35) : c, roughness: 0.9, flatShading: true }));   /* 3D: 덩어리 여럿(다면체 하나는 색칠한 돌로 읽혔다) · 붉은 기를 덜어 */
  const bushes = pick(Math.round(A / (o.bushEvery || 45))).filter(p => R() < 0.2 + N(p[0] + 500, p[1]) * 1.3);
  const bush0 = made.length; stat.bushes = inst(bushG, bushM, bushes, (p, mtx) => { const k = 0.6 + R() * 0.7; mtx.compose(V(p[0], 0.3 * k, p[1]), q4.setFromEuler(e.set(0, R() * 6, 0)), V(k * (1 + R() * 0.5), k * (0.55 + R() * 0.25), k * (1 + R() * 0.5))); });
  if (VIEW3D) { tint(bush0, 0.75, 0.5); for (const m of made.slice(bush0)) windify(m.material);
    /* 풀포기: 바위·덤불 둘레 (자리는 해시) — 맨바닥에 돌만 흩어진 «게임판» 을 덮는다 */
    const tufts = [], ring = (p, n, r0, r1) => { for (let j = 0; j < n; j++) { const u = hashU(Math.round(p[0] * 10), Math.round(p[1] * 10), j), v = hashU(Math.round(p[1] * 10), j, Math.round(p[0] * 10)), a = u * 6.283, r = r0 + v * (r1 - r0); tufts.push([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r, hashU(j, Math.round(p[0]), Math.round(p[1]))]); } };
    for (const p of rocks) ring(p, 2, 0.6, 1.6); for (const p of bushes) ring(p, 1, 0.6, 1.2);
    const keepT = tufts.filter(t => !isClear(ctx, [t[0], t[1]], 0.2)); if (keepT.length) scene.add(tuftMesh(THREE, keepT, 0.36));   /* 무릎 아래 — 처음엔 길가 잡초 크기(최대 2 m)라 몬스터를 가렸다 */ stat.tufts = keepT.length; }
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
