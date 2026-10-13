/* Review-only propagation candidate. No live KIT imports this module yet.
 * A visible front and contact query share one clock. Existing damage/range/
 * counter values are not changed here. 220ms is the water author's travel time;
 * promoting this window requires gameplay/visual review, not just unit tests. */
const {containsSurfaceContact}=require('./field-surface-contact.cjs');
const TRAVEL_MS=220, FADE_MS=630;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
function surfaceWaveFrame(skill,t,{cancelled=false,dying=false}={}) {
  const hit=skill?.hits?.[0],at=hit?.at;
  const empty={phase:'off',front:0,opacity:0,gather:0,damage:false};
  if(cancelled||dying||skill?.clip!=='atk_gill'||!Number.isFinite(at)||!Number.isFinite(t)||
     !Number.isFinite(skill.duration)||t<0||t>=skill.duration||at<0||at+TRAVEL_MS>skill.duration)return empty;
  const age=t-at;
  if(age<0)return{...empty,phase:'gather',gather:smooth((age+1050)/700)};
  if(age<=TRAVEL_MS)return{phase:'travel',front:smooth(age/TRAVEL_MS),opacity:1,gather:0,damage:age>0};
  if(age<TRAVEL_MS+FADE_MS)return{phase:'fade',front:1,opacity:1-smooth((age-TRAVEL_MS)/FADE_MS),gather:0,damage:false};
  return empty;
}
function waveContacts(contacts,frame) {
  if(!Array.isArray(contacts)||!frame?.damage||!Number.isFinite(frame.front)||frame.front<=0||frame.front>1)return [];
  return contacts.map(c=>({...c,range:c.range*frame.front}));
}
function createSurfaceWaveHitWindow(contacts,skill) {
  // One instance per cast. Never use the same ledger for the next cast.
  if(!Array.isArray(contacts)||!skill?.hits?.length||surfaceWaveFrame(skill,skill.hits[0].at+1).phase!=='travel')return null;
  const cones=JSON.parse(JSON.stringify(contacts)),cast=JSON.parse(JSON.stringify(skill));
  const end=cast.hits[0].at+TRAVEL_MS,seen=new Set();let last=-Infinity,closed=false;
  return {step(t,targets,{cancelled=false,dying=false}={}) {
    if(cancelled||dying){closed=true;return []}
    if(closed||!Number.isFinite(t)||t<0||t<=last||!Array.isArray(targets))return [];
    last=t;
    // Crossing the last sample at 20Hz must still process the final front once.
    // Positions are sampled by the caller at this tick, as in the existing KIT.
    const frame=surfaceWaveFrame(cast,Math.min(t,end)),active=waveContacts(cones,frame);
    const hits=[];
    for(const p of targets){
      if(!p||!(typeof p.id==='string'||Number.isFinite(p.id))||seen.has(p.id)||p.alive===false)continue;
      if(containsSurfaceContact(active,p)){seen.add(p.id);hits.push(p)}
    }
    if(t>=end)closed=true;
    return hits;
  }};
}
module.exports={TRAVEL_MS,FADE_MS,surfaceWaveFrame,waveContacts,createSurfaceWaveHitWindow};
