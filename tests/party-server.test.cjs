const WIRE=require('../js/party-wire.js');
const test=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events'),{WebSocket}=require('ws'),{createPartyServer}=require('../server/index.cjs'),{Store}=require('../server/store.cjs'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
async function client(url,name,token){const socket=new WebSocket(url),queue=[],waiters=[];let seq=0,wireState=null;
 socket.on('message',bytes=>{let msg=JSON.parse(bytes);if(msg.type==='patch')msg=WIRE.apply(wireState,msg.patch);if(msg.type==='state')wireState=msg;const waiter=waiters.find(w=>w.match(msg));if(waiter){clearTimeout(waiter.timer);waiters.splice(waiters.indexOf(waiter),1);waiter.resolve(msg);}else queue.push(msg);});socket.on('error',()=>{});
 const next=(match=()=>true)=>{const i=queue.findIndex(match);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const waiter={match,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(waiter),1);reject(Error('message timeout'));},3000)};waiters.push(waiter);});};
 await once(socket,'open');socket.send(JSON.stringify({type:'hello',name,token}));const hello=await next(m=>m.type==='welcome');if(!hello.profile.characterCreated){socket.send(JSON.stringify({type:'character',name:('유저_'+hello.profile.id.replaceAll('-','')).slice(0,16)}));hello.profile=(await next(m=>m.type==='profile')).profile;}return {socket,hello,next,send:msg=>socket.send(JSON.stringify({seq:++seq,...msg})),clear:()=>queue.splice(0),close:()=>socket.terminate()};
}
async function setup(t,store=new Store(null)){const app=createPartyServer({store}),address=await app.listen(0,'127.0.0.1'),url='ws://127.0.0.1:'+address.port+'/party-socket';t.after(()=>app.close());return {app,url,base:'http://127.0.0.1:'+address.port};}
test('real sockets create/join/ready/start; identical shared damage, private identities and reconnect',async t=>{
 const {app,url}=await setup(t),a=await client(url,'첫째'),b=await client(url,'둘째');t.after(()=>{a.close();b.close();});
 a.send({type:'create',level:'d01'});const made=await a.next(m=>m.type==='state');b.send({type:'join',code:made.code});await b.next(m=>m.type==='state');
 b.send({type:'start'});assert.match((await b.next(m=>m.type==='error')).message,/파티장/);a.send({type:'start'});assert.match((await a.next(m=>m.type==='error')).message,/준비/);
 a.send({type:'ready',ready:true});b.send({type:'ready',ready:true});await a.next(m=>m.type==='state'&&m.members.every(p=>p.ready));a.send({type:'start'});
 const started=await a.next(m=>m.type==='state'&&m.raid);assert.equal(started.raid.players.length,2);assert.equal(JSON.stringify(started).includes(a.hello.token),false);
 const room=app.rooms.get(made.code),raid=room.raid;raid.startFight();for(const p of raid.players.values()){p.x=raid.boss.x-100;p.y=raid.boss.y;p.target='body';}
 const hp=raid.boss.hp;a.send({type:'attack',damage:9999999});b.send({type:'attack'});
 const sa=await a.next(m=>m.type==='state'&&m.raid?.players.every(p=>p.damage>0)),sb=await b.next(m=>m.type==='state'&&m.raid?.players.every(p=>p.damage>0));assert.equal(sa.raid.boss.hp,sb.raid.boss.hp);assert.ok(sa.raid.boss.hp<hp&&sa.raid.boss.hp>hp-10000);
 const id=a.hello.profile.id,oldToken=a.hello.token;a.close();await b.next(m=>m.type==='state'&&m.members.find(p=>p.id===id)?.connected===false);const resumed=await client(url,'첫째',oldToken);t.after(()=>resumed.close());const restored=await resumed.next(m=>m.type==='state'&&m.raid);assert.equal(restored.raid.id,raid.id);assert.ok(restored.raid.players.find(p=>p.id===id).damage>0);assert.equal(restored.members.filter(p=>p.id===id).length,1);
});
test('room isolation, capacity, stale input, origin rejection and private file boundaries',async t=>{
 const {app,url,base}=await setup(t),people=[];for(let i=0;i<5;i++)people.push(await client(url,'P'+i));t.after(()=>people.forEach(p=>p.close()));const [a,b,c,d,e]=people;
 for(const person of people){const p=app.store.get(person.hello.profile.id);p.quests={training:'claimed',marsh:'claimed'};app.store.put(p);}
 a.send({type:'create',level:'d03'});const {code}=await a.next(m=>m.type==='state');for(const p of [b,c,d]){p.send({type:'join',code});await p.next(m=>m.type==='state');}e.send({type:'join',code});assert.match((await e.next(m=>m.type==='error')).message,/가득/);e.send({type:'create',level:'d02'});const other=await e.next(m=>m.type==='state');assert.notEqual(code,other.code);assert.equal(other.members.length,1);
 for(const p of [a,b,c,d])p.send({type:'ready',ready:true});await a.next(m=>m.type==='state'&&m.members.length===4&&m.members.every(p=>p.ready));a.send({type:'start'});await a.next(m=>m.type==='state'&&m.raid);
 a.send({type:'move',seq:100,x:1,y:0});a.send({type:'move',seq:99,x:-1,y:0});await a.next(m=>m.type==='state'&&m.raid?.time>.07);assert.ok(app.rooms.get(code).raid.players.get(a.hello.profile.id).axes.x>=0);
 for(const p of ['/server/store.cjs','/.party-data/profiles.json','/package.json','/.git/config'])assert.equal((await fetch(base+p)).status,404,p);
 assert.equal((await fetch(base+'/party.html')).status,200);assert.equal((await fetch(base+'/js/party-online.js')).status,200);assert.equal((await fetch(base+'/healthz')).status,200);
 const bad=new WebSocket(url,{origin:'https://unrelated.example'});bad.on('error',()=>{});const [res]=await once(bad,'unexpected-response').then(([,res])=>[res]);assert.equal(res.statusCode,403);bad.terminate();
});
test('clear rewards reach both clients once and durable profile survives server-store restart',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tw-party-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const store=new Store(directory),a=store.login(null,'A'),b=store.login(null,'B');
 const {app,url}=await setup(t,store);
 const ca=await client(url,'A',a.token),cb=await client(url,'B',b.token);t.after(()=>{ca.close();cb.close();});ca.send({type:'create'});const made=await ca.next(m=>m.type==='state');cb.send({type:'join',code:made.code});await cb.next(m=>m.type==='state');ca.send({type:'ready',ready:true});cb.send({type:'ready',ready:true});await ca.next(m=>m.type==='state'&&m.members.every(p=>p.ready));ca.send({type:'start'});await ca.next(m=>m.type==='state'&&m.raid);
 const raid=app.rooms.get(made.code).raid;raid.phase=raid.A.stages.length-1;raid.setupBoss();raid.startFight();for(const p of raid.players.values()){p.x=raid.boss.x-100;p.y=raid.boss.y;p.target='body';}raid.boss.hp=1;ca.send({type:'attack'});
 const pa=await ca.next(m=>m.type==='profile'),pb=await cb.next(m=>m.type==='profile');assert.equal(pa.profile.gold,raid.A.rewards.gold+1000);assert.equal(pb.profile.gold,raid.A.rewards.gold+1000);raid.onClear(raid);assert.equal(app.store.public(a.profile.id).gold,raid.A.rewards.gold+1000);const restored=new Store(directory);assert.equal(restored.login(a.token,'A').profile.gold,raid.A.rewards.gold+1000);assert.equal(restored.public(b.profile.id).clears.tutorial,1);restored.close();
});
test('failed disk write rolls back both profiles and run receipts before retry',()=>{
 const store=new Store(null),a=store.login(null,'A'),b=store.login(null,'B'),ids=[a.profile.id,b.profile.id],reward={gold:100,items:[['m_core',2]]};
 store.save=()=>{throw Error('disk full');};assert.throws(()=>store.award('run',ids,'tutorial',reward));
 for(const id of ids){assert.equal(store.public(id).gold,0);assert.deepEqual(store.data.profiles[id].receipts,[]);}
 store.save=()=>{};store.award('run',ids,'tutorial',reward);store.award('run',ids,'tutorial',reward);for(const id of ids)assert.equal(store.public(id).gold,100);
});
