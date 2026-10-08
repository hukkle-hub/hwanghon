/* 필드 보스 — 주기 창 · 출현 · 서버가 굴리는 피해 · 처치 기록 · 바닥 드롭 · 재시작 복원 (docs/design/186 §3, 188) */
const test=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events'),{WebSocket}=require('ws');
const CY=require('../server/boss-cycle.cjs'),T=require('../server/boss-table.cjs'),C=require('../server/content.cjs');
const {Field,HIT_GAP,LOOT_PRIORITY,BOSS_IMPACT_LIFE,reachOf}=require('../server/field.cjs'),{Store}=require('../server/store.cjs'),{createPartyServer}=require('../server/index.cjs');
const H=36e5, M=6e4;
const seq=(...v)=>{ let i=0; return ()=>v[i++%v.length]; };

test('주기 창: 창 안 무작위 시각 · 죽으면 다음 주기 · 확률 실패는 건너뜀 · 시간 배율',()=>{
 const c=CY.norm({period:'2h',start:'30m',end:'1h30m'});
 assert.equal(c.period,2*H); assert.equal(c.start,30*M); assert.equal(CY.ms('1h30m'),90*M);
 for(const t0 of [0, 10*M, 45*M, 100*M, 7*H+5*M]) for(const r of [0,0.5,0.999]){
  const at=CY.nextSpawn(c,t0,{rng:()=>r}), base=Math.floor(at/c.period)*c.period;
  assert.ok(at>=t0,'과거에 나오지 않는다'); assert.ok(at-base>=c.start&&at-base<c.end,'창 안 '+((at-base)/M)+'분'); }
 /* 창이 열린 중에 죽으면 같은 창에 다시 나오지 않는다 */
 const killed=50*M, again=CY.nextSpawn(c,killed,{rng:()=>0,dead:true});
 assert.ok(again>=2*H+30*M,'다음 주기 창 '+(again/M)+'분');
 /* 확률: 첫 주기는 실패(0.95 ≥ 0.5), 다음 주기는 성공 */
 const half=CY.norm({period:'1h',start:'0m',end:'30m',chance:0.5});
 assert.ok(CY.nextSpawn(half,0,{rng:seq(0.95,0.1,0.5)})>=H,'실패한 주기는 건너뛴다');
 assert.equal(CY.norm({period:'2h',start:'30m',end:'1h30m'},0.01).period,72e3,'배율 0.01 → 72초');
 assert.throws(()=>CY.norm({period:'1h',start:'50m',end:'40m'}),/주기 창/);
 assert.throws(()=>CY.norm({period:'1h',chance:0}),/확률/);
});

test('보스 표: 맵의 보스마다 줄이 있고, 드롭은 그 보스의 장비뿐 · 보스 장비는 상점에 없다',()=>{
 const f=new Field(); f.initBosses(0);
 for(const o of f.bosses.values()){ assert.ok(T.BOSSES[o.id],'표에 '+o.id);
  for(const g of T.BOSSES[o.id].drops){ assert.ok(g.rate>0&&g.rate<1,o.id+' 확률 '+g.rate);
   for(const id of g.pick){ const d=C.equipment.find(i=>i.id===id); assert.ok(d,'아이템 '+id); assert.equal(d.src,'boss'); } } }
 const FM=require('../server/field-monsters.cjs').FIELD_MONSTERS; assert.equal([...f.bosses.keys()].filter(id=>!FM[id]).length,13,'원작 보스 13자리'); assert.equal(f.bosses.size,13+Object.keys(FM).length,'+ 필드 몬스터 (2급 지배형, 문서 204)');
 const clave=T.BOSSES.clave.drops; assert.equal(clave.find(g=>g.pick.includes('w_clave_blade')).rate,0.015,'전설 무기 1.5%');
 assert.equal(clave.find(g=>g.pick.includes('x_clave_shutter')).rate,0.002,'신화 0.2%');
 const s=new Store(null); for(const who of ['ain','kain','ryu','sera']) assert.ok(!s.shop(who).some(o=>C.equipment.find(i=>i.id===o.id)?.src==='boss'),who+' 상점에 보스 장비 없음');
 s.close();
});

function setup(rng){ const store=new Store(null), events=[];
 const mk=(name,character)=>{ const g=store.guest(name); store.chooseName(g.profile.id,name,character); return g.profile.id; };
 const a=mk('검사','kain'), b=mk('낫꾼','ain');
 const f=new Field({store,emit:e=>events.push(e),rng}); f.initBosses(0); return {store,f,events,a,b}; }

test('필드 보스: 때가 되면 서고 알림 → 닿는 거리에서만 맞고 → 쓰러지면 기록·재료·바닥 드롭 → 1위가 먼저 줍는다',()=>{
 /* rng 0 = 치명타·드롭 전부 성공(0 < 확률), 피해는 ×0.9 */
 const {store,f,events,a,b}=setup(()=>0), o=f.bosses.get('clave');
 assert.equal(o.alive,false); f.tickBosses(o.nextAt-1); assert.equal(o.alive,false,'아직');
 f.tickBosses(o.nextAt); assert.equal(o.alive,true,'출현');
 assert.deepEqual(events.find(e=>e.boss==='clave'),{type:'announce',kind:'bossSpawn',zone:'gangnam_b1',boss:'clave',name:'클레이브',title:o.title,place:o.place});
 const pa=f.join(a,store.public(a),'gangnam_b1'), pb=f.join(b,store.public(b),'gangnam_b1');
 assert.equal(f.hit(a,{boss:'clave'},store.public(a),1e9),null,'멀리서는 안 맞는다');assert.equal(o.impactSeq,0,'거절된 공격은 접촉 사건도 만들지 않는다');
 pa.x=o.x+reachOf(o)-0.2; pa.z=o.z; pb.x=o.x; pb.z=o.z+1;
 const h=f.hit(a,{boss:'clave'},store.public(a),1e9); assert.ok(h&&h.dmg>0,'맞는다'); assert.equal(h.crit,true);
 assert.equal(f.hit(a,{boss:'clave'},store.public(a),1e9+HIT_GAP-1),null,'너무 빠른 연타는 버린다');
 const bossView=f.bossView(pb,1e9),claveRow=bossView.bosses.find(x=>x[0]==='clave'),claveAct=bossView.bossActs.find(x=>x.id==='clave');
 assert.deepEqual(Object.keys(bossView).sort(),['bossActs','bossImpacts','bossNow','bosses','loot'],'보스 스냅숏 허용 필드만');
 assert.equal(bossView.bossImpacts.length,1);assert.equal(bossView.bossImpacts[0].length,7,'접촉은 고정 배열');assert.equal(bossView.bossImpacts[0][0],'clave');assert.equal(bossView.bossImpacts[0][1],h.impact[0]);
 assert.ok(!/(?:hp|maxHp|health|ratio|dmg)/i.test(JSON.stringify({bossImpacts:bossView.bossImpacts})),'공동 접촉에는 피해·체력 없음');
 assert.equal(f.bossView(pb,1e9+BOSS_IMPACT_LIFE+1).bossImpacts.length,0,'짧은 수명이 지나면 접촉 사건을 보내지 않는다');
 assert.deepEqual(claveRow,['clave',1],'살아 있다는 것만 — 체력은 보내지 않는다');
 assert.deepEqual(Object.keys(claveAct).sort(),['counterClose','counterOpen','endsAt','id','motion','part','seq','skill','startedAt','x','yaw','z'],'보스 동작에도 체력 필드 없음');
 assert.deepEqual(Object.keys(h).sort(),['boss','counter','crit','dmg','down','impact','part','type'],'타격 응답 허용 필드만 — 체력·비율 없음');assert.equal(h.impact.length,4,'공격자 접촉은 순번·좌표·시각만');
 /* b 가 조금, a 가 대부분 */
 f.hit(b,{boss:'clave'},store.public(b),1e9+1); let t=1e9+HIT_GAP; while(o.alive){ f.hit(a,{boss:'clave'},store.public(a),t); t+=HIT_GAP; }
 const down=events.find(e=>e.kind==='bossDown'); assert.ok(down,'처치 알림'); assert.equal(down.top,store.public(a).name);
 assert.ok(o.nextAt>t,'다음 출현은 미래'); const base=Math.floor(o.nextAt/o.cycle.period)*o.cycle.period; assert.ok(base>Math.floor(t/o.cycle.period)*o.cycle.period,'같은 주기 창에는 다시 안 나온다');
 const kills=store.bossKills('clave'); assert.equal(kills.length,1); assert.equal(kills[0].top,a); assert.equal(kills[0].players,2);
 assert.deepEqual(JSON.parse(kills[0].drops).sort(),['a_clave_helm','w_clave_blade','x_clave_shutter'].sort(),'rng 0 → 묶음마다 첫 장비');
 assert.equal(store.get(a).items.m_heart>=1,true,'1위 재료'); assert.deepEqual(store.bossTitles(a).map(r=>({...r})),[{boss:'clave',n:1}]);
 const shareB=o.dmg.get(b)/[...o.dmg.values()].reduce((x,y)=>x+y,0); assert.ok(shareB<0.05,'b 기여 '+shareB.toFixed(3)); assert.ok(!(store.get(b).items.m_heart>0),'5% 미만은 재료 없음');
 /* 바닥 드롭: b 는 10초 동안 못 줍고, a 는 줍는다. 전설·신화는 서버 전체 알림 */
 const loot=[...f.loot.values()]; assert.equal(loot.length,3); const blade=loot.find(l=>l.item==='w_clave_blade');
 pb.x=blade.x; pb.z=blade.z; assert.throws(()=>f.pickup(b,blade.id,store,t),/1위가 먼저/);
 assert.equal(f.bossView(pb,t).loot.find(l=>l[0]===blade.id)[4],0,'b 에게는 «아직 아님» 으로 보인다');
 pa.x=blade.x+5; pa.z=blade.z; assert.throws(()=>f.pickup(a,blade.id,store,t),/가까이/);
 pa.x=blade.x; const got=f.pickup(a,blade.id,store,t); assert.equal(got.profile.items.w_clave_blade,1);
 assert.deepEqual(events.pop(),{type:'announce',kind:'loot',zone:'gangnam_b1',boss:'clave',who:store.public(a).name,item:'w_clave_blade',name:'달아오른 장검',rarity:'legend'});
 /* 10초 뒤에는 누구나 · 이미 가진 장비는 못 줍는다 */
 const helm=loot.find(l=>l.item==='a_clave_helm'); pb.x=helm.x; pb.z=helm.z; const gb=f.pickup(b,helm.id,store,t+LOOT_PRIORITY); assert.equal(gb.profile.items.a_clave_helm,1);
 store.close();
});

test('필드 보스: 서버가 다시 떠도 «다음 출현 시각» 과 «살아 있음» 을 이어 간다',()=>{
 const dir=require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'tw-boss-'));
 let s=new Store(dir), f=new Field({store:s,rng:()=>0.3}); f.initBosses(1e9); const wait=f.bosses.get('aegis').nextAt; f.spawnBoss(f.bosses.get('clave'),1e9); s.close();
 s=new Store(dir); f=new Field({store:s,rng:()=>0.9}); f.initBosses(1e9+5e3);
 assert.equal(f.bosses.get('aegis').nextAt,wait,'약속한 시각 그대로'); assert.equal(f.bosses.get('clave').alive,true,'살아 있던 보스는 다시 선다'); s.close();
});

test('필드 보스: 실제 소켓 — fieldJoined 에 보스 상태, 때리면 bossHit, 쓰러뜨리면 모두에게 알림',async t=>{
 const store=new Store(null), app=createPartyServer({store}), addr=await app.listen(0,'127.0.0.1'), url='ws://127.0.0.1:'+addr.port+'/party-socket'; t.after(()=>app.close());
 const socket=new WebSocket(url), got=[]; socket.on('message',b=>got.push(JSON.parse(b))); t.after(()=>socket.close());
 const wait=async(fn,ms=3000)=>{ const t0=Date.now(); while(Date.now()-t0<ms){ const m=got.find(fn); if(m){ got.splice(got.indexOf(m),1); return m; } await new Promise(r=>setTimeout(r,20)); } throw Error('timeout'); };
 await once(socket,'open'); const sendj=m=>socket.send(JSON.stringify(m));
 sendj({type:'hello',name:'시험'}); const hello=await wait(m=>m.type==='welcome'); sendj({type:'character',name:'보스사냥',character:'kain'}); await wait(m=>m.type==='profile');
 const o=app.field.bosses.get('dropper'); o.max=o.hp=1; app.field.spawnBoss(o);
 await wait(m=>m.type==='announce'&&m.kind==='bossSpawn'&&m.boss==='dropper');
 sendj({type:'fieldJoin',zone:'namsan_tower'}); const j=await wait(m=>m.type==='fieldJoined'); assert.deepEqual(j.bosses.find(b=>b[0]==='dropper'),['dropper',1],'살아 있음 (체력 없음)');
 sendj({type:'fieldMove',x:o.x+0.5,z:o.z,anim:'idle'}); await wait(m=>m.type==='field');
 const pl=app.field.players.get(hello.profile.id); pl.x=o.x+0.5; pl.z=o.z;   /* 출발점에서 보스까지 걸어가는 대신 */
 sendj({type:'fieldHit',boss:'dropper'}); const hit=await wait(m=>m.type==='bossHit'); assert.equal(hit.down,true);assert.deepEqual(Object.keys(hit).sort(),['boss','counter','crit','dmg','down','impact','part','type'],'체력·최대 체력·비율이 들어올 자리가 없다');assert.equal(hit.impact.length,4);
 const down=await wait(m=>m.type==='announce'&&m.kind==='bossDown'); assert.equal(down.top,'보스사냥'); assert.equal(down.changed,undefined,'내부 목록은 보내지 않는다');
 const prof=await wait(m=>m.type==='profile'&&m.profile.items.m_heart>0); assert.ok(prof,'재료가 프로필로 온다');
});

test('클레이브 1위 처치 칭호는 캐시를 비우고 본인 fieldInfo·주변 infos에 즉시 전파된다',async t=>{
 const store=new Store(null),app=createPartyServer({store}),addr=await app.listen(0,'127.0.0.1'),url='ws://127.0.0.1:'+addr.port+'/party-socket';t.after(()=>app.close());
 async function client(name){const socket=new WebSocket(url),got=[];socket.on('message',b=>got.push(JSON.parse(b)));t.after(()=>socket.close());
  const wait=async(fn,ms=3000)=>{const t0=Date.now();while(Date.now()-t0<ms){const m=got.find(fn);if(m){got.splice(got.indexOf(m),1);return m;}await new Promise(r=>setTimeout(r,20));}throw Error(name+' timeout '+JSON.stringify(got.slice(-8).map(m=>({type:m.type,bossImpacts:m.bossImpacts}))));};
  await once(socket,'open');const send=m=>socket.send(JSON.stringify(m));send({type:'hello',name});const hello=await wait(m=>m.type==='welcome');send({type:'character',name,character:'kain'});await wait(m=>m.type==='profile');return {socket,wait,send,id:hello.profile.id,got};}
 const a=await client('칭호검사'),b=await client('칭호관찰');const o=app.field.bosses.get('clave');o.max=o.hp=1;app.field.spawnBoss(o);
 a.send({type:'fieldJoin',zone:'gangnam_b1'});await a.wait(m=>m.type==='fieldJoined');b.send({type:'fieldJoin',zone:'gangnam_b1'});await b.wait(m=>m.type==='fieldJoined');
 await b.wait(m=>m.type==='field'&&m.infos&&m.infos[a.id]);const pa=app.field.players.get(a.id),pb=app.field.players.get(b.id);pa.x=o.x+.5;pa.z=o.z;pb.x=o.x+1;pb.z=o.z;
 a.send({type:'fieldHit',boss:'clave'});const hit=await a.wait(m=>m.type==='bossHit'&&m.down);assert.equal(o.impacts.at(-1)?.seq,hit.impact[0],'서버 보스에 같은 접촉 순번 보존');assert.ok(Date.now()-o.impacts.at(-1).at<500);assert.ok(o.nextAt>Date.now(),'죽은 보스의 다음 출현은 미래');assert.ok(app.field.bossView(pb).bossImpacts.some(h=>h[1]===hit.impact[0]),'관찰자의 직접 스냅숏에 접촉 포함');
 const seen=await b.wait(m=>m.type==='field'&&m.bossImpacts?.length);const shared=seen.bossImpacts.find(h=>h[0]==='clave');assert.ok(shared,'클레이브 접촉');assert.equal(shared[1],hit.impact[0],'공격자와 관찰자가 같은 순번');assert.equal(shared.length,7);assert.ok(!('dmg' in seen),'관찰자 필드 패킷에는 타인의 피해량이 없다');
 const self=await a.wait(m=>m.type==='fieldInfo'&&m.info.title);
 assert.deepEqual(self.info.title,{boss:'clave',text:'클레이브 토벌자',tier:1});
 const peer=seen.infos?.[a.id]?.title?seen:await b.wait(m=>m.type==='field'&&m.infos&&m.infos[a.id]&&m.infos[a.id].title);assert.deepEqual(peer.infos[a.id].title,self.info.title);
});
