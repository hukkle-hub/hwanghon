/* 외형 화면(looks.html)의 저장 — 염색과 외형 프리셋 (docs/design/34).
   가장 중요한 약속: «외형만 바뀐다». 염색·프리셋이 능력치를 건드리면 안 된다. */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');

function load(){
  const store={};
  global.localStorage={getItem:k=>k in store?store[k]:null,
    setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
  global.window=global;
  for(const k of ['TW_ITEMS','TW_SAVE','TW_GEAR'])delete global[k];
  for(const f of ['js/items.js','js/save.js','js/gear.js']){
    delete require.cache[require.resolve(path.join(ROOT,f))];
    require(path.join(ROOT,f));
  }
  return {G:global.TW_GEAR,T:global.TW_ITEMS,S:global.TW_SAVE,store};
}

test('아인 무기 스킨 저장·프리셋은 스탯·소유권·지갑을 바꾸지 않는다',()=>{
 const {G,S}=load();const before={cp:G.cp(),gold:G.wallet(),owned:JSON.stringify(G.state().owned),eq:JSON.stringify(G.state().equipped)};
 G.setWeaponSkin('red_tension');assert.equal(G.weaponSkin('ain'),'red_tension');G.saveLook(2,'적선');G.setWeaponSkin('original');G.wearLook(2);
 assert.equal(G.weaponSkin('ain'),'red_tension');assert.equal(G.cp(),before.cp);assert.equal(G.wallet(),before.gold);assert.equal(JSON.stringify(G.state().owned),before.owned);assert.equal(JSON.stringify(G.state().equipped),before.eq);
 S.reload();assert.equal(G.weaponSkin('ain'),'red_tension');assert.equal(G.weaponSkin('kain'),'original');G.setChar('kain');assert.throws(()=>G.setWeaponSkin('red_tension'));G.setChar('ain');assert.throws(()=>G.setWeaponSkin('invalid'));
});

test('염색은 외형만 바꾼다 — 능력치·전투력은 한 자리도 움직이지 않는다',()=>{
 const {G}=load();
 const id=G.state().equipped.chest;
 assert.ok(id,'상의를 입고 있다');
 const before={item:JSON.stringify(G.itemStats(id)),cp:G.cp(),mult:G.mult(id)};
 G.setDye(id,'#2F6B5E');
 assert.equal(G.dyeOf(id),'#2f6b5e','소문자로 저장된다');
 assert.equal(JSON.stringify(G.itemStats(id)),before.item,'장비 능력치 그대로');
 assert.equal(G.cp(),before.cp,'전투력 그대로');
 assert.equal(G.mult(id),before.mult,'강화 배율 그대로');
 G.clearDye(id);
 assert.equal(G.dyeOf(id),null,'되돌리면 사라진다');
});

test('염색은 «외형에 실제로 먹일 색» 으로 제작품 색조를 이긴다',()=>{
 const {G}=load();
 const id=G.state().equipped.chest;
 assert.equal(G.tintOf(id),null,'염색도 제작품도 아니면 색이 없다');
 G.setDye(id,'#B8442C');
 assert.equal(G.tintOf(id),'#b8442c','염색이 우선');
});

test('엉터리 색은 거절한다 — 셰이더까지 흘러가면 조용히 검게 칠해진다',()=>{
 const {G}=load();
 const id=G.state().equipped.chest;
 for(const bad of ['red','#fff','2F6B5E','#2F6B5','#2F6B5EE','',null])
   assert.throws(()=>G.setDye(id,bad),/색을 확인하세요/,String(bad)+' 는 거절');
 assert.equal(G.dyeOf(id),null,'하나도 저장되지 않았다');
});

test('외형 프리셋: 저장 → 다 벗고 → 되입기',()=>{
 const {G}=load();
 const chest=G.state().equipped.chest, legs=G.state().equipped.legs;
 G.setDye(chest,'#4E6B3C');
 const saved=G.saveLook(0,'정찰 복장');
 assert.equal(saved.name,'정찰 복장');
 assert.equal(G.looks()[0].equipped.chest,chest);

 G.unequip('chest'); G.unequip('legs'); G.clearDye(chest);
 assert.equal(G.state().equipped.chest,null);

 const r=G.wearLook(0);
 assert.equal(G.state().equipped.chest,chest,'상의가 돌아왔다');
 assert.equal(G.state().equipped.legs,legs,'하의도 돌아왔다');
 assert.equal(G.dyeOf(chest),'#4e6b3c','염색까지 같이 돌아왔다');
 assert.equal(r.missing.length,0);
 /* 벗어 둔 것이 가방에 중복으로 쌓이면 안 된다 */
 assert.equal(G.state().owned.filter(x=>x===chest).length,0,'입은 것은 가방에 없다');
});

test('없는 장비는 건너뛴다 — 분해한 뒤 프리셋을 입어도 터지지 않는다',()=>{
 const {G}=load();
 const chest=G.state().equipped.chest;
 G.saveLook(1,'옛 복장');
 G.unequip('chest'); G.removeGear(chest);        /* 분해한 셈 */
 const r=G.wearLook(1);
 assert.ok(r.missing.indexOf(chest)>=0,'없는 것을 알려 준다');
 assert.ok(!G.state().equipped.chest,'없는 것을 억지로 입히지 않는다');
 assert.ok(r.worn>0,'가진 것은 그대로 입는다');
});

test('빈 칸·잘못된 칸은 막는다',()=>{
 const {G}=load();
 assert.throws(()=>G.wearLook(2),/빈 칸/);
 assert.throws(()=>G.saveLook(5,'x'),/프리셋 칸/);
 assert.throws(()=>G.saveLook(-1,'x'),/프리셋 칸/);
 G.saveLook(2); assert.ok(G.looks()[2],'이름 없이 저장하면 기본 이름');
 G.clearLook(2); assert.equal(G.looks()[2],null);
});

test('다른 창이 고친 저장을 다시 읽는다 — iframe 이 옛 장비를 입히던 버그',()=>{
 const {G,S,store}=load();
 const chest=G.state().equipped.chest;
 /* 바깥에서 저장을 직접 갈아 끼운다 (외형 화면의 부모 창이 하는 일) */
 const raw=JSON.parse(store['tw:save']);
 raw.gear.dye={[chest]:'#c99a2b'};
 store['tw:save']=JSON.stringify(raw);
 assert.equal(G.dyeOf(chest),null,'다시 읽기 전에는 옛 기억 그대로다');
 S.reload();
 assert.equal(G.dyeOf(chest),'#c99a2b','reload 하면 바깥의 변경이 보인다');
});
