/* 황혼 — 진행 저장 (localStorage 'tw:save')
   TW_SAVE.get() · addGold(n) · addXp(n) → {lv, leveled} · addItem(id, n) · flags · reset() */
(function(){
  var KEY='tw:save', BASE=75300;
  var DEF={ gold:0, xp:0, lv:1, bag:{}, flags:{}, stats:{ kills:0, runs:0 }, v:1, char:'ain' };
  function load(){ try{ var s=JSON.parse(localStorage.getItem(KEY)||'null'); if(!s) return JSON.parse(JSON.stringify(DEF)); return Object.assign(JSON.parse(JSON.stringify(DEF)), s); }catch(e){ return JSON.parse(JSON.stringify(DEF)); } }
  var S=load();
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
  /* 레벨 곡선: Lv n → n+1 에 필요한 XP */
  function need(lv){ return Math.round(120 * Math.pow(lv, 1.45)); }
  var api={
    get:function(){ return S; }, need:need,
    /* 표시 지갑 = BASE(시트 기준 시작 자금, items.js PLAYER.gold) + gold. 보급소에서 쓰면 gold 가 음수로 내려갈 수 있다(−BASE 까지) */
    addGold:function(n){ S.gold=Math.max(-BASE, S.gold+Math.round(n)); save(); return S.gold; },
    wallet:function(){ return BASE+S.gold; },
    addXp:function(n){ S.xp+=Math.round(n); var leveled=0; while(S.xp>=need(S.lv)){ S.xp-=need(S.lv); S.lv++; leveled++; } save(); return { lv:S.lv, xp:S.xp, need:need(S.lv), leveled:leveled }; },
    addItem:function(id,n){ S.bag[id]=(S.bag[id]||0)+(n||1); save(); return S.bag[id]; },
    flag:function(k,v){ if(v===undefined) return !!S.flags[k]; S.flags[k]=v; save(); },
    stat:function(k,n){ S.stats[k]=(S.stats[k]||0)+(n==null?1:n); save(); },
    /* 출격 캐릭터 (ain·kain·ryu·sera) */
    char:function(id){ if(id===undefined) return S.char||'ain'; S.char=id; save(); try{ window.dispatchEvent(new CustomEvent('tw:char',{detail:id})); }catch(e){} return id; },
    save:save,
    /* 다른 창(외형 화면의 viewer iframe)이 저장을 고쳤을 때 다시 읽는다.
       S 는 스크립트를 읽는 순간 한 번만 만들어지므로, 이게 없으면 iframe 은
       제 기억 속의 옛 장비를 계속 입힌다 (docs/design/34 §3). */
    reload:function(){ S=load(); return S; },
    reset:function(){ S=JSON.parse(JSON.stringify(DEF)); save(); }
  };
  window.TW_SAVE=api;
})();
