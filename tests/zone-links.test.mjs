/* 전국 길 잇기 (문서 219) — «전체 맵 매끄럽게 전부 연결». 서버 지도(map.json)의 문 + 3D 길 문(zone-links)을 따라 벙커에서 모든 지역에 닿아야 한다.
   길 문은 map.json 에 넣지 않는다 — 넣어 다시 계획하면 서버 생태·구운 높이·사냥터 시험 32 개가 깨졌다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LINKS, linkGates } from '../js/mmo/zone-links.js';
import { ZONES } from '../js/mmo/zones.js';
import { createCollide } from '../js/mmo/field-collide.js';

const MAPS = new URL('../maps/2d/', import.meta.url), ids = fs.readdirSync(MAPS).filter(z => fs.existsSync(new URL(z + '/map.json', MAPS)));
const meta = z => JSON.parse(fs.readFileSync(new URL(z + '/map.json', MAPS), 'utf8'));
/* world3d 와 같은 자리 계산 */
const place = (m, g) => { const a = m.road.ang, s = g.at.end === 's1' ? m.walk.s1 - 3 : m.walk.s0 + 3, t = g.at.t; return { x: s * Math.cos(a) - t * Math.sin(a), z: -s * Math.sin(a) - t * Math.cos(a) }; };

test('벙커에서 문(서버 지도 + 3D 길)만 따라가도 모든 지역에 닿는다', () => {
  const seen = new Set(['bunker']), q = ['bunker'];
  while (q.length) { const z = q.shift(); for (const g of [...(meta(z).gates || []), ...linkGates(z)]) if (!seen.has(g.to.zone)) { seen.add(g.to.zone); q.push(g.to.zone); } }
  const lost = ids.filter(z => !seen.has(z)); assert.deepEqual(lost, [], '갈 수 없는 지역: ' + lost.join(', '));
});

test('길 문은 짝이 맞고, 지역 표·map.json 은 건드리지 않는다', () => {
  for (const z of ids) for (const g of linkGates(z)) { assert.ok(ids.includes(g.to.zone), z + ' → ' + g.to.zone); assert.ok(linkGates(g.to.zone).some(b => b.id === z && b.to.gate === g.to.zone), g.to.zone + ' 에 돌아오는 문');
    assert.ok(!(meta(z).gates || []).some(x => x.id === g.id), z + '/' + g.id + ' 가 map.json 에도 있다 — 둘 중 하나만'); }
  assert.ok(!(ZONES.daejeon.field.gates || []).length, '지역 표에 길 문이 들어갔다 — 장면(나무·차 자리)이 바뀌어 서버 지도와 어긋난다');
});

test('길 문 자리: 띠 끝 큰길 위 · 막이에 안 밀림(1.5 m 안) · 보스 구역 밖', () => {
  for (const [a, atA, b, atB] of LINKS) for (const [z, at, to] of [[a, atA, b], [b, atB, a]]) { const m = meta(z), p = place(m, { at }), q = { ...p }, { collide } = createCollide(m);
    assert.ok(at.t >= m.walk.t0 && at.t <= m.walk.t1, z + ' 문 t 가 띠 밖');
    for (let i = 0; i < 6; i++) collide(q, 2.4); assert.ok(Math.hypot(q.x - p.x, q.z - p.z) < 6, `${z} → ${to} 문이 막이에 ${Math.hypot(q.x - p.x, q.z - p.z).toFixed(1)} m 밀린다`);
    for (const bo of m.bosses || []) assert.ok(Math.hypot(bo.x - q.x, bo.z - q.z) > bo.r + 8, `${z} → ${to} 문이 보스 ${bo.id} 구역 안`); }
});
