/* 작은 구멍 메우기 (문서 229 §52) — N01 보행자 목의 검은 틈 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import { loadGlb } from '../tools/3d/stretch-audit.mjs';
import { fillSmallHoles, FILL } from '../js/mmo/hole-fill.js';

/* 정점을 자리로 묶은 뒤 무방향 변 쓰임 수 · 방향 변 쓰임 수 */
function edges(geo) { const pos = geo.attributes.position, idx = geo.index, id = new Map(), key = [];
  for (let i = 0; i < pos.count; i++) { const k = [pos.getX(i), pos.getY(i), pos.getZ(i)].map(c => Math.round(c * 1e4)).join(); if (!id.has(k)) id.set(k, id.size); key.push(id.get(k)); }
  const un = new Map(), di = new Map();
  for (let t = 0; t < idx.count; t += 3) for (let k = 0; k < 3; k++) { const a = key[idx.getX(t + k)], b = key[idx.getX(t + (k + 1) % 3)]; const u = Math.min(a, b) + '_' + Math.max(a, b); un.set(u, (un.get(u) || 0) + 1); di.set(a + '>' + b, (di.get(a + '>' + b) || 0) + 1); }
  return { open: [...un.values()].filter(n => n === 1).length, flipped: [...di.values()].filter(n => n > 1).length }; }
/* 상자 하나에서 면을 몇 개 빼서 구멍을 낸다 — 정점은 면마다 따로(UV 이음처럼) */
function boxWithHoles(size, drop) { const g = new T.BoxGeometry(size, size, size, 2, 2, 2), idx = [...g.index.array], keep = [];
  for (let t = 0; t < idx.length; t += 3) if (!drop.includes(t / 3)) keep.push(idx[t], idx[t + 1], idx[t + 2]); g.setIndex(keep); g.clearGroups(); return new T.Mesh(g); }

test('작은 구멍은 막히고 감는 방향이 이웃 면과 같다', () => {
  const m = boxWithHoles(.02, [0, 1]); const before = edges(m.geometry); assert.equal(before.open, 4, '사각 구멍 하나(변 4)');
  const r = fillSmallHoles(T, m); const after = edges(m.geometry);
  assert.deepEqual(r, { loops: 1, tris: 2 }); assert.equal(after.open, 0, '열린 변 없음'); assert.equal(after.flipped, 0, '같은 방향 변이 둘이면 뒤집힌 면');
  assert.deepEqual(fillSmallHoles(T, m), { loops: 0, tris: 0 }, '한 번만');
});
test('한 정점에서 만나는 두 구멍(8 자)도 각각 막는다', () => {
  const m = boxWithHoles(.02, [0, 1, 6, 7]);   /* +x 면의 대각 두 칸 — 가운데 정점 하나를 같이 쓴다 */
  assert.equal(edges(m.geometry).open, 8); const r = fillSmallHoles(T, m); assert.equal(r.loops, 2); assert.equal(edges(m.geometry).open, 0); assert.equal(edges(m.geometry).flipped, 0);
});
test('큰 열린 테두리(소매 끝·머리카락)는 건드리지 않는다', () => {
  const m = boxWithHoles(FILL.maxSize * 3, [0, 1]); assert.deepEqual(fillSmallHoles(T, m), { loops: 0, tris: 0 });
});
test('보행자 휴대폰 몸: 목 둘레 열린 변이 대부분 닫히고 몸 크기는 그대로', async () => {
  const g = await loadGlb('art/3d/monsters/n01-candidates/g5_walker_mobile.glb'), body = []; g.scene.traverse(o => { if (o.isSkinnedMesh && /Body/.test(o.name)) body.push(o); });
  const neck = geo => { const pos = geo.attributes.position, idx = geo.index, id = new Map(), key = [], P = []; let len = 0;
    for (let i = 0; i < pos.count; i++) { const k = [pos.getX(i), pos.getY(i), pos.getZ(i)].map(c => Math.round(c * 1e4)).join(); if (!id.has(k)) { id.set(k, id.size); P.push(new T.Vector3().fromBufferAttribute(pos, i)); } key.push(id.get(k)); }
    const E = new Map(); for (let t = 0; t < idx.count; t += 3) for (let k = 0; k < 3; k++) { const a = key[idx.getX(t + k)], b = key[idx.getX(t + (k + 1) % 3)]; if (a !== b) { const e = Math.min(a, b) + '_' + Math.max(a, b); E.set(e, (E.get(e) || 0) + 1); } }
    for (const [e, n] of E) if (n === 1) { const [a, b] = e.split('_').map(Number), y = (P[a].y + P[b].y) / 2; if (y > 1.45 && y < 1.63) len += P[a].distanceTo(P[b]); } return len; };
  const geo = body[0].geometry, box0 = new T.Box3().setFromBufferAttribute(geo.attributes.position), l0 = neck(geo), n0 = geo.index.count;
  const r = fillSmallHoles(T, g.scene), l1 = neck(geo);
  assert.ok(l0 > .9, '전: 목 둘레 열린 변 ' + l0.toFixed(2) + ' m'); assert.ok(l1 < l0 * .3, `후: ${l1.toFixed(2)} m (전 ${l0.toFixed(2)})`);
  assert.ok(geo.index.count > n0 && r.tris < 400, '삼각형 ' + r.tris + ' 개만 더 (손 손목 구멍 포함)');
  assert.deepEqual(new T.Box3().setFromBufferAttribute(geo.attributes.position), box0, '새 정점 없음 — 삐죽 나온 조각이 생길 수 없다');
  const pos = geo.attributes.position, a = new T.Vector3(), b = new T.Vector3(); let worst = 0;
  for (let t = n0; t < geo.index.count; t += 3) for (let k = 0; k < 3; k++) { a.fromBufferAttribute(pos, geo.index.getX(t + k)); b.fromBufferAttribute(pos, geo.index.getX(t + (k + 1) % 3)); worst = Math.max(worst, a.distanceTo(b)); }
  assert.ok(worst <= FILL.maxSize * Math.sqrt(3) + 1e-6, '메운 삼각형 변 ≤ 구멍 크기: ' + worst.toFixed(3));
});
