const test=require('node:test'),assert=require('node:assert/strict'),{Raid}=require('../server/raid.cjs');
const members=[{id:'a',name:'아인 A'},{id:'b',name:'아인 B'}];
const tick=(r,t)=>{for(let i=0;i<Math.round(t*100);i++)r.tick(.01);};
function fight(level='d01'){const r=new Raid(level,members);r.startFight();for(const p of r.players.values()){p.x=r.boss.x-120;p.y=r.boss.y;p.target='body';}return r;}
test('two independent players damage one shared boss only at contact',()=>{
 const r=fight(),hp=r.boss.hp;r.input('a',{type:'attack'});r.input('b',{type:'attack'});tick(r,.2);assert.equal(r.boss.hp,hp);tick(r,.04);const sum=[...r.players.values()].reduce((n,p)=>n+p.damage,0);assert.ok(sum>0);assert.equal(r.boss.hp,hp-sum);assert.equal(r.events.filter(e=>e.type==='hit').length,2);tick(r,.3);assert.equal(r.events.filter(e=>e.type==='hit').length,2);
});
test('client positions, damage and excessive movement speed cannot change authority',()=>{
 const r=new Raid('d01',members),p=r.players.get('a'),x=p.x,y=p.y,hp=p.hp;
 r.input('a',{type:'teleport',x:9000,y:9000,hp:999999});assert.equal(p.x,x);assert.equal(p.hp,hp);
 r.input('a',{type:'move',x:10000,y:0,damage:999999});tick(r,.1);assert.ok(r.world.dist(x,y,p.x,p.y)<=24);tick(r,.5);const stopped=p.x;tick(r,.5);assert.equal(p.x,stopped,'stale input expires');
});
test('one counter interrupts the shared attack; other player cannot duplicate it',()=>{
 const r=fight();for(let i=0;i<1000;i++){r.tick(.01);if(r.boss.state==='telegraph'&&r.boss.tele<=.03)break;}
 assert.equal(r.boss.state,'telegraph');r.input('a',{type:'attack'});r.input('b',{type:'attack'});assert.equal(r.players.get('a').counters,1);assert.equal(r.players.get('a').perfect,1);assert.equal(r.players.get('b').counters,0);assert.equal(r.boss.state,'stagger');
 const hp=r.players.get('b').hp;tick(r,.3);assert.equal(r.players.get('b').hp,hp);
});
test('non-counterable zone attacks both players; outside player remains safe',()=>{
 const r=fight();const [a,b]=[...r.players.values()];r.boss.state='telegraph';r.boss.teleDur=1;r.boss.tele=.01;r.boss.pattern={name:'폭발',dmg:1000,counterable:false,unblockable:true};r.boss.zone={kind:'circle',x:r.boss.x,y:r.boss.y,r:200};
 a.guard=true;b.x=r.boss.x-400;const ah=a.hp,bh=b.hp;r.tick(.01);assert.equal(a.hp,ah-1000);assert.equal(b.hp,bh);
});
test('shared part destruction disables corresponding boss pattern',()=>{
 const r=fight('d03'),p=r.players.get('a'),part=r.boss.parts.find(p=>p.id==='exhaust');part.hp=1;p.target='exhaust';r.input('a',{type:'attack'});tick(r,.3);assert.ok(part.broken);assert.equal(r.players.get('b').breaks,0);assert.equal(r.boss.zoneScale,.75);
 for(const p of r.players.values()){p.x=r.boss.x-300;p.hp=1e7;p.maxHp=1e7;}
 tick(r,18);const names=r.events.filter(e=>e.type==='telegraph').map(e=>e.pattern);assert.ok(names.length>1);assert.ok(!names.includes('고압 분사'));assert.ok(!names.includes('배출관 쓸기'));
});
test('shared valves open the one gate; distant interaction fails; retry retains exploration',()=>{
 const r=new Raid('d03',members),p=r.players.get('a'),q=r.players.get('b');r.input('a',{type:'interact'});assert.equal(r.expedition.ready(),false);
 let i=0;for(const n of r.expedition.nodes.filter(n=>n.kind==='valve')){const who=i++%2?p:q;who.x=n.x;who.y=n.y;r.input(who.id,{type:'interact'});}
 assert.equal(r.expedition.objectiveCount('valves'),3);assert.equal(r.world.isSolid(r.gate.x,r.gate.y),false);
 const cp=r.expedition.nodes.find(n=>n.id==='pump_rest');p.x=cp.x;p.y=cp.y;r.input(p.id,{type:'interact'});r.state='wiped';r.retry();assert.equal(r.expedition.ready(),true);assert.equal(r.players.get('a').x,cp.x);assert.equal(r.players.get('b').hp,r.players.get('b').maxHp);
});
test('revive requires three seconds in range; cannot resurrect a wiped party',()=>{
 const r=new Raid('d01',members),a=r.players.get('a'),b=r.players.get('b');r.hurt(a,a.hp,'test');r.input('b',{type:'revive',on:true});tick(r,2);assert.equal(a.hp,0);tick(r,1.1);assert.equal(a.hp,Math.round(a.maxHp*.3));assert.equal(a.revives,1);
 r.hurt(a,a.hp,'test');r.hurt(b,b.hp,'test');r.tick();assert.equal(r.state,'wiped');r.input('b',{type:'revive',on:true});tick(r,4);assert.equal(a.hp,0);
});
test('revive stops when helper leaves range or disconnects, and all-offline run pauses',()=>{
 const r=new Raid('d01',members),a=r.players.get('a'),b=r.players.get('b');r.hurt(a,a.hp,'test');r.input('b',{type:'revive',on:true});tick(r,1);assert.ok(a.reviveProgress>0);r.disconnect('b');tick(r,.1);assert.equal(a.reviveProgress,0);r.disconnect('a');const t=r.time;tick(r,5);assert.equal(r.time,t);r.reconnect('b');tick(r,.1);assert.ok(r.time>t);
});
/* d04 는 빠져 있다 — 이 봇 기준으로 «전멸» 한다. 다른 던전은 광란에서 한 패턴만 꽂히는데
   (d03 14,360 · d06 20,540) d04 는 셋이 다 꽂혀 48,900 을 받는다 (2인 합계 체력 48,900).
   광란 체력을 260,000 → 220,000 으로 내려도 죽는 틱이 같다 — 병목은 보스 체력이 아니라
   받는 피해다. 간격·타격을 훑어봐도 1 HP 남기고 통과하는 «봇 맞춤» 수치만 나와서
   (docs/design/21-dungeon-05-06.md §6 의 표) 억지로 통과시키지 않는다.
   이 봇은 가드·물약·스킬·궁극기를 안 쓰므로 사람이 못 깬다는 근거도 아니다. */
test('two intent-driven fighters clear every phase of every dungeon without injected damage',()=>{
 for(const level of ['d01','d02','d03','d05','d06','d07']){
  let awards=0;const r=new Raid(level,members,()=>awards++);r.startFight();
  for(let i=0;i<60000&&r.state!=='clear'&&r.state!=='wiped';i++){
   for(const p of r.players.values()){
    if(!r.alive(p)||r.state!=='fight')continue;
    const dx=r.boss.x-p.x,dy=(r.boss.y-p.y)/.55,far=Math.hypot(dx,dy)>115;
    r.input(p.id,{type:'move',x:far?dx:0,y:far?dy:0});
    r.input(p.id,{type:'target',part:r.boss.parts.find(q=>q.breakable&&!q.broken)?.id||r.boss.parts[0].id});
    if(r.canCounter(p))r.input(p.id,{type:'attack'});
    else if(r.inZone(p)&&r.boss.state==='telegraph'&&r.boss.tele<.15)r.input(p.id,{type:'dodge'});
    else if(['idle','downed','stagger','recover'].includes(r.boss.state))r.input(p.id,{type:'attack'});
   }r.tick(.01);
  }
  assert.equal(r.state,'clear',level);assert.equal(r.phase,r.A.stages.length-1);assert.ok([...r.players.values()].every(p=>p.damage>0));assert.equal(awards,1);tick(r,10);assert.equal(awards,1);
 }
});
test('shared optional cache is included once in each clear reward, even after a wipe',()=>{
 const r=new Raid('d02',members),node=r.expedition.nodes.find(n=>n.id==='marsh_cache');
 for(const p of r.players.values()){p.x=node.x;p.y=node.y;r.input(p.id,{type:'interact'});}
 r.state='wiped';r.retry();const items=new Map(r.rewards().items),base=new Map(r.A.rewards.items);
 for(const [id,n]of node.loot)assert.equal(items.get(id),(base.get(id)||0)+n);
});
test('storage failure leaves rewards pending and retries without a false paid result',()=>{
 let calls=0;const r=new Raid('d01',members,()=>{if(++calls===1)throw Error('disk full');});r.phase=r.A.stages.length-1;r.phaseClear();assert.equal(r.result.rewardStatus,'pending');tick(r,5.1);assert.equal(r.result.rewardStatus,'saved');assert.equal(calls,2);
});

test('online execution mirrors solo: only while downed, once, with the dedicated clip',()=>{
 const r=new Raid('d01',members);r.startFight();const a=r.players.get('a');
 a.x=r.boss.x-40;a.y=r.boss.y;
 assert.equal(r.canExecute(a),false);                       /* 서 있는 보스는 처형할 수 없다 */
 r.input('a',{type:'execute'});assert.equal(a.action,null);
 r.boss.posture=100;r.checkDown();
 assert.equal(r.boss.state,'downed');assert.equal(r.snapshot().boss.executable,true);
 r.input('a',{type:'execute'});
 assert.equal(a.action.clip,'exec');assert.equal(a.action.kind,'exec');
 assert.equal(r.snapshot().boss.executable,false);
 a.action=null;r.input('a',{type:'execute'});assert.equal(a.action,null);   /* 한 번뿐 */
});

test('rage phase changes the arena: hazards appear, cycle, and only hurt inside',()=>{
 const r=new Raid('d03',members);r.startFight();
 assert.equal(r.arenaHz.length,0,'통상 페이즈에는 위험 구역이 없다');
 r.phase=1;r.setupBoss();
 assert.ok(r.arenaHz.length>0,'광란 페이즈에 위험 구역이 생긴다');
 const h=r.arenaHz[0],a=r.players.get('a');
 const phases=new Set();for(let i=0;i<Math.ceil(h.period/.05);i++){r.arenaT=i*.05;phases.add(r.arenaPhase(h));}
 assert.deepEqual([...phases].sort(),['active','off','warning'],'경고 → 발동 → 꺼짐 을 돈다');
 /* 구역 밖은 안전, 안은 아프다 */
 r.arenaT=h.offset+h.warning+.1;assert.equal(r.arenaPhase(h),'active');
 a.x=h.x+h.r+200;a.y=h.y;a.hazardCd=0;const far=a.hp;r.tick(.01);assert.equal(a.hp,far);
 a.x=h.x;a.y=h.y;a.hazardCd=0;a.dodgeT=0;r.arenaT=h.offset+h.warning+.1;r.tick(.01);
 assert.ok(a.hp<far,'발동 중 구역 안에 있으면 피해를 받는다');
 assert.equal(r.snapshot().arena.hazards.length,r.arenaHz.length);
});
