import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import vm from 'node:vm';
const require=createRequire(import.meta.url);
const CF=require('../js/contact-feel.js');
const Q=require('../js/combat-quality.js');
const ctx={window:{}};
for(const f of ['world','dungeons','dungeon','dungeon-content'])
  vm.runInNewContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx,{filename:f});
const {RULES,ARENAS,SKILLS}=ctx.window.TW_DUNGEONS, CHAR=ctx.window.TW_WORLD.CHARS.ain;
const {createBattle}=require('../js/combat.js');
const cp=x=>JSON.parse(JSON.stringify(x));

/* 튕김(弾かれ). 몬헌: 단단한 부위를 약한 공격으로 치면 무기가 튕기고,
   피해가 깎이고, 사냥꾼이 경직에 묶인다. 「아무데나 치면 안 된다」를
   가르치는 장치다. 조사·수치: docs/design/65-contact-feel.md §5 */

/* 사슬에 묶인 2페이즈 — shl/shr 가 «금속» 이고 부술 수 있다 */
function arena(){ return cp(ARENAS.tutorial.stages[1]); }
function battle(){
  const r=cp(RULES); r.bleed.chance=0;
  return createBattle({rules:r, dummy:arena(),
    char:{...CHAR,stats:{...CHAR.stats,crit:0,aspd:100}},
    hooks:{canHit:()=>true}, skills:SKILLS.ain, ult:SKILLS.ainUlt, seed:11});
}
/* 한 대 때리고 결과를 모은다 */
function swing(b, kind, part){
  b.input(kind, part);
  let hit=null, deflect=null;
  for(let i=0;i<400 && !hit;i++){
    b.tick(.01);
    for(const e of b.drain()){ if(e.t==='hit'&&!hit) hit=e; if(e.t==='deflect') deflect=e; }
  }
  return {hit, deflect, snap:b.snapshot()};
}
const partOf=(s,id)=>s.enemy.parts.find(p=>p.id===id);

test('금속 장갑을 약공격으로 치면 튕긴다 — 피해가 깎이고 장갑은 안 깎인다', () => {
  const b=battle(), hp0=partOf(b.snapshot(),'shl').hp;
  const {hit,deflect,snap}=swing(b,'attack','shl');
  assert.ok(hit, '맞기는 했다');
  assert.equal(hit.deflect, true, '튕김으로 판정된다');
  assert.ok(deflect, 'deflect 이벤트가 나간다 — 연출이 이걸 듣는다');
  assert.equal(partOf(snap,'shl').hp, hp0, '장갑은 한 톨도 안 깎인다');
  assert.equal(snap.player.combo, 0, '연계가 끊긴다');
  assert.ok(snap.player.locked, '되튄 만큼 내가 묶인다');
  assert.equal(hit.feel.material, 'metal');
  assert.ok(hit.feel.ring > 1, `쇳소리가 세진다 (${hit.feel.ring})`);
});

test('무거운 것은 «절대» 안 튕긴다 — 그게 답이기 때문이다', () => {
  for(const kind of ['smash','skill']){
    const b=battle(), hp0=partOf(b.snapshot(),'shl').hp;
    const {hit,snap}=swing(b, kind, kind==='skill'?0:'shl');
    assert.ok(hit, kind+' 가 맞는다');
    assert.ok(!hit.deflect, kind+' 는 안 튕긴다');
    if(hit.part==='shl') assert.ok(partOf(snap,'shl').hp < hp0, kind+' 는 장갑을 깎는다');
  }
  /* 모델 차원에서도: 가벼운 것만 튕긴다 */
  for(const clip of Object.keys(CF.PUSH))
    assert.equal(CF.deflects('metal', clip, false), !!CF.LIGHT[clip],
      `${clip} 튕김 여부가 «가벼움» 과 일치해야 한다`);
});

test('약공격이 손해이긴 해도 헛치는 건 아니다 — 피해는 30% 만 깎인다', () => {
  const b=battle();
  const soft=swing(b,'attack','body').hit;      /* 짚(몸통) */
  const b2=battle();
  const hard=swing(b2,'attack','shl').hit;      /* 금속 장갑 */
  assert.ok(soft.dmg>0 && hard.dmg>0);
  assert.ok(!soft.deflect, '무른 곳은 안 튕긴다');
  assert.ok(Math.abs(CF.DEFLECT.dmg-0.70)<1e-9, '몬헌의 «피해 30% 감소» 를 그대로 가져왔다');
});

test('부서진 장갑은 더 이상 안 튕긴다 — 살이 드러났으니까', () => {
  assert.equal(CF.deflects('metal','attack1',false), true);
  assert.equal(CF.deflects('metal','attack1',true), false, '부서졌으면 통과');
  assert.equal(CF.deflects('straw','attack1',false), false);
  assert.equal(CF.deflects('core','attack1',false), false, '핵은 질기지만 금속은 아니다');
});

test('쇠로 «보이는» 것은 쇠로 판정한다 — 기계 보스의 장갑·접점·집게', () => {
  const want={ contactl:'metal', contactr:'metal',   /* 계전기 접점 */
               jawr:'metal', arml:'metal',           /* 파쇄 기갑 */
               pumpl:'metal', armr:'metal',          /* 소생기 */
               exhaust:'metal', chain:'metal', shl:'metal', shr:'metal' };
  for(const [id,m] of Object.entries(want))
    assert.equal(Q.material(id,'x'), m, `${id} 는 ${m} 이어야 한다`);
  /* 식물·짐승은 그대로 무르다 — 여기까지 금속으로 만들면 튕김이 벌이 된다 */
  for(const id of ['vinel','viner','head','back','legf','tail','intake','body'])
    assert.equal(Q.material(id,'x'), 'straw', `${id} 는 무른 곳이다`);
  assert.equal(Q.material('core','x'), 'core');
});

test('튕김이 던전을 못 깨게 만들지 않는다 — 기준 봇이 사슬 페이즈를 이긴다', () => {
  const r=cp(RULES); r.bleed.chance=0;
  const b=createBattle({char:CHAR, rules:r, dummy:arena(), skills:SKILLS.ain,
    ult:SKILLS.ainUlt, seed:9, hooks:{canHit:()=>true,canCounter:()=>true,inZone:()=>true}});
  let deflects=0;
  for(let i=0;i<60000&&!b.over;i++){
    const s=b.snapshot(), p=s.player, e=s.enemy,
      target=e.parts.find(x=>x.breakable&&!x.broken)?.id||'core';
    if(!p.action&&!p.hitstop&&!p.locked&&!p.dodging){
      if(e.state==='telegraph'&&e.tele<=.035) b.input(e.counterable?'attack':'dodge',target);
      else if(p.riposte) b.input('attack',target);
      else if(['recover','downed','stagger'].includes(e.state)) b.input('attack',target);
    }
    b.tick(.01);
    for(const ev of b.drain()) if(ev.t==='deflect') deflects++;
  }
  assert.ok(b.over && !b.dead, '기준 봇이 이긴다');
  assert.ok(deflects>0, '그러면서 실제로 튕기기는 한다 — 죽은 기능이 아니다');
  assert.equal(b.metrics.deflects, deflects, '지표에도 남는다');
});
