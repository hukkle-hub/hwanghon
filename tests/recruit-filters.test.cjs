/* 파티 모집 화면(설계 시트 03)이 필요로 하는 세 축 — 방의 모집 조건, 목록의 역할,
   그리고 카드의 5줄 등급표. 화면이 아니라 «서버가 그 값을 내려 주는가» 를 본다. */
const test=require('node:test'),assert=require('node:assert/strict');
const {createPartyServer}=require('../server/index.cjs'),{Store}=require('../server/store.cjs');
const {connect}=require('./helpers/party-client.cjs');

async function setup(t){const store=new Store(null),app=createPartyServer({store});
 const a=await app.listen(0,'127.0.0.1');t.after(()=>app.close());
 return {store,url:`ws://127.0.0.1:${a.port}/party-socket`};}
async function user(t,url,tag,character='ain'){
 const c=await connect(url,{type:'account',mode:'register',username:'rc_'+tag,password:'test-password-long'});
 assert.equal(c.result.type,'welcome');t.after(()=>c.close());
 c.profile=(await c.request({type:'character',name:'요원_'+tag,character},m=>m.type==='profile')).profile;
 return c;}
const board=c=>c.request({type:'board'},m=>m.type==='board');

test('모집 조건(최소 전투력·음성)이 목록과 방 상태에 실린다',async t=>{
 const {url}=await setup(t);
 const host=await user(t,url,'host','kain');
 const made=await host.request({type:'create',level:'d01',public:true,minPower:30000,voice:true},m=>m.type==='state');
 assert.equal(made.minPower,30000,'방 상태에 최소 전투력');
 assert.equal(made.voice,true,'방 상태에 음성 채팅');

 const guest=await user(t,url,'guest','ryu');
 const list=(await board(guest)).rooms.filter(r=>r.code===made.code);
 assert.equal(list.length,1);
 assert.equal(list[0].minPower,30000);
 assert.equal(list[0].voice,true);
 assert.deepEqual(list[0].chars,['kain'],'역할 필터가 쓸 파티원 캐릭터');
});

test('최소 전투력은 서버가 지킨다 — 화면에서 지우고 보내도 막힌다',async t=>{
 const {url,store}=await setup(t);
 const host=await user(t,url,'gate','ain');
 const made=await host.request({type:'create',level:'d01',public:true,minPower:999999},m=>m.type==='state');

 const weak=await user(t,url,'weak','sera');
 const denied=await weak.request({type:'join',code:made.code},m=>m.type==='error');
 assert.match(denied.message,/전투력/,'거절 사유를 말한다: '+denied.message);
 /* 실제로 못 들어갔는지 방 상태로 확인한다 (오류 메시지만 보고 넘기지 않는다) */
 const after=(await board(weak)).rooms.find(r=>r.code===made.code);
 assert.equal(after.count,1,'거절당한 사람은 방에 없다');
 assert.equal(store.public(host.profile.id).id,host.profile.id);
});

test('가득 찬 공개 방도 목록에 남아 «모집 중만 보기» 가 거를 수 있다',async t=>{
 const {url}=await setup(t);
 const host=await user(t,url,'full0','ain');
 const made=await host.request({type:'create',level:'d01',public:true},m=>m.type==='state');
 for(const tag of ['full1','full2','full3']){
  const c=await user(t,url,tag,'kain');
  await c.request({type:'join',code:made.code},m=>m.type==='state');
 }
 const watcher=await user(t,url,'watch','ryu');
 const row=(await board(watcher)).rooms.find(r=>r.code===made.code);
 assert.ok(row,'가득 찬 방도 목록에 있다');
 assert.equal(row.count,4);
 assert.equal(row.chars.length,4);
 /* 그래도 참가는 서버가 막는다 */
 const denied=await watcher.request({type:'join',code:made.code},m=>m.type==='error');
 assert.match(denied.message,/가득/);
});

test('기술 등급은 기록을 쌓아야 오른다 — 제작·강화·수리가 제작 등급을 올린다',async t=>{
 const {store}=await setup(t);
 const {profile}=await store.register("grade_user","test-password-long","요원_등급");
 const id=profile.id;
 assert.deepEqual(store.techGrades(id),{counter:'C',break:'C',refine:'C',drop:'C',craft:'C'},
   '아무 기록도 없으면 전부 C');

 const p=store.get(id);
 store.bumpSkill(p,{crafted:5,enhOk:4,repairs:3});   /* 8*5 + 6*4 + 2*3 = 70 → A */
 store.put(p);
 assert.equal(store.techScores(store.get(id).skill).craft,70);
 assert.equal(store.techGrades(id).craft,'A','임계값 [0,10,35,100,240] 에서 70 은 A');

 const q=store.get(id);
 store.bumpSkill(q,{counters:200,perfect:60,telegraphs:200});  /* 200 + 120 + 40 = 360 → SS */
 store.put(q);
 assert.equal(store.techGrades(id).counter,'SS');
 assert.equal(store.techGrades(id).break,'C','안 건드린 축은 그대로 C');
});

test('파티 대기 화면의 카드에는 Lv·전투력과 5줄 등급표가 함께 온다',async t=>{
 const {url,store}=await setup(t);
 const host=await user(t,url,'card','sera');
 const p=store.get(host.profile.id);
 store.bumpSkill(p,{breaks:20,breakable:20});   /* 20*10 + 1.0*40 = 240 → S */
 store.put(p);
 const made=await host.request({type:'create',level:'d01',public:false},m=>m.type==='state');
 const me=made.members.find(m=>m.id===host.profile.id);
 assert.ok(me.level>=1&&me.power>0,'Lv·전투력');
 assert.deepEqual(Object.keys(me.grades).sort(),['break','counter','craft','drop','refine']);
 assert.equal(me.grades.break,'S','쌓아 둔 부위 파괴 기록이 등급으로 보인다');
});
