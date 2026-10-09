/* 생태 자리(맵, Claude) ↔ 생태 런타임(server/field-ecology.cjs, GPT v10) 맞물림 — 문서 208.
   지도에 깐 둥지·순찰이 런타임 규칙 그대로 «합법» 이고, 순찰 네 변이 전부 길로 이어져야 한다.
   GPT v10 검증 때 전주·판교·수원 여섯 변이 막혀 순찰이 멈췄고, 남행 물류창고 둥지 하나를 런타임이 0.5 m 옮겼다 → patch-areas 가 같은 규칙으로 고른다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createCollide } from '../js/mmo/field-collide.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), { Ecology } = createRequire(import.meta.url)('../server/field-ecology.cjs');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/ref/monster-catalog-v10/MonsterRoster_v10.json'))).Monsters;
const seed = n => () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };

test('실제 지도 전부: 둥지·순찰이 런타임 규칙에서 옮길 필요 없이 합법 · 순찰 네 변이 모두 길로 이어진다', () => {
  let segments = 0; const unrouted = [], moved = [];
  for (const z of fs.readdirSync(path.join(root, 'maps/2d')).sort()) { const f = path.join(root, 'maps/2d', z, 'map.json'); if (!fs.existsSync(f)) continue;
    const map = JSON.parse(fs.readFileSync(f, 'utf8')); if (!(map.areas || []).some(a => a.kind === 'hunt' && a.pool)) continue;
    const e = new Ecology({ zone: { ...map, id: z }, catalog, now: 0, rng: seed(7), collide: createCollide(map).collide });
    moved.push(...e.anchorAdjustments.map(a => z + ':' + a.area + ':' + a.kind + a.index));
    for (const a of e.areas) { const P = a.eco.patrol; for (let i = 0; i < 4; i++) { segments++; if (!e.route(a, P[i], P[(i + 1) % 4])) unrouted.push(z + ':' + a.id + ':' + i + '→' + (i + 1) % 4); } } }
  assert.equal(segments, 180); assert.deepEqual(unrouted, [], '순찰 변이 막혔다 — node tools/2d/patch-areas.mjs <지역>'); assert.deepEqual(moved, [], '런타임이 생태 자리를 옮겼다(막이·쉼터에 너무 가깝다)');
});
