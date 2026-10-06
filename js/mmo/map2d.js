/* 황혼 2D 맵 MMORPG — 2D 맵 렌더러 (docs/design/185 §6)
   맵은 고정 카메라 각도에서 구운 그림 타일이다(tools/2d/bake-map.html). 타일마다 색 + 깊이 두 장.
   깊이가 있어야 3D 캐릭터가 건물·기둥·지하상가 지붕 뒤로 들어갈 때 가려진다.

   좌표: 카메라는 정사영, 내려다보는 각 PITCH, 방위 0(화면 위 = 월드 -z).
     R = 화면 오른쪽 (1,0,0) · U = 화면 위 (0, cos p, -sin p) · D = 보는 방향 (0, -sin p, -cos p)
     그림 좌표 u = P·R, v = P·U. 구울 때 카메라 면은 P·D = -L 인 평면이고, 깊이는 그 면에서 잰 거리다.
   타일 사각형을 바로 그 면에 놓으면, 런타임 카메라에서 본 타일 조각의 깊이 + 구운 깊이 = 실제 표면 깊이. */
export function basis(THREE, pitch) {
  return { R: new THREE.Vector3(1, 0, 0), U: new THREE.Vector3(0, Math.cos(pitch), -Math.sin(pitch)), D: new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch)) };
}
const VERT = `varying vec2 vUv; varying float vViewZ; varying float vWorldY;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorldY = w.y; vec4 mv = viewMatrix * w; vViewZ = -mv.z; gl_Position = projectionMatrix * mv; }`;
/* depthMode 'depth'(첫 판): 구운 카메라 면에서 잰 깊이 · 'height'(실제 공간 맵): 보이는 면의 높이 — 깊이 = 조각 깊이 + (조각 높이 − 면 높이)/sin p */
const FRAG = `uniform sampler2D colorMap; uniform sampler2D depthMap; uniform float bakeNear, bakeFar, camNear, camFar, hmax, sinP, heightMode;
varying vec2 vUv; varying float vViewZ; varying float vWorldY;
void main(){
  vec4 d = texture2D(depthMap, vUv);
  float t = (floor(d.r * 255.0 + 0.5) * 256.0 + floor(d.g * 255.0 + 0.5)) / 65535.0;
  float z = heightMode > 0.5 ? vViewZ + (vWorldY - t * hmax) / sinP : vViewZ + bakeNear + t * (bakeFar - bakeNear);
  gl_FragDepth = t >= 0.99999 ? 0.999999 : clamp((z - camNear) / (camFar - camNear), 0.0, 0.999999);
  gl_FragColor = texture2D(colorMap, vUv);
  #include <colorspace_fragment>
}`;
/* meta: bake-map.html 이 쓰는 maps/2d/<id>/map.json
   타일은 «보이는 것만» 올린다. 실제 공간 맵은 한 지역이 수백 장이라 다 올리면 휴대폰 메모리가 넘친다 —
   화면 + 한 장 둘레를 올리고, 두 장 넘게 벗어나면 내린다. update(cam) 을 매 프레임 부른다. */
export async function createMap(THREE, scene, meta, base, camera) {
  const { R, U, D } = basis(THREE, meta.pitch), T = meta.tile / meta.pxPerM, loader = new THREE.TextureLoader();
  const load = url => new Promise((ok, no) => loader.load(url, ok, undefined, no));
  const group = new THREE.Group(); group.name = 'map2d'; scene.add(group);
  const M = new THREE.Matrix4().makeBasis(R, U, D.clone().negate()), geo = new THREE.PlaneGeometry(T, T);
  const index = new Map(meta.tiles.map(t => [t.i + ',' + t.j, t])), live = new Map(); let inflight = 0;
  const stats = { loaded: 0, unloaded: 0 };
  function material(color, depth) {
    color.colorSpace = THREE.SRGBColorSpace; color.anisotropy = 4; color.generateMipmaps = false; color.minFilter = THREE.LinearFilter;
    depth.colorSpace = THREE.NoColorSpace; depth.minFilter = depth.magFilter = THREE.NearestFilter; depth.generateMipmaps = false;
    return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, depthWrite: true, depthTest: true,
      uniforms: { colorMap: { value: color }, depthMap: { value: depth }, bakeNear: { value: meta.near }, bakeFar: { value: meta.far }, camNear: { value: camera.near }, camFar: { value: camera.far },
        hmax: { value: meta.hmax || 250 }, sinP: { value: Math.sin(meta.pitch) }, heightMode: { value: meta.depthMode === 'height' ? 1 : 0 } } }); }
  function open(key) { const tl = index.get(key); if (!tl || live.has(key)) return null; const rec = { mesh: null, dead: false }; live.set(key, rec); inflight++;
    const v = tl.h ? '?v=' + tl.h : '';   /* 내용 해시 — 서비스워커가 배포를 넘어 캐시한다 (tools/2d/tile-hashes.mjs) */
    return Promise.all([load(base + tl.color + v), load(base + tl.depth + v)]).then(([c, d]) => { inflight--; if (rec.dead) { c.dispose(); d.dispose(); return; }
      const q = new THREE.Mesh(geo, material(c, d)), uc = tl.u0 + T / 2, vc = tl.v0 - T / 2;
      q.position.copy(R).multiplyScalar(uc).addScaledVector(U, vc).addScaledVector(D, -meta.L); q.quaternion.setFromRotationMatrix(M);
      q.renderOrder = -10; q.matrixAutoUpdate = false; q.updateMatrix(); group.add(q); rec.mesh = q; stats.loaded++; }, () => { inflight--; live.delete(key); }); }
  function close(key) { const rec = live.get(key); if (!rec) return; rec.dead = true; live.delete(key);
    if (rec.mesh) { group.remove(rec.mesh); const u = rec.mesh.material.uniforms; u.colorMap.value.dispose(); u.depthMap.value.dispose(); rec.mesh.material.dispose(); stats.unloaded++; } }
  /* 카메라가 보는 그림 범위 → 필요한 타일 */
  function wanted(cam, pad) { const cu = cam.position.dot(R), cv = cam.position.dot(U), hw = (cam.right - cam.left) / 2, hh = (cam.top - cam.bottom) / 2;
    const i0 = Math.floor((cu - hw - pad * T - meta.u0) / T), i1 = Math.floor((cu + hw + pad * T - meta.u0) / T), j0 = Math.floor((meta.v1 - (cv + hh + pad * T)) / T), j1 = Math.floor((meta.v1 - (cv - hh - pad * T)) / T);
    const out = []; for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push(i + ',' + j); return out; }
  function update(cam) { const need = wanted(cam, 1), keep = new Set(wanted(cam, 2)), jobs = [];
    for (const k of need) if (!live.has(k) && index.has(k) && inflight < 6) { const p = open(k); if (p) jobs.push(p); }
    for (const k of [...live.keys()]) if (!keep.has(k)) close(k);
    return Promise.all(jobs); }
  return { group, update, stats, get live() { return live.size; }, sync(cam) { group.children.forEach(m => { m.material.uniforms.camNear.value = cam.near; m.material.uniforms.camFar.value = cam.far; }); } };
}
