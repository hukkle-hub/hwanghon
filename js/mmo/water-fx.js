/* 부유물 (문서 232 §3) — 수면 위 티끌 n 개, 카메라 앞 상자 안에서 떠돈다. uFlow 가 밀면 그쪽으로 흐른다(보스 예고 → 보스에서 멀어지는 쪽).
   그리기 1 번 · 더하기 섞기 아님(물 위에 어두운 점·밝은 점 섞어서) */
export function floaters(THREE, { n = 160, box = 18 } = {}) {
  const g = new THREE.PlaneGeometry(0.09, 0.09); g.rotateX(-Math.PI / 2);
  const U = { uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uY: { value: 0 }, uT: { value: 0 }, uFlow: { value: new THREE.Vector2(0.12, 0.05) }, uOff: { value: new THREE.Vector2() } };
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetUnits: -42,
    vertexShader: `uniform vec3 uCam; uniform float uBox, uY, uT; uniform vec2 uFlow, uOff; varying float vA, vK;
float fh(float x){ return fract(sin(x * 91.7) * 43758.5453); }
void main(){ float id = float(gl_InstanceID); vec2 base = vec2(fh(id + 1.0), fh(id + 2.0)) * uBox;
  vec2 wob = vec2(sin(uT * 0.7 + id), cos(uT * 0.9 + id * 1.3)) * 0.25;
  vec2 lo = uCam.xz - uBox * 0.5; vec2 xz = lo + mod(base + uOff + wob - lo, vec2(uBox));
  float sc = 0.6 + 1.2 * fh(id + 3.0); vK = fh(id + 4.0);
  vec3 wp = vec3(xz.x, uY + 0.015, xz.y) + position * sc; vA = smoothstep(uBox * 0.5, uBox * 0.3, length(xz - uCam.xz)) * smoothstep(1.2, 2.2, distance(wp, cameraPosition));
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
    fragmentShader: `varying float vA, vK; void main(){ if (vA < 0.01) discard; vec3 c = vK < 0.6 ? vec3(0.06, 0.07, 0.06) : vec3(0.55, 0.58, 0.5); gl_FragColor = vec4(c, vA * (vK < 0.6 ? 0.55 : 0.4)); }` });
  const mesh = new THREE.InstancedMesh(g, m, n); mesh.frustumCulled = false; mesh.userData.noCam = true; mesh.name = 'floaters';
  const I = new THREE.Matrix4(); for (let i = 0; i < n; i++) mesh.setMatrixAt(i, I);
  const off = U.uOff.value;
  return { mesh, U, tick(dt, p, f, y, flow) { U.uT.value += dt; if (flow) U.uFlow.value.lerp(flow, 1 - Math.exp(-dt * 4)); off.addScaledVector(U.uFlow.value, dt); U.uY.value = y; U.uCam.value.set(p.x + f.x * 6, 0, p.z + f.z * 6); } };
}
