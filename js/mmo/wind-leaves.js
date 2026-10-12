/* 바람에 날리는 잎 (문서 230 §13) — 엘든 링 들판의 «공중에 떠 흐르는 잎 · 꽃잎». 카메라 앞 상자(24 × 8 × 24 m) 안에서만,
   잎 n 장(기본 90, 휴대폰 60)을 인스턴스 하나로. 자리 · 흐름 · 돌기 · 감싸기(상자 밖으로 나가면 반대편에서)가 전부 정점 셰이더 — CPU 는 매 프레임 카메라 자리 하나만 넘긴다.
   바람 방향 · 돌풍은 나무와 같은 식(wind.js) — 돌풍이 지나갈 때 잎도 빨라진다. 그리기 호출 1 · 삼각형 2n */
import { WIND, WIND_PARS, WIND_DIR } from './wind.js';
export function windLeaves(THREE, { n = 90, box = [24, 8, 24], color = 0x8a6a3a } = {}) {
  const g = new THREE.PlaneGeometry(0.17, 0.1); const m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  const uBoxY = box[1], U = { uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...box) } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U, { uWind: WIND });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uCam, uBox; varying vec2 vLeafUv; varying float vLeafTint;' + WIND_PARS
      + 'float lh(float x){ return fract(sin(x * 91.17) * 43758.5453); }\nmat3 lrot(vec3 a, float t){ a = normalize(a); float c = cos(t), s = sin(t), k = 1.0 - c; return mat3(c + a.x*a.x*k, a.y*a.x*k + a.z*s, a.z*a.x*k - a.y*s, a.x*a.y*k - a.z*s, c + a.y*a.y*k, a.z*a.y*k + a.x*s, a.x*a.z*k + a.y*s, a.y*a.z*k - a.x*s, c + a.z*a.z*k); }')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nfloat lid = float(gl_InstanceID); mat3 LR = lrot(vec3(lh(lid) - 0.5, lh(lid + 3.1) - 0.5, lh(lid + 7.7) - 0.5) + 0.01, uWind * (2.0 + 3.0 * lh(lid + 1.3)) + lid);\nobjectNormal = LR * objectNormal;')
      .replace('#include <project_vertex>', `vec3 base = vec3(lh(lid + 11.0), lh(lid + 23.0), lh(lid + 37.0)) * uBox;
  vec2 d = vec2(${WIND_DIR[0]}, ${WIND_DIR[1]}); float sp = 1.6 + 1.4 * lh(lid + 5.0);
  vec3 drift = vec3(d.x, 0.0, d.y) * uWind * sp + vec3(sin(uWind * 1.3 + lid) * 0.6, -uWind * (0.35 + 0.3 * lh(lid + 9.0)) + sin(uWind * 2.1 + lid * 1.7) * 0.25, cos(uWind * 1.1 + lid) * 0.6);
  vec3 lo = uCam - uBox * vec3(0.5, 0.1, 0.5); vec3 wp = lo + mod(base + drift - lo, uBox);   /* 상자 감싸기 — 카메라를 따라온다 */
  wp += vec3(d.x, 0.0, d.y) * windGust(wp.xz) * 0.8;
  float fade = smoothstep(0.0, 0.12, wp.y - lo.y) * (1.0 - smoothstep(0.85, 1.0, (wp.y - lo.y) / uBox.y)) * smoothstep(1.5, 3.5, distance(wp, cameraPosition));   /* 코앞 잎은 흐릿한 검은 원판이었다 — 3.5 m 안에서 줄인다 */   /* 상자 위 · 아래 끝에서 줄어 사라진다 — 감싸기에서 튀지 않게 */
  vec4 mvPosition = modelViewMatrix * vec4(wp + LR * (transformed * fade), 1.0); gl_Position = projectionMatrix * mvPosition; vLeafUv = uv; vLeafTint = lh(lid + 17.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vLeafUv; varying float vLeafTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n{ vec2 q = vLeafUv * 2.0 - 1.0; if (dot(q, q) > 1.0 - 0.35 * abs(q.x)) discard; diffuseColor.rgb *= mix(vec3(0.75, 0.85, 0.55), vec3(1.25, 0.8, 0.5), vLeafTint); }'); };   /* 잎 꼴(끝이 뾰족한 타원) · 잎마다 초록~갈색 */
  m.customProgramCacheKey = () => 'wind-leaves';
  const mesh = new THREE.InstancedMesh(g, m, n); mesh.frustumCulled = false; mesh.castShadow = false; mesh.userData.noCam = true; mesh.name = 'wind-leaves';
  const I = new THREE.Matrix4(); for (let i = 0; i < n; i++) mesh.setMatrixAt(i, I);
  /* p = 카메라 자리, f = 보는 방향 — 상자를 앞쪽 8 m 로 옮겨 화면을 채운다. 높이는 땅(gy)부터 8 m */
  return { mesh, follow(p, f, gy = 0) { U.uCam.value.set(p.x + f.x * 8, gy + uBoxY * 0.1, p.z + f.z * 8); } };
}
