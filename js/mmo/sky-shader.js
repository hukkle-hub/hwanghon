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
  /* 별 (문서 220 §13): 하늘 윗색이 어두울수록(밤) — 방향 격자마다 해시 한 점, 구름에 가리고 반짝인다 */
  float dark = 1.0 - smoothstep(0.005, 0.026, dot(top, vec3(0.3, 0.5, 0.2)));   /* 선형 색 윗하늘 밝기(잰 값): 밤 0.0061 → 별 0.99 · 황혼 0.0194 → 0.23 · 새벽 0.061 · 낮 0.128 → 0 */
  if (dark > 0.0 && y > 0.04) { vec2 sp = vec2(atan(d.z, d.x) * 95.0, asin(clamp(y, -1.0, 1.0)) * 95.0); vec2 si = floor(sp), sf = fract(sp) - 0.5; float sh = h2(si), sb = step(0.965, sh);
    vec2 so = vec2(h2(si + 3.1), h2(si + 7.7)) - 0.5; float st = sb * smoothstep(0.16, 0.0, length(sf - so * 0.6)) * (0.55 + 0.45 * sin(time * (1.5 + sh * 3.0) + sh * 40.0));
    c += vec3(0.85, 0.9, 1.0) * st * dark * smoothstep(0.04, 0.25, y) * (1.0 - dens) * 1.3; }
  c = mix(c, cloud, dens * 0.85);
  c += sunc * glow * smoothstep(-0.05, 0.05, y) * (1.0 - dens * 0.7);
  /* 산 능선 두 겹 — 방위각 둘레를 따라 이어지는 잡음(원 위의 2D 잡음이라 360° 에서 이음매가 없다) */
  vec2 ring = normalize(d.xz + 1e-5);
  float far = ridge.x * (0.35 + 0.65 * fbm(ring * 2.2 + ridge.z)), near = ridge.y * (0.25 + 0.75 * fbm(ring * 4.1 + ridge.z * 1.7 + 3.0));
  vec3 farC = mix(fogc, mix(hor, top, 0.4) * 0.82, 0.38), nearC = mix(fogc, mix(top, hor, 0.3) * 0.5, 0.62);
  float inFar = 1.0 - smoothstep(far - 0.004, far + 0.002, y), inNear = 1.0 - smoothstep(near - 0.003, near + 0.002, y);
  c = mix(c, mix(fogc, farC, smoothstep(-0.01, far, y) * 0.8 + 0.2) + sunc * glow * 0.25, inFar * step(0.0, y + 0.02));
  c = mix(c, mix(fogc, nearC, smoothstep(-0.01, near, y) * 0.7 + 0.3), inNear * step(0.0, y + 0.02));
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
  if (y > uRidge.x + 0.01) return c;   /* 능선보다 높이 비치면 fbm 8번을 건너뛴다 (물 픽셀마다 돈다) */
  vec2 ring = normalize(d.xz + 1e-5); float far = uRidge.x * (0.35 + 0.65 * skF(ring * 2.2 + uRidge.z)), near = uRidge.y * (0.25 + 0.75 * skF(ring * 4.1 + uRidge.z * 1.7 + 3.0));
  vec3 farC = mix(uFogc, mix(uHor, uTop, 0.4) * 0.82, 0.38), nearC = mix(uFogc, mix(uTop, uHor, 0.3) * 0.5, 0.62);
  c = mix(c, mix(uFogc, farC, smoothstep(-0.01, far, y) * 0.8 + 0.2), 1.0 - smoothstep(far - 0.006, far + 0.004, y));
  c = mix(c, mix(uFogc, nearC, smoothstep(-0.01, near, y) * 0.7 + 0.3), 1.0 - smoothstep(near - 0.005, near + 0.004, y));
  return c; }
`;
