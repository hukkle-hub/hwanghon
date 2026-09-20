/* 봉인(시트 06-forge 의 «봉인» 칸)은 «실수로 잃지 않게 잠그는 것» 이다.
   봉인된 장비는 강화 실패로 떨어지거나 파괴되지 않고, 분해로 사라지지도 않는다. */
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
  return {G:global.TW_GEAR,T:global.TW_ITEMS};
}

test('봉인한 장비는 강화·분해로 잃을 수 없고, 풀면 되돌아온다',()=>{
 const {G,T}=load();
 /* 장착하지 않은 장비를 고른다 — 분해가 «장착» 때문에 막히면 봉인을 검증할 수 없다 */
 const id=G.allGear().find(x=>!G.isEquipped(x));
 assert.ok(id,'장착하지 않은 장비가 있어야 한다');
 assert.equal(G.sealedOf(id),false);

 assert.equal(G.seal(id,true),true);
 assert.equal(G.enhance(id,false).err,'sealed');
 assert.equal(G.dismantle(id).err,'sealed');
 assert.ok(G.allGear().includes(id),'봉인 중에는 분해로 사라지지 않는다');

 assert.equal(G.seal(id,false),false);
 assert.notEqual(G.dismantle(id).err,'sealed','봉인을 풀면 다시 분해된다');
 assert.ok(!G.allGear().includes(id),'풀고 분해하면 실제로 사라진다');
});

test('봉인은 저장에 남는다',()=>{
 const {G}=load();
 const id=G.allGear().find(x=>!G.isEquipped(x));
 G.seal(id,true);
 /* 저장을 다시 읽어도 봉인이 살아 있어야 한다 */
 const raw=JSON.parse(global.localStorage.getItem('tw:save'));
 assert.equal(raw.gear.sealed[id],1);
});
