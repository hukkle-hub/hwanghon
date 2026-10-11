/* 아인 낫 휴대폰 LOD (문서 229 §46) — 자루 정점을 잠가 손잡이 교정(measureAinScythe)이 원본과 같은 축·기준점을 낸다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { measureAinScythe } from '../js/ain-scythe-mount.js';
function sceneOf(f) {   /* GLB 를 직접 읽어 위치만 — 교정은 위치와 노드 변환만 쓴다 */
  const b = fs.readFileSync(f), n = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + n)), bin = b.slice(20 + n + 8), root = new THREE.Group();
  const acc = i => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], off = (v.byteOffset || 0) + (a.byteOffset || 0), st = v.byteStride || 12, out = new Float32Array(a.count * 3);   /* 끼워진(interleaved) 것도 — LOD 는 간격 32 */
    assert.equal(a.componentType, 5126, '위치가 실수가 아니다'); for (let k = 0; k < a.count; k++) for (let c = 0; c < 3; c++) out[k * 3 + c] = bin.readFloatLE(off + k * st + c * 4); return out; };
  const build = (ni, parent) => { const nd = j.nodes[ni], o = nd.mesh != null ? new THREE.Group() : new THREE.Object3D();
    if (nd.matrix) o.applyMatrix4(new THREE.Matrix4().fromArray(nd.matrix)); if (nd.translation) o.position.fromArray(nd.translation); if (nd.rotation) o.quaternion.fromArray(nd.rotation); if (nd.scale) o.scale.fromArray(nd.scale);
    if (nd.mesh != null) for (const p of j.meshes[nd.mesh].primitives) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(acc(p.attributes.POSITION), 3)); o.add(new THREE.Mesh(g)); }
    parent.add(o); for (const c of nd.children || []) build(c, o); };
  for (const ni of j.scenes[j.scene || 0].nodes) build(ni, root); return { root, j };
}
test('낫 LOD: 삼각형 ≤ 45 % · 교정 축·기준점이 원본과 같다(1 mm) · 오차 6 mm 안', () => {
  const A = sceneOf('art/3d/ain_scythe_tex.glb'), B = sceneOf('art/3d/lod/ain_scythe_tex.glb'), tri = j => j.meshes.reduce((s, m) => s + m.primitives.reduce((t, p) => t + j.accessors[p.indices].count / 3, 0), 0);
  assert.ok(tri(B.j) <= tri(A.j) * 0.45, tri(A.j) + ' → ' + tri(B.j));
  const a = measureAinScythe(A.root), b = measureAinScythe(B.root);
  assert.ok(a.axis.distanceTo(b.axis) < 1e-3 && a.anchor.distanceTo(b.anchor) < 1e-3, '자루 축·기준점'); assert.ok(b.residual < .006);
  assert.ok(a.bladeTip.distanceTo(b.bladeTip) < .03, '날 끝 3 cm 안');
});
test('world3d: 휴대폰은 낫 LOD 경로', () => { assert.match(fs.readFileSync('world3d.html', 'utf8'), /\.replace\(\/\^art\\\/3d\\\/ain_scythe_tex\\\.glb\$\/, 'art\/3d\/lod\/ain_scythe_tex\.glb'\)/); });
