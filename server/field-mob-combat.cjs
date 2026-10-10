/* Shared field/offline decision layer. No filesystem, clock, random source or
   profile access. Field owns HP and applies returned strikes through bossStrike.
   N01 six-role numbers below mirror tools/ue/node-combat-rules.cjs STATS.
   Other species use a visibly DRAFT walker baseline, not their finished skills.
   No new level curve, G2 balance, reward table or XP curve is defined here. */
const N01 = Object.freeze({
  G5_WALKER: [5500, 850, 2.85, 1350], G5_RUNNER: [3200, 600, 5.2, 1100],
  G5_BREAKER: [7000, 700, 2.4, 1800], G5_STALKER: [4200, 800, 3.8, 1300],
  G5_ARMORED: [26000, 1500, 2.3, 2400], G5_RESONATOR: [5400, 640, 2.9, 1500]
});
// Named actions use existing N01 role rules (design 203), not new balance.
const ARMORED_ACTIONS = ['shield_bash','heavy_charge','shield_bash','overhead_crush'];
const ACTIONS = Object.freeze({G5_WALKER:'slow_combo',G5_RUNNER:'flank_swipe',
 G5_BREAKER:'structure_slam',G5_STALKER:'tracking_strike',G5_RESONATOR:'self_defence'});
const FACILITY_DAMAGE={G5_WALKER:300,G5_RUNNER:180,G5_BREAKER:900,G5_STALKER:200,G5_ARMORED:1400,G5_RESONATOR:220};
const MOTION_MS={slow_combo:2000,flank_swipe:1800,structure_slam:1800,heavy_slam:1800,tracking_strike:1300,shield_bash:1400,heavy_charge:1700,overhead_crush:2000,self_defence:1500};
function actionFor(id,index=0) {
 const key=id==='G5_ARMORED'?ARMORED_ACTIONS[((index%4)+4)%4]:ACTIONS[id]||'mob_melee';
 const windupMs=key==='heavy_charge'?1000:key==='overhead_crush'?1200:key==='shield_bash'?800:600;
 return {key,clip:key,windupMs,recoveryMs:450,counterAllowed:key!=='overhead_crush'};
}
/* Optional siege context uses existing target rules. Open-world maps without
   facility/NPC targets never manufacture destructible objectives. Distances m. */
function objectiveFor(id,v) {
 const has=k=>Number.isFinite(v[k])&&v[k]>=0, fallback=()=>has('player')?'player':'none';
 const facility=first=>first&&has('generator')?'generator':first&&has('comms')?'comms':has('gate')?'gate':has('generator')?'generator':has('comms')?'comms':'none';
 const plaza=!has('gate')&&has('generator');
 if(id==='G5_BREAKER'){const f=facility(true);return f==='none'?fallback():f;}
 if(id==='G5_RUNNER'){if(has('player')&&v.player<=3)return 'player';if(!v.flanked)return 'none';return has('npc')?'npc':has('generator')?'generator':has('comms')?'comms':fallback();}
 if(id==='G5_STALKER')return !v.flanked?'none':has('npc')?'npc':fallback();
 if(id==='G5_ARMORED'){if(plaza&&has('player')||has('player')&&v.player<=2.5)return 'player';return has('gate')?'gate':has('comms')?'comms':fallback();}
 if(id==='G5_RESONATOR'){if(has('player')&&v.player<=6)return 'player';if(has('ally'))return 'ally';}
 if(plaza&&has('player')||has('player')&&v.player<=9)return 'player';
 const f=facility(false);return f==='none'?fallback():f;
}
const npcScore=(role,npcRole,distance)=>role==='G5_STALKER'?({technician:1.5,medic:1.35}[npcRole]||1)-distance/10*.08:-distance;
function refreshResonance(mobs,states,now,cache={}) {
 const list=[...mobs.values()],sources=list.filter(m=>m.alive&&m.catalogId==='G5_RESONATOR'),signature=sources.map(m=>m.id+':'+m.generation).sort().join('|');
 if(cache.signature===signature&&now<(cache.nextAt||0))return;
 cache.signature=signature;cache.nextAt=now+400;
 for(const m of list){const a=states.get(m.id)?.ai;if(!a)continue;
  const buff=m.alive&&m.catalogId!=='G5_RESONATOR'&&sources.some(q=>Math.hypot(q.x-m.x,q.z-m.z)<=18);
  a.resonanceMove=buff?1.10:1;a.resonanceAttack=buff?1.12:1;
 }
}
function damageScale(id,a,now){return id==='G5_ARMORED'&&now>=(a.crackedUntil||0)?.25:1;}
function counter(a,grade,now){const key=a.action?.key;if(!ARMORED_ACTIONS.includes(key)||!['normal','perfect'].includes(grade)||key==='overhead_crush')return false;
 const perfect=key==='heavy_charge'&&grade==='perfect';a.crackedUntil=now+(perfect?9000:6000);
 a.hitUntil=now+(perfect?3150:1400);a.phase='idle';a.seq++;return true;}
/* Existing server/node-rules.cjs gradeCounter default: .25 s / .10 s.
   Attack input near contact is evaluated on the host clock, never client grade. */
function tryCounter(m,a,now){if(m.catalogId!=='G5_ARMORED'||a.phase!=='windup'||a.action?.counterAllowed===false)return null;
 const remaining=(a.until-now)/1000;if(remaining<0||remaining>.25)return null;
 const grade=remaining<=.10?'perfect':'normal';if(!counter(a,grade,now))return null;m.anim='hit';return grade;}
function statsFor(catalogId) {
  const row = N01[catalogId] || N01.G5_WALKER;
  return { hp: row[0], damage: row[1], speed: row[2], cooldownMs: row[3],
    // Walker/Runner actual deformed hand contact +0.25m victim torso. The
    // previous2.2m hit visibly struck air. The other four roles are unchanged.
    reach: ['G5_WALKER','G5_RUNNER'].includes(catalogId)?.85:2.2, aggro: 10, leash: 18, windupMs: 600, recoveryMs: 450,
    facilityDamage:FACILITY_DAMAGE[catalogId]||300,
    draft: !Object.hasOwn(N01, catalogId) };
}
function validateStats(s) {
  for (const [k, lo, hi] of [['hp',1,1e9],['damage',1,1e6],['speed',.1,7.5],
    ['cooldownMs',350,30000],['reach',.5,8],['aggro',1,28],['leash',1,60],
    ['windupMs',150,5000],['recoveryMs',100,5000]])
    if (!Number.isFinite(s?.[k]) || s[k] < lo || s[k] > hi) throw Error('Invalid mob stat: ' + k);
  return Object.freeze({ ...s });
}
const dist = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
function reset(m, now) {
  return { home:{x:m.x,z:m.z}, target:null, phase:'idle', until:now,
    ready:now, beat:0, seq:0, attackCount:0, action:null, resonanceMove:1,resonanceAttack:1,
    lastTick:now, path:null, routeAt:now, hitUntil:0 };
}
/* All terrain checks use the Ecology supplied by the caller. Unroutable movement
   holds position; never snap home, cross a sanctuary or silently teleport. */
function advance(m,a,goal,s,dt,now,nav) {
  const start=[m.x,m.z], end=[goal.x,goal.z];
  if (nav.canTraverse(m.group.area,start,end)) a.path=[end];
  else if(now>=a.routeAt){a.routeAt=now+1000;a.path=nav.route(m.group.area,start,end);}
  const q=a.path?.[0]; if(!q)return false;
  const d=Math.hypot(q[0]-m.x,q[1]-m.z);
  if(d<.08){a.path.shift();return false;}
  const step=Math.min(d,s.speed*(a.resonanceMove||1)*dt),next=[m.x+(q[0]-m.x)*step/d,m.z+(q[1]-m.z)*step/d];
  if(!nav.canTraverse(m.group.area,start,next)){a.path=null;return false;}
  [m.x,m.z]=next;return step>0;
}
/* Context is host-authored, never a packet supplied by a player. Facilities
   and NPCs retain host health; this layer only returns their strike id/kind. */
function roleGoal(m,a,players,context,nav) {
 const live=p=>p&&p.alive!==false&&!p.dead&&Number.isFinite(p.x)&&Number.isFinite(p.z);
 const closest=list=>list.filter(live).sort((p,q)=>dist(m,p)-dist(m,q)||String(p.id).localeCompare(String(q.id)))[0];
 const player=players.find(p=>p.id===a.target&&live(p))||closest(players),facilities=context.facilities||[],npcs=(context.npcs||[]).filter(live);
 const targets={player};for(const k of ['gate','generator','comms'])targets[k]=closest(facilities.filter(p=>p.kind===k));
 targets.npc=(m.catalogId==='G5_STALKER'&&npcs.find(p=>p.id===a.target))||npcs.sort((p,q)=>npcScore(m.catalogId,q.role,dist(m,q))-npcScore(m.catalogId,p.role,dist(m,p))||String(p.id).localeCompare(String(q.id)))[0];
 const pack=m.catalogId==='G5_RESONATOR'?(context.allies||[]).filter(p=>live(p)&&p.id!==m.id&&p.catalogId!=='G5_RESONATOR'&&dist(m,p)<=30):[];
 if(pack.length){const center={x:pack.reduce((s,p)=>s+p.x,0)/pack.length,z:pack.reduce((s,p)=>s+p.z,0)/pack.length};let dx=m.x-center.x,dz=m.z-center.z,d=Math.hypot(dx,dz);if(d<.01){dx=0;dz=-1;d=1;}
  targets.ally={id:'pack:'+m.id,kind:'hold',x:center.x+dx/d*3.5,z:center.z+dz/d*3.5};}
 const flank=(context.flankPoints||[]).filter(live),flanker=['G5_RUNNER','G5_STALKER'].includes(m.catalogId);
 if(flanker&&flank.length&&!a.flanked){const goal=closest(flank);if(dist(m,goal)<=.35)a.flanked=true;
  else if(!(m.catalogId==='G5_RUNNER'&&player&&dist(m,player)<=3))return {...goal,kind:'flank'};}
 const v=Object.fromEntries(Object.entries(targets).map(([k,p])=>[k,p?dist(m,p):-1]));v.flanked=!flank.length||!!a.flanked;
 const k=objectiveFor(m.catalogId,v),t=targets[k];if(!t)return null;
 return {...t,kind:k==='ally'?'hold':k};
}
function tick(m,a,s,players,now,nav,context=null) {
  if(!Number.isFinite(now)||now<a.lastTick)throw Error('Mob clock must be monotonic');
  const dt=Math.min(.1,(now-a.lastTick)/1000);a.lastTick=now;
  if(!m.alive){m.engaged=false;m.anim='die';a.target=null;a.supportHolding=false;return null;}
  // A support hold or flank waypoint must not overwrite a real hit reaction.
  // Evaluate this before the context branches that can return early.
  if(now<a.hitUntil){m.anim='hit';a.supportHolding=false;return null;}
  const valid=p=>!p.dead&&!nav.safe(p)&&nav.legal(m.group.area,[p.x,p.z])&&dist(p,a.home)<=s.leash;
  let target=players.find(p=>p.id===a.target&&valid(p));
  if(!target&&a.phase!=='return') target=players.filter(p=>valid(p)&&dist(p,m)<=s.aggro)
    .sort((p,q)=>dist(p,m)-dist(q,m)||p.id.localeCompare(q.id))[0];
  if(context){target=roleGoal(m,a,players.filter(p=>valid(p)&&(p.id===a.target||dist(p,m)<=s.aggro)),context,nav);
   if(target&&!nav.legal(m.group.area,[target.x,target.z]))target=null;
   if(target&&['hold','flank'].includes(target.kind)){
    a.target=null;a.phase='idle';m.engaged=true;
    m.anim=dist(m,target)>.35&&advance(m,a,target,s,dt,now,nav)?'walk':'idle';
    const holding=target.kind==='hold'&&m.anim==='idle';
    // Cast once on entering a stationary support hold, not once forever and
    // not every tick. This is visual state only; passive buff rules stay fixed.
    if(holding&&!a.supportHolding){a.seq++;a.action={key:'aura_cast',clip:'aura_cast',windupMs:600,startAt:now,seq:a.seq,support:true};}
    a.supportHolding=holding;return null;
   }}
  a.supportHolding=false;
  if(!target){
    a.target=null;
    if(m.engaged||a.phase==='return'){
      a.phase='return';m.engaged=true;
      if(dist(m,a.home)<.25){a.phase='idle';m.engaged=false;m.anim='idle';a.path=null;m.routePoint=0;}
      else m.anim=advance(m,a,a.home,s,dt,now,nav)?'walk':'idle';
    }
    return null;
  }
  if(a.target!==target.id&&a.phase==='windup'){a.phase='idle';a.until=now;a.ready=Math.max(a.ready,now+150);}
  a.target=target.id;m.engaged=true;
  if(a.phase==='windup'){
    m.anim='attack';if(a.action?.key==='heavy_charge'&&now>=a.until-300)advance(m,a,target,s,dt,now,nav);if(now<a.until)return null;
    a.phase='recovery';a.until=now+(a.action?.recoveryMs??s.recoveryMs);a.ready=now+s.cooldownMs;
    if(dist(m,target)<=s.reach&&nav.canTraverse(m.group.area,[m.x,m.z],[target.x,target.z]))
      return { target:target.id, ...(target.kind&&target.kind!=='player'?{targetKind:target.kind}:{}), damage:(['gate','generator','comms'].includes(target.kind)?s.facilityDamage:s.damage)*(a.resonanceAttack||1), skill:a.action?.key||'mob_melee', beat:a.beat };
    return null;
  }
  if(a.phase==='recovery'&&now<a.until){m.anim='attack';return null;}
  if(dist(m,target)>s.reach){a.phase='chase';m.anim=advance(m,a,target,s,dt,now,nav)?'walk':'idle';return null;}
  if(now<a.ready){a.phase='idle';m.anim='idle';return null;}
  if(!nav.canTraverse(m.group.area,[m.x,m.z],[target.x,target.z])){m.anim='idle';return null;}
  const action=actionFor(m.catalogId,a.attackCount++);a.beat++;a.seq++;
  if(m.catalogId==='G5_BREAKER'&&(!target.kind||target.kind==='player'))action.key=action.clip='heavy_slam';
  // Non-N01 injected stats retain the test/host's windup; N01 armored tells
  // use the locked 800/1000/1200 ms sequence.
  if(m.catalogId!=='G5_ARMORED')action.windupMs=s.windupMs;
  // Recovery must finish the baked action; do not let AI walk away while the
  // visual is still striking. Custom host/test timings remain explicitly theirs.
  action.recoveryMs=s.windupMs===600&&s.recoveryMs===450&&Object.hasOwn(N01,m.catalogId)?Math.max(s.recoveryMs,MOTION_MS[action.key]-action.windupMs):s.recoveryMs;
  a.action={...action,startAt:now,damageAt:now+action.windupMs,seq:a.seq,target:target.id,targetKind:target.kind||'player',targetX:target.x,targetZ:target.z};
  a.phase='windup';a.until=a.action.damageAt;m.anim='attack';return null;
}
function stagger(a,now){a.seq++;a.hitUntil=now+180;a.phase='idle';a.ready=Math.max(a.ready,now+180);}
/* Patrol stays on the Ecology's walking speed. Combat movement uses the
   existing Runner speed (5.2 m/s), not a newly invented burst multiplier.
   Share this metadata builder between host and offline practice. */
function visualAction(m,a,now){
 let action=a.action?{...a.action}:null;
 if(['G5_RUNNER','G5_WALKER'].includes(m.catalogId)&&m.anim==='walk'){
  const locomotion=m.engaged?'run':'walk';
  action={...(action||{key:'locomotion',windupMs:600,seq:a.seq,startAt:a.lastTick}),locomotion};
 }
 if(action&&Number.isFinite(now)&&Number.isFinite(action.startAt))action.elapsedMs=Math.max(0,now-action.startAt);
 return action;
}
module.exports={statsFor,validateStats,reset,tick,stagger,actionFor,objectiveFor,roleGoal,npcScore,refreshResonance,damageScale,counter,tryCounter,visualAction};
