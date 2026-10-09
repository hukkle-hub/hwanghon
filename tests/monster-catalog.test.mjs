/* 감염체 캐논 한 표 · 사냥터 배정 (문서 207·208) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
const { CATALOG, byId } = await import('../js/mmo/monster-catalog.js');
const { huntMobs, poolFor, DRAFT } = await import('../js/mmo/hunt-pools.js');
const { huntAreas } = await import('../js/mmo/hunt-areas.js');
const { ZONES } = await import('../js/mmo/zones.js');

test('캐논: GPT v09 63종 그대로 + 디렉터 2급 지배형 다섯 (문서 207 §2 (가))', () => {
  const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design/ref/monster-catalog-v09/MonsterRoster_v09.json'), 'utf8')).Monsters;
  const gpt = CATALOG.filter(m => m.src === 'gpt-v09');
  assert.equal(gpt.length, 63); assert.equal(new Set(CATALOG.map(m => m.id)).size, CATALOG.length, 'id 가 겹친다');
  for (const s of src) { const m = byId(s.MonsterId); assert.ok(m, s.MonsterId + ' 가 표에 없다');
    assert.equal(m.grade, s.Grade, s.MonsterId + ' 등급이 원본과 다르다'); assert.equal(m.name, s.Name); assert.deepEqual(m.regions, s.RegionAffinity); assert.deepEqual(m.contexts, s.SpawnContext); }
  const count = g => CATALOG.filter(m => m.grade === g).length;
  assert.deepEqual([5, 4, 3, 2, 1, '특급'].map(count), [20, 15, 10, 15, 5, 3]);
});

test('웹 필드 2급 지배형 다섯이 캐논을 가리킨다 — 서버 표(field-monsters.cjs)와 한 쌍씩', () => {
  const { FIELD_MONSTERS } = require('../server/field-monsters.cjs');
  const dom = CATALOG.filter(m => m.src === 'director-sheet');
  assert.equal(dom.length, 5);
  for (const m of dom) { assert.equal(m.grade, 2); const f = FIELD_MONSTERS[m.field]; assert.ok(f, m.id + ' → ' + m.field + ' 가 서버 표에 없다');
    assert.equal(f.grade, 2); assert.ok(f.title.startsWith(m.name), m.id + ' 이름이 서버 칭호와 다르다: ' + f.title); assert.ok(fs.existsSync(path.join(ROOT, m.ref)), m.ref + ' 시트가 없다'); }
  for (const id of Object.keys(FIELD_MONSTERS)) assert.ok(dom.some(m => m.field === id), id + ' 가 캐논에 없다');
});

test('사냥터 배정 규칙: 흔한 종 5급(지역이 맞는 것) · 드문 종 20↑ 4급 · 45↑ 3급 · 2급 이상은 무작위 풀에 없다 · 늘 같은 답', () => {
  let n = 0;
  for (const [zid, z] of Object.entries(ZONES)) for (const h of z.hunts || []) { const r = huntMobs(zid, h); if (!r.pool) continue; n++;
    const lv = h.lv || [1, 1], { common, rare, regions } = r.pool;
    assert.ok(common.length === (lv[1] <= 15 ? 2 : 3), zid + ' ' + h.name + ' 흔한 종 수'); if (lv[1] <= 15) assert.equal(common[0], 'G5_WALKER', '초반 사냥터에 보행자가 없다');
    for (const id of common) { const m = byId(id); assert.equal(m.grade, 5); assert.ok(m.contexts.includes('OpenWorld')); assert.ok(id === 'G5_WALKER' || m.regions.some(t => regions.includes(t)), zid + ' ' + id + ' 지역이 안 맞는다'); }
    assert.deepEqual(rare.map(id => byId(id).grade), [...(lv[0] >= 20 ? [4] : []), ...(lv[0] >= 45 ? [3] : [])], zid + ' ' + h.name + ' 드문 종 규칙');
    for (const id of rare) assert.ok(byId(id).contexts.includes('OpenWorldRare'));
    assert.deepEqual(poolFor(zid, h), r.pool, '같은 입력에 다른 답');
    assert.ok(!DRAFT.test(r.mobs), '이름표에 (가안) 이 남았다'); }
  assert.ok(n >= 40, '배정된 사냥터가 너무 적다: ' + n);
});

test('구운 맵(map.json)의 사냥터가 지역 표 + 배정과 같다 — node tools/2d/patch-areas.mjs <지역> 로 맞춘다', () => {
  for (const [zid, z] of Object.entries(ZONES)) { const f = path.join(ROOT, 'maps/2d', zid, 'map.json'); if (!z.hunts || !fs.existsSync(f)) continue;
    const m = JSON.parse(fs.readFileSync(f, 'utf8')), want = huntAreas(z.hunts, m.road.ang, zid);
    for (const w of want) { const a = (m.areas || []).find(x => x.id === w.id && x.kind === w.kind); assert.ok(a, zid + ' ' + w.id + ' 없음');
      assert.equal(a.mobs, w.mobs, zid + ' ' + w.name + ' 이름표가 낡았다 — patch-areas 를 돌려라'); assert.deepEqual(a.pool || null, w.pool || null, zid + ' ' + w.name + ' 배정이 낡았다'); if (w.kind === 'hunt') assert.ok(a.eco, zid + ' ' + w.name + ' 생태 자리가 없다 — patch-areas'); } }
});

test('생태 자리: 사냥터마다 둥지 3 · 순찰 4점 — 사냥터 안 · 게임 충돌에 안 밀리는 곳 · 쉼터·문·보스 둘레 밖', async () => {
  const { createCollide } = await import('../js/mmo/field-collide.js'), SAFE = require('../js/mmo/safe-zones.js');
  let n = 0;
  for (const z of fs.readdirSync(path.join(ROOT, 'maps/2d'))) { const f = path.join(ROOT, 'maps/2d', z, 'map.json'); if (!fs.existsSync(f)) continue;
    const m = JSON.parse(fs.readFileSync(f, 'utf8')), C = createCollide(m), out = (m.areas || []).filter(a => ['rest', 'safe', 'combat'].includes(a.kind));
    for (const a of (m.areas || []).filter(a => a.kind === 'hunt' && (a.poly || a.circle))) { n++; assert.ok(a.eco, z + ' ' + a.name + ' 에 생태 자리가 없다 — patch-areas');
      assert.equal(a.eco.nests.length, 3, z + ' ' + a.name + ' 둥지'); assert.equal(a.eco.patrol.length, 4, z + ' ' + a.name + ' 순찰');
      for (const [x, y] of [...a.eco.nests, ...a.eco.patrol]) { assert.ok(SAFE.inArea(a, x, y), z + ' ' + a.name + ' 자리가 사냥터 밖');
        const p = { x, z: y }; C.collide(p, 0.6); assert.ok(Math.hypot(p.x - x, p.z - y) < 0.05, z + ' ' + a.name + ' 자리가 막이·띠 밖 (' + x + ',' + y + ')');
        assert.ok(!out.some(o => SAFE.inArea(o, x, y)), z + ' ' + a.name + ' 자리가 쉼터·문·보스 둘레 안'); } } }
  assert.ok(n >= 50, '사냥터가 너무 적다: ' + n);
});
