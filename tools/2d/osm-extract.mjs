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
const AX=process.env.AXIS||'강남대로';
const axisWays=AX==='aerialway'?all.filter(e=>e.type==='way'&&e.tags&&/cable_car|gondola/.test(e.tags.aerialway||'')&&e.geometry):ways(AX);
const pts=axisWays.flatMap(w=>w.geometry.map(P)).filter(([x,z])=>Math.hypot(x,z)<(AX==='aerialway'?1000:300));
let sxx=0,szz=0,sxz=0; for(const [x,z] of pts){ sxx+=x*x; szz+=z*z; sxz+=x*z; }
const axis=0.5*Math.atan2(2*sxz, sxx-szz);   /* x 축에서 잰 각 (rad) */
const levels=t=>{ const h=parseFloat(t.height), l=parseFloat(t['building:levels']); return { height:Number.isFinite(h)?h:null, levels:Number.isFinite(l)?l:null }; };
const out={ zone:ZONE, license:'© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)', origin, axis:+axis.toFixed(5), fetched:new Date().toISOString().slice(0,10),
  buildings:[], roads:[], exits:[], pois:[], trees:[], crossings:[], signals:[], areas:[], aerialways:[], stations:[], lines:[] };
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
