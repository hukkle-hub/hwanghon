/* 서울 전략망 (docs/design/202) — GPT 패키지 Hwanghon_Korea_GuildWorld_v03 의 «Prototype 합격» 을 그대로 시험으로 박았다:
   N01 함락이 정보 서비스를 떨어뜨린다 · 하나가 무너져도 서울 전체가 즉시 붕괴하지 않는다 · 전파가 걸음당 상한을 지킨다 ·
   복구로 서비스가 돌아온다 · N04 함락은 물류에 바로 닿는다 · 직책별 명령 권한이 나뉜다.
   그리고 관리 용량(80, 허브 하나)과 서버 권위(판 결과 → 망, 명령 권한). */
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../server/region-rules.cjs'),{Store}=require('../server/store.cjs'),NODE=require('../server/node-store.cjs');
const cfg=G.loadRegion('seoul'), fresh=()=>G.initial(cfg), steps=(r,n)=>{ for(let i=0;i<n;i++) G.step(cfg,r); };

test('망: 남산 함락 → 정보 0.4 · 패키지 시뮬과 같은 숫자 (서울역 위협 7/14/21/28, 압력 1.65/걸음)',()=>{
 const r=fresh(); G.setState(cfg,r,'N01','occupied');
 const got=[]; for(let i=0;i<4;i++){ G.step(cfg,r); got.push([+r.pressure.toFixed(2),r.nodes.N02.threat]); }
 assert.deepEqual(got,[[1.65,7],[3.3,14],[4.95,21],[6.61,28]]);
 assert.equal(G.serviceByRole(cfg,r).intel,0.4); assert.equal(G.operationalRatio(cfg,r),0.862);
});
test('망: 하나가 무너져도 서울이 통째로 무너지지 않는다 — 망은 점령을 만들지 않고, 하루 뒤에도 운영률이 절반을 넘는다',()=>{
 const r=fresh(); G.setState(cfg,r,'N01','occupied'); steps(r,48);
 assert.deepEqual(cfg.nodes.filter(n=>r.nodes[n.id].state==='occupied').map(n=>n.id),['N01']);
 assert.ok(G.operationalRatio(cfg,r)>0.5,'운영률 '+G.operationalRatio(cfg,r));
 assert.ok(['N02','N06','N07'].some(id=>r.nodes[id].state==='degraded'),'이웃이 하나도 흔들리지 않는다 — 연쇄가 없다');
 assert.equal(r.nodes.N08.state,'online','두 다리 건너 구로까지 저하됐다');
});
test('망: 죽음의 소용돌이가 없다 — 남산이 하루 점령된 뒤 되찾으면 하루 안에 서울 전체가 정상 (받은 위협은 다시 퍼뜨리지 않는다)',()=>{
 const r=fresh(); G.setState(cfg,r,'N01','occupied'); steps(r,48); assert.ok(G.crisis(cfg,r).active,'하루 점령이면 서울 위기여야 한다');
 G.setState(cfg,r,'N01','recovering'); steps(r,48);
 assert.equal(G.operationalRatio(cfg,r),1,cfg.nodes.map(n=>n.id+':'+r.nodes[n.id].state+' '+Math.round(r.nodes[n.id].threat)).join(' '));
 /* 밖에서 들어온 위협(침공 예보 같은 것)은 퍼진다 */
 const e=fresh(); G.addThreat(e,'N04',90); G.step(cfg,e); assert.ok(e.nodes.N02.threat>0&&e.nodes.N03.threat>0,'자기 위협이 안 퍼진다');
 assert.equal(e.nodes.N08.threat,0,'받은 위협이 두 다리를 건넜다');
});
test('망: 한 거점이 한 걸음에 받는 위협은 12 까지 (이웃 넷이 다 점령돼도)',()=>{
 const r=fresh(); for(const id of ['N01','N03','N04','N05']) G.setState(cfg,r,id,'occupied');
 G.step(cfg,r); assert.equal(r.nodes.N02.threat,12-2,'서울역 위협 '+r.nodes.N02.threat);   // 받은 12 − 자연 감소 2
 G.step(cfg,r); assert.equal(r.nodes.N02.threat,20);
});
test('망: 탈환 → 복구 75% 에서 → 네 걸음 뒤 정상, 정보 1.0 · 저하는 위협이 빠지면 정상으로 돌아온다',()=>{
 const r=fresh(); G.setState(cfg,r,'N01','occupied'); steps(r,3); G.setState(cfg,r,'N01','recovering');
 assert.ok(G.serviceByRole(cfg,r).intel>0.85&&G.serviceByRole(cfg,r).intel<1); steps(r,4);
 assert.equal(r.nodes.N01.state,'online'); assert.equal(G.serviceByRole(cfg,r).intel,1);
 const d=fresh(); d.nodes.N06.threat=80; G.step(cfg,d); assert.equal(d.nodes.N06.state,'degraded');
 steps(d,20); assert.equal(d.nodes.N06.state,'online','저하에서 돌아오는 길이 없다 (패키지 시뮬의 빈틈)');
});
test('망: 한강(N04) 함락은 물류를 바로 0 으로 · 점령이 없으면 압력이 걸음당 3 씩 빠진다 · 압력 75 + 문제 거점 둘 = 서울 위기',()=>{
 const r=fresh(); G.setState(cfg,r,'N04','occupied'); assert.equal(G.serviceByRole(cfg,r).logistics,0); assert.equal(G.serviceByRole(cfg,r).intel,1);
 const p=fresh(); p.pressure=20; G.step(cfg,p); assert.equal(p.pressure,17);
 const c=fresh(); c.pressure=80; G.setState(cfg,c,'N01','occupied'); assert.equal(G.crisis(cfg,c).active,false,'문제 거점 하나로는 위기가 아니다');
 G.setState(cfg,c,'N04','occupied'); const k=G.crisis(cfg,c); assert.equal(k.active,true); assert.deepEqual(k.fronts.map(f=>f.node),['N01','N04','N02','N03']);
 assert.equal(G.pressureBand(cfg,80).id,'crisis'); assert.equal(G.pressureBand(cfg,10).id,'stable');
});
test('관리 용량: 패키지 시나리오 그대로 — 전투형이 다 못 가져가고, 용량 80 이 다거점을 막고, 허브는 길드당 하나',()=>{
 /* 패키지 SIMULATION_RESULT.txt 의 점수 */
 const cand=[['N01','G_ALPHA',962.5],['N01','G_BRAVO',1597.2],['N02','G_ALPHA',625],['N02','G_CHARLIE',1360.7],['N03','G_BRAVO',1058.2],['N03','G_CHARLIE',366],['N05','G_CHARLIE',611.6],['N05','G_ALPHA',150]]
  .map(([node,guild,score])=>({node,guild,score}));
 const { stewards, used }=G.assignStewards(cand,cfg.nodes);
 assert.deepEqual(stewards,{ N01:'G_BRAVO', N02:'G_CHARLIE', N03:'G_BRAVO', N05:'G_ALPHA' }); assert.equal(used.G_BRAVO,80);
 /* 용량이 찬 길드는 다음 거점에서 건너뛴다: BRAVO 가 청계(N05)에서도 1등이지만 80/80 */
 const more=G.assignStewards([...cand,{node:'N05',guild:'G_BRAVO',score:500}],cfg.nodes); assert.equal(more.stewards.N05,'G_ALPHA');
 /* 허브(3단계)는 하나만: 서울역 하나뿐이라 가상 허브 둘로 */
 const hubs=[{id:'H1',tier:3},{id:'H2',tier:3}], two=G.assignStewards([{node:'H1',guild:'A',score:9},{node:'H2',guild:'A',score:8},{node:'H2',guild:'B',score:1}],hubs,{A:160});
 assert.deepEqual(two.stewards,{H1:'A',H2:'B'},'한 길드가 허브 둘을 가졌다');
});
test('전략 명령 권한: 패키지 GuildCommandRules_v03 과 같은 표 (길드장·부길드장 전부, 전투대장·보급대장·제작대장 나뉨, 길드원 없음)',()=>{
 const PKG={ GuildMaster:['Defend','Reinforce','Supply','Repair','Recon','Evacuate','PrepareRecapture'], ViceMaster:['Defend','Reinforce','Supply','Repair','Recon','Evacuate','PrepareRecapture'],
  WarLeader:['Defend','Reinforce','Recon','PrepareRecapture'], LogisticsLeader:['Supply','Repair','Evacuate'], CraftLeader:['Repair'], Member:[] };
 const ROLE={GuildMaster:'leader',ViceMaster:'vice',WarLeader:'combat',LogisticsLeader:'supply',CraftLeader:'craft',Member:'member'};
 const T={Defend:'defend',Reinforce:'reinforce',Supply:'supply',Repair:'repair',Recon:'recon',Evacuate:'evacuate',PrepareRecapture:'prepare_retake'};
 for(const [r,types] of Object.entries(PKG)) for(const t of Object.keys(T)) assert.equal(G.canOrder(ROLE[r],T[t]),types.includes(t),r+' '+t);
 assert.deepEqual(G.cleanOrder({priority:9,squads:20,resource:-5}),{priority:5,squads:8,resource:0});
});

function world(){ const store=new Store(null), mk=n=>{ const g=store.guest(n); store.chooseName(g.profile.id,n,'ain'); return g.profile.id; };
 const a=mk('길드장A'), war=mk('전투대장'), sup=mk('보급대장'), mem=mk('길드원'), b=mk('길드장B');
 store.createGuild(a,'황혼단'); store.createGuild(b,'새벽단'); for(const p of [war,sup,mem]) store.joinGuild(p,store.guild(a).code);
 store.guildAssign(a,war,'combat'); store.guildAssign(a,sup,'supply'); return {store,a,war,sup,mem,b}; }
test('서버: 남산 판 결과가 망을 움직인다 — 함락 = 점령, 시간이 흐르면 이웃 위협, 탈환 = 복구, 방어 = 위협 −15',()=>{
 const {store,a}=world(), t0=40*NODE.WEEK;
 const v0=store.regionView('seoul',t0); assert.equal(v0.nodes.length,8); assert.equal(v0.services.intel,1); assert.equal(v0.nodes[0].node,'namsan_n01');
 store.nodeReport(a,'namsan_n01',{outcome:'fallen',contrib:{kill:3}},t0+60e3);
 const v1=store.regionView('seoul',t0+2*60e3); assert.equal(v1.nodes[0].state,'occupied'); assert.equal(v1.services.intel,0.4);
 const v2=store.regionView('seoul',t0+2*NODE.HOUR+2*60e3); assert.equal(v2.nodes.find(n=>n.id==='N02').threat,28,'2시간 = 네 걸음'); assert.ok(v2.pressure>6);
 store.nodeReport(a,'namsan_n01',{outcome:'retaken',contrib:{kill:3}},t0+3*NODE.HOUR);
 assert.equal(store.regionView('seoul',t0+3*NODE.HOUR+1).nodes[0].state,'recovering');
 const v3=store.regionView('seoul',t0+6*NODE.HOUR); assert.equal(v3.nodes[0].state,'online'); assert.equal(v3.services.intel,1);
 /* 방어 성공 */
 const {store:s2,a:a2}=world(), t1=50*NODE.WEEK; { const {cfg,r}=s2.regionLoad('seoul'); r.nodes.N01.threat=40; r.lastStep=t1; s2.regionSave('seoul',r,t1); }
 s2.nodeReport(a2,'namsan_n01',{outcome:'held',contrib:{kill:3}},t1+60e3); assert.equal(s2.regionView('seoul',t1+2*60e3).nodes[0].threat,25);
 /* 오래 꺼져 있던 서버: 한 번에 최대 96걸음 */
 const {store:s3}=world(), t2=60*NODE.WEEK; s3.regionView('seoul',t2); const t=Date.now(); s3.regionView('seoul',t2+400*24*NODE.HOUR); assert.ok(Date.now()-t<500);
});
test('서버: 전략 명령 — 직책대로 내고, 낸 사람·길드장만 내리고, 다른 길드는 못 보고, 8개까지',()=>{
 const {store,a,war,sup,mem,b}=world(), t=70*NODE.WEEK, cmd=(id,msg,at)=>NODE.command(store,id,{type:'node',...msg},at);
 const v=cmd(war,{action:'order',order:{node:'N01',type:'defend',priority:5,squads:3}},t).region;
 assert.equal(v.me.orders.length,1); assert.equal(v.me.orders[0].name,'방어'); assert.equal(v.me.orders[0].issuerName,'전투대장'); assert.deepEqual(v.me.canOrder,['defend','reinforce','recon','prepare_retake']);
 assert.throws(()=>cmd(sup,{action:'order',order:{node:'N01',type:'defend'}},t+300),/이 직책이 낼 수 없습니다/);
 assert.throws(()=>cmd(mem,{action:'order',order:{node:'N04',type:'supply'}},t+600),/이 직책/);
 assert.throws(()=>cmd(war,{action:'order',order:{node:'N99',type:'defend'}},t+900),/거점을 확인/);
 const id=v.me.orders[0].id;
 assert.throws(()=>cmd(sup,{action:'cancel',order:id},t+1200),/낸 사람이나/);
 assert.throws(()=>cmd(b,{action:'cancel',order:id},t+1500),/찾을 수 없습니다/);
 assert.equal(cmd(b,{action:'region'},t+1800).region.me.orders.length,0,'다른 길드의 명령이 보인다');
 assert.equal(cmd(a,{action:'cancel',order:id},t+2100).region.me.orders.length,0);
 for(let i=0;i<8;i++) cmd(sup,{action:'order',order:{node:'N04',type:'supply'}},t+3000+i*300);
 assert.throws(()=>cmd(sup,{action:'order',order:{node:'N04',type:'supply'}},t+6000),/8개/);
 assert.equal(cmd(a,{action:'region'},t+NODE.WEEK).region.me.orders.length,0,'명령은 주기가 바뀌면 내려간다');
 assert.equal(cmd(a,{action:'region'},t+6300).region.me.admin.capacity,80);
});
