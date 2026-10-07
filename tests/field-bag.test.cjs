/* 필드 가방·상점 (문서 198) — 장착·회복약은 어디서나, 구매·판매·창고는 마을·쉼터 안에서만.
   거점 마을은 «처음엔 보스가 차지» 라서 길드가 빼앗기 전엔 안전 지대가 아니다 (디렉터 2026-10-07). */
const test=require('node:test'),assert=require('node:assert/strict');
const {Field,POTION_HEAL}=require('../server/field.cjs'),{Store}=require('../server/store.cjs'),BAG=require('../server/field-bag.cjs'),SAFE=require('../js/mmo/safe-zones.js');
const map=z=>require('../maps/2d/'+z+'/map.json');
function setup(zone){ const store=new Store(null), g=store.guest('가방'); store.chooseName(g.profile.id,'가방꾼','ain'); const id=g.profile.id;
 const f=new Field({store,emit:()=>{},rng:()=>0.5}); const p=f.join(id,store.public(id),zone); return {store,f,p,id}; }
const centre=a=>a.circle?[a.circle[0],a.circle[1]]:[a.poly.reduce((s,q)=>s+q[0],0)/a.poly.length,a.poly.reduce((s,q)=>s+q[1],0)/a.poly.length];
const restOf=z=>map(z).areas.find(a=>a.kind==='rest');
function standIn(f,p,a){ const [x,z]=centre(a); p.x=x; p.z=z; f.clamp(f.zones.get(p.zone),p); assert.ok(SAFE.inArea(a,p.x,p.z),'쉼터 한가운데가 걷는 띠 밖이다'); }
function standOut(f,p){ const a=restOf(p.zone), z=f.zones.get(p.zone); for(const s of [z.walk.s0+1,z.walk.s1-1]){ const c=Math.cos(z.ang),sn=Math.sin(z.ang),t=(z.walk.t0+z.walk.t1)/2; p.x=s*c-t*sn; p.z=-s*sn-t*c; if(!SAFE.inArea(a,p.x,p.z)) return; } throw Error('쉼터 밖 자리를 못 찾음'); }

test('쉼터(거점 아닌 지역): 안에서는 회복약을 사고, 밖에서는 못 산다',()=>{
 const {store,f,p,id}=setup('haeundae'), a=restOf('haeundae'); assert.ok(a,'해운대 쉼터');
 store.mutate(id,'test',q=>{ q.gold=1000; });
 standOut(f,p); assert.throws(()=>BAG.bag(store,f,id,{op:'buy',item:'c_potion',quantity:2}),/마을·쉼터/);
 standIn(f,p,a); const r=BAG.bag(store,f,id,{op:'buy',item:'c_potion',quantity:2});
 assert.equal(r.profile.items.c_potion,2); assert.equal(r.profile.gold,1000-2*120);
 assert.throws(()=>BAG.bag(store,f,id,{op:'buy',item:'c_potion',quantity:99}),/골드가 부족/);
 assert.throws(()=>BAG.bag(store,f,id,{op:'buy',item:'m_heart',quantity:1}),/판매하지 않는/,'사지 못하는 재료');
});
test('거점 마을: 처음엔 보스가 차지 — 안전 지대 아님 · 길드가 빼앗으면 안전 지대',()=>{
 const {store,f,p,id}=setup('daejeon'), a=restOf('daejeon'); assert.ok(map('daejeon').areas.some(x=>x.kind==='siege'),'대전은 거점');
 assert.equal(f.hubOwner('daejeon').kind,'boss','기본 주인 = 보스'); assert.equal(f.hubOwner('haeundae'),null,'거점 아님');
 store.mutate(id,'test',q=>{ q.gold=1000; }); standIn(f,p,a);
 assert.equal(f.safeAt(id),null); assert.throws(()=>BAG.bag(store,f,id,{op:'buy',item:'c_potion'}),/마을·쉼터/);
 f.setHub('daejeon',{kind:'guild',name:'황혼'}); assert.ok(f.safeAt(id)); assert.equal(BAG.bag(store,f,id,{op:'buy',item:'c_potion'}).profile.items.c_potion,1);
 f.setHub('daejeon',null); assert.equal(f.safeAt(id),null,'다시 보스에게');
 const join=f.command(id,{type:'fieldJoin',zone:'daejeon'},store.public(id)); assert.equal(join.hub.kind,'boss','들어갈 때 거점 주인을 알려 준다');
});
test('회복약: 어디서나 · 35% 회복 · 1초 재사용 · 가득 차면 약을 잃지 않는다',()=>{
 const {store,f,p,id}=setup('haeundae'), t=5e12; standOut(f,p); store.mutate(id,'test',q=>{ q.items.c_potion=3; });
 assert.throws(()=>BAG.bag(store,f,id,{op:'use',item:'c_potion'},t),/가득/); assert.equal(store.public(id).items.c_potion,3,'가득 찼을 때 약이 줄면 안 된다');
 p.hp=1; const r=BAG.bag(store,f,id,{op:'use',item:'c_potion'},t); assert.equal(r.result.heal,Math.round(p.maxHp*POTION_HEAL)); assert.equal(p.hp,1+r.result.heal); assert.equal(r.profile.items.c_potion,2);
 assert.throws(()=>BAG.bag(store,f,id,{op:'use',item:'c_potion'},t+500),/잠시 뒤/); assert.equal(store.public(id).items.c_potion,2);
 BAG.bag(store,f,id,{op:'use',item:'c_potion'},t+1100); assert.equal(store.public(id).items.c_potion,1);
 p.dead=true; assert.throws(()=>BAG.bag(store,f,id,{op:'use',item:'c_potion'},t+3000),/쓰러진/);
 assert.throws(()=>BAG.bag(store,f,id,{op:'use',item:'c_throw'},t+5000),/회복약만/);
});
test('장착·해제는 쉼터 밖에서도 · 판매·창고는 쉼터 안에서만',()=>{
 const {store,f,p,id}=setup('haeundae'), R=require('../server/rpg-rules.cjs'), arm=BAG.fieldShop(store,id).map(i=>R.byId[i.id]).find(d=>d&&d.type==='armor'&&R.requirement(d)<=1).id;
 store.mutate(id,'test',q=>{ q.items[arm]=1; q.items.m_ore=5; }); standOut(f,p);
 const eq=BAG.bag(store,f,id,{op:'equip',item:arm}); assert.ok(Object.values(eq.profile.equipment).includes(arm),'장착');
 const un=BAG.bag(store,f,id,{op:'unequip',item:arm}); assert.ok(!Object.values(un.profile.equipment).includes(arm),'해제');
 assert.throws(()=>BAG.bag(store,f,id,{op:'sell',item:'m_ore',quantity:2}),/마을·쉼터/);
 assert.throws(()=>BAG.bag(store,f,id,{op:'deposit',item:'m_ore',quantity:2}),/마을·쉼터/);
 standIn(f,p,restOf('haeundae')); const g0=store.public(id).gold;
 BAG.bag(store,f,id,{op:'sell',item:'m_ore',quantity:2}); assert.equal(store.public(id).items.m_ore,3); assert.ok(store.public(id).gold>g0,'판매 대금');
 BAG.bag(store,f,id,{op:'deposit',item:'m_ore',quantity:3}); assert.equal(store.public(id).items.m_ore||0,0); assert.equal(store.public(id).vault.m_ore,3);
 BAG.bag(store,f,id,{op:'withdraw',item:'m_ore',quantity:1}); assert.equal(store.public(id).items.m_ore,1);
});
test('필드에 없으면 · 모르는 요청이면 거절',()=>{
 const {store,f,id}=setup('haeundae'); assert.throws(()=>BAG.bag(store,f,id,{op:'dismantle',item:'m_ore'}),/지원하지 않는/);
 f.leave(id); assert.throws(()=>BAG.bag(store,f,id,{op:'equip',item:'x'}),/먼저 지역/);
});
test('필드 상점 = 인력사무소 상점 (회복약 120 G · 보스 장비 없음)',()=>{ const {store,id}=setup('haeundae'), list=BAG.fieldShop(store,id);
 assert.ok(list.some(i=>i.id==='c_potion'&&i.price===120)); assert.deepEqual(list,store.shop('ain')); });
