/* 필드 몬스터 표 (docs/design/204) — 등급·외형 기준·자리가 실제 지도와 어긋나지 않는지.
   1·2급은 필드 전용, 거점 웨이브는 5급(문서 203) — 둘이 겹치면 안 된다. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { FIELD_MONSTERS, FIELD_GRADES } = require('../server/field-monsters.cjs');
const C = require('../tools/ue/node-combat-rules.cjs');
const ROOT = path.join(__dirname, '..');
const map = zone => JSON.parse(fs.readFileSync(path.join(ROOT, 'maps', '2d', zone, 'map.json'), 'utf8'));
test('필드 몬스터: 다섯 개체 모두 2급 지배형 — 필드 등급, 웨이브(5급)와 안 겹침, 승인 시트가 있다', () => {
  const list = Object.values(FIELD_MONSTERS);
  assert.equal(list.length, 5); for (const m of list) { assert.equal(m.grade, 2); assert.equal(m.kind, 'dominator'); }
  assert.ok(!FIELD_GRADES.includes(C.THREAT_GRADE), '거점 웨이브 등급이 필드 등급과 겹친다');
  for (const [id, m] of Object.entries(FIELD_MONSTERS)) {
    assert.ok(fs.existsSync(path.join(ROOT, m.ref)) && fs.statSync(path.join(ROOT, m.ref)).size > 100000, id + ' 승인 시트가 없다: ' + m.ref);
    assert.ok(fs.existsSync(path.join(ROOT, m.body.model)), id + ' 임시 몸 모델이 없다');
  }
});
test('필드 몬스터: 자리는 실제 사냥터 안(안전 지대 아님·걷는 띠 안)이고, 지도 bosses 에 같은 자리로 올라 있다', () => {
  const SAFE = require('../js/mmo/safe-zones.js');
  for (const [id, m] of Object.entries(FIELD_MONSTERS)) {
    const mp = map(m.zone), a = (mp.areas || []).find(x => x.id === m.area && x.kind === 'hunt');
    assert.ok(a, id + ': ' + m.zone + '/' + m.area + ' 는 사냥터가 아니다');
    assert.ok(m.lv[0] <= a.lv[1] && a.lv[0] <= m.lv[1], id + ' 레벨 ' + m.lv + ' ↔ ' + a.lv);
    const [x, z] = m.at; assert.ok(!SAFE.safeArea(mp.areas.filter(q => q.kind === 'rest' || q.kind === 'siege'), x, z, null), id + ' 가 안전 지대 안');
    const c = Math.cos(mp.road.ang), s = Math.sin(mp.road.ang), u = x * c - z * s, t = -x * s - z * c;
    assert.ok(u >= mp.walk.s0 && u <= mp.walk.s1 && t >= mp.walk.t0 && t <= mp.walk.t1, id + ' 가 걷는 띠 밖 — 플레이어가 못 닿는다');
    const b = (mp.bosses || []).find(q => q.id === id);
    assert.ok(b && b.x === x && b.z === z && b.ai === 'dominator', id + ' 가 지도 bosses 에 없다/다르다');
  }
});
/* 서버 전투 (server/field-dominator.cjs) — 터무니없이 강하게: 예고 뒤 큰 피해, 회피 무적은 지킨다 */
test('2급 지배형 서버 전투: 다가가면 쫓아와 예고 뒤 베고(최대 HP 의 32%), 회피 무적이면 안 맞고, 멀리 끌면 집으로 돌아간다', () => {
  const { Field } = require('../server/field.cjs'), DOM = require('../server/field-dominator.cjs');
  let r = 0; const f = new Field({ rng: () => (r = (r * 9301 + 49297) % 233280) / 233280 });
  f.initBosses(0); const o = f.bosses.get('t2_dominator_f'); assert.ok(o && o.dom, '지배형이 안 섰다');
  f.spawnBoss(o, 1000);
  const p = f.join('u1', { id: 'u1', name: 'u1', stats: { hp: 20000 } }, 'seogwipo'); p.x = o.x + 6; p.z = o.z; p.invulnUntil = 0;
  let t = 1000; const run = ms => { for (const end = t + ms; t < end; t += 50) f.tickBosses(t); };
  run(1500); assert.ok(Math.hypot(p.x - o.x, p.z - o.z) <= DOM.REACH + 0.6 || o.dom.state === 'skill', '쫓아오지 않았다 ' + o.dom.state);
  run(2500); assert.ok(p.hp <= 20000 * (1 - 0.32) + 1 || p.dead, '예고 뒤 베지 않았다 hp=' + p.hp);
  /* 회피 무적: 예고 중에 회피하면 안 맞는다 */
  const q = f.join('u2', { id: 'u2', name: 'u2', stats: { hp: 20000 } }, 'seogwipo'); f.leave('u1'); q.x = o.x + 2; q.z = o.z; q.invulnUntil = 0;
  o.dom.state = 'idle'; o.dom.endsAt = 0; run(100); q.dodgeUntil = t + 5000; run(3000); assert.equal(q.hp, 20000, '회피 무적인데 맞았다');
  /* 목줄: 집에서 26 m 넘게 끌면 포기하고 돌아간다 */
  q.dodgeUntil = 0; q.x = o.homeX + 40; q.z = o.homeZ; run(15000);
  assert.ok(Math.hypot(o.x - o.homeX, o.z - o.homeZ) < 1, '집으로 안 돌아갔다');
  assert.ok(DOM.view(o) && !('hp' in DOM.view(o)), '화면용 상태에 체력이 실렸다');
});
/* 몸은 영웅과 같은 보정막을 거친다 — 날 GLB 를 쓰면 카인·아인 idle·run 에서 오른팔이 왼쪽으로 넘어가 «팔이 없어» 보였다 (디렉터 지적, 문서 33 §4) */
test('2급 지배형 화면: 임시 몸은 자세 교정(TW_POSE)·재질 교정(TW_MATFIX)을 거친 영웅 GLB 로 만든다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'mmo.html'), 'utf8'), at = src.indexOf("b.ai==='dominator'"), seg = src.slice(at, at + 900);
  assert.ok(at > 0, '지배형 생성부가 없다');
  assert.match(seg, /heroGltf\(/, '지배형이 자세 교정을 거치지 않은 GLB 를 쓴다');
  assert.match(seg, /TW_MATFIX\.repair/, '지배형이 재질 교정을 거치지 않는다');
  assert.match(src, /function heroGltf[^\n]*TW_POSE\.repair/, 'heroGltf 가 자세 교정을 안 한다');
  for (const m of Object.values(FIELD_MONSTERS)) assert.match(m.body.model, /^art\/3d\/\w+_anim\.glb$/, '임시 몸이 영웅 GLB 가 아니면 보정막을 못 탄다: ' + m.body.model);
});
