const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{once}=require('node:events');
const {WebSocket}=require('ws'),{createPartyServer}=require('../server/index.cjs'),{Store}=require('../server/store.cjs');
async function connect(url){
 const ws=new WebSocket(url),queue=[],waiters=[];
 ws.on('message',b=>{const m=JSON.parse(b),w=waiters.find(w=>w.match(m));
  if(w){clearTimeout(w.timer);waiters.splice(waiters.indexOf(w),1);w.resolve(m);}else queue.push(m);});
 const next=(match,ms=4000)=>{const i=queue.findIndex(match);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);
  return new Promise((resolve,reject)=>{const w={match,resolve,timer:setTimeout(()=>reject(Error('socket timeout')),ms)};waiters.push(w);});};
 await once(ws,'open');const send=m=>ws.send(JSON.stringify(m));send({type:'hello',name:'몹소켓'});
 const hello=await next(m=>m.type==='welcome');send({type:'character',name:'검수_'+hello.profile.id.replaceAll('-','').slice(0,8),character:'ain'});
 await next(m=>m.type==='profile');return {ws,send,next,id:hello.profile.id};
}
test('real websocket: field.mobs → mobHit/skill → profile inventory/XP update; duplicates do not reward',async t=>{
 const app=createPartyServer({store:new Store(null),mobRewards:()=>({items:[['m_alloy',1]],gold:2,xp:3})});
 t.after(()=>app.close());const addr=await app.listen(0,'127.0.0.1'),c=await connect('ws://127.0.0.1:'+addr.port+'/party-socket');t.after(()=>c.ws.close());
 c.send({type:'fieldJoin',zone:'namsan'});const joined=await c.next(m=>m.type==='fieldJoined');assert.ok(Array.isArray(joined.mobs));
 const e=app.field.ecologies.get('namsan'),m=[...e.mobs.values()].find(m=>m.group.kind==='nest'),p=app.field.players.get(c.id);
 p.x=m.x;p.z=m.z;p.invulnUntil=Date.now()+60000;const state=app.field.mobStates.get(m.id);state.hp=state.max=100000;
 const snap=await c.next(msg=>msg.type==='field'&&msg.mobs.some(r=>r[0]===m.id));const row=snap.mobs.find(r=>r[0]===m.id);
 assert.equal(row.length,9);assert.equal(row[4],true);assert.equal(row[7],100);assert.ok(Number.isSafeInteger(row[8]));
 c.send({type:'fieldHit',mob:m.id,generation:m.generation,damage:1e12});const hit=await c.next(msg=>msg.type==='mobHit');assert.ok(hit.dmg>0&&hit.dmg<100000);assert.equal(hit.down,false);
 c.send({type:'fieldSkill',skill:0,mob:m.id,generation:m.generation,mult:1e12});const sk=await c.next(msg=>msg.type==='mobHit'&&msg.skill===0);assert.equal(sk.ok,true);assert.ok(sk.dmg>hit.dmg&&sk.dmg<100000);
 state.hp=1;const before=app.store.get(c.id);await new Promise(r=>setTimeout(r,370));
 c.send({type:'fieldHit',mob:m.id,generation:m.generation});const down=await c.next(msg=>msg.type==='mobHit'&&msg.down);assert.equal(down.reward.status,'granted');
 const updated=await c.next(msg=>msg.type==='profile'&&msg.profile.xp===before.xp+3);assert.equal(updated.profile.gold,before.gold+2);
 c.send({type:'fieldHit',mob:m.id,generation:m.generation});await new Promise(r=>setTimeout(r,50));assert.equal(app.store.get(c.id).xp,before.xp+3);
});
test('real HTTP and real browser CJS bridge load pure modules, but account/store/Field sources remain private',async t=>{
 const app=createPartyServer({store:new Store(null)});t.after(()=>app.close());const addr=await app.listen(0,'127.0.0.1'),base='http://127.0.0.1:'+addr.port;
 for(const name of ['field-ecology.cjs','field-ecology-route.cjs','field-mob-combat.cjs','field-ecology-patrols.json'])assert.equal((await fetch(base+'/server/'+name)).status,200);
 for(const name of ['store.cjs','rpg-store.cjs','index.cjs','field.cjs'])assert.equal((await fetch(base+'/server/'+name)).status,404);
 const source=fs.readFileSync(require.resolve('../js/mmo/cjs-browser.js'),'utf8').replace('export function loadCjs','function loadCjs');
 const load=new Function('location','fetch',source+'\nreturn loadCjs;')({href:base+'/world3d.html'},fetch);
 const ai=await load('/server/field-mob-combat.cjs'),eco=await load('/server/field-ecology.cjs');
 assert.equal(ai.statsFor('G5_HOOKHAND').draft,true);assert.equal(typeof eco.Ecology,'function');
});
test('two actual sockets share generation/HP; observer sees a hit and the victim hurt identifies the same mob',async t=>{
 const app=createPartyServer({store:new Store(null)});t.after(()=>app.close());
 const addr=await app.listen(0,'127.0.0.1'),url='ws://127.0.0.1:'+addr.port+'/party-socket';
 const a=await connect(url),b=await connect(url);t.after(()=>{a.ws.terminate();b.ws.terminate();});
 for(const c of [a,b]){c.send({type:'fieldJoin',zone:'namsan'});await c.next(m=>m.type==='fieldJoined');}
 const e=app.field.ecologies.get('namsan'),m=[...e.mobs.values()].find(m=>m.group.kind==='nest'),s=app.field.mobStates.get(m.id);
 for(const n of e.mobs.values())if(n!==m)e.defeat(n.id,Date.now());
 const pa=app.field.players.get(a.id),pb=app.field.players.get(b.id);
 pa.x=pb.x=m.x;pa.z=pb.z=m.z;pa.invulnUntil=pb.invulnUntil=0;s.hp=s.max=100000;
 const {mobsFromPacket}=await import('../js/mmo/field-mobs.js');
 const mine=await a.next(p=>p.type==='field'&&p.mobs.some(r=>r[0]===m.id&&r[4]===true&&r[7]===100));
 const theirs=await b.next(p=>p.type==='field'&&p.mobs.some(r=>r[0]===m.id&&r[4]===true&&r[7]===100));
 const av=mobsFromPacket(mine.mobs).find(v=>v.id===m.id),bv=mobsFromPacket(theirs.mobs).find(v=>v.id===m.id);
 assert.equal(av.generation,bv.generation);assert.equal(av.hp,bv.hp);
 a.send({type:'fieldHit',mob:m.id,generation:m.generation});const hit=await a.next(p=>p.type==='mobHit');
 assert.equal(hit.reward,null);assert.equal(hit.down,false);
 const seen=await b.next(p=>p.type==='field'&&p.mobs.some(r=>r[0]===m.id&&r[7]===hit.hp));
 const observed=mobsFromPacket(seen.mobs).find(v=>v.id===m.id);assert.equal(observed.hp,hit.hp);assert.equal(observed.generation,hit.generation);
 const attacked=await a.next(p=>p.type==='field'&&p.hurt?.[2]===m.id,4000);
 assert.ok(attacked.hurt[6]>0);assert.ok(attacked.mobs.some(r=>r[0]===attacked.hurt[2]));
});
