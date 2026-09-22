import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import vm from 'node:vm';
const require=createRequire(import.meta.url);
const CF=require('../js/contact-feel.js');
require('../js/combat-quality.js');
const ctx={window:{}};
for(const f of ['world','dungeons']) vm.runInNewContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx,{filename:f});
const {RULES,ARENAS,SKILLS}=ctx.window.TW_DUNGEONS, CHAR=ctx.window.TW_WORLD.CHARS.ain;
const {createBattle}=require('../js/combat.js');
const cp=x=>JSON.parse(JSON.stringify(x));

/* 「보스 몸에 무기가 닿았을 때의 저항감」.
   히트스톱(완전 정지)만으로는 «맞았다» 는 신호일 뿐, «살을 가르며 지나간다» 가
   아니다. 정지 뒤에 «느려짐» 을 이어 붙여야 저항이 된다.
   조사 근거와 수치: docs/design/65-contact-feel.md */

test('단단할수록 오래·느리게 끌리고 얕게 박힌다', () => {
  const soft=CF.onContact('straw','attack1',0.09);
  const hard=CF.onContact('metal','attack1',0.09);
  assert.ok(hard.dragT > soft.dragT, `금속 ${hard.dragT} > 짚 ${soft.dragT}`);
  assert.ok(hard.dragRate < soft.dragRate, '단단하면 더 느려진다');
  assert.ok(hard.depth < soft.depth, `금속 ${hard.depth}m < 짚 ${soft.depth}m — 덜 박힌다`);
  assert.ok(hard.ring > soft.ring, '금속은 울린다');
});

test('무거운 기술일수록 더 밀고 들어간다 — 다만 한계가 있다', () => {
  const light=CF.onContact('straw','attack1',0), heavy=CF.onContact('straw','ult',0);
  assert.ok(heavy.depth > light.depth && heavy.dragT > light.dragT);
  /* 0.20초를 넘기면 저항이 아니라 랙으로 느껴진다 */
  for(const clip of Object.keys(CF.PUSH))
    for(const m of Object.keys(CF.MAT))
      assert.ok(CF.onContact(m,clip,0).dragT <= 0.20+1e-9, `${m}/${clip} 끌림이 0.20초를 넘는다`);
  /* 사실상 정지가 되면 히트스톱과 구별이 안 된다 */
  for(const clip of Object.keys(CF.PUSH))
    for(const m of Object.keys(CF.MAT))
      assert.ok(CF.onContact(m,clip,0).dragRate >= 0.15, `${m}/${clip} 배율이 너무 낮다`);
});

test('느려짐은 끝에서 원래 속도로 돌아온다 — 딱 끊으면 더 어색하다', () => {
  const total=0.12, rate=0.3;
  const begin=CF.dragScale(total,total,rate), end=CF.dragScale(0.001,total,rate);
  assert.ok(Math.abs(begin-rate)<1e-6, '시작은 설정한 배율');
  assert.ok(end>0.95, `끝 ${end.toFixed(3)} — 1 에 가까워야 한다`);
  let prev=0;
  for(let i=10;i>=0;i--){ const v=CF.dragScale(total*i/10,total,rate);
    assert.ok(v>=prev-1e-9,'단조 증가'); prev=v; }
});

test('저항은 «행동 시계» 만 늦춘다 — 세상까지 늦추면 슬로모션이다', () => {
  const r=cp(RULES); r.bleed.chance=0;
  const b=createBattle({rules:r,dummy:cp(ARENAS.tutorial.stages[0]),
    char:{...CHAR,stats:{...CHAR.stats,crit:0,aspd:100}},hooks:{},
    skills:SKILLS.ain,ult:SKILLS.ainUlt,seed:7});
  b.input('attack');
  const hit=b.snapshot().player.action.hitAt;
  /* 히트스톱이 끝난 직후와, 충분히 지난 뒤의 «행동 시계 진행률» 을 비교한다 */
  while(b.snapshot().player.hitstop>0 || b.snapshot().player.action.elapsed<hit) b.tick(.01);
  const a0=b.snapshot().player.action.elapsed; const t0=b.snapshot().time;
  b.tick(.04); const justAfter=b.snapshot().player.action.elapsed-a0;
  for(let i=0;i<20;i++) b.tick(.01);
  const a1=b.snapshot().player.action.elapsed;
  b.tick(.04); const later=b.snapshot().player.action.elapsed-a1;
  assert.ok(justAfter < later*0.75,
    `접점 직후 ${justAfter.toFixed(4)} 초가 나중 ${later.toFixed(4)} 초보다 확실히 느려야 한다`);
  /* 세상 시계(B.time)는 준 만큼 그대로 흐른다 */
  assert.ok(Math.abs((b.snapshot().time-t0)-0.28)<1e-6, '세상 시계는 정상 속도');
});
