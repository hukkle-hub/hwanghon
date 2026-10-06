/* 클레이브 필드 전투 — 서버 권위 이동·예고·연계·반격창 (docs/design/18, 188, 189)
   화면은 이 상태를 따라 그릴 뿐이다. 보스 체력은 여기서도 절대 내보내지 않는다. */
const CLAVE_IDS=new Set(['clave','clave2']);

/* 한 기술에 «기다렸다 치는 박자»는 하나뿐, 연계는 최대 3타, 반격은 마지막 타 직전만. */
const SKILLS={
 shutter:{
  clip:'atk_claveshut', duration:3400, tell:1500, charge:[1350,1850],
  hits:[{ at:1720, shape:'line', range:7.2, width:2.2, damage:.22, knock:3.4 }]
 },
 storm:{
  clip:'atk_clavestorm', duration:4300, tell:1050,
  hits:[
   { at:1315, shape:'cone', range:4.8, angle:1.8, damage:.10, knock:.8 },
   { at:2135, shape:'cone', range:5.1, angle:2.05, damage:.12, knock:1.0 },
   { at:2955, shape:'circle', radius:5.4, damage:.24, knock:2.5 }
  ], counter:[2600,2955]
 },
 slam:{
  clip:'atk_slam', duration:3050, tell:1540,
  hits:[{ at:1540, shape:'circle', radius:5.2, damage:.31, knock:3.0 }],
  counter:[1190,1540]
 }
};
const ORDER=['shutter','storm','slam'];
const AGGRO=18, LEASH=22, STRIKE_REACH=4.1, WALK_SPEED=2.25, RETURN_SPEED=3.0;
const round2=n=>+n.toFixed(2);
const angle=(x,z)=>Math.atan2(x,z);
const deltaAngle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

function enabled(o){ return CLAVE_IDS.has(o.id); }
function setup(o,now=Date.now()){
 if(!enabled(o)) return null;
 o.homeX=o.homeX??o.x; o.homeZ=o.homeZ??o.z;
 o.combat={ state:'idle', skill:'', seq:0, startedAt:now, endsAt:now+700, lastAt:now,
  yaw:o.yaw||0, target:null, pattern:0, hitIndex:0, fromX:o.x, fromZ:o.z, countered:false };
 o.yaw=o.combat.yaw; return o.combat;
}
function reset(o,now=Date.now()){ if(enabled(o)){if(Number.isFinite(o.homeX)){o.x=o.homeX;o.z=o.homeZ;}setup(o,now);} }
function setState(o,state,now,duration=0,extra={}){
 const a=o.combat; a.state=state; a.skill=extra.skill||''; a.startedAt=now; a.endsAt=now+duration;
 a.seq++; a.hitIndex=0; a.countered=false; Object.assign(a,extra); return a;
}
function livePlayers(field,o){
 return [...field.players.values()].filter(p=>p.zone===o.zone&&!p.dead&&Number.isFinite(p.hp));
}
function nearest(field,o){
 let best=null,bd=Infinity; for(const p of livePlayers(field,o)){ const d=Math.hypot(p.x-o.x,p.z-o.z); if(d<bd){best=p;bd=d;} }
 return bd<=AGGRO?{p:best,d:bd}:null;
}
function target(field,o){ const id=o.combat.target,p=id&&field.players.get(id); return p&&p.zone===o.zone&&!p.dead?p:null; }
function turn(o,x,z,max){ const want=angle(x-o.x,z-o.z),d=deltaAngle(want,o.yaw||0); o.yaw=(o.yaw||0)+Math.max(-max,Math.min(max,d)); o.combat.yaw=o.yaw; }
function move(o,x,z,speed,dt){ const dx=x-o.x,dz=z-o.z,d=Math.hypot(dx,dz); if(d<1e-5)return d; const n=Math.min(d,speed*dt); o.x+=dx/d*n; o.z+=dz/d*n; return d-n; }
function inShape(o,p,h){
 const dx=p.x-o.x,dz=p.z-o.z,fx=Math.sin(o.yaw||0),fz=Math.cos(o.yaw||0),sideX=fz,sideZ=-fx;
 if(h.shape==='circle') return dx*dx+dz*dz<=h.radius*h.radius;
 const f=dx*fx+dz*fz,s=dx*sideX+dz*sideZ;
 if(h.shape==='line') return f>=-.5&&f<=h.range&&Math.abs(s)<=h.width*.5;
 if(h.shape==='cone') return f>=0&&Math.hypot(dx,dz)<=h.range&&Math.abs(Math.atan2(s,f))<=h.angle*.5;
 return false;
}
function beginSkill(o,p,now){
 const skill=ORDER[o.combat.pattern++%ORDER.length],def=SKILLS[skill];
 turn(o,p.x,p.z,Math.PI); setState(o,'skill',now,def.duration,{skill,target:p.id,fromX:o.x,fromZ:o.z});
}
function finish(o,now){ setState(o,'idle',now,780,{target:null}); }
function skillTick(field,o,now){
 const a=o.combat,def=SKILLS[a.skill]; if(!def){finish(o,now);return;}
 const elapsed=now-a.startedAt;
 /* 셔터 돌진은 예고 뒤 잠근 방향으로만 간다. 마지막 순간에 플레이어를 꺾어 따라가지 않는다. */
 if(a.skill==='shutter'){
  const [s,e]=def.charge,k=Math.max(0,Math.min(1,(elapsed-s)/(e-s))),dist=4.8*k;
  o.x=a.fromX+Math.sin(o.yaw)*dist; o.z=a.fromZ+Math.cos(o.yaw)*dist;
 }
 while(a.hitIndex<def.hits.length&&elapsed>=def.hits[a.hitIndex].at){
  const hit={...def.hits[a.hitIndex],skill:a.skill,beat:a.hitIndex+1,beats:def.hits.length}; a.hitIndex++;
  const origin=a.skill==='shutter'?{x:a.fromX,z:a.fromZ,yaw:o.yaw}:o;   /* 돌진은 출발점→도착점 전체가 공격 궤적 */
  for(const p of livePlayers(field,o)) if(inShape(origin,p,hit)) field.bossStrike(o,p,hit,now);
 }
 if(now>=a.endsAt) finish(o,now);
}
function tick(field,o,now=Date.now()){
 if(!enabled(o)||!o.alive) return; if(!o.combat) setup(o,now);
 const a=o.combat,dt=Math.min(.1,Math.max(0,(now-a.lastAt)/1000)); a.lastAt=now;
 if(a.state==='skill'){ skillTick(field,o,now); return; }
 if(a.state==='stagger'){ if(now>=a.endsAt) finish(o,now); return; }
 const t=target(field,o),homeD=Math.hypot(o.x-o.homeX,o.z-o.homeZ);
 if(t){
  const d=Math.hypot(t.x-o.x,t.z-o.z); if(d>LEASH||homeD>LEASH){ setState(o,'return',now,0,{target:null}); }
  else if(d<=STRIKE_REACH&&now>=a.endsAt){ beginSkill(o,t,now); return; }
  else if(d>STRIKE_REACH){ if(a.state!=='walk')setState(o,'walk',now,0,{target:t.id}); turn(o,t.x,t.z,dt*2.6); move(o,t.x,t.z,WALK_SPEED,dt); return; }
 }
 if(a.state==='return'||homeD>1){
  if(a.state!=='return')setState(o,'return',now,0,{target:null}); turn(o,o.homeX,o.homeZ,dt*3.2);
  if(move(o,o.homeX,o.homeZ,RETURN_SPEED,dt)<=.08){ o.x=o.homeX;o.z=o.homeZ;setState(o,'idle',now,650,{target:null}); }
  return;
 }
 const n=nearest(field,o); if(n){ a.target=n.p.id; if(n.d<=STRIKE_REACH&&now>=a.endsAt)beginSkill(o,n.p,now); else if(n.d>STRIKE_REACH)setState(o,'walk',now,0,{target:n.p.id}); }
 else if(a.state!=='idle')setState(o,'idle',now,0,{target:null});
}
function tryCounter(o,now=Date.now()){
 const a=o&&o.combat,def=a&&SKILLS[a.skill]; if(!a||a.state!=='skill'||!def?.counter||a.countered)return false;
 const elapsed=now-a.startedAt; if(elapsed<def.counter[0]||elapsed>def.counter[1])return false;
 a.countered=true; setState(o,'stagger',now,1350,{skill:a.skill,target:null}); return true;
}
function view(o){
 if(!enabled(o)||!o.alive||!o.combat)return null; const a=o.combat,def=SKILLS[a.skill],counter=def?.counter;
 return { id:o.id,x:round2(o.x),z:round2(o.z),yaw:round2(o.yaw||0),motion:a.state,skill:a.skill,seq:a.seq,
  startedAt:a.startedAt,endsAt:a.endsAt,counterOpen:counter&&a.state==='skill'?a.startedAt+counter[0]:0,
  counterClose:counter&&a.state==='skill'?a.startedAt+counter[1]:0 };
}

module.exports={ CLAVE_IDS,SKILLS,ORDER,AGGRO,LEASH,STRIKE_REACH,WALK_SPEED,RETURN_SPEED,enabled,setup,reset,tick,tryCounter,view,inShape };
