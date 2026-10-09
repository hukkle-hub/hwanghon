/* 혼자 연습 필드 몬스터 (문서 209) — 2D·3D 가 GPT 생태 모듈을 그대로 돌리고 같은 그리기(js/mmo/field-mobs.js)를 쓴다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createCollide } from '../js/mmo/field-collide.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), { Ecology } = createRequire(import.meta.url)('../server/field-ecology.cjs');
const { CATALOG } = await import('../js/mmo/monster-catalog.js'), { ecologyCatalog, PRACTICE_HP } = await import('../js/mmo/field-mobs.js');

test('웹 캐논 표 → 생태 모듈 꼴(ecologyCatalog)이 GPT v10 원본과 같은 등급·맥락·지역이고, 실제 지도에서 생태가 선다', () => {
  const v10 = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/ref/monster-catalog-v10/MonsterRoster_v10.json'))).Monsters, eco = ecologyCatalog(CATALOG);
  for (const m of v10) { const e = eco.find(x => x.MonsterId === m.MonsterId); assert.ok(e, m.MonsterId); assert.equal(e.Grade, m.Grade); assert.deepEqual(e.SpawnContext, m.SpawnContext); assert.deepEqual(e.RegionAffinity, m.RegionAffinity); }
  const map = JSON.parse(fs.readFileSync(path.join(root, 'maps/2d/daejeon/map.json'))), E = new Ecology({ zone: { ...map, id: 'daejeon' }, catalog: eco, now: 0, rng: Math.random, collide: createCollide(map).collide });
  assert.ok(E.mobs.size >= 16, '대전 생태가 너무 적다: ' + E.mobs.size);
  for (const g of [5, 4, 3]) assert.ok(PRACTICE_HP[g] > 0);
  assert.ok(PRACTICE_HP[4] > PRACTICE_HP[5] && PRACTICE_HP[3] > PRACTICE_HP[4]);
});

test('2D·3D 연결: 혼자 연습에서만 생태를 돌리고(서버 몬스터가 오면 서버가), 지도 충돌은 서버와 같은 map.json · 임시 몸 표시', () => {
  const m = fs.readFileSync(path.join(root, 'mmo.html'), 'utf8'), w = fs.readFileSync(path.join(root, 'world3d.html'), 'utf8'), v = fs.readFileSync(path.join(root, 'js/mmo/field-mobs.js'), 'utf8');
  assert.match(m, /loadCjs\('server\/field-ecology\.cjs'\)/, '2D 가 생태 모듈을 안 읽는다');
  assert.match(m, /if\(OFF\.ECO\)\{ OFF\.ECO\.tick\(now\); OFF\.MOBS\.update\(OFF\.ECO\.snapshot\(P\.x,P\.z,now\)\); \}/, '2D 혼자 연습 생태 틱');
  assert.match(m, /function hitBoss\(sk\)\{ const o=nearBoss\(\); if\(!o\) return hitMob\(sk\);/, '2D 에서 몬스터를 못 친다');
  assert.match(w, /if \(ECO && !net\) \{ ECO\.tick\(gameNow\); MOBS\.update\(ECO\.snapshot\(root\.position\.x, root\.position\.z, gameNow\), dt\); \}/, '3D 혼자 연습 생태 틱');
  assert.match(w, /collide: createCollide\(meta\)\.collide \}\);/, '3D 생태가 장면 충돌(env.blockers)을 쓴다 — 서버와 같은 map.json 이어야 둥지가 막히지 않는다');
  assert.match(w, /if \(!t\) \{ hitMob\(\); return; \}/, '3D 에서 몬스터를 못 친다');
  assert.match(v, /임시 몸/, '승인 안 된 몸에 «임시 몸» 표시가 없다');
  assert.match(v, /const g = v\.id\.slice\(0, v\.id\.lastIndexOf\(':'\)\)/, '무리마다 이름표 하나 — 겹쳐 못 읽는다');
});
