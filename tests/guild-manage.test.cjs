/* 길드 관리(공지·임원·위임·추방)는 «당한 사람» 이 무슨 일인지 알 수 있어야 한다.
   예전에는 추방당해도 길드가 조용히 사라지기만 해서, 나간 것인지 쫓겨난 것인지
   화면으로 구분할 수 없었다 — server/rpg-server.cjs 의 guildManage 알림을 고정한다. */
const test=require('node:test'),assert=require('node:assert/strict');
const {createPartyServer}=require('../server/index.cjs'),{Store}=require('../server/store.cjs');
const {connect}=require('./helpers/party-client.cjs');

async function setup(t){const store=new Store(null),app=createPartyServer({store});
 const address=await app.listen(0,'127.0.0.1');t.after(()=>app.close());
 return {store,url:`ws://127.0.0.1:${address.port}/party-socket`};}
async function user(t,url,tag){
 const c=await connect(url,{type:'account',mode:'register',username:'guild_'+tag,password:'test-password-long'});
 assert.equal(c.result.type,'welcome');t.after(()=>c.close());
 c.profile=(await c.request({type:'character',name:'요원_'+tag},m=>m.type==='profile')).profile;return c;}
/* rpg 명령은 120ms 간격 제한이 있다 */
const gap=()=>new Promise(r=>setTimeout(r,150));
const notices=c=>c.messages.filter(m=>m.type==='rpgNotice').map(m=>m.text);

test('길드 관리는 공지·임원·위임·추방을 당사자에게 알린다',async t=>{
 const {url}=await setup(t);
 const boss=await user(t,url,'boss'),mate=await user(t,url,'mate'),out=await user(t,url,'out');
 const made=await boss.request({type:'guildCreate',name:'검증의 쉘터'},m=>m.type==='guild'&&m.guild);
 for(const c of [mate,out]) await c.request({type:'guildJoin',code:made.guild.code},m=>m.type==='guild'&&m.guild);

 /* 공지 — 올린 사람과 나머지 길드원 모두에게 */
 await gap();
 const heard=mate.next(m=>m.type==='rpgNotice');
 const saved=boss.request({type:'rpg',action:'guildManage',operation:'notice',value:'오늘 밤 갈대습지'},
   m=>m.type==='guild'&&m.guild&&m.guild.notice==='오늘 밤 갈대습지');
 assert.match((await heard).text,/공지/);
 assert.equal((await saved).guild.notice,'오늘 밤 갈대습지');
 assert.ok(notices(boss).some(t=>/저장/.test(t)),'올린 사람도 저장 결과를 듣는다');

 /* 임원 임명 — 당사자에게 */
 await gap();
 const promoted=mate.next(m=>m.type==='rpgNotice'&&/임원/.test(m.text));
 boss.send({type:'rpg',action:'guildManage',operation:'officer',target:mate.profile.id});
 assert.match((await promoted).text,/임원이 되었습니다/);

 /* 추방 — 쫓겨난 사람은 «추방» 을 듣고 길드가 비워진다 */
 await gap();
 const kicked=out.next(m=>m.type==='rpgNotice'&&/추방/.test(m.text));
 const cleared=out.next(m=>m.type==='guild'&&m.guild===null);
 const told=mate.next(m=>m.type==='rpgNotice'&&/추방/.test(m.text));   /* 보내기 «전에» 기다린다 */
 boss.send({type:'rpg',action:'guildManage',operation:'kick',target:out.profile.id});
 assert.match((await kicked).text,/추방되었습니다/);
 assert.equal((await cleared).guild,null);
 assert.match((await told).text,/요원_out/,'남은 길드원도 누가 나갔는지 안다');

 /* 길드장 위임 — 새 길드장에게 */
 await gap();
 const crowned=mate.next(m=>m.type==='rpgNotice'&&/길드장/.test(m.text));
 const owned=mate.next(m=>m.type==='guild'&&m.guild&&m.guild.owner===mate.profile.id);
 boss.send({type:'rpg',action:'guildManage',operation:'transfer',target:mate.profile.id});
 assert.match((await crowned).text,/길드장이 되었습니다/);
 assert.equal((await owned).guild.owner,mate.profile.id);
});

test('권한이 없으면 길드 관리를 할 수 없다',async t=>{
 const {url}=await setup(t);
 const boss=await user(t,url,'b2'),plain=await user(t,url,'p2');
 const made=await boss.request({type:'guildCreate',name:'권한의 쉘터'},m=>m.type==='guild'&&m.guild);
 await plain.request({type:'guildJoin',code:made.guild.code},m=>m.type==='guild'&&m.guild);
 await gap();
 const denied=await plain.request({type:'rpg',action:'guildManage',operation:'notice',value:'몰래'},m=>m.type==='error');
 assert.match(denied.message,/권한/);
 await gap();
 const noKick=await plain.request({type:'rpg',action:'guildManage',operation:'kick',target:boss.profile.id},m=>m.type==='error');
 assert.match(noKick.message,/권한/);
});
