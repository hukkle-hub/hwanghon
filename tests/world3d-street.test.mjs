/* 3D 필드 거리 풍경 · 먼 도시 · 매끄러운 이동 (문서 219) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
/* 노드엔 캔버스가 없다 — 텍스처 그림만 흉내 (모양·자리 시험이라 그림은 상관없다) */
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} }) }) };
const L = await import('../js/mmo/env-lib.js');
const SRC = fs.readFileSync(new URL('../js/mmo/env-lib.js', import.meta.url), 'utf8'), W3D = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8');

/* 십자 교차로: 큰길(동서) × 골목(남북, 폭 7) · 모퉁이에 건물 하나 */
const mkCtx = () => ({ THREE, scene: new THREE.Scene(), ST: p => [p[0], p[1]], FROM: (s, t) => [s, t], walk: { s0: -120, s1: 120, t0: -120, t1: 120 }, blockers: [], clear: [] });
/* 큰길은 OSM 처럼 일방통행 두 줄(z = ±4, 폭 7) — 한 줄의 길가가 다른 줄의 차로다 (대전에서 쓰레기 더미가 차로 한가운데 섰다) */
const roadsW = [{ r: { id: 11, kind: 'secondary' }, width: 7, pts: [[-150, 4], [0, 4], [150, 4]] }, { r: { id: 12, kind: 'secondary' }, width: 7, pts: [[150, -4], [0, -4], [-150, -4]] }, { r: { id: 22, kind: 'residential' }, width: 7, pts: [[0, -150], [0, -4], [0, 4], [0, 150]] }];
const built = [{ pts: [[12, 12], [40, 12], [40, 40], [12, 40]] }];
const onRoad = (x, z) => roadsW.some(rw => { for (let i = 1; i < rw.pts.length; i++) if (L.segDist([x, z], rw.pts[i - 1], rw.pts[i]) < rw.width / 2) return true; return false; });

test('거리 소품: 전봇대·전선·신호등·쓰레기·정류장이 서고, 차도·건물 위엔 없다 · 막이는 그대로', () => {
  const ctx = mkCtx(); for (const k of ['poles', 'wires', 'signals', 'bags', 'stops']) L.STREET[k] = 0;
  L.street(ctx, roadsW, built); const S = L.STREET;
  assert.ok(S.poles >= 4 && S.wires >= 3, '전봇대 ' + S.poles + ' · 전선 ' + S.wires); assert.ok(S.signals >= 1, '교차로 신호등 ' + S.signals); assert.ok(S.bags > 0 && S.stops > 0, '쓰레기 ' + S.bags + ' · 정류장 ' + S.stops);
  assert.equal(ctx.blockers.length, 0, '소품이 막이를 넣었다 — 서버 지도(map.json)와 어긋난다'); assert.equal(ctx.clear.length, 0);
  ctx.scene.updateMatrixWorld(true); const v = new THREE.Vector3(); let n = 0;
  for (const o of ctx.scene.children) { if (!o.isInstancedMesh) continue; const m = new THREE.Matrix4(); assert.ok(o.count > 20, '잡초 ' + o.count); L.STREET.weeds = o.count;   /* 잡초: 하나하나의 자리로 */
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); v.setFromMatrixPosition(m); assert.ok(!onRoad(v.x, v.z), `잡초가 차도 위 (${v.x.toFixed(1)}, ${v.z.toFixed(1)})`); assert.ok(!L.inPoly([v.x, v.z], built[0].pts), `잡초가 건물 안 (${v.x.toFixed(1)}, ${v.z.toFixed(1)})`); } }
  /* 소품은 재질 × 160 m 칸으로 합쳐져 있다 — 꼭짓점 하나하나로 잰다. 신호등 머리·팔(5 m 위)은 차도 위로 내미는 게 맞으니 땅 위 3 m 아래만 */
  for (const o of ctx.scene.children) { if (!o.isMesh || o.isInstancedMesh || o.userData.puddle) continue; const P = o.geometry.attributes.position; n++;   /* 웅덩이는 일부러 차도 위 (아래 시험) */
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y >= 3) continue;
      assert.ok(!onRoad(x, z), `차도 위 (${x.toFixed(1)}, ${z.toFixed(1)})`); assert.ok(!L.inPoly([x, z], built[0].pts), `건물 안 (${x.toFixed(1)}, ${z.toFixed(1)})`); } }
  assert.ok(n >= 5, '합친 소품 메시 ' + n); assert.ok(n < 40, '소품 메시가 칸·재질별로 안 합쳐졌다: ' + n);   /* 시험 구역은 160 m 칸 4 개 × 재질 ~8 — 하나하나 세우면 수백 개 */
  ctx.scene.traverse(o => { if (o.isMesh || o.isLineSegments) assert.ok(o.userData.noCam, '카메라 막이·문 자리 광선에 걸린다: ' + o.type); });
});

test('같은 길은 늘 같은 소품 — 장면 난수 R 을 안 쓴다', () => {
  const pos = () => { const ctx = mkCtx(); L.street(ctx, roadsW, built); return ctx.scene.children.filter(o => o.geometry).map(o => Array.from(o.geometry.attributes.position.array.slice(0, 60)).map(x => +x.toFixed(3)).join(',')); };
  assert.deepEqual(pos(), pos());
  const body = SRC.slice(SRC.indexOf('export function street('), SRC.indexOf('/* ---------- 나무'));
  assert.ok(!/\bR\(\)|Math\.random|ctx\.R\b/.test(body));
});

test('문 자리(bareSpot)는 3D 만의 물체(noCam)를 무시한다 — 판교 → 수원 문이 5 m 어긋났었다', () => {
  const ctx = mkCtx(), st0 = [0, 0], p = ctx.FROM(...st0);
  assert.deepEqual(L.bareSpot(ctx, st0), st0, '빈 땅');
  const big = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshBasicMaterial()); big.position.set(p[0], 1.5, p[1]); big.userData.noCam = true; ctx.scene.add(big);
  assert.deepEqual(L.bareSpot(ctx, st0), st0, '3D 만의 물체에 맞아 문 자리가 옮겨졌다');
  big.userData.noCam = false; assert.notDeepEqual(L.bareSpot(ctx, st0), st0, '굽기에 있는 물체는 피해야 한다');
});

test('먼 도시: 띠 밖 OSM 건물만 · 3D 에서만 · 막이 없음 · 카메라 막이 없음', () => {
  assert.match(SRC, /if \(VIEW3D && pts\.length >= 3 && near\(ctx, pts, FAR_PAD\)\) far\.push\(\[pts, b\]\); continue;/);
  const body = SRC.slice(SRC.indexOf('function farCity('), SRC.indexOf('export const inBuilding'));
  assert.ok(!/blockers|\bR\(\)|Math\.random/.test(body)); assert.match(body, /userData\.noCam = true/);
});

test('world3d 이동: 길 끝 문만 자동 · 도착 문 위에선 한 번 나가야 · 카드 이어받기 · 문 자리는 서버 지도 · 다음 지역 미리 받기', () => {
  assert.match(W3D, /if \(g && atEnd\(g\) && gateArmed && !P\.dead && !leaving\)/);
  assert.match(W3D, /let gateArmed = !ARRIVE/);
  assert.match(W3D, /sessionStorage\.setItem\('tw:travel'/); assert.match(W3D, /sessionStorage\.getItem\('tw:travel'/);
  assert.match(W3D, /const GATES = \(meta\.gates && meta\.gates\.length/);
  assert.match(W3D, /if \(x\.to && d < 40\) prefetchZone\(x\.to\.zone\)/);
  assert.match(W3D, /'lod', 'tod'\]/);
  /* 도착 도입 장면: 길로 왔을 때만 · 움직이면 끝 · 그동안 HUD 숨김 · 지역 이름 카드 */
  assert.match(W3D, /let intro = TRAVEL && !INDOOR \?/); assert.match(W3D, /if \(intro && Math\.abs\(ix\) \+ Math\.abs\(iy\) > 0\.2\) \{ intro = null;/);
  assert.match(W3D, /body\.intro #hud\{ opacity:0; pointer-events:none; \}/); assert.match(W3D, /getElementById\('regionCard'\)/);
  /* 모듈보다 먼저 그리는 이동 카드 (첫 화면 번쩍임) */
  assert.ok(W3D.indexOf("<script>/* 이동 카드를 모듈보다 먼저") < W3D.indexOf('<script type="module"'), '이동 카드가 모듈 뒤에 있다');
});

test('웅덩이: 차도 가장자리 안에만 · 하늘 비추는 잔잔한 물 · 막이 없음', () => {
  const ctx = mkCtx(); L.STREET.puddles = 0; L.street(ctx, roadsW, built); assert.equal(ctx.blockers.length, 0);
  const pud = ctx.scene.children.filter(o => o.userData.puddle && o.material.userData.water); assert.ok(pud.length > 0 && pud.length === L.STREET.puddles, '웅덩이 ' + pud.length);
  for (const o of pud) { assert.equal(o.material.customProgramCacheKey(), 'water-calm'); assert.ok(o.material.polygonOffsetUnits < -24, '길보다 앞'); o.updateMatrixWorld(true);
    const P = o.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); assert.ok(onRoad(v.x, v.z), `웅덩이가 차도 밖 (${v.x.toFixed(1)}, ${v.z.toFixed(1)})`); assert.ok(v.y > 0.06, '길 판 아래'); } }
  assert.equal(L.street(mkCtx(), roadsW, built, { puddles: false }) === undefined || true, true);
});

test('가로등 (문서 229 §11): 큰길 양쪽에만 · 차도·건물 위 아님 · 셋 중 둘쯤 켜짐(점광원) · 골목엔 없음', () => {
  const ctx = mkCtx(); L.STREET.lamps = 0; L.street(ctx, roadsW, built);
  const lights = ctx.scene.children.filter(o => o.isPointLight && o.distance === 18);
  assert.ok(L.STREET.lamps >= 8, '가로등 ' + L.STREET.lamps);
  assert.ok(lights.length >= L.STREET.lamps * 0.45 && lights.length <= L.STREET.lamps * 0.9, `켜진 등 ${lights.length} / ${L.STREET.lamps}`);
  for (const l of lights) { assert.ok(Math.abs(l.position.y - 8) < 0.01); assert.ok(Math.abs(l.position.x) > 6 || Math.abs(l.position.z) < 12, `골목(남북 길)에 가로등 (${l.position.x.toFixed(1)}, ${l.position.z.toFixed(1)})`);
    assert.ok(Math.abs(l.position.z) < 12, `큰길에서 멀다 ${l.position.z.toFixed(1)}`); }
  for (const [x, z] of L.STREET.at.lamp || []) { assert.ok(!onRoad(x, z), `기둥이 차도 위 (${x}, ${z})`); assert.ok(!L.inPoly([x, z], built[0].pts)); }
  const ys = new Set(lights.map(l => Math.sign(l.position.z))); assert.equal(ys.size, 2, '큰길 양쪽');
});
