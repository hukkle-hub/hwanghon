/* 정적 장면 합치기 (문서 206) — 굽기용 원본 장면은 메시가 수천 개(서귀포 4,908 · 강남 11,122)라 실시간이면 그리기 호출이 2천 번을 넘는다.
   같은 재질 · 같은 그림자 설정 · 같은 속성 구성 · 48 m 칸끼리 한 메시로 합친다. 칸으로 나눠야 화면 밖 덩어리가 통째로 빠진다(절두체 컬링).
   합치기 전에 «카메라를 막는 것»(높이 1.2 m 넘는 것)의 월드 상자를 모아 둔다 — 3인칭 카메라가 건물·바위 속으로 들어가지 않게.
   인스턴스·뼈대 메시·자식 달린 메시는 건드리지 않는다. 투명한 것도 같은 재질끼리만 합친다 (강남 4,416 개 — 대부분 같은 유리). */
import * as THREE from '../../vendor/three/three.module.js';
import { mergeGeometries } from '../../vendor/three/BufferGeometryUtils.js';

export function mergeStatic(scene, { cell = 48, skip = null, camMinH = 1.2 } = {}) {
  scene.updateMatrixWorld(true);
  const groups = new Map(), camBoxes = [], box = new THREE.Box3(), c = new THREE.Vector3(); let before = 0;
  /* 같은 설정의 재질은 하나로 — 빌더가 물체마다 재질을 새로 만들어 강남은 재질이 1,610 개였다 (대부분 같은 값) */
  const canon = new Map(), sig = m => [m.type, m.color && m.color.getHex(), m.emissive && m.emissive.getHex(), m.emissiveIntensity, m.roughness, m.metalness, m.map && m.map.uuid, m.emissiveMap && m.emissiveMap.uuid,
    m.transparent, m.opacity, m.side, m.depthWrite, m.depthTest, m.blending, m.toneMapped, m.vertexColors, m.alphaTest, m.fog, m.flatShading, m.wireframe, m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits].join('|');
  let dedup = 0;
  scene.traverse(o => {
    if (!o.isMesh) return; before++;
    if (o.isSkinnedMesh || !o.visible || (skip && skip(o))) return;
    if (o.isInstancedMesh) { if (!o.userData.noCam) camFromInstanced(o); return; }   /* 잡초·까마귀(noCam) — 인스턴스마다 상자를 만들면 수천 개 (문서 219) */
    if (Array.isArray(o.material) || o.children.length) { camFrom(o); return; }   /* 합치지는 않아도 카메라는 막는다 — 재질 여럿인 건물이 막이에서 통째로 빠져 강남 시점 2% 가 지붕에 가렸다 */
    if (!o.material.onBeforeCompile || o.material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile) { const k = sig(o.material), m0 = canon.get(k); if (!m0) canon.set(k, o.material); else if (m0 !== o.material) { o.material = m0; dedup++; } }
    const g = o.geometry; camFrom(o);
    if ((g.morphAttributes && Object.keys(g.morphAttributes).length) || Object.values(g.attributes).some(a => a.isInterleavedBufferAttribute)) return;
    box.getCenter(c);
    const key = [o.material.uuid, o.castShadow, o.receiveShadow, o.renderOrder, g.index ? 1 : 0, Object.keys(g.attributes).sort().join(','), Math.floor(c.x / cell), Math.floor(c.z / cell)].join('|');
    let list = groups.get(key); if (!list) groups.set(key, list = []); list.push(o);
  });
  function camFrom(o) { const g = o.geometry; box.setFromObject(o); if (o.userData.noCam) return;   /* noCam: 건물에 붙은 꾸밈(상가 띠·간판·옥상 물건) — 건물 상자가 이미 막는다. 상자는 먼저 잰다 — 합치기 칸(48 m)을 이 상자로 정한다 (문서 218) */
    /* 천장(camBlock): 두께 0.12 m 라 «키 1.2 m 넘는 것» 에서 빠져, 높은 카메라가 천장 위로 나가 천장 윗면만 찍었다 (2호선 선로 — 문서 206 §10) */
    if (!((box.max.y - box.min.y > camMinH && box.max.y > 1.4) || o.userData.camBlock)) return; if (!g.boundingBox) g.computeBoundingBox(); const ob = obb(box, g.boundingBox, o.matrixWorld);
    /* 오목한 건물(ㄷ·ㅁ자, 마당 낀 블록)은 상자 안에 걸을 수 있는 땅이 있다 — 머리가 상자 안이면 상자로는 못 재니 실제 면을 남겨 둔다 (문서 206 §16) */
    const pos = g.attributes.position;
    if (Math.max(box.max.x - box.min.x, box.max.z - box.min.z) > SHELL_MIN && pos) { const sg = new THREE.BufferGeometry(), P = new Float32Array(pos.count * 3); for (let i = 0; i < pos.count; i++) { P[i * 3] = pos.getX(i); P[i * 3 + 1] = pos.getY(i); P[i * 3 + 2] = pos.getZ(i); }   /* 끼워진(interleaved) 속성도 하나씩 읽는다 */
      sg.setAttribute('position', new THREE.BufferAttribute(P, 3)); if (g.index) sg.setIndex(g.index.clone()); sg.applyMatrix4(o.matrixWorld); sg.computeBoundingSphere(); sg.computeBoundingBox(); ob.shell = new THREE.Mesh(sg, SHELL_MAT); ob.shell.updateMatrixWorld(true); }
    camBoxes.push(ob); }
  function camFromInstanced(o) {   /* 나무·바위 인스턴스: 하나하나 상자 (기하 상자 × 인스턴스 행렬) */
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const h = g.boundingBox.max.y - g.boundingBox.min.y; const m = new THREE.Matrix4();
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); const w = new THREE.Matrix4().multiplyMatrices(o.matrixWorld, m), b = g.boundingBox.clone().applyMatrix4(w); if (b.max.y - b.min.y > camMinH && h > 0) camBoxes.push(obb(b, g.boundingBox, w)); } }
  let merged = 0, removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(o => { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); return g; });
    const mg = mergeGeometries(geos, false); geos.forEach(g => g.dispose()); if (!mg) continue;
    const s = list[0], m = new THREE.Mesh(mg, s.material); m.castShadow = s.castShadow; m.receiveShadow = s.receiveShadow; m.renderOrder = s.renderOrder; m.name = 'merged';
    scene.add(m); merged++;
    for (const o of list) { o.parent && o.parent.remove(o); removed++; }
  }
  let after = 0; scene.traverse(o => { if (o.isMesh) after++; });
  return { before, after, merged, removed, dedup, materials: canon.size, camBoxes };
}

/* 카메라 막이 상자: 세계 축 상자(빨리 거르기) + 물체 자신의 방향 상자. 축 상자만 쓰면 28° 돌아간 긴 벽의 상자가 실제보다 훨씬 커서
   좁은 통로에서 카메라가 등에 붙었다 (2호선 침수 선로 1.7 m — 문서 206 §7) */
const SHELL_MIN = 4, SHELL_MAT = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), shellRay = new THREE.Raycaster();
function obb(world, local, mw) { return { aabb: world.clone(), local: local.clone(), mw: mw.clone(), inv: mw.clone().invert() }; }
/* 카메라 당기기: 머리(at)에서 원하는 자리(want)까지 상자에 처음 닿는 거리. 없으면 Infinity */
export function firstHit(boxes, at, want, pad = 0.25) {
  const dir = new THREE.Vector3().subVectors(want, at), len = dir.length(); if (len < 1e-4) return Infinity; dir.divideScalar(len);
  const ray = new THREE.Ray(at, dir), lr = new THREE.Ray(), p = new THREE.Vector3(); let best = Infinity;
  /* 실제 면이 있으면(큰 것) 상자는 «후보» 일 뿐 — 면으로 확인한다. 오목한 건물 마당(머리가 상자 안)도, 둥근 나무의 상자 모서리(빈 곳)도 면이 답이다 (문서 206 §16) */
  const exact = b => { shellRay.set(at, dir); shellRay.near = 0.05; shellRay.far = Math.min(best, len); const h = shellRay.intersectObject(b.shell, false)[0]; if (h && h.distance < best) best = h.distance; };
  for (const b of boxes) { const A = b.aabb || b;
    if (A.containsPoint(at)) { if (b.shell) exact(b); continue; }
    if (!ray.intersectBox(A, p)) continue;
    if (b.shell) { exact(b); continue; }
    if (!b.local) { const d = p.distanceTo(at); if (d < best) best = d; continue; }
    lr.copy(ray).applyMatrix4(b.inv); if (b.local.containsPoint(lr.origin) || !lr.intersectBox(b.local, p)) continue; p.applyMatrix4(b.mw); const d = p.distanceTo(at); if (d < best) best = d; }
  return best < len ? Math.max(0.6, best - pad) : Infinity;
}
