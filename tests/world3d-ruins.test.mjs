/* 3D 필드의 무너진 저층 (문서 216) — 속 빈 벽체·부서진 윗선·2층 바닥판 조각. 굽기(2D)·자리·막이는 그대로여야 한다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { ruinShell, RUINS } from '../js/mmo/env-lib.js';

const SRC = fs.readFileSync(new URL('../js/mmo/env-lib.js', import.meta.url), 'utf8');
/* ㄱ자 윤곽 (14 × 10 m 에서 한 모서리가 빠짐) */
const PTS = [[0, 0], [14, 0], [14, 6], [8, 6], [8, 10], [0, 10]];
const inPoly = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const segDist = (x, z, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
const near = (x, z, pts, e) => pts.some((p, i) => segDist(x, z, p, pts[(i + 1) % pts.length]) <= e);
const build = (h = 8, id = 4242) => { const scene = new THREE.Scene(), wallM = new THREE.MeshStandardMaterial(), floorM = new THREE.MeshStandardMaterial(), rubbleM = new THREE.MeshStandardMaterial();
  const out = ruinShell(THREE, scene, PTS, h, id, wallM, floorM, rubbleM); return { scene, out, walls: out.find(m => m.material === wallM), floor: out.find(m => m.material === floorM) }; };

test('같은 건물은 늘 같은 모양 — 흔들림은 건물 id 해시만 (장면 난수 R 을 안 쓴다)', () => {
  const a = build(), b = build(), c = build(8, 99);
  assert.deepEqual(Array.from(a.walls.geometry.attributes.position.array), Array.from(b.walls.geometry.attributes.position.array));
  assert.notDeepEqual(Array.from(a.walls.geometry.attributes.position.array), Array.from(c.walls.geometry.attributes.position.array), 'id 가 달라도 모양이 같다');
  const body = SRC.slice(SRC.indexOf('export function ruinShell'), SRC.indexOf('/* ---------- 나무'));
  assert.ok(!/\bR\(\)|Math\.random/.test(body), '무너진 건물 모양이 장면 난수를 쓴다 — 뒤 자리(나무·잔해·막이)가 2D 굽기와 어긋난다');
});

test('벽과 바닥판은 윤곽(= 걷기 막이) 안에만 — 사람이 벽을 뚫고 지나가 보이지 않게', () => {
  const { walls, floor } = build();
  for (const [name, g] of [['벽', walls.geometry], ['바닥판', floor.geometry]]) { const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); assert.ok(inPoly(x, z, PTS) || near(x, z, PTS, 0.02), `${name} 꼭짓점이 윤곽 밖 (${x.toFixed(2)}, ${z.toFixed(2)})`); } }
});

test('윗선은 부서져 오르내리고 높이 한도(굽기의 폐허 높이)를 넘지 않는다', () => {
  const h = 8, { walls } = build(h), P = walls.geometry.attributes.position, tops = new Set(); let max = 0;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i); max = Math.max(max, y); if (y > 0.01) tops.add(y.toFixed(2)); }
  assert.ok(max <= h + 1e-6, '벽이 폐허 높이보다 높다: ' + max);
  assert.ok(tops.size >= 8, '윗선이 반듯하다 — 높이 종류 ' + tops.size);
  assert.ok(RUINS.length > 0 && RUINS.at(-1).length === 4, '검수용 자리 [x, z, 높이, 반지름]');
});

test('높은 폐허엔 2층 바닥판 조각이 안쪽으로 붙는다', () => {
  const { floor } = build(9), P = floor.geometry.attributes.position; let up = 0;
  for (let i = 0; i < P.count; i++) if (P.getY(i) > 2.5) up++;
  assert.ok(up > 0, '2층 바닥판이 하나도 없다');
});

test('빌더 연결: 3D 에서만 폐허 껍데기, 막이·높이 뽑기는 그대로', () => {
  const b = SRC.slice(SRC.indexOf('export function buildings'), SRC.indexOf('export const inBuilding'));
  const iR = b.indexOf('if (ruined) h = Math.min(h, o.ruinH[0] + R()'), iV = b.indexOf('if (VIEW3D && ruined)');
  assert.ok(iR > 0 && iV > iR, '폐허 높이 뽑기(R)가 3D 갈래보다 먼저여야 장면 난수 순서가 같다');
  const branch = b.slice(iV, b.indexOf('continue;', iV));
  assert.match(branch, /ctx\.blockers\.push\(\{ poly: pts\.map/, '3D 폐허도 같은 막이(윤곽)를 넣는다');
  assert.match(branch, /ctx\.clear\.push/, '3D 폐허도 같은 비움 구역을 넣는다');
});
