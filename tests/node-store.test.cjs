/* 거점 저장 (docs/design/201 §6) — 함락은 실제 시간으로 흐르고 2시간 전엔 탈환 불가, 관리권은 지난 주기 공헌으로,
   정책은 관리 길드의 길드장·부길드장만 예산 안에서, 대장 임명은 길드장만, 보급은 보급대장이 주기당 12까지. */
const test=require('node:test'),assert=require('node:assert/strict');
const {Store}=require('../server/store.cjs'),NODE=require('../server/node-store.cjs');
const N='namsan_n01', H=NODE.HOUR, W=NODE.WEEK;
function world(){ const store=new Store(null), mk=n=>{ const g=store.guest(n); store.chooseName(g.profile.id,n,'ain'); return g.profile.id; };
 const a=mk('길드장A'), a2=mk('대원A'), b=mk('길드장B'), b2=mk('대원B'), solo=mk('혼자');
 const ga=store.createGuild(a,'황혼단'), gb=store.createGuild(b,'새벽단');
 store.joinGuild(a2,store.guild(a).code); store.joinGuild(b2,store.guild(b).code);
 return {store,a,a2,b,b2,solo}; }
test('함락: 실제 시간으로 점령 — 2시간 전엔 탈환 불가, 그 뒤 단계가 오른다',()=>{
 const {store,a}=world(), t0=10*W;
 assert.equal(store.nodeView(N,t0).state,'stable');
 assert.equal(store.nodeReport(a,N,{outcome:'fallen',contrib:{kill:3}},t0).state,'fallen');
 const v1=store.nodeView(N,t0+1*H); assert.equal(v1.state,'fallen'); assert.ok(v1.retakeIn>0.9&&v1.retakeIn<1.1); assert.equal(v1.services.rescueSignals,false);
 assert.throws(()=>store.nodeReport(a,N,{outcome:'retaken'},t0+1.5*H),/2시간 뒤부터/);
 const v2=store.nodeView(N,t0+3*H); assert.equal(v2.state,'retakeable'); assert.equal(v2.tier,'basic');
 assert.equal(store.nodeView(N,t0+13*H).tier,'fortress'); assert.ok(store.nodeView(N,t0+25*H).reward>store.nodeView(N,t0+3*H).reward,'오래 점령될수록 보상이 오른다');
 assert.equal(store.nodeReport(a,N,{outcome:'retaken',contrib:{kill:10}},t0+25*H).state,'stable');
 assert.throws(()=>store.nodeReport(a,N,{outcome:'retaken'},t0+26*H),/탈환할 거점이 아닙니다/);
});
test('판 결과: 같은 사람은 1분에 한 번 · 항목·값 검사 · 한 판 최대치로 자른다',()=>{
 const {store,a}=world(), t=20*W;
 store.nodeReport(a,N,{outcome:'held',contrib:{kill:9999}},t);
 assert.throws(()=>store.nodeReport(a,N,{outcome:'held'},t+30e3),/잠시 후/);
 assert.throws(()=>store.nodeReport(a,N,{outcome:'held',contrib:{gold:5}},t+70e3),/공헌 항목/);
 assert.throws(()=>store.nodeReport(a,N,{outcome:'held',contrib:{kill:-1}},t+70e3),/공헌 값/);
 assert.throws(()=>store.nodeReport(a,N,{outcome:'win'},t+70e3),/결과를 확인/);
 const row=store.db.prepare('SELECT amount FROM node_contrib WHERE player=? AND category=?').get(a,'kill'); assert.equal(row.amount,NODE.CAPS.kill);
 assert.throws(()=>store.nodeView('nowhere',t),/알 수 없는 거점/);
});
test('관리권: 지난 주기 공헌으로 — 보스 딜만 많은 길드가 아니라 방어·수리·구조한 길드',()=>{
 const {store,a,a2,b,b2}=world(), p=30*W;
 store.nodeReport(a,N,{outcome:'held',contrib:{boss:900000,kill:6}},p+1e3);
 store.nodeReport(b,N,{outcome:'held',contrib:{defense:400,repair:300,npc_rescue:2,kill:4}},p+2e3);
 store.nodeReport(b2,N,{outcome:'held',contrib:{command:5}},p+3e3);
 assert.equal(store.nodeView(N,p+4e3).steward,null,'이번 주기엔 아직 없다');
 const v=store.nodeView(N,p+W+1e3,a); assert.equal(v.steward.name,'새벽단'); assert.equal(v.me.steward,false);
 assert.equal(store.nodeView(N,p+2*W+1e3).steward,null,'공헌이 없던 주기 다음엔 관리 길드가 없다');
});
test('정책: 관리 길드의 길드장·부길드장만, 예산 10 안에서 · 대장 임명은 길드장만 · 보급은 보급대장',()=>{
 const {store,a,a2,b,b2,solo}=world(), p=40*W;
 store.nodeReport(a2,N,{outcome:'held',contrib:{defense:100}},p+1e3);
 const t=p+W+1e3;
 assert.throws(()=>store.nodePolicy(b,N,['scouting'],t),/관리 길드만/);
 assert.throws(()=>store.nodePolicy(a2,N,['scouting'],t),/길드장·부길드장만/);
 assert.throws(()=>store.nodePolicy(a,N,['gate_reinforce','generator_reinforce','scouting'],t),/예산/);
 const v=store.nodePolicy(a,N,['gate_reinforce','medical_stock'],t); assert.deepEqual(v.policies,['gate_reinforce','medical_stock']); assert.equal(v.effects.gateHealthScale,1.5);
 assert.throws(()=>store.guildAssign(a2,a,'combat'),/길드장만/);
 assert.throws(()=>store.guildAssign(a,b2,'combat'),/길드원을 선택/);
 assert.throws(()=>store.nodeSupply(a2,N,4,t),/보급대장/);
 assert.equal(store.guildAssign(a,a2,'supply').role,'supply');
 assert.equal(store.nodeSupply(a2,N,8,t).supply,8);
 assert.throws(()=>store.nodeSupply(a2,N,5,t),/12까지/);
 assert.throws(()=>store.nodePolicy(a2,N,['scouting'],t),/길드장·부길드장만/,'보급대장은 정책을 못 고른다');
 const me=store.nodeView(N,t,a2).me; assert.equal(me.role,'supply'); assert.ok(me.can.includes('allocate_supply')&&!me.can.includes('select_policy'));
 assert.equal(store.nodeView(N,t,solo).me,undefined,'길드 없는 사람도 거점은 본다 (관리권 ≠ 소유권)');
 const cmd=NODE.command(store,a,{type:'node',action:'info',node:N},t); assert.equal(cmd.type,'node'); assert.equal(cmd.node.me.role,'leader');
});
test('UE 판 결과 모양 그대로 — HWNodeDirector::FinishRun 의 형식 문자열을 읽어 만든 JSON 을 서버가 받는다',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const src=fs.readFileSync(path.join(__dirname,'..','ue','HwanghonCombatUE','Source','HwanghonCombatUE','Private','Node','HWNodeDirector.cpp'),'utf8');
 /* 형식: {\"node\":\"%s\",\"outcome\":\"%s\",\"contrib\":{%s}} 와 항목 열쇠 7개 — UE 쪽 이름이 바뀌면 여기서 깨진다 */
 const keys=[...src.match(/static const TCHAR\* Keys\[\] = \{([^}]*)\}/)[1].matchAll(/TEXT\("([a-z_]+)"\)/g)].map(m=>m[1]);
 assert.deepEqual(keys,['kill','defense','repair','npc_rescue','boss','supply','command']);
 const fmt=src.match(/TEXT\("(\{\\"node\\":[^)]*)"\), \*Config->NodeId/)[1].replace(/\\"/g,'"');
 const contrib=keys.map((k,i)=>'"'+k+'":'+(i+1).toFixed(2)).join(','), json=fmt.replace('%s',N).replace('%s','held').replace('%s',contrib);
 const report=JSON.parse(json), {store,a}=world();
 const r=NODE.command(store,a,{type:'node',action:'report',node:report.node,report},50*W);
 assert.equal(r.type,'node'); assert.equal(r.node.state,'stable');
 assert.equal(store.db.prepare('SELECT amount FROM node_contrib WHERE player=? AND category=?').get(a,'command').amount,7);
});
