/* Explicit local/test opt-in only. No packet, env var or automatic asset loading.
 * Fixed Leviathan body faces +Z; its beam aim yaw must NOT rotate the gills.
 * Uses the real KIT lifecycle and caller's bossStrike, not a second damage model. */
const {bindSurfaceContactProfile,containsSurfaceContact}=require('./field-surface-contact.cjs');
const {createSurfaceWaveHitWindow,TRAVEL_MS}=require('./field-surface-wave.cjs');
const bindings=new WeakMap(),casts=new WeakMap();
function configure(o,profile,skill){
 if(!o||o.id!=='leviathan'||!o.kit||o.kit.state==='skill')return false;
 if(profile===null){bindings.delete(o);casts.delete(o);return true}
 const bound=bindSurfaceContactProfile(profile);
 if(!bound||bound.contacts(skill,skill?.hits?.[0]).length!==2)return false;
 bindings.set(o,bound);casts.delete(o);return true;
}
function enabled(o){return bindings.has(o)}
function clear(o){casts.delete(o)}
function canReach(o,skill,p){return containsSurfaceContact(bindings.get(o)?.contacts(skill,skill.hits[0],o.x,o.z),p)}
function begin(o,skill){
 if(!enabled(o)||o.kit.skill!=='gill')return;
 const cones=bindings.get(o).contacts(skill,skill.hits[0],o.x,o.z);
 casts.set(o,{state:o.kit,seq:o.kit.seq,start:o.kit.startedAt,skill,
  window:createSurfaceWaveHitWindow(cones,skill),last:-Infinity,guards:new Map()});
}
function step(field,o,now,players){
 const a=o.kit,c=casts.get(o);
 if(!c||c.state!==a||c.seq!==a.seq||!o.alive||a.state!=='skill'||a.skill!=='gill'){clear(o);return}
 if(!Number.isFinite(now)||now<=c.last)return;
 const end=c.start+c.skill.hits[0].at+TRAVEL_MS,prior=c.last;c.last=now;
 const eligible=players.filter(p=>!p.dead&&p.alive!==false&&Number.isFinite(p.hp));
 for(const p of c.window?.step(now-c.start,eligible)||[]){
  // Endpoint positions are interpolated, not a complete defense history.
  // Never damage a target whose prior observed guard covered that endpoint.
  const old=c.guards.get(p.id);
  if(now>end&&prior<end&&old&&(old.dodgeUntil>end||old.invulnUntil>end))continue;
  field.bossStrike(o,p,{...c.skill.hits[0],skill:'gill',beat:1,beats:1},now);
 }
 c.guards=new Map(eligible.map(p=>[p.id,{dodgeUntil:p.dodgeUntil||0,invulnUntil:p.invulnUntil||0}]));
}
module.exports={configure,enabled,clear,canReach,begin,step};
