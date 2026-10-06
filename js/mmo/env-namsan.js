/* 황혼 2D 맵 MMORPG — 남산 (docs/design/185 §2 존 3, §6.6)
   실측: 남산 케이블카 하부역(회현동) → 상부역 → N서울타워. 세 점이 거의 한 줄(방위 약 148°, 약 700 m)이라
   케이블카 선을 길 축(s)으로 삼는다 — 화면 왼쪽 아래 승강장에서 오른쪽 위 타워로 «올라간다».
   맵은 평평하게 굽는다(인물은 늘 y = 0). 산비탈은 숲·옹벽·계단으로만 보여 준다.
   원작 EP04~05 (docs/design/145):
     «반파된 남산타워 전망대 … 난간에 사랑의 자물쇠 수백 개» · «40 m 아래는 붉은 안개로 바닥이 안 보임»
     «놈이 케이블카 와이어에 내려앉으며» · 셀레스티얼 — 선회·정찰, 내려오지 않는다(첫 조우는 후퇴)
     «남산타워 하부 — 깨진 유리, 넘어진 테이블» · 케이블카 드로퍼(천장에서 떨어지는 넷)
   build(THREE, scene, osm) → map.json 재료 (bake-map.html) */
import { frameOf } from './env-osm.js';
export const PITCH = 55 * Math.PI / 180;
const SCREEN_ANG = 28 * Math.PI / 180;
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
/* 타워: N서울타워 (37.55117, 126.98823) — 하부역 원점에서 OSM 로컬 m */
const TOWER_LL = { lat: 37.55117, lon: 126.98823 };

export function build(THREE, scene, osm) {
  const R = rng(20261008), lights = [], blockers = [];
  const KX = 111320 * Math.cos(osm.origin.lat * Math.PI / 180), KZ = 110540;
  const towerO = [(TOWER_LL.lon - osm.origin.lon) * KX, -(TOWER_LL.lat - osm.origin.lat) * KZ];
  const { ST, FROM, W } = frameOf(THREE, osm, { farSide: { sPos: towerO } });
  const tower = W(towerO), [sT] = ST(tower);
  const upper = osm.stations.filter(s => s.p).map(s => ({ ...s, w: W(s.p) })).sort((a, b) => ST(b.w)[0] - ST(a.w)[0])[0];
  const sUp = upper ? ST(upper.w)[0] : sT * 0.8;
  /* 걷는 띠: 하부역 뒤 45 m 부터 타워 광장 끝까지, 케이블카 선 양옆 24 m */
  const walk = { s0: -45, s1: Math.round(sT + 28), t0: -24, t1: 24 };
  const inPoly = (p, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
  const inBand = (p, pad = 0) => { const [s, t] = ST(p); return s > walk.s0 - pad && s < walk.s1 + pad && t > walk.t0 - pad && t < walk.t1 + pad; };

  /* ---------- 하늘·빛: 강남과 같은 황혼, 산바람에 안개가 붉다 ---------- */
  const sky = { top: '#2a1838', horizon: '#7a2a3a', fog: '#3a2238' };
  scene.background = new THREE.Color(sky.fog);
  scene.add(new THREE.HemisphereLight(0xc09ad0, 0x3a2c2a, 3.0));
  const west = W([-1, 0]), sunDir = new THREE.Vector3(west[0], Math.tan(14 * Math.PI / 180), west[1]).normalize();
  const sun = new THREE.DirectionalLight(0xff9a60, 4.2); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);

  /* ---------- 텍스처 ---------- */
  function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); return t; }
  /* 숲 바닥: 낙엽·흙·이끼 — 한 장 4 m */
  const forestTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#2e2622'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const r = R(); g.fillStyle = r < 0.45 ? `rgba(${90 + R() * 50 | 0},${50 + R() * 30 | 0},${30 + R() * 20 | 0},.55)` : r < 0.75 ? `rgba(${40 + R() * 20 | 0},${52 + R() * 24 | 0},${34 + R() * 14 | 0},.6)` : 'rgba(20,16,14,.6)';
      const s = 2 + R() * 4; g.fillRect(R() * w, R() * h, s, s * (0.4 + R())); } });
  forestTex.repeat.set(1 / 4, 1 / 4);
  /* 산책로: 서울 남산 둘레길 — 황토색 포장 + 가장자리 돌 */
  const pathTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#7a6a58'; g.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { const v = 90 + R() * 50 | 0; g.fillStyle = `rgba(${v + 10},${v},${v - 14},.45)`; g.fillRect(R() * w, R() * h, 2, 2); } });
  pathTex.repeat.set(1 / 2, 1 / 2);
  const asphalt = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#34353c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 40 + R() * 34 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},.5)`; g.fillRect(R() * w, R() * h, 2, 2); } });
  asphalt.repeat.set(1 / 8, 1 / 8);
  const paver = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#4c484a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 16; x < w; x += 32) { const v = 66 + R() * 12 | 0; g.fillStyle = `rgb(${v},${v - 2},${v})`; g.fillRect(x + 1, y + 1, 30, 14); } });
  paver.repeat.set(1 / 1.6, 1 / 1.6);

  /* ---------- 땅: 숲 바닥 ---------- */
  const groundTex = forestTex.clone(); groundTex.repeat.set(2000 / 4, 2000 / 4);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  /* ---------- 길: 실측 도로·산책로·계단 ---------- */
  function ribbon(pts, width, y) { const pos = [], idx = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      pos.push(pts[i][0] - dz * width / 2, y, pts[i][1] + dx * width / 2, pts[i][0] + dz * width / 2, y, pts[i][1] - dx * width / 2);
      if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i], pos[i + 2]); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; }
  const roadM = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.4, metalness: 0.2 }), pathM = new THREE.MeshStandardMaterial({ map: pathTex, roughness: 0.85 }), paverM = new THREE.MeshStandardMaterial({ map: paver, roughness: 0.75 });
  const stepM = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.8 }), stepEdgeM = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9 });
  const ROADW = { primary: 7, secondary: 7, tertiary: 6.5, residential: 6, unclassified: 5.5, service: 4.5, living_street: 4.5 };
  const PATHW = { footway: 2.6, path: 2.2, pedestrian: 5, steps: 2.8, cycleway: 2.4, track: 3 };
  const clear = [];   /* 나무를 심지 않는 곳: 길 둘레 */
  for (const r of osm.roads) { if (r.tunnel || r.layer < 0) continue; const pts = r.line.map(W); if (!pts.some(p => inBand(p, 60))) continue;
    let width, mat, y = 0.02;
    if (ROADW[r.kind]) { width = r.width || ROADW[r.kind]; mat = roadM; }
    else if (PATHW[r.kind]) { width = r.width || PATHW[r.kind]; mat = r.kind === 'pedestrian' ? paverM : pathM; y = 0.025; }
    else continue;
    const m = new THREE.Mesh(ribbon(pts, width, y), mat); m.receiveShadow = true; scene.add(m); clear.push({ pts, r: width / 2 + 1.4 });
    /* 계단: 가로 줄 (오르내림을 그림으로) */
    if (r.kind === 'steps') for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.4) continue;
      for (let d = 0.2; d < L; d += 0.42) { const st = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.1), stepEdgeM); st.position.set(a[0] + dx / L * d, 0.05, a[1] + dz / L * d); st.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2; scene.add(st); } } }
  /* 케이블카 선 밑 «등산로» — 실측 산책로가 선을 따라가지 않는 구간도 걸어 오를 수 있게, 선 바로 옆에 계단길을 깐다 (실제로도 선 밑은 숲길) */
  { const pts = []; for (let s = 2; s <= sT - 18; s += 6) { const t = -6 + Math.sin(s / 37) * 3.5; pts.push(FROM(s, t)); }
    const m = new THREE.Mesh(ribbon(pts, 3.2, 0.028), pathM); m.receiveShadow = true; scene.add(m); clear.push({ pts, r: 3.0 });
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (i % 9 < 3) for (let d = 0.2; d < L; d += 0.5) { const st = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.14), stepEdgeM); st.position.set(a[0] + dx / L * d, 0.05, a[1] + dz / L * d); st.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2; scene.add(st); }
      if (i % 4 === 0) for (const side of [-1, 1]) { const q = [a[0] - dz / L * 1.9 * side, a[1] + dx / L * 1.9 * side]; const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), stepEdgeM); post.position.set(q[0], 0.45, q[1]); scene.add(post); } } }
  /* 문·출발점 둘레는 비운다 — 첫 판은 남쪽 문 원 안에 나무가 서 있었다(게임 화면 확인) */
  { const g0 = FROM(walk.s0 + 3, 0), sp0 = FROM(walk.s0 + 9, -3); clear.push({ pts: [g0, g0], r: 6 }, { pts: [sp0, sp0], r: 5 }); }
  const nearClear = (p, pad = 0) => clear.some(c => { for (let i = 1; i < c.pts.length; i++) { const a = c.pts[i - 1], b = c.pts[i], vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1;
    const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / L2)); if (Math.hypot(p[0] - a[0] - u * vx, p[1] - a[1] - u * vz) < c.r + pad) return true; } return false; });

  /* ---------- 건물: 실측 (승강장·옛 매점·타워 하부) ---------- */
  const facade = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#4a4650'; g.fillRect(0, 0, w, h); for (let fy = 0; fy < 4; fy++) for (let fx = 0; fx < 8; fx++) { g.fillStyle = R() < 0.06 ? '#ffcf7a' : '#1a2230'; g.fillRect(fx * 32 + 3, fy * 64 + 10, 26, 44); } });
  facade.repeat.set(1 / 14.4, 1 / 14.4);
  const facadeM = new THREE.MeshStandardMaterial({ map: facade, emissiveMap: facade, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.6 }), roofM = new THREE.MeshStandardMaterial({ color: 0x2a2830, roughness: 0.9 }), cutM = new THREE.MeshStandardMaterial({ color: 0x2c2a32, roughness: 0.95 });
  const builtW = [];
  for (const b of osm.buildings) { if (b.under) continue; const pts = b.poly.map(W); if (pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop(); if (pts.length < 3 || !pts.some(p => inBand(p, 40))) continue;
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]); if (Math.hypot(c[0] - tower[0], c[1] - tower[1]) < 9) continue;   /* 타워 자체는 따로 세운다 */
    let h = b.height || (b.levels ? b.levels * 3.6 : 6 + R() * 6); const near = ST(c)[1] < -2; if (near) h = Math.min(h, 3.6);
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1]))), { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, [near ? cutM : roofM, facadeM]); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    blockers.push({ poly: pts.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) }); builtW.push({ pts, c, h }); clear.push({ pts: [...pts, pts[0]], r: 2.0 }); }
  const inBuilding = p => builtW.some(b => inPoly(p, b.pts));

  /* ---------- 케이블카: 하부역 → 상부역 줄 두 가닥, 멈춘 객차, 떨어진 객차 하나 (EP05 케이블카 드로퍼) ---------- */
  const cableM = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.4, metalness: 0.8 }), pylonM = new THREE.MeshStandardMaterial({ color: 0x6a6c72, roughness: 0.5, metalness: 0.6 });
  const line = (osm.aerialways.find(a => /cable/.test(a.kind)) || { line: [[0, 0], upper ? upper.p : towerO] }).line.map(W).sort((a, b) => ST(a)[0] - ST(b)[0]);
  const lowP = line[0], upP = line.at(-1), sLow = ST(lowP)[0], sHigh = ST(upP)[0];
  const cableAt = (u, side) => { const s = sLow + (sHigh - sLow) * u, t = ST(lowP)[1] + (ST(upP)[1] - ST(lowP)[1]) * u + side * 1.3, y = 9 - Math.sin(Math.PI * u) * 2.2; const p = FROM(s, t); return new THREE.Vector3(p[0], y, p[1]); };
  for (const side of [-1, 1]) { const pts = []; for (let k = 0; k <= 60; k++) pts.push(cableAt(k / 60, side)); const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.05, 5), cableM); tube.castShadow = true; scene.add(tube); }
  for (const u of [0.33, 0.66]) { const p = cableAt(u, 0); const py = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, p.y + 0.8, 8), pylonM); py.position.set(p.x, (p.y + 0.8) / 2, p.z); py.castShadow = true; scene.add(py);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 3.4), pylonM); arm.position.set(p.x, p.y + 0.6, p.z); arm.rotation.y = SCREEN_ANG; scene.add(arm); blockers.push({ x: p.x, z: p.z, hw: 0.7, hd: 0.7, rot: 0 }); }
  const cabinM = new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.4, metalness: 0.3 }), cabinGlass = new THREE.MeshStandardMaterial({ color: 0x2a3a48, roughness: 0.1, metalness: 0.4 });
  function cabin(pos, rotY, tilt) { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 2.0), cabinM); body.position.y = 1.05; g.add(body);
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.8, 1.6), cabinGlass); win.position.y = 1.4; g.add(win); const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 2.2), pylonM); roof.position.y = 2.2; g.add(roof);
    g.position.copy(pos); g.rotation.set(tilt || 0, rotY, (tilt || 0) * 0.6); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g); return g; }
  { const p = cableAt(0.42, -1); cabin(new THREE.Vector3(p.x, p.y - 3.3, p.z), -SCREEN_ANG); const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 4), cableM); hang.position.set(p.x, p.y - 0.6, p.z); scene.add(hang); }
  const dropS = sLow + (sHigh - sLow) * 0.58, dropP = FROM(dropS, 9); cabin(new THREE.Vector3(dropP[0], -0.3, dropP[1]), 0.7, 0.45); blockers.push({ x: dropP[0], z: dropP[1], hw: 1.6, hd: 1.4, rot: 0.7 });
  /* 승강장 간판 */
  const stTex = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#14161c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8b030'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = '#ffe8b0'; g.font = '900 54px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('남산 케이블카', w / 2, h / 2 + 3); });
  for (const sp of [lowP, upP]) { const m = new THREE.MeshBasicMaterial({ map: stTex, toneMapped: false }); m.color.setScalar(1.2); const sg = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), m); const q = FROM(ST(sp)[0], ST(sp)[1] + 6); sg.position.set(q[0], 4.6, q[1]); sg.rotation.y = 0; scene.add(sg);
    const L = new THREE.PointLight(0xffd890, 10, 14, 1.5); L.position.set(q[0], 3.5, q[1] - 2); scene.add(L); lights.push({ x: q[0], y: 3.5, z: q[1] - 2, color: '#ffd890', intensity: 8, distance: 12 }); }

  /* ---------- 타워: 하부 원통 + 꺾인 기둥. 전망대는 무너져 광장에 흩어졌다 · 난간엔 사랑의 자물쇠 ---------- */
  const concM = new THREE.MeshStandardMaterial({ color: 0x6a686e, roughness: 0.75 }), darkConc = new THREE.MeshStandardMaterial({ color: 0x5a5658, roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 8, 40), concM); base.position.set(tower[0], 4, tower[1]); base.castShadow = base.receiveShadow = true; scene.add(base);
  blockers.push({ x: tower[0], z: tower[1], hw: 9.6, hd: 9.6, rot: 0 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 30, 24), concM); shaft.position.set(tower[0], 8 + 15, tower[1]); shaft.castShadow = true; scene.add(shaft);
  /* 꺾인 끝 — 기둥 위가 뜯겨 나갔다 (원작 «반파») */
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, hh = 1 + R() * 3.5; const sh = new THREE.Mesh(new THREE.BoxGeometry(2.6, hh, 0.7), concM); sh.position.set(tower[0] + Math.cos(a) * 3.1, 38 + hh / 2, tower[1] + Math.sin(a) * 3.1); sh.rotation.set((R() - .5) * 0.4, -a + Math.PI / 2, (R() - .5) * 0.3); scene.add(sh); }
  const rebar = new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.6, metalness: 0.7 }); for (let k = 0; k < 10; k++) { const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2 + R() * 2, 4), rebar); rb.position.set(tower[0] + (R() - .5) * 5, 39.5, tower[1] + (R() - .5) * 5); rb.rotation.set((R() - .5) * 0.8, 0, (R() - .5) * 0.8); scene.add(rb); }
  /* 무너진 전망대 조각: 굽은 원판 덩어리가 광장에 박혔다 */
  for (let k = 0; k < 3; k++) { const a = 0.6 + k * 2.1, p = [tower[0] + Math.cos(a) * 15, tower[1] + Math.sin(a) * 15]; const ring = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1.2, 16, 1, true, 0, 0.9), darkConc); ring.material.side = THREE.DoubleSide; ring.position.set(p[0] - Math.cos(a) * 5.5, 0.4, p[1] - Math.sin(a) * 5.5); ring.rotation.set(0.9, a, 0.35); ring.castShadow = true; scene.add(ring); blockers.push({ x: p[0], z: p[1], hw: 2.6, hd: 1.6, rot: a }); }
  for (let k = 0; k < 9; k++) { const a = R() * Math.PI * 2, r = 14 + R() * 10, p = [tower[0] + Math.cos(a) * r, tower[1] + Math.sin(a) * r]; if (!inBand(p, -3)) continue;
    const ch = new THREE.Mesh(new THREE.BoxGeometry(3 + R() * 3, 1 + R() * 1.4, 2 + R() * 2), R() < 0.5 ? concM : darkConc); ch.position.set(p[0], 0.5, p[1]); ch.rotation.set(R() - .5, R() * 3, R() - .5); ch.castShadow = true; scene.add(ch);
    blockers.push({ x: p[0], z: p[1], hw: 2, hd: 1.4, rot: ch.rotation.y }); }
  /* 광장 바닥 + 둘레 난간 (먼 쪽 반원만) — 자물쇠 수백 개 */
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(23, 64), paverM); plaza.rotation.x = -Math.PI / 2; plaza.position.set(tower[0], 0.03, tower[1]); plaza.receiveShadow = true; scene.add(plaza); clear.push({ pts: [tower, tower], r: 24 });
  const railM = new THREE.MeshStandardMaterial({ color: 0x8a8c92, roughness: 0.3, metalness: 0.8 }), lockCols = [0xff3a5a, 0xffd040, 0x40c0ff, 0xff8ad0, 0x60ff90, 0xffffff];
  for (let k = 0; k < 60; k++) { const a = Math.PI * 2 * k / 60, x = tower[0] + Math.cos(a) * 23, z = tower[1] + Math.sin(a) * 23; const [, tt] = ST([x, z]); if (tt < ST(tower)[1] - 4) continue;
    const r = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 0.08), railM); r.position.set(x, 1.1, z); r.rotation.y = -a + Math.PI / 2; scene.add(r);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), railM); post.position.set(x, 0.55, z); scene.add(post);
    for (let j = 0; j < 9; j++) { const lk = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: lockCols[(R() * 6) | 0], roughness: 0.35, metalness: 0.6 })); const u = (R() - .5) * 2.6; lk.position.set(x - Math.sin(a) * u * -1, 0.6 + R() * 0.45, z + Math.cos(a) * u); lk.rotation.y = -a; scene.add(lk); } }
  const tL = new THREE.PointLight(0xff7a5a, 14, 30, 1.3); tL.position.set(tower[0], 10, tower[1] + 6); scene.add(tL); lights.push({ x: tower[0], y: 10, z: tower[1] + 6, color: '#ff7a5a', intensity: 10, distance: 26 });

  /* ---------- 숲: 걷는 띠 안·밖 모두. 길·건물·광장은 비운다 ---------- */
  const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 4.2, 6), canopyG = new THREE.IcosahedronGeometry(1.9, 0), pineG = new THREE.ConeGeometry(1.6, 4.6, 7);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1 }), leafMs = [0x3a3e2a, 0x2c3426, 0x4a3e2c, 0x5a3424].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
  const trees = []; const S0 = walk.s0 - 40, S1 = walk.s1 + 30, T0 = walk.t0 - 26, T1 = walk.t1 + 30;
  for (let s = S0; s < S1; s += 3.4) for (let t = T0; t < T1; t += 3.4) { const p = FROM(s + (R() - .5) * 2.6, t + (R() - .5) * 2.6); if (R() < 0.12) continue;
    if (nearClear(p) || inBuilding(p) || Math.hypot(p[0] - tower[0], p[1] - tower[1]) < 25) continue;
    /* 걷는 띠 안은 드문드문 — 나무 갓(4.7 m)이 인물을 가리면 안 된다. 띠 밖은 빽빽한 숲 벽이 곧 «못 가는 곳» 이다 */
    if (inBand(p, 1) && R() > 0.14) continue; trees.push(p); }
  const nT = trees.length, trunks = new THREE.InstancedMesh(trunkG, trunkM, nT), canopy = leafMs.map(m => new THREE.InstancedMesh(R() < 2 ? canopyG : pineG, m, nT)), pines = new THREE.InstancedMesh(pineG, leafMs[2], nT);
  const mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), cnt = [0, 0, 0, 0]; let np = 0;
  trees.forEach((p, i) => { const k = 0.8 + R() * 0.6; mtx.compose(new THREE.Vector3(p[0], 2.1 * k, p[1]), q4.setFromEuler(e.set((R() - .5) * 0.15, R() * 6, (R() - .5) * 0.15)), new THREE.Vector3(k, k, k)); trunks.setMatrixAt(i, mtx);
    if (R() < 0.3) { mtx.compose(new THREE.Vector3(p[0], 4.6 * k, p[1]), q4.setFromEuler(e.set(0, R() * 6, 0)), new THREE.Vector3(k, k, k)); pines.setMatrixAt(np++, mtx); }
    else { const c = (R() * 4) | 0; mtx.compose(new THREE.Vector3(p[0], 4.7 * k, p[1]), q4.setFromEuler(e.set(R(), R() * 6, R())), new THREE.Vector3(k * (1 + R() * 0.4), k * (0.8 + R() * 0.3), k * (1 + R() * 0.4))); canopy[c].setMatrixAt(cnt[c]++, mtx); }
    if (inBand(p, 1)) blockers.push({ x: +p[0].toFixed(2), z: +p[1].toFixed(2), hw: 0.3, hd: 0.3, rot: 0 }); });
  canopy.forEach((m, c) => { m.count = cnt[c]; }); pines.count = np;
  for (const m of [trunks, pines, ...canopy]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  /* ---------- 경계: 띠 양옆은 나무 난간 + «출입금지» + 그 밖은 붉은 안개 비탈 (원작 «40 m 아래는 붉은 안개») ---------- */
  const woodM = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 }), ropeM = new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.6, emissive: 0x2a0604 });
  const noTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#b8241e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#fff'; g.font = '900 50px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('출입금지', w / 2, h / 2 + 2); });
  const fogTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(200,40,40,0)'); gr.addColorStop(1, 'rgba(200,40,40,.75)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  let fences = 0;
  function fence(s, t, ang, sign) { const p = FROM(s, t); if (inBuilding(p)) return; const g = new THREE.Group();
    for (const x of [-1, 1]) { const po = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.14), woodM); po.position.set(x, 0.6, 0); g.add(po); }
    for (const y of [0.55, 1.05]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.08), y > 1 ? woodM : ropeM); rl.position.y = y; g.add(rl); }
    if (sign) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: noTex })); sg.position.set(0, 0.8, 0.09); g.add(sg); const sg2 = sg.clone(); sg2.rotation.y = Math.PI; sg2.position.z = -0.09; g.add(sg2); }
    g.position.set(p[0], 0, p[1]); g.rotation.y = ang; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); fences++; }
  const gateS0 = FROM(walk.s0 + 3, 0);
  for (const t of [walk.t0 - 0.5, walk.t1 + 0.5]) for (let s = walk.s0; s <= walk.s1; s += 2.1) fence(s, t, SCREEN_ANG, fences % 11 === 0);
  for (const [end, ds] of [['s0', -0.5], ['s1', 0.5]]) for (let t = walk.t0; t <= walk.t1; t += 2.1) { if (end === 's0' && Math.abs(t) < 5) continue; fence(walk[end] + ds, t, SCREEN_ANG + Math.PI / 2, fences % 5 === 0); }
  /* 붉은 안개: 띠 밖 비탈에 깔린 띠 (먼 쪽·가까운 쪽·타워 너머 낭떠러지) */
  const fogM = new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.8 });
  for (const [t0, t1] of [[walk.t1 + 12, walk.t1 + 34], [walk.t0 - 26, walk.t0 - 6]]) { const L = walk.s1 - walk.s0 - 60, c = FROM((walk.s0 + walk.s1) / 2, (t0 + t1) / 2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L, t1 - t0), fogM.clone()); m.rotation.set(-Math.PI / 2, 0, SCREEN_ANG + (t0 < 0 ? Math.PI : 0)); m.position.set(c[0], 0.4, c[1]); m.material.opacity = 0.55; scene.add(m); }
  /* 끝 판: 타워 너머 «낭떠러지 — 붉은 안개» */
  const endTex = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#1a1a1e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d83a2a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#ffd8c0'; g.font = '900 44px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('낭떠러지 — 붉은 안개', w / 2, h / 2 + 2); });
  { const p = FROM(walk.s1 + 1.2, walk.t0 + 8), m = new THREE.MeshBasicMaterial({ map: endTex, toneMapped: false }); m.color.setScalar(1.3); const pl = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), m); pl.position.set(p[0], 2.6, p[1]); pl.rotation.y = SCREEN_ANG + Math.PI / 2 + Math.PI; scene.add(pl); }

  /* ---------- 가로등 (몇몇만 켜짐) · 주황 결정 ---------- */
  const poleM = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.5, metalness: 0.6 });
  const crysM = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a10, emissiveIntensity: 1.6, roughness: 0.15, transparent: true, opacity: 0.88 }), crysGeo = new THREE.OctahedronGeometry(1, 0); crysGeo.scale(0.22, 1, 0.22);
  let lamps = 0;
  for (let s = walk.s0 + 10; s < walk.s1 - 10; s += 24) { const p = FROM(s, -10 + Math.sin(s / 37) * 3.5); if (inBuilding(p)) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 6), poleM); pole.position.set(p[0], 2.1, p[1]); pole.castShadow = true; scene.add(pole); blockers.push({ x: p[0], z: p[1], hw: 0.2, hd: 0.2, rot: 0 });
    const lit = lamps % 3 !== 1; const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: lit ? 0xffe0a0 : 0x3a3a3a, toneMapped: false })); head.position.set(p[0], 4.25, p[1]); scene.add(head);
    if (lit) { const L = new THREE.PointLight(0xffd890, 9, 13, 1.5); L.position.set(p[0], 4, p[1]); scene.add(L); lights.push({ x: p[0], y: 4, z: p[1], color: '#ffd890', intensity: 7, distance: 12 }); } lamps++;
    if (R() < 0.6) { const q = FROM(s + 5, 6 + R() * 10); if (!nearClear(q, -1) && !inBuilding(q)) for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(crysGeo, crysM); const k = 0.5 + R() * 0.7; m.scale.set(1 + R(), k, 1 + R()); m.position.set(q[0] + (R() - .5) * 0.8, k * 0.6, q[1] + (R() - .5) * 0.8); m.rotation.set((R() - .5) * 0.7, R() * 3, (R() - .5) * 0.7); scene.add(m); } } }

  /* ---------- 문 · 보스 · 출발점 ---------- */
  const gTower = FROM(sT + 14, -16), gYeo = FROM(walk.s0 + 14, 16);   /* 타워 뒤편 하부 출입구(보스 구역 밖) · 하부역 옆 공동구 입구 (원작 «여의도 지하 공동구 계통도» L5940) */
  const gates = [ { id: 'south', x: +gateS0[0].toFixed(2), z: +gateS0[1].toFixed(2), r: 3.2, to: { zone: 'gangnam', gate: 'north' }, label: '강남 방면 · 강남대로', kind: 'zone' },
    { id: 'tower', x: +gTower[0].toFixed(2), z: +gTower[1].toFixed(2), r: 2.6, to: { zone: 'namsan_tower', gate: 'out' }, label: '남산타워 하부', kind: 'dungeon' },
    { id: 'yeouido', x: +gYeo[0].toFixed(2), z: +gYeo[1].toFixed(2), r: 2.6, to: { zone: 'yeouido_ug', gate: 'namsan' }, label: '공동구 입구 · 여의도 방면', kind: 'dungeon' } ];
  { const m = new THREE.Mesh(new THREE.RingGeometry(2.95, 3.2, 48), new THREE.MeshBasicMaterial({ color: 0x40d8ff, toneMapped: false, transparent: true, opacity: 0.8 })); m.rotation.x = -Math.PI / 2; m.position.set(gateS0[0], 0.05, gateS0[1]); scene.add(m); }
  const bossP = FROM(sT - 20, ST(tower)[1] - 4);   /* 타워 앞 광장 — 하늘에 떠 있다 */
  const bosses = [ { id: 'celestial', name: '셀레스티얼', title: '내려오지 않는 놈', x: +bossP[0].toFixed(2), z: +bossP[1].toFixed(2), r: 20, place: '타워 광장', model: 'art/3d/part1/celestial_static.glb', h: 4.6, fly: 3.2, canon: 'EP04 남산타워 전망대 — 첫 조우는 후퇴' } ];
  const spawnP = FROM(walk.s0 + 9, -3);
  const extentPts = []; for (let s = walk.s0 - 8; s <= walk.s1 + 8; s += 4) for (let t = walk.t0 - 8; t <= walk.t1 + 10; t += 4) { const p = FROM(s, t); extentPts.push([p[0], 0, p[1]]); if (t > walk.t1 - 2) extentPts.push([p[0], 14, p[1]]); }
  extentPts.push([tower[0], 40, tower[1]]);   /* 타워 기둥이 그림 안에 조금 더 */
  console.info('[env-namsan] 나무', nT, '건물', builtW.length, '난간', fences, '가로등', lamps, '타워 s', sT.toFixed(0), '상부역 s', sUp.toFixed(0));
  return { kind: 'field', title: '남산 · 케이블카 길', lights, blockers, gates, bosses, spawn: { x: spawnP[0], z: spawnP[1] }, road: { ang: SCREEN_ANG }, walk, extentPts,
    sun: { dir: [sunDir.x, sunDir.y, sunDir.z], color: '#ff8a50' }, sky, exits: [], license: osm.license, sunLight: sun };
}
