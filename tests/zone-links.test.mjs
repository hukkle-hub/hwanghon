/* 전국 길 잇기 (문서 219) — «전체 맵 매끄럽게 전부 연결». 구운 맵(map.json)의 문만 따라가도 벙커에서 모든 지역에 닿아야 한다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LINKS } from '../js/mmo/zone-links.js';
import { ZONES } from '../js/mmo/zones.js';

const MAPS = new URL('../maps/2d/', import.meta.url), ids = fs.readdirSync(MAPS).filter(z => fs.existsSync(new URL(z + '/map.json', MAPS)));
const meta = z => JSON.parse(fs.readFileSync(new URL(z + '/map.json', MAPS), 'utf8'));

test('벙커에서 문만 따라가도 모든 지역(필드·던전)에 닿는다', () => {
  const seen = new Set(['bunker']), q = ['bunker'];
  while (q.length) { const z = q.shift(); for (const g of meta(z).gates || []) if (!seen.has(g.to.zone)) { seen.add(g.to.zone); q.push(g.to.zone); } }
  const lost = ids.filter(z => !seen.has(z)); assert.deepEqual(lost, [], '갈 수 없는 지역: ' + lost.join(', '));
});

test('잇는 길은 띠 끝 큰길 위 — 걸어서 길 끝에 닿으면 다음 지역', () => {
  for (const [a, atA, b, atB] of LINKS) for (const [z, at] of [[a, atA], [b, atB]]) {
    assert.ok(at.end === 's0' || at.end === 's1', z + ' 문이 띠 끝이 아니다'); const W = ZONES[z].field.walk;
    assert.ok(at.t >= W.t0 && at.t <= W.t1, z + ' 문 t=' + at.t + ' 가 띠 밖'); }
});

test('문끼리 20 m 넘게 떨어진다 (원이 겹쳐 엉뚱한 곳으로 가지 않게 — 자동 이동은 들어서면 바로 떠난다)', () => {
  const linked = new Set(LINKS.flatMap(([a, , b]) => [a + '>' + b, b + '>' + a]));   /* 새로 낸 길 문만 (남산 남쪽 길 ↔ 여의도 지하 던전처럼 예전부터 붙어 있던 짝은 그대로) */
  for (const z of ids) { const g = meta(z).gates || []; for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (linked.has(z + '>' + g[i].id) || linked.has(z + '>' + g[j].id)) assert.ok(Math.hypot(g[i].x - g[j].x, g[i].z - g[j].z) > 20, `${z}: ${g[i].id} ↔ ${g[j].id}`); }
});
