/* 가로등 빛 기둥 (문서 229 §11) — 스파이더맨 밤거리의 «공기 속 빛». 부피광(볼류메트릭)은 휴대폰에 비싸서
   가로등마다 위가 뾰족한 원뿔 하나를 더하기 섞기(additive)로 그린다: 등 밑에서 진하고 땅으로 갈수록 옅고,
   원뿔 가장자리(시선과 비스듬한 면)는 흐려서 단단한 고깔이 아니라 빛 안개처럼 보인다. 전부 InstancedMesh 하나.
   나중에 장면에서 떼어 낸 점광원(world3d pointData — 가까운 몇 개만 실제로 비춘다)도 원뿔은 늘 보이니 먼 가로등도 «켜져» 보인다.
   세기 = 시간대 lampK (낮 0 → 안 보임). 높이 4 m 넘고 닿는 거리 12 m 넘는 등만(벽 간판·결정 불빛은 뺀다) */
export function addLightCones(THREE, scene, lights, { minY = 4, minDist = 12, spread = 0.48, max = 400 } = {}) {
  const pick = lights.filter(l => l.position.y >= minY && (l.distance === 0 || l.distance >= minDist)).slice(0, max);
  if (!pick.length) return null;
  const geo = new THREE.ConeGeometry(1, 1, 20, 1, true); geo.translate(0, 0.5, 0);   /* 밑 y=0 · 꼭지 y=1 */
  const U = { uK: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    vertexShader: `varying float vY; varying vec3 vN, vV; varying vec3 vC; varying float vD;
      void main(){ vY = position.y; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vec4 mv = viewMatrix * w;
        vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz); vD = -mv.z;
        #ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
        #else
        vC = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uK; varying float vY; varying vec3 vN, vV; varying vec3 vC; varying float vD;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 3.0);   /* 가장자리 흐리게 — 1.6 은 세기를 올리면 딱딱한 고깔(천막)이었다 */
        float h = pow(vY, 1.5) * (0.6 + 0.4 * vY);   /* 등 밑 진하고 땅에서는 0 — 바닥에 금이 그어지지 않게 */
        float far = 1.0 - smoothstep(90.0, 160.0, vD), near = smoothstep(1.5, 5.0, vD);   /* 아주 멀거나 코앞은 거두기 */
        gl_FragColor = vec4(vC * uK * edge * h * far * near, 1.0); }` });
  const im = new THREE.InstancedMesh(geo, mat, pick.length), M = new THREE.Matrix4(), C = new THREE.Color();
  pick.forEach((l, i) => { const h = l.position.y - 0.1, r = h * spread; M.makeScale(r, h, r).setPosition(l.position.x, 0.02, l.position.z); im.setMatrixAt(i, M); im.setColorAt(i, C.copy(l.color)); });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.name = 'lightCones'; im.renderOrder = 5; im.frustumCulled = false; im.userData.noCam = true; scene.add(im);
  return { mesh: im, count: pick.length, at: pick.slice(0, 60).map(l => [+l.position.x.toFixed(1), +l.position.y.toFixed(1), +l.position.z.toFixed(1)]), set(lampK) { U.uK.value = 0.9 * Math.min(1.9, lampK); } };
}
