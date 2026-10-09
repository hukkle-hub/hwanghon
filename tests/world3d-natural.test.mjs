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
  assert.match(W3D, /if \(b\.max\.y - b\.min\.y > 0\.02 \|\|/); assert.match(W3D, /diffuseColor\.rgb \*= 1\.0 - uCloudK \* cs;/); assert.match(W3D, /CLOUDK\.value = 0\.3 \* Math\.min\(1, Math\.max\(0, \(sy - 0\.08\)/);   /* 구름 그림자: 해가 낮으면 0 */ assert.match(W3D, /m\.metalness = 0\.06; m\.color\.multiplyScalar\(0\.72\);/);
});

test('3D 물: 하늘을 비추는 셰이더 · 바닥보다 앞으로 · 물가 거품 · 막이와 장면 난수는 2D 와 같다', () => {
  const osm = { areas: [{ kind: 'water', poly: [[-40, -20], [40, -20], [40, 20], [-40, 20]] }], lines: [{ kind: 'water:river', width: 20, line: [[-60, 40], [60, 40]] }, { kind: 'coastline', line: [[-80, -60], [80, -60]] }] };
  const run = v3 => { let n = 0; const s = L.rng(9); L.setView3d(v3); try { const ctx = mkCtx(() => { n++; return s(); }); L.areas(ctx, osm, tex); L.lines(ctx, osm); return { n, ctx }; } finally { L.setView3d(false); } };
  const a = run(false), b = run(true);
  assert.equal(b.n, a.n, '3D 물이 장면 난수를 더/덜 쓴다'); assert.deepEqual(b.ctx.blockers, a.ctx.blockers, '막이가 다르다');
  const mats = c => c.scene.children.filter(o => o.isMesh).map(o => o.material);
  const w3 = mats(b.ctx).filter(m => m.userData.water), w2 = mats(a.ctx).filter(m => m.userData.water);
  assert.equal(w2.length, 0, '2D 굽기 물이 바뀌었다'); assert.ok(w3.length >= 3, '3D 물 ' + w3.length);
  for (const m of w3) { assert.equal(m.customProgramCacheKey(), 'water'); assert.ok(m.polygonOffset && m.polygonOffsetUnits < 0 && m.polygonOffsetFactor === 0, '물은 바닥판보다 앞으로'); assert.equal(m.metalness, 0); }
  const sh = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <normal_fragment_maps>\n#include <emissivemap_fragment>\n#include <lights_fragment_end>' }; w3[0].onBeforeCompile(sh);
  assert.match(sh.fragmentShader, /skyRefl\(/); assert.match(sh.fragmentShader, /directSpecular \*= 0\.15/); assert.ok(sh.uniforms.uRidge && sh.uniforms.uTop.value, '하늘 uniform');
  const foam = c => c.scene.children.filter(o => o.isMesh && o.material.userData.foam).length;
  assert.equal(foam(a.ctx), 0, '2D 에 거품'); assert.equal(foam(b.ctx), 1 + 2 + 2, '거품 띠 (호수 1 · 강둑 2 · 바닷가 2)');
  assert.match(W3D, /WATER\.uRidge\.value = U\.ridge\.value/);
});

test('3D 사냥터 꾸밈: 덤불 덩어리 · 바위 반쯤 묻기 · 풀포기(무릎 아래) — 막이와 장면 난수는 2D 와 같다', () => {
  const region = { s0: -60, s1: 60, t0: -40, t1: 40 };
  const run = v3 => { let n = 0; const s = L.rng(13); L.setView3d(v3); try { const ctx = mkCtx(() => { n++; return s(); }); const stat = L.dress(ctx, region, tex, { urban: true }); return { n, ctx, stat }; } finally { L.setView3d(false); } };
  const a = run(false), b = run(true);
  assert.equal(b.n, a.n, '3D 꾸밈이 장면 난수를 더/덜 쓴다'); assert.deepEqual(b.ctx.blockers, a.ctx.blockers, '막이가 다르다');
  assert.equal(b.stat.rocks, a.stat.rocks); assert.equal(b.stat.bushes, a.stat.bushes); assert.ok(!a.stat.tufts && b.stat.tufts > 20, '풀포기 ' + b.stat.tufts);
  const tuft = b.ctx.scene.children.find(o => o.isInstancedMesh && o.material.userData.tuft); assert.ok(tuft, '풀포기 메시');
  const m = new THREE.Matrix4(), sc = new THREE.Vector3(); let hMax = 0; for (let i = 0; i < tuft.count; i++) { tuft.getMatrixAt(i, m); sc.setFromMatrixScale(m); hMax = Math.max(hMax, sc.y * 0.7); }
  assert.ok(hMax < 0.75, '풀포기가 인물을 가린다 ' + hMax.toFixed(2)); assert.equal(tuft.material.customProgramCacheKey(), 'grass-wind');
  const bush = b.ctx.scene.children.filter(o => o.isInstancedMesh && o.material.userData.wind && o.geometry.attributes.position.count >= 180 && o.geometry.attributes.position.count <= 240); assert.ok(bush.length > 0 && bush.every(o => o.instanceColor), '덤불 덩어리·색');
});

test('지하철 출구: 3D 는 새까만 판 대신 내려가는 계단 착시 · 2D 굽기는 그대로', () => {
  const src = fs.readFileSync(new URL('../js/mmo/env-osm.js', import.meta.url), 'utf8');
  assert.match(src, /if \(!L\.isView3d\(\)\) \{ const hole = new THREE\.Mesh\(new THREE\.PlaneGeometry\(5\.6, 2\.8\), new THREE\.MeshBasicMaterial\(\{ color: 0x020203 \}\)\)/, '2D 구멍이 바뀌었다');
  assert.match(src, /else g\.add\(stairDown\(THREE\)\);/);
  assert.match(src, /k = 0\.11 \* Math\.pow\(1 - i \/ 10, 2\.2\)/, '단마다 어두워진다');
});

test('별: 밤에만(윗하늘 선형 밝기로) — 잰 값 밤 0.0061 · 황혼 0.0194 · 낮 0.128', () => {
  const m = SKY_FRAG.match(/float dark = 1\.0 - smoothstep\(([\d.]+), ([\d.]+), dot\(top, vec3\(0\.3, 0\.5, 0\.2\)\)\);/); assert.ok(m, '별 세기 식');
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }, dark = x => 1 - ss(+m[1], +m[2], x);
  assert.ok(dark(0.0061) > 0.9, '밤에 별이 없다'); assert.ok(dark(0.0194) < 0.35, '황혼에 별이 너무 많다 ' + dark(0.0194).toFixed(2)); assert.equal(dark(0.1279), 0, '낮에 별'); assert.equal(dark(0.0606), 0, '새벽에 별');
});
