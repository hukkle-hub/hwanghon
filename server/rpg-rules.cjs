const C = require('./content.cjs');
const traits = {
 balanced: {name:'균형', description:'기본 능력으로 출격합니다.'},
 counter: {name:'반격 집중', description:'카운터 피해 +10%', counter:1.1},
 breaker: {name:'파괴 집중', description:'부위 내구도 피해 +25%', part:1.25},
 survivor: {name:'생존 집중', description:'최대 체력 +8%', hp:1.08}
};
const quests = [
 {id:'training',name:'첫 계약 · 허수아비 검증',level:'d01',arena:'tutorial',previous:null,gold:1000,xp:600,items:[['c_potion',3],['m_alloy',4]],brief:'일반 공격과 반격의 차이를 익히고 허수아비 3단계를 돌파하라.',after:'반격과 파괴를 익혔다. 갈대습지 정찰 의뢰를 수행할 자격을 얻었다.'},
 {id:'marsh',name:'갈대습지 토벌',level:'d02',arena:'marsh',previous:'training',gold:2500,xp:1200,items:[['m_heart',1],['m_shard',4]],brief:'모르버스를 토벌하라. 정찰 기록과 회수 지점을 살펴보면 추가 전리품을 얻는다.',after:'습지 오염의 흔적이 정화장으로 이어진다. 밸브 세 곳을 조사하라.'},
 {id:'pump',name:'정화장 · 오염원 차단',level:'d03',arena:'sewage',previous:'marsh',gold:4000,xp:1800,items:[['m_core',3],['m_booster',2]],brief:'세 밸브를 잠그고 정화장 보스를 격파하라.',after:'이번 구역의 계약을 완수했다. 반복 토벌로 재료를 모으고 새로운 장비를 준비하라.'}
];
// Online progression starts at level 1; the original sheet's level-26 economy is retained separately.
/* 캐릭터별 출격 캐릭터와 시작 무기 (js/gear.js DEFAULTS 와 같은 구성) */
const characters = ['ain','kain','ryu','sera'];
const startingWeapon = {ain:'w_marsh_scythe',kain:'w_kain_greatsword',ryu:'w_ryu_dagger',sera:'w_sera_flask'};
/* 무기 사용 가능 캐릭터: 아이템의 cls, 없으면 종류로 (js/items.js CLS_BY_KIND 와 동일) */
const CLS_BY_KIND = {'낫(대형)':['ain'],'낫(소형)':['ain'],'검':['kain','ain'],'근접 무기(검)':['kain','ain'],'장창':['kain','ain'],'대검':['kain'],'단검':['ryu','ain'],'쌍단검':['ryu'],'시약':['sera']};
const weaponClasses = item => item.cls || CLS_BY_KIND[item.kind] || characters;
const requirement = item => Object.values(startingWeapon).includes(item.id)?1:Math.max(1,1+Math.floor(((item.reqLv||1)-10)/5));
/* 온라인이 다루는 물품: 방어구·장신구는 공용, 무기는 네 캐릭터 중 누군가 쓸 수 있으면 포함 */
const supported = (item,character) => item.type!=='weapon'
  ? true
  : item.slot==='main' && (character?weaponClasses(item).includes(character):true);
const items = [...C.equipment.filter(i=>supported(i)),...C.materials,...C.consumables];
const byId = Object.fromEntries(items.map(i=>[i.id,i]));
const recipes = C.recipes.filter(r=>byId[r.result]&&r.result!=='c_tool').map(r=>({...r,level:Math.max(1,Math.ceil(r.craftLv/6)),seconds:0}));
recipes.push({id:'r_rust_scythe',result:'w_rust_executioner',level:2,cost:4000,yield:1,mats:[['m_alloy',8],['m_bone',12]],seconds:0});
const salvage={common:[['m_ore',2],['m_fiber',3]],rare:[['m_alloy',3],['m_ore',4]],hero:[['m_alloy',6],['m_shard',2]],legend:[['m_alloy',10],['m_shard',5],['m_core',1]],myth:[['m_alloy',16],['m_shard',8],['m_core',3],['m_heart',1]]};
module.exports={traits,quests,requirement,supported,items,byId,recipes,salvage,characters,startingWeapon,weaponClasses};
