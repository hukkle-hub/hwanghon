/* 넓은 필드의 하위 구역·미니맵 (docs/design/190 §5)
   지역 표(js/mmo/zones.js)의 hunts 가 구운 맵(map.json areas)에 그대로 있고, 걷는 띠 안에 있다. 필드마다 미니맵이 있고 그 범위가 띠를 덮는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const MAPS=path.join(__dirname,'..','maps','2d');
const zonesP=import('../js/mmo/zones.js');
const st=(m,x,z)=>{ const a=m.road.ang,c=Math.cos(a),s=Math.sin(a); return [x*c-z*s,-x*s-z*c]; };   /* mmo.html toRoad 와 같다 */
test('하위 구역: 표의 hunts 가 map.json areas 에 있고, 가운데가 걷는 띠 안에 있다',async()=>{
 const {ZONES}=await zonesP; let n=0;
 for(const [id,z] of Object.entries(ZONES)){ if(!z.hunts) continue; const m=JSON.parse(fs.readFileSync(path.join(MAPS,id,'map.json'),'utf8'));
  for(const h of z.hunts){ const a=(m.areas||[]).find(x=>x.id===h.id&&['hunt','rest','siege'].includes(x.kind)); assert.ok(a,id+' '+h.id+' 가 구운 맵에 없다 — node tools/2d/patch-areas.mjs '+id); assert.equal(a.name,h.name);
   const [cx,cz]=a.circle?a.circle:[a.poly.reduce((q,p)=>q+p[0],0)/4,a.poly.reduce((q,p)=>q+p[1],0)/4], [s,t]=st(m,cx,cz), w=m.walk;
   assert.ok(s>w.s0-1&&s<w.s1+1&&t>w.t0-1&&t<w.t1+1,id+' '+h.id+' 가운데 (s '+s.toFixed(0)+', t '+t.toFixed(0)+') 가 걷는 띠 밖'); n++; } }
 assert.ok(n>=20,'구역 '+n);
});
test('미니맵: 모든 지역에 overview 가 있고, 그림 범위가 걷는 띠의 네 귀퉁이를 덮는다',async()=>{
 const {ZONES}=await zonesP;
 for(const id of Object.keys(ZONES)){ const m=JSON.parse(fs.readFileSync(path.join(MAPS,id,'map.json'),'utf8')), o=m.overview; assert.ok(o,id+' 미니맵 없음 — bake-overview.mjs'); assert.ok(fs.existsSync(path.join(MAPS,id,o.file)),id+' '+o.file);
  const a=m.road.ang,w=m.walk,FR=(s,t)=>[s*Math.cos(a)-t*Math.sin(a),-s*Math.sin(a)-t*Math.cos(a)];
  for(const [s,t] of [[w.s0,w.t0],[w.s1,w.t0],[w.s1,w.t1],[w.s0,w.t1]]){ const [x,z]=FR(s,t), u=x, v=-z*Math.sin(m.pitch); assert.ok(u>=o.u0&&u<=o.u1&&v>=o.v0&&v<=o.v1,id+' 띠 귀퉁이가 미니맵 밖 — 띠를 바꿨으면 다시 찍어라'); } }
});
