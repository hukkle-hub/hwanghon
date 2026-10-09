/* 3D 필드 자연 풍경 (문서 220) — 하늘 산·구름 · 길이 풀밭에 안 덮임 · 나무 · 경계. 막이·장면 난수는 2D 와 같아야 한다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} }) }) };
const L = await import('../js/mmo/env-lib.js');
const { ridgeOf, SKY_FRAG } = await import('../js/mmo/sky-shader.js');
const W3D = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8');
const mkCtx = (R = () => 0.5) => ({ THREE, scene: new THREE.Scene(), R, ST: p => [p[0], p[1]], FROM: (s, t) => [s, t], W: p => p, walk: { s0: -100, s1: 100, t0: -100, t1: 100 }, blockers: [], clear: [], lights: [] });
const tex = { asphalt: new THREE.Texture(), paver: new THREE.Texture(), grass: new THREE.Texture(), sand: new THREE.Texture(), concrete: new THREE.Texture(), forest: new THREE.Texture() };

test('하늘 산 능선: 낮은 3인칭 카메라 앞 폐허(지평선 위 ~5°, sin 0.09)보다 높이 · 산 지역 > 바다 지역 · 셰이더가 구름·능선을 그린다', () => {
  const m = ridgeOf('mountain', 3), c = ridgeOf('coast', 3), city = ridgeOf('city', 3);
  assert.ok(m[0] > 0.15 && m[0] > city[0] && city[0] > c[0], JSON.stringify({ m, city, c }));
  for (const k of ['mountain', 'river', 'rural', 'city', 'hub', 'coast', 'island', undefined]) assert.ok(ridgeOf(k)[0] >= 0.09, k + ' 산이 폐허에 가려 안 보인다');
  assert.match(SKY_FRAG, /uniform vec3 top, hor, fogc, sun, sunc, ridge;/); assert.match(SKY_FRAG, /smoothstep\(cover, cover \+ 0\.22, n\)/);
  assert.match(W3D, /ridge: \{ value: new THREE\.Vector3\(\.\.\.ridgeOf\(/); assert.match(W3D, /uniforms\.time\.value \+= dt/);
});

test('3D 에서 길은 풀밭 다각형보다 4 cm 넘게 위 · 깊이 앞당김은 고정 몫만(낮은 물체를 덮지 않게)', () => {
  L.setView3d(true);
  try { const ctx = mkCtx(), osm = { roads: [{ id: 1, kind: 'secondary', lanes: 2, line: [[-50, 0], [50, 0]], layer: 0 }], areas: [{ kind: 'grass', poly: [[-60, -30], [60, -30], [60, 30], [-60, 30]] }] };
    L.areas(ctx, osm, tex); const out = L.roads(ctx, osm, tex); assert.equal(out.length, 1);
    let roadY = null, grassY = null, roadM = null, grassM = null; ctx.scene.updateMatrixWorld(true);
    for (const o of ctx.scene.children) { if (!o.isMesh) continue; const v = new THREE.Vector3().fromBufferAttribute(o.geometry.attributes.position, 0).applyMatrix4(o.matrixWorld);
      if (o.material.map === tex.asphalt) { roadY = v.y; roadM = o.material; } if (o.material.map === tex.grass) { grassY = v.y; grassM = o.material; } }
    assert.ok(roadY - grassY >= 0.04, `길 ${roadY} · 풀밭 ${grassY}`);
    assert.ok(roadM.polygonOffset && roadM.polygonOffsetUnits < 0 && roadM.polygonOffsetFactor === 0, '길 앞당김');
    assert.ok(grassM.polygonOffset && grassM.polygonOffsetUnits > 0 && grassM.polygonOffsetFactor === 0, '풀밭 뒤로');
  } finally { L.setView3d(false); }
});

test('3D 나무: 장면 난수를 2D 와 똑같이 쓴다(뒤 자리·막이가 서버 지도와 같게) · 수관 덩어리 · 바람', () => {
  const pts = [...Array(40)].map((_, i) => [i * 3, (i % 5) * 4]);
  const count = v3 => { let n = 0; const s = L.rng(5); L.setView3d(v3); try { const ctx = mkCtx(() => { n++; return s(); }); L.trees(ctx, pts, { pine: 0.3, dead: 0.1 }); return { n, ctx }; } finally { L.setView3d(false); } };
  const a = count(false), b = count(true); assert.equal(b.n, a.n, '3D 나무가 장면 난수를 더/덜 쓴다');
  const canopy = b.ctx.scene.children.filter(o => o.isInstancedMesh && o.material.flatShading && o.count > 0);
  assert.ok(canopy.some(o => o.geometry.attributes.position.count > 200), '수관이 다면체 하나');
  assert.ok(canopy.every(o => o.material.customProgramCacheKey() === 'wind'), '바람이 안 붙었다'); assert.ok(canopy.some(o => o.instanceColor), '그루마다 색');
});

test('3D 경계: 방호벽·가림막·모래주머니·잔해가 섞인다 · 막이를 안 넣는다 · 빨간 줄 테이프 없음', () => {
  L.setView3d(true);
  try { const ctx = mkCtx(); L.boundary(ctx, { style: 'urban' }); assert.equal(ctx.blockers.length, 0);
    const cols = new Set(); let tape = 0; ctx.scene.traverse(o => { if (o.isMesh) { cols.add(o.material.color.getHex()); if (o.material.color.getHex() === 0xc8302a) tape++; } });
    assert.equal(tape, 0, '빨간 줄이 남았다'); assert.ok(cols.size >= 4, '종류가 섞이지 않았다 ' + cols.size);
  } finally { L.setView3d(false); }
});

test('땅 결: 진짜 평면만(침목 같은 낮은 상자는 빼고) · 바닥 금속성 빼며 색 보정', () => {
  assert.match(W3D, /if \(b\.max\.y - b\.min\.y > 0\.02 \|\|/); assert.match(W3D, /m\.metalness = 0\.06; m\.color\.multiplyScalar\(0\.72\);/);
});
