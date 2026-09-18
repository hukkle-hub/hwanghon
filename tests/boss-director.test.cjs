const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const SIM=require('../js/world-sim.js'),DIRECTOR=require('../js/boss-director.js'),CB=require('../js/combat.js');
const ctx={window:{}};for(const n of ['world','dungeons','dungeon','dungeon-content'])vm.runInNewContext(fs.readFileSync('js/'+n+'.js','utf8'),ctx);
function fixture(rows=['############','#..........#','#..........#','#..........#','#..........#','############']){
 const w=SIM.createWorld({rows,cell:64}),b={x:130,y:160,r:20},p={x:450,y:160};
 const d=DIRECTOR.create(w,b,p,{attackMotion:{charge:{distance:260,stop:100,at:.5}}});return {w,b,p,d};
}
test('committed charge warns before moving, finishes before hit and does not home onto dodging player',()=>{
 const {w,b,p,d}=fixture(),plan=d.start({name:'charge'},{kind:'line',len:430,w:100});
 assert.equal(plan.angle,0);d.advance(.49);assert.equal(b.x,130);
 p.y=245;d.advance(.75);assert.ok(b.x>130&&b.x<350);d.advance(1);assert.ok(Math.abs(b.x-350)<1e-8);assert.equal(b.y,160);
 assert.equal(w.inZone(plan.zone,p.x,p.y),false);assert.equal(w.inZone(plan.zone,450,160),true);
});
test('charge collision prevents crossing walls and circle warning uses reachable destination',()=>{
 const {w,b,p,d}=fixture(['############','#..#.......#','#..#.......#','#..#.......#','#..#.......#','############']);
 const plan=d.start({name:'charge'},{kind:'circle',r:80,fwd:30});d.advance(1);
 assert.ok(b.x<192);assert.equal(plan.zone.x,b.x+30);assert.ok(!w.isSolid(b.x+b.r,b.y));
});
test('distance-aware rotation varies near attacks and has safe fallback after disabling moves',()=>{
 const {p,b,d}=fixture();p.x=b.x+110;const pats=[{name:'hammer',range:'near'},{name:'spin',range:'near'},{name:'charge',range:'far'}];
 const result=Array.from({length:8},(_,i)=>d.pick(pats,i).name);assert.ok(result.every((x,i)=>!i||x!==result[i-1]));assert.ok(!result.includes('charge'));
 p.x=500;assert.equal(d.pick(pats,0).name,'charge');assert.equal(d.pick([pats[0]],1).name,'hammer');
});
function integrated(frame,interrupt=false){
 const {w,b,p,d}=fixture(),rules=structuredClone(ctx.window.TW_DUNGEONS.RULES);rules.bleed.chance=0;
 const dummy={...ctx.window.TW_DUNGEONS.ARENAS.tutorial.stages[0],patternGap:.1,patterns:[{name:'charge',icon:'bolt',tele:1,dmg:500,recovery:.8}],hp:1e8};
 let zone,damageAt=null;const battle=CB.createBattle({char:ctx.window.TW_WORLD.CHARS.ain,rules,dummy,hooks:{enemyStart:pat=>zone=d.start(pat,{kind:'line',len:430,w:100}).zone,enemyAdvance:(pat,t)=>d.advance(t),inZone:()=>w.inZone(zone,p.x,p.y),canCounter:()=>true}});
 for(let i=0;i<300&&!damageAt;i++){battle.tick(frame);const s=battle.snapshot();if(interrupt&&s.enemy.state==='telegraph'&&s.enemy.tele<=.15){battle.input('attack','body');const stopped=b.x;for(let j=0;j<20;j++)battle.tick(.01);return {stopped,x:b.x,counters:battle.metrics.counters};}for(const e of battle.drain())if(e.t==='damaged')damageAt={x:b.x,hp:battle.snapshot().player.hp};}
 return damageAt;
}
test('boss movement and damage use same simulation clock across render rates; counter cancels advance',()=>{
 const slow=integrated(.05),fast=integrated(.01);assert.deepEqual(slow,fast);assert.ok(Math.abs(fast.x-350)<1e-8);
 const counter=integrated(.01,true);assert.equal(counter.counters,1);assert.equal(counter.x,counter.stopped);
});
test('broken equipment removes its attacks from the combat engine rotation',()=>{
 const R=structuredClone(ctx.window.TW_DUNGEONS.RULES);R.bleed.chance=0;
 const dummy={...ctx.window.TW_DUNGEONS.ARENAS.tutorial.stages[0],hp:1e8,patternGap:.1,parts:[{id:'tail',name:'tail',hp:1,breakable:true},{id:'body',name:'body',hp:null}],patterns:[{name:'tail attack',icon:'scythe',tele:1,dmg:1,disabledBy:['tail']},{name:'roar',icon:'hammer',tele:1,dmg:1}]};
 const b=CB.createBattle({char:ctx.window.TW_WORLD.CHARS.ain,rules:R,dummy});b.input('attack','tail');b.tick(.5);assert.equal(b.part('tail').broken,true);b.drain();
 b.tick(10);const tele=b.drain().filter(e=>e.t==='telegraph');assert.ok(tele.length>=2);assert.ok(tele.every(e=>e.pattern==='roar'));
});
test('legacy level module is rectangular without loading expedition extensions',()=>{
 const c={window:{}};vm.runInNewContext(fs.readFileSync('js/dungeon.js','utf8'),c);
 for(const level of Object.values(c.window.TW_LEVELS))assert.doesNotThrow(()=>SIM.parseMap(level.rows,64));
});
