import test from 'node:test';import assert from 'node:assert/strict';import{createRequire}from'node:module';
import{sampleAction}from'../js/combat-motion.js';
const require=createRequire(import.meta.url),C=require('../server/content.cjs'),{createBattle}=require('../js/combat.js'),{Raid}=require('../server/raid.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
function solo(rules,aspd=100,id='ain'){return createBattle({rules,dummy:{...copy(C.arenas.tutorial.stages[0]),patterns:[]},char:{...C.character,id,stats:{...C.character.stats,aspd,crit:0}},skills:C.skills.ain,ult:C.skills.ainUlt,player:{ult:100}});}
function begin(b,clip){b.input(clip==='ult'?'ult':'skill',clip==='skill1'?0:2);return b.snapshot().player.action;}
test('Ain heavy skills share authoritative solo/online time and keep clip contact aligned',()=>{
 for(const aspd of [70,100,160])for(const clip of ['skill1','skill3','ult']){
  const b=solo(copy(C.rules),aspd),a=begin(b,clip),r=new Raid('d01',[{id:'a',name:'A',character:'ain'}]);r.startFight();const p=r.players.get('a');p.stats.aspd=aspd;p.ult=100;r.input('a',clip==='ult'?{type:'ult'}:{type:'skill',index:clip==='skill1'?0:2});
  const profile=C.rules.motion.characterProfiles.ain[clip];assert.equal(a.duration,profile.duration/(aspd/100));
  for(const field of ['hitAt','duration','cancelAt','clipHit'])assert.equal(a[field],p.action[field],clip+' '+field);
  assert.ok(Math.abs(sampleAction({...a,elapsed:a.hitAt},2)-2*a.clipHit)<1e-9);assert.equal(sampleAction({...a,elapsed:a.duration},2),2);
  b.tick(a.hitAt-.011);assert.equal(b.metrics.hits,0,'must not hit at obsolete earlier time');b.tick(.021);assert.ok(b.metrics.hits>0);const hits=b.metrics.hits;b.tick(.03);assert.equal(b.metrics.hits,hits,'no duplicate impact');
 }
});
test('slower Ain profile is observable; damage, cooldown, other characters and mobility stay unchanged',()=>{
 const old=copy(C.rules);delete old.motion.characterProfiles;
 for(const clip of ['skill1','skill3','ult']){const a=begin(solo(copy(C.rules)),clip),b=begin(solo(old),clip);assert.ok(a.duration>b.duration*1.25);assert.ok(a.hitAt>b.hitAt);assert.equal(a.mult,b.mult);assert.equal(a.clipHit,b.clipHit);assert.throws(()=>assert.equal(a.duration,b.duration),'negative control must reject old timing');}
 for(const input of [['attack'],['dodge'],['skill',1],['skill',3]]){const a=solo(copy(C.rules)),b=solo(old);a.input(...input);b.input(...input);assert.deepEqual(a.snapshot().player,b.snapshot().player);}
 for(const id of ['kain','ryu','sera'])assert.deepEqual(begin(solo(copy(C.rules),100,id),'skill1'),begin(solo(old,100,id),'skill1'));
 const a=solo(copy(C.rules)),b=solo(old);begin(a,'skill1');begin(b,'skill1');assert.deepEqual(a.snapshot().player.cds,b.snapshot().player.cds);
});
