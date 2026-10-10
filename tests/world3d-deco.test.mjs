/* 3D 필드 멀쩡한 건물 꾸밈 (문서 218) — 옥상 난간·물탱크·실외기 · 1층 상가 띠 · 간판. 막이는 그대로, 카메라 막이에선 빠진다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { buildingDeco, inPoly, segDist } from '../js/mmo/env-lib.js';
import { mergeStatic } from '../js/mmo/static-merge.js';

const SRC = fs.readFileSync(new URL('../js/mmo/env-lib.js', import.meta.url), 'utf8');
/* ㄱ자 (오목) 윤곽 · 시계/반시계 둘 다 */
const PTS = [[0, 0], [16, 0], [16, 8], [9, 8], [9, 14], [0, 14]], REV = [...PTS].reverse();
const dist = (x, z, pts) => Math.min(...pts.map((p, i) => segDist([x, z], p, pts[(i + 1) % pts.length])));
const all = P => Object.values(P).flat();
const flat = g => Array.from(g.attributes.position.array);

test('같은 건물은 늘 같은 꾸밈 — 건물 id 해시만 (장면 난수 R 을 안 쓴다)', () => {
  const a = buildingDeco(THREE, PTS, 14, 777, { roof: true, shops: true }), b = buildingDeco(THREE, PTS, 14, 777, { roof: true, shops: true }), c = buildingDeco(THREE, PTS, 14, 778, { roof: true, shops: true });
  assert.deepEqual(all(a).map(flat), all(b).map(flat)); assert.notDeepEqual(all(a).map(flat), all(c).map(flat));
  const body = SRC.slice(SRC.indexOf('const SIGNS = ['), SRC.indexOf('/* ---------- 나무'));
  assert.ok(!/\bR\(\)|Math\.random/.test(body), '꾸밈이 장면 난수를 쓴다 — 뒤 자리가 2D 굽기와 어긋난다');
});

test('상가 띠는 바깥을 본다 — 오목한 윤곽 · 감는 방향이 반대여도', () => {
  for (const pts of [PTS, REV]) { const P = buildingDeco(THREE, pts, 10, 5, { shops: true, signs: false }); assert.ok(P.shop.length >= 10, '상가 칸 ' + P.shop.length);
    for (const g of P.shop) { const p = g.attributes.position, i = g.index.array, v = k => new THREE.Vector3(p.getX(i[k]), p.getY(i[k]), p.getZ(i[k]));
      const n = new THREE.Vector3().subVectors(v(1), v(0)).cross(new THREE.Vector3().subVectors(v(2), v(0))).normalize();   /* 실제 앞면 = 감는 방향 */
      const mx = (p.getX(0) + p.getX(1)) / 2, mz = (p.getZ(0) + p.getZ(1)) / 2;
      assert.ok(!inPoly([mx + n.x * 0.5, mz + n.z * 0.5], pts), `앞면이 벽 안쪽을 본다 (${mx.toFixed(1)}, ${mz.toFixed(1)})`);
      assert.ok(Math.abs(n.y) < 1e-6); } }
});

test('옥상 것은 윤곽 안 · 상가 띠와 간판은 벽에서 0.6 m 안 — 걷기 막이(윤곽)와 어긋나지 않게', () => {
  const h = 14, P = buildingDeco(THREE, PTS, h, 31337, { roof: true, shops: true });
  assert.ok(P.parapet.length === PTS.length && P.sign.length > 0 && P.ac.length > 0, '꾸밈이 비었다');
  for (const k of ['parapet', 'tank', 'ac']) for (const g of P[k]) { const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); assert.ok(inPoly([x, z], PTS) || dist(x, z, PTS) < 0.02, `${k} 가 윤곽 밖 (${x.toFixed(2)}, ${z.toFixed(2)})`); assert.ok(p.getY(i) >= h - 1e-6, `${k} 가 지붕 아래`); } }
  assert.ok(P.ledge.length > 0, '처마·층 띠가 없다 (문서 229 §4)');
  assert.ok(P.wallac.length > 0, '창 밑 실외기가 없다 (문서 229 §6)');
  for (const k of ['shop', 'sign', 'ledge', 'wallac']) for (const g of P[k]) { const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); assert.ok(inPoly([x, z], PTS) || dist(x, z, PTS) < 0.6, `${k} 가 벽에서 너무 멀다 (${x.toFixed(2)}, ${z.toFixed(2)})`); } }
});

test('간판 끄기(강남은 POI 네온이 따로) · 낮은 건물엔 간판 없음 · 지붕 안 꾸미는 건물', () => {
  assert.equal(buildingDeco(THREE, PTS, 14, 9, { shops: true, signs: false }).sign.length, 0);
  assert.equal(buildingDeco(THREE, PTS, 4.2, 9, { shops: true }).sign.length, 0, '1층으로 잘린 건물(4.2 m)에 간판이 지붕 위로 솟는다');
  const P = buildingDeco(THREE, PTS, 14, 9, { shops: true }); assert.equal(P.parapet.length + P.tank.length + P.ac.length, 0);
  assert.ok(P.ledge.every(g => { g.computeBoundingBox(); return g.boundingBox.max.y < 4; }), '지붕 안 꾸미는 건물엔 처마 없이 1층 위 띠만');
});

test('꾸밈(noCam)은 카메라 막이에서 빠진다 — 건물 상자가 이미 막는다', () => {
  const scene = new THREE.Scene(), g = new THREE.BoxGeometry(6, 4, 6); g.translate(0, 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial()); m.userData.noCam = true; scene.add(m);
  assert.equal(mergeStatic(scene).camBoxes.length, 0);
  const s2 = new THREE.Scene(); s2.add(new THREE.Mesh(g.clone(), new THREE.MeshStandardMaterial())); assert.equal(mergeStatic(s2).camBoxes.length, 1);
});

test('꾸밈도 제 자리 칸(48 m)으로 합쳐진다 — 막이에서 빠져도 칸은 제 상자로', () => {
  const scene = new THREE.Scene(), mat = new THREE.MeshStandardMaterial(), mk = (x, noCam) => { const g = new THREE.BoxGeometry(2, 3, 2); g.translate(x, 1.5, 0); const m = new THREE.Mesh(g, mat); m.userData.noCam = noCam; scene.add(m); return m; };
  mk(0, false); mk(200, true); mk(5, true); mk(205, true); mergeStatic(scene); scene.updateMatrixWorld(true);
  const b = new THREE.Box3(); let wide = 0; scene.traverse(o => { if (o.isMesh) { b.setFromObject(o); wide = Math.max(wide, b.max.x - b.min.x); } });
  assert.ok(wide < 60, '200 m 떨어진 꾸밈이 한 메시로 묶였다 (폭 ' + wide.toFixed(0) + ' m) — 화면 밖 덩어리가 안 빠진다');
});

test('빌더 연결: 3D 에서만 꾸밈, 강남은 간판 빼고', () => {
  assert.match(SRC, /if \(VIEW3D\) addDeco\(THREE, scene, buildingDeco\(THREE, pts, h, b\.id \| 0, \{ roof: !nearSide && !ruined, shops: !tall \}\)/);
  const osm = fs.readFileSync(new URL('../js/mmo/env-osm.js', import.meta.url), 'utf8');
  assert.match(osm, /if \(L\.isView3d\(\)\) L\.addDeco\(THREE, scene, L\.buildingDeco\(THREE, topPts, h, b\.id \| 0, \{ roof: !near, shops: !setback, signs: false \}\)/);   /* 셋백 탑은 옥상을 줄인 윤곽에, 가게 띠는 땅 윤곽에 따로 (문서 229 §4) */
});

test('창 밑 실외기는 가짜 실내 창 칸 가운데·창 아래 — facade-shader 와 같은 격자 (1.8 m × 3.6 m, s = 위치·(nz, −nx))', () => {
  for (const pts of [PTS, REV]) { const P = buildingDeco(THREE, pts, 20, 4242, { roof: true, shops: true }); assert.ok(P.wallac.length > 3, '실외기 ' + P.wallac.length);
    for (const g of P.wallac) { g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3());
      assert.ok(Math.abs(((c.y - 0.33) / 3.6) - Math.round((c.y - 0.33) / 3.6)) < 1e-3, `층 높이가 창 칸과 어긋남 (y ${c.y.toFixed(2)})`);
      const ok = pts.some((p, i) => { const q = pts[(i + 1) % pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (dist(c.x, c.z, [p, q]) > 0.5) return false;
        let nx = (q[1] - p[1]) / L, nz = -(q[0] - p[0]) / L; if (inPoly([(p[0] + q[0]) / 2 + nx * 0.3, (p[1] + q[1]) / 2 + nz * 0.3], pts)) { nx = -nx; nz = -nz; }   /* 바깥 법선 */
        const sv = (c.x - nx * 0.19) * nz + (c.z - nz * 0.19) * -nx, f = sv / 1.8 - Math.floor(sv / 1.8); return Math.abs(f - 0.5) < 0.02; });
      assert.ok(ok, `칸 가운데가 아님 (${c.x.toFixed(2)}, ${c.z.toFixed(2)})`); } }
});
