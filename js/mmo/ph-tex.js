/* Poly Haven 사진 텍스처 (CC0, art/tex/ph/README.txt) — 문서 230 §10. Megascans 영상(문서 133)의 «사실감의 절반은 사진 스캔 질감».
   주소는 이 모듈 자리에서 만든다 — world3d · tools/3d 시트 어디서 불러도 같은 파일. 한 번만 받는다(캐시) */
const BASE = new URL('../../art/tex/ph/', import.meta.url).href, CACHE = new Map();
export const PH_NAMES = ['rock_boulder_dry', 'japanese_zelkova_bark', 'concrete_wall_006'];
export function phTex(THREE, name, map, { repeat = null, color = map === 'diff' } = {}) {
  const key = name + '_' + map; let t = CACHE.get(key);
  if (!t) { t = new THREE.TextureLoader().load(BASE + key + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (color) t.colorSpace = THREE.SRGBColorSpace; CACHE.set(key, t); }
  if (repeat) { t = t.clone(); t.repeat.set(repeat[0], repeat[1]); t.needsUpdate = true; }   /* 반복이 다른 쓰임은 복제(같은 그림) */
  return t;
}
