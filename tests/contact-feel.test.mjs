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

test('저항은 «연출» 이다 — 행동 시계도 세상 시계도 늦추지 않는다', () => {
  /* ⚠ 이 테스트는 내가 실제로 낸 사고를 막는다.
     처음엔 접점 뒤 a.elapsed 를 늦춰서 저항을 만들었다. 한 대마다 행동이
     0.07~0.19초 길어졌고, DPS 가 빠져 «수문기 2페이즈» 를 기준 봇이 못 깼다
     (보스 HP 13,504 남기고 사망). 규칙은 「연출이 판정을 옮기지 않는다」다.
     저항은 눈에 보이는 클립 시각만 뒤처지게 한다(js/game3d.js tickDrag). */
  const r=cp(RULES); r.bleed.chance=0;
  let feel=null;
  const b=createBattle({rules:r,dummy:cp(ARENAS.tutorial.stages[0]),
    char:{...CHAR,stats:{...CHAR.stats,crit:0,aspd:100}},
    hooks:{},
    skills:SKILLS.ain,ult:SKILLS.ainUlt,seed:7});
  b.input('attack');
  const hit=b.snapshot().player.action.hitAt;
  while(b.snapshot().player.hitstop>0 || b.snapshot().player.action.elapsed<hit){
    b.tick(.01);
    for(const e of b.drain()) if(e.t==='hit'&&!feel) feel=e.feel;
  }
  const t0=b.snapshot().time;
  const a0=b.snapshot().player.action.elapsed;
  b.tick(.04); const justAfter=b.snapshot().player.action.elapsed-a0;
  for(let i=0;i<20;i++) b.tick(.01);
  const a1=b.snapshot().player.action.elapsed;
  b.tick(.04); const later=b.snapshot().player.action.elapsed-a1;
  assert.ok(Math.abs(justAfter-0.04)<1e-9,
    `접점 직후에도 행동 시계는 준 만큼 간다 (${justAfter.toFixed(5)})`);
  assert.ok(Math.abs(later-0.04)<1e-9, '나중도 마찬가지');
  assert.ok(Math.abs((b.snapshot().time-t0)-0.28)<1e-6, '세상 시계도 정상 속도');
  /* 그래도 연출이 쓸 «저항» 은 타격 이벤트에 실려 나간다 */
  assert.ok(feel && feel.dragT>0 && feel.dragRate<1, '타격 이벤트가 저항을 실어 보낸다');
});

test('끌림은 클립 «시각» 만 뒤처지게 했다가 반드시 따라잡는다', () => {
  /* game3d.js tickDrag 의 산수를 그대로 돌린다.
     뒤처진 양(lag)이 0 으로 돌아와야 총 재생 시간이 보존된다 — 곧 균형 불변. */
  const dt=1/60, cf=CF.onContact('metal','smash',0);
  let lag=0, left=cf.dragT, total=cf.dragT, peak=0;
  for(let i=0;i<180;i++){
    if(left>0){ lag+=dt*(1-CF.dragScale(left,total,cf.dragRate)); left=Math.max(0,left-dt); }
    else if(lag>0) lag=Math.max(0,lag-dt*2.2);
    peak=Math.max(peak,lag);
  }
  assert.ok(peak>0.02, `눈에 보일 만큼은 뒤처져야 한다 (${peak.toFixed(4)}초)`);
  assert.ok(peak<0.12, `너무 뒤처지면 랙이다 (${peak.toFixed(4)}초)`);
  assert.equal(lag,0,'끝에는 반드시 따라잡는다 — 총 재생 시간 보존');
});
