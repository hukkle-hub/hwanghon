/* 바람 (문서 230 §13) — 엘든 링 림그레이브의 «들판을 건너가는 바람». 셈만 더하고 텍스처 · 그리기 호출은 그대로.
   - 돌풍: 바람 방향으로 ~9 m/s 로 건너가는 큰 물결(세기 0.25~1). 한 그루씩 따로 흔들리지 않고 «무리가 차례로» 눕는다
   - 휨: 세계 높이²(5 m 기준)에 비례 — 줄기와 갓이 같은 식이라 같은 높이에서 같이 움직인다(옛 바람은 갓만 통째로 밀려 줄기에서 미끄러졌다)
   - 잎 떨림: 잎 카드 꼭짓점마다 빠른 작은 떨림(flutter) — 돌풍이 지나갈 때 커진다
   인스턴싱 뒤 · 뷰 행렬 앞(세계 공간)에서 더한다 — 인스턴스마다 돌림 · 크기가 달라도 바람 방향이 하나다. 그림자 깊이 재질엔 안 붙는다(그림자는 그대로) */
export const WIND = { value: 0 };   /* world3d 가 매 프레임 올린다 */
export const WIND_DIR = [0.82, 0.57];
export const WIND_PARS = `
uniform float uWind;
float windGust(vec2 p) { float ph = dot(p, vec2(${WIND_DIR[0]}, ${WIND_DIR[1]})) * 0.06 - uWind * 0.55;
  return 0.25 + 0.75 * smoothstep(-0.3, 1.0, sin(ph) * 0.65 + sin(ph * 0.41 + 1.7) * 0.35); }
vec3 windDisp(vec3 w, float flut) { vec2 d = vec2(${WIND_DIR[0]}, ${WIND_DIR[1]}); float g = windGust(w.xz), h = clamp(w.y / 5.0, 0.0, 1.6), bend = h * h;
  float sw = 0.55 + 0.45 * sin(uWind * 1.6 + dot(w.xz, vec2(0.31, 0.23)));
  vec3 o = vec3(d.x, 0.0, d.y) * (0.3 * g * sw * bend);
  o.xz += vec2(-d.y, d.x) * (sin(uWind * 2.3 + w.x * 0.4) * 0.05 * g * bend);
  o += flut * g * 0.05 * vec3(sin(uWind * 7.0 + dot(w, vec3(2.3, 1.9, 3.1))), 0.6 * sin(uWind * 8.3 + dot(w, vec3(1.7, 3.3, 2.1))), cos(uWind * 6.1 + dot(w, vec3(3.1, 2.2, 1.6))));
  return o; }
`;
const PROJECT = `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition.xyz += windDisp((modelMatrix * mvPosition).xyz, WIND_FLUT);
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`;
/* flut: 잎 떨림 세기(줄기 0 · 잎 1) */
export function windify(m, { flut = 1 } = {}) { if (m.userData.wind) return m; m.userData.wind = true; m.userData.windFlut = flut;
  m.onBeforeCompile = sh => { sh.uniforms.uWind = WIND;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n#define WIND_FLUT ' + flut.toFixed(2) + WIND_PARS).replace('#include <project_vertex>', PROJECT); };
  m.customProgramCacheKey = () => 'wind2-' + flut.toFixed(2); m.needsUpdate = true; return m; }
