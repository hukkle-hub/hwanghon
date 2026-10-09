const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Field,HIT_GAP}=require('../server/field.cjs'),MOB=require('../server/field-mob-combat.cjs'),{Store}=require('../server/store.cjs');
const RS=require('../server/rpg-skills.cjs');
const seed=n=>()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
function setup(extra={}){
 let now=10000;const profile={id:'a',name:'검수',character:'ain',stats:{hp:20000,atk:1000,critChance:0},equipment:{}};
 const f=new Field({rng:()=>.5,clock:()=>now,...extra}),p=f.join('a',profile,'namsan');
 const e=f.ecologies.get('namsan'),m=[...e.mobs.values()].find(m=>m.group.kind==='nest');
 p.x=m.x;p.z=m.z;p.invulnUntil=0;return {f,p,e,m,profile,setNow:t=>now=t};
}
test('v2 first seven fields match snapshot; current Claude decoder reads slot 8 HP and slot 9 seq at AOI28 max20',async()=>{
 const {f,p,e,m}=setup();assert.equal(f.ecology('namsan'),e);assert.equal(f.ecologies.size,1);
 const packet=f.view(p);assert.ok(packet.mobs.length>0);assert.ok(packet.mobs.length<=20);
 const row=packet.mobs.find(r=>r[0]===m.id);assert.deepEqual(row,[m.id,m.catalogId,+m.x.toFixed(2),+m.z.toFixed(2),true,'idle',1,100,0]);
 assert.ok(packet.mobs.every(r=>r.length===9&&typeof r[4]==='boolean'&&Math.hypot(r[2]-p.x,r[3]-p.z)<=28.02));
 const {mobsFromPacket}=await import('../js/mmo/field-mobs.js');
 const decoded=mobsFromPacket(packet.mobs);assert.equal(decoded.length,packet.mobs.length);
 assert.ok(decoded.every(m=>m.hp===100&&m.seq===0&&m.alive));
 assert.deepEqual(decoded.map(({hp,seq,...m})=>m),e.snapshot(p.x,p.z,10000),'actual online decoder matches Ecology objects');
 const remote={...p,x:p.x+10000};assert.deepEqual(f.mobView(remote),[]);
 const joined=f.command('b',{type:'fieldJoin',zone:'namsan'}, {...setup().profile,id:'b'},false);assert.ok(Array.isArray(joined.mobs));
});
test('server damage ignores forged values, enforces range, zone, generation and rate even when target IDs change',()=>{
 const {f,p,m,e,profile}=setup();const s=f.mobStates.get(m.id);s.hp=s.max=1e9;
 const plain=f.hitMob('a',{mob:m.id,damage:Infinity,mult:1e6,crit:true},profile,10000);assert.equal(plain.dmg,1000);assert.equal(plain.crit,false);
 assert.equal(f.hitMob('a',{mob:m.id},profile,10000+HIT_GAP-1),null);
 const other=[...e.mobs.values()].find(n=>n!==m&&Math.hypot(n.x-m.x,n.z-m.z)<3);assert.ok(other);
 assert.equal(f.hitMob('a',{mob:other.id},profile,10001),null,'ID-switch bypass');
 assert.equal(f.hitMob('a',{mob:m.id,generation:0},profile,11000),null,'old generation');
 p.x+=4;assert.equal(f.hitMob('a',{mob:m.id},profile,11000),null,'out of range');
 assert.throws(()=>f.hitMob('a',{mob:'jeju:fake'},profile,11000),/몬스터/);
 assert.equal(f.command('a',{type:'fieldHit',mob:m.id,boss:'clave'},profile,false),null,'ambiguous target');
 assert.throws(()=>f.command('a',{type:'fieldHit',mob:m.id},profile,true),/출격/);
});
test('skill multiplication/cooldown and critNext use same server skill table as bosses',()=>{
 const {f,m,p,profile}=setup(),s=f.mobStates.get(m.id);s.hp=s.max=1e9;
 const base=f.hitMob('a',{mob:m.id},profile,10000),def=RS.resolve(profile).skills[0];
 const skill=f.skill('a',{skill:0,mob:m.id,mult:9999},profile,10001);
 assert.equal(skill.type,'mobHit');assert.equal(skill.dmg,Math.round(base.dmg*def.mult));
 const cooldown=f.skill('a',{skill:0,mob:m.id,generation:m.generation},profile,10002);
 assert.equal(cooldown.ok,false);assert.equal(cooldown.type,'mobHit');assert.equal(cooldown.mob,m.id);assert.equal(cooldown.generation,m.generation);assert.equal(cooldown.name,def.name);
 f.skill('a',{skill:1},profile,11000);assert.equal(p.critNext,true);
 assert.equal(f.hitMob('a',{mob:m.id},profile,12000).crit,true);
 assert.equal(f.hitMob('a',{mob:m.id},profile,13000).crit,false);
});
test('defeat is once, corpse expires and respawn resets HP, attack state and generation',()=>{
 const {f,p,m,e,profile,setNow}=setup();const s=f.mobStates.get(m.id);s.hp=1;
 let defeats=0;const original=e.defeat.bind(e);e.defeat=(...a)=>{defeats++;return original(...a);};
 const r=f.hitMob('a',{mob:m.id},profile,10000);assert.equal(r.down,true);assert.equal(defeats,1);
 assert.equal(f.hitMob('a',{mob:m.id},profile,11000),null);assert.equal(defeats,1);
 const corpse=f.mobView(p,10001).find(r=>r[0]===m.id);assert.equal(corpse[5],'die');assert.equal(corpse[4],false);assert.equal(corpse[7],0);assert.equal(corpse[8],1);
 assert.ok(!f.mobView(p,12001).some(r=>r[0]===m.id));
 p.x+=100;setNow(40000);f.tickBosses(40000);const next=e.mobs.get(m.id),fresh=f.mobStates.get(m.id);
 assert.equal(next.generation,2);assert.equal(fresh.hp,fresh.max);assert.equal(fresh.ai.beat,0);assert.equal(fresh.ai.seq,0);
 assert.equal(f.hitMob('a',{mob:m.id,generation:1},profile,40001),null);
});
test('actual 20Hz mob strike uses bossStrike: dodge, defense, buff and h[6] server timestamp',()=>{
 const {f,p,e,m,setNow}=setup();for(const n of e.mobs.values())if(n!==m)e.defeat(n.id,10000);
 f.tickBosses(10050);assert.equal(m.anim,'attack');assert.equal(p.hurt,null,'windup is not an instant hit');
 p.dodgeUntil=11000;setNow(10650);f.tickBosses(10650);
 assert.equal(p.hurt[2],m.id);assert.equal(p.hurt[4],'evade');assert.equal(p.hurt[6],10650);assert.equal(p.hp,p.maxHp);
 const s=f.mobStates.get(m.id);p.dodgeUntil=0;s.ai.phase='windup';s.ai.until=10651;
 setNow(10651);f.tickBosses(10651);const plain=p.hurt[1];assert.equal(plain,s.stats.damage);
 p.hp=p.maxHp;p.defense=6000;p.buffUntil=13000;p.buffReduce=.5;s.ai.phase='windup';s.ai.until=10652;
 setNow(10652);f.tickBosses(10652);assert.equal(p.hurt[1],Math.round(plain*.82*.5));assert.equal(p.hurt[6],10652);
});
test('pending drop/XP table grants nothing; configured test awards use addItems/mutate, never bossLoot, once only',()=>{
 const store=new Store(null);const g=store.guest('몹검수');store.chooseName(g.profile.id,'몹검수','ain');const id=g.profile.id;
 let callbacks=0;const f=new Field({store,clock:()=>10000,rng:()=>.5,mobRewards:()=>({items:[['m_alloy',2],['c_potion',1]],gold:3,xp:4}),onMobReward:()=>callbacks++});
 const p=f.join(id,store.public(id),'namsan'),e=f.ecologies.get(p.zone),m=[...e.mobs.values()][0];p.x=m.x;p.z=m.z;
 const before=store.get(id);f.mobStates.get(m.id).hp=1;store.bossLoot=()=>{throw Error('bossLoot must not be called');};
 const r=f.hitMob(id,{mob:m.id,xp:1e9,items:[['m_alloy',999]]},store.public(id),10000);const after=store.get(id);
 assert.equal(r.reward.status,'granted');assert.deepEqual(r.reward.items,[{id:'m_alloy',n:2},{id:'c_potion',n:1}]);assert.equal(after.xp-before.xp,4);assert.equal(after.gold-before.gold,3);
 assert.equal(after.items.m_alloy-(before.items.m_alloy||0),2);assert.equal(callbacks,1);
 f.hitMob(id,{mob:m.id},store.public(id),11000);assert.equal(store.get(id).xp,after.xp);assert.equal(callbacks,1);
 store.close();const no=setup();no.f.mobStates.get(no.m.id).hp=1;
 assert.deepEqual(no.f.hitMob('a',{mob:no.m.id},no.profile,10000).reward,{status:'pending_policy'});
});
test('pure decision layer runs identically in browser CJS evaluator and rejects builtins',()=>{
 const source=fs.readFileSync(require.resolve('../server/field-mob-combat.cjs'),'utf8'),module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,require:()=>{throw Error('no browser builtin');}});
 const browser=module.exports;assert.deepEqual(JSON.parse(JSON.stringify(browser.statsFor('G5_HOOKHAND'))),MOB.statsFor('G5_HOOKHAND'));
 const run=api=>{const m={alive:true,x:0,z:0,id:'mob',group:{area:{}}},a=api.reset(m,0),s=api.statsFor('G5_WALKER'),p={id:'a',x:1,z:0,dead:false};
  const nav={legal:()=>true,safe:()=>false,canTraverse:()=>true,route:()=>null};const out=[];
  for(let now=50;now<=4000;now+=50){const h=api.tick(m,a,s,[p],now,nav);out.push([m.x,m.z,m.anim,h]);}return JSON.parse(JSON.stringify(out));};
 assert.deepEqual(run(browser),run(MOB));assert.ok(run(MOB).some(r=>r[3]));
});
test('pure AI cannot strike through a wall or sanctuary, telegraph locks target and disconnected targets do not hit',()=>{
 const m={alive:true,x:0,z:0,id:'mob',group:{area:{}}},a=MOB.reset(m,0),s=MOB.statsFor('G5_WALKER'),p={id:'a',x:1,z:0};
 const nav={legal:()=>true,safe:()=>false,canTraverse:()=>false,route:()=>null};
 assert.equal(MOB.tick(m,a,s,[p],50,nav),null);assert.notEqual(m.anim,'attack');
 nav.canTraverse=()=>true;MOB.tick(m,a,s,[p],100,nav);nav.safe=()=>true;
 assert.equal(MOB.tick(m,a,s,[p],700,nav),null);assert.equal(a.target,null);
 nav.safe=()=>false;MOB.tick(m,a,s,[p],750,nav);assert.equal(MOB.tick(m,a,s,[],1400,nav),null);
});
test('all actual hunt maps instantiate through Field with unchanged anchors (45 hunts, 180 patrol edges)',()=>{
 const f=new Field({clock:()=>10000,rng:seed(7)});let areas=0;
 for(const zid of fs.readdirSync(require('node:path').resolve(__dirname,'../maps/2d'))){const z=f.zone(zid);if(!z?.map.areas?.some(a=>a.kind==='hunt'&&a.pool))continue;
  const e=f.ecology(zid);assert.deepEqual(e.anchorAdjustments,[],zid);areas+=e.areas.length;
  assert.ok([...e.mobs.values()].every(m=>e.legal(m.group.area,[m.x,m.z])),zid);}
 assert.equal(areas,45);assert.equal(areas*4,180);
});
test('negative control: removing the range check must be caught by the range assertion',()=>{
 const source=fs.readFileSync(require.resolve('../server/field.cjs'),'utf8'),bad=source.replace('Math.hypot(p.x-m.x,p.z-m.z)>3','false');assert.notEqual(bad,source);
 const module={exports:{}};const local=require('node:module').createRequire(require.resolve('../server/field.cjs'));
 vm.runInNewContext(bad,{module,exports:module.exports,require:local,__dirname:require('node:path').resolve(__dirname,'../server'),process,Date,Math,Map,Set,structuredClone});
 const {f,p,m,profile}=setup();p.x=m.x+4;
 const good=f.hitMob('a',{mob:m.id},profile,10000);assert.equal(good,null);
 const vulnerable=module.exports.Field.prototype.hitMob.call(f,'a',{mob:m.id},profile,10000);
 assert.throws(()=>assert.equal(vulnerable,null),assert.AssertionError,'broken range control must not pass');
});
test('patrol bake uses exact LF map/rule hashes; all hunt routes are prepared outside the 20Hz tick',()=>{
 const crypto=require('node:crypto'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const cache=require('../server/field-ecology-patrols.json');
 const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
 for(const [f,d]of Object.entries(cache.rules))assert.equal(hash(f),d,f);
 const f=new Field({clock:()=>10000,rng:seed(7)});let hunts=0;
 for(const [id,row]of Object.entries(cache.zones)){
  assert.equal(hash('maps/2d/'+id+'/map.json'),row.hash,id);const e=f.ecology(id);assert.equal(e.patrolCacheValid,true);
  for(const g of e.groups.filter(g=>g.kind==='patrol')){hunts++;assert.equal(g.routes.size,4);assert.ok([...g.routes.values()].every(Boolean),id);}
 }
 assert.equal(hunts,45);
 const {f:one,e}=setup();e.route=()=>{throw Error('expensive route in live patrol tick');};
 one.tickBosses(10050);assert.equal(e.patrolCacheValid,true);
});
test('mob combat numbers are marked draft outside N01, and exact N01 stats are not silently rescaled',()=>{
 const {STATS}=require('../tools/ue/node-combat-rules.cjs');
 const roles={G5_WALKER:'normal',G5_RUNNER:'runner',G5_BREAKER:'breaker',G5_STALKER:'stalker',G5_ARMORED:'armored_elite',G5_RESONATOR:'resonator'};
 for(const [id,role]of Object.entries(roles)){const s=MOB.statsFor(id),r=STATS[role];assert.equal(s.hp,r.health);assert.equal(s.damage,r.damage);assert.equal(s.speed,r.speed/100);assert.equal(s.draft,false);}
 assert.equal(MOB.statsFor('G5_HOOKHAND').draft,true);assert.equal(MOB.statsFor('G3_BLACKBLADE').draft,true);
 assert.throws(()=>MOB.validateStats({...MOB.statsFor('G5_WALKER'),damage:Infinity}),/Invalid/);
});
test('transient reward store failure retries the same award once, never rerolls or rewards the next generation',()=>{
 const store=new Store(null),g=store.guest('재시도');store.chooseName(g.profile.id,'재시도','ain');const id=g.profile.id;
 let rolls=0,notices=0;const f=new Field({store,clock:()=>10000,rng:()=>.5,
  mobRewards:()=>{rolls++;return {xp:5};},onMobReward:()=>notices++});
 const p=f.join(id,store.public(id),'namsan'),e=f.ecologies.get(p.zone),m=[...e.mobs.values()][0];p.x=m.x;p.z=m.z;
 const state=f.mobStates.get(m.id);state.hp=1;const xp=store.get(id).xp,mutate=store.mutate.bind(store);let fail=true;
 store.mutate=(...a)=>{if(fail)throw Error('test locked db');return mutate(...a);};
 const r=f.hitMob(id,{mob:m.id},store.public(id),10000);assert.equal(r.reward.status,'pending_storage');assert.equal(f.pendingMobRewards.size,1);
 fail=false;f.tickEcologies(11000);assert.equal(store.get(id).xp,xp+5);assert.equal(rolls,1);assert.equal(notices,1);assert.equal(f.pendingMobRewards.size,0);
 f.tickEcologies(12000);assert.equal(store.get(id).xp,xp+5);store.close();
});
test('guild hub ownership reloads prepared paths; client messages cannot set night or invasion',()=>{
 const f=new Field({clock:()=>10000,rng:()=>.5}),p=f.join('a',{name:'検',stats:{hp:20000}},'busan');
 const e=f.ecologies.get('busan');assert.equal(e.owner.kind,'boss');f.setHub('busan',{kind:'guild',name:'검수'});f.tickEcologies(10050);
 assert.equal(e.owner.kind,'guild');assert.equal(e.patrolCacheValid,true);assert.ok([...e.groups.filter(g=>g.kind==='patrol')].every(g=>g.routes.size===4));
 f.command('a',{type:'fieldMove',x:p.x,z:p.z,night:true,invasion:true}, {name:'検'},false);f.tickEcologies(10100);
 assert.equal(e.night,false);assert.equal(e.invasion,false);
 f.setEcologyContext('busan',{night:true,invasion:true});f.tickEcologies(10150);assert.equal(e.night,true);assert.equal(e.invasion,true);
 f.setHub('busan',null);f.tickEcologies(10200);assert.equal(e.owner.kind,'boss');
});
test('negative wire control: substituting HP for alive loses seq in current decoder and fails the v2 contract',async()=>{
 const source=fs.readFileSync(require.resolve('../server/field.cjs'),'utf8');
 const bad=source.replace('m.z,m.alive,m.anim,m.generation,','m.z,m.alive?100:0,m.anim,m.generation,');assert.notEqual(bad,source);
 const module={exports:{}},local=require('node:module').createRequire(require.resolve('../server/field.cjs'));
 vm.runInNewContext(bad,{module,exports:module.exports,require:local,__dirname:require('node:path').resolve(__dirname,'../server'),process,Date,Math,Map,Set,structuredClone});
 const {f,p,m}=setup(),good=f.mobView(p,10000).find(r=>r[0]===m.id);
 const {mobsFromPacket}=await import('../js/mmo/field-mobs.js');
 assert.equal(good.length,9);assert.equal(good[4],true);assert.equal(good[7],100);assert.equal(good[8],0);
 assert.equal(mobsFromPacket([good])[0].alive,true);assert.equal(mobsFromPacket([good])[0].seq,0);
 const wrong=module.exports.Field.prototype.mobView.call(f,p,10000).find(r=>r[0]===m.id);
 assert.throws(()=>assert.equal(typeof wrong[4],'boolean'),assert.AssertionError,'alive/HP mutation must not pass');
 assert.throws(()=>assert.equal(mobsFromPacket([wrong])[0].seq,0),assert.AssertionError,'mutated packet loses the action sequence');
});
test('online action sequence changes at telegraph start and repeated hit; each windup lasts exactly 600ms',async()=>{
 const {f,p,e,m,profile}=setup(),s=f.mobStates.get(m.id);
 for(const n of e.mobs.values())if(n!==m)e.defeat(n.id,10000);
 const {mobsFromPacket}=await import('../js/mmo/field-mobs.js');
 const view=now=>mobsFromPacket(f.mobView(p,now)).find(v=>v.id===m.id);
 f.tickBosses(10050);let start=view(10050);assert.equal(start.anim,'attack');assert.equal(start.seq,1);assert.equal(p.hurt,null);
 f.tickBosses(10649);assert.equal(p.hurt,null,'no hit at 599ms');assert.equal(view(10649).seq,start.seq);
 f.tickBosses(10650);assert.equal(p.hurt[2],m.id);assert.equal(p.hurt[6],10650);assert.equal(view(10650).seq,start.seq);
 f.tickBosses(10650+s.stats.cooldownMs);const second=view(10650+s.stats.cooldownMs);
 assert.equal(second.anim,'attack');assert.ok(second.seq>start.seq,'attack → attack snapshots restart the current renderer');
 f.hitMob('a',{mob:m.id,generation:m.generation},profile,12100);const hit=view(12100);assert.equal(hit.anim,'hit');assert.ok(hit.seq>second.seq);
 f.hitMob('a',{mob:m.id,generation:m.generation},profile,12500);assert.equal(view(12500).anim,'hit');assert.ok(view(12500).seq>hit.seq);
});
test('server melee reach includes the client 2.8m nearest selection, but still rejects beyond 3m',()=>{
 const {f,p,m,profile}=setup();p.x=m.x+2.8;p.z=m.z;
 assert.ok(f.hitMob('a',{mob:m.id,generation:m.generation},profile,10000)?.dmg>0);
 p.x=m.x+3.01;assert.equal(f.hitMob('a',{mob:m.id,generation:m.generation},profile,11000),null);
});
