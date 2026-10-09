/* 살아 있는 도시 (문서 219 §5) — 스파이더맨의 뉴욕은 «움직이는 것» 이 많다. 폐허판으로:
   · 까마귀 떼 — 머리 위 25~45 m 를 천천히 돈다 (인스턴스 하나 = 그리기 1번)
   · 연기 기둥 — 먼 도시 높은 건물 몇 채에서 검은 연기 (점 한 묶음 = 그리기 1번)
   · 노란 점멸 신호 — 1초 주기 (재질 하나)
   · 밤 도시 불빛 — 먼 도시 창 발광을 가로등 세기(시간대)에 맞춰
   모양만 — 막이·서버와 무관. 자리 흔들림은 고정 시드(Math.random 을 안 써서 같은 지역은 늘 같은 하늘). */
export function createCityLife(THREE, scene, { center = { x: 0, z: 0 }, tops = [], seed = 7 } = {}) {
  let s = seed >>> 0 || 1; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  /* 까마귀: V 자 날개 두 장 (가운데 몸통 접힘) */
  const bird = new THREE.BufferGeometry(); bird.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -0.55, 0.08, -0.1, 0, 0, -0.2, 0, 0, 0.25, 0, 0, -0.2, 0.55, 0.08, -0.1], 3)); bird.computeVertexNormals();
  const N = 30, birds = new THREE.InstancedMesh(bird, new THREE.MeshBasicMaterial({ color: 0x0c0a0e, side: THREE.DoubleSide, fog: true }), N); birds.frustumCulled = false; birds.userData.noCam = true; scene.add(birds);
  const flocks = [0, 1, 2].map(i => ({ cx: center.x + (rnd() - 0.5) * 60, cz: center.z + (rnd() - 0.5) * 60, r: 18 + rnd() * 22, y: 26 + rnd() * 18, w: (rnd() < 0.5 ? -1 : 1) * (0.12 + rnd() * 0.08), a: rnd() * 6.28 }));
  const B = [...Array(N)].map((_, i) => ({ f: flocks[i % 3], da: (rnd() - 0.5) * 0.9, dr: (rnd() - 0.5) * 7, dy: (rnd() - 0.5) * 4, ph: rnd() * 6.28, sp: 7 + rnd() * 4 }));
  /* 연기: 기둥마다 34 알갱이, 위로 올라가며 커지고 옅어진다 — 점 크기·투명도는 셰이더에서 나이로 */
  const plumes = [...tops].sort((a, b) => ((a[0] * 7 + a[2] * 13) % 97) - ((b[0] * 7 + b[2] * 13) % 97)).filter((p, i, A) => A.slice(0, i).every(o => Math.hypot(o[0] - p[0], o[2] - p[2]) > 90)).slice(0, 5),   /* 서로 90 m 넘게 떨어진 다섯 */ P = 34, n = plumes.length * P, pos = new Float32Array(n * 3), age = new Float32Array(n), life = 13;
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('age', new THREE.BufferAttribute(age, 1));
  const pm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms: { ...THREE.UniformsLib.fog, scale: { value: 1100 } },
    vertexShader: '#include <fog_pars_vertex>\nattribute float age; varying float va; uniform float scale; void main(){ va = age; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = scale * (3.0 + age * 15.0) / -mvPosition.z; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
    fragmentShader: '#include <fog_pars_fragment>\nvarying float va; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; float a = (1.0 - r * 4.0) * (1.0 - va) * 0.55; gl_FragColor = vec4(vec3(0.08, 0.07, 0.08) + va * 0.12, a);\n#include <fog_fragment>\n}' });
  const smoke = new THREE.Points(pg, pm); smoke.frustumCulled = false; smoke.userData.noCam = true; if (n) scene.add(smoke);
  const seedP = []; for (let k = 0; k < n; k++) { age[k] = (k % P) / P; seedP.push([rnd() - 0.5, rnd() - 0.5, rnd()]); }
  /* 떠다니는 재 (문서 220 §11): 카메라를 감싼 40 m 상자 안 400 알갱이 — 자리는 셰이더가 시간으로 흘리고 상자 밖으로 나가면 반대편으로 감는다(CPU 0 · 그리기 1번).
     빛을 받아 반짝이고, 가까울수록 크다. 밤엔 옅은 푸른빛 */
  const MN = 400, mpos = new Float32Array(MN * 3), mph = new Float32Array(MN); for (let i = 0; i < MN; i++) { mpos[i * 3] = rnd() * 40; mpos[i * 3 + 1] = rnd() * 14; mpos[i * 3 + 2] = rnd() * 40; mph[i] = rnd() * 6.283; }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mpos, 3)); mg.setAttribute('ph', new THREE.BufferAttribute(mph, 1)); mg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  const mm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, blending: THREE.AdditiveBlending, uniforms: { ...THREE.UniformsLib.fog, uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(0xffd0a0) }, uA: { value: 0.5 }, scale: { value: 380 } },
    vertexShader: '#include <fog_pars_vertex>\nattribute float ph; uniform float uT, scale; uniform vec3 uCam; varying float vTw;\nvoid main(){ vec3 p = position + vec3(uT * 0.55 + sin(uT * 0.3 + ph) * 1.5, -uT * 0.12 + sin(uT * 0.7 + ph * 2.0) * 0.6, uT * 0.2 + cos(uT * 0.25 + ph) * 1.5);\n'
      + '  p.xz = mod(p.xz - uCam.xz + 20.0, 40.0) - 20.0 + uCam.xz; p.y = mod(p.y, 14.0) + 0.2; vTw = 0.55 + 0.45 * sin(uT * 2.3 + ph * 5.0);\n'
      + '  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp(scale * 0.16 / -mvPosition.z, 1.5, 12.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
    fragmentShader: '#include <fog_pars_fragment>\nuniform vec3 uCol; uniform float uA; varying float vTw; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(uCol, (1.0 - r * 4.0) * uA * vTw);\n#include <fog_fragment>\n}' });
  const motes = new THREE.Points(mg, mm); motes.frustumCulled = false; motes.userData.noCam = true; motes.renderOrder = 2; scene.add(motes);
  const NIGHT = new THREE.Color(0x9fb2ff), WARM = new THREE.Color(0xffd0a0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let blinkMat = null, glowMats = []; scene.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (m.userData.blink && !blinkMat) blinkMat = m; if (m.userData.farGlow && !glowMats.includes(m)) glowMats.push(m); } });
  let t = 0;
  return { birds, smoke, plumes, motes, get counts() { return { birds: N, plumes: plumes.length, blink: !!blinkMat, glow: glowMats.length, motes: MN, at: plumes.map(p => p.slice()) }; },
    tick(dt, lampK = 1, camPos = null) { t += dt;
      mm.uniforms.uT.value = t; if (camPos) mm.uniforms.uCam.value.copy(camPos); const nk = Math.min(1, Math.max(0, (lampK - 1.05) / 0.85)); mm.uniforms.uCol.value.copy(WARM).lerp(NIGHT, nk); mm.uniforms.uA.value = 0.45 - 0.2 * nk;   /* 황혼 1.05 → 밤 1.9 */
      for (let i = 0; i < N; i++) { const b = B[i], f = b.f, a = f.a + t * f.w + b.da, r = f.r + b.dr + Math.sin(t * 0.3 + b.ph) * 3;
        v.set(f.cx + Math.cos(a) * r, f.y + b.dy + Math.sin(t * 0.5 + b.ph) * 1.5, f.cz + Math.sin(a) * r);
        e.set(Math.sin(t * 0.7 + b.ph) * 0.15, -a - (f.w > 0 ? 0 : Math.PI), 0); q.setFromEuler(e); const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * b.sp + b.ph)); sc.set(1, flap, 1);
        m4.compose(v, q, sc); birds.setMatrixAt(i, m4); }
      birds.instanceMatrix.needsUpdate = true;
      for (let p = 0; p < plumes.length; p++) { const [x, h, z] = plumes[p];
        for (let j = 0; j < P; j++) { const k = p * P + j, sd = seedP[k]; let a = age[k] + dt / life; if (a > 1) a -= 1; age[k] = a;
          pos[k * 3] = x + sd[0] * (2 + a * 16) + a * a * 22; pos[k * 3 + 1] = h + 1 + a * (52 + sd[2] * 14); pos[k * 3 + 2] = z + sd[1] * (2 + a * 16) + a * a * 8; } }   /* 바람에 조금 기운다 */
      if (n) { pg.attributes.position.needsUpdate = true; pg.attributes.age.needsUpdate = true; }
      if (blinkMat) blinkMat.emissiveIntensity = (t % 1.1) < 0.55 ? blinkMat.userData.blink : 0.05;
      for (const m of glowMats) m.emissiveIntensity = m.userData.farGlow * (0.3 + 0.75 * lampK); } };   /* 낮 0.3 · 황혼 1.05 · 밤 1.7 배 */
}
