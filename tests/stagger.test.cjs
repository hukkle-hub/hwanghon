const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};
for(const f of ['world','dungeons'])vm.runInNewContext(fs.readFileSync(`js/${f}.js`,'utf8'),ctx,{filename:f});
const {RULES,ARENAS,SKILLS}=ctx.window.TW_DUNGEONS,CHAR=ctx.window.TW_WORLD.CHARS.ain;
const {createBattle}=require('../js/combat.js');
const copy=x=>JSON.parse(JSON.stringify(x));

/* 「맞아도 거의 안 움직인다」를 고친 것 (docs/design/50 §4).
   경직을 세기로 나누고, 맞은 방향 반대로 «밀려난다». */
function hit(dmgFrac, guard){
 const r=copy(RULES);r.bleed.chance=0;
 const hp=CHAR.stats.hp;
 const pat={name:'t',icon:'hammer',tele:.05,dmg:Math.round(hp*dmgFrac),posture:0,recovery:.5,guardCost:0};
 const b=createBattle({rules:r,dummy:Object.assign(copy(ARENAS.tutorial.stages[0]),{patterns:[pat]}),
  char:{...CHAR,stats:{...CHAR.stats,crit:0,aspd:100}},skills:SKILLS.ain,ult:SKILLS.ainUlt,seed:7});
 if(guard)b.input('guard',true);
 let ev=null;
 for(let i=0;i<200&&!ev;i++){b.tick(.01);ev=b.drain().find(e=>e.t==='damaged');}
 return {ev,snap:b.snapshot(),b};
}
/* 맞은 뒤 «굳어 있는» 시간을 실제로 센다 (히트스톱 동안은 시계가 멈추므로 틱 수로 잰다) */
function lockTicks(r){ let n=0; while(n<400&&r.b.snapshot().player.locked){ r.b.tick(.01); n++; } return n; }

test('경직은 세기로 나뉜다 — 스쳐 맞음 / 크게 맞음 / 막아 냄', () => {
 assert.equal(hit(.03).ev.tier,'light');
 assert.equal(hit(.30).ev.tier,'heavy');
 assert.equal(hit(.30,true).ev.tier,'guard');
});

test('크게 맞으면 더 오래 굳는다', () => {
 const S=RULES.stagger;
 assert.ok(S.heavy.lock>S.light.lock, '대경직이 약경직보다 길어야 한다');
 assert.equal(S.guard.lock, 0, '막아 내면 굳지 않는다 — 가드는 반격으로 이어지는 설계다');
 assert.ok(S.heavy.push>S.light.push&&S.light.push>S.guard.push, '밀리는 거리도 같은 순서');
 /* 구르기(170px)보다는 훨씬 짧아야 한다 — 맞았다고 회피만큼 날아가면 안 된다 */
 assert.ok(S.heavy.push<170*0.5, '대경직 넉백이 구르기의 절반을 넘지 않는다');
});

test('시뮬레이션에서 실제로 굳는 시간이 단계를 따른다', () => {
 const L=hit(.03), H=hit(.30), G=hit(.30,true);
 assert.ok(L.snap.player.locked, '맞으면 굳는다');
 const lt=lockTicks(L), ht=lockTicks(H);
 assert.ok(ht>lt, '대경직 '+ht+'틱 · 약경직 '+lt+'틱 — 크게 맞으면 더 오래 굳어야 한다');
 assert.equal(G.ev.tier,'guard');
 assert.equal(G.snap.player.locked, false, '막아 냈으면 굳지 않고 바로 반격할 수 있다');
});

test('넉백은 맞은 반대 방향으로 밀고, 총 거리는 주문한 만큼이다', () => {
 const W=ctx.window.TW_WORLDSIM||null;
 const wctx={window:{}};
 vm.runInNewContext(fs.readFileSync('js/world-sim.js','utf8'),wctx,{filename:'world-sim'});
 const world=wctx.window.TW_WORLDSIM.createWorld({rows:['..........','..........','..........','..........'],cell:64});
 const p=world.add('p',{x:200,y:100,r:10,rollT:0,lockT:0,kbT:0,aim:0});
 world.knock(p, 1, 0, 60, 0.20);                 /* +x 로 60px, 0.2초 */
 for(let i=0;i<40;i++) world.movePlayer(p,0,0,0.01,230);
 assert.ok(Math.abs(p.x-260)<3, '밀린 거리가 '+(p.x-200).toFixed(1)+'px — 60px 이어야 한다');
 assert.equal(p.kbT,0);
 assert.equal(p.y,100);
});

test('넉백 중에는 스틱이 먹지 않는다 — 맞는 동안은 내 뜻대로 못 움직인다', () => {
 const wctx={window:{}};
 vm.runInNewContext(fs.readFileSync('js/world-sim.js','utf8'),wctx,{filename:'world-sim'});
 const world=wctx.window.TW_WORLDSIM.createWorld({rows:['..........','..........','..........','..........'],cell:64});
 const p=world.add('p',{x:200,y:100,r:10,rollT:0,lockT:0,kbT:0,aim:0});
 world.knock(p, 1, 0, 60, 0.20);
 world.movePlayer(p,-1,0,0.01,230);              /* 반대로 밀어 보지만 */
 assert.ok(p.x>200, '넉백이 스틱을 이긴다');
 assert.equal(p.moving,false);
});
