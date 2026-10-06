/* 지역 사이 문 · 보스 구역 · 던전 규약 — docs/design/185 §6.6
   리니지 «글루디오 던전» 처럼 필드에 서 있는 문으로 다른 지역(던전)에 들어간다. 문은 양쪽 지역에 짝이 있어야 한다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..'),MAPS=path.join(ROOT,'maps','2d');
const zones=fs.readdirSync(MAPS).filter(z=>fs.existsSync(path.join(MAPS,z,'map.json')));
const meta=z=>JSON.parse(fs.readFileSync(path.join(MAPS,z,'map.json'),'utf8'));
const st=(m,[x,z])=>{const a=m.road.ang;return [x*Math.cos(a)-z*Math.sin(a),-x*Math.sin(a)-z*Math.cos(a)];};
const inWalk=(m,p,pad=0)=>{const [s,t]=st(m,p);return s>=m.walk.s0-pad&&s<=m.walk.s1+pad&&t>=m.walk.t0-pad&&t<=m.walk.t1+pad;};
test('문은 양쪽에 짝이 있고, 걷는 띠 안에 있어 실제로 밟을 수 있다',()=>{
 let n=0;
 for(const z of zones){const m=meta(z);for(const g of m.gates||[]){n++;
  assert.ok(Number.isFinite(g.x)&&Number.isFinite(g.z)&&g.r>0,z+'/'+g.id+' 자리');
  assert.ok(inWalk(m,[g.x,g.z],1),z+'/'+g.id+' 가 걷는 띠 밖');
  assert.ok(zones.includes(g.to.zone),z+'/'+g.id+' → 없는 지역 '+g.to.zone);
  const back=(meta(g.to.zone).gates||[]).find(x=>x.id===g.to.gate);assert.ok(back,z+'/'+g.id+' → '+g.to.zone+'/'+g.to.gate+' 문이 없다');
  assert.equal(back.to.zone,z,g.to.zone+'/'+back.id+' 은 '+z+' 로 돌아와야 한다');}}
 assert.ok(n>=2,'문 '+n);
});
test('강남 → 5번 출구 → 강남역 지하상가 B1 던전 (원작 EP02)',{skip:!zones.includes('gangnam')},()=>{
 const g=meta('gangnam').gates.find(x=>x.id==='exit5');assert.ok(g,'5번 출구 문');assert.equal(g.to.zone,'gangnam_b1');assert.equal(g.kind,'dungeon');
 const e5=meta('gangnam').exits.find(e=>e.ref==='5');assert.ok(Math.hypot(e5.x-g.x,e5.z-g.z)<8,'문이 실제 5번 출구 자리');
});
test('던전: 물 높이·형광등 깜빡임·보스 구역(클레이브)이 맵에 있고 보스 모델이 실제로 있다',{skip:!zones.includes('gangnam_b1')},()=>{
 const m=meta('gangnam_b1');assert.equal(m.kind,'dungeon');assert.equal(m.depthMode,'height');
 assert.equal(m.water.y,0.9,'원작 «허리까지 잠겨»');assert.deepEqual(m.flicker,{on:3,off:1},'원작 «3초 켜짐. 1초 꺼짐»');
 for(const t of m.tiles){assert.ok(fs.existsSync(path.join(MAPS,'gangnam_b1',t.color)),t.color);assert.ok(fs.existsSync(path.join(MAPS,'gangnam_b1',t.depth)),t.depth);}
 const b=m.bosses.find(x=>x.id==='clave');assert.ok(b,'클레이브');assert.ok(fs.existsSync(path.join(ROOT,b.model)),b.model);assert.ok(inWalk(m,[b.x,b.z]),'보스가 걷는 띠 안');
 assert.ok(b.r>=12,'보스 구역 반지름 '+b.r);
 /* 출발점(5번 출구 계단)에서 보스까지 실제 상가 길이만큼 걸어야 한다 — 문 바로 옆에 보스가 있으면 던전이 아니다 */
 assert.ok(Math.hypot(m.spawn.x-b.x,m.spawn.z-b.z)>150,'출발점↔보스 '+Math.hypot(m.spawn.x-b.x,m.spawn.z-b.z).toFixed(0)+' m');
 assert.ok(inWalk(m,[m.spawn.x,m.spawn.z]),'출발점이 걷는 띠 안');
});
test('보스 구역은 문과 겹치지 않는다 (들어오자마자 보스 구역이면 안 된다)',()=>{
 for(const z of zones){const m=meta(z);for(const b of m.bosses||[])for(const g of m.gates||[]) assert.ok(Math.hypot(b.x-g.x,b.z-g.z)>b.r+g.r+5,z+': '+b.id+' ↔ '+g.id);}
});
test('지역 표(js/mmo/zones.js)와 구운 맵이 맞다 — 표에 없는 맵 없음, 문 짝·보스가 표와 같다',async()=>{
 const {ZONES}=await import('../js/mmo/zones.js');
 for(const z of zones){ assert.ok(ZONES[z],'표에 없는 맵 '+z); const m=meta(z),Z=ZONES[z];
  assert.ok(m.pxPerM===Z.px,z+' 해상도 '+m.pxPerM+' ≠ 표 '+Z.px);
  if(Z.env==='indoor'||Z.env==='field'){ const ids=(Z.gates||Z.field?.gates||[]).map(g=>g.id).sort(); assert.deepEqual((m.gates||[]).map(g=>g.id).sort(),ids,z+' 문'); }
  for(const b of m.bosses||[]) if(b.model) assert.ok(fs.existsSync(path.join(ROOT,b.model)),z+' 보스 모델 '+b.model); }
 for(const [id,Z] of Object.entries(ZONES)) if(Z.restart) assert.ok(ZONES[Z.restart.zone],id+' 되돌아갈 곳 '+Z.restart.zone);
});
test('타일 해시: map.json 의 h 가 실제 파일 내용과 맞다 (서비스워커가 해시로 캐시한다 — 틀리면 옛 그림이 남는다)',()=>{
 const crypto=require('node:crypto');
 for(const z of zones){ const m=meta(z); for(const t of m.tiles){ assert.ok(t.h,z+' '+t.color+' 해시 없음 — node tools/2d/tile-hashes.mjs '+z);
  const h=crypto.createHash('sha1'); h.update(fs.readFileSync(path.join(MAPS,z,t.color))); h.update(fs.readFileSync(path.join(MAPS,z,t.depth))); assert.equal(t.h,h.digest('hex').slice(0,10),z+' '+t.color+' 해시가 옛것 — 다시 구웠으면 tile-hashes 를 돌려라'); } }
});
