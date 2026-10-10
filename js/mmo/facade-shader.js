/* 가짜 실내 창문 (interior mapping) — 디렉터 «맵을 스파이더맨2 정도로» (문서 229).
   스파이더맨의 빌딩 숲이 쓰는 요령: 창 뒤에 방이 «있는 척» 한다. 방 모형은 없다 — 창 안의 점마다 시선 반직선을 방 상자(뒷벽·옆벽·바닥·천장)와
   만나게 해서 맞은 면의 색을 칠한다. 텍스처를 더 읽지 않고 셈만 하므로 휴대폰에서도 싸다.
   - 벽마다 자기 세계 좌표로 창 칸을 잡는다(가로 1.8 m × 층 3.6 m, 1층은 가게 띠라 비움) — ExtrudeGeometry 의 UV 는 비스듬한 벽에서 늘어난다
   - 방마다(칸 번호 해시) 불 켜짐·벽 색·깊이·블라인드·깨진 창이 다르다. 황혼(폐허 도시)이라 불 켜진 방은 드물다
   - 유리는 보는 각에 따라 하늘빛을 조금 비춘다(프레넬) · 거칠기를 낮춰 해 반짝임
   FACADE_U.uLampK 를 시간대가 정한다(밤일수록 켜진 방이 밝다) */
export const FACADE_U = { uLampK: { value: 1 }, uSkyRefl: { value: null } };
/* 항공 장애등 — 50 m 넘는 탑 꼭대기 모서리의 붉은 등. 재질 하나를 같이 써서 world3d 가 깜빡인다(aviBlink) */
export const AVI = { mat: null, n: 0 };
export function aviLight(THREE, scene, pts, h) { if (!AVI.mat) AVI.mat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false, toneMapped: false });
  let a = 0, b = 0, best = -1; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d > best) { best = d; a = i; b = j; } }   /* 가장 먼 두 모서리 */
  const g = AVI.geo || (AVI.geo = new THREE.SphereGeometry(0.55, 8, 6));
  for (const k of [a, b]) { const m = new THREE.Mesh(g, AVI.mat); m.position.set(pts[k][0], h + 1.1, pts[k][1]); m.userData.noCam = true; scene.add(m); AVI.n++; } }
export function aviBlink(t, lampK) { if (!AVI.mat) return; const on = (t % 1.6) < 0.55, k = 0.35 + 0.65 * Math.min(1, lampK); AVI.mat.color.setRGB(on ? 1.6 * k : 0.12, on ? 0.18 * k : 0.01, on ? 0.1 * k : 0.01); }

const PARS = `
varying vec3 vFW; varying vec3 vFN;
uniform float uLampK; uniform vec3 uSkyRefl, uWallTint;
float fh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fh2(vec2 p){ return fract(sin(dot(p, vec2(269.5, 183.3))) * 24634.6345); }`;

/* 창 하나 — glass(0/1), 알베도, 스스로 빛, 반사. diffuseColor 를 고치고 나중 단계가 쓸 값을 남긴다 */
const BODY = `
float fGlass = 0.0; vec3 fEmit = vec3(0.0);
{ vec3 Nw = normalize(vFN);
  if (abs(Nw.y) < 0.35) {
    vec3 Tw = normalize(vec3(Nw.z, 0.0, -Nw.x));                 /* 위 × 법선 = 벽 따라 */
    float s = dot(vFW, Tw), y = vFW.y;
    vec2 cell = vec2(s / 1.8, y / 3.6), id = floor(cell), f = fract(cell);
    /* 층 띠·창틀: 벽 색에 결 */
    float band = smoothstep(0.0, 0.03, f.y) * (1.0 - smoothstep(0.93, 0.97, f.y));
    diffuseColor.rgb *= mix(0.72, 1.0, band); vec3 wallD = diffuseColor.rgb;
    float wallH = fh1(vec2(floor(dot(vFW.xz, Nw.xz) * 0.37), floor(Nw.x * 7.0 + Nw.z * 3.0)));   /* 벽 한 면의 해시 — 창 모양 고르기 */
#ifdef CURTAIN
    bool ribbon = true; vec2 g0 = vec2(0.0, 0.05), g1 = vec2(1.0, 0.96);                             /* 유리 커튼월: 층마다 얇은 슬래브만 */
#else
    bool ribbon = wallH < 0.38;                                                                      /* 띠창(커튼월) 38 % · 나머지는 뚫린 창 */
    vec2 g0 = ribbon ? vec2(0.0, 0.22) : vec2(0.09 + 0.06 * fract(wallH * 7.0), 0.17), g1 = ribbon ? vec2(1.0, 0.92) : vec2(0.91 - 0.06 * fract(wallH * 7.0), 0.86);
#endif
    float inG = step(g0.x, f.x) * step(f.x, g1.x) * step(g0.y, f.y) * step(f.y, g1.y) * step(3.4, y);
    float aa = clamp(1.0 - max(fwidth(cell.x), fwidth(cell.y)) * 2.5, 0.0, 1.0);                   /* 멀면 창 무늬가 지글거린다(모아레) — 평균 색으로 */
    vec2 rid = id + vec2(floor(dot(vFW.xz, Nw.xz) * 0.37) * 13.0, 0.0);   /* 맞은편 벽끼리 같은 방이 되지 않게 */
    float hA = fh1(rid), hB = fh2(rid), hC = fh1(rid + 7.3);
    if (inG > 0.5) {
      fGlass = 1.0;
      vec2 q = (f - g0) / (g1 - g0);                                /* 유리 안 0..1 */
      vec3 V = normalize(vFW - cameraPosition);
      float depth = mix(0.9, 1.6, hB);                              /* 방 깊이(유리 폭 배) */
      vec3 r = vec3(dot(V, Tw) / ((g1.x - g0.x) * 1.8), V.y / ((g1.y - g0.y) * 3.6), dot(V, -Nw) / (depth * (g1.x - g0.x) * 1.8));
      r.z = max(r.z, 1e-3);
      vec3 p = vec3(q, 0.0);
      float tx = (step(0.0, r.x) - p.x) / (abs(r.x) > 1e-4 ? r.x : 1e-4), ty = (step(0.0, r.y) - p.y) / (abs(r.y) > 1e-4 ? r.y : 1e-4), tz = 1.0 / r.z;
      tx = abs(tx); ty = abs(ty);
      float t = min(tx, min(ty, tz)); vec3 h = p + r * t;
      /* 방 색 — 벽(따뜻한 회백 / 푸른 사무실 / 낡은 녹), 바닥은 어둡게, 천장은 밝게 */
      vec3 wallC = hA < 0.45 ? vec3(0.42, 0.38, 0.33) : hA < 0.75 ? vec3(0.30, 0.34, 0.40) : vec3(0.30, 0.33, 0.27);
      vec3 col; float shade;
      if (t == tz) { col = wallC; shade = 0.75;
        float furn = step(0.15 + hC * 0.3, h.x) * step(h.x, 0.5 + hC * 0.4) * step(h.y, 0.32 + hB * 0.2);   /* 뒷벽 앞 가구 그림자 */
        col = mix(col, vec3(0.10, 0.09, 0.08), furn * 0.8); }
      else if (t == tx) { col = wallC * 0.9; shade = 0.55 + 0.25 * h.z; }
      else if (r.y < 0.0) { col = vec3(0.16, 0.13, 0.11); shade = 0.6 + 0.3 * (1.0 - h.z); }      /* 바닥 */
      else { col = vec3(0.55, 0.53, 0.50); shade = 0.9; }                                           /* 천장 */
      float lit = step(0.93 - 0.04 * uLampK, hC);                                                    /* 켜진 방 3~11 % */
      float lamp = lit * (0.35 + 0.9 * smoothstep(0.15, 0.75, 1.0 - length(h.xz - vec2(0.5, 0.45)))) * (t == ty && r.y > 0.0 ? 1.25 : 1.0); /* 가운데 천장 등 — 둘레로 갈수록 어둡게 */
      vec3 tint = hB < 0.5 ? vec3(1.0, 0.78, 0.48) : vec3(0.70, 0.88, 1.0);
      vec3 room = col * shade;
      /* 블라인드(위에서 내려옴) · 깨진 창(검게) */
      float blind = step(0.55, fh2(rid + 3.1)) * step(1.0 - fh1(rid + 5.7) * 0.8, q.y);
      float broken = step(0.9, fh1(rid + 11.0));
      room = mix(room, vec3(0.20, 0.19, 0.18) * (0.8 + 0.2 * fract(q.y * 18.0)), blind);
      float frame = 1.0 - step(0.025, q.x) * step(q.x, 0.975) * step(0.03, q.y) * step(q.y, 0.97);   /* 창틀 */
      diffuseColor.rgb = mix(room * 0.15, vec3(0.02), broken);                                        /* 바깥빛을 받는 몫 — 방은 그늘 (0.22 는 낮에 회색으로 떠 대비가 없었다) */
      fEmit = room * tint * lamp * (0.8 + 0.37 * uLampK) * (1.0 - broken);   /* 처음엔 0.9 + 1.6k — 밤에 하얀 판으로 타서(블룸) 방 모양이 안 보였다 */
      /* 유리 반사: 비스듬히 볼수록, 칸 위쪽일수록 하늘빛 */
      float fres = pow(1.0 - abs(dot(V, Nw)), 4.0);
      fEmit += uSkyRefl * (0.08 + 0.5 * fres) * (0.35 + 0.9 * q.y * q.y) * (1.0 - broken) * (1.0 - blind * 0.5) * (1.0 - lit * 0.6);   /* 칸 위쪽일수록 하늘이 밝게 비친다 */
#ifdef CURTAIN
      diffuseColor.rgb = mix(diffuseColor.rgb * 0.45, vec3(0.03, 0.05, 0.08), 0.35);                 /* 색유리 — 방이 덜 비친다 */
      fEmit += uSkyRefl * vec3(0.85, 0.95, 1.15) * (0.16 + 0.35 * fres) * (1.0 - lit * 0.7) * (1.0 - broken);   /* 하늘을 더 비춘다 */
#endif
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.06, 0.07), frame); fEmit *= 1.0 - frame;
    }
    /* 멀리서는 평균: 벽과 유리를 창 몫(cover)만큼 섞은 색 + 켜진 방 평균 — 창 무늬가 지글거리지 않게 (벽 조각도 같이) */
    float cover = (g1.x - g0.x) * (g1.y - g0.y) * step(3.4, y);
    vec3 avgD = mix(wallD, vec3(0.05, 0.05, 0.06), cover), avgEmit = (uSkyRefl * 0.12 + vec3(1.0, 0.85, 0.6) * 0.035 * (0.8 + 0.37 * uLampK)) * cover;
    diffuseColor.rgb = mix(avgD, diffuseColor.rgb, aa); fEmit = mix(avgEmit, fEmit, aa); fGlass = mix(cover, fGlass, aa);
  } }`;

export function patchFacadeMaterial(THREE, m, { curtain = false } = {}) {
  if (curtain) m.defines = { ...(m.defines || {}), CURTAIN: '' };
  if (!FACADE_U.uSkyRefl.value) FACADE_U.uSkyRefl.value = new THREE.Color(0x6a7088);
  const tint = { value: new THREE.Color(1, 1, 1) };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, FACADE_U, { uWallTint: tint });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFW; varying vec3 vFN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFW = (modelMatrix * vec4(transformed, 1.0)).xyz; vFN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + PARS)
      .replace('#include <map_fragment>', '#include <map_fragment>' + BODY)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.18, fGlass);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, fGlass);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fEmit;'); };
  m.customProgramCacheKey = () => curtain ? 'facade-im-curtain' : 'facade-im'; m.needsUpdate = true; return m;
}

/* 벽 텍스처(창 없이 얼룩·빗물 자국만) + 가짜 실내 창 재질 넷 — env-osm(강남)·env-lib(다른 도시) 가 같이 쓴다.
   따로 굴리는 난수 — 장면 난수 R 을 쓰면 뒤의 건물 높이·차 자리가 2D 굽기와 달라진다 */
export function interiorFacadeMats(THREE) {
  return [0, 1, 2, 3].map(k => { let sd = 977 + k * 131; const R = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), w = 128, h = 128;
    g.fillStyle = ['#55535c', '#5f5a60', '#4a505c', '#625b54'][k]; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const v = R(); g.fillStyle = v < .5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.04)'; g.fillRect(R() * w, R() * h, 2 + R() * 10, 2 + R() * 6); }
    for (let i = 0; i < 9; i++) { const x = R() * w; g.fillStyle = 'rgba(10,8,12,.10)'; g.fillRect(x, 0, 1 + R() * 3, h); }   /* 빗물 자국 — 세로 줄 */
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(1 / 9.6, 1 / 9.6);
    return patchFacadeMaterial(THREE, new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.05, map: t })); });
}

/* 유리 커튼월 탑(여의도 등) — 짙은 청회색 판 + 층마다 사무실 */
export function interiorCurtainMat(THREE) { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#3c4656'; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return patchFacadeMaterial(THREE, new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.2 }), { curtain: true }); }

/* 붉은 벽돌 빌라 — 서울 저층(18 m 아래)의 반. 벽돌 0.24 × 0.075 m (한 장 2.4 m 에 10 × 32 줄), 줄눈 · 벽돌마다 색 흔들림 · 그을음 */
export function interiorBrickMats(THREE) {
  return [0, 1].map(k => { let sd = 4111 + k * 97; const R = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    g.fillStyle = k ? '#6a5048' : '#5e3a32'; g.fillRect(0, 0, N, N);   /* 줄눈 */
    const bw = N / 10, bh = N / 32; for (let r = 0; r < 32; r++) for (let i = -1; i < 11; i++) { const x = i * bw + (r % 2) * bw / 2, v = 0.82 + R() * 0.3;
      const base = k ? [140, 96, 78] : [138, 62, 48]; g.fillStyle = `rgb(${base[0] * v | 0},${base[1] * v | 0},${base[2] * v | 0})`; g.fillRect(x + 1, r * bh + 1, bw - 2, bh - 1.5); }
    for (let i = 0; i < 14; i++) { const x = R() * N; g.fillStyle = 'rgba(20,12,10,.12)'; g.fillRect(x, 0, 2 + R() * 6, N); }   /* 빗물 그을음 */
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(1 / 2.4, 1 / 2.4);
    const m = patchFacadeMaterial(THREE, new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0, map: t })); m.name = 'facade-brick'; return m; });
}
/* 건물 하나의 벽 재질 고르기 — 18 m 아래의 반은 벽돌, 나머지는 콘크리트 넷 중 하나 (id 해시만 — 장면 난수 R 을 안 쓴다) */
export function pickFacade(mats, bricks, id, h) { const u = (((id | 0) * 2246822519) >>> 0) / 4294967296; return bricks && h <= 18 && u < 0.5 ? bricks[(id >>> 5) & 1] : mats[(id >>> 3) % mats.length]; }
