/* 2D 맵 MMORPG 필드 동기화 (docs/design/185 §6.4, server/field.cjs) — 실제 소켓 두 개 */
const test=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events'),{WebSocket}=require('ws'),{createPartyServer}=require('../server/index.cjs'),{Store}=require('../server/store.cjs'),{Field,MAX_SPEED,AOI}=require('../server/field.cjs');
async function client(url,name){const socket=new WebSocket(url),queue=[],waiters=[];
 socket.on('message',b=>{const msg=JSON.parse(b);const w=waiters.find(w=>w.match(msg));if(w){clearTimeout(w.timer);waiters.splice(waiters.indexOf(w),1);w.resolve(msg);}else{queue.push(msg);if(queue.length>200)queue.shift();}});
 const next=(match=()=>true,ms=3000)=>{const i=queue.findIndex(match);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={match,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('message timeout'));},ms)};waiters.push(w);});};
 await once(socket,'open');socket.send(JSON.stringify({type:'hello',name}));const hello=await next(m=>m.type==='welcome');
 socket.send(JSON.stringify({type:'character',name:('요원_'+hello.profile.id.replaceAll('-','')).slice(0,16),character:name==='B'?'kain':'ain'}));await next(m=>m.type==='profile');
 return {hello,next,send:m=>socket.send(JSON.stringify(m)),close:()=>socket.close(),drain:()=>queue.splice(0)};}
test('필드: 두 사람이 같은 지역에서 서로의 위치·동작·영웅을 받고, 나가면 사라진다',async t=>{
 const app=createPartyServer({store:new Store(null)}),addr=await app.listen(0,'127.0.0.1'),url='ws://127.0.0.1:'+addr.port+'/party-socket';t.after(()=>app.close());
 const a=await client(url,'A'),b=await client(url,'B');t.after(()=>{a.close();b.close();});
 a.send({type:'fieldJoin',zone:'gangnam',look:2});const ja=await a.next(m=>m.type==='fieldJoined');b.send({type:'fieldJoin',zone:'gangnam'});await b.next(m=>m.type==='fieldJoined');
 a.send({type:'fieldMove',x:ja.x+0.5,z:ja.z,yaw:1.2,anim:'run'});
 const seen=await b.next(m=>m.type==='field'&&m.players.some(p=>p[0]===a.hello.profile.id&&p[4]===1));
 const pa=seen.players.find(p=>p[0]===a.hello.profile.id);assert.ok(Math.abs(pa[1]-(ja.x+0.5))<0.05,'위치');assert.equal(pa[3],1.2);
 /* 고정 정보는 처음 한 번 — 영웅·외형 프리셋 */
 const withInfo=seen.infos[a.hello.profile.id]||(await b.next(m=>m.type==='field'&&m.infos[a.hello.profile.id])).infos[a.hello.profile.id];
 assert.equal(withInfo.character,'ain');assert.equal(withInfo.look,2);
 const later=await b.next(m=>m.type==='field'&&m.players.length);assert.equal(later.infos[a.hello.profile.id],undefined,'두 번째부터는 정보를 다시 보내지 않는다');
 a.send({type:'fieldLeave'});await a.next(m=>m.type==='fieldLeft');b.drain();
 const gone=await b.next(m=>m.type==='field');assert.equal(gone.players.length,0);
 a.send({type:'fieldJoin',zone:'../../etc'});assert.match((await a.next(m=>m.type==='error')).message,/지역/);
});
test('필드: 순간이동은 최대 속도로 잘리고, 걷는 띠 밖으로 못 나가며, 반경 밖 사람은 안 보낸다',()=>{
 const f=new Field(),prof={name:'x',character:'ain',equipment:{main:'w_marsh_scythe'}};
 const p=f.join('a',prof,'gangnam'),q=f.join('b',prof,'gangnam');const x0=p.x,z0=p.z;
 f.move('a',{x:x0+50,z:z0,anim:'run'},p.at+500);   /* 0.5초에 50 m */
 const moved=Math.hypot(p.x-x0,p.z-z0);assert.ok(moved<=MAX_SPEED*0.5+0.6+1e-6,'이동 '+moved.toFixed(2)+' m');assert.ok(moved>1,'조금은 움직인다');
 f.move('a',{x:0,z:-999,anim:'idle'},p.at+60000);   /* 1분 뒤라도 띠 밖은 안 된다 */
 const c=Math.cos(f.zones.get('gangnam').ang),s=Math.sin(f.zones.get('gangnam').ang),t=-p.x*s-p.z*c;assert.ok(t<=f.zones.get('gangnam').walk.t1+1e-6,'t '+t);
 f.move('a',{x:p.x,z:p.z,anim:'춤'},p.at+100);assert.equal(p.anim,'idle','모르는 동작은 대기로');
 q.x=p.x+AOI+5;q.z=p.z;assert.equal(f.view(p).players.length,0,'반경 밖');q.x=p.x+3;assert.equal(f.view(p).players.length,1,'반경 안');
});
