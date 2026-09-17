/* 황혼 — 드랍·보상 (2단계). 잡몹·부위 파괴·클리어 보상을 한 표에서 굴리고, 실제로 지급한다.
   TW_LOOT.roll(table, luck) → [[id,n],…] · mobDrops(defId, luck) · partDrops(luck) · clearRewards(arenaId, sum, first) → { gold, xp, mats, craft, bonus, all }
   · luck: 1.0 기본. 카운터 성공률·부위 파괴율이 높을수록 희귀 드랍 확률이 오른다(마영전·붉사의 "잘 싸우면 더 나온다")
   · 지급: grant(list) — 재료·소모품은 가방(items qty + save.bag), 장비는 gear.owned */
(function(){
  var T=window.TW_ITEMS, SV=window.TW_SAVE, G=window.TW_GEAR;
  var LOOT={
    mobs:{ train_bot:{ gold:[60,110], items:[ ['m_fiber',[1,3],0.70], ['m_bone',[1,2],0.40], ['m_ore',[1,2],0.25], ['m_dew',[1,1],0.08], ['m_shard',[1,1],0.03] ] } },
    parts:{ items:[ ['m_alloy',[2,4],1.0], ['m_shard',[1,1],0.5], ['m_core',[1,1],0.15] ] },
    clear:{ tutorial:{ rare:[ ['m_booster',[1,1],0.35], ['m_core',[1,2],0.50], ['m_heart',[1,1],0.08], ['w_rust_executioner',[1,1],0.05], ['acc_band',[1,1],0.06] ],
                  gradeGold:{ S:1.5, A:1.25, B:1.0, C:0.75 }, first:{ gold:1000, items:[['m_booster',2],['m_heart',1]] } } }
  };
  function rnd(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }
  function isGear(id){ var it=T.get(id); return !!(it&&(it.type==='weapon'||it.type==='armor'||it.type==='acc')); }
  function roll(table, luck){ luck=luck||1; var out=[]; (table.items||[]).forEach(function(e){ var p=Math.min(1, e[2]*luck); if(Math.random()<p) out.push([e[0], rnd(e[1][0], e[1][1])]); }); return out; }
  function mobDrops(defId, luck){ var t=LOOT.mobs[defId]; if(!t) return { gold:0, items:[] }; return { gold:rnd(t.gold[0], t.gold[1]), items:roll(t, luck) }; }
  function partDrops(luck){ return roll(LOOT.parts, luck); }
  function luckOf(sum){ var cr=sum.counterRate||0, pf=sum.breakable?sum.breaks/sum.breakable:0; return 1+0.35*cr+0.25*pf; }
  function withRarity(list){ return list.map(function(m){ var it=T.get(m[0]); return [m[0], m[1], it?it.rarity:'common']; }); }
  function clearRewards(arenaId, sum, first){ var c=LOOT.clear[arenaId]||LOOT.clear.tutorial, luck=luckOf(sum);
    var base=(sum.mats||[]).map(function(m){ return [m[0], m[1]]; });               /* 아레나 기본 보상 (+S 보너스) */
    var gm=c.gradeGold[sum.rank]||1, gold=Math.round((sum.gold||0)*gm), bonus=[];
    if(gm!==1) bonus.push(['등급 보상 '+sum.rank, (gm>1?'+':'')+Math.round((gm-1)*100)+'% 골드']);
    var rare=roll(c, luck); bonus.push(['행운 ×'+luck.toFixed(2), '카운터 '+Math.round((sum.counterRate||0)*100)+'% · 부위 파괴 '+(sum.breaks||0)+'/'+(sum.breakable||0)+(rare.length?' → 희귀 드랍 '+rare.length+'종':'')]);
    var firstItems=[]; if(first){ gold+=c.first.gold; firstItems=c.first.items.slice(); bonus.push(['최초 클리어', '+'+T.fmt(c.first.gold)+' 골드 · 보조제 ×2 · 심장 결정']); }
    var all=base.concat(rare, firstItems), merged={}; all.forEach(function(m){ merged[m[0]]=(merged[m[0]]||0)+m[1]; });
    var list=Object.keys(merged).map(function(id){ return [id, merged[id]]; });
    return { gold:gold, luck:luck, mats:withRarity(list.filter(function(m){ return !isGear(m[0]); })), craft:withRarity(list.filter(function(m){ return isGear(m[0]); })), bonus:bonus, all:list }; }
  function grant(list){ (list||[]).forEach(function(m){ if(isGear(m[0])){ for(var i=0;i<m[1];i++){ if(G) G.addGear(m[0]); } } else if(G) G.addItem(m[0], m[1]); else SV.addItem(m[0], m[1]); }); }
  function describe(arenaId){ var m=LOOT.mobs.train_bot.items.map(function(e){ return T.get(e[0]).name; }); var p=LOOT.parts.items.map(function(e){ return T.get(e[0]).name; }); var c=(LOOT.clear[arenaId]||LOOT.clear.tutorial).rare.map(function(e){ return T.get(e[0]).name; }); return { mobs:m, parts:p, rare:c }; }
  window.TW_LOOT={ LOOT:LOOT, roll:roll, mobDrops:mobDrops, partDrops:partDrops, clearRewards:clearRewards, grant:grant, luckOf:luckOf, describe:describe, isGear:isGear };
})();
