/* 젖은 길 웅덩이 (문서 229 §10) — 스파이더맨의 밤거리는 길이 젖어 하늘·불빛을 비춘다.
   반사 버퍼(SSR·평면 반사)는 휴대폰에 비싸다 → 길 재질 하나에 셈만 더한다:
   - 자기 세계 좌표(xz)의 값 잡음 두 겹으로 웅덩이 자리(약 1/5)를 잡고, 둘레는 «젖은 띠»(어둡게·덜 거칠게)
   - 웅덩이 안은 거칠기 0.05 — 가로등(점광원)·해가 또렷이 맺힌다
   - 하늘빛 반사: 시선을 바닥에 꺾은 방향의 높이로 지금 하늘빛(FACADE_U.uSkyRefl, 시간대가 매 프레임)을 프레넬만큼 더한다
   텍스처를 더 읽지 않는다. PUDDLE.on 을 world3d 가 ?wet=0 으로 끈다 */
import { FACADE_U } from './facade-shader.js';
export const PUDDLE = { on: true };
const PARS = `
varying vec3 vPW;
uniform vec3 uSkyRefl; uniform float uLampK;
float ph(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ph(i), ph(i + vec2(1, 0)), f.x), mix(ph(i + vec2(0, 1)), ph(i + vec2(1, 1)), f.x), f.y); }
`;
/* 웅덩이 세기 pw(0..1) · 젖음 wet(0..1). 4.5 m 칸마다 40 % 는 비우고 60 % 에 비스듬한 타원 웅덩이 하나(긴 반지름 0.9~2.5 m) — 이웃 9 칸 중 가장 가까운 것.
   가장자리는 0.8 m 잔 잡음으로 흔든다. 값 잡음 문턱(1·2판)은 등고선이 구불구불한 물줄기처럼 이어져 웅덩이가 아니라 기름 줄 같았다 */
const BODY = `
float pd = 9.0; vec2 pg = floor(vPW.xz / 4.5);
for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 c = pg + vec2(float(i), float(j)); float h0 = ph(c), h1 = ph(c + 31.7), h2 = ph(c + 57.3), h3 = ph(c + 91.1);
  if (h0 < 0.6) { vec2 o = vPW.xz - (c + vec2(0.2 + 0.6 * h1, 0.2 + 0.6 * h2)) * 4.5; float a = h3 * 6.2832, ca = cos(a), sa = sin(a);
    vec2 q = vec2(ca * o.x + sa * o.y, -sa * o.x + ca * o.y); float rx = 0.9 + 1.6 * h1; pd = min(pd, length(q / vec2(rx, rx * (0.45 + 0.5 * h2)))); } }
pd += (pn(vPW.xz / 0.8) - 0.5) * 0.4;
float pw = 1.0 - smoothstep(0.88, 1.0, pd), wet = 1.0 - smoothstep(1.0, 1.7, pd);
diffuseColor.rgb *= mix(1.0, 0.7, wet) * mix(1.0, 0.5, pw);
`;
const REFL = `
{ vec3 V = normalize(vPW - cameraPosition); float cosV = max(0.0, -V.y), fres = pow(1.0 - cosV, 4.0);
  totalEmissiveRadiance += uSkyRefl * pw * (0.55 + 1.1 * fres) * (1.0 + 0.25 * uLampK); }
`;
export function patchPuddleMaterial(THREE, m) {
  if (!PUDDLE.on) return m;
  if (!FACADE_U.uSkyRefl.value) FACADE_U.uSkyRefl.value = new THREE.Color(0x6a7088);
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, { uSkyRefl: FACADE_U.uSkyRefl, uLampK: FACADE_U.uLampK });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + PARS)
      .replace('#include <map_fragment>', '#include <map_fragment>' + BODY)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.2, wet); roughnessFactor = mix(roughnessFactor, 0.05, pw);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, pw);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + REFL); };
  m.customProgramCacheKey = () => 'puddle'; m.needsUpdate = true; return m;
}
