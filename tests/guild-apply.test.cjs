/* 길드 가입 신청·승인. 초대 코드만 있던 시절에는 «아는 사람» 끼리만 모일 수 있었다.
   공개 모집을 켠 길드에 신청하고, 길드장·임원이 승인하거나 거절한다. */
const test=require('node:test'),assert=require('node:assert/strict');
const {createPartyServer}=require('../server/index.cjs'),{Store}=require('../server/store.cjs');
const {connect}=require('./helpers/party-client.cjs');

async function setup(t){const store=new Store(null),app=createPartyServer({store});
 const a=await app.listen(0,'127.0.0.1');t.after(()=>app.close());
 return {store,url:`ws://127.0.0.1:${a.port}/party-socket`};}
async function user(t,url,tag){
 const c=await connect(url,{type:'account',mode:'register',username:'apply_'+tag,password:'test-password-long'});
 assert.equal(c.result.type,'welcome');t.after(()=>c.close());
 c.profile=(await c.request({type:'character',name:'요원_'+tag},m=>m.type==='profile')).profile;return c;}
const gap=()=>new Promise(r=>setTimeout(r,150));
const rpg=(c,action,fields,match)=>c.request({type:'rpg',action,...fields},match);

test('모집을 열어야 신청할 수 있고, 승인하면 길드원이 된다',async t=>{
 const {url}=await setup(t);
 const boss=await user(t,url,'boss'),who=await user(t,url,'who');
 await boss.request({type:'guildCreate',name:'모집의 쉘터'},m=>m.type==='guild'&&m.guild);

 /* 모집이 닫혀 있으면 목록에 없고 신청도 안 된다 */
 await gap();
 const empty=await rpg(who,'guildBoard',{},m=>m.type==='guildBoard');
 assert.deepEqual(empty.guilds,[],'닫힌 길드는 모집 목록에 안 나온다');
 assert.equal(empty.mine,null);

 /* 길드장이 모집을 연다 */
 await gap();
 const opened=await rpg(boss,'guildManage',{operation:'open',value:true},m=>m.type==='guild'&&m.guild&&m.guild.open);
 assert.equal(opened.guild.open,true);

 await gap();
 const board=await rpg(who,'guildBoard',{},m=>m.type==='guildBoard');
 assert.equal(board.guilds.length,1);
 assert.equal(board.guilds[0].name,'모집의 쉘터');
 assert.equal(board.guilds[0].members,1);
 assert.ok(!('code' in board.guilds[0]),'초대 코드는 모집 목록에 실리지 않는다');

 /* 신청 → 관리자 화면에 뜬다 */
 await gap();
 const seen=boss.next(m=>m.type==='guild'&&m.guild&&m.guild.applications.length===1);
 const applied=await rpg(who,'guildApply',{guild:board.guilds[0].id,message:'카운터 자신 있습니다'},
   m=>m.type==='guildBoard'&&m.mine);
 assert.equal(applied.mine.name,'모집의 쉘터');
 const app=(await seen).guild.applications[0];
 assert.equal(app.name,'요원_who');
 assert.equal(app.message,'카운터 자신 있습니다');

 /* 승인 → 길드원이 되고 신청은 사라진다 */
 await gap();
 const joined=who.next(m=>m.type==='guild'&&m.guild);
 const told=who.next(m=>m.type==='rpgNotice'&&/승인/.test(m.text));
 boss.send({type:'rpg',action:'guildDecide',target:who.profile.id,accept:true});
 assert.equal((await joined).guild.name,'모집의 쉘터');
 assert.match((await told).text,/승인/);
 await gap();
 const after=await rpg(boss,'guildBoard',{},m=>m.type==='guildBoard');
 assert.equal(after.guilds[0].members,2);
});

test('거절하면 가입되지 않고, 모집을 닫으면 대기 신청이 정리된다',async t=>{
 const {url,store}=await setup(t);
 const boss=await user(t,url,'b2'),x=await user(t,url,'x2'),y=await user(t,url,'y2');
 const made=await boss.request({type:'guildCreate',name:'거절의 쉘터'},m=>m.type==='guild'&&m.guild);
 await gap(); await rpg(boss,'guildManage',{operation:'open',value:true},m=>m.type==='guild'&&m.guild.open);

 await gap();
 const board=await rpg(x,'guildBoard',{},m=>m.type==='guildBoard');
 await gap(); await rpg(x,'guildApply',{guild:board.guilds[0].id},m=>m.type==='guildBoard'&&m.mine);
 await gap(); await rpg(y,'guildApply',{guild:board.guilds[0].id},m=>m.type==='guildBoard'&&m.mine);

 /* 거절 */
 await gap();
 const refused=x.next(m=>m.type==='rpgNotice'&&/거절/.test(m.text));
 boss.send({type:'rpg',action:'guildDecide',target:x.profile.id,accept:false});
 assert.match((await refused).text,/거절/);
 assert.equal(store.guild(x.profile.id),null,'거절당한 사람은 가입되지 않는다');

 /* 모집을 닫으면 남은 신청(y)이 정리된다 */
 await gap();
 await rpg(boss,'guildManage',{operation:'open',value:false},m=>m.type==='guild'&&m.guild&&!m.guild.open);
 assert.equal(store.guildApplication(y.profile.id),null,'닫으면 대기 신청이 사라진다');
 await gap();
 const err=await rpg(y,'guildApply',{guild:made.guild.id},m=>m.type==='error');
 assert.match(err.message,/모집/);
});

test('권한 없는 사람은 모집을 열거나 신청을 처리할 수 없다',async t=>{
 const {url}=await setup(t);
 const boss=await user(t,url,'b3'),plain=await user(t,url,'p3'),who=await user(t,url,'w3');
 const made=await boss.request({type:'guildCreate',name:'권한의 모집'},m=>m.type==='guild'&&m.guild);
 await plain.request({type:'guildJoin',code:made.guild.code},m=>m.type==='guild'&&m.guild);
 await gap(); await rpg(boss,'guildManage',{operation:'open',value:true},m=>m.type==='guild'&&m.guild.open);
 await gap();
 const board=await rpg(who,'guildBoard',{},m=>m.type==='guildBoard');
 await gap(); await rpg(who,'guildApply',{guild:board.guilds[0].id},m=>m.type==='guildBoard'&&m.mine);

 await gap();
 const noOpen=await rpg(plain,'guildManage',{operation:'open',value:false},m=>m.type==='error');
 assert.match(noOpen.message,/권한/);
 await gap();
 const noDecide=await rpg(plain,'guildDecide',{target:who.profile.id,accept:true},m=>m.type==='error');
 assert.match(noDecide.message,/권한/);

 /* 평 길드원에게는 신청자 이름이 내려가지 않는다 */
 await gap();
 const seen=await rpg(plain,'state',{},m=>m.type==='rpg');
 assert.deepEqual(seen.data.guild.applications,[],'평 길드원에게 신청 목록을 흘리지 않는다');
});
