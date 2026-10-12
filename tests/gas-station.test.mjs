/* 버려진 주유소 (문서 230 §5) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { buildGasStation, GAS } from '../js/mmo/gas-station.js';

const texts = [];
const fakeTex = (T, w, h, draw) => { const g = new Proxy({ fillText: t => texts.push(t), createRadialGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => o[k] || (() => {}), set: () => true }); draw(g, w, h); return new T.Texture(); };
const rng = s => { let x = s >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };

test('한 채가 터(18×15 m) 안에 들어가고 막이가 있다', () => {
  for (let s = 1; s < 30; s++) { const { group, blockers } = buildGasStation(THREE, rng(s), fakeTex); group.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(group);
    assert.ok(b.min.x > -GAS.W / 2 - .3 && b.max.x < GAS.W / 2 + .3 && b.min.z > -.5 && b.max.z < GAS.D + .3, `씨앗 ${s} 상자 ${b.min.x.toFixed(1)}..${b.max.x.toFixed(1)} · ${b.min.z.toFixed(1)}..${b.max.z.toFixed(1)}`);
    assert.ok(blockers.length >= 9, '기둥 넷 · 주유섬 둘 · 가게 · 가격 기둥 · 통'); for (const q of blockers) assert.ok(q.hw > 0 && q.hd > 0 && Math.abs(q.x) < GAS.W / 2 + .5 && q.z >= 0 && q.z <= GAS.D); }
});
test('상표 없음 — «셀프 주유소» 와 가격판 글자만', () => {
  texts.length = 0; buildGasStation(THREE, rng(3), fakeTex);   /* 재질은 처음 한 번만 만든다 — 앞 시험에서 이미 글자를 썼으면 비어 있을 수 있다 */
  const all = fs.readFileSync('js/mmo/gas-station.js', 'utf8'); for (const brand of ['SK', 'GS', 'S-OIL', 'S-Oil', '현대오일', '오일뱅크', '칼텍스', '에쓰오일']) assert.ok(!all.includes(brand), brand);
});
test('재질이 적다 — 낡음 재질은 꼭짓점 색 하나로', () => {
  const { group } = buildGasStation(THREE, rng(5), fakeTex), mats = new Set(); group.traverse(m => { if (m.isMesh) mats.add(m.material); });
  assert.ok(mats.size <= 11, '재질 ' + mats.size);
});
test('거리 꾸미기에서 지역마다 하나 · 해시 난수 · 막이를 돌려 넣는다', () => {
  const E = fs.readFileSync('js/mmo/env-lib.js', 'utf8');
  assert.match(E, /if \(o\.gas !== false\) \{/); assert.match(E, /buildGasStation\(THREE, rng\(id \* 131 \+ i \* 17 \+ \(d \| 0\)\), canvasTex\)/, '장면 난수 R 이 아니라 자리 해시');
  assert.match(E, /blk\.push\(\{ x: \+\(ox \+ q\.x \* cs \+ q\.z \* sn\)\.toFixed\(2\), z: \+\(oz - q\.x \* sn \+ q\.z \* cs\)\.toFixed\(2\), hw: q\.hw, hd: q\.hd, rot: th \}\)/);
  assert.match(E, /if \(solid\(p\) \|\| !inBand\(p, -2\)\) ok = false;/, '터 전체가 건물 · 물 · 차도 밖, 걷는 띠 안');
  assert.match(fs.readFileSync('js/mmo/env-osm.js', 'utf8'), /L\.street\(\{ THREE, scene, ST, walk, blockers \}/, '강남 같은 OSM 지역도 막이를 넘긴다');
});
test('막이 좌표 돌리기가 메시 돌리기와 같다', () => {
  const { group, blockers } = buildGasStation(THREE, rng(7), fakeTex), th = 1.1, ox = 10, oz = -4, cs = Math.cos(th), sn = Math.sin(th);
  group.position.set(ox, 0, oz); group.rotation.y = th; group.updateMatrixWorld(true);
  for (const q of blockers.slice(0, 4)) { const w = new THREE.Vector3(q.x, 0, q.z).applyMatrix4(group.matrixWorld); assert.ok(Math.abs(w.x - (ox + q.x * cs + q.z * sn)) < 1e-6 && Math.abs(w.z - (oz - q.x * sn + q.z * cs)) < 1e-6); }
});
