/* Deterministic review fixture, NOT a second damage implementation or live AI.
 * caller supplies strike(target, hit, simulationTime), e.g. real Field.bossStrike.
 * Always samples the exact endpoint in addition to the field's 50ms ticks.
 * UI seek rebuilds a fresh cast; production must NOT replay to seek. */
const {createSurfaceWaveHitWindow,TRAVEL_MS}=require('../../server/field-surface-wave.cjs');
const point=(cone,d,side=0)=>({x:cone.origin.x+Math.sin(cone.yaw)*d+Math.cos(cone.yaw)*side,z:cone.origin.z+Math.cos(cone.yaw)*d-Math.sin(cone.yaw)*side});
function runGillTargetScenario(cones,skill,until,{cancelAt=Infinity,strike=()=>null}={}){
 const window=createSurfaceWaveHitWindow(cones,skill);
 if(!window||!cones.length||!Number.isFinite(until)||until<0)return{targets:[],events:[]};
 const at=skill.hits[0].at,end=at+TRAVEL_MS,events=[];
 const specs=[['near',1,0],['far',5,0],['dodge',3,.5],['late',7.8,0],['outside',7.5,2.5]];
 const targets=specs.map(([id,d,side])=>({id,...point(cones[0],d,side),alive:true,hp:1000,maxHp:1000,dead:false,defense:0,invulnUntil:0,dodgeUntil:id==='dodge'?at+190:0,hurtSeq:0}));
 const update=t=>{Object.assign(targets[3],point(cones[0],t<=end?7.8:Math.max(5,7.8-(t-end)*.015)));};
 const times=[];for(let t=0;t<=Math.min(until,skill.duration);t+=50)times.push(t);
 if(until>=end)times.push(end);
 times.sort((a,b)=>a-b);
 for(const t of [...new Set(times)]){
  update(t);
  for(const target of window.step(t,targets,{cancelled:t>=cancelAt})){
   const hit={...skill.hits[0],skill:'gill',beat:1,beats:1};
   const result=strike(target,hit,t);events.push({id:target.id,at:t,result});
  }
 }
 update(until);
 return{targets,events};
}
module.exports={runGillTargetScenario};
