/* 발밑 그늘 (문서 229 §2) — 차·소품이 바닥에 «붙어» 보이게. 영상 «게임 속 빛의 30년» 의 퀘이크 3 블롭 섀도:
   물체 발밑 바닥에 부드러운 어두운 판 하나. 높이 지도 AO(문서 228)는 휴대폰 텍셀 0.88 m 라 번졌다 — 물체마다 자기 크기로 붙이면 또렷하다.
   장면 맨 위 물체 중 «바닥에 선, 사람 키 언저리, 발 넓이 0.3~40 m²» 를 골라 자기 축 그대로(회전 포함) 한 InstancedMesh 로 — 그리기 한 번.
   빛나는 것(결정·간판)·투명한 것·건물(높이 4.5 m 넘음)·바닥 판은 뺀다. */
export function addContactShadows(THREE, scene, { skip = () => false, pad = 1.7, opacity = 0.82, maxH = 4.5, max = 4000 } = {}) {
  const pick = [], box = new THREE.Box3(), rot = new THREE.Euler(), pos = new THREE.Vector3();
  const glows = o => { let g = false; o.traverse(m => { if (!m.isMesh) return; for (const x of Array.isArray(m.material) ? m.material : [m.material]) if (x && (x.transparent || x.isMeshBasicMaterial && !m.parent?.isGroup || (x.emissive && x.emissive.getHex() && (x.emissiveIntensity ?? 1) > 0.05 && !x.emissiveMap))) g = true; }); return g; };
  for (const o of scene.children) { if (!o.visible || skip(o) || !(o.isGroup || o.isMesh) || o.isInstancedMesh || o.isSkinnedMesh) continue;
    rot.copy(o.rotation); pos.copy(o.position); o.rotation.set(0, 0, 0); o.updateMatrixWorld(true); box.setFromObject(o); o.rotation.copy(rot); o.updateMatrixWorld(true);
    if (box.isEmpty()) continue; const h = box.max.y - box.min.y, sx = box.max.x - box.min.x, sz = box.max.z - box.min.z, area = sx * sz;
    if (box.min.y > 0.35 || h < 0.25 || h > maxH || area < 0.3 || area > 40) continue;
    if (Math.abs(rot.x) > 0.6 || Math.abs(rot.z) > 0.6) continue;   /* 넘어진 것 · 벽에 붙인 판 */
    if (glows(o)) continue;
    pick.push({ x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2, sx: sx + pad, sz: sz + pad, ry: rot.y, h }); if (pick.length >= max) break; }
  if (!pick.length) return null;
  /* 둥근 사각 그늘: 가운데(물체 발 넓이)는 진하고 둘레 pad 만큼 흐려진다 — 첫 판(동그라미, 둘레 0.27 m)은 차 몸에 가려 안 보였다 */
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const u = Math.abs((i + .5) / N * 2 - 1), v = Math.abs((j + .5) / N * 2 - 1), d = Math.hypot(Math.max(0, u - 0.62), Math.max(0, v - 0.62)) / 0.38, a = Math.max(0, 1 - d);
    img.data[(j * N + i) * 4 + 3] = a * 255; img.data[(j * N + i) * 4] = img.data[(j * N + i) * 4 + 1] = img.data[(j * N + i) * 4 + 2] = a * 255; }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c), geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -40 });
  /* 텍스처 알파만 쓴다: 색은 검정, 진하기는 map 의 알파 — 사각 판 모서리가 보이지 않게 둥글게 */
  mat.alphaMap = tex; mat.map = null;
  const im = new THREE.InstancedMesh(geo, mat, pick.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  pick.forEach((p, i) => { Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry); S.set(p.sx, 1, p.sz); P.set(p.x, 0.085, p.z); M.compose(P, Q, S); im.setMatrixAt(i, M); });
  im.renderOrder = 2; im.name = 'contactShadows'; im.userData.noCam = true; im.frustumCulled = false; scene.add(im);
  return { mesh: im, count: pick.length };
}
