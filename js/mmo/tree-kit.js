/* 사실 같은 나무 (문서 230 §7) — 디렉터 «나무 바위 건물도 언리얼로 좀 사실같이».
   SpeedTree · 언리얼 나무가 쓰는 방식: 잎 덩어리를 그린 «잎 카드»(알파 잘라내기 판)를 갓 모양으로 수십 장 겹치고,
   노멀을 갓 중심에서 바깥으로 휘어 부드러운 덩어리 음영을 만든다. 다면체 하나(면마다 다른 색 — 장난감)를 대신한다.
   삼각형은 옛 갓(덩어리 넷 × 20 면 = 80)과 비슷한 72. 잎 · 솔잎 · 나무껍질 무늬는 캔버스로 한 번 그린다(무작위는 고정 씨앗) */
const rnd = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
let TEX = null;
export function treeTex(THREE, canvasTex) {
  if (TEX) return TEX; const r = rnd(4711);
  /* 잎 덩어리: 밝은 회녹색 잎 수백 장(재질 색이 곱해져 올리브 · 짙은 초록 · 갈색 · 녹슨 주황이 된다) + 잔가지. 바탕은 투명 */
  const leaf = canvasTex(THREE, 256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(70,60,50,.9)'; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(w / 2, h * .95); g.quadraticCurveTo(w * (.2 + r() * .6), h * .6, w * (.1 + r() * .8), h * (.1 + r() * .4)); g.stroke(); }
    for (let i = 0; i < 420; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * .46, x = w / 2 + Math.cos(a) * d * w, y = h * .48 + Math.sin(a) * d * h * .92, s = 5 + r() * 9, l = 150 + r() * 95 | 0;
      g.save(); g.translate(x, y); g.rotate(r() * 6.283); g.fillStyle = `rgb(${l - 10},${l},${l - 25})`; g.beginPath(); g.ellipse(0, 0, s, s * .45, 0, 0, 6.283); g.fill();
      g.fillStyle = `rgba(255,255,240,${.15 + r() * .2})`; g.beginPath(); g.ellipse(-s * .2, -s * .1, s * .5, s * .18, 0, 0, 6.283); g.fill(); g.restore(); } });   /* 잎마다 윗면 하이라이트 */
  /* 덤불 잎: 잔가지 없이 잎만 빽빽이(600 장, 판 가장자리까지) — 나무 잎 판의 잔가지가 덤불에선 코앞 검은 빗금이었다 (문서 230 §11) */
  const bush = canvasTex(THREE, 256, 256, (g, w, h) => { g.clearRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * .47, x = w / 2 + Math.cos(a) * d * w, y = h / 2 + Math.sin(a) * d * h, s = 4 + r() * 8, l = 120 + r() * 120 | 0;
      g.save(); g.translate(x, y); g.rotate(r() * 6.283); g.fillStyle = `rgb(${l - 12},${l},${l - 28})`; g.beginPath(); g.ellipse(0, 0, s, s * .5, 0, 0, 6.283); g.fill(); g.restore(); } });
  /* 솔잎 가지: 가운데 줄기에서 비스듬히 뻗는 바늘 수백 개 */
  const needle = canvasTex(THREE, 128, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgb(90,80,64)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 0); g.stroke();
    for (let i = 0; i < 520; i++) { const y = r() * h, sd = r() < .5 ? -1 : 1, len = (w * .48) * (1 - y / h * .25) * (.5 + r() * .5), l = 140 + r() * 80 | 0; g.strokeStyle = `rgb(${l - 20},${l},${l - 30})`; g.lineWidth = 1 + r();
      g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + sd * len, y - len * (.35 + r() * .3)); g.stroke(); } });
  /* 나무껍질: 세로 골 · 마디 */
  const bark = canvasTex(THREE, 128, 256, (g, w, h) => { g.fillStyle = '#6a5a4c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const x = r() * w, l = 40 + r() * 70 | 0; g.strokeStyle = `rgba(${l},${l - 8},${l - 16},.8)`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= h; y += 16) g.lineTo(x + (r() - .5) * 6, y); g.stroke(); }
    for (let i = 0; i < 8; i++) { const x = r() * w, y = r() * h; g.fillStyle = 'rgba(30,24,20,.7)'; g.beginPath(); g.ellipse(x, y, 4 + r() * 4, 3 + r() * 3, 0, 0, 6.283); g.fill(); } }, [1, 2]);
  for (const t of [leaf, needle, bush]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; }
  return TEX = { leaf, needle, bark, bush };
}
/* 판 하나를 기하에 넣는다: 가운데 c, 가로 u · 세로 v (반 길이 벡터), 노멀은 갓 중심 o 에서 바깥으로 휜 것(n0 쪽으로 bend 만큼) */
function card(P, N, U, I, c, u, v, o, bend) { const b = P.length / 3, n = new Float32Array(3);
  for (const [su, sv, tu, tv] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) { const x = c[0] + u[0] * su + v[0] * sv, y = c[1] + u[1] * su + v[1] * sv, z = c[2] + u[2] * su + v[2] * sv; P.push(x, y, z); U.push(tu, tv);
    n[0] = x - o[0]; n[1] = (y - o[1]) * .8 + .35; n[2] = z - o[2]; const L = Math.hypot(n[0], n[1], n[2]) || 1; N.push(n[0] / L * bend + (1 - bend) * 0, n[1] / L * bend + (1 - bend), n[2] / L * bend); }
  I.push(b, b + 1, b + 2, b, b + 2, b + 3); }
/* 활엽수 갓: 옛 덩어리 넷 자리에 카드 9 장씩 = 36 장 (72 삼각형). 원점 = 옛 갓 중심(인스턴스 행렬 그대로) */
export function leafCrownGeo(THREE) {
  const r = rnd(902), P = [], N = [], U = [], I = [], O = [0, .25, 0];
  for (const [bx, by, bz, br] of [[0, .2, 0, 1.35], [.85, -.25, .3, 1.05], [-.7, -.15, -.45, 1.1], [.1, .95, -.2, .95]]) for (let k = 0; k < 9; k++) {
    const th = r() * 6.283, ph = Math.acos(1 - 2 * (.12 + r() * .8)), rr = br * (.45 + r() * .5), c = [bx + Math.sin(ph) * Math.cos(th) * rr, by + Math.cos(ph) * rr * .8, bz + Math.sin(ph) * Math.sin(th) * rr];
    const s = br * (.85 + r() * .35), a = r() * 6.283, tilt = (r() - .5) * 1.4, u = [Math.cos(a) * s, 0, Math.sin(a) * s], v = [-Math.sin(a) * Math.sin(tilt) * s, Math.cos(tilt) * s, Math.cos(a) * Math.sin(tilt) * s];
    card(P, N, U, I, c, u, v, O, .85); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  g.computeBoundingSphere(); g.computeBoundingBox(); return g;
}
/* 덤불: 옛 다면체 덩어리 셋 자리에 카드 8 장씩 = 24 장 (48 삼각형 — 옛 60 과 비슷). 강남 길가 덤불이 짙은 다면체라 «각진 바위» 로 읽혔다(문서 230 §11) */
export function leafBushGeo(THREE) {
  const r = rnd(5309), P = [], N = [], U = [], I = [], O = [0, -.2, 0];
  for (const [bx, by, bz, br] of [[0, .05, 0, .68], [.58, -.1, .18, .52], [-.45, -.08, -.38, .55]]) for (let k = 0; k < 8; k++) {
    const th = r() * 6.283, ph = Math.acos(1 - 2 * (.05 + r() * .75)), rr = br * (.3 + r() * .5), c = [bx + Math.sin(ph) * Math.cos(th) * rr, by + Math.cos(ph) * rr * .7, bz + Math.sin(ph) * Math.sin(th) * rr];
    const sz = br * (.8 + r() * .3), a = r() * 6.283, tilt = (r() - .5) * 1.2, u = [Math.cos(a) * sz, 0, Math.sin(a) * sz], v = [-Math.sin(a) * Math.sin(tilt) * sz, Math.cos(tilt) * sz, Math.cos(a) * Math.sin(tilt) * sz];
    card(P, N, U, I, c, u, v, O, .8); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  g.computeBoundingSphere(); g.computeBoundingBox(); g.userData.bush = true; return g;
}
/* 소나무: 층 여섯 × 가지 카드 4~8 장(38 장) — 줄기에서 바깥 · 아래로 처진 판. 원점 = 옛 소나무 중심 */
export function pineCardGeo(THREE) {
  const r = rnd(1907), P = [], N = [], U = [], I = [];
  for (const [y, R, n] of [[-1.7, 1.9, 8], [-.9, 1.6, 8], [-.1, 1.3, 7], [.7, 1.0, 6], [1.45, .7, 5], [2.1, .42, 4]]) for (let k = 0; k < n; k++) {   /* 층 여섯 — 아래가 넓고 위로 갈수록 좁아 원뿔 꼴 */
    const a = k / n * 6.283 + (y * 1.7) + r() * .4, ca = Math.cos(a), sa = Math.sin(a), droop = .75 + r() * .25,   /* 가지가 충분히 처져야 «접시» 가 아니라 소나무 */ len = R * (.9 + r() * .2) / 2, wdt = R * .32;
    const c = [ca * len, y - Math.sin(droop) * len * .5, sa * len], u = [-sa * wdt, 0, ca * wdt], v = [ca * len, -Math.sin(droop) * len, sa * len];   /* v: 줄기→끝 */
    card(P, N, U, I, c, u, v, [0, y + .6, 0], .8); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  g.computeBoundingSphere(); g.computeBoundingBox(); return g;
}
