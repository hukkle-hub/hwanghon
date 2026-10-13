/* 빗줄기 (문서 230 §14) — 카메라 앞 상자(28 × 14 × 28 m) 안 가는 줄 n 개(기본 700, 휴대폰 350)를 인스턴스 하나로.
   떨어짐 · 바람 기울기(wind.js 와 같은 방향) · 상자 감싸기 · 카메라 보기(세로축 둘레로만 돌린 판)가 정점 셰이더 — CPU 는 카메라 자리 하나와 세기.
   더하기 섞기 · 깊이 안 씀 · 하늘빛을 받아 밤엔 어둡게. 세기 0 이면 숨긴다(그리기 0) */
import { WIND, WIND_DIR } from './wind.js';
import { WX } from './weather.js';
export function rainStreaks(THREE, { n = 700, box = [28, 14, 28] } = {}) {
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
  const U = { uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...box) }, uCol: { value: new THREE.Color(0.6, 0.62, 0.66) }, uRain: WX.uRain, uWind: WIND };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `uniform vec3 uCam, uBox; uniform float uWind, uRain; varying float vA; varying vec2 vUv;
float rh(float x){ return fract(sin(x * 78.233) * 43758.5453); }
void main() { float id = float(gl_InstanceID); vec3 base = vec3(rh(id + 1.0), rh(id + 2.0), rh(id + 3.0)) * uBox;
  vec2 d = vec2(${WIND_DIR[0]}, ${WIND_DIR[1]}); float sp = 9.0 + 3.0 * rh(id + 4.0);
  vec3 vel = vec3(d.x * 2.2, -sp, d.y * 2.2);
  vec3 lo = uCam - uBox * vec3(0.5, 0.15, 0.5); vec3 wp = lo + mod(base + vel * uWind - lo, uBox);
  vec3 up = -normalize(vel); vec3 toC = cameraPosition - wp; vec3 side = normalize(cross(up, toC)); float len = 0.6 + 0.5 * rh(id + 5.0);
  float keep = step(rh(id + 6.0), uRain);   /* 세기만큼만 남긴다 — 이슬비는 줄이 드물다 */
  vec3 p = wp + side * (position.x * 0.018) + up * (position.y * len) * keep;
  vA = keep * smoothstep(1.0, 4.0, length(toC)) * (1.0 - smoothstep(0.8, 1.0, (wp.y - lo.y) / uBox.y)); vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; varying vec2 vUv;
void main() { float a = vA * (1.0 - abs(vUv.x * 2.0 - 1.0)) * smoothstep(0.0, 0.3, vUv.y) * 0.55; if (a < 0.004) discard; gl_FragColor = vec4(max(uCol, vec3(0.22, 0.23, 0.26)) * a, a);   /* 밤에도 줄이 보이게 바닥값 */ }` });
  const mesh = new THREE.InstancedMesh(g, m, n); mesh.frustumCulled = false; mesh.userData.noCam = true; mesh.name = 'rain'; mesh.renderOrder = 5;
  const I = new THREE.Matrix4(); for (let i = 0; i < n; i++) mesh.setMatrixAt(i, I);
  return { mesh, U, follow(p, f) { U.uCam.value.set(p.x + f.x * 9, p.y, p.z + f.z * 9); mesh.visible = WX.uRain.value > 0.01; } };
}
/* 땅에 튀는 빗방울 (문서 230 §15) — 카메라 앞 땅(14 × 14 m)에 작은 왕관 n 개(기본 220 — 160 · 얇은 고리는 게임 화면에서 안 보였다). 방울마다 0.3 초 한 살이: 퍼지며 옅어지고, 살이마다 자리를 해시로 새로.
   땅은 평평하다고 본다(필드 땅 높이 0) — 옥상 · 차 위엔 안 튄다. 더하기 섞기 · 그리기 1 번 · 비 세기만큼만 */
export function rainSplashes(THREE, { n = 220, box = 14 } = {}) {
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
  const U = { uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uCol: { value: new THREE.Color(0.6, 0.62, 0.66) }, uRain: WX.uRain, uWind: WIND, uY: { value: 0.1 } };   /* uY: 튀는 높이 — 던전 물면(문서 231)은 1 m 넘게 올라간다 */
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetUnits: -40,
    vertexShader: `uniform vec3 uCam; uniform float uBox, uWind, uRain, uY; varying vec2 vUv; varying float vA, vT;
float sh(vec2 x){ return fract(sin(dot(x, vec2(12.9898, 78.233))) * 43758.5453); }
void main() { float id = float(gl_InstanceID), life = 0.3 + 0.1 * sh(vec2(id, 1.0)), tt = uWind / life + sh(vec2(id, 2.0)), cyc = floor(tt); vT = fract(tt);
  vec2 xz = uCam.xz + (vec2(sh(vec2(id, cyc)), sh(vec2(cyc, id + 7.0))) - 0.5) * uBox;
  float keep = step(sh(vec2(id, 3.0)), uRain), sz = (0.12 + 0.26 * vT) * keep;
  vec3 wp = vec3(xz.x, uY, xz.y) + position * sz;   /* 길 윗면이 0.06 m — 0.03 에선 길 밑에 묻혀 안 보였다 */ vUv = uv; vA = keep * (1.0 - vT) * smoothstep(1.5, 3.0, distance(wp, cameraPosition));
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
    fragmentShader: `uniform vec3 uCol; varying vec2 vUv; varying float vA, vT;
void main() { float r = length(vUv * 2.0 - 1.0), ring = exp(-pow((r - 0.72) * 7.0, 2.0)) + 0.8 * exp(-r * r * 12.0) * (1.0 - vT); float a = vA * ring * 0.5;   /* 0.85 · 굵은 고리는 길에 칠한 흰 도넛이었다 */ if (a < 0.004) discard;
  gl_FragColor = vec4(max(uCol, vec3(0.22, 0.23, 0.26)) * a, a); }` });   /* 고리 + 가운데 튐(처음에만) */
  const mesh = new THREE.InstancedMesh(g, m, n); mesh.frustumCulled = false; mesh.userData.noCam = true; mesh.name = 'rain-splash';
  const I = new THREE.Matrix4(); for (let i = 0; i < n; i++) mesh.setMatrixAt(i, I);
  return { mesh, U, follow(p, f) { U.uCam.value.set(p.x + f.x * 7, 0, p.z + f.z * 7); mesh.visible = WX.uRain.value > 0.01; } };
}
