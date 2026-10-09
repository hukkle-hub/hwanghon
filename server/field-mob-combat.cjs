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
function statsFor(catalogId) {
  const row = N01[catalogId] || N01.G5_WALKER;
  return { hp: row[0], damage: row[1], speed: row[2], cooldownMs: row[3],
    reach: 2.2, aggro: 10, leash: 18, windupMs: 600, recoveryMs: 450,
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
    ready:now, beat:0, seq:0, lastTick:now, path:null, routeAt:now, hitUntil:0 };
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
  const step=Math.min(d,s.speed*dt),next=[m.x+(q[0]-m.x)*step/d,m.z+(q[1]-m.z)*step/d];
  if(!nav.canTraverse(m.group.area,start,next)){a.path=null;return false;}
  [m.x,m.z]=next;return step>0;
}
function tick(m,a,s,players,now,nav) {
  if(!Number.isFinite(now)||now<a.lastTick)throw Error('Mob clock must be monotonic');
  const dt=Math.min(.1,(now-a.lastTick)/1000);a.lastTick=now;
  if(!m.alive){m.engaged=false;m.anim='die';a.target=null;return null;}
  const valid=p=>!p.dead&&!nav.safe(p)&&nav.legal(m.group.area,[p.x,p.z])&&dist(p,a.home)<=s.leash;
  let target=players.find(p=>p.id===a.target&&valid(p));
  if(!target&&a.phase!=='return') target=players.filter(p=>valid(p)&&dist(p,m)<=s.aggro)
    .sort((p,q)=>dist(p,m)-dist(q,m)||p.id.localeCompare(q.id))[0];
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
  if(now<a.hitUntil){m.anim='hit';return null;}
  if(a.phase==='windup'){
    m.anim='attack';if(now<a.until)return null;
    a.phase='recovery';a.until=now+s.recoveryMs;a.ready=now+s.cooldownMs;
    if(dist(m,target)<=s.reach&&nav.canTraverse(m.group.area,[m.x,m.z],[target.x,target.z]))
      return { target:target.id, damage:s.damage, skill:'mob_melee', beat:a.beat };
    return null;
  }
  if(a.phase==='recovery'&&now<a.until){m.anim='attack';return null;}
  if(dist(m,target)>s.reach){a.phase='chase';m.anim=advance(m,a,target,s,dt,now,nav)?'walk':'idle';return null;}
  if(now<a.ready){a.phase='idle';m.anim='idle';return null;}
  if(!nav.canTraverse(m.group.area,[m.x,m.z],[target.x,target.z])){m.anim='idle';return null;}
  a.phase='windup';a.until=now+s.windupMs;a.beat++;a.seq++;m.anim='attack';return null;
}
function stagger(a,now){a.seq++;a.hitUntil=now+180;a.phase='idle';a.ready=Math.max(a.ready,now+180);}
module.exports={statsFor,validateStats,reset,tick,stagger};
