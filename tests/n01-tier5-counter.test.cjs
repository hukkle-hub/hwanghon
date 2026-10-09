const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../server/field-mob-combat.cjs'),N=require('../server/node-rules.cjs'),{Field,HIT_GAP}=require('../server/field.cjs');
const nav={safe:()=>false,legal:()=>true,canTraverse:()=>true,route:()=>null};
test('armored counter grade matches existing node-rules across boundary times and rejects overhead/non-armor',()=>{
 for(const dt of [-1,0,99,100,101,249,250,251,800]){const m={catalogId:'G5_ARMORED'},a={phase:'windup',until:1000,action:M.actionFor(m.catalogId,1),seq:0};assert.equal(M.tryCounter(m,a,1000-dt),N.gradeCounter(dt/1000)==='none'?null:N.gradeCounter(dt/1000));}
 for(const id of ['G5_WALKER','G5_RUNNER','G5_BREAKER','G5_STALKER','G5_RESONATOR'])assert.equal(M.tryCounter({catalogId:id},{phase:'windup',until:1000,action:M.actionFor(id)},950),null);
 assert.equal(M.tryCounter({catalogId:'G5_ARMORED'},{phase:'windup',until:1000,action:M.actionFor('G5_ARMORED',3)},950),null);
});
test('real Field timed hit cracks armor without accepting forged grade; ordinary hits do not cancel armor action',()=>{
 let now=10000;const f=new Field({clock:()=>now,rng:()=>.5}),profile={id:'a',character:'ain',name:'검수',stats:{hp:20000,atk:1000},equipment:{}},p=f.join('a',profile,'namsan'),e=f.ecologies.get('namsan'),m=[...e.mobs.values()].find(m=>m.group.kind==='nest'),s=f.mobStates.get(m.id);m.catalogId='G5_ARMORED';s.stats=M.statsFor(m.catalogId);s.hp=s.max=s.stats.hp;s.ai=M.reset(m,now);p.x=m.x;p.z=m.z;p.invulnUntil=0;
 M.tick(m,s.ai,s.stats,[{id:'a',x:m.x,z:m.z}],now,nav);assert.equal(s.ai.phase,'windup');
 const early=f.hitMob('a',{mob:m.id,counter:'perfect'},profile,now);assert.equal(early.counter,undefined);assert.equal(early.dmg,250);assert.equal(s.ai.phase,'windup');
 now+=710;const perfect=f.hitMob('a',{mob:m.id},profile,now);assert.equal(perfect.counter,'perfect');assert.equal(perfect.dmg,1000);assert.equal(s.ai.crackedUntil,now+6000);assert.equal(s.ai.hitUntil,now+1400);assert.equal(m.anim,'hit');
 assert.equal(f.hitMob('a',{mob:m.id},profile,now+HIT_GAP-1),null);assert.equal(M.tick(m,s.ai,s.stats,[{id:'a',x:m.x,z:m.z}],now+100,nav),null);assert.equal(m.anim,'hit');
});
