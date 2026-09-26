const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const SIM=require('../js/world-sim.js'),DIRECTOR=require('../js/boss-director.js');
const ctx={window:{}};for(const n of ['world','dungeons','dungeon','dungeon-content'])vm.runInNewContext(fs.readFileSync('js/'+n+'.js','utf8'),ctx);
const L=ctx.window.TW_LEVELS,A=ctx.window.TW_DUNGEONS.ARENAS;
const REAL=[['d02','marsh'],['d03','sewage'],['d04','relay'],['d05','grove'],['d06','road'],['d07','ward']];

test('every real boss has authored idle locomotion and committed attack movement',()=>{
 for(const [level,arena] of REAL){
  assert.ok(L[level].ai.some(x=>x.orbit||x.retreat),level+' idle locomotion');
  assert.ok(Object.keys(L[level].attackMotion||{}).length>=2,level+' attack movement');
  assert.equal(A[arena].stages.length,2,arena+' two stages');
  for(const stage of A[arena].stages){
   assert.ok(stage.patterns.length>=3,arena+' patterns');
   assert.ok(stage.patterns.some(p=>p.range==='near'),arena+' near');
   assert.ok(stage.patterns.some(p=>p.range==='far'),arena+' far');
  }
  assert.ok(A[arena].stages.some(stage=>stage.patterns.some(p=>p.counterable===false||p.unblockable)),arena+' evade-only skill');
 }
});

test('idle AI approaches, retreats and orbits without changing legacy default contract',()=>{
 const rows=['############','#..........#','#..........#','#..........#','#..........#','############'],w=SIM.createWorld({rows,cell:64});
 const p={x:450,y:160},b={x:130,y:160,r:20};
 w.bossThink(b,p,.1,{speed:100,keep:180,retreat:40,deadzone:10,orbit:30},false);assert.ok(b.x>130,'approach');
 b.x=280;b.y=160;const y=b.y;w.bossThink(b,p,.1,{speed:100,keep:180,retreat:40,deadzone:10,orbit:30,orbitFlip:10},false);assert.notEqual(b.y,y,'orbit');
 b.x=400;b.y=160;const x=b.x;w.bossThink(b,p,.1,{speed:100,keep:180,retreat:40,deadzone:10,orbit:30},false);assert.ok(b.x<x,'retreat');
 const legacy={x:130,y:160,r:20};w.bossThink(legacy,p,.1,{speed:100,keep:180},false);assert.ok(legacy.x>130);assert.equal(legacy.moving,true);
});

test('director supports rush/heavy/lateral committed movement without homing',()=>{
 const rows=['############','#..........#','#..........#','#..........#','#..........#','############'],w=SIM.createWorld({rows,cell:64});
 const p={x:450,y:160},b={x:130,y:160,r:20,orbitDir:1};
 const d=DIRECTOR.create(w,b,p,{attackMotion:{rush:{distance:240,stop:100,at:.45,curve:'rush',lateral:40},heavy:{distance:120,stop:100,at:.45,curve:'heavy'}}});
 const q=d.start({name:'rush'},{kind:'circle',r:80,fwd:0});d.advance(.6);const rushEarly=Math.hypot(b.x-130,b.y-160);assert.ok(rushEarly>10);
 p.y=300;d.advance(1);const final={x:b.x,y:b.y};d.advance(1);assert.deepEqual({x:b.x,y:b.y},final,'committed destination');
 const b2={x:130,y:160,r:20},d2=DIRECTOR.create(w,b2,{x:450,y:160},{attackMotion:{heavy:{distance:120,stop:100,at:.45,curve:'heavy'}}});
 d2.start({name:'heavy'},{kind:'circle',r:80,fwd:0});d2.advance(.6);assert.ok(b2.x-130<rushEarly,'heavy commits later than rush');
 assert.ok(q.zone);
});
