import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import vm from 'node:vm';
const require=createRequire(import.meta.url);
require('../js/contact-feel.js'); require('../js/combat-quality.js');
const ctx={window:{}};
for(const f of ['world','dungeons']) vm.runInNewContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx,{filename:f});
const {RULES,ARENAS,SKILLS}=ctx.window.TW_DUNGEONS, CHAR=ctx.window.TW_WORLD.CHARS.ain;
const {createBattle}=require('../js/combat.js');
const cp=x=>JSON.parse(JSON.stringify(x));

/* 「무겁게 보이되 답답하지 않게」 — 명조(鳴潮)와 몬헌을 갈라 쓴다.
   · 회피·방어는 날이 멈춘 직후 열린다 (명조: 큰 기술을 써도 «갇혔다» 가 없다)
   · 공격 연계는 늦게 열린다 (몬헌: 연타로 밀어붙이지 못한다)
   docs/design/71-cancel-and-floor.md */

function battle(){
  const r=cp(RULES); r.bleed.chance=0;
  return createBattle({rules:r, dummy:cp(ARENAS.tutorial.stages[0]),
    char:{...CHAR,stats:{...CHAR.stats,crit:0,aspd:100}},
    hooks:{canHit:()=>true}, skills:SKILLS.ain, ult:SKILLS.ainUlt, seed:5});
}

test('회피는 날이 멈춘 직후 열리고, 연계는 그보다 늦게 열린다', () => {
  const b=battle();
  b.input('smash');
  const a=b.snapshot().player.action;
  assert.ok(a, '스매시가 나갔다');
  assert.ok(a.defCancelAt < a.cancelAt,
    `회피 ${a.defCancelAt.toFixed(2)}s 가 연계 ${a.cancelAt.toFixed(2)}s 보다 일러야 한다`);
  assert.ok(a.defCancelAt >= a.activeEnd,
    '날이 아직 살아 있는 동안에는 못 빠진다 — 그러면 판정이 공짜가 된다');
  assert.ok(a.defCancelAt - a.activeEnd < 0.12,
    `날이 멈춘 뒤 ${(a.defCancelAt-a.activeEnd).toFixed(3)}s 면 «직후» 가 아니다`);
});

test('실제로 이르게 회피된다 — 연계는 아직 막혀 있는 시점에', () => {
  const b=battle();
  b.input('smash');
  const a0=b.snapshot().player.action;
  /* 회피는 되고 연계는 안 되는 «사이» 시각까지 굴린다 */
  const mid=(a0.defCancelAt+a0.cancelAt)/2;
  while(b.snapshot().player.action && b.snapshot().player.action.elapsed<mid) b.tick(.01);
  const before=b.snapshot().player;
  assert.ok(before.action && before.action.elapsed<before.action.cancelAt, '아직 연계 창 전이다');
  b.input('dodge');
  for(let i=0;i<3;i++) b.tick(.01);
  assert.ok(b.snapshot().player.dodging, '이 시점에 회피가 나가야 한다');
});

test('회피가 빨라져도 «피해» 는 안 오른다 — 균형은 생존 쪽으로만 움직인다', () => {
  /* 공격 연계 창(cancelAt)은 안 건드렸다. 데이터로 못박는다. */
  const M=RULES.motion;
  assert.equal(M.light.cancel, 0.48);
  assert.equal(M.counter.cancel, 0.40);
  assert.equal(M.motion===undefined && M.exec.cancel, 1.45);
  assert.equal(M.characterProfiles.ain.smash.cancel, 0.91);
  assert.equal(M.characterProfiles.ain.ult.cancel, 1.66);
  assert.ok(M.defCancel>0 && M.defCancel<=0.10, '회피 여유는 짧아야 «직후» 로 읽힌다');
});
