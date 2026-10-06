/* 황혼 2D 맵 MMORPG — 던전: 강남역 지하상가 B1 (docs/design/185 §6.6)
   리니지 «글루디오 던전» 처럼 필드의 입구(강남역 5번 출구)로 들어가는 별도 지역이다.
   땅 위 강남 맵(js/mmo/env-osm.js)과 같은 좌표틀(frameOf)이라, 땅 밑 상가가 실제 강남대로·사거리 바로 밑에 놓인다.
     중앙부: OSM 실측 «강남역지하쇼핑센터» 윤곽(사거리 둘레 약 144 × 173 m) — 한가운데가 중앙 광장(보스 구역)
     남쪽 팔: 5번 출구 계단에서 강남대로 밑을 따라 북쪽으로 가는 상가 통로
   원작 EP02 §6~§10 (제1부 통합본 L1350~L1480):
     «지하 1층 상가 통로는 허리까지 잠겨 있었다» → 물 높이 0.9 m (구운 높이에 들어가 인물의 허리 아래가 가려진다)
     «천장의 형광등 … 3초 켜짐. 1초 꺼짐» → map.json flicker — 게임이 화면을 깜빡인다
     «깨진 한글 네온 「생맥주」 — 마지막 글자만 살아서 깜빡였다» · «스크린도어 옆에 시 액자» · «전광판 「잠시 후 열차가 도착합니다」»
     «벽에 긁힌 자국 … 세 줄씩, 바닥에서 정확히 같은 높이» · «쇼윈도 리퍼 — 유리 뒤에서 기다린다»
     «중앙 광장 — 지하 1층과 2층을 튼 2층 높이 … 크리스마스 장식 … 뒤집힌 진열대» → 보스 클레이브
   build(THREE, scene, osm, gangnamOsm) → map.json 재료 */
import { frameOf, CONFIG as FIELD } from './env-osm.js';
export const PITCH = 55 * Math.PI / 180;
const SCREEN_ANG = 28 * Math.PI / 180;
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function build(THREE, scene, osm) {
  const R = rng(20261007), lights = [], blockers = [];
  const { ST, FROM, W, tc } = frameOf(THREE, osm, FIELD.gangnam);
  const WATER = 0.9, WALL = 3.4;
  const inPoly = (p, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
  function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); return t; }

  /* ---------- 윤곽: 실측 상가 + 5번 출구까지 통로 ---------- */
  const mallSrc = osm.buildings.find(b => /지하쇼핑센터|지하상가/.test(b.name || ''));
  const mall = mallSrc.poly.map(W); if (mall[0][0] === mall.at(-1)[0] && mall[0][1] === mall.at(-1)[1]) mall.pop();
  const e5 = W(osm.exits.find(e => e.ref === '5').p), [s5, t5] = ST(e5);
  /* 통로: 강남대로 중심선(t = tc) 밑, 폭 14 m (가운데 통로 5 m + 양쪽 가게 4.5 m), 5번 출구 계단에서 상가 남쪽 끝까지 */
  const mallSt = mall.map(ST), mallS0 = Math.min(...mallSt.map(p => p[0])), mallS1 = Math.max(...mallSt.map(p => p[0]));
  const sNear = s5 < 0 ? mallS0 : mallS1, CW = 14;
  const cS0 = Math.min(s5, sNear + (s5 < 0 ? 6 : -6)), cS1 = Math.max(s5, sNear + (s5 < 0 ? 6 : -6));
  const corridor = [[cS0, tc - CW / 2], [cS1, tc - CW / 2], [cS1, tc + CW / 2], [cS0, tc + CW / 2]].map(([s, t]) => FROM(s, t));
  const inside = p => inPoly(p, mall) || inPoly(p, corridor);

  /* ---------- 바닥·물 ---------- */
  const terrazzo = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6a6660'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 80 + R() * 70 | 0; g.fillStyle = `rgba(${v},${v - 4},${v - 10},.6)`; g.fillRect(R() * w, R() * h, 2, 2); }
    g.strokeStyle = 'rgba(30,28,26,.5)'; g.lineWidth = 2; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke(); } });
  const shapeOf = pts => new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
  function flat(pts, mat, y) { const g = new THREE.ShapeGeometry(shapeOf(pts)); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, g.attributes.position.getX(i) / 2.4, g.attributes.position.getY(i) / 2.4);
    const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m); return m; }
  const floorM = new THREE.MeshStandardMaterial({ map: terrazzo, roughness: 0.4, metalness: 0.1 });
  flat(mall, floorM, 0); flat(corridor, floorM, 0.001);
  /* 물: 허리 높이. 탁한 청록, 반사가 있고 바닥이 희미하게 비친다 */
  const waterM = new THREE.MeshStandardMaterial({ color: 0x1c3a40, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.72 });
  flat(mall, waterM, WATER); flat(corridor, waterM, WATER + 0.001);

  /* ---------- 벽: 윤곽을 따라 2 m 조각. 카메라 쪽을 보는 벽은 1 m 로 잘라 안이 보이게 ---------- */
  const wallTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#3e3c40'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2a2e'; g.fillRect(0, h - 20, w, 20); g.fillStyle = 'rgba(90,120,110,.35)'; g.fillRect(0, h * 0.62, w, 6); });
  const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8 }), wallCutM = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
  const walls = [];
  function wallRun(poly, other) { const n = poly.length; let cx = 0, cz = 0; poly.forEach(p => { cx += p[0] / n; cz += p[1] / n; });
    for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.3) continue; const k = Math.max(1, Math.round(L / 2));
      let nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }   /* 바깥 법선 */
      for (let j = 0; j < k; j++) { const u0 = j / k, u1 = (j + 1) / k, p0 = [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0], p1 = [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1];
        const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]; if (other && inPoly([m[0] - nx * 0.3, m[1] - nz * 0.3], other) && inPoly([m[0] + nx * 0.6, m[1] + nz * 0.6], other)) continue;   /* 두 윤곽이 이어지는 곳은 벽 없음 */
        const cut = nz > 0.35, h = cut ? 1.0 : WALL, seg = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const w = new THREE.Mesh(new THREE.BoxGeometry(seg + 0.05, h, 0.35), cut ? wallCutM : wallM); w.position.set(m[0] + nx * 0.17, h / 2, m[1] + nz * 0.17); w.rotation.y = -Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
        w.castShadow = true; w.receiveShadow = true; scene.add(w); walls.push({ m, n: [nx, nz], dir: [(p1[0] - p0[0]) / seg, (p1[1] - p0[1]) / seg], cut, seg });
        blockers.push({ x: m[0] + nx * 0.17, z: m[1] + nz * 0.17, hw: seg / 2 + 0.03, hd: 0.25, rot: w.rotation.y }); } } }
  wallRun(mall, corridor); wallRun(corridor, mall);

  /* ---------- 가게: 벽을 따라 4.5 m 깊이. 쇼윈도(유리 뒤 «무언가»), 내린 셔터, 간판 ---------- */
  const glassM = new THREE.MeshStandardMaterial({ color: 0x3a5a66, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.38 });
  const shutterTex = canvasTex(128, 128, (g, w, h) => { for (let y = 0; y < h; y += 8) { g.fillStyle = y % 16 ? '#7a7a80' : '#5a5a60'; g.fillRect(0, y, w, 8); } });
  const shutterM = new THREE.MeshStandardMaterial({ map: shutterTex, roughness: 0.5, metalness: 0.6 });
  const shopFloorM = new THREE.MeshStandardMaterial({ color: 0x3a3634, roughness: 0.8 }), shelfM = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.7 });
  const lurkM = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.9, emissive: 0x2a0806 });
  const SIGNS = [['옷가게', '#ff4fd8'], ['구두', '#ffd23a'], ['화장품', '#ff8ac8'], ['액세서리', '#39e0ff'], ['휴대폰', '#39a0ff'], ['분식', '#ff8a3a'], ['안경', '#4cff9a'], ['가방', '#ffd23a'], ['꽃집', '#ff6a8a'], ['편의점', '#4cff9a']];
  const signTex = {}; const signT = (txt, col, mode) => signTex[txt + col + mode] || (signTex[txt + col + mode] = canvasTex(256, 80, (g, w, h) => {
    g.fillStyle = '#0a0a0e'; g.fillRect(0, 0, w, h); g.font = '900 50px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (mode === 'beer') { const chars = ['생', '맥', '주'], xs = [w / 2 - 62, w / 2, w / 2 + 62]; chars.forEach((c, i) => { const on = i === 2; g.shadowColor = col; g.shadowBlur = on ? 18 : 0; g.fillStyle = on ? col : '#3a2a2a'; g.fillText(c, xs[i], h / 2 + 2); }); return; }
    g.shadowColor = col; g.shadowBlur = 14; g.fillStyle = col; g.fillText(txt, w / 2, h / 2 + 2); }));
  const plazaC = FROM(0, tc), PLAZA_R = 19;   /* 중앙 광장: 사거리 바로 밑 */
  let shops = 0, lurkers = [], signLights = 0;
  /* 가게 한 칸: c 중심, face = 통로 쪽(밖) 단위 법선. 로컬 +z 가 통로, -z 가 뒷벽. low = 카메라 쪽을 보는 가게(벽을 1 m 로) */
  function shop(c, face, low) {
    const g = new THREE.Group(), width = 3.9, hh = low ? 1.0 : 2.9;
    const fl = new THREE.Mesh(new THREE.BoxGeometry(width, 0.06, 4.4), shopFloorM); fl.position.set(0, 0.03, 0); g.add(fl);
    for (const sx of [-width / 2, width / 2]) { const pw = new THREE.Mesh(new THREE.BoxGeometry(0.2, hh, 4.4), wallM); pw.position.set(sx, hh / 2, 0); g.add(pw); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(width, low ? 1.0 : 3.4, 0.2), wallM); back.position.set(0, (low ? 1.0 : 3.4) / 2, -2.2); g.add(back);
    const r = R();
    if (r < 0.3) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(width, low ? 1.0 : 2.7), shutterM); sh.position.set(0, (low ? 1.0 : 2.7) / 2, 2.2); g.add(sh); }
    else { const gl = new THREE.Mesh(new THREE.BoxGeometry(width, low ? 1.0 : 2.6, 0.06), glassM); gl.position.set(0, (low ? 1.0 : 2.6) / 2, 2.2); g.add(gl);
      for (let k = 0; k < 2; k++) { const s2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.5), shelfM); s2.position.set(-0.9 + k * 1.8, 0.7, -1.4); g.add(s2); }
      if (r > 0.82) { /* 쇼윈도 리퍼 자리 — 유리 뒤 웅크린 그림자 (원작 «유리 뒤에서 지나가는 것을 기다린다») */
        const lk = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 8), lurkM); lk.position.set(0, 0.9, 1.2); lk.rotation.z = 0.5; g.add(lk); lurkers.push(1); } }
    if (!low) { const [txt, col] = SIGNS[(R() * SIGNS.length) | 0], lit = R() < 0.4, beer = shops === 6;
      const m = new THREE.MeshBasicMaterial({ map: signT(beer ? '생맥주' : txt, beer ? '#ffb040' : col, beer ? 'beer' : ''), toneMapped: false }); m.color.setScalar(lit || beer ? 1.5 : 0.25);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), m); sg.position.set(0, 3.0, 2.25); g.add(sg);
      if (lit || beer) { const lp = [c[0] + face[0] * 3.3, c[1] + face[1] * 3.3], hex = beer ? '#ffb040' : col; const L = new THREE.PointLight(new THREE.Color(hex), 7, 8, 1.6); L.position.set(lp[0], 2.6, lp[1]); scene.add(L); signLights++;
        lights.push({ x: lp[0], y: 2.6, z: lp[1], color: hex, intensity: 5, distance: 7 }); } }
    const rot = Math.atan2(face[0], face[1]); g.position.set(c[0], 0, c[1]); g.rotation.y = rot;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g); shops++;
    blockers.push({ x: c[0], z: c[1], hw: width / 2, hd: 2.25, rot }); }
  /* 벽을 따라 늘어선 가게 */
  for (let i = 0; i < walls.length; i += 2) { const w = walls[i]; const c = [w.m[0] - w.n[0] * 2.4, w.m[1] - w.n[1] * 2.4];
    if (Math.hypot(c[0] - plazaC[0], c[1] - plazaC[1]) < PLAZA_R + 4) continue; if (!inside([w.m[0] - w.n[0] * 4.6, w.m[1] - w.n[1] * 4.6])) continue;
    shop(c, [-w.n[0], -w.n[1]], w.cut); }
  /* 가운데 섬: 상가 안쪽은 «등을 맞댄 가게 두 줄» 섬이 바둑판으로 놓이고 그 사이가 골목이다.
     큰 통로 둘 — 강남대로 밑(t = tc, 폭 8 m) · 테헤란로 밑(s = 0, 폭 8 m) — 은 비운다. 섬 8 × 9 m, 골목 5 m */
  const sDir = [Math.cos(SCREEN_ANG), -Math.sin(SCREEN_ANG)], tDir = [-Math.sin(SCREEN_ANG), -Math.cos(SCREEN_ANG)];
  const edgeDist = p => { let d = 1e9; for (let i = 0; i < mall.length; i++) { const a = mall[i], b = mall[(i + 1) % mall.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); d = Math.min(d, Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dz)); } return d; };
  const islands = [], IS = 13, IT = 14;
  for (let a = -8; a <= 8; a++) for (let b = -8; b <= 8; b++) { if (!a || !b) continue;
    const sc = Math.sign(a) * (8 + (Math.abs(a) - 1) * IS), tcc = tc + Math.sign(b) * (8.5 + (Math.abs(b) - 1) * IT);
    const corners = [[-4, -4.5], [4, -4.5], [4, 4.5], [-4, 4.5], [0, 0]].map(([ds, dt]) => FROM(sc + ds, tcc + dt));
    if (!corners.every(p => inPoly(p, mall) && edgeDist(p) > 5.6)) continue;
    const ctr = FROM(sc, tcc); if (Math.hypot(ctr[0] - plazaC[0], ctr[1] - plazaC[1]) < PLAZA_R + 8) continue;
    islands.push({ s: sc, t: tcc });
    for (const side of [-1, 1]) for (const ds of [-2, 2]) { const face = [tDir[0] * side, tDir[1] * side]; shop(FROM(sc + ds, tcc + side * 2.25), face, face[1] > 0.35); } }
  const inIsland = p => { const [s, t] = ST(p); return islands.some(I => Math.abs(s - I.s) < 4.6 && Math.abs(t - I.t) < 5.1); };

  /* ---------- 기둥 · 벽의 세 줄 긁힘 · 형광등 빛웅덩이 ---------- */
  const pillarM = new THREE.MeshStandardMaterial({ color: 0x5a5854, roughness: 0.7 });
  const scratchTex = canvasTex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(20,10,8,.9)'; g.lineWidth = 7; g.lineCap = 'round'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(20, 30 + k * 26); g.lineTo(236, 42 + k * 26); g.stroke(); } });
  const scratchM = new THREE.MeshBasicMaterial({ map: scratchTex, transparent: true, depthWrite: false });
  for (let i = 5; i < walls.length; i += 23) { const w = walls[i]; if (w.cut) continue; for (const dy of [0, 0.06]) { const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), scratchM); sc.position.set(w.m[0] - w.n[0] * 0.02, 1.7 + dy, w.m[1] - w.n[1] * 0.02); sc.rotation.y = Math.atan2(-w.n[0], -w.n[1]); scene.add(sc); } }
  let fluo = 0;
  const fluoAt = p => { const L = new THREE.PointLight(0xdff4ff, 16, 15, 1.4); L.position.set(p[0], 3.2, p[1]); scene.add(L); lights.push({ x: p[0], y: 3.2, z: p[1], color: '#dff4ff', intensity: 12, distance: 13 }); fluo++;
    const tube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.14), new THREE.MeshBasicMaterial({ color: 0xeaf8ff, toneMapped: false })); tube.position.set(p[0], 3.3, p[1]); tube.rotation.y = SCREEN_ANG; scene.add(tube); };
  for (let s = cS0 + 6; s < cS1; s += 14) { fluoAt(FROM(s, tc));
    for (const side of [-1, 1]) { const q = FROM(s + 7, tc + side * 2.6); if (!inside(q)) continue; const pl = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.4, 0.7), pillarM); pl.position.set(q[0], 1.7, q[1]); pl.castShadow = true; scene.add(pl); blockers.push({ x: q[0], z: q[1], hw: 0.35, hd: 0.35, rot: 0 }); } }
  /* 상가 안: 골목 교차점·큰 통로마다 형광등 (광장은 따로) */
  const lanes = (step, first) => { const v = [0]; for (let k = 0; k < 8; k++) v.push(first + k * step, -(first + k * step)); return v; };
  for (const sq of lanes(IS, 14.5)) for (const dt of lanes(IT, 15.5)) { const p = FROM(sq, tc + dt);
    if (!inPoly(p, mall) || edgeDist(p) < 4.8 || inIsland(p) || Math.hypot(p[0] - plazaC[0], p[1] - plazaC[1]) < PLAZA_R + 2) continue; fluoAt(p); }

  /* ---------- 중앙 광장: 2층 높이로 튼 공간, 크리스마스 장식, 뒤집힌 진열대, 생존자 바리케이드 ---------- */
  const voidM = new THREE.MeshStandardMaterial({ map: terrazzo, color: 0x8a8890, roughness: 0.6 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(PLAZA_R, PLAZA_R + 0.5, 64), new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.6 })); ring.rotation.x = -Math.PI / 2; ring.position.set(plazaC[0], 0.01, plazaC[1]); scene.add(ring);
  /* 위층 난간 — 광장 둘레 반원(먼 쪽)만, 카메라 쪽은 비운다 */
  for (let k = 0; k < 40; k++) { const a = Math.PI * (k / 39) + Math.PI, x = plazaC[0] + Math.cos(a) * (PLAZA_R + 1.5), z = plazaC[1] + Math.sin(a) * (PLAZA_R + 1.5);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0xa0a4ac, roughness: 0.3, metalness: 0.8 })); rail.position.set(x, 5.2, z); rail.rotation.y = -a + Math.PI / 2; scene.add(rail);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.35, 3.0), voidM); slab.position.set(x + Math.cos(a) * 1.6, 4.9, z + Math.sin(a) * 1.6); slab.rotation.y = -a + Math.PI / 2; slab.castShadow = true; scene.add(slab); }
  /* 크리스마스 장식 — 2년 전 12월에 걸린 그대로 */
  const bulbCols = [0xff3a3a, 0x40ff80, 0xffd040, 0x4aa0ff, 0xff6ad0];
  /* 위에서 보면 전구가 바닥에 흩뿌린 색종이처럼 보였다(게임 화면 확인) — 줄(전선)을 같이 그리고 전구는 작고 성기게 */
  const wireM = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  for (let k = 0; k < 5; k++) { const a0 = Math.PI * 2 * k / 5 + 0.3, a1 = a0 + Math.PI * 0.8, p0 = [plazaC[0] + Math.cos(a0) * PLAZA_R, plazaC[1] + Math.sin(a0) * PLAZA_R], p1 = [plazaC[0] + Math.cos(a1) * PLAZA_R, plazaC[1] + Math.sin(a1) * PLAZA_R];
    const wp = []; for (let u = 0; u <= 1.0001; u += 0.02) wp.push(new THREE.Vector3(p0[0] + (p1[0] - p0[0]) * u, 7.2 - Math.sin(Math.PI * u) * 2.2, p0[1] + (p1[1] - p0[1]) * u));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wp), 60, 0.025, 4), wireM));
    for (let u = 0.03; u <= 0.98; u += 0.065) { const x = p0[0] + (p1[0] - p0[0]) * u, z = p0[1] + (p1[1] - p0[1]) * u, y = 7.1 - Math.sin(Math.PI * u) * 2.2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: bulbCols[(k + Math.round(u * 15)) % 5], toneMapped: false })); b.position.set(x, y, z); scene.add(b); } }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: 0xffd860, toneMapped: false })); star.position.set(plazaC[0], 7.8, plazaC[1]); scene.add(star);
  { const L = new THREE.PointLight(0xffd8a0, 18, 26, 1.4); L.position.set(plazaC[0], 6.5, plazaC[1]); scene.add(L); lights.push({ x: plazaC[0], y: 6.5, z: plazaC[1], color: '#ffd8a0', intensity: 18, distance: 26 }); }
  /* 뒤집힌 진열대 (원작 «진열대가 통째로 날아갔다») */
  for (let k = 0; k < 9; k++) { const a = R() * Math.PI * 2, r = 5 + R() * (PLAZA_R - 7), x = plazaC[0] + Math.cos(a) * r, z = plazaC[1] + Math.sin(a) * r;
    const st2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.9), shelfM); st2.position.set(x, 0.45, z); st2.rotation.set(R() * 0.6 - 0.3, R() * 3, Math.PI / 2 * (R() < 0.5 ? 1 : 0.4)); st2.castShadow = true; scene.add(st2); blockers.push({ x, z, hw: 1.2, hd: 0.6, rot: st2.rotation.y }); }
  /* 생존자 바리케이드 — 광장 남쪽 가장자리(통로에서 들어오는 쪽) */
  for (let k = -3; k <= 3; k++) { const p = FROM(-(PLAZA_R - 3) * Math.sign(s5 || -1) * -1 + 0, tc + k * 2.2); const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 0.6), shelfM); bar.position.set(p[0], 0.65, p[1]); bar.rotation.y = SCREEN_ANG + Math.PI / 2 + (R() - .5) * 0.3; bar.castShadow = true; scene.add(bar); }
  /* 스크린도어 + 시 액자 + 전광판 «잠시 후 열차가 도착합니다» — 광장 북쪽(2호선 승강장 쪽) */
  const sdP = FROM(PLAZA_R + 3 + 0 * s5, tc), sdAng = SCREEN_ANG + Math.PI / 2;
  const sdM = new THREE.MeshStandardMaterial({ color: 0x5a7a88, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.45 }), sdFrame = new THREE.MeshStandardMaterial({ color: 0xd8b030, roughness: 0.4, emissive: 0x302000 });
  for (let k = -3; k <= 3; k++) { const q = [sdP[0] + Math.cos(-sdAng) * k * 1.9, sdP[1] + Math.sin(-sdAng) * k * 1.9];
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.3, 0.08), sdM); d.position.set(q[0], 1.15, q[1]); d.rotation.y = sdAng; scene.add(d);
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.08, 0.1), sdFrame); f.position.set(q[0], 2.3, q[1]); f.rotation.y = sdAng; scene.add(f); }
  blockers.push({ x: sdP[0], z: sdP[1], hw: 7, hd: 0.3, rot: sdAng });
  const boardTex = canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#060606'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff8a30'; g.shadowColor = '#ff8a30'; g.shadowBlur = 10; g.font = '700 40px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('잠시 후 열차가 도착합니다', w / 2, h / 2 + 2); });
  const bm = new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }); bm.color.setScalar(1.4); const board = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.0), bm); board.position.set(sdP[0], 3.1, sdP[1]); board.rotation.y = sdAng + Math.PI; scene.add(board);
  const poemTex = canvasTex(128, 160, (g, w, h) => { g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, w, h); g.strokeStyle = '#6a5a3a'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#3a3226'; for (let k = 0; k < 7; k++) g.fillRect(22, 30 + k * 16, 60 + (k * 13) % 24, 4); });
  const poem = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshBasicMaterial({ map: poemTex })); const pq = [sdP[0] + Math.cos(-sdAng) * 7.6, sdP[1] + Math.sin(-sdAng) * 7.6]; poem.position.set(pq[0], 1.6, pq[1]); poem.rotation.y = sdAng + Math.PI; scene.add(poem);

  /* ---------- 5번 출구 계단 (땅 위로 가는 문) — 원작 «반쯤 무너져 있었다» ---------- */
  const stairP = FROM(s5 + (s5 < 0 ? 3 : -3), tc), stairAng = SCREEN_ANG;
  for (let k = 0; k < 8; k++) { const st3 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18 + k * 0.22, 5.5), new THREE.MeshStandardMaterial({ color: 0x6a6660, roughness: 0.7 })); const q = FROM(s5 + (s5 < 0 ? -k * 0.45 : k * 0.45), tc);
    st3.position.set(q[0], (0.18 + k * 0.22) / 2, q[1]); st3.rotation.y = stairAng; st3.castShadow = true; scene.add(st3); }
  const fallen = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.25, 3.0), new THREE.MeshStandardMaterial({ color: 0x4a4c54, roughness: 0.5, metalness: 0.5 })); const fq = FROM(s5 + (s5 < 0 ? -2 : 2), tc + 1.5); fallen.position.set(fq[0], 1.6, fq[1]); fallen.rotation.set(0.1, stairAng, 0.35); fallen.castShadow = true; scene.add(fallen);
  const daylight = new THREE.PointLight(0xc89ad8, 14, 14, 1.4); const dq = FROM(s5 + (s5 < 0 ? -3 : 3), tc); daylight.position.set(dq[0], 4, dq[1]); scene.add(daylight); lights.push({ x: dq[0], y: 4, z: dq[1], color: '#c89ad8', intensity: 14, distance: 14 });
  const upP = FROM(s5 + (s5 < 0 ? 5 : -5), tc);
  const gateRing = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.2, 48), new THREE.MeshBasicMaterial({ color: 0x40d8ff, toneMapped: false, transparent: true, opacity: 0.8 })); gateRing.rotation.x = -Math.PI / 2; gateRing.position.set(upP[0], WATER + 0.02, upP[1]); scene.add(gateRing);
  /* 2호선 승강장 쪽 — 지금은 셔터로 막힘 (EP03 «2호선 침수 선로», 다음 층) */
  const b2P = [sdP[0] + Math.cos(-sdAng) * 10.5, sdP[1] + Math.sin(-sdAng) * 10.5]; const b2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.8), shutterM); b2.position.set(b2P[0], 1.4, b2P[1]); b2.rotation.y = sdAng + Math.PI; scene.add(b2);

  /* ---------- 빛: 지하는 어둡다 ---------- */
  scene.background = new THREE.Color(0x040406);
  scene.add(new THREE.HemisphereLight(0x9ab0c0, 0x1a1816, 2.2));
  const key = new THREE.DirectionalLight(0xbfd8e8, 1.1); key.position.set(-3, 10, 4); scene.add(key);

  /* ---------- 지역 메타 ---------- */
  const allSt = [...mall, ...corridor].map(ST), s0 = Math.min(...allSt.map(p => p[0])) - 1, s1 = Math.max(...allSt.map(p => p[0])) + 1, t0 = Math.min(...allSt.map(p => p[1])) - 1, t1 = Math.max(...allSt.map(p => p[1])) + 1;
  const extentPts = []; for (let s = s0; s <= s1; s += 3) for (let t = t0; t <= t1; t += 3) { const p = FROM(s, t); if (!inside(p) && !inside(FROM(s + 3, t)) && !inside(FROM(s, t + 3))) continue; extentPts.push([p[0], 0, p[1]], [p[0], 8, p[1]]); }
  console.info('[env-dungeon] 가게', shops, '섬', islands.length, '쇼윈도 리퍼', lurkers.length, '벽', walls.length, '형광등', fluo, '빛', lights.length);
  return { kind: 'dungeon', title: '강남역 지하상가 B1', lights, blockers, extentPts, road: { ang: SCREEN_ANG }, walk: { s0, s1, t0, t1 },
    spawn: { x: upP[0], z: upP[1] }, sky: { fog: '#040406' }, sun: { dir: [-0.3, 0.9, 0.3], color: '#bfd8e8' }, water: { y: WATER },
    flicker: { on: 3, off: 1 },   /* 원작 «3초 켜짐. 1초 꺼짐» */
    gates: [ { id: 'up5', x: +upP[0].toFixed(2), z: +upP[1].toFixed(2), r: 3.2, to: { zone: 'gangnam', gate: 'exit5' }, label: '강남역 5번 출구 · 지상', kind: 'zone' } ],
    bosses: [ { id: 'clave', name: '클레이브', title: '셔터 끄는 놈', x: +plazaC[0].toFixed(2), z: +plazaC[1].toFixed(2), r: PLAZA_R, place: '중앙 광장', model: 'art/3d/part1/clave.glb', h: 3.2, canon: 'EP02 §10 중앙 광장' } ],
    exits: [], license: osm.license };
}
