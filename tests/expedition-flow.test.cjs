const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const SIM=require('../js/world-sim.js'),EXP=require('../js/dungeon-run.js'),CB=require('../js/combat.js');
test('sewage expedition walks the actual map, closes 3 valves, defeats both boss phases and settles',t=>{
 const c={window:{}};for(const n of ['world','dungeons','dungeon','dungeon-content'])vm.runInNewContext(fs.readFileSync('js/'+n+'.js','utf8'),c);
 const L=c.window.TW_LEVELS.d03,A=c.window.TW_DUNGEONS.ARENAS.sewage,R=c.window.TW_DUNGEONS.RULES,CHAR=c.window.TW_WORLD.CHARS.ain;
 const w=SIM.createWorld({rows:L.rows,cell:L.cell}),p=w.add('p',{...w.marks('S')[0],r:22,rollT:0}),gate=w.marks('G')[0];w.setSolid(gate.cx,gate.cy,true);
 const run=EXP.create({level:L,world:w}),player={hp:CHAR.stats.hp,st:R.stamina.max,ult:0};let travelled=0,injuries=0;
 function pathTo(n){const start=[Math.floor(p.x/64),Math.floor(p.y/64)],q=[start],seen=new Map([[start.join(','),null]]);while(q.length){const a=q.shift();if(a[0]===n.cx&&a[1]===n.cy){const route=[];let k=a.join(',');while(seen.get(k)){route.push(k.split(',').map(Number));k=seen.get(k);}return route.reverse();}for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const b=[a[0]+dx,a[1]+dy],k=b.join(',');if(!seen.has(k)&&!w.isSolid((b[0]+.5)*64,(b[1]+.5)*64)){seen.set(k,a.join(','));q.push(b);}}}throw Error('No route to '+n.id);}
 for(const id of ['entry_rest','north_valve','middle_valve','south_valve','purifier','pump_rest']){
  const n=run.nodes.find(n=>n.id===id);for(const [cx,cy]of pathTo(n)){const tx=(cx+.5)*64,ty=(cy+.5)*64;let guard=0;while(w.dist(p.x,p.y,tx,ty)>1){assert.ok(guard++<300,'movement stuck');const a=w.angle(p.x,p.y,tx,ty),dt=Math.min(.01,w.dist(p.x,p.y,tx,ty)/230);w.movePlayer(p,Math.cos(a),Math.sin(a),dt,230);run.tick(dt,p,true);travelled+=dt;for(const e of run.drain())if(e.t==='hazard'){player.hp-=Math.round(CHAR.stats.hp*e.fraction);injuries++;}assert.ok(player.hp>0,'route killed player');}}
  assert.equal(run.interact(p),true,id);for(const e of run.drain())if(e.t==='interact'&&e.node.kind==='checkpoint')player.hp=CHAR.stats.hp;
 }
 assert.equal(run.ready(),true);assert.equal(run.objectiveCount('valves'),3);assert.equal(run.objectiveCount('purifier'),1);
 const results=[];let ps=player;
 for(const d of A.stages){const b=CB.createBattle({char:CHAR,rules:R,dummy:d,player:ps,skills:c.window.TW_DUNGEONS.SKILLS.ain,ult:c.window.TW_DUNGEONS.SKILLS.ainUlt,seed:9,hooks:{canHit:()=>true,canCounter:()=>true,inZone:()=>true}});
  for(let i=0;i<60000&&!b.over;i++){const s=b.snapshot(),p=s.player,e=s.enemy,target=e.parts.find(p=>p.breakable&&!p.broken)?.id||'core';if(!p.action&&!p.hitstop&&!p.locked&&!p.dodging){if(e.state==='telegraph'&&e.tele<=.035)b.input(e.counterable?'attack':'dodge',target);else if(p.riposte)b.input('attack',target);else if(['recover','downed','stagger'].includes(e.state))b.input('attack',target);}b.tick(.01);b.drain();}
  assert.ok(b.over&&!b.dead,d.id);results.push({...b.metrics});ps=b.exportPlayer();
 }
 const sum=CB.summarize(R,A,results);assert.equal(sum.breaks,2);assert.ok(sum.evades>0);assert.ok(sum.gold>0);assert.equal(run.finish(),true);assert.equal(run.finish(),false);
 t.diagnostic(`Travel ${travelled.toFixed(1)}s, hazard hits ${injuries}; boss phases ${results.map(r=>r.time.toFixed(1)).join('/')}s; counters ${sum.counters}, breaks ${sum.breaks}`);
});
