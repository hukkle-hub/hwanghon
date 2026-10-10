/* 높이 앰비언트 오클루전 — 지역을 열 때 한 번 굽는다 (문서 228).
   영상 «게임 속 빛의 30년» 의 셋째 판(간접광을 미리 구워 두고 게임 중엔 읽기만)을, 장면을 OSM 에서 그 자리에서 짓는 우리 필드에 맞게:
   1) 지역 전체를 바로 위에서 깊이 한 장으로 찍는다 = 높이 지도 (지붕·차 지붕·나무 갓의 높이)
   2) 텍셀마다 둘레 16 방향 × 6 걸음을 보며 «내 자리보다 높은 것이 얼마나 하늘을 가리나» (지평선 각의 사인) → 1 - 가린 몫
   3) 9 탭 흐림 두 번 → 한 장의 텍스처 (휴대폰 1024², 데스크톱 2048²)
   게임 중에는 위를 향한 면(바닥·보도·지붕)이 자기 세계 좌표로 이 텍스처를 한 번 읽어 «간접광(반구광)만» 줄인다 — 해·등불 같은 직접광은 그대로.
   위를 향하지 않은 면(벽)은 높이 지도로는 모르니 건드리지 않는다. 25 cm 안 높이 차(풀·연석)는 가리개로 치지 않는다. */

const DEPTH_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const AO_FRAG = `precision highp float; varying vec2 vUv; uniform sampler2D tDepth; uniform vec2 uTexel; uniform float uTop, uSpan, uMeter, uRad, uIgnore, uK;
float hAt(vec2 u){ return uTop - texture2D(tDepth, u).r * uSpan; }   /* 정사영: 깊이는 거리에 선형 */
void main(){ float h0 = hAt(vUv), occ = 0.0;
  for (int d = 0; d < 16; d++) { float a = float(d) * 0.3926991 + 0.19; vec2 dir = vec2(cos(a), sin(a)); float m = 0.0;
    for (int s = 1; s <= 6; s++) { float r = uRad * float(s * s) / 36.0 + uMeter * 0.6; vec2 u = vUv + dir * r / uMeter * uTexel; float dh = hAt(u) - h0 - uIgnore; if (dh > 0.0) m = max(m, dh / sqrt(dh * dh + r * r)); }
    occ += m; }
  gl_FragColor = vec4(vec3(1.0 - uK * occ / 16.0), 1.0); }`;
const BLUR_FRAG = `precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uStep;
void main(){ float w[5]; w[0] = 0.227; w[1] = 0.194; w[2] = 0.122; w[3] = 0.054; w[4] = 0.016; float c = texture2D(tSrc, vUv).r * w[0];
  for (int i = 1; i < 5; i++) { c += texture2D(tSrc, vUv + uStep * float(i)).r * w[i]; c += texture2D(tSrc, vUv - uStep * float(i)).r * w[i]; } gl_FragColor = vec4(vec3(c), 1.0); }`;

/* scene 의 정적 물체로 높이 AO 를 굽는다. 돌려주는 것: { tex, rect:[x0, z0, w, d], res, ms, mean } — 나중에 attach 로 재질에 붙인다 */
export function bakeHeightAO(THREE, renderer, scene, { res = 1024, skip = () => false, rad = 3.2, ignore = 0.25, k = 1.15, maxSize = 900 } = {}) {
  const t0 = performance.now(), box = new THREE.Box3(), b = new THREE.Box3(), hidden = [];
  scene.traverse(o => { if (!o.visible) return; const drawable = o.isMesh || o.isPoints || o.isLine || o.isSprite; if (!drawable) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material], clear = mats.some(m => m && (m.transparent || m.depthWrite === false));
    if (skip(o) || o.isSkinnedMesh || !o.isMesh || clear) { hidden.push(o); o.visible = false; return; }
    if (o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); if (Math.max(b.max.x - b.min.x, b.max.z - b.min.z) < 4 * maxSize) box.union(b); } });
  const restore = () => { for (const o of hidden) o.visible = true; };
  if (box.isEmpty()) { restore(); return null; }
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, half = Math.min(maxSize, Math.max(box.max.x - box.min.x, box.max.z - box.min.z)) / 2 + 2;
  const top = box.max.y + 5, span = top - box.min.y + 5, cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, span);
  cam.position.set(cx, top, cz); cam.up.set(0, 0, -1); cam.lookAt(cx, top - 1, cz); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();   /* 화면 위 = −z: 텍스처 v 가 z 와 같은 쪽 */
  const depthRT = new THREE.WebGLRenderTarget(res, res, { depthBuffer: true }); depthRT.depthTexture = new THREE.DepthTexture(res, res); depthRT.depthTexture.type = THREE.UnsignedIntType;
  const prev = { rt: renderer.getRenderTarget(), ov: scene.overrideMaterial, bg: scene.background, fog: scene.fog, auto: renderer.shadowMap.autoUpdate, clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha() };
  const flat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); scene.overrideMaterial = flat; scene.background = null; scene.fog = null; renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(depthRT); renderer.setClearColor(0, 1); renderer.clear(); renderer.render(scene, cam);
  scene.overrideMaterial = prev.ov; scene.background = prev.bg; scene.fog = prev.fog; renderer.shadowMap.autoUpdate = prev.auto; restore();
  /* AO 와 흐림 — 화면 한 장 그리는 사각형 */
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), qs = new THREE.Scene(), qc = new THREE.Camera(); qs.add(quad); quad.frustumCulled = false;
  const mk = () => new THREE.WebGLRenderTarget(res, res, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const A = mk(), B = mk(), meter = res / (half * 2);
  quad.material = new THREE.ShaderMaterial({ vertexShader: DEPTH_VERT, fragmentShader: AO_FRAG, uniforms: { tDepth: { value: depthRT.depthTexture }, uTexel: { value: new THREE.Vector2(1 / res, 1 / res) }, uTop: { value: top }, uSpan: { value: span - 0.01 }, uMeter: { value: meter }, uRad: { value: rad }, uIgnore: { value: ignore }, uK: { value: k } } });
  renderer.setRenderTarget(A); renderer.render(qs, qc);
  const blur = new THREE.ShaderMaterial({ vertexShader: DEPTH_VERT, fragmentShader: BLUR_FRAG, uniforms: { tSrc: { value: null }, uStep: { value: new THREE.Vector2() } } }); quad.material = blur;
  for (const [src, dst, st] of [[A, B, [1, 0]], [B, A, [0, 1]]]) { blur.uniforms.tSrc.value = src.texture; blur.uniforms.uStep.value.set(st[0] / res, st[1] / res); renderer.setRenderTarget(dst); renderer.render(qs, qc); }
  /* 평균(재기용)·캐릭터용 읽기 — 64×64 로 줄여 읽는다 */
  let mean = 1, small = null; try { const n = 64, px = new Uint8Array(res * 4); small = new Float32Array(n * n); let s = 0; for (let j = 0; j < n; j++) { renderer.readRenderTargetPixels(A, 0, Math.floor((j + .5) * res / n), res, 1, px); for (let i = 0; i < n; i++) { const v = px[Math.floor((i + .5) * res / n) * 4] / 255; small[j * n + i] = v; s += v; } } mean = s / (n * n); } catch { small = null; }
  renderer.setRenderTarget(prev.rt); renderer.setClearColor(prev.clear, prev.alpha);
  depthRT.dispose(); B.dispose(); quad.geometry.dispose(); blur.dispose(); flat.dispose();
  /* 텍스처 v=0 이 화면 아래(+z) 쪽: rect 는 [x0, z0(=+z 끝), 폭, −깊이] 로 넣어 셰이더가 (x−x0)/w, (z−z0)/d 로 읽는다 */
  return { tex: A.texture, rt: A, rect: [cx - half, cz + half, half * 2, -half * 2], res, meter: +meter.toFixed(2), ms: Math.round(performance.now() - t0), mean: +mean.toFixed(3), small };
}

/* 위를 향하고 높이 지도의 그 자리 높이와 같은(= 위에서 보이는) 면만 — 간접광만 줄인다. 이미 onBeforeCompile 이 있으면 그 뒤에 잇는다 */
export function attachHeightAO(THREE, scene, ao, { skip = () => false, strength = 1, direct = 0 } = {}) {
  if (!ao) return 0; const U = { uHAO: { value: ao.tex }, uHAOR: { value: new THREE.Vector4(...ao.rect) }, uHAOK: { value: strength }, uHAOD: { value: direct } }, done = new Set();
  scene.traverse(o => { if (!o.isMesh || o.isSkinnedMesh || skip(o)) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
    if (!m || done.has(m) || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial) || m.transparent) continue; done.add(m);
    const prevCompile = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
    m.onBeforeCompile = (sh, r) => { if (prevCompile) prevCompile.call(m, sh, r); Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHaoW; varying vec3 vHaoN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n{ vec4 hw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n hw = instanceMatrix * hw;\n#endif\n hw = modelMatrix * hw; vHaoW = hw.xyz; vec3 hn = objectNormal;\n#ifdef USE_INSTANCING\n hn = mat3(instanceMatrix) * hn;\n#endif\n vHaoN = normalize(mat3(modelMatrix) * hn); }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uHAO; uniform vec4 uHAOR; uniform float uHAOK, uHAOD; varying vec3 vHaoW; varying vec3 vHaoN;')
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n{ vec2 hu = (vHaoW.xz - uHAOR.xy) / uHAOR.zw; float up = smoothstep(0.55, 0.85, normalize(vHaoN).y);\n if (up > 0.0 && hu.x > 0.0 && hu.x < 1.0 && hu.y > 0.0 && hu.y < 1.0) { float ao = mix(1.0, texture2D(uHAO, hu).r, uHAOK * up); reflectedLight.indirectDiffuse *= ao; reflectedLight.indirectSpecular *= ao; reflectedLight.directDiffuse *= mix(1.0, ao, uHAOD); } }'); };
    m.customProgramCacheKey = () => prevKey() + '|hao'; m.needsUpdate = true; } });
  return done.size;
}

/* 캐릭터 «프로브» — 퀘이크가 모델 발밑 라이트맵 값 하나를 읽어 모델 밝기로 썼듯이, 발밑 AO 값을 읽는다 (64×64 로 줄인 값, 겹선형) */
export function heightAOAt(ao, x, z) {
  if (!ao || !ao.small) return 1; const n = 64, u = (x - ao.rect[0]) / ao.rect[2], v = (z - ao.rect[1]) / ao.rect[3]; if (!(u > 0 && u < 1 && v > 0 && v < 1)) return 1;
  const fx = u * n - .5, fy = v * n - .5, i = Math.max(0, Math.min(n - 2, Math.floor(fx))), j = Math.max(0, Math.min(n - 2, Math.floor(fy))), a = Math.min(1, Math.max(0, fx - i)), c = Math.min(1, Math.max(0, fy - j)), S = ao.small;
  return (S[j * n + i] * (1 - a) + S[j * n + i + 1] * a) * (1 - c) + (S[(j + 1) * n + i] * (1 - a) + S[(j + 1) * n + i + 1] * a) * c;
}
