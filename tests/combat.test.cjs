const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};
for(const f of ['world','dungeons'])vm.runInNewContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx,{filename:f});
const {RULES,ARENAS,SKILLS}=ctx.window.TW_DUNGEONS,CHAR=ctx.window.TW_WORLD.CHARS.ain;
const {createBattle,summarize}=require('../js/combat.js');
const copy=x=>JSON.parse(JSON.stringify(x));
function battle({stage=0,patterns=[],parts,hooks={},rules={},dummy={},char={},player,partMult=1,skills=SKILLS.ain}={}){
 const r=copy(RULES);r.bleed.chance=0;Object.assign(r,rules);
 const d=Object.assign(copy(ARENAS.tutorial.stages[stage]),{patterns},dummy);if(parts)d.parts=parts;
 return createBattle({rules:r,dummy:d,char:{...CHAR,stats:{...CHAR.stats,crit:0,aspd:100,...char}},hooks,player,partMult,skills,ult:SKILLS.ainUlt,seed:7});
}
const pat={name:'test',icon:'hammer',tele:1,dmg:4200,posture:30,recovery:.8};
function until(b,f,max=2000){for(let i=0;i<max&&!f(b.snapshot());i++)b.tick(.01);assert.ok(f(b.snapshot()),'condition reached');}
function tele(b,left=.1){until(b,s=>s.enemy.state==='telegraph'&&s.enemy.tele<=left+1e-8);}
function idle(b){until(b,s=>!s.player.action&&!s.player.hitstop);}

test('all tutorial stages attack; strict windows; other dungeon tuning preserved',()=>{
 assert.deepEqual(Array.from(ARENAS.tutorial.stages,d=>d.counterWindow),[.18,.16,.14]);
 for(const d of ARENAS.tutorial.stages){assert.ok(d.patterns.length);assert.equal(d.firstCounterUlt,false);assert.equal(d.discipline.normal,.22);}
 assert.equal(ARENAS.marsh.stages[0].hp,1100000);assert.equal(ARENAS.marsh.stages[0].discipline,undefined);
});
test('one hit at contact, not on input; target frozen for each action',()=>{
 const b=battle();b.input('attack','body');b.input('target','core');assert.equal(b.metrics.hits,0);
 b.tick(.23);assert.equal(b.metrics.hits,0);b.tick(.01);assert.equal(b.metrics.hits,1);
 assert.equal(b.drain().find(e=>e.t==='hit').part,'body');b.tick(1);assert.equal(b.metrics.hits,1);
});
test('range checked at impact; late departure whiffs and entering range connects',()=>{
 for(const initial of [true,false]){let can=initial;const b=battle({hooks:{canHit:()=>can}});b.input('attack');can=!initial;b.tick(.24);assert.equal(b.metrics.hits,initial?0:1);}
});
test('windup cannot be cancelled; recovery permits dodge',()=>{
 const b=battle();b.input('attack');b.input('dodge');assert.equal(b.metrics.dodges,0);b.tick(.57);b.input('dodge');assert.equal(b.metrics.dodges,1);assert.equal(b.snapshot().player.action,null);
});
test('late input buffers once; early spam does not queue',()=>{
 const b=battle();b.input('attack');b.input('attack');b.tick(.74);assert.equal(b.snapshot().player.action,null);
 b.input('attack');b.tick(.60);b.input('attack');b.tick(.16);assert.ok(b.snapshot().player.action);b.tick(1);assert.equal(b.metrics.hits,3);
});
test('counter damage deferred and stronger; perfect requires final 40ms',()=>{
 const normal=battle();normal.input('attack','body');normal.tick(.24);
 let prior=0;
 for(const [left,perfect] of [[.1,false],[.03,true]]){
  const b=battle({patterns:[pat]});tele(b,left);b.input('attack','body');assert.equal(b.metrics.counters,1);assert.equal(b.metrics.perfect,Number(perfect));assert.equal(b.metrics.hits,0);
  b.tick(.18);assert.ok(b.metrics.dmg>normal.metrics.dmg*10);assert.ok(b.metrics.dmg>prior);prior=b.metrics.dmg;
 }
});
test('empty dodge and safe positioning cannot farm riposte',()=>{
 const b=battle({patterns:[pat],hooks:{inZone:()=>false}});tele(b);b.input('dodge');b.tick(.2);assert.equal(b.metrics.evades,0);assert.equal(b.snapshot().player.riposte,false);
});
test('actual dodge grants one short reward, consumed even on whiff',()=>{
 const b=battle({patterns:[pat],hooks:{canHit:()=>false}});tele(b);b.input('dodge');b.tick(.32);assert.equal(b.metrics.evades,1);assert.equal(b.snapshot().player.riposte,true);
 b.input('attack');assert.equal(b.snapshot().player.action.opt.riposte,'evade');assert.equal(b.snapshot().player.riposte,false);b.tick(.24);assert.equal(b.metrics.whiffs,1);
 const c=battle({patterns:[pat]});tele(c);c.input('dodge');c.tick(1.1);assert.equal(c.snapshot().player.riposte,false);
});
test('dodge into safe space rewards only the threatened attack',()=>{
 let inside=true;const b=battle({patterns:[pat],hooks:{inZone:()=>inside}});tele(b,.35);b.input('dodge');inside=false;b.tick(.36);assert.equal(b.metrics.evades,1);
});
test('unblockable sweep cannot be countered or guarded',()=>{
 for(const type of ['attack','guard']){const b=battle({patterns:[{...pat,counterable:false,unblockable:true}]});tele(b);b.input(type,true);b.tick(.12);assert.equal(b.metrics.counters,0);assert.equal(b.metrics.guards,0);assert.equal(b.metrics.dmgTaken,4200);}
});
test('guard retaliation and interrupted windup do not grant free damage',()=>{
 const b=battle({patterns:[pat]});tele(b);b.input('guard',true);b.tick(.12);assert.equal(b.metrics.dmgTaken,1260);b.input('guard',false);b.input('attack');assert.equal(b.snapshot().player.action.opt.riposte,'guard');
 const c=battle({patterns:[pat]});tele(c);c.input('skill',0);c.tick(.12);assert.equal(c.snapshot().player.action,null);c.tick(.5);assert.equal(c.metrics.hits,0);assert.ok(c.snapshot().player.lastFailure.includes('공격 동작'));
});
test('break burst occurs once, exposes armor and releases guarded core',()=>{
 const b=battle({stage:1,parts:[{id:'armor',name:'armor',hp:1,breakable:true},{id:'core',name:'core',hp:null,weak:true,guardedBy:['armor'],guardReduce:.5}]});
 b.input('attack','armor');b.tick(.24);assert.equal(b.metrics.breaks,1);assert.equal(b.metrics.breakDmg,7450);idle(b);b.input('attack','armor');b.tick(.24);assert.equal(b.metrics.breaks,1);
 assert.equal(b.snapshot().enemy.parts.find(p=>p.id==='core').broken,false);
});
test('non-breakable hp never emits break; lethal break cannot resurrect boss',()=>{
 const b=battle({parts:[{id:'x',hp:1,breakable:false}]});b.input('attack');b.tick(.24);assert.equal(b.metrics.breaks,0);
 const c=battle({parts:[{id:'x',hp:1,breakable:true}],dummy:{hp:100,allBrokenDown:true}});c.input('attack');c.tick(.24);assert.equal(c.over,true);assert.equal(c.snapshot().enemy.state,'broken');
});
test('hitstop freezes both action and enemy clock',()=>{
 const b=battle({patterns:[pat]});tele(b,.8);b.input('attack');b.tick(.24);const s=b.snapshot();assert.ok(s.player.hitstop>0);b.tick(.04);assert.equal(b.snapshot().player.action.elapsed,s.player.action.elapsed);assert.equal(b.snapshot().enemy.tele,s.enemy.tele);assert.equal(b.snapshot().poseTime,s.poseTime);
});
test('same simulation at 30/60/120Hz',()=>{
 function run(fps){const b=battle({patterns:[pat],char:{hp:1e8}});b.input('attack');for(let i=0;i<fps*12;i++)b.tick(1/fps);return b.snapshot();}
 assert.deepEqual(run(30),run(60));assert.deepEqual(run(60),run(120));
});
test('four light attacks unlock strongest smash',()=>{
 const b=battle();for(let i=0;i<4;i++){b.input('attack');idle(b);}b.input('smash');assert.equal(b.snapshot().player.action.opt.tier,3);
});

module.exports={battle,copy,CHAR,RULES,ARENAS,SKILLS,createBattle,summarize};
test('part break interrupts incoming attack as well as its animation',()=>{
 const b=battle({patterns:[pat],parts:[{id:'armor',hp:1,breakable:true}]});tele(b,.8);b.input('attack');b.tick(.24);assert.equal(b.snapshot().enemy.state,'stagger');assert.equal(b.snapshot().enemy.tele,0);b.tick(1);assert.equal(b.metrics.dmgTaken,0);
});
test('seeded full tutorial: spam fails; counter/break/dodge policy clears',()=>{
 const {simulate}=require('./balance.cjs');const spam=simulate('spam'),skilled=simulate('skilled');assert.equal(spam[0].clear,false);assert.equal(skilled.length,3);assert.ok(skilled.every(r=>r.clear));assert.equal(skilled[1].breaks,2);assert.ok(skilled[2].evades>0);assert.equal(skilled[2].breaks,1);
});
test('counter grade excludes attacks that can only be evaded',()=>{
 const {grade}=require('../js/combat.js');assert.equal(grade(RULES,{time:10,timeLimit:100,breakable:1,breaks:1,telegraphs:3,counterOpportunities:1,counters:1}),'S');
});

test('party part damage bonus survives integration with timed impacts',()=>{
 const hits=[1,1.25].map(partMult=>{const b=battle({partMult,parts:[{id:'armor',hp:10000,breakable:true}]});b.input('attack');b.tick(.24);return b.metrics.dmg;});assert.ok(Math.abs(hits[1]-hits[0]*1.25)<=1);
});
test('party counter bonus extends stage window while perfect remains strict',()=>{
 const b=battle({patterns:[pat],rules:{counter:{...copy(RULES.counter),bonus:.09}}});tele(b,.25);b.input('attack');assert.equal(b.metrics.counters,1);assert.equal(b.metrics.perfect,0);assert.equal(b.snapshot().enemy.window,.27);
});
test('summary exports finite counts for persistent grade progression',()=>{
 const b=battle({patterns:[pat]});tele(b);b.input('attack');b.tick(.18);const s=summarize(RULES,ARENAS.tutorial,[b.metrics]);assert.equal(s.counters,1);assert.equal(s.telegraphs,1);assert.equal(s.counterOpportunities,1);
});

/* ---------- 연출용 전용 동작: 스킬 4종 · 카운터 · 처형 (docs/design/18-boss-fight-design.md) ---------- */
test('each skill drives its own clip, and a no-damage skill still reports one',()=>{
 const b=battle();const clips=[];
 for(let i=0;i<4;i++){ b.input('skill',i); const ev=b.drain();
   const st=ev.find(e=>e.t==='actionstart'), sk=ev.find(e=>e.t==='skill');
   clips.push([sk&&sk.clip, st&&st.clip]); idle(b); b.tick(.5); }
 assert.deepEqual(clips.map(c=>c[0]),['skill1','skill2','skill3','skill4']);
 assert.equal(clips[0][1],'skill1');                       /* 피해 스킬은 동작까지 건다 */
 assert.equal(clips[1][1],undefined);                      /* 회피 스킬은 동작 없이 클립 이름만 알려준다 */
});
test('counter plays the dedicated clash clip instead of a normal swing',()=>{
 const b=battle({patterns:[pat]});tele(b,.1);b.input('attack');
 const ev=b.drain();assert.equal(ev.find(e=>e.t==='counter')!=null,true);
 assert.equal(ev.find(e=>e.t==='actionstart').clip,'counter');
});
test('execution only when posture is broken, once, and it hits far harder',()=>{
 const b=battle({parts:[{id:'body',hp:null}]});
 b.input('execute');assert.equal(b.drain().some(e=>e.t==='execute'),false);   /* 서 있는 보스는 처형할 수 없다 */
 for(let i=0;i<40&&b.snapshot().enemy.state!=='downed';i++){b.input('smash');idle(b);b.tick(.2);}
 assert.equal(b.snapshot().enemy.state,'downed');
 assert.equal(b.snapshot().enemy.executable,true);
 const before=b.metrics.dmg;b.drain();b.input('execute');
 const ev=b.drain();assert.equal(ev.some(e=>e.t==='execute'),true);
 assert.equal(ev.find(e=>e.t==='actionstart').clip,'exec');
 idle(b);const execDmg=b.metrics.dmg-before;assert.ok(execDmg>0,'처형이 피해를 준다');
 b.input('execute');assert.equal(b.drain().some(e=>e.t==='execute'),false);   /* 한 번뿐 */
 assert.equal(b.snapshot().enemy.executable,false);
});
test('hit stop is layered by strength, not one flat value',()=>{
 const h=RULES.hitstop;
 assert.ok(h.smash>=h.chain*1.5&&h.chain>h.light,'약타 < 연타 < 스매시');
 assert.ok(h.execute>h.brk&&h.brk>h.counter,'처형 > 부위파괴 > 카운터');
});

/* 카운터 3단 — 흘림 / 튕김 / 맞대기 (docs/design/51).
   히트스톱을 평타 전체에 걸면 회피 취소 경계가 밀려 입력 버퍼가 깨진다. 그래서
   «제대로 맞춘 순간» 에만 건다. 마영전의 힘겨루기가 이 자리다. */
test('counter splits into deflect / repel / clash by how late you parry',()=>{
 const seen={};
 for(const [left,want] of [[.24,'deflect'],[.14,'repel'],[.05,'clash']]){
  /* 던전 설정이 규칙보다 우선이다 (D.counterWindow || R.counter.window) — dummy 로 덮는다 */
  const b=battle({patterns:[pat],dummy:{counterWindow:.30,perfectWindow:.08,midWindow:.18}});
  tele(b,left);b.input('attack');
  const e=b.drain().find(x=>x.t==='counter');
  assert.ok(e,`${want}: 카운터가 안 났다`);
  assert.equal(e.tier,want,`남은 예고 ${left} 는 ${want} 여야 한다 (실제 ${e.tier})`);
  assert.equal(e.perfect,want==='clash','perfect 는 맞대기일 때만 true');
  /* 히트스톱은 actionstart 가 아니라 «접점» 에서 걸린다 — 거기까지 돌린 뒤 읽는다 */
  until(b,x=>x.player.hitstop>0);
  seen[want]=b.snapshot().player.hitstop;
 }
 /* 늦게 받아칠수록 오래 멈춘다 — 그게 긴장감이다 */
 assert.ok(seen.clash>seen.repel&&seen.repel>seen.deflect,
   `멈춤이 단계로 길어져야 한다: ${JSON.stringify(seen)}`);
 assert.ok(seen.clash>=RULES.hitstop.smash*1.5,'맞대기는 스매시보다 확실히 길다');
});

test('counter tiers scale posture, damage and the follow-up window',()=>{
 const h=RULES.hitstop, c=RULES.counter;
 assert.ok(h.clash>h.counter&&h.counter>h.deflect,'흘림 < 튕김 < 맞대기');
 assert.ok(c.perfectMult>c.mult&&c.mult>c.deflectMult,'배율도 같은 순서');
 const tp=c.tierPosture;
 assert.ok(tp.clash>tp.repel&&tp.repel>tp.deflect,'자세 누적도 같은 순서');
 /* 중간 경계는 던전이 창을 좁히면 같은 비율로 따라 좁아진다 */
 assert.ok(c.mid>c.perfect&&c.mid<c.window,'mid 는 perfect 와 window 사이');
});
