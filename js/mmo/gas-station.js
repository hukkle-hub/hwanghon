/* 버려진 주유소 (문서 230 §5) — 디렉터 «자동차랑 이런 것도 해»: 머니스웨거 영상 썸네일의 주유소(캐노피 · 주유기 · 가게 · 로라이더).
   지역마다 큰길 옆 걷는 띠 안 빈 땅에 하나. 상표는 넣지 않는다(실제 회사 흉내 금지) — «셀프 주유소» 와 가격판만.
   - 캐노피(한쪽 모서리가 내려앉음) · 기둥 넷 · 주유섬 둘(주유기 둘씩 · 늘어진 호스) · 가게(깨진 유리 · 간판) · 가격 기둥(숫자는 꺼져 «----»)
   - 기름 얼룩 바닥판 · 주유기 앞에 버려진 차 한 대
   낡음은 차와 같은 셰이더(car-kit grimeMat). 자리(로컬 x: 길과 나란히 · z: 길에서 멀어지는 쪽, 0 = 길가에서 1.5 m) */
import { buildCar, grimeMat, grimeToVC } from './car-kit.js';
export const GAS = { W: 18, D: 15 };   /* 터 크기 — 놓을 자리를 고를 때 이만큼 비어야 한다 */
let M = null;
function mats(THREE, canvasTex) {
  if (M) return M;
  const fascia = canvasTex(THREE, 512, 64, (g, w, h) => { g.fillStyle = '#e8e4da'; g.fillRect(0, 0, w, h); g.fillStyle = '#c0301c'; g.fillRect(0, h * .62, w, h * .2);
    g.fillStyle = '#2a2a2a'; g.font = '900 30px sans-serif'; g.textAlign = 'center'; g.fillText('셀 프   주 유 소', w / 2, h * .5);
    g.fillStyle = 'rgba(40,30,20,.55)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, h * .8, 2 + Math.random() * 3, Math.random() * h * .2); });   /* 흘러내린 녹물 */
  const price = canvasTex(THREE, 128, 256, (g, w, h) => { g.fillStyle = '#16181c'; g.fillRect(0, 0, w, h); g.fillStyle = '#c0301c'; g.fillRect(0, 0, w, 40);
    g.fillStyle = '#f0ece0'; g.font = '800 22px sans-serif'; g.textAlign = 'center'; g.fillText('주 유', w / 2, 28);
    g.font = '700 16px sans-serif'; ['휘발유', '경 유', '등 유'].forEach((t, i) => { g.fillStyle = '#c8c4b8'; g.fillText(t, w / 2, 70 + i * 62); g.fillStyle = '#5a2a10'; g.font = '700 26px monospace'; g.fillText('- - - -', w / 2, 98 + i * 62); g.font = '700 16px sans-serif'; }); });
  const stain = canvasTex(THREE, 256, 256, (g, w, h) => { g.fillStyle = '#7a7670'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(20,16,12,.55)'); gr.addColorStop(1, 'rgba(20,16,12,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.strokeStyle = 'rgba(30,26,22,.5)'; for (let i = 0; i < 18; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (Math.random() - .5) * 50; y += (Math.random() - .5) * 50; g.lineTo(x, y); } g.stroke(); } });   /* 금 간 콘크리트 */
  M = { white: grimeMat(THREE, 0xd6d2c8, .3, .6, .1), red: grimeMat(THREE, 0xa8281a, .35, .5, .2), steel: grimeMat(THREE, 0x5a5e64, .45, .45, .7), dark: grimeMat(THREE, 0x1c1d20, .2, .7, .2),
    pumpBody: grimeMat(THREE, 0xc8c4bc, .35, .5, .2), curb: grimeMat(THREE, 0x8a8680, .1, .9, 0), hose: new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: .8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1e2630, roughness: .08, metalness: .6 }), panel: new THREE.MeshStandardMaterial({ color: 0x2a2a26, emissive: 0xfff2d8, emissiveIntensity: .9, roughness: .4 }), panelOff: new THREE.MeshStandardMaterial({ color: 0x3a3a36, roughness: .5 }), screen: new THREE.MeshStandardMaterial({ color: 0x0c1410, roughness: .3, emissive: 0x041008 }),
    fascia: new THREE.MeshStandardMaterial({ map: fascia, roughness: .6 }), price: new THREE.MeshStandardMaterial({ map: price, roughness: .5 }),
    pad: new THREE.MeshStandardMaterial({ map: stain, roughness: .9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }) };
  return M;
}
/* 주유소 한 채 → { group, blockers: [{x, z, hw, hd}] (로컬) }. R: 0~1 난수 */
export function buildGasStation(THREE, R, canvasTex) {
  const m = mats(THREE, canvasTex), g = new THREE.Group(), blockers = [];
  const box = (w, h, d, x, y, z, mat, ry = 0) => { const geo = new THREE.BoxGeometry(w, h, d); const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(GAS.W, GAS.D), m.pad); pad.rotation.x = -Math.PI / 2; pad.position.set(0, .03, GAS.D / 2); pad.receiveShadow = true; pad.userData.noCam = true; g.add(pad);
  /* 캐노피: 길 쪽(z 2~10) — 기둥 넷, 판, 띠. 한 모서리(sag)가 내려앉음 */
  const cz = 6, cw = 13, cd = 8, ch = 5.2, sag = R() < .5 ? -1 : 1;
  for (const [x, z] of [[-4.5, cz - 2.6], [4.5, cz - 2.6], [-4.5, cz + 2.6], [4.5, cz + 2.6]]) { box(.5, ch, .5, x, ch / 2, z, m.white); blockers.push({ x, z, hw: .35, hd: .35 }); }
  const roof = new THREE.Group(); roof.position.set(0, ch, cz); g.add(roof); roof.rotation.z = sag * .045; roof.rotation.x = .03;   /* 내려앉은 모서리 */
  const rb = (w, h, d, x, y, z, mat) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; roof.add(o); return o; };
  rb(cw, .35, cd, 0, .3, 0, m.white); for (const s of [-1, 1]) rb(cw + .1, .75, .08, 0, .3, s * (cd / 2 + .04), m.fascia); for (const s of [-1, 1]) rb(.08, .75, cd, s * (cw / 2 + .04), .3, 0, m.red);
  for (let i = -2; i <= 2; i++) for (const zz of [-2, 2]) rb(1.6, .04, .5, i * 2.4, .1, zz, R() < .35 ? m.panel : m.panelOff);   /* 천장 등 — 셋 중 하나만 살아 있다 (밤에 «주유소» 로 읽히게) */
  if (R() < .7) { const p = rb(2.2, .06, 1.6, sag * 4.6, -.25, 2.2, m.white); p.rotation.z = sag * .9; p.position.y = -1.1; }   /* 떨어져 매달린 천장 판 */
  /* 주유섬 둘: 연석 + 주유기 둘 + 호스 */
  for (const ix of [-2.2, 2.2]) { box(1.1, .22, 4.4, ix, .11, cz, m.curb); blockers.push({ x: ix, z: cz, hw: .6, hd: 2.3 });
    for (const pz of [cz - 1.2, cz + 1.2]) { const tilt = R() < .15; const pump = box(.62, 1.75, .48, ix, .22 + .875, pz, m.pumpBody); if (tilt) { pump.rotation.x = .5; pump.position.y = .7; }
      box(.64, .32, .5, ix, 2.0, pz, m.red).visible = !tilt; box(.02, .3, .26, ix + .32, 1.45, pz, m.screen); box(.02, .3, .26, ix - .32, 1.45, pz, m.screen);
      for (const s of [-1, 1]) { const hose = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.2, 5), m.hose); hose.position.set(ix + s * .36, .9, pz + .1); hose.rotation.z = s * (.25 + R() * .3); g.add(hose); } } }
  /* 가게: 뒤쪽(z 11.5~14.5) — 상자 + 깨진 유리 앞면 + 처마 + 간판 */
  const sx = (R() - .5) * 4, sz = 13; box(8.5, 3.6, 3.4, sx, 1.8, sz, m.white); box(8.7, .3, 3.6, sx, 3.75, sz, m.red); box(6.5, 2.2, .06, sx - .6, 1.4, sz - 1.72, m.glass); box(1, 2.2, .06, sx + 3.2, 1.2, sz - 1.72, m.dark);
  box(8.9, .12, 1.4, sx, 3.0, sz - 2.3, m.white); blockers.push({ x: sx, z: sz, hw: 4.4, hd: 1.8 });
  for (let i = 0; i < 5; i++) box(.4 + R() * .6, .04, .3 + R() * .5, sx - 3 + R() * 6, .05, sz - 2.3 - R() * 1.5, m.glass, R() * 3);   /* 깨진 유리 조각 */
  /* 가격 기둥: 길가 모서리 */
  const px = sag * 7.6; box(.5, 5.2, .5, px, 2.6, .9, m.steel); box(1.4, 2.6, .3, px, 4.4, .9, m.price); box(1.5, .3, .34, px, 5.8, .9, m.red); blockers.push({ x: px, z: .9, hw: .4, hd: .4 });
  /* 주유기 앞에 버려진 차 */
  if (R() < .85) { const car = buildCar(THREE, R() < .6 ? 'sedan' : 'suv', R); car.position.set(0, car.position.y, cz); car.rotation.order = 'YXZ'; car.rotation.y = Math.PI / 2 + (R() - .5) * .2; g.add(car); blockers.push({ x: 0, z: cz, hw: 1.0, hd: 2.4 }); }   /* 두 주유섬 사이 */
  /* 타이어 더미 · 기름통 */
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(.32, .12, 6, 10), m.hose); t.rotation.x = Math.PI / 2; t.position.set(sx + 4.8, .12 + i * .24, sz - 1 + (i % 2) * .05); t.castShadow = true; g.add(t); }
  for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .9, 10), i === 1 ? m.red : m.steel); d.position.set(sx - 4.9 + i * .65, .45, sz - .6); if (i === 2) { d.rotation.z = Math.PI / 2; d.position.y = .3; d.position.x += .3; } d.castShadow = true; g.add(d); }
  blockers.push({ x: sx + 4.8, z: sz - 1, hw: .5, hd: .5 }, { x: sx - 4.3, z: sz - .6, hw: 1.0, hd: .4 });
  grimeToVC(THREE, g);   /* 재질 여섯 → 하나 (차는 buildCar 가 이미 구웠다) */
  return { group: g, blockers };
}
