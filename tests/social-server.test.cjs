const test=require('node:test'),assert=require('node:assert/strict'),{createPartyServer}=require('../server/index.cjs'),{Store}=require('../server/store.cjs'),{connect}=require('./helpers/party-client.cjs');
async function setup(t){const store=new Store(null),app=createPartyServer({store}),address=await app.listen(0,'127.0.0.1');t.after(()=>app.close());return {app,store,url:`ws://127.0.0.1:${address.port}/party-socket`};}
async function user(t,url,i,registered=true){const c=await connect(url,registered?{type:'account',mode:'register',username:'user_'+i,password:'test-password-long'}:{type:'hello'});assert.equal(c.result.type,'welcome');t.after(()=>c.close());c.profile=(await c.request({type:'character',name:'아인_'+i},m=>m.type==='profile')).profile;return c;}
const ack=async c=>{await c.request({type:'ping',time:123},m=>m.type==='pong'&&m.echo===123);};
test('unnamed login cannot recruit/chat; chosen name reaches peers and duplicate is rejected',async t=>{
 const {url}=await setup(t),a=await connect(url,{type:'hello'});t.after(()=>a.close());const error=await a.request({type:'create'},m=>m.type==='error');assert.match(error.message,/이름/);const b=await user(t,url,'name');await a.request({type:'character',name:'아인_name'},m=>m.type==='error');await a.request({type:'character',name:'다른아인'},m=>m.type==='profile');const recv=b.next(m=>m.type==='chat');a.send({type:'chat',channel:'world',text:'반갑습니다',name:'가짜이름'});assert.equal((await recv).message.name,'다른아인');
});
test('world reaches all; guild and party channels/history never reach outsiders',async t=>{
 const {url}=await setup(t),a=await user(t,url,'alpha'),b=await user(t,url,'beta'),c=await user(t,url,'gamma');const made=await a.request({type:'guildCreate',name:'밤의쉘터'},m=>m.type==='guild'&&m.guild);await b.request({type:'guildJoin',code:made.guild.code},m=>m.type==='guild'&&m.guild);
 const room=await a.request({type:'create'},m=>m.type==='state');await b.request({type:'join',code:room.code},m=>m.type==='state');
 const guild=b.next(m=>m.type==='chat'&&m.message.channel==='guild');a.send({type:'chat',channel:'guild',text:'길드 비밀'});await guild;await ack(c);assert.ok(!c.messages.some(m=>m.type==='chat'&&m.message.text==='길드 비밀'));
 const party=a.next(m=>m.type==='chat'&&m.message.channel==='party');b.send({type:'chat',channel:'party',text:'파티 비밀'});await party;await ack(c);assert.ok(!c.messages.some(m=>m.type==='chat'&&m.message.text==='파티 비밀'));
 const everyone=[a,b].map(p=>p.next(m=>m.type==='chat'&&m.message.channel==='world'));c.send({type:'chat',channel:'world',text:'모두 안녕'});await Promise.all(everyone);
 await c.request({type:'chat',channel:'guild',text:'침입'},m=>m.type==='error');
 const after=a.next(m=>m.type==='chatHistory');a.send({type:'guildLeave'});const h=await after;assert.ok(!h.messages.some(m=>m.channel==='guild'));const gu=await a.request({type:'chat',channel:'guild',text:'떠난길드'},m=>m.type==='error');assert.match(gu.message,/길드/);
});
test('private recruiting is hidden, dungeon party is capped at four, and return keeps party',async t=>{
 const {url,app}=await setup(t),p=[];for(let i=0;i<5;i++)p.push(await user(t,url,'party'+i,false));const room=await p[0].request({type:'create',public:false},m=>m.type==='state');await ack(p[4]);assert.ok(p[4].messages.filter(m=>m.type==='board').every(b=>!b.rooms.some(r=>r.code===room.code)));
 for(const c of p.slice(1,4))await c.request({type:'join',code:room.code},m=>m.type==='state');await p[4].request({type:'join',code:room.code},m=>m.type==='error');
 for(const c of p.slice(0,4))await c.request({type:'ready',ready:true},m=>m.type==='state'&&m.members.find(p=>p.id===c.profile.id)?.ready);
 const start=await p[0].request({type:'start'},m=>m.type==='state'&&m.raid);assert.equal(start.raid.players.length,4);await p[1].request({type:'market'},m=>m.type==='error');
 const partyChat=p[3].next(m=>m.type==='chat'&&m.message.channel==='party');p[1].send({type:'chat',channel:'party',text:'던전에서도 대화'});await partyChat;
 const raid=app.rooms.get(room.code).raid;raid.state='wiped';const returned=await p[0].request({type:'lobby'},m=>m.type==='state'&&!m.raid);assert.equal(returned.members.length,4);assert.ok(returned.members.every(p=>!p.ready));
});
test('server snapshots use equipped stats and ready is revoked when equipment changes',async t=>{
 const {url,app,store}=await setup(t),a=await user(t,url,'equipA'),b=await user(t,url,'equipB');store.award('seed',[a.profile.id],'tutorial',{gold:2000,items:[]});store.purchase(a.profile.id,'a_hood',1);const room=await a.request({type:'create'},m=>m.type==='state');await b.request({type:'join',code:room.code},m=>m.type==='state');await a.request({type:'ready',ready:true},m=>m.type==='state'&&m.members[0].ready);const off=a.next(m=>m.type==='state'&&!m.members[0].ready);a.send({type:'equip',item:'a_hood'});await off;assert.equal(store.public(a.profile.id).stats.hp,25050);for(const c of [a,b])await c.request({type:'ready',ready:true},m=>m.type==='state'&&m.members.find(p=>p.id===c.profile.id)?.ready);const state=await a.request({type:'start'},m=>m.type==='state'&&m.raid);assert.equal(state.raid.players.find(p=>p.id===a.profile.id).maxHp,25050);assert.equal(app.rooms.size,1);
});
