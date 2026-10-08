/* 전국 16권역 (docs/design/202 §8) — 패키지 validate_korea_world.py 가 보던 것(권역 16, 거점 74, id 겹침 없음, 회랑 밖 권역 없음)에
   우리가 만든 것(허브 하나, 권역 안 연결, 생성기와 파일이 같음, 회랑 번짐·필드 보스, 전국 작전 단계)을 더해 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const G=require('../server/region-rules.cjs'),{Store}=require('../server/store.cjs'),NODE=require('../server/node-store.cjs');
const DATA=path.join(__dirname,'..','ue','HwanghonCombatUE','Content','Data'), KOREA=JSON.parse(fs.readFileSync(path.join(DATA,'korea.json'),'utf8'));
test('데이터: 16권역 · 거점 74 · id 겹침 없음 · 권역마다 허브 하나 · 권역 안이 다 이어짐 · 모든 권역이 회랑 위',()=>{
 assert.equal(KOREA.regions.length,16); const ids=new Set(); let total=0;
 for(const meta of KOREA.regions){ const cfg=G.loadRegion(meta.id); total+=cfg.nodes.length;
  for(const n of cfg.nodes){ assert.ok(!ids.has(n.id),'겹치는 id '+n.id); ids.add(n.id); }
  const hubs=cfg.nodes.filter(n=>n.tier===3); assert.equal(hubs.length,1,meta.id+' 허브 '+hubs.length); assert.equal(hubs[0].id,meta.hub);
  const adj=new Map(cfg.nodes.map(n=>[n.id,[]])); for(const l of cfg.links){ adj.get(l.a).push(l.b); adj.get(l.b).push(l.a); }
  const seen=new Set([meta.hub]), q=[meta.hub]; while(q.length) for(const x of adj.get(q.shift())) if(!seen.has(x)){ seen.add(x); q.push(x); }
  assert.equal(seen.size,cfg.nodes.length,meta.id+' 끊긴 거점'); }
 assert.equal(total,74);
 const onCorridor=new Set(KOREA.corridors.flatMap(c=>c.regions)); assert.deepEqual(KOREA.regions.map(r=>r.id).filter(id=>!onCorridor.has(id)),[]);
 for(const c of KOREA.corridors) for(const id of c.regions) assert.ok(KOREA.regions.some(r=>r.id===id),c.id+' 의 '+id);
});
test('생성기와 파일이 같다 — 권역 파일을 손으로 고치면 여기서 깨진다',()=>{
 const before=fs.readdirSync(DATA).filter(f=>/^region_.*\.json$|^korea\.json$/.test(f)).map(f=>[f,fs.readFileSync(path.join(DATA,f),'utf8')]);
 execFileSync('node',[path.join(__dirname,'..','tools','build-korea-regions.cjs')],{stdio:'pipe'});
 for(const [f,txt] of before) assert.equal(fs.readFileSync(path.join(DATA,f),'utf8'),txt,f+' 가 생성기 출력과 다르다');
});
test('권역 사이 번짐: 서울이 위기면 회랑 옆 인천·경기 허브가 흔들리고, 부산·제주는 그대로 · 압력은 점령에서만 → 스스로 안 굴러간다',()=>{
 const store=new Store(null), t=97*NODE.WEEK, g=store.guest('함락'); store.chooseName(g.profile.id,'함락자','ain');
 store.nationalView(t); store.nodeReport(g.profile.id,'namsan_n01',{outcome:'fallen',contrib:{kill:1}},t);   // 남산 판이 무너진다 (점령은 판에서만)
 const v=store.nationalView(t+36*NODE.HOUR), by=Object.fromEntries(v.regions.map(r=>[r.id,r]));
 assert.ok(by.seoul.pressure>=75,'서울 압력 '+by.seoul.pressure); assert.equal(by.busan.pressure,0); assert.equal(by.incheon.pressure,0,'번짐이 압력까지 올렸다(스스로 굴러간다)');
 const hub=id=>{ const {r}=store.regionLoad(id); return r.nodes[KOREA.regions.find(m=>m.id===id).hub]; };
 assert.equal(hub('incheon').state,'degraded','인천 허브가 안 흔들렸다'); assert.equal(hub('gyeonggi').state,'degraded');
 assert.equal(hub('busan').threat,0); assert.equal(hub('jeju').threat,0);
 assert.equal(v.phase,'mobilization'); assert.deepEqual(v.crisis,['seoul']);
 /* 36시간이면 서울 압력 100 = 붕괴 → 서울을 지나는 회랑은 단절, 남해축은 열림 */
 assert.deepEqual(v.collapsed,['seoul']); assert.equal(v.corridors.find(c=>c.id==='capital_ring').status,'cut'); assert.equal(v.corridors.find(c=>c.id==='south_sea_axis').status,'open');
 /* 되찾으면 하루 안에 전국이 다 정상 (전국 단위 소용돌이 없음) */
 store.nodeReport(g.profile.id,'namsan_n01',{outcome:'retaken',contrib:{kill:1}},t+36*NODE.HOUR+60e3);
 const after=store.nationalView(t+62*NODE.HOUR); for(const r of after.regions) assert.equal(r.operational,1,r.id+' 운영 '+r.operational);
 assert.equal(NODE.command(store,null,{type:'node',action:'national'},t+62*NODE.HOUR+1).national.regions.length,16);
});
test('필드 보스 → 권역 거점: 남산타워 보스가 살아 있으면 남산 위협이 오르고, 잡으면 −15 · 한 시계로 16권역이 같이 걷는다',()=>{
 const store=new Store(null), t=98*NODE.WEEK; store.nationalView(t); store.initBoss();
 store.bossSave('dropper','namsan_tower','alive',0,t); store.bossSave('nova','goheung_pad','alive',0,t); store.bossSave('x','nowhere','alive',0,t);
 const v=store.regionView('seoul',t+3*NODE.HOUR); assert.equal(v.nodes.find(n=>n.id==='N01').threat,24,'6걸음 × (+6 − 2)');
 assert.equal(store.regionLoad('jg_special').r.nodes.JG05.threat,24,'고흥 해안관측소');
 assert.equal(store.regionLoad('busan').r.lastStep,store.regionLoad('seoul').r.lastStep,'권역 시계가 따로 논다');
 store.bossSave('dropper','namsan_tower','wait',t+9e9,t+3*NODE.HOUR+1); store.regionFieldKill('namsan_tower',t+3*NODE.HOUR+2);
 assert.equal(store.regionView('seoul',t+3*NODE.HOUR+3).nodes.find(n=>n.id==='N01').threat,9,'처치 −15');
 /* 실제 처치 경로(bossKill)도 망에 닿는다 */
 store.bossSave('nova','goheung_pad','wait',t+9e9,t+3*NODE.HOUR+4); store.bossKill('nova','goheung_pad',t+3*NODE.HOUR+5,[],[],null);
 assert.equal(store.regionLoad('jg_special').r.nodes.JG05.threat,9);
});
test('전국 작전 단계: 평시 → 동원(침공 둘) → 진행(위기 둘) → 결정적(진행 중 붕괴) · 허브 점령 = 그 회랑 단절',()=>{
 const cfg=G.loadRegion('seoul'), v=(over)=>Object.fromEntries(KOREA.regions.map(r=>[r.id,{ pressure:0, operational:1, hubOccupied:false, ...(over[r.id]||{}) }]));
 assert.equal(G.nationalStatus(KOREA,cfg,v({})).phase,'dormant');
 assert.equal(G.nationalStatus(KOREA,cfg,v({busan:{pressure:60},daegu:{pressure:60}})).phase,'mobilization');
 assert.equal(G.nationalStatus(KOREA,cfg,v({busan:{pressure:80},daegu:{pressure:80}})).phase,'active');
 const crit=G.nationalStatus(KOREA,cfg,v({busan:{pressure:96},daegu:{pressure:80}})); assert.equal(crit.phase,'critical');
 assert.equal(crit.corridors.find(c=>c.id==='gyeongbu_axis').status,'cut'); assert.equal(crit.corridors.find(c=>c.id==='capital_ring').status,'open');
 assert.equal(G.nationalStatus(KOREA,cfg,v({jeju:{hubOccupied:true}})).corridors.find(c=>c.id==='south_sea_axis').status,'cut');
});
