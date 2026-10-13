/* 밤 연출 (문서 230 §22) — 탐조등 · 반딧불. 둘 다 그리기 1 번씩, 밤(가로등 세기 lampK)에만 보인다.
   탐조등: 생존자 거점이 하늘을 훑는 빛기둥 2~3 줄. 카메라에서 140~190 m 떨어진 고정 방위(지역 씨앗)에 세우고 천천히 흔든다 — 밑동은 폐허에 가려도 된다.
   반딧불: 카메라 앞 상자(20 × 3 × 20 m) 안 노란 점 n 개 — 숲 · 들 지역만. 자리 · 깜빡임 · 감싸기가 정점 셰이더 */
import { WIND } from './wind.js';
export function searchlights(THREE, { seed = 1, n = 3 } = {}) {
  const g = new THREE.CylinderGeometry(26, 0.8, 1, 20, 1, true);   /* 위 지름 52 m — 4 m 는 190 m 밖에서 한두 픽셀 실선이라 안 보였다 */ g.translate(0, 0.5, 0);   /* 위로 넓어지는 원뿔 — 높이 1, 아래가 밑동 */
  const U = { uK: { value: 0 }, uCol: { value: new THREE.Color(0.75, 0.82, 1.0) } };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying float vH; varying vec3 vN, vV; void main(){ vH = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',   /* normalMatrix(역전치) — 세로 520 배 늘림에 mat3(modelMatrix) 를 쓰면 법선이 수직으로 누워 빛이 0 이었다 */
    fragmentShader: 'uniform float uK; uniform vec3 uCol; varying float vH; varying vec3 vN, vV; void main(){ float rim = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);   /* 가운데(정면)가 짙고 둘레는 옅게 — 기둥 부피 흉내 */\n'
      + ' float a = uK * rim * (1.0 - smoothstep(0.15, 1.0, vH)) * smoothstep(0.0, 0.03, vH) * 0.32; if (a < 0.002) discard; gl_FragColor = vec4(uCol * a, a); }' });
  const group = new THREE.Group(), beams = []; let s = seed >>> 0 || 1; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) { const b = new THREE.Mesh(g, m); b.frustumCulled = false; b.userData.noCam = true; b.renderOrder = 4; b.scale.set(1, 520, 1);
    b.userData.sl = { az: R() * 6.283, dist: 140 + R() * 50, ph: R() * 6.283, sp: 0.18 + R() * 0.17, tilt: 0.22 + R() * 0.2 }; group.add(b); beams.push(b); }
  group.name = 'searchlights';
  return { group, U, update(cam, t, k) { U.uK.value = k; group.visible = k > 0.01; if (!group.visible) return;
    for (const b of beams) { const o = b.userData.sl; b.position.set(cam.x + Math.cos(o.az) * o.dist, 0, cam.z + Math.sin(o.az) * o.dist);   /* 카메라를 따라와 늘 저 멀리 있다 */
      b.rotation.set(Math.sin(t * o.sp + o.ph) * o.tilt + 0.1, o.az, Math.cos(t * o.sp * 0.7 + o.ph) * o.tilt, 'YXZ'); } } };
}
export function fireflies(THREE, { n = 90, box = [20, 3, 20] } = {}) {
  const g = new THREE.PlaneGeometry(0.16, 0.16);
  const U = { uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...box) }, uK: { value: 0 }, uWind: WIND };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `uniform vec3 uCam, uBox; uniform float uWind, uK; varying vec2 vUv; varying float vA;
float fh(float x){ return fract(sin(x * 91.7) * 43758.5453); }
void main(){ float id = float(gl_InstanceID); vec3 base = vec3(fh(id + 1.0), fh(id + 2.0), fh(id + 3.0)) * uBox;
  vec3 drift = vec3(sin(uWind * 0.31 + id) * 1.4, sin(uWind * 0.53 + id * 1.7) * 0.5, cos(uWind * 0.27 + id * 2.3) * 1.4);
  vec3 lo = uCam - uBox * vec3(0.5, 0.0, 0.5); vec3 wp = lo + mod(base + drift - lo, uBox) + vec3(0.0, 0.25, 0.0);
  float blink = smoothstep(0.55, 0.9, sin(uWind * (0.9 + fh(id + 4.0) * 1.2) + id * 5.1) * 0.5 + 0.5);
  vA = uK * blink * smoothstep(1.0, 3.0, distance(wp, cameraPosition)); vUv = uv;
  vec4 mv = viewMatrix * vec4(wp, 1.0); mv.xy += position.xy * (1.0 + 0.012 * -mv.z);   /* 화면을 향한 점 — 멀어도 너무 작아지지 않게 */
  gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying vec2 vUv; varying float vA; void main(){ float r = length(vUv * 2.0 - 1.0), a = vA * (exp(-r * r * 9.0) + 0.35 * exp(-r * r * 2.2)); if (a < 0.003) discard; gl_FragColor = vec4(vec3(0.75, 1.0, 0.35) * a * 1.8, a); }' });
  const mesh = new THREE.InstancedMesh(g, m, n); mesh.frustumCulled = false; mesh.userData.noCam = true; mesh.name = 'fireflies';
  const I = new THREE.Matrix4(); for (let i = 0; i < n; i++) mesh.setMatrixAt(i, I);
  return { mesh, U, follow(p, f, k) { U.uK.value = k; mesh.visible = k > 0.01; U.uCam.value.set(p.x + f.x * 7, 0, p.z + f.z * 7); } };
}
