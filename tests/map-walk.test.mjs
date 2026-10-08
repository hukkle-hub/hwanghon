/* 걷는 자리 점검 (문서 206 §7) — 3D 필드 전 지역 점검에서 고흥 출발점이 «바다 안» 이라 첫 걸음에 275 m 밀리는 것을 찾았다.
   해안선을 멀리 닫은 다각형이 곶을 감아 돌며 땅을 덮었다. 모든 지역에서: 출발점·문 자리는 충돌에 밀리지 않고, 물 막힘이 걷는 띠의 절반을 넘게 덮지 않는다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), MAPS = path.join(ROOT, 'maps', '2d');
const { createCollide } = await import('../js/mmo/field-collide.js');
const L = await import('../js/mmo/env-lib.js');
for (const zone of fs.readdirSync(MAPS).filter(z => fs.existsSync(path.join(MAPS, z, 'map.json')))) {
  test('걷는 자리: ' + zone + ' — 출발점·문이 막힘에 밀리지 않고, 물 막힘이 띠를 덮지 않는다', () => {
    const m = JSON.parse(fs.readFileSync(path.join(MAPS, zone, 'map.json'), 'utf8')); if (!m.walk || !m.road) return;
    const C = createCollide(m), ca = Math.cos(m.road.ang), sa = Math.sin(m.road.ang), FROM = (s, t) => [s * ca - t * sa, -s * sa - t * ca];
    for (const [name, at] of [['출발점', m.spawn], ...(m.gates || []).map(g => ['문 ' + g.id, g])]) {
      const p = { x: at.x, z: at.z }; C.collide(p); const d = Math.hypot(p.x - at.x, p.z - at.z);
      assert.ok(d < 1.5, zone + ' ' + name + ' 이 첫 걸음에 ' + d.toFixed(1) + ' m 밀린다'); }
    for (const b of m.blockers.filter(b => b.water && b.poly)) { const c = L.bandCover(FROM, m.walk, b.poly);
      assert.ok(c <= 0.5, zone + ' 물 막힘이 걷는 띠의 ' + Math.round(c * 100) + '% 를 덮는다 (해안선을 잘못 닫았다)'); }
  });
}
test('해안선 막힘 규칙: 띠를 덮는 닫힘은 바다 쪽 150 m 띠로 — 진행 방향 오른쪽(OSM: 왼쪽이 땅)', () => {
  const pts = [[-50, 0], [0, 0], [50, 0]], s = L.coastStrip(pts, 150);
  assert.ok(L.inPolyXZ(0, 100, s) && !L.inPolyXZ(0, -100, s), '오른쪽(+z)이 바다여야 한다: x→+ 방향의 오른쪽 = (−dz, dx) = +z');
  assert.ok(!L.inPolyXZ(0, 200, s), '150 m 밖은 막지 않는다');
});
