/* 황혼 — 등급 (레벨 대신). 디렉터 지시: 표기는 등급. 요원 등급 A → A+ → S → S+ → SS. 기술 등급 5종(카운터·부위 파괴·정제·드랍·제작) C → B → A → S → SS.
   · 요원 등급: 누적 경험치로. · 기술 등급: 전투 기록(save.stats)으로 계산. · 파티 효과: 파티원(플레이어 + 동행 NPC)의 기술 등급 중 최고 등급이 전투·보상·강화에 반영된다
   window.TW_GRADE = { AGENT, TECH, KEYS, agent(), tech(), party(), partyBuffs(), buffs(), lvGrade(lv), cls(g), label }*/
(function(){
  var SV=window.TW_SAVE, W=window.TW_WORLD;
  var AGENT=['A','A+','S','S+','SS'], AGENT_XP=[0,1500,5000,12000,25000];
  var TECH=['C','B','A','S','SS'];
  var KEYS=[ ['counter','카운터','예고가 끝나는 순간의 반격'], ['break','부위 파괴','약점·갑각을 부수는 기술'], ['refine','정제','재료·소모품을 다루는 손'], ['drop','드랍','전리품을 알아보는 눈'], ['craft','제작','대장간 일 — 강화·수리·제작'] ];
  var TH={ counter:[0,15,45,120,300], break:[0,20,60,150,350], refine:[0,12,40,110,260], drop:[0,15,50,140,320], craft:[0,10,35,100,240] };
  /* 파티 효과 표 (등급 지수 0..4) */
  var FX={ counter:{ win:[0,0.02,0.04,0.06,0.09], lb:'카운터 판정' }, break:{ part:[1,1.05,1.10,1.18,1.25], lb:'부위 피해' }, refine:{ mats:[0,0.10,0.20,0.35,0.50], lb:'재료 획득' }, drop:{ luck:[0,0.05,0.10,0.18,0.25], lb:'행운' }, craft:{ enh:[0,1,2,4,6], repair:[0,0.05,0.10,0.18,0.25], lb:'강화·수리' } };
  function totalXp(){ if(!SV) return 0; var s=SV.get(), t=s.xp; for(var l=1;l<s.lv;l++) t+=SV.need(l); return t; }
  function agent(){ var xp=totalXp(), i=0; while(i<AGENT.length-1 && xp>=AGENT_XP[i+1]) i++; var next=AGENT_XP[i+1]||null; return { g:AGENT[i], idx:i, xp:xp, next:next, pct:next?Math.round((xp-AGENT_XP[i])/(next-AGENT_XP[i])*100):100 }; }
  function scores(){ var st=(SV?SV.get().stats:{})||{}; var tel=st.telegraphs||0, cr=tel?(st.counters||0)/tel:0, brk=(st.breakable||0), br=brk?(st.breaks||0)/brk:0;
    return { counter:Math.round((st.counters||0)+(st.perfect||0)*2+cr*40), break:Math.round((st.breaks||0)*10+br*40), refine:Math.round((st.gathered||0)*2+(st.craftedCons||0)*5+(st.potions||0)*3), drop:Math.round((st.items||0)+(st.rare||0)*10), craft:Math.round((st.enhOk||0)*6+(st.crafted||0)*8+(st.repairs||0)*2) }; }
  function tech(){ var sc=scores(), out={}; KEYS.forEach(function(k){ var key=k[0], v=sc[key], th=TH[key], i=0; while(i<TECH.length-1 && v>=th[i+1]) i++; var next=th[i+1]; out[key]={ g:TECH[i], idx:i, score:v, next:next==null?null:next, pct:next==null?100:Math.round((v-th[i])/(next-th[i])*100), name:k[1], desc:k[2] }; }); return out; }
  function tIdx(g){ var i=TECH.indexOf(g); return i<0?0:i; }
  /* 파티: 플레이어(계산 등급) + 동행 NPC(시트 등급). 파티 화면 데이터(W.PARTY.members)의 grades 순서 = 카운터·부위파괴·정제·드랍·제작 */
  function party(){ var me=tech(), list=[{ id:'ain', nm:'아인', me:true, grades:{ counter:me.counter.g, break:me.break.g, refine:me.refine.g, drop:me.drop.g, craft:me.craft.g } }];
    if(W&&W.PARTY) W.PARTY.members.forEach(function(m){ if(m.char==='ain') return; var c=W.CHARS[m.char]; list.push({ id:m.char, nm:c?c.nm:m.name, grades:{ counter:m.grades[0], break:m.grades[1], refine:m.grades[2], drop:m.grades[3], craft:m.grades[4] } }); });
    return list; }
  function partyBuffs(list){ list=list||party(); var best={}; KEYS.forEach(function(k){ var key=k[0], bi=0, who=null; list.forEach(function(m){ var i=tIdx(m.grades[key]); if(i>bi||who===null){ if(i>=bi){ bi=i; who=m.nm; } } }); best[key]={ idx:bi, g:TECH[bi], who:who }; });
    return { best:best, counterWin:FX.counter.win[best.counter.idx], partDmg:FX.break.part[best.break.idx], mats:FX.refine.mats[best.refine.idx], luck:FX.drop.luck[best.drop.idx], enhRate:FX.craft.enh[best.craft.idx], repair:FX.craft.repair[best.craft.idx] }; }
  function buffs(){ return partyBuffs(); }
  function describe(b){ b=b||buffs(); return [ ['카운터 '+b.best.counter.g, '판정 +'+b.counterWin.toFixed(2)+'초', b.best.counter.who], ['부위 파괴 '+b.best.break.g, '부위 피해 ×'+b.partDmg.toFixed(2), b.best.break.who], ['정제 '+b.best.refine.g, '재료 +'+Math.round(b.mats*100)+'%', b.best.refine.who], ['드랍 '+b.best.drop.g, '행운 +'+b.luck.toFixed(2), b.best.drop.who], ['제작 '+b.best.craft.g, '강화 +'+b.enhRate+'%p · 수리비 −'+Math.round(b.repair*100)+'%', b.best.craft.who] ]; }
  function lvGrade(lv){ return lv>=34?'S+':lv>=30?'S':lv>=26?'A+':'A'; }   /* 시트의 NPC 레벨 → 요원 등급 표기 */
  function cls(g){ return 'g-'+String(g).toLowerCase().replace('+','p'); }
  function label(){ var a=agent(); return '요원 등급 '+a.g; }
  window.TW_GRADE={ AGENT:AGENT, TECH:TECH, KEYS:KEYS, FX:FX, agent:agent, tech:tech, scores:scores, party:party, partyBuffs:partyBuffs, buffs:buffs, describe:describe, lvGrade:lvGrade, cls:cls, label:label, totalXp:totalXp };
})();
