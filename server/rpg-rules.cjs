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
const requirement = item => item.id==='w_marsh_scythe'?1:Math.max(1,1+Math.floor(((item.reqLv||1)-10)/5));
const supported = item => item.type!=='weapon'||item.slot==='main'&&item.icon==='scythe';
const items = [...C.equipment.filter(supported),...C.materials,...C.consumables];
const byId = Object.fromEntries(items.map(i=>[i.id,i]));
const recipes = C.recipes.filter(r=>byId[r.result]&&r.result!=='c_tool').map(r=>({...r,level:Math.max(1,Math.ceil(r.craftLv/6)),seconds:0}));
recipes.push({id:'r_rust_scythe',result:'w_rust_executioner',level:2,cost:4000,yield:1,mats:[['m_alloy',8],['m_bone',12]],seconds:0});
const salvage={common:[['m_ore',2],['m_fiber',3]],rare:[['m_alloy',3],['m_ore',4]],hero:[['m_alloy',6],['m_shard',2]],legend:[['m_alloy',10],['m_shard',5],['m_core',1]],myth:[['m_alloy',16],['m_shard',8],['m_core',3],['m_heart',1]]};
module.exports={traits,quests,requirement,supported,items,byId,recipes,salvage};
