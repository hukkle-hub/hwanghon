/* 영화 같은 대기 — 해의 화면 자리와 빛줄기 세기 (문서 230).
   해가 지평선 아래면 0, 카메라 뒤면 0, 화면 밖으로 멀어질수록 0 으로(가장자리 밖 0.9 → 1.6 사이에 사라짐), 폭우(dim) 엔 끈다.
   자리가 NaN 이면(카메라가 망가진 프레임) 0 — 셰이더에 NaN 이 들어가면 화면 전체가 하얗게 탔다 */
export function cineSun(THREE, cam, sunDir, dim = 0, out = {}) {
  const d = (out._d ||= new THREE.Vector3()).copy(sunDir).normalize(), f = (out._f ||= new THREE.Vector3()), v = (out._v ||= new THREE.Vector3());
  cam.getWorldDirection(f); const front = f.dot(d);
  v.copy(cam.position).addScaledVector(d, 400).project(cam); const edge = Math.max(Math.abs(v.x), Math.abs(v.y));
  const up = THREE.MathUtils.smoothstep(d.y, -0.06, 0.06);
  out.k = front > 0 && Number.isFinite(v.x + v.y) ? up * (1 - THREE.MathUtils.smoothstep(edge, 0.9, 1.6)) * (1 - (dim || 0)) : 0;
  out.x = v.x * .5 + .5; out.y = v.y * .5 + .5; return out;
}
