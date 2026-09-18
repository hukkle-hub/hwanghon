/* 황혼 — 장비·성장 (items.js + save.js 위에서)
   · 저장(tw:save).gear = { equipped:{슬롯:id}, owned:[id…], enh:{id:단계}, dur:{id:내구도} } — 첫 실행 시 시트 기본 상태로 초기화
   · 가방(재료·소모품) 수량은 items.js 의 qty 에 저장분을 한 번만 합쳐 둔다(T._bagMerged). 소비는 spend() 로 items·save 를 함께 갱신
   · 스탯: 캐릭터 시트 수치 = 기본 + 시트 기본 장비(시트 강화 단계). 그래서 기본 = 시트 − 기본 장비 기여. 강화 +1 = 장비 수치 +4%
   · 전투 입력: TW_GEAR.stats(char) → { hp, atk, def, crit, critDmg, aspd, mspd, skill, bleed } */
(function(){
  var T=window.TW_ITEMS, SV=window.TW_SAVE; if(!T||!SV) return;
  var STEP=0.04, GROW=0.015;
  T.EQUIP.forEach(function(e){ if(e.sheetEnh==null) e.sheetEnh=e.enh||0; });   /* 시트 강화 단계(수치 기준점) 보존 */
  if(!T._bagMerged){ T._bagMerged=true; try{ var sv=SV.get(); Object.keys(sv.bag||{}).forEach(function(id){ var it=T.get(id); if(it&&it.qty!=null) it.qty+=sv.bag[id]; }); }catch(e){} }
  function state(){ var s=SV.get(); if(!s.gear){ var P=T.PLAYER; s.gear={ equipped:Object.assign({},P.equipped), owned:P.bag.map(function(b){ return b.item; }), enh:{}, dur:{} };
      T.EQUIP.forEach(function(e){ s.gear.enh[e.id]=sheetEnh(e); s.gear.dur[e.id]=e.dur?e.dur[0]:100; }); SV.save(); }
    return s.gear; }
  function save(){ SV.save(); try{ document.dispatchEvent(new CustomEvent('tw:gear')); }catch(e){} }
  function enhOf(id){ var g=state(); return g.enh[id]!=null ? g.enh[id] : ((T.get(id)||{}).enh||0); }
  function durOf(id){ var g=state(); var it=T.get(id); return g.dur[id]!=null ? g.dur[id] : (it&&it.dur?it.dur[0]:100); }
  /* 장비 수치: 시트에 적힌 stats 는 시트 강화 단계(item.enh)에서의 값 → 단계 차이만큼 4%/단계 */
  function sheetEnh(it){ return it.sheetEnh!=null ? it.sheetEnh : (it.enh||0); }
  function mult(id, enh){ var it=T.get(id); if(!it) return 1; var e=enh==null?enhOf(id):enh; return (1+STEP*e)/(1+STEP*sheetEnh(it)); }
  function itemStats(id, enh){ var it=T.get(id); if(!it||!it.stats) return {}; var m=mult(id,enh), o={}; Object.keys(it.stats).forEach(function(k){ o[k]=+(it.stats[k]*m).toFixed(k==='atk'||k==='atkEx'||k==='def'||k==='hp'||k==='bleed'?0:1); }); return o; }
  /* 슬롯 기여: 주무기 100%. 보조/서브 무기는 공격력을 더하지 않고 치명타·스킬·출혈만 30% (시트의 공격력 2,980 = 주무기 값) */
  var SECONDARY=0.30;
  function sum(equipped, enhFn){ var o={atk:0,def:0,hp:0,crit:0,critDmg:0,skill:0,bleed:0};
    Object.keys(equipped).forEach(function(slot){ var id=equipped[slot]; var it=id&&T.get(id); if(!it||!it.stats) return; var m=mult(id, enhFn?enhFn(id):undefined); var sec=(slot==='sub'||slot==='off');
      Object.keys(it.stats).forEach(function(k){ var v=it.stats[k]*m; if(sec){ if(k==='atk'||k==='atkEx'||k==='def'||k==='hp') return; v*=SECONDARY; } if(k==='atkEx') o.atk+=v; else o[k]=(o[k]||0)+v; }); });
    return o; }
  function base(ch){ var g=sum(T.PLAYER.equipped, function(id){ return sheetEnh(T.get(id)||{}); }), s=ch.stats;
    return { hp:Math.max(s.hp-g.hp, s.hp*0.5), atk:Math.max(s.atk-g.atk, 0), def:Math.max(s.def-g.def, 0), crit:Math.max(s.crit-g.crit, 1), critDmg:Math.max(s.critDmg-g.critDmg, 100), aspd:s.aspd, mspd:s.mspd }; }
  function stats(ch){ var b=base(ch), g=sum(state().equipped), grow=1+GROW*((SV.get().lv||1)-1);
    return { hp:Math.round((b.hp+g.hp)*grow), atk:Math.max(50, Math.round((b.atk+g.atk)*grow)), def:Math.round((b.def+g.def)*grow), crit:+(b.crit+g.crit).toFixed(1), critDmg:+(b.critDmg+g.critDmg).toFixed(1), aspd:b.aspd, mspd:b.mspd, skill:+(g.skill||0).toFixed(1), bleed:Math.round(g.bleed||0) }; }
  function cp(){ var g=state(), c=0; Object.keys(g.equipped).forEach(function(k){ var it=T.get(g.equipped[k]); if(it&&it.cp) c+=Math.round(it.cp*mult(it.id)); }); return c; }
  function itemCp(id, enh){ var it=T.get(id); return it&&it.cp ? Math.round(it.cp*mult(id,enh)) : 0; }
  /* 소비/획득: items 수량과 저장 가방을 함께 */
  function addItem(id,n){ var it=T.get(id); if(it&&it.qty!=null) it.qty=Math.max(0,(it.qty||0)+n); SV.addItem(id,n); }
  function wallet(){ return SV.wallet(); }
  function canPay(mats, gold){ return (mats||[]).every(function(m){ var it=T.get(m[0]); return it&&(it.qty||0)>=m[1]; }) && wallet()>=(gold||0); }
  function spend(mats, gold){ (mats||[]).forEach(function(m){ addItem(m[0], -m[1]); }); if(gold) SV.addGold(-gold); }
  /* 장착 */
  function equip(slot,id){ var g=state(); var prev=g.equipped[slot]; g.equipped[slot]=id; g.owned=g.owned.filter(function(x){ return x!==id; }); if(prev) g.owned.unshift(prev); save(); }
  function unequip(slot){ var g=state(); var id=g.equipped[slot]; if(!id) return; g.equipped[slot]=null; g.owned.push(id); save(); }
  function addGear(id){ var g=state(); g.owned.push(id); if(g.enh[id]==null) g.enh[id]=0; g.dur[id]=100; save(); }
  function removeGear(id){ var g=state(); Object.keys(g.equipped).forEach(function(k){ if(g.equipped[k]===id) g.equipped[k]=null; }); g.owned=g.owned.filter(function(x){ return x!==id; }); if(g.custom&&g.custom[id]) delete g.custom[id]; save(); }
  function isEquipped(id){ var g=state(); return Object.keys(g.equipped).some(function(k){ return g.equipped[k]===id; }); }
  function allGear(){ var g=state(), ids=[]; Object.keys(g.equipped).forEach(function(k){ if(g.equipped[k]) ids.push(g.equipped[k]); }); return ids.concat(g.owned); }
  /* 강화 규칙 (마영전·검은사막 벤치마킹, docs/design/06-phase1-gear-review.md)
     · 안전 구간 없음(+1 부터 실패 시 하락) · 성공률 상한 90% · 내구도 20 미만이면 강화 불가(대수선 먼저)
     · 실패 스택: 실패마다 +3%p (최대 +30%p), 성공 시 소모 — 캐릭터 공용
     · 실패: 내구도 손실(6+단계×2). +4~+6 은 한 단계 하락, +7 이상은 두 단계 하락. 내구도 0 이면 파괴
     · 보조제(m_booster)는 선택 사용: 실패 시 단계 유지(내구도는 깎임). 단계표의 보조제는 요구 재료에서 제외 */
  var SAFE_TO=0, CAP=90, FS_STEP=3, FS_MAX=30, DUR_MIN=20;   /* 안전 구간 없음: +1 부터 실패·하락 가능 (디렉터 결정) */
  function fsOf(){ return state().fs||0; }
  function enhStep(id){ var it=T.get(id); if(!it) return null; var cur=enhOf(id); if(cur>=(it.enhMax||10)) return null; var e=T.ENHANCE.filter(function(e){ return e.to===cur+1; })[0]; if(!e) return null;
    var mats=e.mats.filter(function(m){ return m[0]!=='m_booster'; }); var boost=e.mats.filter(function(m){ return m[0]==='m_booster'; })[0];
    var safe=e.to<=SAFE_TO; var gb=window.TW_GRADE?TW_GRADE.buffs():null; var rate=safe?100:Math.min(CAP, e.rate+fsOf()+(gb?gb.enhRate:0));
    return { to:e.to, cost:e.cost, mats:mats, rate:rate, baseRate:safe?100:e.rate, fs:safe?0:fsOf(), safe:safe, boosterN:boost?boost[1]:1, unlock:e.unlock,
      drop:e.to<=6?1:2, durLoss:safe?0:(6+e.to*2), durOk:durOf(id)>=DUR_MIN }; }
  function enhance(id, useBooster){ var step=enhStep(id); if(!step) return { err:'max' }; if(!step.durOk) return { err:'dur' };
    var mats=step.mats.slice(); if(useBooster && !step.safe) mats.push(['m_booster', step.boosterN]);
    if(!canPay(mats, step.cost)) return { err:'pay' };
    var g=state(); spend(mats, step.cost); var ok=step.safe || Math.random()*100<step.rate;
    var r={ ok:ok, to:step.to, from:enhOf(id), booster:!!useBooster&&!step.safe, drop:false, broken:false, rate:step.rate }; if(ok&&SV.stat) SV.stat('enhOk');
    if(ok){ g.enh[id]=step.to; g.fs=0; if(!step.safe) g.dur[id]=Math.max(0, durOf(id)-2); }
    else { g.fs=Math.min(FS_MAX, fsOf()+FS_STEP); g.dur[id]=Math.max(0, durOf(id)-step.durLoss); if(!r.booster && step.drop && r.from>0){ g.enh[id]=Math.max(0, r.from-step.drop); r.drop=true; } if(g.dur[id]<=0){ r.broken=true; removeGear(id); } }
    r.enh=g.enh[id]; r.dur=g.dur[id]; r.fs=g.fs; save(); return r; }
  function repairCost(id){ var it=T.get(id); var miss=100-durOf(id); var gb=window.TW_GRADE?TW_GRADE.buffs():null; return miss<=0?0:Math.max(100, Math.round((1-(gb?gb.repair:0))*(it.price||1000)*0.15*miss/100)); }   /* 파티 제작 등급: 수리비 할인 */
  function repair(id){ var c=repairCost(id); if(c<=0) return { err:'full' }; if(wallet()<c) return { err:'pay' }; if(SV.stat) SV.stat('repairs'); SV.addGold(-c); state().dur[id]=100; save(); return { ok:true, cost:c }; }
  var SALVAGE={ common:[['m_ore',2],['m_fiber',3]], rare:[['m_alloy',3],['m_ore',4]], hero:[['m_alloy',6],['m_shard',2]], legend:[['m_alloy',10],['m_shard',5],['m_core',1]], myth:[['m_alloy',16],['m_shard',8],['m_core',3],['m_heart',1]] };
  function dismantle(id){ var it=T.get(id); if(!it) return { err:'none' }; if(isEquipped(id)) return { err:'equipped' }; var got=(SALVAGE[it.rarity]||SALVAGE.common).map(function(m){ var n=Math.max(1, Math.round(m[1]*(0.6+0.4*durOf(id)/100))); addItem(m[0], n); return [m[0], n]; }); removeGear(id); return { ok:true, got:got }; }

  /* ---------- 제작 자유도: 재료 선택으로 만든 장비 인스턴스 (저장 gear.custom[id]) ---------- */
  function buildCustom(baseId, picks, id){ var base=T.get(baseId); if(!base||!base.stats) return null; var st={}; Object.keys(base.stats).forEach(function(k){ st[k]=base.stats[k]; });
    var fx=T.CRAFT_FX, names=[], look={ tint:null, metal:null, rough:0, glow:0, glowColor:null, scale:1 }, rarUp=0, startEnh=0, cpMul=1;
    T.CRAFT_SLOTS.forEach(function(sl){ var m=picks[sl.key]; var f=m&&fx[m]; if(!f) return; names.push(f.name);
      Object.keys(f.mul||{}).forEach(function(k){ if(st[k]!=null) st[k]=st[k]*f.mul[k]; if(k==='atk'&&st.atkEx!=null) st.atkEx*=f.mul[k]; cpMul*= (k==='atk'||k==='def')? f.mul[k]:1; });
      Object.keys(f.add||{}).forEach(function(k){ if(f.add[k]) st[k]=(st[k]||0)+f.add[k]; });
      var L=f.look||{}; if(L.tint) look.tint=L.tint; if(L.metal!=null) look.metal=L.metal; if(L.rough!=null) look.rough+=L.rough; if(L.glow){ look.glow=Math.max(look.glow,L.glow); look.glowColor=L.glowColor||look.glowColor; } if(L.scale) look.scale*=L.scale;
      rarUp+=f.rarityUp||0; startEnh+=f.startEnh||0; });
    Object.keys(st).forEach(function(k){ st[k]=+(st[k]).toFixed(k==='crit'||k==='critDmg'||k==='skill'?1:0); });
    var order=['common','rare','hero','legend','myth']; var rar=order[Math.min(order.length-1, order.indexOf(base.rarity)+rarUp)];
    var it=Object.assign({}, base, { id:id, name:base.name+(names.length?' ('+names.join('·')+')':''), stats:st, rarity:rar, cp:Math.round(base.cp*cpMul), enh:0, sheetEnh:0, dur:[100,100], bind:'제작품', origin:'제작 · '+(names.join('·')||'기본'), src:'craft', custom:{ base:baseId, picks:picks, look:look, startEnh:startEnh } });
    return it; }
  function loadCustom(){ var g=state(); if(!g.custom) g.custom={}; Object.keys(g.custom).forEach(function(id){ var c=g.custom[id]; if(!T.get(id)){ var it=buildCustom(c.base, c.picks, id); if(it){ it.enh=g.enh[id]||0; T.register(it); } } }); }
  function previewCustom(baseId, picks){ return buildCustom(baseId, picks, '__preview'); }
  function customMats(picks){ var m=[]; T.CRAFT_SLOTS.forEach(function(sl){ if(picks[sl.key]) m.push([picks[sl.key], sl.n]); }); return m; }
  function mergeMats(list){ var o={}, out=[]; list.forEach(function(m){ if(o[m[0]]==null){ o[m[0]]=out.length; out.push([m[0], m[1]]); } else out[o[m[0]]][1]+=m[1]; }); return out; }
  function craftCustom(r, picks){ var mats=mergeMats(r.mats.concat(customMats(picks))); if(!canPay(mats, r.cost)||T.PLAYER.craftLv<r.craftLv) return { err:'pay' };
    var id='c_'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36); var it=buildCustom(r.result, picks, id); if(!it) return { err:'base' };
    spend(mats, r.cost); if(SV.stat) SV.stat('crafted'); var g=state(); g.custom[id]={ base:r.result, picks:picks }; T.register(it); addGear(id); if(it.custom.startEnh){ g.enh[id]=it.custom.startEnh; it.enh=g.enh[id]; save(); }
    return { ok:true, item:it }; }
  function lookOf(id){ var it=T.get(id); return it&&it.custom ? it.custom.look : null; }
  loadCustom();
  /* 제작: items.js 의 canCraft/craft 를 저장 연동판으로 교체 */
  T.canCraft=function(r){ return canPay(r.mats, r.cost) && T.PLAYER.craftLv>=r.craftLv; };
  T.craft=function(r,n){ n=n||1; var made=0; for(var i=0;i<n;i++){ if(!T.canCraft(r)) break; spend(r.mats, r.cost); var res=T.get(r.result); if(res.type==='material'||res.type==='consumable'){ addItem(r.result, r.yield||1); if(SV.stat) SV.stat('craftedCons'); } else { addGear(r.result); if(SV.stat) SV.stat('crafted'); } made++; } return made; };
  /* 시트 기본 강화 단계 표시(slotHTML 의 +N)를 저장 단계로 */
  T.EQUIP.forEach(function(e){ if(e.sheetEnh==null) e.sheetEnh=e.enh||0; e.enh=enhOf(e.id); });
  window.TW_GEAR={ state:state, stats:stats, base:base, cp:cp, itemCp:itemCp, itemStats:itemStats, mult:mult, enhOf:enhOf, durOf:durOf, equip:equip, unequip:unequip, addGear:addGear, removeGear:removeGear, isEquipped:isEquipped, allGear:allGear,
    enhStep:enhStep, enhance:enhance, fsOf:fsOf, DUR_MIN:DUR_MIN, previewCustom:previewCustom, customMats:customMats, mergeMats:mergeMats, craftCustom:craftCustom, lookOf:lookOf, repairCost:repairCost, repair:repair, dismantle:dismantle, addItem:addItem, spend:spend, canPay:canPay, wallet:wallet, STEP:STEP };
})();
