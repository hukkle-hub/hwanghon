/* 안개 너머는 안 그린다 (문서 229 §14) — 필드 안개는 70~230 m 라 230 m 너머는 안개 색으로 완전히 묻히는데,
   강남 77만 삼각형 중 13만(17 %)을 거기서 그리고 있었다. 지역 전체를 덮는 인스턴스(차·바퀴·나무·바위, 여의도 40만)는 거리와 상관없이 다 그렸다.
   - 정적 메시(장면 바로 밑): 월드 경계 구가 (안개 끝 + 여유) 밖이면 visible = false
   - 정적 인스턴스: 원래 행렬을 들고 있다가 가까운 것만 앞으로 모아 count 를 줄인다(색도 같이). 고를 것이 바뀔 때만 다시 올린다
   - 안개를 안 받는 것(먼 도시 실루엣·하늘·빛 기둥 같은 ShaderMaterial)은 손대지 않는다
   - 지역을 지은 직후(플레이어·몹·까마귀가 들어오기 전)에 모은다. 그래도 남이 인스턴스 행렬을 고치면(version 이 바뀌면) 손 떼고 count 를 돌려 둔다
   world3d 가 몇 프레임마다 update(카메라 위치, 안개 끝). ?fc=0 으로 끔 */
export function createFogCull(THREE, scene, { skip = () => false, margin = 25, minInst = 24 } = {}) {
  const fogs = m => [].concat(m).every(x => x && x.fog !== false && !x.isShaderMaterial);
  const meshes = [], inst = [], c = new THREE.Vector3(), sc = new THREE.Vector3(), M = new THREE.Matrix4();
  scene.updateMatrixWorld(true);
  for (const o of scene.children) { if (!o.isMesh || o.isSkinnedMesh || !o.visible || skip(o) || !fogs(o.material)) continue; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere;
    if (o.isInstancedMesh) { if (o.count < minInst) continue; const n = o.count, mats = o.instanceMatrix.array.slice(0, n * 16), cols = o.instanceColor ? o.instanceColor.array.slice(0, n * 3) : null, pos = new Float32Array(n * 2), rad = new Float32Array(n);
      for (let i = 0; i < n; i++) { M.fromArray(mats, i * 16).premultiply(o.matrixWorld); c.copy(bs.center).applyMatrix4(M); sc.setFromMatrixScale(M); pos[i * 2] = c.x; pos[i * 2 + 1] = c.z; rad[i] = bs.radius * Math.max(sc.x, sc.y, sc.z); }
      inst.push({ o, n, mats, cols, pos, rad, ver: o.instanceMatrix.version, live: true, pick: null }); continue; }
    c.copy(bs.center).applyMatrix4(o.matrixWorld); sc.setFromMatrixScale(o.matrixWorld); meshes.push({ o, x: c.x, z: c.z, r: bs.radius * Math.max(sc.x, sc.y, sc.z) }); }
  const F = { meshes: meshes.length, inst: inst.length, instTotal: inst.reduce((a, e) => a + e.n, 0), hidden: 0, instHidden: 0, uploads: 0,
    update(cam, far) { const lim = far + margin; let h = 0, ih = 0;
      for (const e of meshes) { const v = Math.hypot(e.x - cam.x, e.z - cam.z) - e.r < lim; if (!v) h++;
        if (!v && e.o.visible) { e.o.visible = false; e.hid = true; } else if (v && e.hid) { e.o.visible = true; e.hid = false; } }   /* 내가 숨긴 것만 내가 되살린다 — 남이 일부러 숨긴 것은 그대로 */
      for (const e of inst) { if (!e.live) continue; const o = e.o;
        if (o.instanceMatrix.version !== e.ver) { e.live = false; o.count = e.n; continue; }   /* 남이 행렬을 고쳤다 — 움직이는 무리. 손 뗀다 */
        const pick = []; for (let i = 0; i < e.n; i++) if (Math.hypot(e.pos[i * 2] - cam.x, e.pos[i * 2 + 1] - cam.z) - e.rad[i] < lim) pick.push(i);
        ih += e.n - pick.length;
        if (e.pick && pick.length === e.pick.length && pick.every((x, j) => x === e.pick[j])) continue;   /* 고른 것이 그대로면 올리지 않는다 */
        const A = o.instanceMatrix.array, C = e.cols && o.instanceColor ? o.instanceColor.array : null;
        pick.forEach((i, k) => { for (let j = 0; j < 16; j++) A[k * 16 + j] = e.mats[i * 16 + j]; if (C) for (let j = 0; j < 3; j++) C[k * 3 + j] = e.cols[i * 3 + j]; });
        o.count = pick.length; o.instanceMatrix.needsUpdate = true; if (C) o.instanceColor.needsUpdate = true; e.ver = o.instanceMatrix.version; e.pick = pick; F.uploads++; }
      F.hidden = h; F.instHidden = ih; return F; } };
  return F;
}
