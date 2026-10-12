/* 버려진 차 (문서 230 §4) — 디렉터 «자동차랑 이런 것도 해» (머니스웨거 영상 썸네일의 주유소 · 로라이더).
   전엔 옆모습을 그대로 민 덩어리 + 바퀴 원기둥 넷이라 «회색 상자» 였다 — 바퀴가 몸에 파묻히고 불빛 · 범퍼 · 창 테두리가 없었다.
   - 몸: 바퀴 자리를 둥글게 파낸 옆모습(허리선까지) + 유리 집(지붕 아래 창) + 칠한 지붕 판 — 창이 위로 떠 보이지 않게 지붕을 덮는다
   - 꾸밈: 앞뒤 범퍼 · 그릴 · 전조등(희미하게) · 미등(빨강) · 번호판 · 사이드미러 · 타이어 + 휠
   - 낡음(셰이더 하나, 칠 재질 공유): 윗면에 앉은 먼지 · 아래쪽 흙때 · 녹 얼룩 — 세계 좌표만 쓰니 합쳐도(mergeStatic) 그대로
   - 상태: 멀쩡 · 펑크(한쪽으로 기움) · 탄 차(검게 그을고 유리 없음, 바퀴는 휠만)
   재질은 칠 색 × 상태로 공유 — 차마다 새로 만들면 합치기가 색별로 못 묶는다 */
const PAINT = [0xd8d8dc, 0x1a1a1e, 0x8a8c94, 0x5a1418, 0x1c2a40, 0xe8e8ea, 0x2a2a2e, 0x6a6c72, 0x3c4a3a, 0x7a5a2a];
export const CAR_TYPES = {
  sedan: { len: 4.6, w: 1.78, wr: .33, wx: 1.42, belt: [[-2.3, .3], [-2.33, .62], [-2.18, .86], [-1.3, .9], [1.3, .88], [2.22, .74], [2.34, .46], [2.3, .3]],
    cab: [[-1.32, .88], [-.92, 1.34], [.5, 1.36], [1.28, .87]] },
  suv: { len: 4.7, w: 1.88, wr: .37, wx: 1.48, belt: [[-2.35, .36], [-2.37, 1.0], [1.4, 1.0], [2.25, .9], [2.4, .55], [2.36, .36]],
    cab: [[-2.3, .99], [-2.2, 1.66], [.85, 1.7], [1.42, .99]] },
  mini: { len: 3.6, w: 1.6, wr: .3, wx: 1.12, belt: [[-1.8, .3], [-1.83, .84], [1.08, .87], [1.74, .72], [1.85, .45], [1.8, .3]],
    cab: [[-1.76, .86], [-1.64, 1.42], [.58, 1.45], [1.1, .86]] },
  truck: { len: 7.2, w: 2.3, wr: .48, wx: 2.5, truck: true },
  bus: { len: 11, w: 2.4, wr: .5, wx: 3.6, bus: true },
};
let mats = null;
function kitMats(THREE) {
  if (mats) return mats;
  const GRIME = { uniforms: null };
  const patch = (m, rust) => { m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCarW; varying vec3 vCarN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCarW = (modelMatrix * vec4(transformed, 1.0)).xyz; vCarN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vCarW; varying vec3 vCarN;
float carH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float carN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(carH(i), carH(i + vec2(1, 0)), f.x), mix(carH(i + vec2(0, 1)), carH(i + vec2(1, 1)), f.x), f.y); }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{ float n = carN(vCarW.xz * 2.3 + vCarW.y * 1.7), n2 = carN(vCarW.xy * 5.1 + vCarW.zx * 3.3), rustK = 1.0 - smoothstep(.3, .9, vCarW.y);
  float dust = smoothstep(.35, .85, vCarN.y) * (.45 + .55 * n);                       /* 위를 보는 면에 앉은 먼지 */
  float grime = (1.0 - smoothstep(.15, .62, vCarW.y)) * (.6 + .4 * n2);              /* 아래쪽 흙때 · 튄 물 자국 */
  float rust = smoothstep(${(.74 - rust * .3).toFixed(3)}, ${(.92 - rust * .3).toFixed(3)}, n2 * .6 + n * .4) * (.55 + .45 * rustK);   /* 녹 얼룩 — 작은 점 · 문 아래 · 바퀴집 둘레 */
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.42, .38, .33), dust * .45);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.16, .12, .09), grime * .55);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.24, .13, .07), rust * .85);
  roughnessFactor = clamp(roughnessFactor + dust * .55 + grime * .3 + rust * .6, 0.0, 1.0); }`)
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - smoothstep(.35, .85, vCarN.y) * .6;');
    }; m.customProgramCacheKey = () => 'car-grime-' + rust; return m; };
  /* 꼭짓점 색 재질 넷만 — 색마다 · 부품마다 재질이 따로면 합치기 칸마다 열 개씩 남아 그리기 호출이 +44~75 였다(강남 · 여의도 · 대전) */
  const vcPaint = { ok: patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .55 }), .12), wreck: patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .5 }), .45) };
  const vcParts = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .3 });
  const paint = {}, paintMat = (hex, state) => { const k = hex + state; if (paint[k]) return paint[k];
    const c = new THREE.Color(hex); if (state === 'wreck') c.multiplyScalar(.5);
    const pm = new THREE.MeshStandardMaterial({ color: c, roughness: state === 'wreck' ? .55 : .3, metalness: .55 }); PAINTED.add(pm); return paint[k] = pm; };   /* 색만 담는 그릇 — bakeVC 가 꼭짓점 색으로 굽는다 */
  mats = { paint: paintMat, GRIME, vcPaint, vcParts, grime: (hex, rust, rough = .7, metal = .2) => patch(new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }), rust),
    charred: patch(new THREE.MeshStandardMaterial({ color: 0x141110, roughness: .95, metalness: .25 }), .6),
    glass: new THREE.MeshStandardMaterial({ color: 0x27303c, roughness: .1, metalness: .55 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: .7, metalness: .2 }),     /* 범퍼 · 그릴 · 거울 */
    tire: new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: .9 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x9a9ca2, roughness: .35, metalness: .85 }),
    head: new THREE.MeshStandardMaterial({ color: 0xd8d4c4, roughness: .2, metalness: .3, emissive: 0x24221c }),   /* 꺼진 전조등 — 조금만 빛을 받아 반짝 */
    tail: new THREE.MeshStandardMaterial({ color: 0x6a0c0c, roughness: .25, emissive: 0x200202 }),
    plate: new THREE.MeshStandardMaterial({ color: 0xc8c8c0, roughness: .6 }),
    inner: new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1 }),
    cargo: [0xb8b4aa, 0x2c4a6a, 0x3a5a3a, 0x8a2a22].map(h => patch(new THREE.MeshStandardMaterial({ color: h, roughness: .6, metalness: .3 }), .2)) };
  return mats;
}
/* 옆모습(x 앞뒤 · y 위) → 폭 w 로 민 기하. arches: [[x, r]] 아래 가장자리에서 바퀴 자리를 둥글게 파낸다 */
/* 같은 낡음 셰이더(먼지 · 흙때 · 녹)를 다른 소품에 — 주유소 (gas-station.js) */
export const grimeMat = (THREE, hex, rust = .3, rough = .7, metal = .2) => kitMats(THREE).grime(hex, rust, rough, metal);
/* 소품 통째로: 낡음 재질(grimeMat) 색을 꼭짓점 색으로 굽고 공유 칠 재질 하나로 — 주유소 재질 여섯이 하나로 */
export function grimeToVC(THREE, root, worn = false) { const M = kitMats(THREE); root.traverse(m => { if (!m.isMesh || !m.material.onBeforeCompile || !m.material.customProgramCacheKey || !/car-grime/.test(m.material.customProgramCacheKey())) return;
  const c = m.material.color, geo = m.geometry, n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); m.material = worn ? M.vcPaint.wreck : M.vcPaint.ok; }); }
function side(THREE, pts, w, arches = [], y0 = null) {
  const s = new THREE.Shape(); const [x0, yb] = pts[0]; s.moveTo(x0, yb);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  if (arches.length) { const yB = y0 ?? yb; for (const [ax, r] of [...arches].sort((a, b) => b[0] - a[0])) { s.lineTo(ax + r, yB); s.absarc(ax, yB, r, 0, Math.PI, false); s.lineTo(ax - r, yB); } }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelThickness: .04, bevelSize: .035, bevelSegments: 1, curveSegments: 6 }); g.translate(0, 0, -w / 2); return g;
}
const box = (THREE, w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
/* 한 대 — THREE.Group (자식 메시 여럿, 재질 공유). R: 0~1 난수 함수 */
export function buildCar(THREE, type, R, { wreck = false } = {}) {
  const M = kitMats(THREE), T = CAR_TYPES[type], g = new THREE.Group(), add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); g.add(m); return m; };
  const burned = R() < (wreck ? .2 : .06), flat = !burned && R() < (wreck ? .4 : .14), state = wreck ? 'wreck' : 'ok';
  const paint = burned ? M.charred : M.paint(PAINT[(R() * PAINT.length) | 0], state), hw = T.w / 2;
  g.userData.car = { type, burned, flat };
  if (T.bus) {   /* 시내버스: 두 색 몸 + 옆 창 띠 + 앞유리 + 행선판 · 문 */
    const body = burned ? M.charred : M.paint(R() < .5 ? 0x2a6ab0 : 0x3a9a5a, state), lo = burned ? M.charred : M.paint(0xd8d8d0, state);
    add(box(THREE, 11, 1.25, T.w, 0, 1.0, 0), lo); add(box(THREE, 11, 1.3, T.w, 0, 2.27, 0), body); add(box(THREE, 10.9, .12, T.w - .1, 0, 2.98, 0), body);
    add(box(THREE, 9.6, .95, T.w + .02, -.5, 2.12, 0), burned ? M.inner : M.glass);   /* 옆 창 띠 */
    add(box(THREE, .06, 1.15, T.w - .3, 5.51, 2.0, 0), burned ? M.inner : M.glass); add(box(THREE, .05, .26, T.w - .6, 5.52, 2.78, 0), burned ? M.inner : M.head);   /* 앞유리 · 행선판 */
    add(box(THREE, .9, 1.9, .04, 4.4, 1.3, hw + .01), M.trim); add(box(THREE, .9, 1.9, .04, -.4, 1.3, hw + .01), M.trim);   /* 문 */
    add(box(THREE, .2, .32, T.w, 5.55, .62, 0), M.trim); add(box(THREE, .2, .32, T.w, -5.55, .62, 0), M.trim);
    for (const z of [-hw + .3, hw - .3]) { add(box(THREE, .05, .14, .3, 5.6, .95, z), burned ? M.inner : M.head); add(box(THREE, .05, .2, .2, -5.56, 1.1, z), burned ? M.inner : M.tail); }
    for (const x of [T.wx, -T.wx]) for (const sd of [-1, 1]) wheel(THREE, g, M, x, T.wr, sd * (hw - .18), burned, .3);
  } else if (T.truck) {   /* 화물차: 짐칸 상자 + 앞머리(비스듬한 앞유리) */
    const cargo = burned ? M.charred : M.cargo[(R() * M.cargo.length) | 0];
    add(box(THREE, 5.0, 2.3, T.w, -1.1, 1.75, 0), cargo); add(box(THREE, 5.1, .14, T.w + .04, -1.1, .56, 0), M.trim);
    for (let i = 0; i < 6; i++) add(box(THREE, .05, 2.2, T.w + .03, -3.4 + i * .92, 1.75, 0), M.trim);   /* 짐칸 갈빗대 */
    add(side(THREE, [[1.55, .62], [1.55, 2.55], [2.75, 2.55], [3.5, 1.7], [3.6, 1.0], [3.6, .62]], T.w - .1), paint);
    if (!burned) add(side(THREE, [[2.72, 2.42], [3.42, 1.72], [3.48, 1.62], [2.66, 1.62]], T.w - .02), M.glass);
    add(box(THREE, .16, .32, T.w + .02, 3.62, .7, 0), M.trim);
    for (const z of [-hw + .35, hw - .35]) { add(box(THREE, .06, .18, .3, 3.64, 1.0, z), burned ? M.inner : M.head); }
    for (const [x, dual] of [[2.6, false], [-2.0, true], [-3.0, true]]) for (const s of [-1, 1]) wheel(THREE, g, M, x, T.wr, s * (hw - (dual ? .2 : .15)), burned, dual ? .36 : .26);
  } else {
    const arches = [[T.wx, T.wr + .07], [-T.wx, T.wr + .07]];
    add(side(THREE, T.belt, T.w - .1, arches, T.belt[0][1]), paint);
    if (burned) add(side(THREE, T.cab, T.w - .34), M.inner);   /* 유리가 깨져 나간 안 — 검은 속 */
    else add(side(THREE, T.cab, T.w - .3), M.glass);
    const [r0, r1] = [T.cab[1], T.cab[2]]; add(side(THREE, [[r0[0] + .02, r0[1] - .03], [r1[0] - .02, r1[1] - .03], [r1[0] - .02, r1[1] + .03], [r0[0] + .02, r0[1] + .03]], T.w - .26), paint);   /* 칠한 지붕 판 */
    const fx = T.belt.reduce((m, p) => Math.max(m, p[0]), -9), bx = T.belt.reduce((m, p) => Math.min(m, p[0]), 9), by = T.belt[0][1];
    add(box(THREE, .16, .2, T.w - .02, fx + .02, by + .08, 0), M.trim); add(box(THREE, .16, .2, T.w - .02, bx - .02, by + .1, 0), M.trim);   /* 범퍼 */
    add(box(THREE, .05, .14, T.w * .42, fx + .02, by + .3, 0), M.trim);   /* 그릴 */
    for (const z of [-hw + .26, hw - .26]) { add(box(THREE, .06, .1, .3, fx - .02, by + .32, z), burned ? M.inner : M.head); add(box(THREE, .06, .12, .26, bx + .01, by + .4, z), burned ? M.inner : M.tail); }
    add(box(THREE, .03, .12, .42, bx - .1, by + .16, 0), M.plate); add(box(THREE, .03, .1, .42, fx + .11, by + .1, 0), M.plate);
    const mx = T.cab[3][0] - .05, my = T.cab[3][1] + .08; for (const s of [-1, 1]) add(box(THREE, .14, .1, .12, mx, my, s * (hw + .02)), M.trim);   /* 사이드미러 */
    for (const x of [T.wx, -T.wx]) for (const s of [-1, 1]) wheel(THREE, g, M, x, T.wr, s * (hw - .14), burned, .23);
  }
  bakeVC(THREE, g, M, state);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  if (flat) { g.rotation.x = (R() < .5 ? -1 : 1) * .045; g.position.y = -.05; }   /* 펑크 — 한쪽 바퀴가 주저앉아 기운다 */
  if (burned) g.position.y = -.12;   /* 타이어가 타 없어져 휠로 주저앉음 */
  return g;
}
/* 재질 색을 꼭짓점 색으로 굽고 공유 재질로 바꾼다: 칠 · 탄 몸 · 짐칸 → vcPaint(낡음 셰이더), 유리 → 그대로, 나머지 부품 → vcParts */
const PAINTED = new WeakSet();
function bakeVC(THREE, g, M, state) {
  for (const m of g.children) { const mat = m.material; if (mat === M.glass) continue;
    const painted = PAINTED.has(mat) || mat === M.charred || M.cargo.includes(mat), c = mat.color, geo = m.geometry, n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    m.material = painted ? (mat === M.charred || state === 'wreck' ? M.vcPaint.wreck : M.vcPaint.ok) : M.vcParts; }
}
function wheel(THREE, g, M, x, r, z, burned, w) {
  if (!burned) { const t = new THREE.CylinderGeometry(r, r, w, 12); t.rotateX(Math.PI / 2); t.translate(x, r, z); g.add(new THREE.Mesh(t, M.tire)); }
  const rr = r * .58, h = new THREE.CylinderGeometry(rr, rr, w + .02, 8); h.rotateX(Math.PI / 2); h.translate(x, burned ? rr + .05 : r, z); g.add(new THREE.Mesh(h, burned ? M.charred : M.rim));
}
