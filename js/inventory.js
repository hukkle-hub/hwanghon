/* 황혼 — 장비/인벤토리 화면을 items.js 데이터로 렌더링 */
(function(){
  'use strict';
  var T = window.TW_ITEMS, P = T.PLAYER, $ = function(s){ return document.querySelector(s); };
  var filter = 'all', selected = null;      // selected: {id, where:'bag'|'equipped', slot}

  var SLOT_ORDER_L = ['main','sub','off','merc'], SLOT_ORDER_R = ['head','chest','legs','gloves','boots','acc'];

  function statRows(it, cmp){
    var s = it.stats||{}, c = cmp ? (cmp.stats||{}) : null, rows = [];
    function d(k, unit){
      if (s[k]==null) return;
      var v = s[k], html = '<span class="stat__v num">'+ (unit==='%' ? v+'%' : T.fmt(v));
      if (c && c[k]!=null && c[k]!==v){
        var diff = +(v - c[k]).toFixed(1), up = diff>0;
        html += ' <span class="delta '+(up?'delta--up':'delta--down')+'">'+(up?'▲':'▼')+Math.abs(diff)+(unit==='%'?'%':'')+'</span>';
      }
      rows.push('<div class="stat"><span class="stat__k">'+LBL[k]+'</span>'+html+'</span></div>');
    }
    ['atk','atkEx','def','hp'].forEach(function(k){ d(k); });
    rows.push('<div class="hr"></div>');
    ['crit','critDmg','skill'].forEach(function(k){ d(k,'%'); });
    if (s.bleed!=null) d('bleed');
    return rows.join('');
  }
  var LBL = { atk:'기본 공격력', atkEx:'추가 공격력', def:'방어력', hp:'HP', crit:'치명타 확률', critDmg:'치명타 피해', skill:'스킬 피해 증가', bleed:'출혈 적중' };

  function head(it){
    var r = T.RARITY[it.rarity];
    return '<div class="iname" style="color:'+r.color+'">'+it.name+'</div>'+
      '<div class="xs t-faint mt1">'+(it.origin||'')+'</div>'+
      '<div class="xs mt1" style="color:'+r.color+'">'+(it.kind||T.TYPE[it.type])+' / '+r.name+' 등급</div>';
  }

  function renderInfo(){
    var box = $('#item-info'), cmp = $('#item-cmp');
    if (!selected){ box.innerHTML = '<div class="xs t-faint">아이템을 선택하십시오.</div>'; cmp.innerHTML=''; return; }
    var it = T.get(selected.id);
    var eqId = it.slot ? P.equipped[it.slot] : null;
    var eq = (eqId && eqId !== selected.id) ? T.get(eqId) : null;
    var isEq = selected.where === 'equipped';
    $('#info-badge').textContent = isEq ? '장착 중' : (it.slot ? '미장착' : T.TYPE[it.type]);
    $('#info-badge').className = 'chip ' + (isEq ? 'chip--red' : '');

    if (it.type==='material' || it.type==='consumable' || it.type==='quest'){
      box.innerHTML = head(it) + '<div class="hr"></div><div class="stat"><span class="stat__k">보유</span><span class="stat__v num">'+T.fmt(it.qty)+'</span></div>'+
        '<div class="hr"></div><div class="xs t-dim" style="line-height:1.7">'+(it.desc||'')+'</div>';
      cmp.innerHTML = '<div class="xs t-faint">비교 대상 없음</div>';
      $('#act-equip').textContent = '사용'; return;
    }
    box.innerHTML = head(it) +
      '<div class="flex ac jb mt3"><div><div class="xs t-faint">전투력</div><div class="bigcp t-red num mt1">'+T.fmt(it.cp)+'</div></div>'+
      '<div class="iart fill"><svg class="ico"><use href="#i-'+it.icon+'"/></svg></div></div>'+
      '<div class="hr"></div>' + statRows(it) +
      (it.effect ? '<div class="hr"></div><div class="xs t-dim" style="line-height:1.7">'+it.effect+'</div>' : '') +
      (it.flavor ? '<div class="hr"></div><p class="flavor" style="margin:0">'+it.flavor+'</p>' : '') +
      '<div class="hr"></div><div class="stat"><span class="stat__k">요구 레벨</span><span class="stat__v">'+it.reqLv+'</span></div>'+
      '<div class="stat"><span class="stat__k">귀속 상태</span><span class="stat__v xs">'+it.bind+'</span></div>'+
      '<div class="stat"><span class="stat__k">강화 단계</span><span class="stat__v num">+'+it.enh+' / '+it.enhMax+'</span></div>'+
      '<div class="hr"></div><div class="stat"><span class="stat__k">내구도</span><span class="stat__v num">'+it.dur[0]+' / '+it.dur[1]+'</span></div>'+
      '<div class="stat"><span class="stat__k">판매가</span><span class="stat__v flex ac g1"><svg class="ico ico--xs t-gold"><use href="#i-coin"/></svg>'+T.fmt(it.price)+'</span></div>';

    if (!eq){ cmp.innerHTML = '<div class="xs t-faint">'+(isEq?'장착 중인 장비입니다.':'같은 슬롯에 장착된 장비가 없습니다.')+'</div>'; }
    else {
      var diffCp = it.cp - eq.cp, up = diffCp>0;
      cmp.innerHTML = head(eq) +
        '<div class="flex ac jb mt3"><div><div class="xs t-faint">전투력</div><div class="flex ac g1 mt1"><span class="bigcp t-dim num">'+T.fmt(eq.cp)+'</span>'+
        '<span class="delta '+(up?'delta--down':'delta--up')+'">'+(up?'▼':'▲')+' '+T.fmt(Math.abs(diffCp))+'</span></div></div>'+
        '<div class="iart fill"><svg class="ico"><use href="#i-'+eq.icon+'"/></svg></div></div>'+
        '<div class="hr"></div>' + statRows(eq, it) +
        (eq.effect ? '<div class="hr"></div><div class="xs t-dim" style="line-height:1.7">'+eq.effect+'</div>' : '') +
        '<div class="hr"></div><div class="stat"><span class="stat__k">강화 단계</span><span class="stat__v num">+'+eq.enh+' / '+eq.enhMax+'</span></div>'+
        '<div class="hr"></div><div class="label-ko">장착 시 능력치 변화</div>' + changeRows(it, eq);
    }
    $('#act-equip').textContent = isEq ? '해제' : '장착';
  }
  function changeRows(a, b){
    var out=[], keys=['cp','atk','def','hp','crit','critDmg'];
    keys.forEach(function(k){
      var va = k==='cp'?a.cp:(a.stats||{})[k], vb = k==='cp'?b.cp:(b.stats||{})[k];
      if (va==null && vb==null) return; va=va||0; vb=vb||0;
      var d=+(va-vb).toFixed(1); if(!d) return;
      var pct = (k==='crit'||k==='critDmg') ? '%' : '';
      out.push('<div class="stat"><span class="stat__k">'+(k==='cp'?'전투력':LBL[k])+'</span><span class="stat__v"><span class="'+(d>0?'up':'down')+' num">'+(d>0?'+':'')+T.fmt(d)+pct+'</span></span></div>');
    });
    return out.join('') || '<div class="xs t-faint">변화 없음</div>';
  }

  function renderSlots(){
    function one(slot){
      var id = P.equipped[slot], it = id && T.get(id);
      var body = it ? T.slotHTML(id, {on: selected && selected.where==='equipped' && selected.slot===slot})
                    : '<div class="slot '+(slot==='merc'?'slot--lock':'slot--empty')+'" data-slot="'+slot+'"><svg class="ico"><use href="#i-'+(slot==='merc'?'seal':ICON[slot])+'"/></svg></div>';
      return '<div class="eq" data-slot="'+slot+'"><span class="slot__name">'+T.SLOT[slot]+'</span>'+body+'</div>';
    }
    $('#eq-left').innerHTML  = SLOT_ORDER_L.map(one).join('');
    $('#eq-right').innerHTML = SLOT_ORDER_R.map(one).join('') + '<div class="eq"><div class="slot slot--lock"><svg class="ico"><use href="#i-lock"/></svg></div></div>';
    var cp = 0; Object.keys(P.equipped).forEach(function(k){ var it=T.get(P.equipped[k]); if(it) cp+=it.cp; });
    $('#cp-total').textContent = T.fmt(cp + 16030);   // 캐릭터 기본 전투력 16,030 + 장비 합 = 시트 24,650
  }
  var ICON = { head:'helm', chest:'chest', legs:'pants', gloves:'glove', boots:'boot', acc:'ring', main:'scythe', sub:'sword', off:'scythe' };

  function renderBag(){
    var items = P.bag.map(function(b){ return T.get(b.item); }).filter(Boolean);
    if (filter!=='all') items = items.filter(function(it){ return it.type===filter; });
    var cons = T.CONSUMABLE.filter(function(c){ return filter==='all' || filter===c.type; });
    var html = items.map(function(it){ return T.slotHTML(it.id, {on: selected && selected.where==='bag' && selected.id===it.id}); }).join('')
             + cons.map(function(c){ return T.slotHTML(c.id, {on: selected && selected.id===c.id}); }).join('');
    var n = items.length + cons.length, total = 30;
    for (var i=n;i<total-5;i++) html += '<div class="slot slot--empty"></div>';
    for (i=0;i<5;i++) html += '<div class="slot slot--lock"><svg class="ico"><use href="#i-lock"/></svg></div>';
    $('#bag').innerHTML = html;
    $('#bag-count').textContent = n + ' / ' + total;
    $('#mats').innerHTML = T.MATERIAL.map(function(m){ return T.slotHTML(m.id, {on: selected && selected.id===m.id}); }).join('');
    $('#mat-count').textContent = T.MATERIAL.length + ' / 300';
  }

  function equipToggle(){
    if (!selected) return;
    var it = T.get(selected.id); if (!it.slot) return;
    if (selected.where==='equipped'){
      P.equipped[selected.slot] = null; P.bag.push({item:it.id}); selected = {id:it.id, where:'bag'};
    } else {
      var prev = P.equipped[it.slot];
      P.bag = P.bag.filter(function(b){ return b.item!==it.id; });
      if (prev) P.bag.unshift({item:prev});
      P.equipped[it.slot] = it.id; selected = {id:it.id, where:'equipped', slot:it.slot};
    }
    renderAll();
  }
  function renderAll(){ renderSlots(); renderBag(); renderInfo(); }

  document.addEventListener('click', function(e){
    var s = e.target.closest('.slot[data-id]'); if (!s) return;
    var eq = s.closest('.eq');
    selected = eq ? {id:s.dataset.id, where:'equipped', slot:eq.dataset.slot} : {id:s.dataset.id, where:'bag'};
    renderAll();
  });
  $('#filters').addEventListener('click', function(e){
    var f = e.target.closest('[data-filter]'); if(!f) return;
    filter = f.dataset.filter;
    [].forEach.call(this.querySelectorAll('[data-filter]'), function(x){ x.classList.toggle('is-on', x===f); });
    renderBag();
  });
  $('#act-equip').addEventListener('click', equipToggle);
  $('#hot-equip').addEventListener('click', equipToggle);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') location.href='office.html'; });

  selected = {id:P.equipped.main, where:'equipped', slot:'main'};
  renderAll();
})();
