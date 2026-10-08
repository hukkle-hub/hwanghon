/* 동맹 (docs/design/202 §5) — 최대 3길드, 길드장만, 관리권·용량은 합치지 않고 서로의 명령만 본다. */
const test=require('node:test'),assert=require('node:assert/strict');
const {Store}=require('../server/store.cjs'),NODE=require('../server/node-store.cjs');
function world(){ const store=new Store(null), mk=n=>{ const g=store.guest(n); store.chooseName(g.profile.id,n,'ain'); return g.profile.id; };
 const L={}, M={}; for(const [k,name] of [['a','황혼단'],['b','새벽단'],['c','잿빛단'],['d','은하단']]){ L[k]=mk('장'+k+name.slice(0,1)); M[k]=mk('원'+k+name.slice(0,1)); store.createGuild(L[k],name); store.joinGuild(M[k],store.guild(L[k]).code); }
 store.guildAssign(L.b,M.b,'combat'); return {store,L,M}; }
const cmd=(s,id,msg,at)=>NODE.command(s,id,{type:'node',...msg},at);
test('표 만들기는 트랜잭션 밖: 서버를 켠 뒤 첫 요청이 거절돼도 표가 남는다',()=>{
 const {store,M}=world(); assert.throws(()=>cmd(store,M.a,{action:'ally',op:'create',name:'첫 요청'},1),/길드장만/);
 assert.ok(store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='alliance_members'").get(),'거절된 첫 요청이 표를 지웠다');
 assert.throws(()=>cmd(store,M.a,{action:'order',order:{node:'N01',type:'defend'}},2),/이 직책/);
 assert.ok(store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='guild_orders'").get());
});
test('동맹: 길드장이 만들고 길드 이름으로 초대 → 상대 길드장이 수락, 3길드까지 (받아 둔 초대 포함)',()=>{
 const {store,L,M}=world(), t=90*NODE.WEEK;
 assert.throws(()=>cmd(store,M.a,{action:'ally',op:'create',name:'서울 연합'},t),/길드장만/);
 const v=cmd(store,L.a,{action:'ally',op:'create',name:'서울 연합'},t).ally; assert.equal(v.alliance.guilds.length,1); assert.equal(v.leader,true);
 assert.throws(()=>cmd(store,L.b,{action:'ally',op:'create',name:'서울 연합'},t+300),/이미 쓰는/);
 assert.throws(()=>cmd(store,L.a,{action:'ally',op:'invite',guild:'없는단'},t+600),/찾을 수 없/);
 cmd(store,L.a,{action:'ally',op:'invite',guild:'새벽단'},t+900); cmd(store,L.a,{action:'ally',op:'invite',guild:'잿빛단'},t+1200);
 assert.throws(()=>cmd(store,L.a,{action:'ally',op:'invite',guild:'은하단'},t+1500),/3길드까지/);
 const inv=cmd(store,L.b,{action:'ally',op:'info'},t+1800).ally.invites; assert.equal(inv.length,1); assert.equal(inv[0].name,'서울 연합');
 assert.equal(cmd(store,M.b,{action:'ally',op:'info'},t+1800).ally.invites.length,0,'길드원에게 초대가 보인다');
 assert.throws(()=>cmd(store,M.b,{action:'ally',op:'accept',alliance:inv[0].id},t+2100),/길드장만/);
 assert.equal(cmd(store,L.b,{action:'ally',op:'accept',alliance:inv[0].id},t+2400).ally.alliance.guilds.length,2);
 cmd(store,L.c,{action:'ally',op:'decline',alliance:inv[0].id},t+2700);
 cmd(store,L.a,{action:'ally',op:'invite',guild:'은하단'},t+3000); assert.equal(cmd(store,L.d,{action:'ally',op:'accept',alliance:inv[0].id},t+3300).ally.alliance.guilds.length,3);
 /* 넷째는 안 된다: 수락 순간에도 다시 센다 (초대가 어떻게든 하나 더 있어도) */
 store.db.prepare('INSERT INTO alliance_invites VALUES(?,?,?,?)').run(inv[0].id,store.guild(L.c).id,L.a,t+3400);
 assert.throws(()=>cmd(store,L.c,{action:'ally',op:'accept',alliance:inv[0].id},t+3500),/이미 3길드/);
 assert.throws(()=>cmd(store,L.a,{action:'ally',op:'invite',guild:'잿빛단'},t+3600),/3길드까지/);
 assert.throws(()=>cmd(store,L.c,{action:'ally',op:'create',name:'서울 연합2'},t+3900).ally&&cmd(store,L.c,{action:'ally',op:'invite',guild:'황혼단'},t+4200),/다른 동맹/);
});
test('동맹: 서로의 전략 명령을 보고(이름 붙여), 관리 용량·명령 보너스는 길드마다 — 탈퇴하면 안 보인다',()=>{
 const {store,L,M}=world(), t=91*NODE.WEEK;
 const id=cmd(store,L.a,{action:'ally',op:'create',name:'한강 연합'},t).ally.alliance.id; cmd(store,L.a,{action:'ally',op:'invite',guild:'새벽단'},t+300); cmd(store,L.b,{action:'ally',op:'accept',alliance:id},t+600);
 cmd(store,M.b,{action:'order',order:{node:'N04',type:'defend',priority:4}},t+900);
 const va=cmd(store,M.a,{action:'region'},t+1200).region.me;
 assert.equal(va.orders.length,0); assert.equal(va.allyOrders.length,1); assert.equal(va.allyOrders[0].guildName,'새벽단'); assert.equal(va.alliance.guilds.length,2);
 assert.equal(cmd(store,L.c,{action:'region'},t+1500).region.me.allyOrders.length,0,'동맹 밖에 명령이 보인다');
 assert.throws(()=>cmd(store,L.a,{action:'cancel',order:va.allyOrders[0].id},t+1800),/찾을 수 없습니다/,'동맹 길드장이 남의 길드 명령을 내렸다');
 assert.equal(va.admin.capacity,80,'관리 용량이 합쳐졌다');
 /* 동맹의 남산 명령으로는 우리 판에 보너스가 안 붙는다 */
 cmd(store,M.b,{action:'order',order:{node:'N01',type:'defend'}},t+2100);
 assert.equal(store.nodeReport(L.a,'namsan_n01',{outcome:'held',contrib:{kill:5}},t+10*60e3).orderBonus,null);
 cmd(store,L.b,{action:'ally',op:'leave'},t+11*60e3);
 const after=cmd(store,M.a,{action:'region'},t+12*60e3).region.me; assert.equal(after.allyOrders.length,0); assert.equal(after.alliance.guilds.length,1);
 /* 마지막 길드가 나가면 동맹이 없어지고 이름을 다시 쓸 수 있다 */
 cmd(store,L.a,{action:'ally',op:'leave'},t+13*60e3); assert.equal(cmd(store,L.a,{action:'ally',op:'info'},t+14*60e3).ally.alliance,null);
 assert.ok(cmd(store,L.c,{action:'ally',op:'create',name:'한강 연합'},t+15*60e3).ally.alliance);
});
test('동맹: 길드가 해산되면 동맹에서 빠진다 · 만든 길드가 나가면 다음 길드가 이어받는다',()=>{
 const {store,L,M}=world(), t=92*NODE.WEEK;
 const id=cmd(store,L.a,{action:'ally',op:'create',name:'북악 연합'},t).ally.alliance.id; cmd(store,L.a,{action:'ally',op:'invite',guild:'새벽단'},t+300); cmd(store,L.b,{action:'ally',op:'accept',alliance:id},t+600);
 cmd(store,L.a,{action:'ally',op:'leave'},t+900); assert.equal(store.allianceOf(store.guild(L.b).id).founder,store.guild(L.b).id);
 assert.throws(()=>cmd(store,L.a,{action:'ally',op:'invite',guild:'잿빛단'},t+1200),/먼저 동맹을/);
 /* 새벽단이 해산(마지막 사람이 나감)되면 동맹 명단에서 빠진다 */
 store.leaveGuild(M.b); store.leaveGuild(L.b); assert.equal(store.allianceOf(store.guild(L.a).id),null);
 assert.equal(store.db.prepare('SELECT COUNT(*) c FROM alliance_members m JOIN guilds g ON g.id=m.guild WHERE m.alliance=?').get(id).c,0);
});
