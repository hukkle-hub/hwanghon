import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import KIT from '../server/field-boss-kit.cjs';
import contact from '../server/field-surface-contact.cjs';
import {Field} from '../server/field.cjs';
import {loadCjs} from '../js/mmo/cjs-browser.js';
const profile=JSON.parse(fs.readFileSync(new URL('../art/review/part1/leviathan-gill-contact.json',import.meta.url)));
const skill=KIT.KITS.leviathan.skills.gill;
function setup({kit=KIT,opt=true,x=17,z=-11,yaw=1.7}={}){
 const f=new Field({rng:()=>.5}),events=[],o={id:'leviathan',zone:'review',x,z,yaw,hp:10000,max:10000,alive:true};
 f.bosses=new Map([[o.id,o]]);f.clamp=()=>{};
 kit.setup(o,0);if(opt)assert.equal(kit.configureGillReview(o,profile),true);
 const cones=contact.bindSurfaceContactProfile(profile).contacts(skill,skill.hits[0],x,z);
 const add=(id,d,{side=0,...extra}={})=>{const c=cones[side],p={id,zone:o.zone,x:c.origin.x+Math.sin(c.yaw)*d,z:c.origin.z+Math.cos(c.yaw)*d,hp:1000,maxHp:1000,defense:0,dead:false,hurtSeq:0,invulnUntil:0,dodgeUntil:0,...extra};f.players.set(id,p);return p};
 const p=add('near',1),far=add('far',5),dodge=add('dodge',3,{dodgeUntil:1000+1890}),edge=add('edge',6.99),other=add('other-zone',1,{zone:'elsewhere'});
 f.bossStrike=(b,p,h,t)=>{const result=Field.prototype.bossStrike.call(f,b,p,h,t);events.push({id:p.id,at:t,evade:!!result?.evade});return result};
 const start=(at=1000)=>{o.kit.state='idle';o.kit.endsAt=at;o.kit.target=p.id;o.kit.pattern='gill';kit.tick(f,o,at);assert.equal(o.kit.state,'skill');assert.equal(o.kit.skill,'gill')};
 const run=(from=1000,to=3600,step=50)=>{for(let t=from;t<=to;t+=step)kit.tick(f,o,t)};
 return{f,o,p,far,dodge,edge,other,events,add,start,run,kit};
}
test('real KIT lifecycle selects surface gill, real Field damage once, no root cone or packet HP',()=>{
 const a=setup();assert.ok(KIT.skillWeights(a.o,a.far).gill>0,'surface reach beyond root7m must be selectable');
 const root={id:'root',zone:a.o.zone,x:a.o.x,z:a.o.z+1,hp:1000,maxHp:1000,defense:0,dead:false,hurtSeq:0};a.f.players.set(root.id,root);
 a.start();a.run();
 assert.deepEqual(a.events,[{id:'near',at:2800,evade:false},{id:'dodge',at:2800,evade:true},{id:'far',at:2850,evade:false},{id:'edge',at:2950,evade:false}]);
 assert.equal(a.p.hp,800);assert.equal(a.far.hp,800);assert.equal(a.dodge.hp,1000);assert.equal(a.other.hp,1000);assert.equal(root.hp,1000);
 assert.equal(a.p.hurt[2],'leviathan');assert.equal(a.p.hurt[3],'gill');assert.equal(a.p.hurtSeq,1);
 const v=KIT.view(a.o);assert.equal(v.contactMode,'gill-surface-review-v1');for(const k of ['hp','max','phase','surfaces'])assert.equal(k in v,false);
});
test('explicit opt-in only; malformed/wrong boss/mid-cast changes rejected; baseline negative control remains different',()=>{
 assert.equal(KIT.configureGillReview(null,profile),false);
 const a=setup({opt:false});assert.equal(KIT.configureGillReview(a.o,{...profile,reviewOnly:false}),false);
 assert.equal(KIT.configureGillReview({...a.o,id:'aegis'},profile),false);
 assert.equal(KIT.view(a.o).contactMode,undefined);a.start();a.run();
 assert.throws(()=>assert.ok(a.events.some(e=>e.id==='near'&&e.at===2800)),'old instantaneous rootcone is not the surface candidate');
 const b=setup();b.start();assert.equal(KIT.configureGillReview(b.o,null),false);assert.equal(KIT.configureGillReview(b.o,profile),false);
 b.run();KIT.reset(b.o,5000);assert.equal(KIT.configureGillReview(b.o,null),true);assert.equal(KIT.view(b.o).contactMode,undefined);
});
test('counter, death, reset, duplicate/backward ticks and next cast do not reuse a ledger',()=>{
 const a=setup();a.start();a.run(1000,2450);assert.equal(KIT.tryCounter(a.o,2450),true);a.run(2500,3300);assert.equal(a.events.length,0);
 const b=setup();b.start();b.run(1000,2800);assert.equal(b.events.length,2);KIT.tick(b.f,b.o,2800);KIT.tick(b.f,b.o,2700);assert.equal(b.events.length,2);
 b.o.alive=false;KIT.tick(b.f,b.o,2820);b.o.alive=true;b.run(2850,3300);assert.equal(b.events.length,2,'cannot resume a dead cast');
 KIT.reset(b.o,5000);Object.assign(b.p,{x:17,z:-1,hp:1000});b.start(5700);b.run(5700,9000);assert.ok(b.events.length>2,'new lifecycle gets fresh cast');
});
test('endpoint guard survives expiry before processing, newcomers/fade and large missed window cannot back-hit',()=>{
 for(const key of ['dodgeUntil','invulnUntil']){
  const a=setup();a.edge[key]=2930;a.start();a.run();assert.equal(a.edge.hp,1000,'protected at2920 but expired by2950');
  assert.ok(!a.events.some(e=>e.id==='edge'),'conservative skipped endpoint does not invent an evade packet');
 }
 const b=setup();b.start();b.run(1000,2900);const late=b.add('late',1);b.run(2950,3600);assert.equal(late.hp,1000);
 const c=setup();c.start();c.run(1000,2600);c.run(3200,3600);assert.equal(c.events.length,0,'missed entire wave is not replayed');
 const d=setup();d.start();d.run(1000,2900);const before=d.events.length;KIT.tick(d.f,d.o,10000);assert.equal(d.events.length,before,'do not deliver pending edge after whole skill expired');assert.equal(d.o.kit.state,'idle');
});
test('translated body and arbitrary aim yaw do not rotate the fixed gill surfaces',()=>{
 const runs=[];for(const [x,z,yaw] of [[0,0,0],[17,-11,2.9],[-80,40,-2]]){const a=setup({x,z,yaw});a.start();a.o.yaw=yaw;a.run();runs.push(a.events)}
 assert.deepEqual(runs[1],runs[0]);assert.deepEqual(runs[2],runs[0]);
});
test('Field.tickBosses reaches review KIT, AI chooses gill without forced pattern, reset/disconnect cannot resume old damage',()=>{
 const a=setup();a.o.kit.target=a.p.id;a.o.kit.endsAt=1000;
 a.f.tickBosses(1000);assert.equal(a.o.kit.skill,'gill','real AI selects reachable surface target');
 for(let t=1050;t<=2900;t+=50)a.f.tickBosses(t);
 assert.equal(a.p.hp,800);assert.equal(a.dodge.hp,1000);
 a.f.players.delete(a.edge.id);a.f.tickBosses(2950);assert.ok(!a.events.some(e=>e.id==='edge'));
 const b=setup();b.start();b.run(1000,2700);KIT.reset(b.o,2750);
 b.o.kit.endsAt=10000;b.run(2800,3600);assert.equal(b.events.length,0);
 const c=setup();c.start();c.edge.dead=true;c.run();assert.ok(!c.events.some(e=>e.id==='edge'));
});
test('browser loadCjs executes same candidate KIT and real strike results as Node',async()=>{
 const oldFetch=globalThis.fetch,oldLocation=globalThis.location;
 try{
  globalThis.location={href:import.meta.url};globalThis.fetch=async url=>({ok:true,text:async()=>fs.readFileSync(new URL(url),'utf8')});
  const browserKit=await loadCjs(new URL('../server/field-boss-kit.cjs',import.meta.url).href);
  const a=setup(),b=setup({kit:browserKit});a.start();b.start();a.run();b.run();
  assert.deepEqual(b.events,a.events);assert.deepEqual(browserKit.view(b.o),KIT.view(a.o));
  assert.deepEqual([...b.f.players.values()],[...a.f.players.values()]);
 }finally{globalThis.fetch=oldFetch;if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation}
});
