/* 그림자 대리 (문서 229 §42) — 그림자 상자는 플레이어 둘레 ±34 m 인데, 지역 전체를 덮는 정적 인스턴스(나무·바위·풀·차)는 InstancedMesh 하나가 통째로
   걸러져서 상자 밖 수천 그루까지 매 프레임 그림자 지도에 그렸다(제주 그림자 삼각형 41만 중 22만).
   인스턴스마다 «그림자 전용 사본» 을 둔다: 같은 기하, 플레이어 반경 R(상자 대각 48 m + 키 큰 것의 그림자 길이) 안의 것만 담는다. 원본은 castShadow 를 끈다.
   화면엔 안 그리게 — 레이어로 숨기려 했더니 three r170 은 그림자 패스도 «화면 카메라» 레이어로 걸러 그림자까지 사라졌다(바위 그림자 빠짐, 픽셀 비교).
   그래서 재질을 색·깊이를 안 쓰는 값싼 Basic 으로(그림자 깊이 재질은 이 재질의 map · alphaTest · side 만 가져간다 — 잎 카드도 구멍대로 그림자)
   지역을 지은 직후(움직이는 무리가 들어오기 전) 모은다 — 안개 숨기기(fog-cull)와 같은 때. 원본 행렬을 들고 있으니 안개 숨기기가 원본을 다시 줄 세워도 상관없다.
   ?sp=0 으로 끔 */
export function createShadowProxies(THREE, scene, light, { radius = 64, minInst = 24, step = 4 } = {}) {
  const list = [], c = new THREE.Vector3(), sc = new THREE.Vector3(), M = new THREE.Matrix4();
  scene.updateMatrixWorld(true);
  for (const o of [...scene.children]) { if (!o.isInstancedMesh || !o.castShadow || !o.visible || o.count < minInst) continue;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere, n = o.count, mats = o.instanceMatrix.array.slice(0, n * 16), pos = new Float32Array(n * 2), rad = new Float32Array(n);
    for (let i = 0; i < n; i++) { M.fromArray(mats, i * 16).premultiply(o.matrixWorld); c.copy(bs.center).applyMatrix4(M); sc.setFromMatrixScale(M); pos[i * 2] = c.x; pos[i * 2 + 1] = c.z; rad[i] = bs.radius * Math.max(sc.x, sc.y, sc.z); }
    const m0 = [].concat(o.material)[0], pm = new THREE.MeshBasicMaterial({ map: m0.alphaTest > 0 ? m0.map : null, alphaMap: m0.alphaTest > 0 ? m0.alphaMap : null, alphaTest: m0.alphaTest || 0, side: m0.side, colorWrite: false, depthWrite: false });
    if (m0.shadowSide != null) pm.shadowSide = m0.shadowSide;
    const p = new THREE.InstancedMesh(g, pm, n); p.name = 'shadowProxy'; p.count = 0; p.castShadow = true; p.receiveShadow = false; p.frustumCulled = false; p.userData.noCam = true;
    p.position.copy(o.position); p.quaternion.copy(o.quaternion); p.scale.copy(o.scale); if (o.customDepthMaterial) p.customDepthMaterial = o.customDepthMaterial; if (o.customDistanceMaterial) p.customDistanceMaterial = o.customDistanceMaterial;
    o.parent.add(p); o.castShadow = false; list.push({ o, p, n, mats, pos, rad }); }
  let lx = Infinity, lz = Infinity;
  const S = { count: list.length, instTotal: list.reduce((a, e) => a + e.n, 0), live: 0, uploads: 0, radius,
    update(at, force = false) { if (!force && Math.hypot(at.x - lx, at.z - lz) < step) return S; lx = at.x; lz = at.z; let live = 0;
      for (const e of list) { const A = e.p.instanceMatrix.array; let k = 0;
        for (let i = 0; i < e.n; i++) if (Math.hypot(e.pos[i * 2] - at.x, e.pos[i * 2 + 1] - at.z) - e.rad[i] < radius) { for (let j = 0; j < 16; j++) A[k * 16 + j] = e.mats[i * 16 + j]; k++; }
        e.p.count = k; e.p.instanceMatrix.needsUpdate = true; live += k; }
      S.live = live; S.uploads++; return S; },
    off() { for (const e of list) { e.o.castShadow = true; e.p.parent && e.p.parent.remove(e.p); } list.length = 0; S.count = 0; } };
  return S;
}
