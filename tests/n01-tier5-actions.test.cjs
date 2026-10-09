const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../server/field-mob-combat.cjs'),R=require('../tools/ue/node-combat-rules.cjs');
const ids=['G5_WALKER','G5_RUNNER','G5_BREAKER','G5_STALKER','G5_ARMORED','G5_RESONATOR'];
test('N01 role HP/damage/speed/facility damage exactly retain existing rule vectors',()=>{
 for(let i=0;i<ids.length;i++){const s=M.statsFor(ids[i]),r=R.roleStats(R.ROLES[i]);assert.equal(s.hp,r.health);assert.equal(s.damage,r.damage);assert.equal(s.speed,r.speed/100);assert.equal(s.facilityDamage,r.facilityDamage);assert.equal(s.cooldownMs,r.attackCooldown*1000);}
});
test('armored attack cycle and counter rules match design 203',()=>{
 for(let i=0;i<8;i++){const a=M.actionFor('G5_ARMORED',i);assert.equal(a.key,R.armoredAttackAt(i));assert.equal(a.windupMs,R.armoredWindupSeconds(a.key)*1000);assert.equal(a.counterAllowed,R.counterAllowed(a.key));}
 const a={action:M.actionFor('G5_ARMORED',1),seq:0};assert.ok(M.counter(a,'perfect',100));assert.equal(a.crackedUntil,9100);assert.equal(a.hitUntil,3250);assert.equal(M.damageScale('G5_ARMORED',a,9099),1);assert.equal(M.damageScale('G5_ARMORED',a,9100),.25);
 const b={action:M.actionFor('G5_ARMORED',3),seq:0};assert.equal(M.counter(b,'perfect',100),false);assert.equal(b.crackedUntil,undefined);
});
test('six objective policies agree with existing N01 rules over all missing/present target combinations',()=>{
 for(let bits=0;bits<128;bits++){const keys=['player','gate','generator','comms','npc','ally'],v=Object.fromEntries(keys.map((k,n)=>[k,bits&(1<<n)?(n===0?2:20):-1]));v.flanked=!!(bits&64);
  for(let i=0;i<ids.length;i++){const cm=Object.fromEntries(Object.entries(v).map(([k,n])=>[k,k==='flanked'?n:n<0?n:n*100]));assert.equal(M.objectiveFor(ids[i],v),R.chooseTarget(R.ROLES[i],cm),ids[i]+' '+bits);}
 }
 assert.ok(M.npcScore('G5_STALKER','technician',26)>M.npcScore('G5_STALKER','guard',12));
});
test('resonance is capped at one, excludes resonators, clears immediately on emitter death',()=>{
 const mobs=new Map([['w',{id:'w',alive:true,catalogId:'G5_WALKER',x:0,z:0,generation:1}],['a',{id:'a',alive:true,catalogId:'G5_RESONATOR',x:1,z:0,generation:1}],['b',{id:'b',alive:true,catalogId:'G5_RESONATOR',x:2,z:0,generation:1}]]),states=new Map([...mobs].map(([id,m])=>[id,{ai:M.reset(m,0)}])),cache={};
 M.refreshResonance(mobs,states,0,cache);assert.equal(states.get('w').ai.resonanceMove,1.1);assert.equal(states.get('w').ai.resonanceAttack,1.12);assert.equal(states.get('a').ai.resonanceAttack,1);
 mobs.get('a').alive=false;M.refreshResonance(mobs,states,50,cache);assert.equal(states.get('w').ai.resonanceAttack,1.12);
 mobs.get('b').alive=false;M.refreshResonance(mobs,states,100,cache);assert.equal(states.get('w').ai.resonanceAttack,1);
});
test('telegraph begins before damage, each named armored attack uses its actual windup',()=>{
 const m={id:'mob',catalogId:'G5_ARMORED',x:0,z:0,alive:true,group:{area:{}}},a=M.reset(m,0),s=M.statsFor(m.catalogId),p={id:'p',x:1,z:0,dead:false},nav={safe:()=>false,legal:()=>true,canTraverse:()=>true,route:()=>null};
 let now=0;
 for(let i=0;i<4;i++){const spec=M.actionFor(m.catalogId,i);assert.equal(M.tick(m,a,s,[p],now,nav),null);assert.equal(m.anim,'attack');assert.equal(a.action.key,spec.key);assert.equal(a.action.damageAt,now+spec.windupMs);assert.equal(M.tick(m,a,s,[p],now+spec.windupMs-1,nav),null);
  const hit=M.tick(m,a,s,[p],now+spec.windupMs,nav);assert.equal(hit.skill,spec.key);assert.equal(hit.damage,s.damage);now+=spec.windupMs+s.cooldownMs;
 }
});
test('pure module runs without node builtins; deliberate bad windup and buff mutations are detected',()=>{
 const src=fs.readFileSync(require.resolve('../server/field-mob-combat.cjs'),'utf8');
 function load(code){const box={module:{exports:{}},exports:{}};vm.runInNewContext(code,box);return box.module.exports;}
 assert.equal(load(src).actionFor('G5_ARMORED',3).windupMs,1200);
 const bad=load(src.replace("key==='overhead_crush'?1200","key==='overhead_crush'?600"));assert.throws(()=>assert.equal(bad.actionFor('G5_ARMORED',3).windupMs,1200));
 const buff=load(src.replace('buff?1.12:1','buff?1.24:1'));const mobs=new Map([['w',{id:'w',alive:true,catalogId:'G5_WALKER',x:0,z:0}],['r',{id:'r',alive:true,catalogId:'G5_RESONATOR',x:1,z:0}]]),states=new Map([...mobs].map(([id])=>[id,{ai:{}}]));buff.refreshResonance(mobs,states,0);assert.throws(()=>assert.equal(states.get('w').ai.resonanceAttack,1.12));
});
