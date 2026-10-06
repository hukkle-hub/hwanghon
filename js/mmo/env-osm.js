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
const CONFIG = { gangnam: { exitPairs: [['2', '7'], ['3', '6'], ['4', '5'], ['10', '11']] } };

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function build(THREE, scene, osm, opt = {}) {
  const R = rng(20261006), lights = [], blockers = [];
  /* ---------- 좌표: OSM 로컬(x 동, z 남) → 회전해 강남대로 축을 화면 대각선 DIR 로, 동쪽(1~6번 출구, 5번 출구 쪽)을 화면 위(먼 쪽)로 ---------- */
  const DIR = new THREE.Vector2(Math.cos(SCREEN_ANG), -Math.sin(SCREEN_ANG)), SIDE = new THREE.Vector2(-Math.sin(SCREEN_ANG), -Math.cos(SCREEN_ANG));
  let rot = 0;
  for (const cand of [-SCREEN_ANG - osm.axis, Math.PI - SCREEN_ANG - osm.axis]) {
    const c = Math.cos(cand), s = Math.sin(cand), [ex, ez] = osm.exits.find(e => e.ref === '5')?.p || [80, 300];
    const wx = ex * c - ez * s, wz = ex * s + ez * c;            /* Ry 와 같은 방향의 2D 회전 (x,z) */
    const t = wx * SIDE.x + wz * SIDE.y; if (t > 0) { rot = cand; break; } }
  const ST = ([x, z]) => [x * DIR.x + z * DIR.y, x * SIDE.x + z * SIDE.y];   /* 월드 → 길 좌표 (s 길 따라, t 건너 +가 먼 쪽) */
  const FROM = (s, t) => [s * DIR.x + t * SIDE.x, s * DIR.y + t * SIDE.y];   /* 길 좌표 → 월드 */
  /* 도로 중심선 보정: 원점은 강남대로 한쪽 차로 위라 띠가 한쪽으로 7~15 m 치우쳤다(2번 출구가 t = −3 m, 차도 한가운데).
     길 양쪽 인도에 마주 선 출구 쌍의 가운데가 중심선이다 — 그 점들이 s 를 따라 평평해지도록 회전을 조금 더 돌리고, 띠를 그 가운데에 둔다 */
  const PAIRS = (opt.exitPairs || CONFIG[osm.zone]?.exitPairs || []).map(([a, b]) => [osm.exits.find(e => e.ref === a), osm.exits.find(e => e.ref === b)]).filter(([a, b]) => a && b);
  const rotAt = r => { const c = Math.cos(r), s = Math.sin(r); return ([x, z]) => [x * c - z * s, x * s + z * c]; };
  const mids = r => PAIRS.map(([a, b]) => { const A = ST(rotAt(r)(a.p)), B = ST(rotAt(r)(b.p)); return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]; });
  let tc = 0;
  if (PAIRS.length >= 2) { let best = null; for (let d = -0.2; d <= 0.2; d += 0.0005) { const m = mids(rot + d), mt = m.reduce((a, p) => a + p[1], 0) / m.length, v = m.reduce((a, p) => a + (p[1] - mt) ** 2, 0); if (!best || v < best.v) best = { v, d, mt }; }
    rot += best.d; tc = best.mt; console.info('[env-osm] 중심선 보정', (best.d * 180 / Math.PI).toFixed(2) + '°', '중심 t', tc.toFixed(1), 'm · 잔차', Math.sqrt(best.v / PAIRS.length).toFixed(1), 'm'); }
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const W = ([x, z]) => [x * cr - z * sr, x * sr + z * cr];                 /* OSM → 월드 */
  const V3 = (p, y = 0) => new THREE.Vector3(p[0], y, p[1]);
  /* 걷는 띠: 사거리 북쪽 55 m 부터 5번 출구 남쪽 18 m 까지, 강남대로 양쪽 인도까지 (t ±30 m) */
  const s5 = ST(W(osm.exits.find(e => e.ref === '5')?.p || [80, 300]))[0];
  const walk = Object.assign(s5 > 0 ? { s0: -55, s1: Math.round(s5 + 18), t0: Math.round(tc - 30), t1: Math.round(tc + 30) } : { s0: Math.round(s5 - 18), s1: 55, t0: Math.round(tc - 30), t1: Math.round(tc + 30) }, opt.walk || {});

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
  const paver = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#4a4648'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 16; x < w; x += 32) { const v = 62 + R() * 22 | 0; g.fillStyle = R() < 0.18 ? `rgb(${v + 30},${v - 8},${v - 12})` : `rgb(${v},${v - 2},${v})`; g.fillRect(x + 1, y + 1, 30, 14); } });
  paver.repeat.set(1 / 4, 1 / 4);
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
  const groundTex = paver.clone(); groundTex.repeat.set(1400 / 4, 1400 / 4);   /* 판 UV 는 0~1 — 4 m 마다 한 장 */
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
    const m = new THREE.Mesh(ribbon(r.line, width, y), mat); m.receiveShadow = true; scene.add(m); roadsW.push({ r, width, pts: r.line.map(W) });
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
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, [near ? cutMat : roofMat, facadeMats[(b.id >>> 3) % 4]]); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    blockers.push({ poly: pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) }); builtW.push({ pts, h, full, near, cst, id: b.id }); }

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
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.8), new THREE.MeshBasicMaterial({ color: 0x020203 })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.04; g.add(hole);
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
  let cars = 0;
  for (const rw of roadsW) { const k = rw.r.kind; if (!['primary', 'primary_link', 'secondary', 'busway'].includes(k)) continue; const lanes = k === 'busway' ? 1 : (rw.r.lanes || 2);
    for (let i = 1; i < rw.pts.length; i++) { const a = rw.pts[i - 1], b = rw.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 6) continue; const ux = dx / L, uz = dz / L, dir = Math.atan2(dz, dx);
      for (let ln = 0; ln < lanes; ln++) { const off = -rw.width / 2 + (ln + 0.5) * rw.width / lanes;
        for (let d = 4 + R() * 6; d < L - 4; d += (k === 'busway' ? 34 : 6.4) + (R() < 0.55 ? 10 + R() * 26 : R() * 1.5)) {   /* 절반쯤 비워 사이로 걸어 다닐 틈 */
          const cx = a[0] + ux * d - uz * off, cz = a[1] + uz * d + ux * off, [cs, ct] = ST([cx, cz]); if (cs < walk.s0 - 30 || cs > walk.s1 + 30 || Math.abs(ct - tc) > 60) continue;
          if (exitsW.some(e => Math.hypot(e.p[0] - cx, e.p[1] - cz) < 5)) continue;
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
  /* 출발점: 강남대로 인도에 있는 출구 중 사거리에 가장 가까운 것 옆 (12번은 테헤란로 쪽이라 걷는 띠 밖이었다) */
  const onWalk = exitsW.map(e => ({ e, st: ST(e.p) })).filter(o => o.st[1] > walk.t0 && o.st[1] < walk.t1 && o.st[0] > walk.s0 && o.st[0] < walk.s1).sort((a, c) => Math.abs(a.st[0]) - Math.abs(c.st[0]));
  const near0 = onWalk[0] || { st: [0, 0] }, spawnP = FROM(near0.st[0] + (near0.st[0] > 0 ? -4 : 4), near0.st[1] - Math.sign(near0.st[1] || 1) * 3);
  /* 그림이 덮어야 하는 곳: 걷는 띠 전부 + 먼 쪽 벽 높이 24 m 까지 (그 위는 그림 밖) */
  const extentPts = []; for (let s = walk.s0 - 8; s <= walk.s1 + 8; s += 4) for (let t = walk.t0 - 8; t <= walk.t1 + 10; t += 4) { const p = FROM(s, t); extentPts.push([p[0], 0, p[1]]); if (t > walk.t1 - 2) extentPts.push([p[0], 24, p[1]]); }
  console.info('[env-osm] 건물', builtW.length, '차', cars, '결정', crystals, '간판 빛', signsLit, '출구', exitsW.length);
  return { lights, blockers, spawn: { x: spawnP[0], z: spawnP[1] }, road: { ang: SCREEN_ANG }, walk, extentPts, sun: { dir: [sunDir.x, sunDir.y, sunDir.z], color: '#ff8a50' }, sky,
    exits: exitsW.map(e => ({ ref: e.ref, x: +e.p[0].toFixed(2), z: +e.p[1].toFixed(2) })), license: osm.license, sunLight: sun };
}
