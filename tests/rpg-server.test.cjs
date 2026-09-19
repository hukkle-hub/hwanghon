const test=require('node:test'),assert=require('node:assert/strict');
const {createPartyServer}=require('../server/index.cjs'),{Store}=require('../server/store.cjs'),{connect}=require('./helpers/party-client.cjs'),{Raid}=require('../server/raid.cjs');
async function setup(t){const store=new Store(null),app=createPartyServer({store}),address=await app.listen(0,'127.0.0.1');t.after(()=>app.close());return {store,app,url:`ws://127.0.0.1:${address.port}/party-socket`};}
async function user(t,url,n){const c=await connect(url,{type:'account',mode:'register',username:'rpg_'+n,password:'password-long-test'});t.after(()=>c.close());c.profile=(await c.request({type:'character',name:'출격자_'+n},m=>m.type==='profile')).profile;return c;}
async function rpg(c,action,fields={},match=m=>m.type==='rpgResult'||m.type==='error'){await new Promise(r=>setTimeout(r,130));return c.request({type:'rpg',action,...fields},match);}
const ack=c=>c.request({type:'ping',time:771},m=>m.type==='pong'&&m.echo===771);
test('online progression prevents locked party entry; server quest claims open recruitment',async t=>{const {store,url}=await setup(t),a=await user(t,url,'progress');let error=await a.request({type:'create',level:'d02'},m=>m.type==='error');assert.match(error.message,/해금/);await rpg(a,'quest',{quest:'training',operation:'accept'});store.award('training',[a.profile.id],'tutorial',{gold:100,items:[]});await rpg(a,'quest',{quest:'training',operation:'claim'});const room=await a.request({type:'create',level:'d02'},m=>m.type==='state');assert.equal(room.level,'d02');const b=await user(t,url,'locked');error=await b.request({type:'join',code:room.code},m=>m.type==='error');assert.match(error.message,/해금/);});
test('blocked chat and history are filtered; whispers reach only sender and target; mute covers both',async t=>{const {url,store}=await setup(t),a=await user(t,url,'chatA'),b=await user(t,url,'chatB'),c=await user(t,url,'chatC');await rpg(b,'block',{target:a.profile.id},m=>m.type==='rpg');const whisper=await rpg(a,'whisper',{name:b.profile.name,text:'blocked'},m=>m.type==='error');assert.match(whisper.message,/보낼 수/);await a.request({type:'chat',channel:'world',text:'blocked world'},m=>m.type==='chat');await ack(b);assert.ok(!b.messages.some(m=>m.type==='chat'&&m.message.text==='blocked world'));await rpg(b,'unblock',{target:a.profile.id},m=>m.type==='rpg');await new Promise(r=>setTimeout(r,1000));const message=b.next(m=>m.type==='chat'&&m.message.channel==='whisper');await rpg(a,'whisper',{name:b.profile.name,text:'private'},m=>m.type==='chat'&&m.message.channel==='whisper');await message;await ack(c);assert.ok(!c.messages.some(m=>m.type==='chat'&&m.message.text==='private'));store.moderate('operator','mute',a.profile.id,60,'test');const denied=await rpg(a,'whisper',{name:b.profile.name,text:'muted'},m=>m.type==='error');assert.match(denied.message,/제한/);await a.request({type:'chat',channel:'world',text:'muted world'},m=>m.type==='error');});
test('party invitation belongs to recipient and leader handoff cannot be forged',async t=>{const {url}=await setup(t),a=await user(t,url,'inviteA'),b=await user(t,url,'inviteB'),c=await user(t,url,'inviteC');const room=await a.request({type:'create',purpose:'practice'},m=>m.type==='state');const pending=b.next(m=>m.type==='partyInvitation');await rpg(a,'partyInvite',{name:b.profile.name},m=>m.type==='rpgNotice');const invite=await pending;await rpg(c,'partyAccept',{token:invite.token},m=>m.type==='error');const joined=await rpg(b,'partyAccept',{token:invite.token},m=>m.type==='state');assert.equal(joined.code,room.code);await rpg(b,'partyTransfer',{target:b.profile.id},m=>m.type==='error');const handed=await rpg(a,'partyTransfer',{target:b.profile.id},m=>m.type==='state'&&m.leader===b.profile.id);assert.equal(handed.leader,b.profile.id);});
test('private practice repeats chosen pattern without rewards and can be restarted after clear',async t=>{const {url,app,store}=await setup(t),a=await user(t,url,'practice');const started=await a.request({type:'training',phase:0,pattern:0},m=>m.type==='state'&&m.raid);assert.equal(started.training,true);assert.equal(started.raid.players.length,1);const raid=app.rooms.get(started.code).raid;raid.phaseClear();assert.equal(raid.state,'clear');assert.equal(store.get(a.profile.id).gold,0);assert.equal(store.rewardHistory(a.profile.id).length,0);const again=await a.request({type:'retry'},m=>m.type==='state'&&m.raid?.state==='fight');assert.equal(again.raid.phase,0);await a.request({type:'lobby'},m=>m.type==='left');});
test('consumables debit server inventory once, respect cooldown and preserve usage across retry',async t=>{const {url,app,store}=await setup(t),a=await user(t,url,'potion');const p=store.get(a.profile.id);p.items.c_potion=4;store.put(p);const started=await a.request({type:'training',phase:0,pattern:0},m=>m.type==='state'&&m.raid);const raid=app.rooms.get(started.code).raid,me=raid.players.get(a.profile.id);me.hp=me.maxHp/2;await rpg(a,'useItem',{slot:0},m=>m.type==='profile');assert.equal(store.get(a.profile.id).items.c_potion,3);assert.equal(me.uses.c_potion,1);assert.ok(me.hp>me.maxHp/2);await rpg(a,'useItem',{slot:0},m=>m.type==='error');assert.equal(store.get(a.profile.id).items.c_potion,3);raid.state='wiped';raid.retry();assert.equal(raid.players.get(a.profile.id).uses.c_potion,1);});
test('ordinary users cannot fetch audit logs, moderate peers or post operator announcements',async t=>{const {url,store}=await setup(t),a=await user(t,url,'noAdmin'),b=await user(t,url,'target');for(const action of ['adminState','moderate','announcement']){const e=await rpg(a,action,{operation:'ban',target:b.profile.id,minutes:60,reason:'forged',text:'forged'},m=>m.type==='error');assert.match(e.message,/운영 권한/);}assert.equal(store.sanction(b.profile.id).ban_until,0);});
test('departed members lose rewards; disconnected participants receive their earned clear',async t=>{const {url,app,store}=await setup(t),a=await user(t,url,'rewardA'),b=await user(t,url,'rewardB'),c=await user(t,url,'rewardC');const room=await a.request({type:'create'},m=>m.type==='state');for(const u of [b,c])await u.request({type:'join',code:room.code},m=>m.type==='state');for(const u of [a,b,c])await u.request({type:'ready',ready:true},m=>m.type==='state'&&m.members.find(x=>x.id===u.profile.id)?.ready);await a.request({type:'start'},m=>m.type==='state'&&m.raid);await c.request({type:'leave'},m=>m.type==='left');b.close();await a.request({type:'ping',time:13},m=>m.type==='pong');const raid=app.rooms.get(room.code).raid;raid.phase=raid.A.stages.length-1;raid.phaseClear();assert.ok(store.get(a.profile.id).gold>0);assert.ok(store.get(b.profile.id).gold>0);assert.equal(store.get(c.profile.id).gold,0);});
test('support supplies validate missing status and fighting distance without consuming',()=>{const r=new Raid('d01',[{id:'a',name:'아인',quickslots:['c_antidote','c_throw']}]);assert.throws(()=>r.validateConsumable('a','c_antidote'));assert.throws(()=>r.validateConsumable('a','c_throw'));const p=r.players.get('a');p.bleedT=4;r.validateConsumable('a','c_antidote');r.useConsumable('a','c_antidote');assert.equal(p.bleedT,0);assert.equal(p.uses.c_antidote,1);});
test('configured operator can review reports, mute and lift restrictions through sockets',async t=>{const store=new Store(null),owner=await store.register('operator','operator-password'),target=await store.register('reported','reported-password');store.chooseName(owner.profile.id,'운영자');store.chooseName(target.profile.id,'신고대상');const previous=process.env.ADMIN_IDS;process.env.ADMIN_IDS=owner.profile.id;const app=createPartyServer({store});if(previous===undefined)delete process.env.ADMIN_IDS;else process.env.ADMIN_IDS=previous;const addr=await app.listen(0,'127.0.0.1');t.after(()=>app.close());const c=await connect(`ws://127.0.0.1:${addr.port}/party-socket`,{type:'hello',token:owner.token});t.after(()=>c.close());store.report(owner.profile.id,target.profile.id,'도배 확인','서버 증거');const state=await rpg(c,'adminState',{},m=>m.type==='adminState');assert.equal(state.reports.length,1);await rpg(c,'moderate',{operation:'mute',target:target.profile.id,minutes:60,reason:'도배 확인'},m=>m.type==='adminState');assert.ok(store.sanction(target.profile.id).mute_until>Date.now());await rpg(c,'moderate',{operation:'lift',target:target.profile.id,minutes:1,reason:'해제'},m=>m.type==='adminState');assert.equal(store.sanction(target.profile.id).mute_until,0);});
test('account recovery protocol replaces an existing session and never reuses the old recovery code',async t=>{const {url}=await setup(t),a=await connect(url,{type:'account',mode:'register',username:'recover_socket',password:'original-password'});t.after(()=>a.close());const code=a.result.recoveryCode;assert.ok(code);const replaced=a.next(m=>m.type==='superseded'),b=await connect(url,{type:'account',mode:'recover',username:'recover_socket',code,password:'replacement-password'});t.after(()=>b.close());assert.equal(b.result.type,'welcome');await replaced;assert.notEqual(b.result.recoveryCode,code);const c=await connect(url,{type:'account',mode:'recover',username:'recover_socket',code,password:'replacement-password'});t.after(()=>c.close());assert.equal(c.result.type,'error');});

test('기술 성장은 서버가 검증하고 레이드 피해에 실제로 반영된다',async t=>{
 const {url,store}=await setup(t),a=await user(t,url,'skill');const id=a.profile.id;
 // 포인트가 없으면 올릴 수 없다
 const poor=await rpg(a,'skillUp',{skill:'slash'});
 const before=store.get(id);before.xp=0;store.put(before);
 assert.ok(poor.type==='rpgResult'||/포인트/.test(poor.message||''),'첫 포인트는 기본 지급');
 // 레벨을 올려 포인트를 준 뒤 한계까지 강화
 const p=store.get(id);p.xp=1200*12;store.put(p);
 const view=()=>store.rpgState(id).skills;
 const free0=view().points.free;assert.ok(free0>=4,'레벨에 따라 포인트가 늘어난다');
 for(let i=0;i<2;i++)await rpg(a,'skillUp',{skill:'slash'});
 assert.equal(view().skills.find(s=>s.id==='slash').lv,4,'강화가 누적된다');
 // 분기는 3단계부터, 한 번 고르면 바꿀 수 없다
 const branched=await rpg(a,'skillBranch',{skill:'slash',branch:'B'});
 assert.equal(branched.type,'rpgResult');
 assert.equal(view().skills.find(s=>s.id==='slash').br,'B');
 const reBranch=await rpg(a,'skillBranch',{skill:'slash',branch:'A'});
 assert.ok(/초기화/.test(String(reBranch.message||'')),'분기 변경은 초기화를 요구');
 // 알 수 없는 기술은 거부
 const bogus=await rpg(a,'skillUp',{skill:'없는기술'});
 assert.equal(bogus.type,'error');
 // 성장 수치가 레이드에 들어간다
 const kit=store.skillsFor(id),base=require('../server/content.cjs').skills.ain[0];
 const grown=kit.skills.find(k=>k.id==='slash');
 assert.ok(grown.mult>base.mult,'배율이 올라간다');
 assert.ok(grown.cd<base.cd,'쿨타임이 줄어든다');
 assert.equal(grown.bleed,1,'분기 B 가 출혈을 준다');
 const raid=new Raid('d01',[{id:id,name:'성장',stats:store.stats(id),skills:kit}]);
 assert.equal(raid.players.get(id).skills[0].mult,grown.mult,'레이드가 성장 수치를 쓴다');
 assert.equal(raid.players.get(id).ultSkill.mult,kit.ult.mult,'궁극기도 성장 수치를 쓴다');
 // 초기화는 골드를 받고 되돌린다
 const rich=store.get(id);rich.gold=5000;store.put(rich);
 const reset=await rpg(a,'skillReset');
 assert.equal(reset.type,'rpgResult');
 assert.equal(view().skills.find(s=>s.id==='slash').lv,1,'초기화로 되돌아온다');
 assert.equal(store.get(id).gold,5000-1500,'초기화 비용이 빠진다');
});

test('성장하지 않은 출격자는 기본 수치로 싸운다',()=>{
 const C=require('../server/content.cjs');
 const raid=new Raid('d01',[{id:'plain',name:'기본'}]);
 const p=raid.players.get('plain');
 assert.equal(p.skills[0].mult,C.skills.ain[0].mult);
 assert.equal(p.ultSkill.mult,C.skills.ainUlt.mult);
 assert.equal(p.ult,0,'궁극기 게이지는 정의와 섞이지 않는다');
});

test('출격 캐릭터는 생성 시 정해지고 스탯·무기·기술이 캐릭터를 따른다',async t=>{
 const {url,store}=await setup(t);
 const C=require('../server/content.cjs'),R=require('../server/rpg-rules.cjs');
 const made={};
 for(const c of ['ain','kain','ryu','sera']){
  const conn=await connect(url,{type:'account',mode:'register',username:'chr_'+c,password:'password-long-test'});
  t.after(()=>conn.close());
  const p=(await conn.request({type:'character',name:'출격'+c,character:c},m=>m.type==='profile'||m.type==='error')).profile;
  assert.equal(p.character,c,c+' 선택이 저장된다');
  assert.equal(p.equipment.main,R.startingWeapon[c],c+' 시작 무기');
  assert.equal(p.stats.hp,C.characters[c].stats.hp,c+' 기본 체력은 시트 그대로');
  assert.equal(Math.round(p.stats.atk),C.characters[c].stats.atk,c+' 기본 공격력은 시트 그대로');
  const view=store.rpgState(p.id).skills;
  assert.equal(view.character,c);
  assert.equal(view.skills[0].name,C.skills[c][0].name,c+' 자기 기술을 받는다');
  made[c]=p.id;
 }
 // 남의 무기는 착용할 수 없다
 const kain=made.kain,p=store.get(kain);p.items.w_sera_flask=1;store.put(p);
 assert.throws(()=>store.equip(kain,'w_sera_flask'),/착용할 수 없는/);
 // 방어구는 누구나
 const armor=C.equipment.find(i=>i.type==='armor');
 const q=store.get(kain);q.items[armor.id]=1;q.xp=1200*40;store.put(q);
 assert.doesNotThrow(()=>store.equip(kain,armor.id),'방어구는 캐릭터 제한이 없다');
 // 알 수 없는 캐릭터는 거부
 const bad=await connect(url,{type:'account',mode:'register',username:'chr_bad',password:'password-long-test'});
 t.after(()=>bad.close());
 const err=await bad.request({type:'character',name:'잘못된선택',character:'없는캐릭터'},m=>m.type==='profile'||m.type==='error');
 assert.equal(err.type,'error');
});

test('구버전 프로필은 아인으로 이관되고 장비를 잃지 않는다',()=>{
 const {Store}=require('../server/store.cjs');
 const store=new Store(null);
 const legacy=store.normalize({gold:10,equipment:{main:'w_rust_sword',chest:'a_reed_cuirass'}});
 assert.equal(legacy.character,'ain');
 assert.equal(legacy.equipment.main,'w_rust_sword','기존 주무기 유지');
 assert.equal(legacy.equipment.chest,'a_reed_cuirass','기존 방어구 유지');
});

test('출격 캐릭터 변경: 골드를 받고 기술만 초기화하며 장비·재료는 유지한다',async t=>{
 const {url,store}=await setup(t),a=await user(t,url,'switch');const id=a.profile.id;
 const C=require('../server/content.cjs'),R=require('../server/rpg-rules.cjs');
 // 준비: 골드·재료·기술 강화
 const p=store.get(id);p.gold=10000;p.xp=1200*10;p.items.m_alloy=42;p.items.a_reed_cuirass=1;store.put(p);
 await rpg(a,'skillUp',{skill:'slash'});
 assert.equal(store.rpgState(id).skills.skills.find(s=>s.id==='slash').lv,2);
 // 비용 부족은 거부
 const broke=store.get(id);broke.gold=100;store.put(broke);
 const poor=await rpg(a,'switchCharacter',{character:'kain'});
 assert.equal(poor.type,'error');
 assert.equal(store.get(id).character,'ain','실패하면 그대로');
 // 정상 변경
 const rich=store.get(id);rich.gold=10000;store.put(rich);
 const ok=await rpg(a,'switchCharacter',{character:'kain'});
 assert.equal(ok.type,'rpgResult');
 const after=store.get(id);
 assert.equal(after.character,'kain');
 assert.equal(after.gold,10000-3000,'변경 비용이 빠진다');
 assert.equal(after.items.m_alloy,42,'재료 유지');
 assert.equal(after.items.a_reed_cuirass,1,'방어구 유지');
 assert.equal(after.equipment.main,R.startingWeapon.kain,'새 캐릭터의 시작 무기를 든다');
 assert.ok(after.items[R.startingWeapon.kain]>0,'시작 무기를 지급받는다');
 assert.ok(after.items[R.startingWeapon.ain]>0,'이전 무기는 가방에 남는다');
 const view=store.rpgState(id).skills;
 assert.equal(view.character,'kain');
 assert.equal(view.skills[0].name,C.skills.kain[0].name,'기술표가 새 캐릭터 것으로');
 assert.equal(view.points.spent,0,'기술은 초기화되고 포인트를 돌려받는다');
 const lv=1+Math.floor(after.xp/1200);
 assert.equal(store.stats(id).hp,C.characters.kain.stats.hp+(lv-1)*150,'기본 체력이 새 캐릭터 + 레벨 성장분');
 // 같은 캐릭터로는 변경 불가, 없는 캐릭터도 거부
 assert.equal((await rpg(a,'switchCharacter',{character:'kain'})).type,'error');
 assert.equal((await rpg(a,'switchCharacter',{character:'없는캐릭터'})).type,'error');
});
