import { mergeVertices } from '../../vendor/three/BufferGeometryUtils.js';
/* 사실 같은 바위 (문서 230 §8) — 디렉터 «나무 바위 건물도 언리얼로 좀 사실같이».
   옛 바위: 20 면 다면체를 한 번 쪼개 흔든 것 + 면마다 평평한 음영(flatShading) → «깎은 보석». 바꾼 것:
   - 모양: 한 번 더 쪼갠(320 면) 공을 세 겹 잡음(fBm)으로 부풀리고 바닥은 눌러 앉힌다 · 몇 개는 칼로 자른 듯한 평평한 면(층리)
   - 음영: 부드러운 노멀 + 움푹 들어간 곳 어둡게(꼭짓점 색 = 들어간 정도)
   - 셰이더: 세 방향 투영(triplanar) 잡음으로 돌 결 · 윗면 이끼 · 아래 흙때 — 세계 좌표만 써서 인스턴스 · 합치기 그대로
   장면 난수 R 은 안 쓴다(고정 씨앗) */
import { phTex } from './ph-tex.js';
const h3 = (x, y, z, s) => { let n = Math.imul((Math.round(x * 997) * 73856093) ^ (Math.round(y * 997) * 19349663) ^ (Math.round(z * 997) * 83492791) ^ Math.imul(s, 2654435761), 2246822519); n ^= n >>> 15; return ((n >>> 0) % 10007) / 10007; };
function vnoise(x, y, z, s) { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), f = t => t * t * (3 - 2 * t), u = f(x - i), v = f(y - j), w = f(z - k), L = (a, b, t) => a + (b - a) * t;
  const c = (a, b, d) => h3(i + a, j + b, k + d, s); return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w); }
export function rockGeo(THREE, seed = 11, { cut = true } = {}) {
  const g0 = new THREE.IcosahedronGeometry(1, 2);   /* 180 면 — 320 면은 바위가 많은 곳(계룡)에서 삼각형 +100k 였다 */ g0.deleteAttribute('normal'); g0.deleteAttribute('uv'); const g = mergeVertices(g0), P = g.attributes.position;   /* 면마다 따로인 꼭짓점을 합쳐야 부드러운 노멀이 나온다 */
  const n = P.count, col = new Float32Array(n * 3), cuts = [];
  if (cut) for (let c = 0; c < 3; c++) { const a = h3(c, 1, 2, seed) * 6.283, el = (h3(c, 3, 4, seed) - .3) * 1.2, nx = Math.cos(a) * Math.cos(el), ny = Math.sin(el), nz = Math.sin(a) * Math.cos(el); cuts.push([nx, ny, nz, .55 + h3(c, 5, 6, seed) * .18]); }
  for (let i = 0; i < n; i++) { let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const d = .5 * vnoise(x * 1.3 + 7, y * 1.3, z * 1.3, seed) + .3 * vnoise(x * 3.1, y * 3.1 + 3, z * 3.1, seed + 1) + .2 * Math.abs(vnoise(x * 6.5, y * 6.5, z * 6.5 + 5, seed + 2) - .5) * 2, k = .68 + d * .72;   /* 셋째 겹은 접은 잡음(|n−½|) — 각진 결 */
    x *= k; y *= k * (y < 0 ? .62 : .92); z *= k;
    for (const [cx, cy, cz, cd] of cuts) { const t = x * cx + y * cy + z * cz - cd; if (t > 0) { x -= cx * t; y -= cy * t; z -= cz * t; } }   /* 평평한 깨진 면(층리) */
    if (y < -.35) y = -.35 - (y + .35) * .25;   /* 땅에 박힌 밑동 — 바닥을 눌러 앉힌다 */
    P.setXYZ(i, x, y, z); const ao = Math.min(1, Math.max(.45, .55 + (d - .3) * 1.4)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
}
const ROCK_GLSL = `
varying vec3 vRkW; varying vec3 vRkN;
float rkH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float rkN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rkH(i), rkH(i + vec3(1, 0, 0)), f.x), mix(rkH(i + vec3(0, 1, 0)), rkH(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(rkH(i + vec3(0, 0, 1)), rkH(i + vec3(1, 0, 1)), f.x), mix(rkH(i + vec3(0, 1, 1)), rkH(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float rkF(vec3 p){ return rkN(p) * .5 + rkN(p * 2.7) * .3 + rkN(p * 7.1) * .2; }`;
let MAT = new Map();
/* 바위 재질: 색 hex · moss 이끼 양(0 도시 콘크리트 덩이 ~ 1 숲) */
export function rockMat(THREE, hex, moss = .6, grit = null, { photo = true } = {}) {
  const key = hex + '|' + moss + '|' + photo; if (MAT.has(key)) return MAT.get(key);
  const PD = photo ? phTex(THREE, 'rock_boulder_dry', 'diff') : null, PN = photo ? phTex(THREE, 'rock_boulder_dry', 'nor_gl') : null;   /* 사진 스캔 바위 (Poly Haven CC0) — 세 방향 투영 */
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).lerp(new THREE.Color(0x77736e), .4).multiplyScalar(.9), roughness: .92, metalness: 0, vertexColors: true, map: grit || null });   /* 회색 쪽으로 — 갈색 그대로는 분홍 조약돌 같았다 */
  m.onBeforeCompile = sh => { if (PD) { sh.uniforms.tRkD = { value: PD }; sh.uniforms.tRkN = { value: PN }; }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRkW; varying vec3 vRkN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
{ vec4 rw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  rw = instanceMatrix * rw;
#endif
  vRkW = (modelMatrix * rw).xyz; vec3 rn = objectNormal;
#ifdef USE_INSTANCING
  rn = mat3(instanceMatrix) * rn;
#endif
  vRkN = normalize(mat3(modelMatrix) * rn); }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + ROCK_GLSL + (PD ? '\n#define RK_PHOTO\nuniform sampler2D tRkD; uniform sampler2D tRkN;' : ''))
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{ vec3 an = abs(vRkN); an /= (an.x + an.y + an.z);   /* 세 방향 투영 — 돌 결이 늘어지지 않게 */
  float t = rkF(vRkW.yzx * 2.2) * an.x + rkF(vRkW.xzy * 2.2) * an.y + rkF(vRkW * 2.2) * an.z;
  float vein = smoothstep(.62, .7, rkF(vRkW * vec3(.8, 3.5, .8)));   /* 가는 층 줄 */
  float t2 = rkF(vRkW.yzx * 4.3) * an.x + rkF(vRkW.xzy * 4.3) * an.y + rkF(vRkW * 4.3) * an.z;   /* 잔 결 */
  float crack = (1.0 - smoothstep(.008, .03, abs(rkN(vRkW * vec3(1.6, 4.5, 1.6)) - .5))) * smoothstep(.45, .7, rkN(vRkW * .9 + 3.0));   /* 갈라진 금 — 가늘게, 군데군데만(지도 등고선처럼 고르게 깔렸다) */
#ifdef RK_PHOTO
  vec3 pc = texture2D(tRkD, vRkW.zy * .45).rgb * an.x + texture2D(tRkD, vRkW.xz * .45).rgb * an.y + texture2D(tRkD, vRkW.xy * .45).rgb * an.z;   /* 사진 바위 — 2.2 m 에 한 장 */
  diffuseColor.rgb *= pc * 3.0 * (.85 + t * .3);   /* 사진 평균(선형 ~0.3)을 1 배 쪽으로 — 1.9 배로는 바위가 검었다 */
#else
  diffuseColor.rgb *= (.5 + t * .55) * (.75 + t2 * .5);
#endif
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.3, vein * .45); diffuseColor.rgb *= 1.0 - crack * .4;
  float moss = smoothstep(.35, .8, vRkN.y) * smoothstep(.3, .62, rkF(vRkW * 2.3 + 11.0)) * ${moss.toFixed(2)};   /* 윗면 이끼 · 지의류 */
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.16, .2, .09) * (.8 + t * .5), moss);
  float dirt = 1.0 - smoothstep(.0, .35, vRkW.y); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.15, .12, .09), dirt * .45);   /* 밑동 흙 */
  roughnessFactor = clamp(roughnessFactor - vein * .2 + moss * .05, .4, 1.0); }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef RK_PHOTO
{ vec3 an2 = pow(abs(vRkN), vec3(4.0)); an2 /= (an2.x + an2.y + an2.z);   /* 세 방향 노멀맵(UDN 섞기) — 사진의 굴곡이 빛을 받는다 */
  vec3 tx = texture2D(tRkN, vRkW.zy * .45).xyz * 2.0 - 1.0, ty = texture2D(tRkN, vRkW.xz * .45).xyz * 2.0 - 1.0, tz = texture2D(tRkN, vRkW.xy * .45).xyz * 2.0 - 1.0;
  vec3 nw = normalize(vRkN + (vec3(0.0, tx.y, tx.x) * an2.x + vec3(ty.x, 0.0, ty.y) * an2.y + vec3(tz.x, tz.y, 0.0) * an2.z) * .9);
  normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz); }
#endif`);
  };
  m.customProgramCacheKey = () => 'rock-' + moss.toFixed(2) + (PD ? '-ph' : ''); MAT.set(key, m); return m;
}
