/* 황혼의 한국 — 전국 지역 목록과 지도 (docs/design/192)
   원작 동선은 실제 구운 지역을 가리키고, 모든 지역은 전국 지도 그림 안에 찍히며, 레벨은 «강남에서 멀수록» 이다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const regionsP=import('../js/mmo/regions.js'), zonesP=import('../js/mmo/zones.js');
const WM=JSON.parse(fs.readFileSync(path.join(__dirname,'..','maps','world','korea.json'),'utf8'));
const P=(lat,lon)=>{ const n=2**WM.z*256, s=Math.sin(lat*Math.PI/180); return [(lon+180)/360*n-WM.px0, (0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n-WM.py0]; };   /* mmo.html openWorld 와 같다 */
test('지역: id 가 겹치지 않고, zone 은 구운 지역이며, 원작 동선 8곳이 모두 있다',async()=>{
 const {REGIONS}=await regionsP, {ZONES}=await zonesP;
 assert.equal(new Set(REGIONS.map(r=>r.id)).size,REGIONS.length,'id 중복');
 for(const r of REGIONS) if(r.zone){ assert.ok(ZONES[r.zone],r.id+' → '+r.zone+' 가 zones.js 에 없다'); assert.ok(fs.existsSync(path.join(__dirname,'..','maps','2d',r.zone,'map.json')),r.zone+' 맵이 안 구워졌다'); }
 assert.deepEqual(REGIONS.filter(r=>r.story).map(r=>r.zone),['gangnam','namsan','yeouido','namtae','pangyo','southroad','gyeryong','goheung']);
});
test('전국 지도: 모든 지역이 그림 안(가장자리 2% 안쪽)에 찍힌다',async()=>{
 const {REGIONS}=await regionsP; assert.ok(fs.existsSync(path.join(__dirname,'..','maps','world',WM.file)),WM.file+' 없음');
 for(const r of REGIONS){ const [x,y]=P(r.lat,r.lon); assert.ok(x>WM.w*.02&&x<WM.w*.98&&y>WM.h*.02&&y<WM.h*.98,r.id+' 가 지도 밖 ('+x.toFixed(0)+', '+y.toFixed(0)+')'); }
});
test('레벨: 거점은 안전 지대(없음), 그 밖은 강남에서 멀수록 높다',async()=>{
 const {REGIONS,levelOf,distKm}=await regionsP;
 for(const r of REGIONS){ const lv=levelOf(r); if(r.kind==='hub'&&!r.lv){ assert.equal(lv,null,r.id); continue; } assert.ok(lv&&lv[0]>=1&&lv[1]>lv[0],r.id+' '+lv); }
 const free=REGIONS.filter(r=>!r.lv&&r.kind!=='hub').sort((a,b)=>distKm(a)-distKm(b));
 for(let i=1;i<free.length;i++) assert.ok(levelOf(free[i])[0]>=levelOf(free[i-1])[0],free[i].id+' 가 더 먼데 레벨이 낮다');
 assert.ok(Math.abs(distKm({lat:35.1150,lon:129.0422})-325)<15,'부산역까지 약 325 km');
});
