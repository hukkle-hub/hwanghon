const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Q=require('../js/combat-quality.js'),C=require('../server/content.cjs'),{createBattle}=require('../js/combat.js'),{Raid}=require('../server/raid.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function solo(hooks={}){const rules=clone(C.rules);rules.bleed.chance=0;return createBattle({rules,char:{...C.character,stats:{...C.character.stats,aspd:100,crit:0}},dummy:{...clone(C.arenas.tutorial.stages[0]),patterns:[]},skills:C.skills.ain,ult:C.skills.ainUlt,hooks});}
function raid(){const r=new Raid('d01',[{id:'a',name:'검수',character:'ain'}]);r.startFight();r.boss.timer=100;const p=r.players.get('a');p.x=r.boss.x-100;p.y=r.boss.y;p.target='body';p.stats.aspd=100;return {r,p};}
function tick(r,s){for(let i=0;i<Math.round(s*100);i++)r.tick(.01);}
function contact(clip='attack1',overrides={}){return Q.contact({player:{x:0,y:0,aim:0},boss:{x:70,y:0,aim:Math.PI,scale:1},part:{id:'body'},parts3d:{body:{off:[0,0,0],r:.2}},action:{clip},reach:150,cone:1.05,character:'ain',...overrides});}

test('contact rejects distant, rear, missing and wall-obscured targets',()=>{
 assert.ok(contact());assert.equal(contact('attack1',{part:null}),null);
 assert.equal(contact('attack1',{boss:{x:500,y:0}}),null);
 assert.equal(contact('attack1',{boss:{x:-120,y:0}}),null);
 assert.equal(contact('attack1',{lineOfSight:()=>false}),null);
});
test('precise hook and wide sweep have different spatial jobs without extra range',()=>{
 const boss={x:36,y:36*.55,aim:0},parts3d={body:{off:[0,0,0],r:.02}};
 assert.equal(contact('skill1',{boss,parts3d}),null);assert.ok(contact('skill3',{boss,parts3d}));
 assert.equal(contact('skill3',{boss:{x:180,y:0},parts3d}),null);
});
test('browser and authoritative server use identical geometry, including large boss rear parts',()=>{
 const ctx={};vm.createContext(ctx);for(const file of ['boss-contact-volumes','combat-quality'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),ctx);
 for(const A of Object.values(C.arenas))for(const part of A.stages[0].parts){
  const boss={x:1000,y:900,aim:1.2,arena:A.id,scale:(A.bossScale||1.22)*(A.scale||1)};
  const center=Q.partCenter(boss,part,A.parts3d),o={player:{x:center.x-70,y:center.y,aim:0},boss,part,parts3d:A.parts3d,action:{clip:'attack1'},reach:150,cone:1.05,character:'ain'};
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.TW_COMBAT_QUALITY.contact(o))),Q.contact(o));assert.ok(Q.contact(o),A.id+':'+part.id);
 }
});
test('AoE checks every part and does not redistribute unreachable damage',()=>{
 const parts=[{id:'near',hp:1e7,breakable:true},{id:'far',hp:1e7,breakable:true}];
 const b=createBattle({rules:C.rules,char:C.character,skills:C.skills.ain,dummy:{hp:1e7,parts,patterns:[]},hooks:{canHit:id=>id==='near'}});
 b.input('skill',2);tick(b,1);assert.equal(b.metrics.hits,1);assert.equal(b.part('far').hp,1e7);assert.ok(b.part('near').hp<1e7);
});
test('dodge, guard and evasive skill buffer to cancel boundary in both simulations',()=>{
 for(const type of ['dodge','guard','skill']){
  const b=solo();b.input('attack');tick(b,.47);b.input(type,type==='guard'?true:type==='skill'?1:undefined);assert.ok(b.snapshot().player.action);
  tick(b,.08);assert.equal(b.snapshot().player.action,null);assert.ok(type==='guard'?b.snapshot().player.guard:b.snapshot().player.dodging);
  const {r,p}=raid();r.input('a',{type:'attack'});tick(r,.40);r.input('a',{type,on:true,index:1});assert.ok(p.action);tick(r,.09);assert.equal(p.action,null);assert.ok(type==='guard'?p.guard:p.dodgeT>0);
 }
});
test('released guard and early dodge never become delayed phantom inputs',()=>{
 const b=solo();b.input('attack');b.input('dodge');assert.equal(b.snapshot().player.buffer,null);tick(b,.47);b.input('guard',true);b.input('guard',false);tick(b,.4);assert.equal(b.snapshot().player.guard,false);
 const {r,p}=raid();r.input('a',{type:'attack'});tick(r,.4);r.input('a',{type:'guard',on:true});r.input('a',{type:'guard',on:false});tick(r,.4);assert.equal(p.guard,false);
});
test('counter follow-up appears only after contact and is consumed once',()=>{
 const {r,p}=raid();r.boss.state='telegraph';r.boss.tele=.03;r.boss.pattern={name:'test',counterable:true};r.boss.zone={kind:'circle',x:r.boss.x,y:r.boss.y,r:200};
 r.input('a',{type:'attack'});assert.equal(p.riposteT,0);tick(r,.18);assert.equal(p.riposteKind,'counter');assert.ok(p.riposteT>0);
 tick(r,.40);r.input('a',{type:'attack'});assert.equal(p.riposteT,0);assert.equal(p.action.opt.followup,true);
});
test('heavy windup is slower initially but contact and recovery endpoints stay exact',()=>{
 for(const clip of ['skill1','skill3','ult','smash']){const a={clip,hitAt:.6,duration:1.3,elapsed:.3};assert.ok(Q.phase(a)<.21);a.elapsed=.6;assert.equal(Q.phase(a),.42);a.elapsed=1.3;assert.equal(Q.phase(a),1);}
});
test('normal contact effects are smaller and shorter than counter accents',()=>{
 const a=Q.feedback({kind:'attack'}),b=Q.feedback({kind:'counter',perfect:true});assert.ok(a.size<b.size/2);assert.ok(a.duration<b.duration);assert.ok(b.size<1.2);
 assert.notEqual(Q.feedback({material:'metal'}).color,Q.feedback({material:'straw'}).color);
});
test('baked broad-phase centres still match every delivered boss model',()=>{
 const output=require('node:child_process').execFileSync(process.execPath,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','tools/bake-boss-contact-volumes.mjs'],{encoding:'utf8'});
 assert.deepEqual(JSON.parse(output),require('../js/boss-contact-volumes.js'));
});
