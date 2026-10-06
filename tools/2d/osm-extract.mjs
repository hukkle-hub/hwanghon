// 실제 공간 → 맵 원본 데이터 (docs/design/185 §6.5)
// OpenStreetMap(Overpass) 원본 JSON 여러 개 → maps/2d/<zone>/osm.json (로컬 미터 좌표, 필요한 태그만)
//   node tools/2d/osm-extract.mjs <원본 폴더> [zone=gangnam]
//   다른 지역: ORIGIN=위도,경도 AXIS=<도로 이름 | aerialway> node tools/2d/osm-extract.mjs <폴더> namsan
//     (강남은 강남대로 × 테헤란로 교차점 · 강남대로 축 — 기본값)
// 좌표: 원점 = 강남대로 × 테헤란로 교차점. x = 동쪽 m, z = 남쪽 m (three.js 처럼 북쪽이 -z) — 회전은 env 가 한다.
// 지도 데이터 © OpenStreetMap contributors, ODbL 1.0 — 파생 데이터도 같은 조건이다(docs/licenses/osm.md).
import fs from 'node:fs'; import path from 'node:path';
const SRC=process.argv[2], ZONE=process.argv[3]||'gangnam'; if(!SRC){ console.error('원본 폴더를 주세요'); process.exit(1); }
const els=new Map();
for(const f of fs.readdirSync(SRC).filter(f=>/^osm-.*\.json$/.test(f))){ let j; try{ j=JSON.parse(fs.readFileSync(path.join(SRC,f),'utf8')); }catch{ continue; } for(const e of j.elements||[]) els.set(e.type+e.id,e); }
const all=[...els.values()];
/* 교차점: 강남대로·테헤란로 웨이가 공유하는 노드, 없으면 가장 가까운 두 점의 중점 */
const ways=n=>all.filter(e=>e.type==='way'&&e.tags&&e.tags.name===n&&e.geometry);
const G=ways('강남대로'), T=ways('테헤란로'); let origin=null, best=1e9;
for(const a of G) for(const p of a.geometry) for(const b of T) for(const q of b.geometry){ const d=(p.lat-q.lat)**2+(p.lon-q.lon)**2; if(d<best){ best=d; origin={ lat:(p.lat+q.lat)/2, lon:(p.lon+q.lon)/2 }; } }
if(!origin) origin={ lat:37.49795, lon:127.02763 };
if(process.env.ORIGIN){ const [la,lo]=process.env.ORIGIN.split(',').map(Number); origin={ lat:la, lon:lo }; }
const KX=111320*Math.cos(origin.lat*Math.PI/180), KZ=110540;
const P=g=>[+((g.lon-origin.lon)*KX).toFixed(2), +(-(g.lat-origin.lat)*KZ).toFixed(2)];
/* 강남대로 방향: 교차점 남북 300 m 안 강남대로 점들의 주축 (최소제곱) */
let AX=process.env.AXIS||'강남대로';
/* AXIS=auto — 지역 찍어 내기(docs/design/192): 원점 350 m 안에서 «가장 큰 길» 을 축으로. 길 등급 × 원 안 길이를 이름별로 더해 고르고,
   원점을 그 길 위 가장 가까운 점으로 옮긴다(띠 가운데 = 길 가운데). 고속도로는 걷는 곳이 아니라서 뺀다 */
if(AX==='auto'){ const RANK={trunk:5,primary:4.5,secondary:3.5,tertiary:2.5,unclassified:1.2,residential:1,living_street:1,pedestrian:1.5}, score=new Map(), RAD=350;
  for(const e of all){ const t=e.tags||{}, k=(t.highway||'').replace('_link',''); if(e.type!=='way'||!e.geometry||!RANK[k]||t.tunnel||t.area==='yes') continue;
    const key=t.name||('#'+e.id), g=e.geometry.map(P); let len=0; for(let i=1;i<g.length;i++){ const m=[(g[i][0]+g[i-1][0])/2,(g[i][1]+g[i-1][1])/2]; if(Math.hypot(...m)<RAD) len+=Math.hypot(g[i][0]-g[i-1][0],g[i][1]-g[i-1][1]); }
    if(len>0) score.set(key,(score.get(key)||0)+len*RANK[k]*(t.highway.endsWith('_link')?0.3:1)); }
  const best=[...score.entries()].sort((a,b)=>b[1]-a[1]); if(!best.length){ console.error('원점 둘레에 길이 없다'); process.exit(1); }
  AX=best[0][0]; console.log('축 후보',best.slice(0,4).map(([k,v])=>k+' '+v.toFixed(0)).join(' · '));
}
const axisWays=AX.startsWith('#')?all.filter(e=>'#'+e.id===AX):AX==='aerialway'?all.filter(e=>e.type==='way'&&e.tags&&/cable_car|gondola/.test(e.tags.aerialway||'')&&e.geometry):ways(AX);
/* 원점을 축 길 위로 (AXIS=auto 이거나 SNAP=1) — 띠 가운데 = 길 가운데 */
if(process.env.AXIS==='auto'||process.env.SNAP){
  const W0=AX.startsWith('#')?all.filter(e=>'#'+e.id===AX):ways(AX); let near=null;
  for(const w of W0){ const g=w.geometry; for(let i=1;i<g.length;i++){ const a=P(g[i-1]), b=P(g[i]), dx=b[0]-a[0], dz=b[1]-a[1], L2=dx*dx+dz*dz||1, u=Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dz)/L2)), q=[a[0]+dx*u,a[1]+dz*u], d=Math.hypot(...q); if(!near||d<near.d) near={d,q}; } }
  if(near&&near.d<(process.env.AXIS==='auto'?150:300)){ origin={ lat:origin.lat-near.q[1]/KZ, lon:origin.lon+near.q[0]/KX }; console.log('원점을 길 위로',near.d.toFixed(0)+' m'); } }
const pts=axisWays.flatMap(w=>w.geometry.map(P)).filter(([x,z])=>Math.hypot(x,z)<(AX==='aerialway'?1000:300));
/* 평균을 빼고 잰다 — 원점이 길 위가 아니면(여의도: IFC) 축이 엉뚱하게 나왔다 */
const mx=pts.reduce((a,p)=>a+p[0],0)/(pts.length||1), mz=pts.reduce((a,p)=>a+p[1],0)/(pts.length||1);
let sxx=0,szz=0,sxz=0; for(const [x0,z0] of pts){ const x=x0-mx, z=z0-mz; sxx+=x*x; szz+=z*z; sxz+=x*z; }
const axis=0.5*Math.atan2(2*sxz, sxx-szz);   /* x 축에서 잰 각 (rad) */
const levels=t=>{ const h=parseFloat(t.height), l=parseFloat(t['building:levels']); return { height:Number.isFinite(h)?h:null, levels:Number.isFinite(l)?l:null }; };
const out={ zone:ZONE, license:'© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)', origin, axis:+axis.toFixed(5), fetched:new Date().toISOString().slice(0,10),
  buildings:[], roads:[], exits:[], pois:[], trees:[], crossings:[], signals:[], areas:[], aerialways:[], stations:[], lines:[] };
/* 관계(멀티폴리곤): 바깥(outer) 웨이들을 끝점끼리 이어 고리로 — 섬(inner)은 버린다 */
const rings=rel=>{ const segs=(rel.members||[]).filter(m=>m.type==='way'&&m.role!=='inner'&&m.geometry&&m.geometry.length>1).map(m=>m.geometry.map(P)), out=[], same=(a,b)=>Math.abs(a[0]-b[0])<0.05&&Math.abs(a[1]-b[1])<0.05;
  while(segs.length){ let r=segs.shift().slice(); for(let k=0;k<5000&&!same(r[0],r.at(-1));k++){ const i=segs.findIndex(g=>same(g[0],r.at(-1))||same(g.at(-1),r.at(-1))); if(i<0) break; const g=segs.splice(i,1)[0]; r=r.concat(same(g[0],r.at(-1))?g.slice(1):g.slice().reverse().slice(1)); }
    if(r.length>3) out.push(r); } return out; };
for(const e of all){ if(e.type!=='relation') continue; const t=e.tags||{}, kind=t.natural||t.landuse||t.leisure||(t.waterway==='riverbank'?'water':null); if(!kind) continue;
  for(const poly of rings(e)) out.areas.push({ id:e.id, poly, kind, name:t.name||null, rel:true }); }
for(const e of all){ const t=e.tags||{};
  if(e.type==='way'&&e.geometry&&t.building&&e.geometry.length>=4){ out.buildings.push({ id:e.id, poly:e.geometry.map(P), ...levels(t), kind:t.building, name:t.name||null, under:t.layer&&+t.layer<0||t.location==='underground'||/지하/.test(t.name||'') }); continue; }
  if(e.type==='way'&&e.geometry&&t.highway){ out.roads.push({ id:e.id, line:e.geometry.map(P), kind:t.highway, name:t.name||null, lanes:+t.lanes||null, width:parseFloat(t.width)||null, oneway:t.oneway==='yes', layer:+t.layer||0, bridge:!!t.bridge, tunnel:!!t.tunnel, area:t.area==='yes' }); continue; }
  if(e.type==='way'&&e.geometry&&t.aerialway){ if(t.aerialway==='station') out.stations.push({ id:e.id, poly:e.geometry.map(P), name:t.name||null }); else out.aerialways.push({ id:e.id, line:e.geometry.map(P), kind:t.aerialway, name:t.name||null }); continue; }
  /* 선: 철길·물길·해안선·활주로·방파제 (넓이가 없는 웨이) */
  const closed=e.geometry&&e.geometry.length>3&&e.geometry[0].lat===e.geometry.at(-1).lat&&e.geometry[0].lon===e.geometry.at(-1).lon;
  if(e.type==='way'&&e.geometry&&(t.railway||t.waterway&&t.waterway!=='riverbank'||t.natural==='coastline'||t.aeroway&&!closed||t.man_made&&/pier|breakwater|groyne|dyke|embankment/.test(t.man_made)&&!closed)){
    out.lines.push({ id:e.id, line:e.geometry.map(P), kind:t.railway?'rail:'+t.railway:t.waterway?'water:'+t.waterway:t.natural==='coastline'?'coastline':t.aeroway?'aero:'+t.aeroway:'man:'+t.man_made, width:parseFloat(t.width)||null, tunnel:!!t.tunnel, bridge:!!t.bridge, layer:+t.layer||0, name:t.name||null }); continue; }
  if(e.type==='way'&&e.geometry&&(t.aeroway||t.man_made||t.waterway==='riverbank')&&closed){ out.areas.push({ id:e.id, poly:e.geometry.map(P), kind:t.aeroway?'aero:'+t.aeroway:t.man_made?'man:'+t.man_made:'water', name:t.name||null }); continue; }
  if(e.type==='way'&&e.geometry&&(t.landuse||t.leisure||t.natural||t.amenity==='parking')){ out.areas.push({ id:e.id, poly:e.geometry.map(P), kind:t.landuse||t.leisure||t.natural||t.amenity, name:t.name||null }); continue; }
  if(e.type==='node'&&t.aerialway==='station'){ out.stations.push({ p:P(e), name:t.name||null }); continue; }
  if(e.type==='node'&&t.railway==='station'){ out.stations.push({ p:P(e), name:t.name||null, kind:'rail' }); continue; }
  if(e.type==='node'&&t.railway==='subway_entrance'){ out.exits.push({ ref:t.ref||null, p:P(e), name:t.description||t.name||null }); continue; }
  if(e.type==='node'&&t.natural==='tree'){ out.trees.push(P(e)); continue; }
  if(e.type==='node'&&t.highway==='crossing'){ out.crossings.push(P(e)); continue; }
  if(e.type==='node'&&t.highway==='traffic_signals'){ out.signals.push(P(e)); continue; }
  if(e.type==='node'&&(t.shop||t.amenity)){ out.pois.push({ p:P(e), kind:t.shop?'shop:'+t.shop:'amenity:'+t.amenity }); }   /* 상호는 버린다 — 실제 상표를 게임에 쓰지 않는다 */
}
const dir=path.join('maps','2d',ZONE); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'osm.json'), JSON.stringify(out));
console.log('원점',origin.lat.toFixed(6),origin.lon.toFixed(6),'· '+AX+' 축',(axis*180/Math.PI).toFixed(1)+'°','· 건물',out.buildings.length,'도로',out.roads.length,'출구',out.exits.length,'상가',out.pois.length,'나무',out.trees.length,'횡단보도',out.crossings.length,'신호',out.signals.length,'→',path.join(dir,'osm.json'),(fs.statSync(path.join(dir,'osm.json')).size/1e3).toFixed(0)+' KB');
console.log('출구',out.exits.map(e=>e.ref+':'+e.p.join(',')).join('  '));
