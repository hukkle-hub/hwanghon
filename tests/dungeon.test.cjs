const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const SIM=require('../js/world-sim.js'),EXP=require('../js/dungeon-run.js'),CB=require('../js/combat.js');
function env(storage=new Map()){
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 const c={window:{},localStorage,console,document:{dispatchEvent(){}},CustomEvent:function(){}};vm.createContext(c);
 for(const n of ['world','items','save','dungeons','dungeon','dungeon-content','story'])vm.runInContext(fs.readFileSync('js/'+n+'.js','utf8'),c,{filename:n});return c;
}
const C=env(),levels=C.window.TW_LEVELS;
function world(id){return SIM.createWorld({rows:levels[id].rows,cell:64});}
function reachable(w,blocked){const start=w.marks('S')[0],seen=new Set(),q=[[start.cx,start.cy]];while(q.length){const [x,y]=q.shift(),k=x+','+y;if(seen.has(k)||w.isSolid((x+.5)*64,(y+.5)*64)||k===blocked)continue;seen.add(k);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])q.push([x+dx,y+dy]);}return seen;}
test('three rectangular maps: all interaction nodes reachable before boss; one final seal',()=>{
 for(const id of Object.keys(levels)){const l=levels[id],w=world(id),g=w.marks('G')[0],reach=reachable(w,g.cx+','+g.cy);assert.ok(l.rows.every(r=>r.length===l.rows[0].length));
  for(const n of l.expedition.nodes)assert.ok(reach.has(n.cx+','+n.cy),id+':'+n.id);
  const b=w.marks('B')[0];assert.ok(!reach.has(b.cx+','+b.cy),id+' boss seal bypassed');assert.ok(reachable(w).has(b.cx+','+b.cy));
 }
});
test('all valves required, remote interaction blocked and rewards emitted once',()=>{
 const l=levels.d03,w=world('d03');let save;const r=EXP.create({level:l,world:w,save:v=>save=v,id:'run-a'});
 assert.equal(r.ready(),false);assert.equal(r.interact(w.marks('S')[0]),false);
 for(const n of r.nodes.filter(n=>n.kind==='valve')){assert.equal(r.interact(n),true);assert.equal(r.interact(n),false);}
 assert.equal(r.ready(),true);assert.equal(r.objectiveCount('valves'),3);
 const restored=EXP.create({level:l,world:w,saved:save});assert.equal(restored.ready(),true);assert.equal(restored.interact(r.nodes.find(n=>n.kind==='valve')),false);
});
test('checkpoint restores with optional objectives; different dungeon cannot inherit state',()=>{
 const w=world('d02'),r=EXP.create({level:levels.d02,world:w,id:'run-b'});const cp=r.nodes.find(n=>n.kind==='checkpoint'),rec=r.nodes.find(n=>n.kind==='record');r.interact(cp);r.interact(rec);
 const v=r.snapshot(),s=EXP.create({level:levels.d02,world:w,saved:v});assert.equal(s.checkpoint().id,cp.id);assert.equal(s.objectiveCount('record'),1);assert.equal(s.interact(rec),false);
 const other=EXP.create({level:levels.d03,world:world('d03'),saved:v});assert.equal(other.checkpoint(),null);assert.equal(other.ready(),false);
 assert.equal(r.finish(),true);assert.equal(r.finish(),false);const fresh=EXP.create({level:levels.d02,world:w,saved:r.snapshot()});assert.equal(fresh.objectiveCount('record'),0);
});
test('hazards warn, respect pause and dodge, and stop after valve shuts',()=>{
 const w=world('d03'),r=EXP.create({level:levels.d03,world:w}),h=r.hazards[0];assert.equal(r.hazardPhase(h),'warning');r.tick(8,h,false);assert.equal(r.hazardPhase(h),'warning');assert.equal(r.drain().length,0);
 r.tick(1.3,{...h,dodging:true},true);assert.equal(r.hazardPhase(h),'active');assert.ok(!r.drain().some(e=>e.t==='hazard'));
 r.tick(.01,h,true);assert.ok(r.drain().some(e=>e.t==='hazard'));r.interact(r.nodes.find(n=>n.id===h.disabledBy));assert.equal(r.hazardPhase(h),'off');r.drain();r.tick(10,h,true);assert.ok(!r.drain().some(e=>e.t==='hazard'));
});
test('wall prevents interaction; long roll cannot tunnel across one cell wall',()=>{
 const w=SIM.createWorld({rows:['#######','#S#...#','#.#...#','#######'],cell:64}),p={x:96,y:96,r:22,aim:0,rollT:0};assert.equal(w.lineOfSight(96,96,224,96),false);w.roll(p,1,0,300,.3);w.movePlayer(p,0,0,.3,230);assert.ok(p.x<128);
 const r=EXP.create({level:{id:'wall',cell:64,expedition:{nodes:[{id:'blocked',cx:2,cy:1,range:500}]}},world:w});assert.equal(r.interact(p),false);
});
test('sewage has complete combat patterns and preserves learnable high damage responses',()=>{
 const A=C.window.TW_DUNGEONS.ARENAS.sewage,L=levels.d03;assert.equal(A.stages.length,2);
 for(const d of A.stages){for(const p of d.patterns){assert.ok(L.zones[p.name]);assert.ok(A.atk[p.icon]);}assert.ok(d.patterns.some(p=>p.counterable===false));assert.ok(d.discipline.normal<d.discipline.evadeMult);}
});
test('progression opens in order and sewage quest reward can be claimed only once',()=>{
 const storage=new Map(),c=env(storage),s=c.window.TW_STORY,save=c.window.TW_SAVE;assert.equal(s.questState('q_marsh'),'locked');assert.equal(s.questState('q_sewage'),'locked');
 storage.set('tw:arena:tutorial',JSON.stringify({cleared:true}));assert.equal(s.questState('q_marsh'),'available');
 storage.set('tw:arena:marsh',JSON.stringify({cleared:true}));assert.equal(s.questState('q_sewage'),'available');assert.equal(s.routeForQuest('q_sewage').dungeon,'game3d.html?d=d03');
 storage.set('tw:arena:sewage',JSON.stringify({cleared:true}));const before=save.wallet();assert.ok(s.claim('q_sewage'));assert.equal(save.wallet()-before,12500);assert.equal(s.claim('q_sewage'),null);assert.equal(s.questState('q_sewage'),'claimed');
});
test('grove and road continue the chain: relay -> grove -> road, each with a two-stage arena',()=>{
 const storage=new Map(),c=env(storage),s=c.window.TW_STORY,A=c.window.TW_DUNGEONS.ARENAS,L=c.window.TW_LEVELS;
 for(const [arena,level,quest,proc] of [['grove','d05','q_plant','root'],['road','d06','q_road','hauler']]){
  assert.ok(A[arena],arena);assert.equal(A[arena].stages.length,2,arena+' 단계');
  assert.equal(A[arena].procedural,proc);assert.ok(A[arena].stageFx[1].hazards.length>0,arena+' 광란 구역');
  /* 통상 단계의 파괴 부위는 전부 3D 부위 노드와 이름이 맞아야 표식이 붙는다 */
  for(const part of A[arena].stages[0].parts)assert.ok(A[arena].parts3d[part.id],arena+':'+part.id);
  /* 패턴 이름마다 구역 정의가 있어야 한다 — 없으면 서버가 빈 구역을 만든다 */
  for(const pat of A[arena].stages[0].patterns)assert.ok(L[level].zones[pat.name],level+':'+pat.name);
  assert.equal(s.routeForQuest(quest).dungeon,'game3d.html?d='+level);
 }
 assert.equal(s.questState('q_plant'),'locked');assert.equal(s.questState('q_road'),'locked');
 for(const a of ['tutorial','marsh','sewage','relay'])storage.set('tw:arena:'+a,JSON.stringify({cleared:true}));
 assert.equal(s.questState('q_plant'),'available');assert.equal(s.questState('q_road'),'locked');
 storage.set('tw:arena:grove',JSON.stringify({cleared:true}));assert.equal(s.questState('q_road'),'available');
});
test('zero counters are saved as zero',()=>{const c=env(),s=c.window.TW_SAVE;s.stat('counters',0);assert.equal(s.get().stats.counters,0);});
test('sewage loot has distinct first-clear rewards and rare rolls work',()=>{
 const c=env();vm.runInContext(fs.readFileSync('js/loot.js','utf8'),c);vm.runInContext('Math.random=()=>0',c);
 const L=c.window.TW_LOOT,sum={gold:2400,mats:[],rank:'B',counterRate:1,breaks:2,breakable:2};const first=L.clearRewards('sewage',sum,true),next=L.clearRewards('sewage',sum,false);
 assert.equal(first.gold-next.gold,2500);assert.ok(next.all.some(x=>x[0]==='m_heart'));
});

test('d02 연계 비트는 비트마다 다른 아이콘을 내보내고, 그 아이콘이 전용 클립으로 풀린다',()=>{
 /* 「모션이 없다」의 정체는 여기였다: 연계 2·3타가 1타와 같은 아이콘을 내보내면
    bossAttackSpec 이 같은 클립을 돌려줘 같은 동작을 두 번 본다.
    combat.js 의 beatsOf 가 {...def,...raw} 로 덮으므로 chain[].icon 이 비트 아이콘이 된다. */
 const {RULES,ARENAS}=C.window.TW_DUNGEONS,{createBattle}=CB;
 const seen=(stageIndex,wanted)=>{
  const dummy=ARENAS.marsh.stages[stageIndex];
  /* 원하는 패턴만 고르게 pick 을 고정하고, 예고는 전부 그냥 맞아 준다 */
  const want=dummy.patterns.findIndex(p=>p.icon===wanted);
  const b=createBattle({char:C.window.TW_WORLD.CHARS.ain,rules:RULES,dummy,
    hooks:{canHit:()=>true,canCounter:()=>false,inZone:()=>false,pick:list=>list[Math.max(0,list.findIndex(p=>p.icon===wanted))]}});
  assert.ok(want>=0,wanted);
  const icons=[];
  for(let i=0;i<4000;i++){b.tick(.01);
   for(const e of b.drain())if(e.t==='telegraph')icons.push([e.icon,e.beat,e.beats]);
   if(icons.length&&icons[0][2]===icons.length)break;}
  return icons;
 };
 const bolt=seen(0,'bolt');
 assert.deepEqual(bolt.map(x=>x[0]),['bolt','boltB'],'돌진 베기 2타');
 assert.deepEqual(bolt.map(x=>x[1]),[1,2]);
 const drop=seen(1,'drop');
 assert.deepEqual(drop.map(x=>x[0]),['drop','dropB','dropC'],'피의 광란 3타');
 /* 그 아이콘들이 아레나에서 서로 다른 클립으로 풀린다 */
 const clips=[...bolt,...drop].map(([icon])=>ARENAS.marsh.atk[icon].clip);
 assert.equal(new Set(clips).size,clips.length,'같은 클립이 두 번: '+clips.join(','));
});
