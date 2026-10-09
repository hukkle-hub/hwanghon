/* 3D 필드 스킬 1~4 (문서 212) — 2D·서버와 같은 표(js/dungeons.js SKILLS) · 누르면 바로 · 온라인은 fieldSkill 로 서버가 판정 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const w = fs.readFileSync(new URL('../world3d.html', import.meta.url), 'utf8'), f = fs.readFileSync(new URL('../server/field.cjs', import.meta.url), 'utf8');

test('스킬 표는 서버와 같은 것(TW_DUNGEONS.SKILLS) · 단추 넷 · 숫자키 1~4', () => {
  assert.match(w, /const SKDEF = \(window\.TW_DUNGEONS && TW_DUNGEONS\.SKILLS/);
  for (const n of [1, 2, 3, 4]) assert.match(w, new RegExp('id="sk' + n + '"'));
  assert.match(w, /\['Digit1', 'Digit2', 'Digit3', 'Digit4'\]/);
});
test('온라인: 보스엔 fieldSkill {skill, boss}, 몬스터엔 {skill, mob, generation}, 대상이 없어도 fieldSkill (재사용 대기는 서버가 센다)', () => {
  assert.match(w, /type: 'fieldSkill', skill: sk\.i, boss: t\.b\.id/);
  assert.match(w, /type: 'fieldSkill', skill: sk\.i, mob: v\.id, generation: v\.gen/);
  assert.match(w, /if \(!strike\(\{ i, mult: d\.mult, hits: d\.ev && d\.ev\.hits \}\) && net\) net\.send\(\{ type: 'fieldSkill', skill: i \}\)/);
  assert.match(w, /m\.type === 'skillUsed'/);
});
test('혼자 연습: 서버 skill() 과 같은 규칙 — 회피 무적 · 다음 공격 치명 · 받는 피해 감소(bossStrike 에서)', () => {
  assert.match(f, /if\(def\.dodge\)\{ p\.dodgeUntil=now\+DODGE_TIME; if\(def\.critNext\) p\.critNext=true; \}/, '서버 규칙이 바뀌었다 — 3D 혼자 연습도 같이 바꿔라');
  assert.match(w, /if \(!net\) P\.dodgeUntil = gameNow \+ DODGE_TIME;/);
  assert.match(w, /if \(d\.critNext\) critNext = true;/);
  assert.match(w, /const crit = critNext \|\| Math\.random\(\) < 0\.18/);
  assert.match(w, /p\.maxHp \* hit\.damage \* \(now < \(p\.buffUntil \|\| 0\) \? 1 - \(p\.buffReduce \|\| 0\) : 1\)/);
});
