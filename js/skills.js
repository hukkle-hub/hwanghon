/* 황혼 — 스킬 성장 (save.js + dungeons.js SKILLS 위에서)
   · 저장 skills = { [캐릭터]: { [스킬id]: { lv:1~5, br:'A'|'B'|null } } }
   · 스킬 포인트 = 4 + 요원 등급 단계×3 + 보스 격파(runs)×1 (최대 30). 쓴 포인트 = Σ(lv−1) + 분기 선택 1
   · 레벨 효과: 배율 +12%/lv, 쿨타임 −6%/lv, 스태미나 −4%/lv, 버프 감소율 +5%p/lv·지속 +0.4초/lv. 궁극기 배율 +10%/lv
   · 분기(3레벨부터 선택): A 강화(배율 +25%) / B 효과(스킬별: 출혈·자세 피해·확정 치명·쿨타임 −25%)
   window.TW_SKILLS = { MAX, points(cid), lvOf(cid,id), get(cid,id), up(cid,id), setBranch(cid,id,br), reset(cid), apply(cid, skills, ult) → {skills, ult}, describe(cid, k), branches(k), preview(cid,k,lv) } */
(function(){
  var SV=window.TW_SAVE, DG=window.TW_DUNGEONS; if(!SV) return;
  var MAX=5, BASE_PTS=4, PER_GRADE=3, PER_RUN=1, PTS_CAP=30, BR_LV=3;
  var LV={ mult:0.12, cd:0.06, st:0.04, reduce:0.05, dur:0.4, ultMult:0.10 };
  /* 분기 B 효과: 스킬 종류별 */
  var BR_B={ dmg:{ bleed:1, label:'출혈 1중첩' }, dodge:{ cd:-0.25, label:'쿨타임 −25%' }, aoe:{ posture:20, label:'자세 피해 +20' }, buff:{ dur:1.0, label:'지속 +1초' }, ult:{ posture:35, label:'자세 피해 +35' } };
  function kindOf(k){ if(k.key==='R') return 'ult'; if(k.dodge) return 'dodge'; if(k.buff) return 'buff'; if(k.aoe) return 'aoe'; return 'dmg'; }
  function branches(k){ var kind=kindOf(k); return { A:{ id:'A', name:'강화', label:kind==='buff'?'감소율 +15%p':kind==='dodge'?'무적 시간 +50%':'배율 +25%' }, B:{ id:'B', name:'효과', label:BR_B[kind].label } }; }
  function store(){ var s=SV.get(); if(!s.skills) s.skills={}; return s.skills; }
  function ofChar(cid){ var st=store(); if(!st[cid]) st[cid]={}; return st[cid]; }
  function get(cid,id){ var c=ofChar(cid); if(!c[id]) c[id]={ lv:1, br:null }; return c[id]; }
  function lvOf(cid,id){ return get(cid,id).lv; }
  function spent(cid){ var c=ofChar(cid), n=0; Object.keys(c).forEach(function(id){ n+=Math.max(0,(c[id].lv||1)-1)+(c[id].br?1:0); }); return n; }
  function total(){ var g=window.TW_GRADE?TW_GRADE.agent().idx:0, runs=(SV.get().stats||{}).runs||0; return Math.min(PTS_CAP, BASE_PTS+g*PER_GRADE+runs*PER_RUN); }
  function points(cid){ var t=total(), s=spent(cid); return { total:t, spent:s, free:Math.max(0,t-s) }; }
  function up(cid,id){ var k=get(cid,id); if(k.lv>=MAX) return { err:'max' }; if(points(cid).free<1) return { err:'pts' }; k.lv++; SV.save(); return { ok:true, lv:k.lv }; }
  function setBranch(cid,id,br){ var k=get(cid,id); if(k.lv<BR_LV) return { err:'lv' }; if(k.br===br) return { ok:true }; if(!k.br && points(cid).free<1) return { err:'pts' }; k.br=br; SV.save(); return { ok:true }; }
  function reset(cid){ var st=store(); st[cid]={}; SV.save(); }
  /* 레벨·분기를 반영한 스킬 사본 */
  function scaled(k, lv, br){ var o=Object.assign({}, k), n=lv-1, kind=kindOf(k), B=branches(k);
    if(kind==='ult'){ o.mult=+(k.mult*(1+LV.ultMult*n)).toFixed(2); }
    else { if(k.mult>0) o.mult=+(k.mult*(1+LV.mult*n)).toFixed(2); if(k.cd) o.cd=+(k.cd*(1-LV.cd*n)).toFixed(1); if(k.st) o.st=Math.round(k.st*(1-LV.st*n)); if(k.buff) o.buff={ dur:+(k.buff.dur+LV.dur*n).toFixed(1), reduce:Math.min(0.9,+(k.buff.reduce+LV.reduce*n).toFixed(2)) }; }
    if(br==='A'){ if(kind==='buff') o.buff={ dur:o.buff.dur, reduce:Math.min(0.9,+(o.buff.reduce+0.15).toFixed(2)) }; else if(kind==='dodge') o.iframes=1.5; else o.mult=+(o.mult*1.25).toFixed(2); }
    else if(br==='B'){ var e=BR_B[kind]; if(e.bleed) o.bleed=(o.bleed||0)+e.bleed; if(e.cd) o.cd=+(o.cd*(1+e.cd)).toFixed(1); if(e.posture) o.posture=(o.posture||0)+e.posture; if(e.dur) o.buff={ dur:+(o.buff.dur+e.dur).toFixed(1), reduce:o.buff.reduce }; }
    o.lv=lv; o.br=br||null; return o; }
  function apply(cid, skills, ult){ return { skills:(skills||[]).map(function(k){ var s=get(cid,k.id); return scaled(k, s.lv, s.br); }), ult:ult?(function(){ var s=get(cid,ult.id); return scaled(ult, s.lv, s.br); })():null }; }
  function preview(cid,k,lv){ var s=get(cid,k.id); return scaled(k, lv||s.lv, s.br); }
  function describe(cid,k){ var o=preview(cid,k), kind=kindOf(k), parts=[];
    if(o.mult>0) parts.push('배율 ×'+o.mult); if(kind!=='ult'){ if(o.cd) parts.push('쿨 '+o.cd+'초'); if(o.st) parts.push('스태미나 '+o.st); }
    if(o.buff) parts.push('피해 −'+Math.round(o.buff.reduce*100)+'% · '+o.buff.dur+'초'); if(o.iframes) parts.push('무적 ×1.5'); if(o.bleed) parts.push('출혈 +'+o.bleed); if(o.posture) parts.push('자세 +'+o.posture);
    return parts.join(' · '); }
  window.TW_SKILLS={ MAX:MAX, BR_LV:BR_LV, points:points, lvOf:lvOf, get:get, up:up, setBranch:setBranch, reset:reset, apply:apply, describe:describe, branches:branches, preview:preview, kindOf:kindOf };
})();
