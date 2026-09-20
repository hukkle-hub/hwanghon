/* 운영 도구 — 화면이 쓰는 서버 명령. 운영 화면은 UUID 가 아니라 «누구» 를 봐야 하고,
   제재는 실제로 걸려야 하며, 권한이 없으면 아무것도 되면 안 된다. */
const test=require('node:test'),assert=require('node:assert/strict');
const {createPartyServer}=require('../server/index.cjs'),{Store}=require('../server/store.cjs');
const {connect}=require('./helpers/party-client.cjs');

async function setup(t,adminName){
 const store=new Store(null);
 /* ADMIN_IDS 는 createRpgCommands 가 서버를 만들 때 한 번 읽는다 — 먼저 계정을 만든다 */
 const seeded={};
 for(const tag of ['boss','call','trgt']){
  const {profile}=await store.register('adm_'+tag,'test-password-long','요원_'+tag);
  store.chooseName(profile.id,'요원_'+tag,'ain');
  seeded[tag]=profile.id;
 }
 const before=process.env.ADMIN_IDS;
 process.env.ADMIN_IDS=seeded.boss;
 const app=createPartyServer({store});
 process.env.ADMIN_IDS=before;
 const a=await app.listen(0,'127.0.0.1');
 t.after(()=>app.close());
 return {store,ids:seeded,url:`ws://127.0.0.1:${a.port}/party-socket`};
}
async function login(t,url,tag){
 const c=await connect(url,{type:'account',mode:'login',username:'adm_'+tag,password:'test-password-long'});
 assert.equal(c.result.type,'welcome',JSON.stringify(c.result));t.after(()=>c.close());return c;}
const gap=()=>new Promise(r=>setTimeout(r,150));
const rpg=(c,action,fields,match)=>c.request({type:'rpg',action,...fields},match);

test('운영 권한이 없으면 운영 명령이 전부 막힌다',async t=>{
 const {url}=await setup(t);
 const who=await login(t,url,'call');
 for(const [action,fields] of [['adminState',{}],['adminFind',{name:'요원_trgt'}],
   ['announcement',{text:'테스트'}],['moderate',{operation:'mute',target:'x',minutes:10,reason:'x'}]]){
  await gap();
  const e=await rpg(who,action,fields,m=>m.type==='error');
  assert.match(e.message,/운영 권한/,action+' → '+e.message);
 }
});

test('신고 목록은 UUID 가 아니라 이름과 현재 제재를 함께 준다',async t=>{
 const {url,ids}=await setup(t);
 const caller=await login(t,url,'call'),boss=await login(t,url,'boss');
 await gap();
 await rpg(caller,'report',{name:'요원_trgt',reason:'욕설 반복'},m=>m.type==='rpgNotice');
 await gap();
 const st=await rpg(boss,'adminState',{},m=>m.type==='adminState');
 assert.equal(st.reports.length,1);
 const r=st.reports[0];
 assert.equal(r.targetName,'요원_trgt');
 assert.equal(r.reporterName,'요원_call');
 assert.equal(r.target,ids.trgt);
 assert.deepEqual(Object.keys(r.sanction).sort(),['ban','mute','reason']);
 assert.equal(r.sanction.mute,0,'아직 제재가 없다');
 assert.equal(typeof st.announcement,'string');
});

test('제재는 실제로 걸리고, 해제하면 실제로 풀린다',async t=>{
 const {url,ids,store}=await setup(t);
 const boss=await login(t,url,'boss');
 await gap();
 await rpg(boss,'moderate',{operation:'mute',target:ids.trgt,minutes:60,reason:'욕설 반복'},m=>m.type==='adminState');
 let s=store.sanction(ids.trgt);
 assert.ok(s.mute_until>Date.now(),'채팅 제한이 걸렸다');
 assert.equal(s.reason,'욕설 반복');
 /* 제한된 계정은 정말로 말을 못 한다 */
 const muted=await login(t,url,'trgt');
 await gap();
 const denied=await muted.request({type:'chat',channel:'world',text:'안녕'},m=>m.type==='error');
 assert.match(denied.message,/채팅/);

 await gap();
 await rpg(boss,'moderate',{operation:'lift',target:ids.trgt,minutes:1,reason:'오인'},m=>m.type==='adminState');
 s=store.sanction(ids.trgt);
 assert.equal(s.mute_until,0,'해제됐다');
});

test('제재 기간은 999분이 아니라 1년까지다 — 신고 번호도 999 를 넘을 수 있다',async t=>{
 const {url,ids,store}=await setup(t);
 const boss=await login(t,url,'boss');
 await gap();
 /* 하루(1440분)는 예전 quantity(1~999) 라면 거절당했다 */
 await rpg(boss,'moderate',{operation:'ban',target:ids.trgt,minutes:1440,reason:'장기 제재'},m=>m.type==='adminState');
 const s=store.sanction(ids.trgt);
 const hours=Math.round((s.ban_until-Date.now())/3600000);
 assert.equal(hours,24,'24시간 걸렸다 (실제 '+hours+')');

 await gap();
 const tooLong=await rpg(boss,'moderate',{operation:'ban',target:ids.trgt,minutes:600000,reason:'x'},m=>m.type==='error');
 assert.match(tooLong.message,/1년/);

 /* 번호가 큰 신고도 처리된다 */
 store.db.prepare('INSERT INTO reports(id,reporter,target,reason,evidence,created,status) VALUES(?,?,?,?,?,?,?)')
   .run(1200,ids.call,ids.trgt,'테스트','',Date.now(),'open');
 await gap();
 await rpg(boss,'moderate',{operation:'resolve',target:'1200',minutes:1,reason:'reviewed'},m=>m.type==='adminState');
 assert.equal(store.db.prepare('SELECT status FROM reports WHERE id=1200').get().status,'resolved');
});

test('이름으로 찾으면 id 와 현재 제재가 온다 — 신고가 없어도 조치할 수 있다',async t=>{
 const {url,ids}=await setup(t);
 const boss=await login(t,url,'boss');
 await gap();
 const found=await rpg(boss,'adminFind',{name:'요원_trgt'},m=>m.type==='adminFind');
 assert.equal(found.player.id,ids.trgt);
 assert.equal(found.player.name,'요원_trgt');
 assert.equal(found.player.account,'adm_trgt');
 assert.equal(found.player.sanction.ban,0);
 await gap();
 const missing=await rpg(boss,'adminFind',{name:'없는사람'},m=>m.type==='error');
 assert.match(missing.message,/찾을 수 없습니다/);
});

test('공지는 접속한 모두에게 가고 서버에 남는다',async t=>{
 const {url,store}=await setup(t);
 const boss=await login(t,url,'boss'),who=await login(t,url,'call');
 await gap();
 const heard=who.next(m=>m.type==="rpgNotice"&&m.text.indexOf("점검")>=0);
 await rpg(boss,'announcement',{text:'점검은 23시입니다.'},m=>m.type==='adminState');
 const notice=await heard;
 assert.match(notice.text,/^\[공지\] 점검은 23시입니다\.$/);
 assert.equal(store.db.prepare("SELECT value FROM meta WHERE key='announcement'").get().value,'점검은 23시입니다.');
 await gap();
 const st=await rpg(boss,'adminState',{},m=>m.type==='adminState');
 assert.equal(st.announcement,'점검은 23시입니다.','화면이 현재 공지를 다시 띄울 수 있다');
});
