/* 2D 맵 MMORPG 필드 동기화 (docs/design/185 §6.4, server/field.cjs) — 실제 소켓 두 개 */
const test=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events'),{WebSocket}=require('ws'),{createPartyServer}=require('../server/index.cjs'),{Store}=require('../server/store.cjs'),{Field,MAX_SPEED,AOI,prestigeTitle}=require('../server/field.cjs');
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
 a.send({type:'equip',item:'w_marsh_scythe'});assert.match((await a.next(m=>m.type==='error')).message,/필드에서 나온 뒤/,'필드에서 장비 교체로 주변 외형을 반복 재생성할 수 없다');
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
test('필드: 다른 지역의 문으로 넘어오면 그 문 앞에 선다 (모르는 문이면 출발점)',()=>{
 const {Field}=require('../server/field.cjs');const f=new Field(),prof={name:'x',character:'ain'};
 const z=f.zone('gangnam'),g=z.gates.find(x=>x.id==='exit5');assert.ok(g,'강남 맵에 5번 출구 문');
 const p=f.join('a',prof,'gangnam',0,'exit5');assert.ok(Math.hypot(p.x-g.x,p.z-g.z)<2,'문 앞 '+Math.hypot(p.x-g.x,p.z-g.z).toFixed(2));
 const q=f.join('b',prof,'gangnam',0,'../없는문');assert.ok(Math.hypot(q.x-z.spawn.x,q.z-z.spawn.z)<2,'출발점');
});

test('필드 외형 정보: 장착 전 슬롯·슬롯별 강화·클레이브 1위 칭호만 공개한다',()=>{
 const store=new Store(null),g=store.guest('명예');store.chooseName(g.profile.id,'명예기사','kain');const id=g.profile.id,p=store.get(id);
 p.equipment={main:'w_clave_blade',off:'x_clave_shutter',head:'a_clave_helm',chest:'a_clave_cuirass',gloves:'a_clave_gauntlet',legs:'a_clave_greaves'};
 p.gear={w_clave_blade:{enh:10,dur:31},x_clave_shutter:{enh:9,dur:72},a_clave_helm:{enh:7,dur:88},unused:{enh:10,dur:1}};
 p.items={w_clave_blade:1,unused:99};p.vault={secret:7};store.put(p);
 for(let n=0;n<10;n++)store.bossKill('clave','gangnam_b1',1000+n,[{id,name:'명예기사',share:1,dmg:1}],[],null);
 const f=new Field({store}),joined=f.command(id,{type:'fieldJoin',zone:'gangnam_b1',look:3},store.public(id),false),info=joined.info;
 assert.deepEqual(info.eq,p.equipment,'방어구와 셔터까지 전체 장착 슬롯');
 assert.deepEqual(info.enh,{main:10,off:9,head:7},'장착한 것의 저장된 강화만');
 assert.deepEqual(info.title,{boss:'clave',text:'셔터를 멈춘 자',tier:2});
 for(const hidden of ['gear','items','vault','dur','hp','maxHp'])assert.equal(hidden in info,false,hidden+' 비공개');
 assert.deepEqual(prestigeTitle([{boss:'clave',n:50}]).text,'강남의 철문');assert.equal(prestigeTitle([{boss:'clave',n:0}]),null);
 store.close();
});

test('필드 칭호 조회는 캐시하고 옛 외형 프리셋 패킷은 실제 장비를 건드리지 않는다',()=>{
 let scans=0;const store={bossTitles(){scans++;return [];}};
 const f=new Field({store}),profile={id:'cache-me',name:'x',character:'kain',equipment:{main:'w_clave_blade'}};
 const p=f.join(profile.id,profile,'gangnam',2);assert.equal(scans,1,'입장 때 한 번');
 f.command(profile.id,{type:'fieldLook',look:2},profile,false);
 f.command(profile.id,{type:'fieldLook',look:99},profile,false);
 f.command(profile.id,{type:'fieldLook',look:3},profile,false);
 assert.equal(p.info.look,2,'입장 뒤 프리셋 변경은 무시');assert.equal(scans,1,'외형 패킷은 처치 기록 DB를 다시 훑지 않는다');
 f.leave(profile.id);f.join(profile.id,profile,'gangnam',2);assert.equal(scans,1,'재입장도 같은 칭호 캐시를 쓴다');
});

test('필드 고정 외형은 소켓 전송 성공 뒤에만 전달 완료로 기록한다',()=>{
 const f=new Field(),profile={name:'x',character:'kain',equipment:{main:'w_clave_blade'}},a=f.join('a',profile,'gangnam'),b=f.join('b',profile,'gangnam');b.x=a.x+1;b.z=a.z;
 const dropped=f.view(a,false);assert.ok(dropped.infos.b,'버퍼에서 버려질 첫 패킷');assert.equal(a.known.has('b'),false,'아직 전달 완료 아님');
 const retry=f.view(a,false);assert.ok(retry.infos.b,'다음 틱에 다시 싣는다');f.commitView(a,retry.players);
 assert.equal(f.view(a,false).infos.b,undefined,'성공 뒤에는 중복 전송하지 않는다');
});
