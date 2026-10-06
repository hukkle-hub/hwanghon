/* 황혼 2D 맵 MMORPG — 강남대로 블록 원본 장면 (docs/design/185 §6)
   이 3D 장면은 «맵 그림을 굽기 위한 원본» 이다. 게임은 이것을 그리지 않고, 고정 카메라 각도에서 구운
   2D 타일(색 + 깊이)만 깐다 — tools/2d/bake-map.html. 실제 제작에서는 이 자리에 원화가 그린 그림이 온다.
   build(THREE, scene) → { lights, blockers, spawn, bounds } : 캐릭터 조명·충돌은 게임이 같은 값을 쓴다. */
export const PITCH = 55 * Math.PI / 180;      /* 와일드리프트식 내려다보는 각 */
export const BOUNDS = { x0: -19, x1: 19, z0: -19, z1: 19 };

export function build(THREE, scene) {
  const lights = [], blockers = [];
  /* 길 방향: 화면 왼쪽 아래 → 오른쪽 위 대각선 (문서 185 §6.1 «거리는 대각선으로») */
  const ANG = 28 * Math.PI / 180, DIR = new THREE.Vector3(Math.cos(ANG), 0, -Math.sin(ANG)), SIDE = new THREE.Vector3(-Math.sin(ANG), 0, -Math.cos(ANG));
  /* 길 좌표: s = 길 따라, t = 길 건너(+ 가 화면 위쪽 = 먼 쪽 인도) */
  const P = (s, t, y = 0) => new THREE.Vector3().addScaledVector(DIR, s).addScaledVector(SIDE, t).setY(y);
  const ROT = ANG;    /* 길을 따라 놓는 상자의 y 회전 (Ry(ANG) 이 x 축을 DIR 로 보낸다) */
  function block(s, t, w, d, rot = ROT) { const c = P(s, t); blockers.push({ x: c.x, z: c.z, hw: w / 2, hd: d / 2, rot }); }

  /* ---------- 땅 ---------- */
  function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); } return t; }
  const asphalt = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#16171c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) { const v = 16 + Math.random() * 26 | 0; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; for (let i = 0; i < 18; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - .5) * 120; y += (Math.random() - .5) * 120; g.lineTo(x, y); } g.stroke(); } }, 8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.3, metalness: 0.25, color: 0x9a9aa6 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  /* 차선 */
  const laneM = new THREE.MeshStandardMaterial({ color: 0xb8a670, roughness: 0.6, emissive: 0x2a2208 });
  for (let i = -12; i <= 12; i++) for (const t of [-2.2, 2.2]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.14), laneM); l.rotation.x = -Math.PI / 2; l.rotation.z = ANG; l.position.copy(P(i * 3.4, t, 0.006)); scene.add(l); }
  { const c = new THREE.Mesh(new THREE.PlaneGeometry(90, 0.12), new THREE.MeshStandardMaterial({ color: 0xc89a3a, roughness: 0.6, emissive: 0x3a2808 })); c.rotation.x = -Math.PI / 2; c.rotation.z = ANG; c.position.copy(P(0, 0, 0.007)); scene.add(c); }
  /* 웅덩이 — 젖은 길 */
  const puddleM = new THREE.MeshStandardMaterial({ color: 0x3a4a66, roughness: 0.02, metalness: 0.0, emissive: 0x0c1428 });   /* 검은 구멍처럼 보이지 않게 하늘빛을 조금 */
  for (const [s, t, r] of [[-6, -1.6, 1.0], [4, 3.2, 0.8], [9, -3.4, 1.3], [-12, 2.8, 0.9], [14, 1.0, 0.7], [-2, -4.4, 0.7]]) {
    const pd = new THREE.Mesh(new THREE.CircleGeometry(r, 32), puddleM); pd.rotation.x = -Math.PI / 2; pd.position.copy(P(s, t, 0.009)); pd.scale.set(1.6, 0.8, 1); pd.rotation.z = ANG; scene.add(pd); }
  /* 인도 (양쪽) */
  const walkM = new THREE.MeshStandardMaterial({ color: 0x2c2d33, roughness: 0.5, metalness: 0.12 });
  for (const t of [8.2, -8.2]) { const w = new THREE.Mesh(new THREE.BoxGeometry(90, 0.18, 4.4), walkM); w.position.copy(P(0, t, 0.09)); w.rotation.y = ROT; w.receiveShadow = true; scene.add(w); }

  /* 인도 경계 네온 띠 — 길의 테두리가 밤에도 읽히게 */
  for (const [t, c] of [[6.0, 0x30d0ff], [-6.0, 0xff3a8a]]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(90, 0.05, 0.08), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    strip.position.copy(P(0, t, 0.2)); strip.rotation.y = ROT; scene.add(strip); }
  /* ---------- 간판 (한글 네온) ---------- */
  function neonTex(text, color, w = 512, h = 160, font = 96) { return canvasTex(w, h, g => {
    g.fillStyle = 'rgba(6,6,10,0.92)'; g.fillRect(0, 0, w, h); g.strokeStyle = color; g.lineWidth = 6; g.globalAlpha = .55; g.strokeRect(8, 8, w - 16, h - 16); g.globalAlpha = 1;
    g.font = '900 ' + font + 'px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 26; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 4); g.shadowBlur = 8; g.fillStyle = '#fff'; g.globalAlpha = .85; g.fillText(text, w / 2, h / 2 + 4); }); }
  function sign(text, color, s, t, y, w, h) { const m = new THREE.MeshBasicMaterial({ map: neonTex(text, color), toneMapped: false }); m.color.setScalar(1.6);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.copy(P(s, t, y)); p.rotation.y = ROT; scene.add(p);
    /* 간판 빛: 굽는 그림의 바닥·벽을 물들이고, 게임에서는 같은 자리 빛이 지나가는 캐릭터를 물들인다 */
    const lp = P(s, t - 1.2, y - 0.6); const L = new THREE.PointLight(new THREE.Color(color), 14, 10, 1.6); L.position.copy(lp); scene.add(L);
    lights.push({ x: lp.x, y: lp.y, z: lp.z, color, intensity: 14, distance: 10 }); }

  /* ---------- 건물: 길 건너편(화면 위쪽) 높은 빌딩 줄 ---------- */
  function windowsTex(lit) { return canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#101116'; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h; y += 28) for (let x = 8; x < w; x += 22) { const r = Math.random(); g.fillStyle = r < lit ? (Math.random() < .5 ? '#ffcf7a' : '#7ad8ff') : (r < .55 ? '#1b1d26' : '#08090c'); g.fillRect(x, y, 14, 18); } }); }
  function building(s, t, w, d, h, lit) { const tex = windowsTex(lit); const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.8, color: 0x8a8a94 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.copy(P(s, t, h / 2)); b.rotation.y = ROT; scene.add(b); block(s, t, w, d); }
  const FAR = 10.4 + 3;   /* 먼 쪽 건물 중심 t (앞면 t = 10.4) */
  building(-21, FAR, 7, 6, 14, 0.06); building(-13.6, FAR, 7.2, 6, 9, 0.1); building(-6, FAR, 7, 6, 16, 0.05);
  building(1.6, FAR, 7.4, 6, 10, 0.08); building(9.4, FAR, 7.2, 6, 13, 0.07); building(17, FAR, 7, 6, 8, 0.09); building(24.4, FAR, 7, 6, 15, 0.05);
  const FRONT = 10.35;
  sign('PC방', '#3a8cff', -21, FRONT, 3.0, 2.4, 0.8); sign('강남역', '#ff3a5a', -13.6, FRONT, 3.4, 3.6, 1.05);
  sign('지하상가', '#39e0ff', -6, FRONT, 2.6, 3.0, 0.85); sign('약국', '#4cff9a', 1.6, FRONT, 2.8, 2.0, 0.8);
  sign('노래방', '#ff4fd8', 9.4, FRONT, 3.2, 3.2, 0.95); sign('24시', '#ffd23a', 17, FRONT, 2.6, 2.0, 0.8);
  /* 세로 간판 — 건물 모서리에 매달린 좁고 긴 것 (한국 거리의 밀도) */
  function vsign(text, color, s, y) { const tex = canvasTex(128, 512, g => { g.fillStyle = 'rgba(6,6,10,.92)'; g.fillRect(0, 0, 128, 512); g.strokeStyle = color; g.lineWidth = 5; g.strokeRect(6, 6, 116, 500);
      g.font = '900 84px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = color; g.shadowBlur = 20; g.fillStyle = color;
      [...text].forEach((ch, i, a) => g.fillText(ch, 64, 512 / (a.length + 1) * (i + 1))); });
    const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); m.color.setScalar(1.5); const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.8), m);
    pl.position.copy(P(s, FRONT - 0.6, y)); pl.rotation.y = ROT + Math.PI / 2 * 0.6; scene.add(pl); }
  vsign('병원', '#ff3a3a', -17.4, 4.6); vsign('호프', '#ffd23a', -9.9, 4.4); vsign('모텔', '#ff4fd8', -2.4, 4.8); vsign('당구', '#39e0ff', 5.4, 4.4); vsign('치킨', '#ffa020', 13.2, 4.6); vsign('사우나', '#4cff9a', 20.6, 4.8);
  /* 가까운 쪽(화면 아래): 높으면 캐릭터를 가린다 — 무너진 1층 벽과 잔해만 */
  const wallM = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.9 });
  for (const [s, len, h] of [[-18, 6, 1.6], [-9, 5, 2.2], [0, 7, 1.2], [10, 6, 1.9], [19, 5, 1.4]]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.4), wallM); w.position.copy(P(s, -11, h / 2)); w.rotation.y = ROT; scene.add(w); block(s, -11, len, 0.6); }
  const rubbleM = new THREE.MeshStandardMaterial({ color: 0x34343a, roughness: 0.95 });
  for (let i = 0; i < 60; i++) { const sz = 0.12 + Math.random() * 0.35, s = -24 + Math.random() * 48, t = (Math.random() < .5 ? 1 : -1) * (7 + Math.random() * 3.4);
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 0), rubbleM); r.position.copy(P(s, t, sz * 0.5)); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); scene.add(r); }

  /* ---------- 지하상가 입구 (원문 «강남역 5번 출구» EP02) ---------- */
  const frameM = new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.5, metalness: 0.6 });
  { const ent = new THREE.Group(); const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 2.6), frameM); roof.position.y = 2.6; ent.add(roof);
    for (const sx of [-1.6, 1.6]) for (const sz of [-1.2, 1.2]) { const pp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), frameM); pp.position.set(sx, 1.3, sz); ent.add(pp); }
    const glass = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.2, 0.05), new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.55 })); glass.position.set(0, 0.8, -1.2); ent.add(glass);
    const stair = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2), new THREE.MeshBasicMaterial({ color: 0x020203 })); stair.rotation.x = -Math.PI / 2; stair.position.y = 0.19; ent.add(stair);
    const no = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ map: neonTex('5', '#ffd23a', 256, 140, 110), toneMapped: false })); no.position.set(0, 2.95, 1.31); ent.add(no);
    ent.position.copy(P(-3.2, 8.0, 0.18)); ent.rotation.y = ROT; scene.add(ent); block(-3.2, 8.4, 3.6, 1.6); }
  /* ---------- 가로등 ---------- */
  function lamp(s, t) { const at = P(s, t); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.4, 8), frameM); pole.position.copy(at).setY(2.2); scene.add(pole);
    const hd = P(s, t - 0.5, 4.35); const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.24), new THREE.MeshBasicMaterial({ color: 0xffe1b0, toneMapped: false })); head.position.copy(hd); head.rotation.y = ROT; scene.add(head);
    const L = new THREE.SpotLight(0xffc98a, 46, 14, 0.85, 0.55, 1.4); L.position.copy(hd).setY(4.2); L.target.position.copy(P(s, t - 2.4)); scene.add(L, L.target);
    lights.push({ x: hd.x, y: 4.0, z: hd.z, color: '#ffc98a', intensity: 10, distance: 9 }); blockers.push({ x: at.x, z: at.z, hw: 0.2, hd: 0.2, rot: 0 }); }
  for (const s of [-19, -12, -5, 2, 9, 16, 23]) lamp(s, 6.6);
  for (const s of [-15.5, -8.5, -1.5, 5.5, 12.5, 19.5]) lamp(s, -6.8);
  /* ---------- 버려진 차 · 바리케이드 ---------- */
  function car(s, t, ry, color) { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 1.8), new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 })); body.position.y = 0.55; g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 1.6), new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.08, metalness: 0.85 })); top.position.set(-0.2, 1.15, 0); g.add(top);
    for (const [x, c] of [[2.1, 0xffe8c0], [-2.1, 0xff2020]]) for (const z of [-0.6, 0.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); l.position.set(x, 0.62, z); g.add(l); }
    g.position.copy(P(s, t)); g.rotation.y = ROT + ry; scene.add(g); block(s, t, 4.4, 2.0, ROT + ry); }
  car(-15, -3.0, 0.25, 0x5a1418); car(7.5, 2.6, -0.2, 0x1c2630); car(16.5, -2.4, 0.5, 0x2a2a2e);
  const barM = new THREE.MeshStandardMaterial({ color: 0xd8b030, roughness: 0.6, emissive: 0x201800 });
  for (const s of [-1, 0.6, 2.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.3), barM); b.position.copy(P(s, -5.2, 0.4)); b.rotation.y = ROT + 0.2; scene.add(b); block(s, -5.2, 1.4, 0.5); }

  /* ---------- 밤 하늘빛 ---------- */
  scene.add(new THREE.HemisphereLight(0x4a5478, 0x0a0608, 0.95));
  const moon = new THREE.DirectionalLight(0x8fa4ff, 0.6); moon.position.set(-10, 20, 6); scene.add(moon);
  /* 걸을 수 있는 띠(길 좌표) — 길·양쪽 인도. 먼 쪽 건물 앞면 t=10.4, 가까운 쪽 무너진 벽 t=-11 */
  const sp = P(-6.5, 7.4);
  return { lights, blockers, spawn: { x: sp.x, z: sp.z }, road: { ang: ANG }, walk: { s0: -21, s1: 21, t0: -10.5, t1: 9.9 },
    /* 그림이 덮어야 하는 곳: 걷는 띠 + 먼 쪽 건물 앞면 높이 8 m 까지 */
    extent: [[-24, -12.5, 0], [24, -12.5, 0], [-24, 10.4, 8], [24, 10.4, 8], [-24, 10.4, 0], [24, 10.4, 0]].map(([a, b, y]) => { const v = P(a, b, y); return [v.x, v.y, v.z]; }) };
}
