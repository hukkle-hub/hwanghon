/* 3인칭 카메라 막이 (문서 206 §16) — 오목한 건물 안마당 · 재질 여럿인 건물. 강남 시점 2% 가 낮은 지붕에 가려 영웅이 안 보였다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { mergeStatic, firstHit } from '../js/mmo/static-merge.js';

/* ㄷ자 건물(높이 3 m): 가운데 마당(x −3~3, z 0~8)은 비어 있고, 둘레 세 칸이 건물 */
function uBuilding(materials = 1) { const g = new THREE.Group(), parts = [[-6, -3, 0, 8], [3, 6, 0, 8], [-6, 6, 8, 11]], geos = parts.map(([x0, x1, z0, z1]) => { const b = new THREE.BoxGeometry(x1 - x0, 3, z1 - z0); b.translate((x0 + x1) / 2, 1.5, (z0 + z1) / 2); return b; });
  const merged = new THREE.BufferGeometry(), pos = [], idx = []; let off = 0; for (const b of geos) { const p = b.attributes.position; for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i)); for (const i of b.index.array) idx.push(i + off); off += p.count; }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); merged.setIndex(idx); merged.computeVertexNormals();
  if (materials > 1) { merged.addGroup(0, idx.length / 2, 0); merged.addGroup(idx.length / 2, idx.length / 2, 1); }
  const m = new THREE.Mesh(merged, materials > 1 ? [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()] : new THREE.MeshStandardMaterial()); g.add(m); return g; }

test('오목한 건물 마당에 선 영웅 — 머리가 감싸는 상자 안이어도 카메라가 지붕 앞으로 당겨진다', () => {
  const scene = new THREE.Scene(); scene.add(uBuilding()); const { camBoxes } = mergeStatic(scene);
  const at = new THREE.Vector3(0, 1.45, 4), behind = new THREE.Vector3(5.2, 3.2, 4), open = new THREE.Vector3(0, 3.2, -1.2);   /* 옆 건물 쪽(지붕 위로) · 마당 입구 쪽(빈 길) */
  const h = firstHit(camBoxes, at, behind); assert.ok(h < Infinity && h < 3.2, '옆 건물 지붕을 못 봤다: ' + h);
  assert.equal(firstHit(camBoxes, at, open), Infinity, '빈 마당 입구 쪽까지 당긴다');
});

test('재질이 여럿인 건물도 막이에 들어간다 (합치기에서 빠져도)', () => {
  const scene = new THREE.Scene(); scene.add(uBuilding(2)); const { camBoxes } = mergeStatic(scene);
  assert.ok(camBoxes.length >= 1, '재질 여럿인 건물이 막이에서 빠졌다');
  assert.ok(firstHit(camBoxes, new THREE.Vector3(0, 1.45, 4), new THREE.Vector3(5.2, 3.2, 4)) < Infinity);
});
