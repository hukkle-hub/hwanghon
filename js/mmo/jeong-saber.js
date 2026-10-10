/* 정 장관의 의전용 군도(지휘도) — 결정으로 덧자란 채 실전 각도로 뽑힌다 (문서 149 §3.2, 문서 223).
   몸(minister_jeong_candidate.glb)에 칼이 없어 소품으로 단다.
   손 «뼈»(RightHand·RightHandSlot)에 붙이면 안 된다 — 손 메시가 손 뼈에 가중치 0, 위팔·아래팔에 섞여 묶여 있어
   팔꿈치를 굽히면 보이는 손이 뼈보다 30 cm 가까이 뒤처진다(재 봄). 그래서 «보이는 손» 의 정점 셋으로 틀을 잡아 매 프레임 거기에 칼을 놓는다.
   쉬는 자세에서 칼날은 슬롯 로컬 +Y(= 앞) — 늘어뜨린 손에서 칼이 앞으로 나가는 쥐는 법. tools/3d/jeong-clips.mjs 가 같은 틀로 칼날 방향을 푼다. */
export function makeSaber(THREE) {
  const g = new THREE.Group(); g.name = 'JeongSaber';
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: .9, roughness: .28 }), gold = new THREE.MeshStandardMaterial({ color: 0xc9a45e, metalness: .85, roughness: .35 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: .7 }), crystal = new THREE.MeshStandardMaterial({ color: 0x2a1236, emissive: 0x7a3cff, emissiveIntensity: .55, metalness: .1, roughness: .25 });
  const h = new THREE.Mesh(new THREE.CylinderGeometry(.016, .018, .2, 8), grip); h.position.y = -.06; g.add(h);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), gold); pommel.position.y = -.165; g.add(pommel);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(.1, .012, .028), gold); guard.position.y = .045; g.add(guard);
  const L = .82, seg = 12, pts = []; for (let i = 0; i <= seg; i++) { const t = i / seg; pts.push(new THREE.Vector3(Math.pow(t, 2) * .05, .05 + t * L, 0)); }   /* 휨: 칼끝으로 갈수록 등 쪽 */
  const shape = new THREE.Shape(); shape.moveTo(0, -.011); shape.lineTo(.0035, -.011); shape.lineTo(.0035, .009); shape.lineTo(0, .013); shape.lineTo(-.0035, .009); shape.lineTo(-.0035, -.011);
  g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { steps: seg, bevelEnabled: false, extrudePath: new THREE.CatmullRomCurve3(pts) }), steel));
  for (let i = 0; i < 5; i++) { const t = .5 + i * .085, c = new THREE.Mesh(new THREE.OctahedronGeometry(.012 + (i % 3) * .005, 0), crystal);   /* 결정: 칼등 위쪽에 덧자란 조각 — 작게 */
    c.position.set(Math.pow(t, 2) * .05 + .006, .05 + t * L, (i % 2 ? .008 : -.008)); c.scale.set(.6, 1.7, .6); c.rotation.z = -.4 + (i % 3) * .3; g.add(c); }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
  return g;
}

/* 보이는 손의 틀: 슬롯 근처 정점 셋(A·B·C) → 원점 A, x = AB, z = AB × AC */
export function createGrip(THREE, model) {
  let mesh = null, slot = null; model.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; if (!slot && /RightHandSlot$/.test(o.name)) slot = o; });
  if (!mesh || !slot) return null;
  model.updateMatrixWorld(true);
  /* 뼈대가 메시보다 넓게 박혀 있다(손 뼈 x=−0.52, 메시 손 x≈−0.37) — 슬롯 근처엔 정점이 없다.
     그래서 쉬는 자세(늘어뜨린 팔)에서 «오른쪽 끝·가장 낮은» 정점 무리를 손으로 본다 */
  const pos = mesh.geometry.attributes.position, v = new THREE.Vector3(), all = [];
  const skinned = (i, out) => { mesh.getVertexPosition(i, out); return out.applyMatrix4(mesh.matrixWorld); };
  const inv = model.matrixWorld.clone().invert(), lv = new THREE.Vector3(); let maxX = 0;
  for (let i = 0; i < pos.count; i++) { skinned(i, v); lv.copy(v).applyMatrix4(inv); all.push([i, v.clone(), lv.clone()]); maxX = Math.max(maxX, -lv.x); }
  const arm = all.filter(a => -a[2].x > maxX * .72).sort((a, b) => a[2].y - b[2].y).slice(0, 160); if (arm.length < 3) return null;
  const sp = arm.reduce((c, a) => c.add(a[1]), new THREE.Vector3()).divideScalar(arm.length);   /* 주먹 가운데 */
  const near = arm.map(a => [a[1].distanceTo(sp), a[0], a[1]]).sort((a, b) => a[0] - b[0]);
  const A = near[0]; let Bv = near[1], best = 0; for (const n of near) { const d = n[2].distanceTo(A[2]); if (d > best) { best = d; Bv = n; } }
  let Cv = near[2], area = 0; for (const n of near) { const a = n[2].clone().sub(A[2]).cross(Bv[2].clone().sub(A[2])).length(); if (a > area) { area = a; Cv = n; } }
  const idx = [A[1], Bv[1], Cv[1]], pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), M = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
  const frame = (out = new THREE.Matrix4()) => { skinned(idx[0], pa); skinned(idx[1], pb); skinned(idx[2], pc);
    X.subVectors(pb, pa).normalize(); Z.crossVectors(X, pc.clone().sub(pa)).normalize(); Y.crossVectors(Z, X); return out.makeBasis(X, Y, Z).setPosition(pa); };
  /* 쉬는 자세에서 «칼 = 슬롯» 이 되게 틀 기준 오프셋을 정한다 */
  const rest = slot.matrixWorld.clone(), P = new THREE.Vector3(), Qr = new THREE.Quaternion(), Sc = new THREE.Vector3(); rest.decompose(P, Qr, Sc); rest.compose(sp, Qr, Sc);   /* 자리는 주먹 가운데, 방향은 슬롯 */
  const off = frame(new THREE.Matrix4()).invert().multiply(rest);
  return { idx, frame, off,
    /* 지금 칼이 있어야 할 월드 행렬 */ world(out = new THREE.Matrix4()) { return out.copy(frame(M).multiply(off)); },
    /* 칼날 방향(월드) — 슬롯 +Y 를 손 틀로 옮긴 것 */ blade(out = new THREE.Vector3()) { const m = frame(M).multiply(off); return out.set(0, 1, 0).transformDirection(m); } };
}
export function attachSaber(THREE, model) {
  const grip = createGrip(THREE, model); if (!grip) return null; const s = makeSaber(THREE); model.add(s); s.matrixAutoUpdate = false;
  const inv = new THREE.Matrix4(), W = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  /* 자리 = 보이는 주먹(손 틀), 방향 = 슬롯 뼈(클립이 칼 방향을 굽는다 — 정점이 없어 메시를 안 일그러뜨린다) */
  let slot = null; model.traverse(o => { if (!slot && /RightHandSlot$/.test(o.name)) slot = o; });
  const api = { mesh: s, grip, update() { model.updateMatrixWorld(true); grip.world(W); P.setFromMatrixPosition(W); slot.getWorldQuaternion(Q);
    inv.copy(model.matrixWorld).invert(); W.compose(P, Q, S.set(1, 1, 1)); s.matrix.copy(inv.multiply(W)); s.matrix.decompose(P, Q, S);
    s.matrix.compose(P, Q, S.set(1, 1, 1).divideScalar(model.getWorldScale(new THREE.Vector3()).x || 1)); s.matrixWorldNeedsUpdate = true; } };   /* 몸이 비율로 커져도 칼은 실제 길이 */
  api.update(); return api;
}
