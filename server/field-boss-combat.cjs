/* 클레이브 필드 전투 — 서버 권위 이동·예고·연계·반격창 (docs/design/18, 188, 189, 194)
   화면은 이 상태를 따라 그릴 뿐이다. 보스 체력은 여기서도 절대 내보내지 않는다. */
const CLAVE_IDS=new Set(['clave','clave2']);

/* 한 기술에 «기다렸다 치는 박자»는 하나뿐, 연계는 최대 3타, 반격은 마지막 타 직전만. */
const SKILLS={
 shutter:{
  clip:'atk_claveshut', duration:3400, tell:1500, charge:[1350,1850], travel:4.8,
  hits:[{ at:1720, shape:'line', range:7.2, width:2.2, back:.5, damage:.22, knock:3.4 }]
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
const PHASE={
 1:{min:.70,engage:STRIKE_REACH,walk:WALK_SPEED,recovery:780,feint:0},
 2:{min:.35,engage:6.2,walk:2.45,recovery:650,feint:.08},
 3:{min:0,engage:6.8,walk:2.7,recovery:520,feint:.18}
};
/* 셔터 부위는 체력과 별개다. 수치는 서버 전용이고 화면에는 intact/cracked/broken 0/1/2만 보낸다. */
const SHUTTER={ratio:.08,crack:.55,ain:1.4,other:.75,counter:2.0,left:1.0,front:.38,otherSide:.16,brokenWalk:.20,brokenRecovery:80};
const round2=n=>+n.toFixed(2);
const angle=(x,z)=>Math.atan2(x,z);
const deltaAngle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

function enabled(o){ return CLAVE_IDS.has(o.id); }
function phaseOf(o){ const max=Math.max(1,Number(o?.max)||1),hp=Math.max(0,Math.min(max,Number.isFinite(o?.hp)?o.hp:max)),r=hp/max;return r>PHASE[1].min?1:r>PHASE[2].min?2:3; }
function phaseCfg(o){return PHASE[phaseOf(o)];}
function setup(o,now=Date.now()){
 if(!enabled(o)) return null;
 o.homeX=o.homeX??o.x; o.homeZ=o.homeZ??o.z;
 o.combat={ state:'idle', skill:'', seq:0, startedAt:now, endsAt:now+700, lastAt:now,
  yaw:o.yaw||0, target:null, pattern:null, hitIndex:0, fromX:o.x, fromZ:o.z, countered:false,
  phase:phaseOf(o), history:[], readTarget:null, evadeStreak:0, feintTo:'', feintAt:0 };
 o.shutterMax=Math.max(1,Math.round(Math.max(1,Number(o.max)||1)*SHUTTER.ratio));o.shutterHp=o.shutterMax;o.shutterState=0;
 o.yaw=o.combat.yaw; return o.combat;
}
function reset(o,now=Date.now()){ if(enabled(o)){if(Number.isFinite(o.homeX)){o.x=o.homeX;o.z=o.homeZ;}setup(o,now);} }
function setState(o,state,now,duration=0,extra={}){
 const a=o.combat; a.state=state; a.skill=extra.skill||''; a.startedAt=now; a.endsAt=now+duration;
 a.seq++; a.hitIndex=0; a.countered=false; a.feintTo=''; a.feintAt=0; Object.assign(a,extra); return a;
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
 if(h.shape==='line') return f>=-(h.back||0)&&f<=h.range&&Math.abs(s)<=h.width*.5;
 if(h.shape==='cone') return f>=0&&Math.hypot(dx,dz)<=h.range&&Math.abs(Math.atan2(s,f))<=h.angle*.5;
 return false;
}
function skillReach(id){ const d=SKILLS[id];if(!d)return 0;let r=0;for(const h of d.hits)r=Math.max(r,h.radius||h.range||0);return r; }
function skillWeights(o,p){
 const a=o.combat,phase=phaseOf(o),d=Math.hypot(p.x-o.x,p.z-o.z),read=a.readTarget===p.id?a.evadeStreak:0;
 let w;
 if(phase===1) w=d<3.2?{shutter:1,storm:4,slam:3}:{shutter:4,storm:3,slam:2};
 else if(phase===2) w=d>5.2?{shutter:9,storm:0,slam:0}:d>3.4?{shutter:4,storm:5,slam:2}:{shutter:1,storm:5,slam:4};
 else w=d>5.2?{shutter:10,storm:0,slam:0}:d>3.4?{shutter:4,storm:7,slam:3}:{shutter:1,storm:7,slam:6};
 if(read>=2){w.storm+=4;w.slam+=1;}
 if(o.shutterState===2){w.shutter=0;w.storm*=.85;w.slam*=1.3;}
 for(const id of ORDER)if(d>skillReach(id)+.15)w[id]=0;
 const last=a.history[a.history.length-1];if(last&&w[last]>0){const viable=ORDER.filter(id=>w[id]>0);if(viable.length>1)w[last]*=.06;}
 const recent=a.history.slice(-3);for(const id of ORDER){const n=recent.filter(x=>x===id).length;if(n>1&&w[id]>0)w[id]*=.35;}
 return w;
}
function weighted(field,weights,exclude=''){
 let total=0;for(const id of ORDER)if(id!==exclude)total+=Math.max(0,weights[id]||0);if(total<=0)return null;
 let r=Math.max(0,Math.min(.999999,Number(field?.rng?.())||0))*total;
 for(const id of ORDER){if(id===exclude)continue;r-=Math.max(0,weights[id]||0);if(r<0)return id;}return ORDER.find(id=>id!==exclude&&weights[id]>0)||null;
}
function chooseSkill(field,o,p){
 const a=o.combat;
 /* 기존 시나리오/QA가 특정 기술을 강제로 고르는 통로. 일반 플레이에서는 null이다. */
 if(Number.isInteger(a.pattern)&&a.pattern>=0&&a.pattern<ORDER.length){const forced=ORDER[a.pattern];a.pattern=null;return forced;}
 return weighted(field,skillWeights(o,p))||'shutter';
}
function recordSkill(o,skill){const h=o.combat.history;h.push(skill);while(h.length>4)h.shift();}
function beginSkill(field,o,p,now,{force=null,noFeint=false}={}){
 const phase=phaseOf(o),skill=force||chooseSkill(field,o,p),def=SKILLS[skill];
 turn(o,p.x,p.z,Math.PI);
 let feintTo='';
 if(!noFeint&&phase===3&&field?.rng&&field.rng()<PHASE[3].feint){const alt=weighted(field,skillWeights(o,p),skill);if(alt)feintTo=alt;}
 setState(o,'skill',now,def.duration,{skill,target:p.id,fromX:o.x,fromZ:o.z,feintTo,feintAt:feintTo?720:0});
 if(!feintTo)recordSkill(o,skill);
}
function finish(o,now){ const cfg=phaseCfg(o),cut=o.shutterState===2?SHUTTER.brokenRecovery:0;setState(o,'idle',now,Math.max(400,cfg.recovery-cut),{target:null}); }
function skillTick(field,o,now){
 const a=o.combat,def=SKILLS[a.skill]; if(!def){finish(o,now);return;}
 const elapsed=now-a.startedAt;
 /* 3페이즈의 낮은 확률 페이크. 모든 첫 판정보다 일찍 끊고 즉시 다른 기술로 넘어간다. */
 if(a.feintTo&&elapsed>=a.feintAt&&a.hitIndex===0){const p=target(field,o),next=a.feintTo;if(p)beginSkill(field,o,p,now,{force:next,noFeint:true});else finish(o,now);return;}
 /* 셔터 돌진은 예고 뒤 잠근 방향으로만 간다. 마지막 순간에 플레이어를 꺾어 따라가지 않는다. */
 if(a.skill==='shutter'){
  const [s,e]=def.charge,k=Math.max(0,Math.min(1,(elapsed-s)/(e-s))),dist=def.travel*k;
  o.x=a.fromX+Math.sin(o.yaw)*dist; o.z=a.fromZ+Math.cos(o.yaw)*dist;
 }
 while(a.hitIndex<def.hits.length&&elapsed>=def.hits[a.hitIndex].at){
  const hit={...def.hits[a.hitIndex],skill:a.skill,beat:a.hitIndex+1,beats:def.hits.length}; a.hitIndex++;
  const origin=a.skill==='shutter'?{x:a.fromX,z:a.fromZ,yaw:o.yaw}:o;   /* 돌진은 출발점→도착점 전체가 공격 궤적 */
  for(const p of livePlayers(field,o)) if(inShape(origin,p,hit)) field.bossStrike(o,p,hit,now);
 }
 if(now>=a.endsAt) finish(o,now);
}
function syncPhase(o){const p=phaseOf(o);if(o.combat.phase!==p){o.combat.phase=p;o.combat.evadeStreak=0;o.combat.readTarget=null;}}
function tick(field,o,now=Date.now()){
 if(!enabled(o)||!o.alive) return; if(!o.combat) setup(o,now);syncPhase(o);
 const a=o.combat,dt=Math.min(.1,Math.max(0,(now-a.lastAt)/1000)); a.lastAt=now;
 if(a.state==='skill'){ skillTick(field,o,now); return; }
 if(a.state==='stagger'){ if(now>=a.endsAt) finish(o,now); return; }
 const cfg=phaseCfg(o),broken=o.shutterState===2,engage=broken?Math.min(cfg.engage,5.15):cfg.engage,walkSpeed=cfg.walk+(broken?SHUTTER.brokenWalk:0),t=target(field,o),homeD=Math.hypot(o.x-o.homeX,o.z-o.homeZ);
 if(t){
  const d=Math.hypot(t.x-o.x,t.z-o.z); if(d>LEASH||homeD>LEASH){ setState(o,'return',now,0,{target:null}); }
  else if(d<=engage&&now>=a.endsAt){ beginSkill(field,o,t,now); return; }
  else if(d>engage){ if(a.state!=='walk')setState(o,'walk',now,0,{target:t.id}); turn(o,t.x,t.z,dt*(2.6+.25*(walkSpeed-WALK_SPEED))); move(o,t.x,t.z,walkSpeed,dt); return; }
 }
 if(a.state==='return'||homeD>1){
  if(a.state!=='return')setState(o,'return',now,0,{target:null}); turn(o,o.homeX,o.homeZ,dt*3.2);
  if(move(o,o.homeX,o.homeZ,RETURN_SPEED,dt)<=.08){ o.x=o.homeX;o.z=o.homeZ;setState(o,'idle',now,650,{target:null}); }
  return;
 }
 const n=nearest(field,o); if(n){ a.target=n.p.id; if(n.d<=engage&&now>=a.endsAt)beginSkill(field,o,n.p,now); else if(n.d>engage)setState(o,'walk',now,0,{target:n.p.id}); }
 else if(a.state!=='idle')setState(o,'idle',now,0,{target:null});
}
function tryCounter(o,now=Date.now()){
 const a=o&&o.combat,def=a&&SKILLS[a.skill]; if(!a||a.state!=='skill'||!def?.counter||a.countered)return false;
 const elapsed=now-a.startedAt; if(elapsed<def.counter[0]||elapsed>def.counter[1])return false;
 a.countered=true; setState(o,'stagger',now,1350,{skill:a.skill,target:null}); return true;
}
function notePlayerResult(o,pid,evaded){const a=o?.combat;if(!a||!pid||a.target!==pid)return;if(a.readTarget!==pid){a.readTarget=pid;a.evadeStreak=0;}a.evadeStreak=evaded?Math.min(3,a.evadeStreak+1):Math.max(0,a.evadeStreak-1);}
function shutterExposure(o,p,counter=false){if(counter)return 1;if(!p)return SHUTTER.otherSide;const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz)||1,fx=Math.sin(o.yaw||0),fz=Math.cos(o.yaw||0),rightX=fz,rightZ=-fx,side=(dx*rightX+dz*rightZ)/d,front=(dx*fx+dz*fz)/d;if(side>=.25)return SHUTTER.left;if(front>=.25)return SHUTTER.front;return SHUTTER.otherSide;}
function damageShutter(o,p,profile,dmg,counter,now=Date.now()){
 if(!enabled(o)||o.shutterState===2||!Number.isFinite(dmg)||dmg<=0)return null;const old=o.shutterState||0,exposure=shutterExposure(o,p,counter),mul=(profile?.character==='ain'?SHUTTER.ain:SHUTTER.other)*(counter?SHUTTER.counter:1)*exposure;
 o.shutterHp=Math.max(0,(Number.isFinite(o.shutterHp)?o.shutterHp:o.shutterMax)-Math.max(1,Math.round(dmg*mul)));o.shutterState=o.shutterHp<=0?2:o.shutterHp<=o.shutterMax*SHUTTER.crack?1:0;
 const changed=o.shutterState!==old,broken=old<2&&o.shutterState===2;if(broken)setState(o,'stagger',now,1500,{skill:'shutter-break',target:null});return {state:o.shutterState,changed,broken,exposure};
}
function view(o){
 if(!enabled(o)||!o.alive||!o.combat)return null; const a=o.combat,def=SKILLS[a.skill],counter=def?.counter;
 return { id:o.id,x:round2(o.x),z:round2(o.z),yaw:round2(o.yaw||0),motion:a.state,skill:a.skill,seq:a.seq,part:o.shutterState||0,
  startedAt:a.startedAt,endsAt:a.endsAt,counterOpen:counter&&a.state==='skill'?a.startedAt+counter[0]:0,
  counterClose:counter&&a.state==='skill'?a.startedAt+counter[1]:0 };
}

module.exports={ CLAVE_IDS,SKILLS,ORDER,PHASE,SHUTTER,AGGRO,LEASH,STRIKE_REACH,WALK_SPEED,RETURN_SPEED,enabled,phaseOf,skillWeights,chooseSkill,setup,reset,tick,tryCounter,notePlayerResult,shutterExposure,damageShutter,view,inShape };
