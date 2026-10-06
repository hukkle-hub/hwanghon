/* 실제 공간 맵(강남역) 데이터 규약 — docs/design/185 §6.5, docs/licenses/osm.md */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const DIR=path.join(__dirname,'..','maps','2d','gangnam');
const osm=JSON.parse(fs.readFileSync(path.join(DIR,'osm.json'),'utf8'));
test('OSM 실측: 강남역 출구 1~12 가 전부 있고, 출처가 적혀 있고, 상호는 없다',()=>{
 const refs=osm.exits.map(e=>e.ref).sort((a,b)=>a-b);assert.deepEqual(refs,['1','2','3','4','5','6','7','8','9','10','11','12']);
 assert.match(osm.license,/OpenStreetMap/);assert.match(osm.license,/ODbL/);
 assert.ok(osm.buildings.length>300,'건물 '+osm.buildings.length);
 for(const p of osm.pois) assert.deepEqual(Object.keys(p).sort(),['kind','p'],'상가에는 업종·위치만 — 실제 상표를 싣지 않는다');
 /* 원작 EP02 «강남역 5번 출구» 는 사거리에서 남쪽으로 250~320 m 다 (실측) */
 const e5=osm.exits.find(e=>e.ref==='5'),d=Math.hypot(...e5.p);assert.ok(d>250&&d<320,'5번 출구 거리 '+d.toFixed(0));
});
test('구운 맵: 높이 규약, 타일 파일이 다 있고, 걷는 띠가 5번 출구와 출발점을 품는다',{skip:!fs.existsSync(path.join(DIR,'map.json'))},()=>{
 const m=JSON.parse(fs.readFileSync(path.join(DIR,'map.json'),'utf8'));
 assert.equal(m.depthMode,'height');assert.match(m.license,/OpenStreetMap/);assert.ok(m.tiles.length>100);
 for(const t of m.tiles){assert.ok(fs.existsSync(path.join(DIR,t.color)),t.color);assert.ok(fs.existsSync(path.join(DIR,t.depth)),t.depth);}
 const st=([x,z])=>{const a=m.road.ang;return [x*Math.cos(a)-z*Math.sin(a),-x*Math.sin(a)-z*Math.cos(a)];},inWalk=([s,t],pad=0)=>s>=m.walk.s0-pad&&s<=m.walk.s1+pad&&t>=m.walk.t0-pad&&t<=m.walk.t1+pad;
 const e5=m.exits.find(e=>e.ref==='5');assert.ok(inWalk(st([e5.x,e5.z]),3),'5번 출구가 걷는 띠 안(또는 3 m 이내)');
 assert.ok(inWalk(st([m.spawn.x,m.spawn.z])),'출발점이 걷는 띠 안');
 assert.ok(m.blockers.some(b=>b.poly&&b.poly.length>=3),'건물 윤곽 충돌');
});
