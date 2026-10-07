/* 필드 가방 (문서 198) — 필드에 있는 동안의 인벤토리 명령.
   인력사무소 명령(requireOffice)은 «필드에서 나온 뒤» 만 받으므로 필드에는 따로 둔다. 저장은 같은 프로필(store)이다.
   어디서나: 장착 · 해제 · 잠금 · 회복약
   안전 지대(마을·쉼터 — js/mmo/safe-zones.js)에서만: 구매 · 판매 · 창고 넣기/꺼내기 */
const SAFE_OPS=['buy','sell','deposit','withdraw'];
const OPS=['equip','unequip','lock','use',...SAFE_OPS];
/* 필드 상점 — 인력사무소 상점과 같은 목록(store.shop: 소모품·재료·이 캐릭터가 쓰는 보스 외 장비). 값도 규칙(«장비는 종류별 하나») 도 같다 */
const fieldShop=(store,id)=>store.shop(store.get(id).character);
const count=n=>{ n=n??1; if(!Number.isSafeInteger(n)||n<1||n>99) throw Error('수량은 1–99 사이의 정수입니다.'); return n; };
/* 반환: { profile, result } — profile 은 store.public 모양 (profileUpdate 로 보낸다) */
function bag(store, field, id, msg, now=Date.now()){
 const op=msg.op, item=msg.item;
 if(!OPS.includes(op)) throw Error('지원하지 않는 가방 요청입니다.');
 if(typeof item!=='string'||item.length>40) throw Error('물품을 고르세요.');
 if(!field.players.has(id)) throw Error('먼저 지역에 들어가세요.');
 if(SAFE_OPS.includes(op)&&!field.safeAt(id)) throw Error('마을·쉼터 안에서만 할 수 있습니다.');
 if(op==='equip') return { profile:store.equip(id,item), result:{item} };
 if(op==='unequip'||op==='lock'||op==='deposit'||op==='withdraw') return store.inventoryAction(id,op,item,op==='deposit'||op==='withdraw'?count(msg.quantity):1);
 if(op==='sell') return store.inventoryAction(id,'vendorSell',item,count(msg.quantity));
 if(op==='use'){ if(item!=='c_potion') throw Error('필드에서는 회복약만 쓸 수 있습니다.');
  field.canPotion(id,now);   /* 쓰러짐·재사용 대기·가득 참을 먼저 — 약만 잃는 일이 없게 */
  const r=store.mutate(id,'fieldPotion',p=>{ if(!(p.items.c_potion>0)) throw Error('회복약이 없습니다.'); p.items.c_potion--; return {item}; });
  return { profile:r.profile, result:{ item, ...field.potion(id,now) } }; }
 const n=count(msg.quantity); return { profile:store.purchase(id,item,n), result:{item,quantity:n} }; }   /* buy */
module.exports={ bag, fieldShop, OPS, SAFE_OPS };
