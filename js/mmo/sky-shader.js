/* 3D 필드 하늘 (문서 220) — 노을 그라데이션에 «구름» 과 «겹겹의 산 능선» 을 더한다.
   산은 하늘 돔에 그린다 — 휴대폰은 시야 거리가 240 m 라 진짜 산 모형은 잘린다. 돔은 늘 카메라를 따라오니 «멀리 있는 산» 그대로.
   색은 모두 돔 색(top · hor · fogc · sunc)에서 나온다 → 시간대(문서 217)를 그대로 따라간다. 먼 능선은 안개에 가깝게(공기 원근), 가까운 능선은 짙게.
   ridge = (먼 능선 높이, 가까운 능선 높이, 씨앗) — 높이는 올려다본 각의 sin. 지역 성격(산·강·바다)으로 고른다 (ridgeOf). */
export const SKY_VERT = 'varying vec3 vd; void main(){ vd = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }';
export const SKY_FRAG = `uniform vec3 top, hor, fogc, sun, sunc, ridge; uniform float time, cover; varying vec3 vd;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vd); float y = d.y;
  vec3 c = mix(fogc, hor, smoothstep(-0.02, 0.10, y)); c = mix(c, top, smoothstep(0.10, 0.55, y));
  float a = max(dot(d, sun), 0.0), glow = pow(a, 64.0) * 1.6 + pow(a, 6.0) * 0.28;
  /* 구름: 하늘을 평면에 비춰 fbm — 해 쪽은 테두리가 달아오르고, 반대쪽은 보랏빛 그늘 */
  vec2 uv = d.xz / (y + 0.16) * 1.4 + vec2(time * 0.006, time * 0.002);
  float n = fbm(uv) * 0.75 + fbm(uv * 2.7 + 5.0) * 0.25, dens = smoothstep(cover, cover + 0.22, n) * smoothstep(0.015, 0.16, y) * (1.0 - smoothstep(0.55, 0.9, y) * 0.6);
  vec3 cloud = mix(mix(top, fogc, 0.35) * 0.7, hor * 1.05, smoothstep(0.0, 0.5, y)) ; cloud = mix(cloud, sunc * 1.25 + hor * 0.3, pow(a, 3.0) * 0.85);
  /* 구름 빛 (문서 230 §19): 해 쪽으로 조금 밀어 다시 읽은 밀도와의 차 — 해를 향한 쪽은 밝고 반대쪽 배는 어둡다(한 덩어리 회색 판이었다). 해 가까운 가장자리는 은빛 테 */
  if (dens > 0.002) { float ns = fbm(uv + normalize(sun.xz + 1e-5) * 0.22) * 0.75 + fbm(uv * 2.7 + 5.0) * 0.25, lit = clamp(0.55 + (n - ns) * 3.2, 0.0, 1.0);
    cloud *= mix(0.7, 1.22, lit); cloud += sunc * pow(a, 8.0) * (1.0 - smoothstep(0.0, 0.6, dens)) * 1.1 * smoothstep(-0.02, 0.06, sun.y); }
  /* 별 (문서 220 §13): 하늘 윗색이 어두울수록(밤) — 방향 격자마다 해시 한 점, 구름에 가리고 반짝인다 */
  float dark = 1.0 - smoothstep(0.005, 0.026, dot(top, vec3(0.3, 0.5, 0.2)));   /* 선형 색 윗하늘 밝기(잰 값): 밤 0.0061 → 별 0.99 · 황혼 0.0194 → 0.23 · 새벽 0.061 · 낮 0.128 → 0 */
  if (dark > 0.0 && y > 0.04) { vec2 sp = vec2(atan(d.z, d.x) * 95.0, asin(clamp(y, -1.0, 1.0)) * 95.0); vec2 si = floor(sp), sf = fract(sp) - 0.5; float sh = h2(si), sb = step(0.965, sh);
    vec2 so = vec2(h2(si + 3.1), h2(si + 7.7)) - 0.5; float st = sb * smoothstep(0.16, 0.0, length(sf - so * 0.6)) * (0.55 + 0.45 * sin(time * (1.5 + sh * 3.0) + sh * 40.0));
    c += vec3(0.85, 0.9, 1.0) * st * dark * smoothstep(0.04, 0.25, y) * (1.0 - dens) * 1.3; }
  /* 은하수 (문서 230 §16): 하늘을 비스듬히 가로지르는 띠 — 띠 축에서의 거리로 옅은 빛 + 먼지 갈래(fbm). 밤에만, 구름에 가린다 */
  if (dark > 0.0) { vec3 gp = normalize(vec3(0.42, 0.55, -0.72)); float gb = dot(d, gp), band = exp(-gb * gb * 26.0);
    vec2 gq = vec2(atan(d.z, d.x), gb) * vec2(5.0, 9.0); float dust = fbm(gq * 2.3 + 11.0), mw = band * (0.55 + 0.6 * fbm(gq + 3.0)) * (1.0 - 0.75 * smoothstep(0.45, 0.7, dust) * band);
    c += vec3(0.42, 0.44, 0.56) * 0.11 * mw * dark * smoothstep(0.05, 0.3, y) * (1.0 - dens); }
  /* 달 (문서 230 §16): 밤의 «해» 자리(시간대가 밤엔 달빛 방향을 넘긴다)에 원반 — 위상 그늘 · 얼룩(바다) · 둘레 달무리. 낮엔 dark = 0 이라 없다 */
  float moonA = 0.0; if (dark > 0.0) { float md = acos(clamp(dot(d, sun), -1.0, 1.0)), R = 0.028;
    if (md < R * 1.02) { vec3 ax = normalize(cross(sun, vec3(0.0, 1.0, 0.0)) + 1e-4), ay = cross(ax, sun); vec2 q = vec2(dot(d - sun, ax), dot(d - sun, ay)) / R;
      float disc = 1.0 - smoothstep(0.96, 1.02, length(q)), lit = smoothstep(-0.25, 0.35, q.x * 0.8 + sqrt(max(0.0, 1.0 - dot(q, q))) * 0.6), mare = 0.78 + 0.22 * smoothstep(0.35, 0.65, fbm(q * 2.2 + 4.0));
      moonA = disc * dark; c = mix(c, vec3(1.0, 0.97, 0.9) * (0.03 + 0.42 * lit * mare), moonA * (1.0 - dens * 0.85)); }   /* 1.35 는 밤 노출(1.75) · 번짐에 하얀 덩어리였다 — 위상 · 바다가 보이게 */
    c += vec3(0.55, 0.62, 0.8) * (exp(-md * 18.0) * 0.08 + exp(-md * 60.0) * 0.12) * dark * (1.0 - dens * 0.6); }
  /* 별똥별: 약 20 초에 한 번, 0.6 초 동안 짧은 빛줄 */
  if (dark > 0.3 && y > 0.15) { float k = floor(time / 20.0), tt = fract(time / 20.0) * 20.0 / 0.6; if (tt < 1.0) { float a0 = h2(vec2(k, 1.0)) * 6.283; vec3 p0 = normalize(vec3(cos(a0), 0.45 + 0.4 * h2(vec2(k, 2.0)), sin(a0))), dir = normalize(cross(p0, vec3(h2(vec2(k, 3.0)) - 0.5, 1.0, 0.2)));
      vec3 head = normalize(p0 + dir * tt * 0.25); vec3 rel = d - head; float along = dot(rel, -dir), perp = length(rel + dir * along);
      c += vec3(0.9, 0.95, 1.0) * smoothstep(0.0015, 0.0, perp) * step(0.0, along) * (1.0 - smoothstep(0.0, 0.07, along)) * sin(tt * 3.14159) * dark * (1.0 - dens); } }
  c = mix(c, cloud, dens * 0.85);
  c += sunc * glow * smoothstep(-0.05, 0.05, y) * (1.0 - dens * 0.7) * (1.0 - 0.85 * dark);   /* 밤 «해 번짐» 은 달무리가 대신 */
  /* 산 능선 세 겹 (문서 230 §18) — 방위각 둘레를 따라 이어지는 잡음(원 위의 2D 잡음이라 360° 에서 이음매가 없다).
     예전 두 겹은 둥근 fbm 만이라 «솜 언덕» 이었다 → 날 선 능선(ridged)을 섞고, 가장 먼 겹(높고 옅은 봉우리)을 더하고, 가까운 겹엔 나무 숲 가장자리.
     해 쪽 비탈은 밝게(방위각 기울기 · 해 방위), 겹마다 밑동은 골짜기 안개로 — 겹이 서로 떨어져 보인다 */
  if (y < 0.32) { vec2 ring = normalize(d.xz + 1e-5), rr = vec2(-ring.y, ring.x) * 0.04;
    #define RIDGEH(R, F, S) (0.3 + 0.7 * (0.55 * fbm((R) * F + S) + 0.45 * pow(1.0 - abs(fbm((R) * F * 1.7 + S + 9.0) * 2.0 - 1.0), 2.0)))
    float far3 = ridge.x * 1.32 * RIDGEH(ring, 1.4, ridge.z + 21.0);
    float far = ridge.x * RIDGEH(ring, 2.2, ridge.z), farR = ridge.x * RIDGEH(ring + rr, 2.2, ridge.z);
    float near = ridge.y * (0.25 + 0.75 * fbm(ring * 4.1 + ridge.z * 1.7 + 3.0)), nearR = ridge.y * (0.25 + 0.75 * fbm((ring + rr) * 4.1 + ridge.z * 1.7 + 3.0));
    near += 0.0045 * (n2(ring * 380.0 + 7.0) * 0.7 + n2(ring * 900.0) * 0.3) * smoothstep(0.0, 0.02, near);   /* 나무 숲 가장자리 — 한국 산은 숲이다 */
    vec2 sa = normalize(sun.xz + 1e-5); float sunSide = dot(vec2(-ring.y, ring.x), sa);   /* 해가 이 방위의 어느 쪽인가 */
    float litF = clamp(0.5 + (farR - far) * sunSide * 45.0, 0.0, 1.0), litN = clamp(0.5 + (nearR - near) * sunSide * 45.0, 0.0, 1.0), toSun = pow(max(dot(ring, sa), 0.0), 3.0);
    litF = mix(0.5, litF, smoothstep(far * 0.45, far, y)); litN = mix(0.5, litN, smoothstep(near * 0.45, near, y));   /* 비탈 명암은 마루 가까이만 — 위아래 통째로면 세로 «커튼» 줄무늬였다 */
    vec3 f3C = mix(fogc, mix(hor, top, 0.25), 0.22), farC = mix(fogc, mix(hor, top, 0.4) * 0.82, 0.38), nearC = mix(fogc, mix(top, hor, 0.3) * 0.5, 0.62);
    farC *= 0.92 + 0.16 * litF; nearC *= 0.88 + 0.24 * litN;
    float in3 = 1.0 - smoothstep(far3 - 0.005, far3 + 0.002, y), inFar = 1.0 - smoothstep(far - 0.004, far + 0.002, y), inNear = 1.0 - smoothstep(near - 0.002, near + 0.0015, y), above = step(0.0, y + 0.02);
    c = mix(c, mix(fogc, f3C, smoothstep(-0.01, far3, y) * 0.7 + 0.15) + sunc * glow * 0.35 + sunc * toSun * 0.06, in3 * above * (1.0 - dens * 0.5));
    c = mix(c, mix(fogc * 1.05, farC, smoothstep(-0.01, far, y) * 0.85 + 0.1) + sunc * glow * 0.25 + sunc * toSun * 0.04 * litF, inFar * above);
    c = mix(c, mix(fogc, nearC, smoothstep(-0.01, near, y) * 0.75 + 0.25), inNear * above);
    c = mix(c, fogc * 1.08 + sunc * glow * 0.15, (1.0 - smoothstep(0.0, 0.03, y)) * 0.3 * above); }   /* 골짜기에 깔린 옅은 안개 띠 */
  /* 새털구름 (문서 230 §18): 높은 하늘의 가는 줄 — 해 쪽은 달아오른다 */
  if (y > 0.08) { vec2 cu = vec2(d.x * 0.8 + d.z * 0.6, -d.x * 0.6 + d.z * 0.8) / (y + 0.35) * vec2(0.7, 3.2) + vec2(time * 0.004, 0.0); float ci = smoothstep(0.55, 0.8, fbm(cu * 1.3 + 31.0)) * smoothstep(0.08, 0.3, y) * (1.0 - dens);
    c = mix(c, mix(hor, top, 0.3) * 1.15 + sunc * pow(a, 4.0) * 0.6, ci * 0.25 * (1.0 - dark * 0.7)); }
  gl_FragColor = vec4(c, 1.0);
}`;
/* 지역 성격 → 능선 높이 (sin 단위). 한국은 어디서나 산이 보이지만 바다 쪽은 낮게 */
export function ridgeOf(kind, seed = 1) {
  /* 3인칭 카메라는 낮아서 50~100 m 앞 폐허가 지평선 위 5° 쯤을 가린다 — 춘천의 산(3~5 km 밖 600 m)은 7~11° 로 그 위에 올라와야 보인다 */
  const H = { mountain: [0.19, 0.12], river: [0.17, 0.1], rural: [0.14, 0.085], historic: [0.13, 0.08], industrial: [0.11, 0.065], city: [0.11, 0.065], hub: [0.12, 0.07], coast: [0.09, 0.05], island: [0.13, 0.06] }[kind] || [0.12, 0.07];
  return [H[0], H[1], (seed % 97) * 0.37]; }
/* 물에 비친 하늘 (문서 220 §6) — 같은 그라데이션 + 같은 능선을 반사 방향으로. 구름·해는 뺀다(물이 따로 반짝임을 그린다). 이름은 겹치지 않게 sk 접두 */
export const SKY_REFL = `uniform vec3 uRidge;
float skH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float skN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(skH(i), skH(i + vec2(1.0, 0.0)), f.x), mix(skH(i + vec2(0.0, 1.0)), skH(i + vec2(1.0, 1.0)), f.x), f.y); }
float skF(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * skN(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
vec3 skyRefl(vec3 d){ float y = d.y; vec3 c = mix(uFogc, uHor, smoothstep(-0.02, 0.10, y)); c = mix(c, uTop, smoothstep(0.10, 0.55, y));
  if (y > uRidge.x * 1.32 + 0.01) return c;   /* 가장 먼 봉우리보다 높이 비치면 잡음을 건너뛴다 (물 픽셀마다 돈다) */
  /* 하늘 돔과 같은 세 겹 · 같은 날 선 능선 (문서 230 §18·§19) — 물에 비친 산이 하늘 산과 같은 모양. 비탈 명암 · 숲 가장자리는 뺀다(물결에 어차피 흩어진다) */
  vec2 ring = normalize(d.xz + 1e-5);
  float far3 = uRidge.x * 1.32 * (0.3 + 0.7 * (0.55 * skF(ring * 1.4 + uRidge.z + 21.0) + 0.45 * pow(1.0 - abs(skF(ring * 2.38 + uRidge.z + 30.0) * 2.0 - 1.0), 2.0)));
  float far = uRidge.x * (0.3 + 0.7 * (0.55 * skF(ring * 2.2 + uRidge.z) + 0.45 * pow(1.0 - abs(skF(ring * 3.74 + uRidge.z + 9.0) * 2.0 - 1.0), 2.0)));
  float near = uRidge.y * (0.25 + 0.75 * skF(ring * 4.1 + uRidge.z * 1.7 + 3.0));
  vec3 f3C = mix(uFogc, mix(uHor, uTop, 0.25), 0.22), farC = mix(uFogc, mix(uHor, uTop, 0.4) * 0.82, 0.38), nearC = mix(uFogc, mix(uTop, uHor, 0.3) * 0.5, 0.62);
  c = mix(c, mix(uFogc, f3C, smoothstep(-0.01, far3, y) * 0.7 + 0.15), 1.0 - smoothstep(far3 - 0.006, far3 + 0.004, y));
  c = mix(c, mix(uFogc * 1.05, farC, smoothstep(-0.01, far, y) * 0.85 + 0.1), 1.0 - smoothstep(far - 0.006, far + 0.004, y));
  c = mix(c, mix(uFogc, nearC, smoothstep(-0.01, near, y) * 0.75 + 0.25), 1.0 - smoothstep(near - 0.005, near + 0.004, y));
  return c; }
`;
