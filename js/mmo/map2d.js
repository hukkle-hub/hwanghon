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
const VERT = `varying vec2 vUv; varying float vViewZ;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vViewZ = -mv.z; gl_Position = projectionMatrix * mv; }`;
const FRAG = `uniform sampler2D colorMap; uniform sampler2D depthMap; uniform float bakeNear, bakeFar, camNear, camFar;
varying vec2 vUv; varying float vViewZ;
void main(){
  vec4 d = texture2D(depthMap, vUv);
  float t = (floor(d.r * 255.0 + 0.5) * 256.0 + floor(d.g * 255.0 + 0.5)) / 65535.0;
  float z = vViewZ + bakeNear + t * (bakeFar - bakeNear);
  gl_FragDepth = t >= 0.99999 ? 0.999999 : clamp((z - camNear) / (camFar - camNear), 0.0, 0.999999);
  gl_FragColor = texture2D(colorMap, vUv);
  #include <colorspace_fragment>
}`;
/* meta: bake-map.html 이 쓰는 maps/2d/<id>/map.json */
export async function createMap(THREE, scene, meta, base, camera) {
  const { R, U, D } = basis(THREE, meta.pitch), T = meta.tile / meta.pxPerM, loader = new THREE.TextureLoader();
  const load = url => new Promise((ok, no) => loader.load(url, ok, undefined, no));
  const group = new THREE.Group(); group.name = 'map2d'; scene.add(group);
  const M = new THREE.Matrix4().makeBasis(R, U, D.clone().negate());
  const mats = [];
  await Promise.all(meta.tiles.map(async tl => {
    const [color, depth] = await Promise.all([load(base + tl.color), load(base + tl.depth)]);
    color.colorSpace = THREE.SRGBColorSpace; color.anisotropy = 4; color.generateMipmaps = false; color.minFilter = THREE.LinearFilter;
    depth.colorSpace = THREE.NoColorSpace; depth.minFilter = depth.magFilter = THREE.NearestFilter; depth.generateMipmaps = false;
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, depthWrite: true, depthTest: true,
      uniforms: { colorMap: { value: color }, depthMap: { value: depth }, bakeNear: { value: meta.near }, bakeFar: { value: meta.far }, camNear: { value: camera.near }, camFar: { value: camera.far } } });
    mats.push(mat);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(T, T), mat);
    const uc = tl.u0 + T / 2, vc = tl.v0 - T / 2;
    q.position.copy(R).multiplyScalar(uc).addScaledVector(U, vc).addScaledVector(D, -meta.L);
    q.quaternion.setFromRotationMatrix(M); q.renderOrder = -10; q.frustumCulled = true; q.matrixAutoUpdate = false; q.updateMatrix();
    group.add(q);
  }));
  return { group, sync(cam) { mats.forEach(m => { m.uniforms.camNear.value = cam.near; m.uniforms.camFar.value = cam.far; }); } };
}
