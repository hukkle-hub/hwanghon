const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {Field}=require('../server/field.cjs'),ENV=require('../server/field-environment.cjs');
const RULE=require('../js/mmo/env-rules.js'),{ZONES}=require('../js/mmo/zones.js');
const KIT=require('../server/field-boss-kit.cjs');
function setup(zone='goheung_pad',id='nova'){
 const f=new Field({rng:()=>.5});f.initBosses(0);const z=f.zone(zone),o=f.bosses.get(id);f.spawnBoss(o,1000);
 const p=f.join('p',{id:'p',name:'tester',stats:{hp:1000,atk:1000}},zone);Object.assign(p,{x:o.x+1,z:o.z,hp:1000,maxHp:1000,defense:0,invulnUntil:0,dodgeUntil:0});
 return {f,z,o,p};
}
const hit={damage:.2,knock:2,skill:'burst',beat:1};
test('Nova orbit hole and AI choice use the existing SAFE radius, not the old 4m hole',()=>{
 const k=KIT.KITS.nova,h=k.skills.orbit.hits[0];assert.equal(h.inner,RULE.SAFE.r);
 assert.equal(k.weights(4.25).orbit,undefined);assert.ok(k.weights(4.51).orbit>0);
 const o={x:10,z:-20,yaw:0};
 assert.equal(KIT.inShape(o,{x:14.25,z:-20},h),false);
 assert.equal(KIT.inShape(o,{x:14.51,z:-20},h),true);
 assert.equal(KIT.inShape(o,{x:14.25,z:-20},{...h,inner:4}),true,'old radius negative control');
});
test('environment derives current room props in baked map coordinates; no boss-position shortcut',()=>{
 const {z,o}=setup(),a=ENV.areasFor(z);assert.equal(a.safe.length,1);assert.deepEqual(a.safe[0],{x:o.x,z:o.z,r:RULE.SAFE.r});
 const g=new Field().zone('gyeryong_base'),n=ENV.areasFor(g).narrows[0];assert.equal(n.w,2.6);assert.equal(n.hw,25);assert.equal(n.hd,1.3);
 // Reversed room bounds, offset safezone, arbitrary rotation: independent corner transform.
 const angle=.8,q=ENV.buildAreas({indoor:{rooms:[{s:[10,2],t:[8,-4],props:[{k:'safezone',u:.25,v:.75,r:3},{k:'corridor',width:2}]}]}},angle);
 assert.deepEqual(q.safe[0],{x:+(4*Math.cos(angle)-5*Math.sin(angle)).toFixed(2),z:+(-4*Math.sin(angle)-5*Math.cos(angle)).toFixed(2),r:3});
 assert.equal(q.narrows[0].w,2);assert.equal(ENV.buildAreas(null,0).safe.length,0);
 assert.deepEqual(ENV.modifiers(z,{zone:'gyeryong_base',x:o.x,z:o.z}),{damage:1,knock:1,swing:1});
 assert.deepEqual(ENV.modifiers(z,{zone:z.id,x:NaN,z:o.z}),{damage:1,knock:1,swing:1});
 assert.equal(ENV.modifiers({id:'unknown',ang:0},{zone:'unknown',x:0,z:0}).damage,1);
 const lib=fs.readFileSync(require.resolve('../js/mmo/env-lib.js'),'utf8');assert.match(lib,/SCREEN_ANG = 28 \* Math.PI \/ 180/);assert.equal(z.ang,28*Math.PI/180);
 assert.ok(ZONES.goheung_pad.indoor.rooms.some(r=>r.props?.some(p=>p.k==='safezone')));
});
test('Nova inner region halves real server damage and knock; outside does not; entering/leaving resamples',()=>{
 const {f,z,o,p}=setup(),at=d=>Object.assign(p,{x:o.x+d,z:o.z,hp:1000});
 for(const [d,k] of [[1,.5],[4.5,.5],[4.5001,1],[8,1],[1,.5]]){
  at(d);const x=p.x,out=f.bossStrike(o,p,hit,2000);assert.equal(out.amount,Math.round(1000*hit.damage*k));assert.ok(Math.abs(p.x-x-hit.knock*k)<1e-8);assert.equal(p.hurt[1],out.amount);
 }
 at(4.4);f.bossStrike(o,p,hit,2100);assert.equal(p.hp,900,'sample safety before knock leaves region');
 const second=f.bossStrike(o,p,hit,2200);assert.equal(second.amount,200,'next hit uses outside position');
 at(8);p.safe=true;p.safeK=0;p.narrow={w:1};assert.equal(f.bossStrike(o,p,hit,2300).amount,200,'client-like flags cannot reduce damage');
 assert.equal(ENV.modifiers(z,p).damage,1);
});
test('environment combines existing defense/buff exactly once; evade causes neither HP nor motion; lethal damage stays authoritative',()=>{
 const {f,o,p}=setup();Object.assign(p,{defense:6000,buffUntil:3000,buffReduce:.25});
 const x=p.x;assert.equal(f.bossStrike(o,p,hit,2000).amount,Math.round(1000*.2*(1-.18)*.75*.5));
 p.dodgeUntil=4000;const before={hp:p.hp,x:p.x,z:p.z};assert.equal(f.bossStrike(o,p,hit,2500).evade,true);assert.deepEqual({hp:p.hp,x:p.x,z:p.z},before);
 p.dodgeUntil=0;p.invulnUntil=4000;assert.equal(f.bossStrike(o,p,hit,2501).evade,true);
 Object.assign(p,{x:x,z:o.z,hp:10,invulnUntil:0});assert.equal(f.bossStrike(o,p,hit,4001).dead,true);assert.equal(p.hp,0);assert.equal(p.hurt[4],'dead');
});
test('Park corridor applies existing swing rule to real hit/skill multiplier, outside and other rooms unaffected',()=>{
 const {f,z,o,p}=setup('gyeryong_base','park'),n=ENV.areasFor(z).narrows[0],profile={name:'tester',stats:{atk:1000,critChance:0},equipment:{}};
 Object.assign(p,{x:o.x,z:o.z});assert.equal(RULE.swingK(RULE.narrowAt([n],p.x,p.z)),.85);
 const a=f.hit(p.id,{boss:o.id,swingK:100,safe:true},profile,2000);assert.equal(a.dmg,850);assert.equal(o.dmg.get(p.id),850);
 const b=f.hit(p.id,{boss:o.id},profile,2100,{skill:true,mult:2});assert.equal(b.dmg,1700);
 // Walk across narrow side, still in melee reach; do not move the authoritative boss.
 p.x=o.x+Math.sin(z.ang)*2;p.z=o.z+Math.cos(z.ang)*2;
 assert.equal(ENV.modifiers(z,p).swing,1);assert.equal(f.hit(p.id,{boss:o.id},profile,2600).dmg,1000);
 const before=o.hp;p.x+=100;assert.equal(f.hit(p.id,{boss:o.id},profile,3000),null);assert.equal(o.hp,before);
 const other=setup('gangnam_b1','clave');other.o.combat=null;
 assert.equal(ENV.modifiers(other.z,other.p).swing,1);assert.equal(ENV.modifiers(other.z,other.p).damage,1);
});
test('negative control: omitting server environment would fail both authored multipliers',()=>{
 const {f,o,p}=setup();assert.throws(()=>assert.equal(f.bossStrike(o,p,hit,2000).amount,200));
 const a=setup('gyeryong_base','park');assert.throws(()=>assert.equal(a.f.hit(a.p.id,{boss:a.o.id},{stats:{atk:1000}},2000).dmg,1000));
});
