/* Poly Haven 사진 텍스처 (CC0, art/tex/ph/README.txt) — 문서 230 §10. Megascans 영상(문서 133)의 «사실감의 절반은 사진 스캔 질감».
   주소는 이 모듈 자리에서 만든다 — world3d · tools/3d 시트 어디서 불러도 같은 파일. 한 번만 받는다(캐시) */
const BASE = new URL('../../art/tex/ph/', import.meta.url).href, CACHE = new Map();
export const PH_NAMES = ['rock_boulder_dry', 'japanese_zelkova_bark', 'concrete_wall_006', 'red_brick', 'brick_wall_10', 'concrete_layers', 'concrete_debris', 'asphalt_02', 'concrete_pavers', 'sparse_grass', 'forest_leaves_02', 'dense_sand', 'forest_ground_04'];
export const PH_ROUGH = new Set(['rock_boulder_dry', 'japanese_zelkova_bark', 'concrete_wall_006']);   /* 거칠기 사진까지 있는 것 — 뒤 다섯은 색·노멀만 */
export function phTex(THREE, name, map, { repeat = null, color = map === 'diff' } = {}) {
  const key = name + '_' + map; let t = CACHE.get(key);
  const canLoad = typeof document !== 'undefined' && typeof document.createElementNS === 'function';   /* 노드 시험(가짜 document)에선 빈 텍스처 — 장면 짓기 시험이 이미지 로더에서 죽었다 */
  if (!t) { t = canLoad ? new THREE.TextureLoader().load(BASE + key + '.jpg') : new THREE.Texture(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (color) t.colorSpace = THREE.SRGBColorSpace; CACHE.set(key, t); }
  if (repeat) { t = t.clone(); t.repeat.set(repeat[0], repeat[1]); t.needsUpdate = true; }   /* 반복이 다른 쓰임은 복제(같은 그림) */
  return t;
}
/* 색 + 노멀 한 벌 (MeshStandardMaterial 인자). 거칠기 사진은 안 쓴다 — 휴대폰에서 한 장이라도 덜 읽게, 거칠기는 재질 값 하나로 */
export function phPair(THREE, name, { repeat = [1, 1], normalScale = 1 } = {}) {
  return { map: phTex(THREE, name, 'diff', { repeat }), normalMap: phTex(THREE, name, 'nor_gl', { repeat }), normalScale: new THREE.Vector2(normalScale, normalScale) };
}
/* 반복 깨기 (문서 230 §11): 3 m 사진을 길 수백 m 에 깔면 같은 금이 3.5 m 마다 줄지어 «마룻바닥» 이 된다(멀리서).
   이니고 킬레스(IQ) «texture repetition» 3번 방식: 값 잡음 한 번으로 칸마다 다른 «밀어 읽기» 두 개를 골라 섞는다(처음엔 밉맵 끊김 없게 기울기 지정 읽기였지만 휴대폰 무게로 보통 읽기로 — 문서 230 §23).
   37° 돌려 한 번 더 읽는 방식은 섞인 곳만 깨지고 금줄 격자는 그대로였다(시트에서 재 봄). 노멀도 같은 밀기·같은 섞음이라 금과 그늘이 맞는다.
   셰이더 문자열만 바꾼다(onBeforeCompile 안에서 부른다). 텍스처를 더 받지 않고 읽기만 색 1 번 · 노멀 1 번 늘어난다 */
export const ANTI_TILE = { on: true };   /* world3d ?at=0 — 휴대폰 무게 가르기 */
export function antiTile(sh, THREE) {
  if (!ANTI_TILE.on) return sh;
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
float atH(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
float atN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(atH(i), atH(i + vec2(1, 0)), f.x), mix(atH(i + vec2(0, 1)), atH(i + vec2(1, 1)), f.x), f.y); }`)
    .replace('#include <map_fragment>', `vec2 atOa = vec2(0.0), atOb = vec2(0.0); float atW = 0.0;
#ifdef USE_MAP
  { float l = atN(vMapUv * 1.3) * 8.0, ia = floor(l); atOa = sin(vec2(3.0, 7.0) * ia); atOb = sin(vec2(3.0, 7.0) * (ia + 1.0));
    vec4 ca = texture2D(map, vMapUv + atOa), cb = texture2D(map, vMapUv + atOb);   /* 기울기 지정 읽기(Grad)는 휴대폰 · 소프트 렌더에서 비싸다 — 칸 경계 2×2 화소에서만 밉맵이 한 단계 튄다(거의 안 보인다) */
    atW = smoothstep(0.2, 0.8, fract(l) - 0.1 * dot(ca.rgb - cb.rgb, vec3(1.0))); diffuseColor *= mix(ca, cb, atW); }
#endif
/*@map_fragment*/`)   /* 표지: 뒤에 붙는 패치(world3d 땅 결 · 구름 그림자)가 #include <map_fragment> 대신 여기에 잇는다 — 없으면 사진 땅만 결이 사라진다 */
    .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `vec3 mapN = texture2D( normalMap, vNormalMapUv + (atW > 0.5 ? atOb : atOa) ).xyz * 2.0 - 1.0;`));   /* 노멀은 한 번만 — 가까운 쪽 밀기를 고른다. 둘을 섞어 두 번 읽던 것이 땅 전체에서 프레임 1/5 이었다(문서 230 §23). #include 는 onBeforeCompile 뒤에 풀린다 — 덩어리를 직접 펼쳐서 바꾼다 */
  return sh;
}
export function antiTileMat(THREE, m) { m.onBeforeCompile = sh => antiTile(sh, THREE); m.customProgramCacheKey = () => 'anti-tile'; m.needsUpdate = true; return m; }
