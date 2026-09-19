/* 황혼 — 스킬 성장 계산 (순수 함수). 브라우저(js/skills.js)와 서버(server/rpg-skills.cjs)가 같은 식을 쓴다.
   저장·포인트 경제는 각자 관리하고, 여기서는 «정의 + 레벨 + 분기 → 실제 수치» 만 계산한다.
   · 레벨 효과: 배율 +12%/lv, 쿨타임 −6%/lv, 스태미나 −4%/lv, 버프 감소율 +5%p/lv·지속 +0.4초/lv. 궁극기 배율 +10%/lv
   · 분기(3레벨부터): A 강화(배율 +25% 등) / B 효과(종류별) */
(function(root, factory){
  var api=factory();
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  if(root) root.TW_SKILLMATH=api;
})(typeof window!=='undefined'?window:null, function(){
  var MAX=5, BR_LV=3;
  var LV={ mult:0.12, cd:0.06, st:0.04, reduce:0.05, dur:0.4, ultMult:0.10 };
  /* 분기 B 효과: 스킬 종류별 */
  var BR_B={ dmg:{ bleed:1, label:'출혈 1중첩' }, dodge:{ cd:-0.25, label:'쿨타임 −25%' }, aoe:{ posture:20, label:'자세 피해 +20' }, buff:{ dur:1.0, label:'지속 +1초' }, ult:{ posture:35, label:'자세 피해 +35' } };
  function kindOf(k){ if(k.key==='R') return 'ult'; if(k.dodge) return 'dodge'; if(k.buff) return 'buff'; if(k.aoe) return 'aoe'; return 'dmg'; }
  function branches(k){ var kind=kindOf(k); return { A:{ id:'A', name:'강화', label:kind==='buff'?'감소율 +15%p':kind==='dodge'?'무적 시간 +50%':'배율 +25%' }, B:{ id:'B', name:'효과', label:BR_B[kind].label } }; }
  /* 레벨·분기를 반영한 스킬 사본 */
  function scaled(k, lv, br){
    lv=Math.max(1, Math.min(MAX, lv||1)); if(lv<BR_LV) br=null; if(br!=='A'&&br!=='B') br=null;
    var o=Object.assign({}, k), n=lv-1, kind=kindOf(k);
    if(kind==='ult'){ o.mult=+(k.mult*(1+LV.ultMult*n)).toFixed(2); }
    else { if(k.mult>0) o.mult=+(k.mult*(1+LV.mult*n)).toFixed(2); if(k.cd) o.cd=+(k.cd*(1-LV.cd*n)).toFixed(1); if(k.st) o.st=Math.round(k.st*(1-LV.st*n)); if(k.buff) o.buff={ dur:+(k.buff.dur+LV.dur*n).toFixed(1), reduce:Math.min(0.9,+(k.buff.reduce+LV.reduce*n).toFixed(2)) }; }
    if(br==='A'){ if(kind==='buff') o.buff={ dur:o.buff.dur, reduce:Math.min(0.9,+(o.buff.reduce+0.15).toFixed(2)) }; else if(kind==='dodge') o.iframes=1.5; else o.mult=+(o.mult*1.25).toFixed(2); }
    else if(br==='B'){ var e=BR_B[kind]; if(e.bleed) o.bleed=(o.bleed||0)+e.bleed; if(e.cd) o.cd=+(o.cd*(1+e.cd)).toFixed(1); if(e.posture) o.posture=(o.posture||0)+e.posture; if(e.dur) o.buff={ dur:+(o.buff.dur+e.dur).toFixed(1), reduce:o.buff.reduce }; }
    o.lv=lv; o.br=br||null; return o;
  }
  /* 한 줄 설명 (화면 공용) */
  function describe(o){
    var kind=kindOf(o), parts=[];
    if(o.mult>0) parts.push('배율 ×'+o.mult);
    if(kind!=='ult'){ if(o.cd) parts.push('쿨 '+o.cd+'초'); if(o.st) parts.push('스태미나 '+o.st); }
    if(o.buff) parts.push('피해 −'+Math.round(o.buff.reduce*100)+'% · '+o.buff.dur+'초');
    if(o.iframes) parts.push('무적 ×1.5'); if(o.bleed) parts.push('출혈 +'+o.bleed); if(o.posture) parts.push('자세 +'+o.posture);
    return parts.join(' · ');
  }
  /* 스킬 표 전체에 적용. levels = { [스킬id]: {lv, br} } */
  function applyAll(skills, ult, levels){
    levels=levels||{};
    var at=function(k){ var s=levels[k.id]||{}; return scaled(k, s.lv||1, s.br||null); };
    return { skills:(skills||[]).map(at), ult:ult?at(ult):null };
  }
  return { MAX:MAX, BR_LV:BR_LV, LV:LV, BR_B:BR_B, kindOf:kindOf, branches:branches, scaled:scaled, describe:describe, applyAll:applyAll };
});
