/* Server-owned projections of existing 3D room rules. No client supplied areas.
 * Node 24 reads the same ESM numbers/functions as world3d; no duplicated balance.
 * Geometry mirrors env-indoor safezone/corridor only (not walls or other devices). */
const {ZONES}=require('../js/mmo/zones.js');
const {SAFE,safeAt,swingK,narrowAt}=require('../js/mmo/env-rules.js');
const round=v=>+v.toFixed(2),cache=new WeakMap();
function buildAreas(zone,ang){
 const areas={safe:[],narrows:[]};
 if(!Number.isFinite(ang)||!zone?.indoor?.rooms)return areas;
 const c=Math.cos(ang),s=Math.sin(ang),point=(u,v)=>({x:round(u*c-v*s),z:round(-u*s-v*c)});
 for(const r of zone.indoor.rooms){
  const s0=Math.min(...r.s),s1=Math.max(...r.s),t0=Math.min(...r.t),t1=Math.max(...r.t);
  for(const o of r.props||[]){
   if(o.k==='safezone')areas.safe.push({...point(s0+(s1-s0)*(o.u??.5),t0+(t1-t0)*(o.v??.5)),r:o.r||SAFE.r});
   if(o.k==='corridor'){const w=o.width??2.6;areas.narrows.push({...point((s0+s1)/2,(t0+t1)/2),hw:round((s1-s0)/2),hd:round(w/2),rot:ang,w})}
  }
 }
 return areas;
}
function areasFor(z){
 if(!z||typeof z!=='object')return {safe:[],narrows:[]};
 if(!cache.has(z))cache.set(z,buildAreas(ZONES[z.id],z.ang));
 return cache.get(z);
}
function modifiers(z,p){
 if(!z||p?.zone!==z.id||![p.x,p.z].every(Number.isFinite))return {damage:1,knock:1,swing:1};
 const a=areasFor(z),k=safeAt(a.safe,p.x,p.z)?SAFE.k:1;
 return {damage:k,knock:k,swing:swingK(narrowAt(a.narrows,p.x,p.z))};
}
module.exports={buildAreas,areasFor,modifiers};
