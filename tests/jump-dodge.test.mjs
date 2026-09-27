/* 점프 회피 (문서 112 §4 · 114 §1): jumpOnly 바닥 광역은 구르기 무적으로 못 피하고 공중(jumpT)으로만 넘는다.
   그 밖의 공격은 공중에서 그대로 맞는다. 쿨·기력·버퍼는 구르기와 같은 결. 솔로(combat.js)와 레이드(raid.cjs)가 같은 규칙. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const fs=require('node:fs'), vm=require('node:vm');
const ctx={window:{}};
for(const f of ['world','dungeons']) vm.runInNewContext(fs.readFileSync(new URL(`../js/${f}.js`,import.meta.url),'utf8'),ctx,{filename:f});
const {RULES,ARENAS,SKILLS}=ctx.window.TW_DUNGEONS, CHAR=ctx.window.TW_WORLD.CHARS.ain;
const {createBattle}=require('../js/combat.js');
const copy=x=>JSON.parse(JSON.stringify(x));
function battle(patterns, hooks={}){
  const r=copy(RULES); r.bleed.chance=0;
  const d=Object.assign(copy(ARENAS.tutorial.stages[2]),{patterns});
  return createBattle({rules:r,dummy:d,char:{...CHAR,stats:{...CHAR.stats,crit:0,aspd:100}},hooks,skills:SKILLS.ain,ult:SKILLS.ainUlt,seed:7});
}
const wave={name:'지면 충격파',icon:'slam',tele:1.0,dmg:5000,posture:30,recovery:.8,counterable:false,unblockable:true,jumpOnly:true};
const slash={name:'베기',icon:'bolt',tele:1.0,dmg:3000,posture:30,recovery:.8};
function tele(b,left){ for(let i=0;i<2000;i++){ const s=b.snapshot(); if(s.enemy.state==='telegraph'&&s.enemy.tele<=left+1e-8) return; b.tick(.01);} throw new Error('no telegraph'); }
function land(b){ for(let i=0;i<200;i++){ const s=b.snapshot(); if(s.enemy.state!=='telegraph') return; b.tick(.01);} }

test('규칙 값: R.jump 0.45 s 공중 · 쿨 0.8 · 기력 15 · 완벽 0.14 · 높이 1.1', ()=>{
  const J=RULES.jump; assert.equal(J.dur,0.45); assert.equal(J.cooldown,0.8); assert.equal(J.st,15); assert.equal(J.perfect,0.14); assert.equal(J.height,1.1);   /* vm 컨텍스트 객체라 deepEqual 대신 값으로 */
  assert.equal(RULES.dodge.iframes,0.30,'구르기 무적은 그대로');
});

test('jumpOnly: 구르기로는 맞고, 점프로는 넘는다(완벽 점프 = 반격 창 + 기력 환급)', ()=>{
  const b1=battle([wave]); tele(b1,.05); const hp1=b1.snapshot().player.hp; b1.input('dodge'); assert.ok(b1.snapshot().player.dodging); land(b1);
  assert.ok(b1.snapshot().player.hp<hp1,'구르기 무적이 jumpOnly 에는 안 통한다');
  const b2=battle([wave]); tele(b2,.05); const hp2=b2.snapshot().player.hp, st0=b2.snapshot().player.st; b2.input('jump');
  const s=b2.snapshot(); assert.ok(s.player.jumping&&s.player.jumpT>0.4&&s.player.jumpCd>0.7); assert.equal(s.player.st,st0-15);
  land(b2); const s2=b2.snapshot(); assert.equal(s2.player.hp,hp2,'점프로 넘었다'); assert.ok(s2.player.riposte&&s2.player.riposteKind==='evade','완벽 점프 → 반격 창');
});

test('보통 공격은 공중에서 그대로 맞고, 구르기로 피한다', ()=>{
  const b1=battle([slash]); tele(b1,.05); const hp1=b1.snapshot().player.hp; b1.input('jump'); land(b1); assert.ok(b1.snapshot().player.hp<hp1,'공중은 무적이 아니다');
  const b2=battle([slash]); tele(b2,.05); const hp2=b2.snapshot().player.hp; b2.input('dodge'); land(b2); assert.equal(b2.snapshot().player.hp,hp2);
});

test('공중에선 공격·가드·구르기가 안 나가고, 쿨 동안 두 번 못 뛴다; 스냅샷·이벤트 필드', ()=>{
  const ev=[]; const b=battle([wave],{}); b.on&&b.on('jump',e=>ev.push(e));
  b.input('jump'); const s=b.snapshot(); assert.ok(s.player.jumping);
  b.input('attack'); assert.equal(b.snapshot().player.action,null,'공중 공격 없음');
  b.input('guard',true); assert.equal(b.snapshot().player.guard,false);
  b.input('dodge'); assert.equal(b.snapshot().player.dodging,false);
  for(let i=0;i<50;i++) b.tick(.01); assert.ok(!b.snapshot().player.jumping); assert.ok(b.snapshot().player.jumpCd>0);
  const st=b.snapshot().player.st; b.input('jump'); assert.equal(b.snapshot().player.st,st,'쿨 중엔 안 뛴다');
  tele(b,.3); assert.equal(b.snapshot().enemy.jumpOnly,true);
});

test('d01 3 단계 «지면 충격파»: jumpOnly·big·튕기기 불가·바닥 원 280, 1 단계엔 없다', ()=>{
  const st=ARENAS.tutorial.stages; const w=st[2].patterns.find(p=>p.name==='지면 충격파');
  assert.ok(w&&w.jumpOnly&&w.big&&w.counterable===false&&w.unblockable===true);
  assert.ok(!st[0].patterns.some(p=>p.jumpOnly));
  const dj=fs.readFileSync(new URL('../js/dungeon.js',import.meta.url),'utf8'); assert.match(dj,/'지면 충격파':\s*\{ kind:'circle', r:280/);
});

test('레이드 서버: 같은 규칙 — jumpOnly 는 점프로만, 공중 입력 차단, 이벤트 jumpOnly', ()=>{
  const {Raid}=require('../server/raid.cjs'); const members=[{id:'a',name:'A'}];
  const r=new Raid('d01',members); r.startFight(); r.phase=2; r.stage=r.A.stages[2]; r.boss.parts=r.stage.parts.map(p=>({...p}));
  const p=r.players.get('a'); p.x=r.boss.x-100; p.y=r.boss.y; const b=r.boss;
  const wv=r.stage.patterns.find(q=>q.name==='지면 충격파'); b.def=wv; b.beats=r.beatsOf(wv); r.startBeat(0); b.zone={kind:'circle',x:b.x,y:b.y,r:280};
  assert.equal(r.events.at(-1).jumpOnly,true);
  b.tele=.05; const hp=p.hp; r.input('a',{type:'dodge'}); for(let i=0;i<12;i++) r.tick(.01); assert.ok(p.hp<hp,'구르기는 안 통한다');
  const r2=new Raid('d01',members); r2.startFight(); r2.phase=2; r2.stage=r2.A.stages[2]; r2.boss.parts=r2.stage.parts.map(q=>({...q}));
  const q=r2.players.get('a'); q.x=r2.boss.x-100; q.y=r2.boss.y; r2.boss.def=wv; r2.boss.beats=r2.beatsOf(wv); r2.startBeat(0); r2.boss.zone={kind:'circle',x:r2.boss.x,y:r2.boss.y,r:280};
  r2.boss.tele=.05; const hp2=q.hp; r2.input('a',{type:'jump'}); assert.ok(q.jumpT>0); r2.input('a',{type:'attack'}); assert.equal(q.action,null,'공중 공격 없음');
  for(let i=0;i<12;i++) r2.tick(.01); assert.equal(q.hp,hp2,'점프로 넘었다'); assert.ok(q.riposteT>0);
});

test('game3d 배선: I 키 → jump, 점프 이벤트, jumpOnly 바닥 파랑(0x4A8BE0), 안내줄, 절차 도약이 리그 뒤에 얹힌다', async ()=>{
  const g=await readFile(new URL('../js/game3d.js',import.meta.url),'utf8');
  assert.ok(g.includes("e.code==='KeyI') jumpIn()")); assert.ok(g.includes("case 'jump': SFX.play('dodge')")); assert.ok(g.includes('s.enemy.jumpOnly?0x4A8BE0'));
  assert.ok(g.includes('뛰어넘어라')); assert.ok(g.indexOf('tickJump(dt);')>g.indexOf('if(ain.rig) ain.rig.apply('),'발 IK 뒤');
  assert.match(g,/ain\.root\.position\.y\+=\(J\.height\|\|1\.1\)\*4\*u\*\(1-u\)/);
});
