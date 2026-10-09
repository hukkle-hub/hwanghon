/* 혼자 연습 몬스터 반격 (문서 210 §8) — GPT 공용 모듈(server/field-mob-combat.cjs)을 서버와 같은 순서로. 모듈은 서버 합치기 전엔 없다 → 그땐 건너뛴다 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createCollide } from '../js/mmo/field-collide.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), req = createRequire(import.meta.url), HAS = fs.existsSync(path.join(root, 'server/field-mob-combat.cjs'));
const { createMobPractice } = await import('../js/mmo/field-mob-practice.js');

test('반격: 가까이 서면 예고(attack) 뒤 600 ms 에 맞고, 회피 무적이면 안 맞고, 쳐서 0 이면 생태에 한 번 쓰러진다', { skip: !HAS && '서버 몬스터 모듈이 아직 없다(GPT 브랜치)' }, () => {
  const MOB = req('../server/field-mob-combat.cjs'), { Ecology } = req('../server/field-ecology.cjs'), { planRoute } = req('../server/field-ecology-route.cjs');
  return import('../js/mmo/monster-catalog.js').then(({ CATALOG }) => import('../js/mmo/field-mobs.js').then(({ ecologyCatalog }) => {
    const map = JSON.parse(fs.readFileSync(path.join(root, 'maps/2d/daejeon/map.json'))); let now = 1e6;
    const E = new Ecology({ zone: { ...map, id: 'daejeon' }, catalog: ecologyCatalog(CATALOG), now, rng: () => 0.42, collide: createCollide(map).collide });
    const strikes = [], P = { id: 'me', x: 0, z: 0, hp: 20000, maxHp: 20000, dead: false, dodgeUntil: 0 };
    const MP = createMobPractice({ MOB, ECO: E, planRoute, strike: (m, p, h, t) => { if (t < p.dodgeUntil) return; strikes.push({ by: m.id, h, t }); p.hp -= Math.round(p.maxHp * h.damage); } });
    const g = E.groups.find(g => g.kind === 'nest'), first = E.mobs.get(g.mobIds[0]); P.x = first.x + 1.2; P.z = first.z;
    let attackAt = null; for (let i = 0; i < 80 && !strikes.length; i++) { now += 50; E.tick(now); MP.tick(now, [P]); if (attackAt === null && [...E.mobs.values()].some(m => m.anim === 'attack')) attackAt = now; }
    assert.ok(strikes.length, '가까이 서도 안 때린다'); assert.ok(attackAt !== null && strikes[0].t - attackAt >= 550, '예고 없이 때린다: ' + (strikes[0].t - attackAt));
    assert.ok(E.mobs.has(strikes[0].by), '때린 쪽 id 가 몬스터가 아니다'); assert.ok(P.hp < 20000);
    const snap = MP.snapshot(P.x, P.z, now).find(e => e.id === strikes[0].by); assert.ok(snap.hp === 100 && Number.isInteger(snap.seq) && snap.seq > 0, '그리기 칸에 체력·순번이 없다');
    /* 회피 무적 동안은 0 */
    const n0 = strikes.length; P.dodgeUntil = now + 5000; for (let i = 0; i < 60; i++) { now += 50; E.tick(now); MP.tick(now, [P]); } assert.equal(strikes.length, n0, '회피 무적인데 맞았다');
    /* 쳐서 쓰러뜨리기 */
    const id = strikes[0].by, s = MP.states.get(id); let r; for (let i = 0; i < 40 && !(r && r.down); i++) r = MP.hit(id, 3000, now += 400);
    assert.ok(r && r.down && r.hp === 0 && !E.mobs.get(id).alive, '쳐서 안 쓰러진다'); assert.equal(MP.hit(id, 3000, now), null, '쓰러진 개체를 또 친다');
  }));
});

test('화면 연결: 모듈이 없으면 맞기만(연습 체력), 있으면 반격 — 2D·3D 같은 도우미', () => {
  const m = fs.readFileSync(path.join(root, 'mmo.html'), 'utf8'), w = fs.readFileSync(path.join(root, 'world3d.html'), 'utf8'), l = fs.readFileSync(path.join(root, 'js/mmo/cjs-browser.js'), 'utf8');
  assert.match(m, /loadCjs\('server\/field-mob-combat\.cjs'\)\.catch\(\(\)=>null\)/, '2D 가 모듈이 없을 때 멈춘다');
  assert.match(w, /loadCjs\('server\/field-mob-combat\.cjs'\)\.catch\(\(\) => null\)/, '3D 가 모듈이 없을 때 멈춘다');
  assert.match(m, /strike:\(m,p,h,t\)=>offField\.bossStrike\(m,p,h,t\)/, '2D 반격이 bossStrike(회피·완벽 회피)를 안 거친다');
  assert.match(w, /strike: \(m, p, h, t\) => fieldLocal\.bossStrike\(m, p, h, t\)/, '3D 반격이 bossStrike 를 안 거친다');
  assert.match(l, /if \(res\.ok === false\) throw/, '없는 모듈(404)을 코드로 돌린다');   /* 파티 서버가 3D 필수 모듈을 내주는지는 GPT tests/field-mob-socket 이 본다 */
  assert.match(m, /if\(MC&&typeof MC\.tick==='function'\)/); assert.match(w, /if \(MOB_MOD && typeof MOB_MOD\.tick === 'function'\)/);
});
