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
  assert.match(m, /if\(OFF\.ECO\)\{ OFF\.ECO\.tick\(now\); if\(OFF\.MP\)\{ OFF\.MP\.tick\(now,\[P\]\); OFF\.MOBS\.update\(OFF\.MP\.snapshot\(P\.x,P\.z,now\)\); \} else OFF\.MOBS\.update\(OFF\.ECO\.snapshot\(P\.x,P\.z,now\)\); \}/, '2D 혼자 연습 생태 틱');
  assert.match(m, /function hitBoss\(sk\)\{ const o=nearBoss\(\); if\(!o\) return hitMob\(sk\);/, '2D 에서 몬스터를 못 친다');
  assert.match(w, /if \(ECO && !net\) \{ ECO\.tick\(gameNow\); if \(MP\) \{ MP\.tick\(gameNow, \[P\]\);/, '3D 혼자 연습 생태 틱');
  assert.match(w, /collide: createCollide\(meta\)\.collide \}\);/, '3D 생태가 장면 충돌(env.blockers)을 쓴다 — 서버와 같은 map.json 이어야 둥지가 막히지 않는다');
  assert.match(w, /if \(!t\) \{ hitMob\(\); return; \}/, '3D 에서 몬스터를 못 친다');
  assert.match(v, /임시 몸/, '승인 안 된 몸에 «임시 몸» 표시가 없다');
  assert.match(v, /const g = v\.id\.slice\(0, v\.id\.lastIndexOf\(':'\)\)/, '무리마다 이름표 하나 — 겹쳐 못 읽는다');
});

test('온라인 mobs 패킷(GPT 서버 인계 v2) → 그리기 칸: [id,catalogId,x,z,alive,anim,generation,hp%,(seq)] · v1 7칸 꼴도 · 못 읽는 줄은 버린다', async () => {
  const { mobsFromPacket } = await import('../js/mmo/field-mobs.js');
  const [a, b, c] = mobsFromPacket([['daejeon:h1:n0:0', 'G5_WALKER', 1, 2, 64, 'attack', 3], ['daejeon:h1:n0:1', 'G5_WALKER', 3, 4, 0, 'die', 2], ['daejeon:h1:p:0', 'G4_SILENCER', 5, 6, true, 'walk', 1, 40]]);
  assert.deepEqual(a, { id: 'daejeon:h1:n0:0', catalogId: 'G5_WALKER', x: 1, z: 2, hp: 64, anim: 'attack', generation: 3, seq: null, alive: true });
  assert.equal(b.alive, false, 'hp 0 · die 는 죽은 것'); assert.equal(c.alive, true); assert.equal(c.hp, 40); assert.equal(c.anim, 'walk');
  assert.equal(mobsFromPacket([['x', 'G5_WALKER', 1, 2, 100, 'die', 1]])[0].alive, false, 'anim die 면 hp 가 남아도 죽은 것');
  assert.equal(mobsFromPacket([['x', 'G5_WALKER', 1, 2, 0, 'idle', 1]])[0].alive, false, 'hp 0 이면 anim 이 idle 이어도 죽은 것');
  assert.deepEqual(mobsFromPacket([null, [1, 2, 3], ['y', 'G5', 'a', 0, 50, 'idle', 1]]), [], '못 읽는 줄');
  assert.deepEqual(mobsFromPacket(undefined), []);
  assert.equal(mobsFromPacket([['s', 'G5_WALKER', 0, 0, true, 'attack', 1, 90, 7]])[0].seq, 7, 'v2 9번째 칸 = 동작 순번(연속 공격)'); assert.equal(c.seq, null, 'v2 8번째 칸은 hp — 순번이 아니다');
  assert.equal(mobsFromPacket([['s', 'G5_WALKER', 0, 0, true, 'idle', 1, 90]])[0].hp, 90, 'v2 hp% 는 8번째');
  assert.equal(mobsFromPacket([['s', 'G5_WALKER', 0, 0, false, 'idle', 1, 90]])[0].alive, false, 'v2 alive=false 면 hp 가 남아도 죽은 것');
  assert.equal(mobsFromPacket([['z', 'G5_WALKER', 0, 0, 250, 'idle', 1]])[0].hp, 100, 'hp 는 0~100');
});

test('온라인 연결: 2D·3D 가 서버 mobs 를 그리고, 칠 때 mob 과 generation 을 같이 보내고, mobHit 을 세대까지 맞춰 받는다', () => {
  const m = fs.readFileSync(path.join(root, 'mmo.html'), 'utf8'), w = fs.readFileSync(path.join(root, 'world3d.html'), 'utf8'), v = fs.readFileSync(path.join(root, 'js/mmo/field-mobs.js'), 'utf8');
  assert.match(m, /if\(m\.bosses\|\|m\.loot\|\|m\.self\|\|m\.hurt\|\|m\.mobs\) toBoss\(m\)/, '2D 가 mobs 만 있는 field 패킷을 버린다');
  assert.match(m, /m\.type==='mobHit'\|\|m\.type==='fieldLooted'\)\{ toBoss\(m\)/, '2D 가 mobHit 을 안 넘긴다');
  assert.match(m, /type:'fieldSkill',skill:sk\.i,mob:v\.id,generation:v\.gen\}:\{type:'fieldHit',mob:v\.id,generation:v\.gen\}/, '2D 타격에 mob·generation');
  assert.match(m, /if\(net&&OFF\.MOBS\) OFF\.MOBS\.update\(netMobs,dt\)/, '2D 온라인 몬스터를 매 프레임 그리지 않는다');
  assert.match(w, /net\.send\(\{ type: 'fieldHit', mob: v\.id, generation: v\.gen \}\)/, '3D 타격에 mob·generation');
  assert.match(w, /else if \(net && \(MOBS \|\| netMobs\.length\)\) mobView\(\)\.update\(netMobs, dt\);/, '3D 온라인 몬스터를 매 프레임 그리지 않는다');
  assert.ok(w.indexOf('let netMobs = []') < w.indexOf('net = await connectField'), '3D: 입장 답(fieldJoined)이 netMobs 선언보다 먼저 온다 — 실제 서버에서 ReferenceError');
  for (const [src, re] of [[m, /v\.gen!==m\.generation/], [w, /v\.gen !== m\.generation/]]) assert.match(src, re, '다시 난 개체에 옛 mobHit 을 그린다');
  assert.match(v, /if \(!v\) \{ if \(!s\.alive\) continue;/, '시체를 새로 만들면 지운 뒤 다시 살아나 또 죽는다');
  assert.match(v, /n === 'attack'/, '공격 예고 고리가 없다 — 보이지 않는 공격에 맞는다');
});

test('몬스터 임시 몸(art/3d/lod/mob_temp.glb): 그리기가 쓰는 클립 다섯이 다 있고 6천 삼각형 아래 — 20마리(서버 관심 반경 최대)가 휴대폰에 얹힌다', () => {
  const b = fs.readFileSync(path.join(root, 'art/3d/lod/mob_temp.glb')), n = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + n).toString());
  const clips = j.animations.map(a => a.name), src = fs.readFileSync(path.join(root, 'js/mmo/field-mobs.js'), 'utf8'), CLIP = eval('(' + /const CLIP = (\{[^}]+\})/.exec(src)[1] + ')');
  for (const c of Object.values(CLIP)) assert.ok(clips.includes(c), '클립이 없다: ' + c);
  let tris = 0; for (const m of j.meshes) for (const p of m.primitives) tris += j.accessors[p.indices].count / 3;
  assert.ok(tris <= 6000, '몬스터 몸이 무겁다: ' + tris);
  for (const f of ['mmo.html', 'world3d.html']) assert.match(fs.readFileSync(path.join(root, f), 'utf8'), /mob_temp\.glb/, f + ' 가 몬스터 몸 대신 류 원본을 쓴다');
});
