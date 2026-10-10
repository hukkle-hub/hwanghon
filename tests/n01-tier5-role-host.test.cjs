const test=require('node:test'),assert=require('node:assert/strict'),M=require('../server/field-mob-combat.cjs');
const nav={legal:()=>true,safe:()=>false,canTraverse:()=>true,route:()=>null};
const mob=(id)=>({id:'m',catalogId:id,x:0,z:0,alive:true,group:{area:{}}});
test('actual goal: Breaker ignores nearer gate and strikes generator with facility damage',()=>{
 const m=mob('G5_BREAKER'),a=M.reset(m,0),s=M.statsFor(m.catalogId),ctx={facilities:[{id:'gate',kind:'gate',x:.5,z:0},{id:'gen',kind:'generator',x:.88,z:0},{id:'comms',kind:'comms',x:1.5,z:0}]};
 M.tick(m,a,s,[],0,nav,ctx);assert.equal(a.target,'gen');assert.equal(a.action.key,'structure_slam');
 const hit=M.tick(m,a,s,[],900,nav,ctx);assert.equal(hit.target,'gen');assert.equal(hit.targetKind,'generator');assert.equal(hit.damage,900);
 ctx.facilities[1].alive=false;M.tick(m,a,s,[],2500,nav,ctx);assert.equal(a.target,'comms');
});
test('Runner and Stalker physically visit legal flank point before choosing exposed NPC',()=>{
 for(const id of ['G5_RUNNER','G5_STALKER']){const m=mob(id),a=M.reset(m,0),s=M.statsFor(id),ctx={flankPoints:[{id:'flank',x:1,z:0}],npcs:[{id:'guard',role:'guard',x:1.1,z:0},{id:'tech',role:'technician',x:2,z:0}]};
  for(let now=0;now<=1000;now+=50)M.tick(m,a,s,[],now,nav,ctx);
  assert.ok(a.flanked);assert.equal(a.target,id==='G5_STALKER'?'tech':'guard');
 }
});
test('Armored chooses standing gate; Resonator holds 3.5m behind pack until threatened',()=>{
 const m=mob('G5_ARMORED'),a=M.reset(m,0);M.tick(m,a,M.statsFor(m.catalogId),[],0,nav,{facilities:[{id:'gate',kind:'gate',x:1,z:0}]});assert.equal(a.target,'gate');
 const r=mob('G5_RESONATOR'),b=M.reset(r,0),ctx={allies:[{id:'ally',catalogId:'G5_WALKER',alive:true,x:8,z:0}]};
 const hold=M.roleGoal(r,b,[],ctx,nav);assert.equal(hold.kind,'hold');assert.equal(hold.x,4.5);
 M.tick(r,b,M.statsFor(r.catalogId),[],100,nav,ctx);assert.ok(r.x>0);assert.equal(r.anim,'walk');
 const p={id:'p',x:1,z:0};M.tick(r,b,M.statsFor(r.catalogId),[p],150,nav,ctx);assert.equal(b.target,'p');assert.equal(b.action.key,'self_defence');
});
test('host context never bypasses terrain or safety, and non-armored attacks cannot crack armor',()=>{
 const m=mob('G5_BREAKER'),a=M.reset(m,0),blocked={...nav,legal:()=>false};M.tick(m,a,M.statsFor(m.catalogId),[],100,blocked,{facilities:[{id:'gen',kind:'generator',x:1,z:0}]});assert.equal(a.target,null);assert.equal(m.x,0);
 assert.equal(M.counter({action:M.actionFor('G5_WALKER'),seq:0},'perfect',0),false);
 const w=mob('G5_WALKER'),b=M.reset(w,0);M.tick(w,b,M.statsFor(w.catalogId),[{id:'far',x:15,z:0}],100,nav,{allies:[]});assert.equal(b.target,null);
});

test('support and flank movement cannot erase the actual hit reaction',()=>{
 for(const id of ['G5_RESONATOR','G5_RUNNER','G5_STALKER']){
  const m=mob(id),a=M.reset(m,0),s=M.statsFor(id),ctx=id==='G5_RESONATOR'?{allies:[{id:'w',catalogId:'G5_WALKER',alive:true,x:3.5,z:0}]}:{flankPoints:[{id:'f',x:2,z:0}],npcs:[{id:'n',x:4,z:0}]};
  M.stagger(a,0);M.tick(m,a,s,[],50,nav,ctx);assert.equal(m.anim,'hit');assert.equal(m.x,0);
  M.tick(m,a,s,[],180,nav,ctx);assert.notEqual(m.anim,'hit');
 }
});
