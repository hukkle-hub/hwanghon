/* 문서 112 — 렐라나식 보스 모션·큰 기술·관통·걷기 링크·큰 스킬 계약.
   판정 시계·피해·회피 무적은 건드리지 않는다: 여기서 보는 것은 «표본 위치 곡선» 과 «이벤트 필드» 뿐이다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tellCurve, settleCurve, sampleBossAttack, BOSS_PROFILES } from '../js/boss-motion.js';
const require=createRequire(import.meta.url);

test('예비 홀드 프레임: 양끝은 그대로, 마지막 0.3 s 는 정점(0.84~0.88)에서 거의 멈추고, 마지막 0.1 s 에 접점까지 꽂는다', ()=>{
  assert.equal(tellCurve(0,1),0); assert.equal(tellCurve(1,1),1);
  let prev=-1; for(let p=0;p<=1.0001;p+=0.01){ const v=tellCurve(p,1); assert.ok(v>=prev-1e-9,'단조'); prev=v; }
  /* T=1: 홀드 [0.60,0.90] — 이 구간에서 0.04 만 움직인다 */
  const hold=tellCurve(0.9,1)-tellCurve(0.6,1); assert.ok(hold>0.03&&hold<0.05,'hold drift '+hold);
  assert.ok(tellCurve(0.6,1)>=0.83&&tellCurve(0.6,1)<=0.85,'apex '+tellCurve(0.6,1));
  /* 마지막 10 % 에 나머지 12 % 를 다 쓴다 = 타격이 «순간» */
  assert.ok(1-tellCurve(0.9,1)>0.1);
  /* 긴 예고(1.45 s)에서도 홀드는 0.3 s 근처, 짧은 예고(0.6 s)에선 비율 상한(42 %) */
  assert.ok(Math.abs((tellCurve(1-0.1/1.45,1.45)-tellCurve(1-0.4/1.45,1.45)))<0.05);
});

test('sampleBossAttack: hold 비트는 combat 의 windup 곡선 그대로(선형), 나머지는 홀드 프레임 곡선; recover 는 앞 40 % 에 클립을 다 쓴다', ()=>{
  const spec={hitFrac:0.5}, dur=2;
  assert.equal(sampleBossAttack(spec,dur,{state:'telegraph',windup:0.6,hold:true}),0.6);
  assert.ok(Math.abs(sampleBossAttack(spec,dur,{state:'telegraph',windup:0.6,teleDur:1})-tellCurve(0.6,1))<1e-9);
  const early=sampleBossAttack(spec,dur,{state:'recover',recovery:0.6,recoveryDur:1});   /* 40 % 지난 시점 */
  assert.ok(early>1+0.7,'회복 40 % 에 클립 70 % 이상 소진: '+early);
  assert.equal(sampleBossAttack(spec,dur,{state:'recover',recovery:0,recoveryDur:1}),dur);
});

test('회복 포즈 곡선: 빨리 가라앉고(0.18 에 최대) 천천히 일어선다(1 에서 0). 모든 보스 프로필에 settle 이 있다', ()=>{
  assert.equal(settleCurve(0),0); assert.ok(settleCurve(0.18)>0.99); assert.ok(settleCurve(0.5)>0.9); assert.ok(settleCurve(0.8)<0.6); assert.ok(settleCurve(1)<1e-9);
  for(const [id,p] of Object.entries(BOSS_PROFILES)){ assert.ok(Array.isArray(p.settle)&&p.settle.length>=2,id+' settle'); }
});

test('combat.js: 걷기 링크(walk) 는 링크 시간 동안 snapshot.enemy.walking 이 참이고, swing/telegraph 이벤트가 big·lunge·recovery·icon 을 실어 보낸다', ()=>{
  const src=require('fs').readFileSync(new URL('../js/combat.js',import.meta.url),'utf8');
  assert.match(src,/walking:E\.state==='link'&&!!E\.walk/);
  assert.match(src,/E\.walk=!!pat\.walk/);
  assert.equal((src.match(/big:!!\(E\.pat\.big\|\|E\.pat\.rank==='S'\),lunge:E\.pat\.lunge\|\|null/g)||[]).length,2,'telegraph·swing 둘 다');
  assert.match(src,/emit\('swing',\{pattern:E\.pat\.name,icon:E\.pat\.icon,/); assert.match(src,/recovery:E\.pat\.final\?\(E\.pat\.recovery\|\|0\.65\):0/);
  /* 판정 규칙은 그대로: 회피 무적·히트스톱·자세 값이 dungeons.js 에 남아 있다 */
  const dg=require('fs').readFileSync(new URL('../js/dungeons.js',import.meta.url),'utf8');
  assert.match(dg,/dodge:\s*\{ iframes:0\.30/); assert.match(dg,/posture:\s*\{[^}]*max:100/);
});

test('d01 데이터: 돌진 2 종에 관통(lunge), 3 단계 훅 연계에 걷기 1 박(gap 0.7 s), 큰 기술 3 종에 big', ()=>{
  globalThis.window=globalThis.window||{}; const DG=require('../js/dungeons.js'); const st=DG.ARENAS.tutorial.stages;
  const charge2=st[1].patterns.find(p=>p.name==='돌진'), charge3=st[2].patterns.find(p=>p.name==='돌진');
  assert.ok(charge2.lunge&&charge2.lunge.dist>=180&&charge2.lunge.dur>=0.25); assert.ok(charge3.lunge&&charge3.lunge.dist>=180);
  const hook=st[2].patterns.find(p=>p.name==='훅 연타 내려찍기'); assert.equal(hook.chain[0].walk,true); assert.ok(hook.chain[0].gap>=0.6&&hook.chain[0].gap<=1.0);
  assert.ok(st[1].patterns.find(p=>p.name==='양손 내려찍기').big); assert.ok(st[2].patterns.find(p=>p.name==='회전 후려치기').big); assert.ok(st[2].patterns.find(p=>p.name==='도약 내려찍기').big);
  /* 1 단계는 «단타 유지»(문서 18) — 걷기·관통·big 없음 */
  for(const p of st[0].patterns){ assert.ok(!p.lunge&&!p.big); for(const c of p.chain||[]) assert.ok(!c.walk); }
});

test('raid 서버: 걷기 링크 동안 보스가 플레이어 쪽으로 움직이고, 관통 돌진은 swing 뒤 플레이어를 지나쳐 멈춘다', ()=>{
  const {Raid}=require('../server/raid.cjs'); const members=[{id:'a',name:'A'}];
  const r=new Raid('d01',members); r.startFight(); r.phase=2; r.stage=r.A.stages[2]; r.boss.parts=r.stage.parts.map(p=>({...p}));
  const p=r.players.get('a'); p.x=r.boss.x-320; p.y=r.boss.y; const b=r.boss;   /* keep(140)+dead 밖 — 걷기 링크면 다가와야 한다 */
  /* 걷기 링크를 직접 만든다 */
  const hook=r.stage.patterns.find(q=>q.name==='훅 연타 내려찍기'); b.def=hook; b.beats=r.beatsOf(hook); b.beatI=0; b.pattern={...b.beats[0]}; b.state='link'; b.linkT=0.7; b.aim=0; b.pattern.walk=true;
  const x0=b.x; for(let i=0;i<30;i++) r.bossStep(0.01); assert.ok(b.x<x0-3,'걷기 링크: 보스가 다가온다 '+(x0-b.x).toFixed(1));
  /* 관통: lunge 상태를 만들어 tick 하면 플레이어를 지나 dist 만큼 더 간다 */
  b.state='recover'; b.recovery=1; b.recoveryDur=1; const ang=r.world.angle(b.x,b.y,p.x,p.y), d0=r.world.dist(b.x,b.y,p.x,p.y);
  b.lunge={t:0,dur:0.3,ang,total:d0+200}; for(let i=0;i<40;i++) r.bossStep(0.01);
  assert.equal(b.lunge,null); const d1=r.world.dist(b.x,b.y,p.x,p.y); assert.ok(d1>120&&d1<260,'플레이어 뒤 '+d1.toFixed(0));
});

test('game3d/weapon-trail/swing-body: 관통·큰 기술 3 단·회전 링·큰 스킬(전진·화각·궤적 0.3 s·넓은 띠)이 배선돼 있고 A/B 스위치가 있다', async ()=>{
  const g=await readFile(new URL('../js/game3d.js',import.meta.url),'utf8');
  for(const k of ['function startLunge','function tickLunge','function fxBigTell','function fxBigStrike','function fxAfterglow','function fxBossRing','if(e.lunge) startLunge(e.lunge)','function skillLungeOffset','if(bigSkillNow()) fv+=5','!s.enemy.walking'])
    assert.ok(g.includes(k),k);
  assert.match(g,/skillLungeOffset\(\)\{ if\(window\.TW_BIG_SKILLS===false\) return 0;/);
  const t=await readFile(new URL('../js/weapon-trail.js',import.meta.url),'utf8');
  assert.match(t,/const TRN=28/); assert.match(t,/this\.power>=1\.5\)\?0\.30:0\.16/); assert.match(t,/TW_BIG_SKILLS!==false/);
  const sb=await readFile(new URL('../js/swing-body.js',import.meta.url),'utf8');
  assert.match(sb,/skill1:1\.40, skill2:0\.95, skill3:1\.45, skill4:0\.85, ult:1\.50/); assert.match(sb,/var YAW = 0\.52;/,'두 손 IK 한계 유지'); assert.match(sb,/LEAN_BIG = 0\.30/);
});
