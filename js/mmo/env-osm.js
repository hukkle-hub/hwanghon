/* 황혼 2D 맵 MMORPG — 실제 공간 원본 장면 (docs/design/185 §6.5)
   OpenStreetMap 실측(maps/2d/<zone>/osm.json, tools/2d/osm-extract.mjs)으로 건물·도로·출구·횡단보도·신호등을 세우고,
   원작 묘사(EP02 §2~§6, 제1부 통합본 L1199~L1356)대로 꾸민다:
     «강남대로는 부서지지 않았다 … 서울은 무너진 게 아니라 멈춰 있었다» → 건물은 온전하다(잔해 없음)
     «차들은 차선을 지킨 채 멈춰 있었다 … 문이 열린 차, 잠긴 차, 트렁크가 열린 차» → 차선마다 줄지어 선 차
     «전기가 아직 들어온다 … 신호등, 전광판, 몇몇 간판» → 신호등 초록, 전광판, 간판 일부만 켜짐
     «건물 외벽을 타고 주황색 결정 … 죽은 가로수 자리를 대신해 인도 곳곳에 무릎 높이로» → 결정
     «보라와 핏빛이 뒤엉킨 황혼» → 낮게 깔린 노을빛 + 보랏빛 하늘
     «강남역 5번 출구는 반쯤 무너져 있었다» → 5번 출구만 지붕이 내려앉았다
   상호는 쓰지 않는다 — 실제 상표 대신 업종 간판(편의점·약국·치과 …).
   지도 데이터 © OpenStreetMap contributors, ODbL 1.0.
   build(THREE, scene, osm) → { lights, blockers, spawn, road, walk, extent, sun, sky, license } */
export const PITCH = 55 * Math.PI / 180;
const SCREEN_ANG = 28 * Math.PI / 180;   /* 강남대로를 화면 대각선에 (문서 185 §6.1) */
/* 지역별: 길 양쪽 인도에 마주 선 출구 쌍(OSM 실측 확인) — 도로 중심선을 잡는 데 쓴다 */
/* 지역 설정 (docs/design/185 §6.5·§6.6)
   farSide: 화면 위(먼 쪽)에 둘 실측 지점 · exitPairs: 길 양쪽 인도에 마주 선 출구(중심선) · walk: 걷는 띠(없으면 계산)
   gates: 다른 지역·던전으로 가는 문 — at: { exit:'5' } 출구 자리 | { end:'s0'|'s1', t } 띠 끝 · to: { zone, gate }
   closed: 띠 끝에 세우는 통제선 문구 (가안 — 원문에 없는 «군 통제선 잔해») */
import * as L from './env-lib.js';   /* 넓은 필드 땅 꾸미기 (env-lib 은 아무것도 import 하지 않는다 — 순환 없음) */
export const CONFIG = {
  gangnam: { farSide: { exit: '5' }, exitPairs: [['2', '7'], ['3', '6'], ['4', '5'], ['10', '11']],
    gates: [ { id: 'exit5', at: { exit: '5' }, to: { zone: 'gangnam_b1', gate: 'up5' }, label: '강남역 지하상가 · 던전', kind: 'dungeon' },
             { id: 'north', at: { end: 's1', t: 'road' }, to: { zone: 'namsan', gate: 'south' }, label: '남산 방면 · 케이블카', kind: 'zone' },
             /* 강남 벙커 출격문 — 벙커는 강남역 바로 밑 B3 (원작 L251), 출격문을 나서면 강남대로 (L1080) */
             { id: 'bunker', at: { exit: '7' }, to: { zone: 'bunker', gate: 'out' }, label: '강남 벙커 · 출격문', kind: 'zone' },
             { id: 'south', at: { end: 's0', t: 'road' }, to: { zone: 'namtae', gate: 'north' }, label: '남태령 방면 · 양재', kind: 'zone' } ],
    closed: { s0: '남태령 방면 — 양재', s1: '남산 방면 — 신논현' }, start: 'exit7',
    /* 넓게 (디렉터 2026-10-06 «필드를 넓게»): 강남대로 띠 60 m → 카메라 쪽(이미 1층 높이로 잘린 블록) 으로 160 m 더. 먼 쪽 고층 벽은 그대로 */
    wide: { dt0: -160 }, dress: { urban: true, logs: false, patches: ['concrete', 'sand', 'asphalt'], bushColors: [0x2e3428, 0x3a3428, 0x2a2a26] } } };

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* 좌표틀: OSM 로컬(x 동, z 남) → 회전해 축 도로를 화면 대각선 DIR 로, farSide 를 화면 위(먼 쪽)로.
   던전(js/mmo/env-dungeon.js)도 같은 틀을 써서 땅 위 거리와 땅 밑 상가가 같은 방향·같은 자리에 놓인다 */
export function frameOf(THREE, osm, CFG) {
  const DIR = new THREE.Vector2(Math.cos(SCREEN_ANG), -Math.sin(SCREEN_ANG)), SIDE = new THREE.Vector2(-Math.sin(SCREEN_ANG), -Math.cos(SCREEN_ANG));
  let rot = 0;
  for (const cand of [-SCREEN_ANG - osm.axis, Math.PI - SCREEN_ANG - osm.axis]) {
    const fs = CFG.farSide || {}, c = Math.cos(cand), s = Math.sin(cand), [ex, ez] = fs.exit ? (osm.exits.find(e => e.ref === fs.exit)?.p || [0, 1]) : (fs.osm || [0, 1]);
    const wx = ex * c - ez * s, wz = ex * s + ez * c;            /* Ry 와 같은 방향의 2D 회전 (x,z) */
    /* sPos: 이 점이 길 앞쪽(s > 0, 화면 오른쪽 위)에 오게 — 산으로 오르는 지역(남산)은 «위로 올라가는» 쪽이 앞이다 */
    if (fs.sPos) { const [px, pz] = fs.sPos, sx = px * c - pz * s, sz = px * s + pz * c; if (sx * DIR.x + sz * DIR.y > 0) { rot = cand; break; } continue; }
    const t = wx * SIDE.x + wz * SIDE.y; if (t > 0) { rot = cand; break; } }
  const ST = ([x, z]) => [x * DIR.x + z * DIR.y, x * SIDE.x + z * SIDE.y];   /* 월드 → 길 좌표 (s 길 따라, t 건너 +가 먼 쪽) */
  const FROM = (s, t) => [s * DIR.x + t * SIDE.x, s * DIR.y + t * SIDE.y];   /* 길 좌표 → 월드 */
  /* 도로 중심선 보정: 원점은 강남대로 한쪽 차로 위라 띠가 한쪽으로 7~15 m 치우쳤다(2번 출구가 t = −3 m, 차도 한가운데).
     길 양쪽 인도에 마주 선 출구 쌍의 가운데가 중심선이다 — 그 점들이 s 를 따라 평평해지도록 회전을 조금 더 돌리고, 띠를 그 가운데에 둔다 */
  const PAIRS = (CFG.exitPairs || []).map(([a, b]) => [osm.exits.find(e => e.ref === a), osm.exits.find(e => e.ref === b)]).filter(([a, b]) => a && b);
  const rotAt = r => { const c = Math.cos(r), s = Math.sin(r); return ([x, z]) => [x * c - z * s, x * s + z * c]; };
  const mids = r => PAIRS.map(([a, b]) => { const A = ST(rotAt(r)(a.p)), B = ST(rotAt(r)(b.p)); return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]; });
  let tc = 0;
  if (PAIRS.length >= 2) { let best = null; for (let d = -0.2; d <= 0.2; d += 0.0005) { const m = mids(rot + d), mt = m.reduce((a, p) => a + p[1], 0) / m.length, v = m.reduce((a, p) => a + (p[1] - mt) ** 2, 0); if (!best || v < best.v) best = { v, d, mt }; }
    rot += best.d; tc = best.mt; console.info('[env-osm] 중심선 보정', (best.d * 180 / Math.PI).toFixed(2) + '°', '중심 t', tc.toFixed(1), 'm · 잔차', Math.sqrt(best.v / PAIRS.length).toFixed(1), 'm'); }
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const W = ([x, z]) => [x * cr - z * sr, x * sr + z * cr];                 /* OSM → 월드 */
  return { DIR, SIDE, ST, FROM, W, tc, rot };
}

export function build(THREE, scene, osm, opt = {}) {
  const R = rng(20261006), lights = [], blockers = [], CFG = Object.assign({}, CONFIG[osm.zone] || {}, opt);
  const { DIR, SIDE, ST, FROM, W, tc } = frameOf(THREE, osm, CFG);
  const V3 = (p, y = 0) => new THREE.Vector3(p[0], y, p[1]);
  /* 걷는 띠: 사거리 북쪽 55 m 부터 5번 출구 남쪽 18 m 까지, 강남대로 양쪽 인도까지 (t ±30 m) */
  const s5 = ST(W(osm.exits.find(e => e.ref === (CFG.farSide?.exit || '5'))?.p || [80, 300]))[0];
  const walk = CFG.walk ? { ...CFG.walk } : Object.assign(s5 > 0 ? { s0: -55, s1: Math.round(s5 + 18), t0: Math.round(tc - 30), t1: Math.round(tc + 30) } : { s0: Math.round(s5 - 18), s1: 55, t0: Math.round(tc - 30), t1: Math.round(tc + 30) }, opt.walk || {});
  if (CFG.wide) { walk.t0 = Math.round(walk.t0 + (CFG.wide.dt0 || 0)); walk.t1 = Math.round(walk.t1 + (CFG.wide.dt1 || 0)); }

  /* ---------- 하늘·노을 (원작 «보라와 핏빛이 뒤엉킨 황혼») ---------- */
  const sky = { top: '#2a1838', horizon: '#7a2a3a', fog: '#3a2238' };
  scene.background = new THREE.Color(sky.fog);
  /* 황혼은 밤이 아니다 — 하늘빛이 꽤 밝다 (첫 판은 0.85 로 한밤처럼 나왔다) */
  scene.add(new THREE.HemisphereLight(0xc09ad0, 0x4a2c30, 3.2));
  /* 해: 서쪽 낮게(고도 14°). 실제 서쪽(OSM -x)을 회전해 월드로 */
  const west = W([-1, 0]), sunDir = new THREE.Vector3(west[0], Math.tan(14 * Math.PI / 180), west[1]).normalize();
  const sun = new THREE.DirectionalLight(0xff9a60, 4.2); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  /* ---------- 텍스처 ---------- */
  function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); return t; }
  const noise = (g, w, h, base, amp, n) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const v = amp[0] + R() * amp[1] | 0; g.fillStyle = `rgba(${v},${v},${v + 3},${0.35 + R() * 0.4})`; g.fillRect(R() * w, R() * h, 2, 2); } };
  const asphalt = canvasTex(512, 512, (g, w, h) => { noise(g, w, h, '#34353c', [40, 34], 9000);   /* 새까마면 노을빛도 안 받는다 */ g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
    for (let i = 0; i < 10; i++) { g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - .5) * 90; y += (R() - .5) * 90; g.lineTo(x, y); } g.stroke(); } });
  asphalt.repeat.set(1 / 8, 1 / 8);
  /* 보도블록 — 서울 인도의 회색·적갈 블록 */
  /* 한 장 = 1.6 m — 블록 하나 20 × 10 cm (서울 보도). 첫 판은 4 m 라 블록이 사람 머리만 했다(휴대폰 세로 확인) */
  const paver = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#4c484a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 16; x < w; x += 32) { const v = 66 + R() * 12 | 0; g.fillStyle = R() < 0.1 ? `rgb(${v + 16},${v - 4},${v - 6})` : `rgb(${v},${v - 2},${v})`; g.fillRect(x + 1, y + 1, 30, 14); } });
  paver.repeat.set(1 / 1.6, 1 / 1.6);
  /* 건물 외벽: 층 3.6 m × 창 1.8 m. 전기는 «몇몇» 만 — 불 켜진 창은 드물다 */
  const facades = [0, 1, 2, 3].map(k => canvasTex(256, 256, (g, w, h) => {
    const wall = ['#3a3a44', '#45424a', '#2e3440', '#4a4440'][k]; g.fillStyle = wall; g.fillRect(0, 0, w, h);
    const glass = ['#1a2230', '#202a38', '#151c26', '#2a2a30'][k];
    for (let fy = 0; fy < 4; fy++) for (let fx = 0; fx < 8; fx++) { const x = fx * 32, y = fy * 64; g.fillStyle = glass; g.fillRect(x + 3, y + 10, 26, 44);
      const r = R(); if (r < 0.05) { g.fillStyle = R() < .6 ? '#ffcf7a' : '#7ad8ff'; g.fillRect(x + 3, y + 10, 26, 44); } else if (r < 0.35) { g.fillStyle = 'rgba(255,140,90,.18)'; g.fillRect(x + 3, y + 10, 26, 22); } }
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let fy = 0; fy < 4; fy++) g.fillRect(0, fy * 64 + 58, w, 6); }));
  facades.forEach(t => t.repeat.set(1 / 14.4, 1 / 14.4));   /* 텍스처 한 장 = 8창 × 4층 = 14.4 m 정사각 */
  const facadeMats = facades.map(t => new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0.25 }));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2830, roughness: 0.9 });
  const cutMat = new THREE.MeshStandardMaterial({ color: 0x2c2a32, roughness: 0.95 });   /* 잘라 낸 건물 윗면 — 새까마면 구멍처럼 보인다 */

  /* ---------- 땅 ---------- */
  const groundTex = paver.clone(); groundTex.repeat.set(1400 / 1.6, 1400 / 1.6);   /* 판 UV 는 0~1 — 1.6 m 마다 한 장 */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.75, metalness: 0.05 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  /* 공원·녹지 */
  for (const a of osm.areas) { if (!/park|pitch|grass/.test(a.kind)) continue; const sh = new THREE.Shape(a.poly.map(p => { const w = W(p); return new THREE.Vector2(w[0], -w[1]); }));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: 0x2a3424, roughness: 1 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.receiveShadow = true; scene.add(m); }

  /* ---------- 도로: 중심선을 폭만큼 펼친 띠 ---------- */
  function ribbon(line, width, y) { const pos = [], idx = []; const pts = line.map(W);
    for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      pos.push(pts[i][0] - dz * width / 2, y, pts[i][1] + dx * width / 2, pts[i][0] + dz * width / 2, y, pts[i][1] - dx * width / 2);
      if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } }   /* 위를 보게 감는다 — 첫 판은 아래를 봐서 아스팔트가 통째로 안 보였다 */
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i], pos[i + 2]); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; }
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.34, metalness: 0.25 });
  if (L.isView3d()) { roadMat.polygonOffset = true; roadMat.polygonOffsetFactor = 0; roadMat.polygonOffsetUnits = -24; }   /* 3D: 길이 광장·풀밭 위에 (문서 220) */
  const busMat = new THREE.MeshStandardMaterial({ color: 0x6a2a2a, roughness: 0.6 });   /* 중앙버스전용차로 — 붉은 포장 */
  const WIDTH = { primary: 3.3, primary_link: 3.3, secondary: 3.2, tertiary: 3.1 };
  const roadsW = [], dashMats = {};
  for (const r of osm.roads) { if (r.tunnel || r.layer < 0 || r.kind === 'platform') continue;
    let width, mat = roadMat, y = 0.02;
    if (WIDTH[r.kind]) width = (r.lanes || 2) * WIDTH[r.kind];
    else if (r.kind === 'busway') { width = 3.6; mat = busMat; y = 0.025; }
    else if (r.kind === 'residential' || r.kind === 'unclassified') width = r.width || 7;
    else if (r.kind === 'service') width = r.width || 4.5;
    else continue;   /* 보행로·계단은 보도블록 그대로 */
    const m = new THREE.Mesh(ribbon(r.line, width, L.isView3d() ? y + 0.04 : y), mat);   /* 3D: 광장·풀밭보다 4 cm 위 (문서 220) */ m.receiveShadow = true; scene.add(m); roadsW.push({ r, width, pts: r.line.map(W) });
    /* 차선: 간선은 점선 */
    if (WIDTH[r.kind] && (r.lanes || 2) > 1) for (let k = 1; k < (r.lanes || 2); k++) dashed(r.line.map(W), -width / 2 + k * width / (r.lanes || 2), 0xb8b8a8);
    if (WIDTH[r.kind]) { dashed(r.line.map(W), -width / 2 + 0.2, 0xd8d8c8, true); dashed(r.line.map(W), width / 2 - 0.2, 0xd8d8c8, true); } }
  function dashed(pts, off, color, solid) { const mat = dashMats[color] || (dashMats[color] = new THREE.MeshStandardMaterial({ color, roughness: 0.7, transparent: true, opacity: 0.55 }));   /* 닳은 페인트 */
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 0.5) continue; dx /= L; dz /= L;
      const step = solid ? L : 6, len = solid ? L : 3;
      for (let d = 0; d + len <= L + 1e-3; d += step) { const cx = a[0] + dx * (d + len / 2) - dz * off, cz = a[1] + dz * (d + len / 2) + dx * off;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.12), mat); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(dz, dx); m.position.set(cx, 0.03, cz); scene.add(m); } } }
  /* 가장 가까운 간선 방향 (횡단보도·차 방향) */
  function nearestRoad(p, kinds) { let best = null; for (const rw of roadsW) { if (kinds && !kinds.includes(rw.r.kind)) continue;
      for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1;
        const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / L2)), qx = a[0] + vx * u, qz = a[1] + vz * u, d = Math.hypot(p[0] - qx, p[1] - qz);
        if (!best || d < best.d) best = { d, q: [qx, qz], dir: Math.atan2(vz, vx), rw, i, u }; } } return best; }
  /* 횡단보도 (흰 줄무늬) — OSM 횡단 지점은 차로마다 하나 */
  const zebraMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.55, emissive: 0x303030 });
  for (const c of osm.crossings) { const p = W(c), n = nearestRoad(p, ['primary', 'primary_link', 'secondary', 'tertiary', 'residential', 'busway']); if (!n || n.d > 6) continue;
    const across = n.dir + Math.PI / 2, w = n.rw.width;
    for (let k = -w / 2 + 0.5; k <= w / 2 - 0.5; k += 1.0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), zebraMat); m.rotation.x = -Math.PI / 2; m.rotation.z = -across;
      m.position.set(n.q[0] + Math.cos(across) * k, 0.035, n.q[1] + Math.sin(across) * k); scene.add(m); } }

  /* ---------- 건물: 실측 윤곽 × 실측 높이. 가까운 쪽(화면 아래)은 1층만 남기고 잘라 길을 가리지 않게 ---------- */
  const footprintArea = poly => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
  const builtW = [];
  for (const b of osm.buildings) { if (b.under) continue;
    const pts = b.poly.map(W); if (pts.length > 2 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop(); if (pts.length < 3) continue;
    const area = footprintArea(pts); let h = b.height || (b.levels ? b.levels * 3.6 : (area > 900 ? 22 + R() * 20 : area > 300 ? 12 + R() * 12 : 7 + R() * 7));
    const cst = pts.reduce((a, p) => { const st = ST(p); return [a[0] + st[0] / pts.length, a[1] + st[1] / pts.length]; }, [0, 0]);
    const near = cst[1] < tc, full = h;   /* 도로 중심선보다 가까운 쪽 */ if (near) h = Math.min(h, 4.2);   /* 잘라 낸 건물: 1층 높이 */
    if (near && CFG.wide && cst[1] < tc - 34) h = Math.min(full, 2.6 + R() * 3.2);   /* 넓힌 블록 — 높이를 흔들어 무너진 동네처럼 (한 높이면 판자 같다) */
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, [near ? cutMat : roofMat, facadeMats[(b.id >>> 3) % 4]]); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    if (L.isView3d()) L.addDeco(THREE, scene, L.buildingDeco(THREE, pts, h, b.id | 0, { roof: !near, shops: true, signs: false }), b.id | 0);   /* 3D 만: 셔터 띠 · 옥상 (간판은 아래 POI 네온이 따로 — 문서 218) */
    blockers.push({ poly: pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) }); builtW.push({ pts, h, full, near, cst, id: b.id }); }
  if (CFG.dress && CFG.wide) {   /* 넓힌 블록 땅 꾸미기 — 길·건물 위는 피한다 */
    const inB = p => builtW.some(b => L.inPoly(p, b.pts)), onRoad = p => { const n = nearestRoad(p); return n && n.d < n.rw.width / 2 + 1.5; };
    const dctx = { THREE, scene, R, FROM, clear: [], blockers }, st = L.dress(dctx, { s0: walk.s0, s1: walk.s1, t0: walk.t0, t1: tc - 32 }, L.textures(dctx), { ...CFG.dress, keep: p => !inB(p) && !onRoad(p) });
    console.log('[env-osm] 땅 꾸미기', JSON.stringify(st)); }

  if (L.isView3d()) L.street({ THREE, scene, ST, walk }, roadsW, builtW);   /* 3D 만: 전봇대·전선·신호등·쓰레기·정류장 (문서 219) */
  /* ---------- 간판: 상가(POI) 업종 → 가까운 건물 길 쪽 벽. 전기가 들어오는 건 «몇몇» ---------- */
  const SIGN = { 'shop:convenience': ['편의점', '#4cff9a'], 'amenity:pharmacy': ['약국', '#4cff9a'], 'amenity:cafe': ['카페', '#ffd23a'], 'amenity:restaurant': ['식당', '#ff8a3a'], 'amenity:fast_food': ['분식', '#ff8a3a'],
    'amenity:bank': ['은행', '#39a0ff'], 'shop:hairdresser': ['미용실', '#ff4fd8'], 'shop:beauty': ['피부관리', '#ff4fd8'], 'shop:nail_salon': ['네일', '#ff4fd8'], 'amenity:dentist': ['치과', '#39e0ff'],
    'amenity:clinic': ['의원', '#39e0ff'], 'amenity:doctors': ['의원', '#39e0ff'], 'amenity:bar': ['호프', '#ffd23a'], 'amenity:pub': ['호프', '#ffd23a'], 'amenity:karaoke_box': ['노래방', '#ff4fd8'],
    'amenity:cinema': ['극장', '#ff3a5a'], 'shop:bakery': ['제과점', '#ffd23a'], 'amenity:nightclub': ['클럽', '#b04fff'], 'amenity:theatre': ['공연장', '#ff3a5a'], 'shop:cosmetics': ['화장품', '#ff4fd8'], 'shop:electronics': ['전자', '#39a0ff'] };
  const signTex = {}; function signT(text, color) { const k = text + color; return signTex[k] || (signTex[k] = canvasTex(256, 96, (g, w, h) => {
    g.fillStyle = '#0a0a10'; g.fillRect(0, 0, w, h); g.strokeStyle = color; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    g.font = '900 54px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = color; g.shadowBlur = 16; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 2); })); }
  function wallFacing(p) { /* 점에서 가장 가까운 건물 벽과 바깥 법선 */ let best = null; for (const b of builtW) { const n = b.pts.length;
      for (let i = 0; i < n; i++) { const a = b.pts[i], c = b.pts[(i + 1) % n], vx = c[0] - a[0], vz = c[1] - a[1], L = Math.hypot(vx, vz); if (L < 2) continue;
        const u = Math.max(0.1, Math.min(0.9, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / (L * L))), qx = a[0] + vx * u, qz = a[1] + vz * u, d = Math.hypot(p[0] - qx, p[1] - qz);
        if (!best || d < best.d) { let nx = vz / L, nz = -vx / L; const mx = b.cst ? 0 : 0; const cx = b.pts.reduce((s, q) => s + q[0], 0) / n, cz = b.pts.reduce((s, q) => s + q[1], 0) / n; if ((qx - cx) * nx + (qz - cz) * nz < 0) { nx = -nx; nz = -nz; }
          best = { d, q: [qx, qz], n: [nx, nz], b, len: L }; } } } return best; }
  const usedWalls = new Map(); let signsLit = 0;
  for (const poi of osm.pois) { const s = SIGN[poi.kind]; if (!s) continue; const p = W(poi.p), wf = wallFacing(p); if (!wf || wf.d > 14 || wf.b.near) continue;
    const key = wf.b.id + ':' + Math.round(wf.q[0] / 4) + ':' + Math.round(wf.q[1] / 4); if (usedWalls.has(key)) continue; usedWalls.set(key, 1);
    const lit = R() < 0.35, y = 3.2 + (usedWalls.size % 3) * 1.1;
    const m = new THREE.MeshBasicMaterial({ map: signT(s[0], s[1]), toneMapped: false }); m.color.setScalar(lit ? 1.5 : 0.28);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.95), m); pl.position.set(wf.q[0] + wf.n[0] * 0.08, y, wf.q[1] + wf.n[1] * 0.08); pl.rotation.y = Math.atan2(wf.n[0], wf.n[1]); scene.add(pl);
    if (lit && signsLit++ < 40) { const lp = [wf.q[0] + wf.n[0] * 1.2, wf.q[1] + wf.n[1] * 1.2]; const L = new THREE.PointLight(new THREE.Color(s[1]), 6, 7, 1.8); L.position.set(lp[0], y - 0.4, lp[1]); scene.add(L);
      lights.push({ x: lp[0], y: y - 0.4, z: lp[1], color: s[1], intensity: 6, distance: 7 }); } }
  /* 전광판 — 큰 건물 먼 쪽 벽 몇 곳 («전기가 아직 들어온다») */
  const boards = builtW.filter(b => !b.near && b.full > 30).sort((a, c) => c.full - a.full).slice(0, 4);
  const boardTex = canvasTex(512, 288, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a0a3a'); gr.addColorStop(1, '#0a2a4a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.font = '900 64px "Noto Sans KR",sans-serif'; g.fillStyle = '#ff6a3a'; g.shadowColor = '#ff6a3a'; g.shadowBlur = 20; g.textAlign = 'center'; g.fillText('대피 안내', w / 2, h / 2 - 10);
    g.font = '700 28px "Noto Sans KR",sans-serif'; g.fillStyle = '#ffd8c0'; g.shadowBlur = 6; g.fillText('가까운 지하 대피소로 이동하십시오', w / 2, h / 2 + 46); });
  for (const b of boards) { const c = b.pts.reduce((a, p) => [a[0] + p[0] / b.pts.length, a[1] + p[1] / b.pts.length], [0, 0]); const wf = wallFacing(FROM(ST(c)[0], ST(c)[1] - 20)); if (!wf || wf.b !== b) continue;
    const m = new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }); m.color.setScalar(1.4); const pl = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), m);
    pl.position.set(wf.q[0] + wf.n[0] * 0.1, Math.min(b.full - 4, 16), wf.q[1] + wf.n[1] * 0.1); pl.rotation.y = Math.atan2(wf.n[0], wf.n[1]); scene.add(pl); }

  /* ---------- 지하철 출구 (실측 위치) — 서울식 유리 지붕 + 번호. 5번만 반쯤 무너졌다 ---------- */
  const frameM = new THREE.MeshStandardMaterial({ color: 0x3a3c44, roughness: 0.45, metalness: 0.6 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x5a7a90, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.45 });
  const noTex = {}; const numT = n => noTex[n] || (noTex[n] = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#f2b81e'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = '900 84px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, w / 2, h / 2 + 4); }));
  const exitsW = [];
  for (const e of osm.exits) { const p = W(e.p), n = nearestRoad(p, ['primary', 'primary_link', 'secondary', 'tertiary']); const along = n ? n.dir : 0;
    /* 계단은 길을 따라 내려간다 — 지붕 3.2 × 6 m */
    const g = new THREE.Group(), broken = e.ref === '5';
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6, 0.12, 3.2), glassM); roof.position.y = 2.7; g.add(roof);
    for (const sx of [-2.9, 2.9]) for (const sz of [-1.5, 1.5]) { const pp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.7, 0.12), frameM); pp.position.set(sx, 1.35, sz); g.add(pp); }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 0.1), glassM); wall.position.set(0, 0.55, -1.55); g.add(wall);
    const wall2 = wall.clone(); wall2.position.z = 1.55; g.add(wall2);
    if (!L.isView3d()) { const hole = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), new THREE.MeshBasicMaterial({ color: 0x020203 })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.04; g.add(hole); }
    else g.add(stairDown(THREE));   /* 3D: 새까만 판 한 장은 «허공» 으로 보였다(문서 220 §12) — 단마다 어두워지는 계단 + 단 모서리 */
    const no = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: numT(e.ref || '?'), toneMapped: false })); no.position.set(-2.6, 3.15, 1.62); g.add(no);
    const no2 = no.clone(); no2.rotation.y = Math.PI; no2.position.z = -1.62; g.add(no2);
    if (broken) { roof.rotation.z = 0.32; roof.position.set(0.6, 1.9, 0); g.children.filter(c => c !== roof && c.position.x > 0 && c.geometry && c.geometry.parameters.height === 2.7).forEach(c => { c.scale.y = 0.55; c.position.y = 0.75; c.rotation.z = 0.2; }); }
    g.position.set(p[0], 0.02, p[1]); g.rotation.y = -along; g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g);
    blockers.push({ x: p[0], z: p[1], hw: 3.1, hd: 1.7, rot: -along }); exitsW.push({ ref: e.ref, p, along }); }

  /* ---------- 신호등 — 아직 전기가 들어온다. 초록불 ---------- */
  const poleM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 });
  function signalPole(p, face) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.6, 8), poleM); pole.position.set(p[0], 2.3, p[1]); pole.castShadow = true; scene.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.3), poleM); box.position.set(p[0], 4.2, p[1]); box.rotation.y = face; scene.add(box);
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), new THREE.MeshBasicMaterial({ color: 0x40ff90, toneMapped: false })); lamp.position.set(p[0] + Math.sin(face) * 0.16, 3.9, p[1] + Math.cos(face) * 0.16); lamp.rotation.y = face; scene.add(lamp);
    blockers.push({ x: p[0], z: p[1], hw: 0.18, hd: 0.18, rot: 0 }); }
  for (const s of osm.signals) { const p = W(s), n = nearestRoad(p); if (!n) continue; const across = n.dir + Math.PI / 2, off = n.rw.width / 2 + 1.2;
    signalPole([n.q[0] + Math.cos(across) * off, n.q[1] + Math.sin(across) * off], -n.dir); }
  /* 보행 신호 — 횡단보도 양끝, 남은 시간 «12» */
  const pedTex = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#080808'; g.fillRect(0, 0, w, h); g.fillStyle = '#40ff90'; g.font = '900 40px sans-serif'; g.textAlign = 'center'; g.fillText('12', w / 2, 52); g.beginPath(); g.arc(w / 2, 90, 12, 0, 7); g.fill(); });

  /* ---------- 멈춘 차: 차선을 지킨 채, 교차로 앞에서 줄지어 («사람들은 마지막까지 신호를 지켰다») ---------- */
  /* 차: 옆모습 윤곽을 폭만큼 밀어 낸다 — 상자보다 «차» 로 읽힌다. 세단·SUV·경차 세 종, 바퀴, 유리 */
  function profileGeo(pts, width, bevel) { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -width / 2); return g; }
  const CAR = {
    sedan: { body: [[-2.3, 0.3], [2.3, 0.3], [2.35, 0.75], [1.4, 0.85], [-1.6, 0.85], [-2.3, 0.78]], glass: [[-1.25, 0.84], [0.95, 0.84], [0.45, 1.35], [-0.9, 1.35]], w: 1.78 },
    suv:   { body: [[-2.35, 0.35], [2.35, 0.35], [2.4, 0.95], [1.55, 1.05], [-2.35, 1.05]], glass: [[-2.2, 1.04], [1.2, 1.04], [0.75, 1.7], [-2.15, 1.7]], w: 1.88 },
    mini:  { body: [[-1.8, 0.3], [1.8, 0.3], [1.85, 0.8], [1.2, 0.9], [-1.8, 0.9]], glass: [[-1.7, 0.89], [0.95, 0.89], [0.55, 1.45], [-1.65, 1.45]], w: 1.6 } };
  const carGeos = {}; for (const [k, c] of Object.entries(CAR)) carGeos[k] = { body: profileGeo(c.body, c.w - 0.12, 0.06), glass: profileGeo(c.glass, c.w - 0.28, 0.05), w: c.w, len: Math.abs(c.body[1][0] - c.body[0][0]) };
  const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14); wheelGeo.rotateX(Math.PI / 2);
  const wheelM = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.8 });
  const busBody = profileGeo([[-5.5, 0.35], [5.5, 0.35], [5.55, 3.0], [-5.5, 3.0]], 2.4, 0.12), busGlass = profileGeo([[-5.0, 1.55], [5.35, 1.55], [5.45, 2.65], [-5.0, 2.65]], 2.46, 0.02);
  const carCols = [0xd8d8dc, 0x1a1a1e, 0x8a8c94, 0x5a1418, 0x1c2a40, 0xe8e8ea, 0x2a2a2e, 0x6a6c72];
  const cabM = new THREE.MeshStandardMaterial({ color: 0x3a4658, roughness: 0.12, metalness: 0.4 });   /* 새까만 유리는 구멍처럼 보였다 — 노을을 받는 유리 */
  const xings = osm.crossings.map(W);
  const endGateP = (CFG.gates || []).filter(g => g.at.end).map(g => FROM(walk[g.at.end] + (g.at.end === 's1' ? -3 : 3), g.at.t === 'road' ? tc : g.at.t === 'center' ? (walk.t0 + walk.t1) / 2 : g.at.t));
  let cars = 0;
  for (const rw of roadsW) { const k = rw.r.kind; if (!['primary', 'primary_link', 'secondary', 'busway'].includes(k)) continue; const lanes = k === 'busway' ? 1 : (rw.r.lanes || 2);
    for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 6) continue; const ux = dx / L, uz = dz / L, dir = Math.atan2(dz, dx);
      for (let ln = 0; ln < lanes; ln++) { const off = -rw.width / 2 + (ln + 0.5) * rw.width / lanes;
        for (let d = 4 + R() * 6; d < L - 4; d += (k === 'busway' ? 34 : 6.4) + (R() < 0.55 ? 10 + R() * 26 : R() * 1.5)) {   /* 절반쯤 비워 사이로 걸어 다닐 틈 */
          const cx = a[0] + ux * d - uz * off, cz = a[1] + uz * d + ux * off, [cs, ct] = ST([cx, cz]); if (cs < walk.s0 - 30 || cs > walk.s1 + 30 || Math.abs(ct - tc) > 60) continue;
          if (exitsW.some(e => Math.hypot(e.p[0] - cx, e.p[1] - cz) < 5)) continue;
          if (endGateP.some(q => Math.hypot(q[0] - cx, q[1] - cz) < 7)) continue;   /* 끝 문 자리는 비운다 — 넓힌 판에서 문 고리 안에 차가 섰다 */
          /* «사람들은 마지막까지 신호를 지켰다» — 횡단보도 위에는 서지 않는다 */
          if (xings.some(x => Math.hypot(x[0] - cx, x[1] - cz) < 7)) continue;
          const g = new THREE.Group();
          if (k === 'busway') { const bm = new THREE.MeshStandardMaterial({ color: R() < 0.5 ? 0x2a6ab0 : 0x3a9a5a, roughness: 0.4, metalness: 0.3 });
            g.add(new THREE.Mesh(busBody, bm), new THREE.Mesh(busGlass, cabM)); for (const x of [-3.6, 3.6]) for (const z of [-1.1, 1.1]) { const w = new THREE.Mesh(wheelGeo, wheelM); w.scale.setScalar(1.5); w.position.set(x, 0.48, z); g.add(w); }
            blockers.push({ x: cx, z: cz, hw: 5.5, hd: 1.3, rot: -dir }); }
          else { const type = R() < 0.55 ? 'sedan' : R() < 0.7 ? 'suv' : 'mini', cg = carGeos[type];
            const bm = new THREE.MeshStandardMaterial({ color: carCols[(R() * carCols.length) | 0], roughness: 0.25, metalness: 0.7 });
            const body = new THREE.Mesh(cg.body, bm); g.add(body); g.add(new THREE.Mesh(cg.glass, cabM));
            for (const x of [-cg.len * 0.32, cg.len * 0.32]) for (const z of [-cg.w / 2 + 0.1, cg.w / 2 - 0.1]) { const w = new THREE.Mesh(wheelGeo, wheelM); w.position.set(x, 0.33, z); g.add(w); }
            for (const [x, c] of [[cg.len / 2 + 0.04, 0xffe8c0], [-cg.len / 2 - 0.04, 0x8a1010]]) for (const z of [-cg.w / 2 + 0.3, cg.w / 2 - 0.3]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: c })); l.position.set(x, 0.66, z); g.add(l); }
            const r = R(); if (r < 0.12) { /* 문이 열린 차 */ const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.05), bm); door.position.set(0.3, 0.62, cg.w / 2 + 0.45); door.rotation.y = -0.9; g.add(door); }
            else if (r < 0.15) { /* 트렁크가 열린 차 — 짐이 반쯤 */ const lid = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, cg.w - 0.2), bm); lid.position.set(-cg.len / 2 + 0.1, 1.3, 0); lid.rotation.z = 1.1; g.add(lid);
              const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.7), new THREE.MeshStandardMaterial({ color: 0x3a2a5a, roughness: 0.6 })); bag.position.set(-cg.len / 2 + 0.6, 0.98, 0.3); g.add(bag); }
            blockers.push({ x: cx, z: cz, hw: 2.3, hd: 1.0, rot: -dir }); }
          g.position.set(cx, 0.0, cz); g.rotation.y = -dir; g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g); cars++; } } } }

  /* ---------- 주황 결정 («외벽을 타고 … 인도 곳곳에 무릎 높이로») ---------- */
  const crysM = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a10, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 });
  const crysGeo = new THREE.OctahedronGeometry(1, 0); crysGeo.scale(0.22, 1, 0.22);
  function cluster(x, z, h, n) { h *= 1.5;   /* 무릎 높이 (원문) — 첫 판은 너무 작아 안 보였다 */ for (let i = 0; i < n; i++) { const m = new THREE.Mesh(crysGeo, crysM); const s = h * (0.5 + R() * 0.6); m.scale.set(1 + R(), s, 1 + R());
      m.position.set(x + (R() - .5) * 0.7, s * 0.6, z + (R() - .5) * 0.7); m.rotation.set((R() - .5) * 0.7, R() * 3, (R() - .5) * 0.7); m.castShadow = true; scene.add(m); } }
  /* 인도: 간선 양 가장자리 바깥 1.6 m, 죽은 가로수 자리 — 8 m 간격, 결정 반 / 죽은 나무 반 */
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1 }); let crystals = 0;
  for (const rw of roadsW) { if (!['primary', 'primary_link'].includes(rw.r.kind)) continue;
    for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 4) continue; const ux = dx / L, uz = dz / L;
      for (let d = 2; d < L; d += 8) for (const side of [-1, 1]) { const off = side * (rw.width / 2 + 1.6), x = a[0] + ux * d - uz * off, z = a[1] + uz * d + ux * off, [s, t] = ST([x, z]);
        if (s < walk.s0 - 20 || s > walk.s1 + 20 || Math.abs(t - tc) > 45) continue; if (exitsW.some(e => Math.hypot(e.p[0] - x, e.p[1] - z) < 4)) continue;
        if (blockers.some(bl => bl.poly && inPoly([x, z], bl.poly))) continue;
        if (R() < 0.5) { cluster(x, z, 0.55, 4 + (R() * 3 | 0)); crystals++; if (crystals % 3 === 0) { const L2 = new THREE.PointLight(0xff7a20, 7, 7, 1.8); L2.position.set(x, 0.8, z); scene.add(L2); lights.push({ x, y: 0.8, z, color: '#ff7a20', intensity: 5, distance: 6 }); } }
        else { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 3.2, 6), trunkM); tr.position.set(x, 1.6, z); tr.castShadow = true; scene.add(tr);
          for (let k = 0; k < 3; k++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 1.4, 5), trunkM); br.position.set(x, 2.6 + k * 0.3, z); br.rotation.set(0.8, R() * 6, 0.5); scene.add(br); } }
        blockers.push({ x, z, hw: 0.35, hd: 0.35, rot: 0 }); } } }
  /* 외벽: 먼 쪽 건물 길 쪽 벽을 타고 오르는 띠 */
  for (const b of builtW) { if (b.near || R() > 0.35) continue; const c = b.pts.reduce((a, p) => [a[0] + p[0] / b.pts.length, a[1] + p[1] / b.pts.length], [0, 0]), st = ST(c); const wf = wallFacing(FROM(st[0], st[1] - 30)); if (!wf || wf.b !== b) continue;
    const top = Math.min(b.full, 6 + R() * 14); for (let y = 0; y < top; y += 0.9) { const k = 1 - y / top; const m = new THREE.Mesh(crysGeo, crysM); m.scale.set(1.2 + R(), 0.6 + R() * 0.6, 1.2 + R());
      const off = (R() - .5) * 2.4 * k + Math.sin(y * 0.7) * 0.8; m.position.set(wf.q[0] + wf.n[0] * 0.2 + (-wf.n[1]) * off, y + 0.4, wf.q[1] + wf.n[1] * 0.2 + wf.n[0] * off); m.rotation.set(R() - .5, R() * 3, R() - .5); scene.add(m); } }
  function inPoly(p, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; }

  /* ---------- 출발점: 사거리 동쪽 인도(12번 출구 앞) ---------- */
  /* ---------- 경계: 걷는 띠 가장자리에서 건물이 막지 않는 곳은 전부 통제선으로 막는다 (디렉터 «못 들어가는 경계를 확실히») ----------
     콘크리트 방호벽 + 철망 + 붉은 띠 + «통제구역» 판. 문(gate) 자리만 비운다. 실제 막는 것은 띠 클램프 — 이건 «보이는» 경계다 */
  const jerseyM = new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.85 }), fenceM = new THREE.MeshStandardMaterial({ color: 0x5a5c62, roughness: 0.4, metalness: 0.7, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const tapeM = new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.6, emissive: 0x3a0806 });
  const jGeo = new THREE.BoxGeometry(2.0, 0.85, 0.5), fGeo = new THREE.PlaneGeometry(2.0, 1.4), postGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), tGeo = new THREE.BoxGeometry(2.0, 0.08, 0.02);
  const warnTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#b8241e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#fff'; g.font = '900 52px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('통제구역', w / 2, h / 2 + 2); });
  const inAnyBuilding = p => builtW.some(b => inPoly(p, b.pts));
  const gatesW = [];
  /* 문은 «맨바닥» 에 — 카메라 시선으로 그 자리를 덮는 것이 없어야 한다. 첫 판은 5번 출구 문이 무너진 지붕 밑(보이는 면 2.0 m)이라
     문에 서면 인물이 지붕에 가려졌다 (tests/map-height.test.cjs). 시선(D) 방향으로 쏘아 맨 처음 닿는 면이 바닥인 가장 가까운 점 */
  const ray = new THREE.Raycaster(), Dv = new THREE.Vector3(0, -Math.sin(PITCH), -Math.cos(PITCH));
  const bareAt = p => { scene.updateMatrixWorld(true); ray.set(new THREE.Vector3(p[0], 0, p[1]).addScaledVector(Dv, -120), Dv); const hit = ray.intersectObjects(scene.children, true).find(h => h.object.visible && !h.object.isLight); return !hit || hit.point.y < 0.12; };
  function clearSpot(st0) { for (const r of [0, 2, 3, 4, 5, 6, 7, 8]) for (let k = 0; k < (r ? 16 : 1); k++) { const a = k / 16 * Math.PI * 2, st = [st0[0] + Math.cos(a) * r, st0[1] + Math.sin(a) * r];
      if (st[1] < walk.t0 + 2 || st[1] > walk.t1 - 2) continue; const ok = [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]].every(([ds, dt]) => bareAt(FROM(st[0] + ds, st[1] + dt))); if (ok) return st; } return st0; }
  for (const g of CFG.gates || []) { let st;
    if (g.at.exit) { const e = exitsW.find(x => x.ref === g.at.exit); if (!e) continue; st = clearSpot(ST(e.p)); }
    else { const sEnd = walk[g.at.end], tt = g.at.t === 'center' ? (walk.t0 + walk.t1) / 2 : g.at.t === 'road' ? tc : g.at.t; st = [sEnd + (g.at.end === 's1' ? -3 : 3), tt]; }
    const p = FROM(st[0], st[1]); gatesW.push({ id: g.id, x: +p[0].toFixed(2), z: +p[1].toFixed(2), r: g.r || 3.2, to: g.to, label: g.label, kind: g.kind || 'zone', st }); }
  function barrier(s, t, ang, sign) { const p = FROM(s, t); const gr = new THREE.Group();
    const j = new THREE.Mesh(jGeo, jerseyM); j.position.y = 0.425; gr.add(j);
    const f = new THREE.Mesh(fGeo, fenceM); f.position.y = 1.55; gr.add(f); const tp = new THREE.Mesh(tGeo, tapeM); tp.position.y = 1.2; gr.add(tp); const tp2 = tp.clone(); tp2.position.y = 2.1; gr.add(tp2);
    for (const x of [-1, 1]) { const po = new THREE.Mesh(postGeo, poleM); po.position.set(x, 1.15, 0); gr.add(po); }
    if (sign) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: warnTex })); sg.position.set(0, 1.5, 0.27); gr.add(sg); const sg2 = sg.clone(); sg2.rotation.y = Math.PI; sg2.position.z = -0.27; gr.add(sg2); }
    gr.position.set(p[0], 0, p[1]); gr.rotation.y = ang; gr.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(gr); }
  const nearGate = (s, t) => gatesW.some(g => g.kind === 'zone' && Math.hypot(g.st[0] - s, g.st[1] - t) < 5);
  let barriers = 0;
  /* 띠 양옆 (t0, t1) — 길 방향으로 */
  for (const t of [walk.t0 - 0.6, walk.t1 + 0.6]) for (let s = walk.s0; s <= walk.s1; s += 2.05) { if (inAnyBuilding(FROM(s, t))) continue; barrier(s, t, SCREEN_ANG, (barriers % 9) === 0); barriers++; }
  /* 띠 양끝 (s0, s1) — 길을 가로질러. 문 자리는 비운다 */
  for (const [end, ds] of [['s0', -0.6], ['s1', 0.6]]) for (let t = walk.t0; t <= walk.t1; t += 2.05) { const s = walk[end] + ds; if (inAnyBuilding(FROM(s, t)) || nearGate(walk[end], t)) continue; barrier(s, t, SCREEN_ANG + Math.PI / 2, (barriers % 5) === 0); barriers++; }
  /* 끝 통제선 큰 판: «통제구역 — ○○ 방면» */
  for (const end of ['s0', 's1']) { const txt = CFG.closed?.[end]; if (!txt) continue; const tex = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#1a1a1e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d83a2a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#ffd8c0'; g.font = '900 46px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2); });
    const tq = walk.t0 + (walk.t1 - walk.t0) * 0.28, p = FROM(walk[end] + (end === 's1' ? 1.2 : -1.2), tq), m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); m.color.setScalar(1.3);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), m); pl.position.set(p[0], 3.0, p[1]); pl.rotation.y = SCREEN_ANG + Math.PI / 2 + (end === 's1' ? Math.PI : 0); scene.add(pl); }
  /* 문 자리 표시(굽는 그림에 들어가는 바닥 표식) — 반짝이는 링은 게임이 그 위에 띄운다 */
  for (const g of gatesW) { if (g.kind !== 'zone') continue; const m = new THREE.Mesh(new THREE.RingGeometry(g.r - 0.25, g.r, 48), new THREE.MeshBasicMaterial({ color: 0x40d8ff, toneMapped: false, transparent: true, opacity: 0.8 })); m.rotation.x = -Math.PI / 2; m.position.set(g.x, 0.05, g.z); scene.add(m); }
  console.info('[env-osm] 통제선', barriers, '문', gatesW.map(g => g.id).join(','));

  /* 출발점: 강남대로 인도에 있는 출구 중 사거리에 가장 가까운 것 옆 (12번은 테헤란로 쪽이라 걷는 띠 밖이었다) */
  const onWalk = exitsW.map(e => ({ e, st: ST(e.p) })).filter(o => o.st[1] > walk.t0 && o.st[1] < walk.t1 && o.st[0] > walk.s0 && o.st[0] < walk.s1).sort((a, c) => Math.abs(a.st[0]) - Math.abs(c.st[0]));
  const near0 = onWalk[0] || { st: [0, 0] }, spawnP = FROM(near0.st[0] + (near0.st[0] > 0 ? -4 : 4), near0.st[1] - Math.sign(near0.st[1] || 1) * 3);
  /* 그림이 덮어야 하는 곳: 걷는 띠 전부 + 먼 쪽 벽 높이 24 m 까지 (그 위는 그림 밖) */
  const extentPts = []; for (let s = walk.s0 - 8; s <= walk.s1 + 8; s += 4) for (let t = walk.t0 - 8; t <= walk.t1 + 10; t += 4) { const p = FROM(s, t); extentPts.push([p[0], 0, p[1]]); if (t > walk.t1 - 2) extentPts.push([p[0], 24, p[1]]); }
  console.info('[env-osm] 건물', builtW.length, '차', cars, '결정', crystals, '간판 빛', signsLit, '출구', exitsW.length);
  return { lights, blockers, gates: gatesW.map(({ st, ...g }) => g), spawn: { x: spawnP[0], z: spawnP[1] }, road: { ang: SCREEN_ANG }, walk, extentPts, sun: { dir: [sunDir.x, sunDir.y, sunDir.z], color: '#ff8a50' }, sky,
    exits: exitsW.map(e => ({ ref: e.ref, x: +e.p[0].toFixed(2), z: +e.p[1].toFixed(2) })), license: osm.license, sunLight: sun };
}

/* 내려가는 계단 착시 (3D, 문서 220 §12): 땅은 못 파니 단 열 개를 입구(−x) 밝게 → 안쪽(+x) 새까맣게, 단 모서리는 조금 밝은 선. 꼭짓점 색 판 하나 = 그리기 1번 */
let STAIR_G = null;
function stairDown(THREE) { if (!STAIR_G) { const pos = [], col = [], c = new THREE.Color(), q = (x0, x1, z0, z1, k) => { c.setScalar(k); for (const [x, z] of [[x0, z0], [x1, z1], [x1, z0], [x0, z0], [x0, z1], [x1, z1]]) { pos.push(x, 0, z); col.push(c.r, c.g, c.b); } };
    for (let i = 0; i < 10; i++) { const x0 = -2.8 + i * 0.56, k = 0.11 * Math.pow(1 - i / 10, 2.2); q(x0, x0 + 0.5, -1.4, 1.4, k); q(x0 + 0.5, x0 + 0.56, -1.4, 1.4, k * 1.7 + 0.008); }
    STAIR_G = new THREE.BufferGeometry(); STAIR_G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); STAIR_G.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); STAIR_G.computeVertexNormals(); }
  const m = new THREE.Mesh(STAIR_G, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })); m.position.y = 0.04; m.name = "stair"; return m; }
