/* 유리에 비치는 도시 (문서 229 §12) — 스파이더맨의 유리 탑은 주변 건물을 비춘다. 실시간 반사(SSR·탑마다 큐브)는 휴대폰에 비싸서
   지역을 열 때·시간대가 바뀔 때 한 번만 스폰 위 22 m 에서 큐브맵을 굽고(6 면 그리기), 가짜 실내 창 셰이더가 시선 반사 방향으로 읽는다.
   한 점에서 찍은 것이라 시차는 틀리지만(먼 탑은 엉뚱한 쪽을 비춘다) 하늘 한 가지 색보다 «도시가 비친다».
   굽는 동안은 유리 반사를 끈다(uEnvK 0) — 큐브 안의 유리가 지난 큐브를 비추는 되먹임을 막는다. 끄기 ?refl=0 */
import { FACADE_U } from './facade-shader.js';
export function createEnvReflect(THREE, renderer, scene, { at, size = 256, height = 22, k = 0.75, hide = [] } = {}) {
  const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(1, 700, rt); cam.position.set(at.x, height, at.z); scene.add(cam);
  const R = { rt, cam, k, dirty: true, bakes: 0, ms: 0,
    bake() { const t0 = performance.now(), prevK = FACADE_U.uEnvK.value, vis = hide.map(o => o && o.visible); FACADE_U.uEnvK.value = 0; hide.forEach(o => { if (o) o.visible = false; });
      cam.update(renderer, scene); hide.forEach((o, i) => { if (o) o.visible = vis[i]; }); FACADE_U.uEnvCube.value = rt.texture; FACADE_U.uEnvK.value = prevK || k;
      R.dirty = false; R.bakes++; R.ms = Math.round(performance.now() - t0); } };
  return R;
}
