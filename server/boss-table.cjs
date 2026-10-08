/* 필드 보스 표 — 출현 주기·체력·드롭을 «한 곳에서» (docs/design/188 §6: L1J BossCycle.xml 처럼 운영 중에 바꿀 수 있게)
   자리(x, z)·이름·모델은 맵 굽기 결과(maps/2d/<zone>/map.json bosses[])에서 온다. 여기는 숫자만.
   드롭 묶음: { pick:[아이템 id…], rate } — rate 확률로 묶음 안에서 하나를 고른다. 장비는 바닥에 떨어진다(기여도 1위 10초 먼저).
   재료는 기여도 5% 이상 전원에게 바로 들어간다. */
const C=require('./content.cjs');
const gear=(boss,rarity,types)=>C.equipment.filter(i=>i.boss===boss&&i.rarity===rarity&&(!types||types.includes(i.type))).map(i=>i.id);
/* 기본 묶음: 세트 방어구 한 조각 12% · 전설 무기 1.5% · 신화 0.2% (188 §6) */
function drops(boss, mult=1, extra=[]){
 const list=[], armor=gear(boss,'hero',['armor','acc']), weapon=gear(boss,'legend'), myth=gear(boss,'myth');
 if(armor.length) list.push({ pick:armor, rate:0.12*mult });
 if(weapon.length) list.push({ pick:weapon, rate:0.015*mult });
 if(myth.length) list.push({ pick:myth, rate:0.002*mult });
 return list.concat(extra);
}
const MATERIAL={ item:'m_heart', share:0.05 };
const BOSSES={
 /*        체력      주기 창 (period · start~end · chance)                           */
 dropper:    { hp:  420000, cycle:{ period:'30m', start:'5m',  end:'20m' }, tier:'elite',  drops:drops('dropper') },
 clave:      { hp: 1200000, cycle:{ period:'2h',  start:'30m', end:'1h30m' },               drops:drops('clave') },
 clave2:     { hp: 1600000, cycle:{ period:'3h',  start:'1h',  end:'2h', chance:0.9 },      drops:drops('clave',1.5) },
 celestial:  { hp: 1500000, cycle:{ period:'3h',  start:'1h',  end:'2h30m' },               drops:drops('celestial') },
 aegis:      { hp: 1800000, cycle:{ period:'3h',  start:'30m', end:'2h' },                  drops:drops('aegis') },
 leviathan:  { hp: 2000000, cycle:{ period:'4h',  start:'1h',  end:'3h' },                  drops:drops('leviathan') },
 subject09:  { hp: 1600000, cycle:{ period:'4h',  start:'1h',  end:'3h' },                  drops:drops('subject09') },
 shadowfang: { hp: 1400000, cycle:{ period:'3h',  start:'1h',  end:'2h30m' },               drops:drops('shadowfang') },
 celestial2: { hp: 2200000, cycle:{ period:'6h',  start:'2h',  end:'5h', chance:0.8 },      drops:drops('celestial',1.5,drops('celestial2')) },
 arsenal:    { hp: 3000000, cycle:{ period:'6h',  start:'2h',  end:'5h' },                  drops:drops('arsenal') },
 park:       { hp: 1200000, cycle:{ period:'4h',  start:'1h',  end:'3h' },                  drops:drops('park') },
 jeong:      { hp: 2500000, cycle:{ period:'8h',  start:'3h',  end:'7h' },                  drops:drops('jeong') },
 nova:       { hp: 6000000, cycle:{ period:'24h', start:'18h', end:'23h', chance:0.7 }, tier:'myth', drops:drops('nova',5) },   /* 최종 신화 1% — 하루 한 번 안팎이라 */
};
/* 필드 몬스터(2급 지배형, 문서 204) — 같은 통로로 출현·피해·처치. 장비 드롭은 아직 없고 재료(심장 결정)만 기여도대로 */
for(const [id,m] of Object.entries(require('./field-monsters.cjs').FIELD_MONSTERS)) BOSSES[id]={ hp:m.hp, cycle:m.cycle, tier:m.kind, drops:[] };
const DEFAULT={ hp:1000000, cycle:{ period:'3h', start:'1h', end:'2h' }, drops:[] };
module.exports={ BOSSES, DEFAULT, MATERIAL, drops };
