/* 황혼 — 외형 화면 (looks.html). 슬롯별 착·탈 · 염색 · 외형 프리셋 3칸.
   3D 는 viewer.html 을 iframe 으로 띄우고 postMessage 로 조종한다 — 모델을 다시 받지 않으므로
   염색이 바로 보인다 (docs/design/34). 성능 수치는 전혀 건드리지 않는다. */
(function(){
  var $=function(id){ return document.getElementById(id); };
  var G=window.TW_GEAR, T=window.TW_ITEMS;
  if(!G||!T) return;

  /* 시트 34 의 부위 순서. 게임이 실제로 가진 슬롯만 — 여기서 칸을 늘리면
     gear.sum() 이 Object.keys(equipped) 를 도는 탓에 능력치가 조용히 올라간다. */
  var SLOTS=[['main','주무기'],['sub','보조'],['off','부무기'],['head','머리'],['chest','상의'],
             ['legs','하의'],['gloves','장갑'],['boots','신발'],['acc','장신구']];
  var LABEL={}; SLOTS.forEach(function(s){ LABEL[s[0]]=s[1]; });
  /* 팔레트 — 게임 색조에 맞춘 16색. 자유색은 색 고르기로 */
  var SWATCH=['#8a2420','#b8442c','#c99a2b','#8f8a3a','#4e6b3c','#2f6b5e','#33586f','#3a4a78',
              '#5a3f72','#7a3f5e','#d8cdbb','#9a9086','#5d564e','#2f2c29','#161719','#e8e2d6'];

  var sel='chest', cur=null;   /* 고른 슬롯 · 고른 색 */

  function ico(id){ var it=T.get(id); return it?('art/items/'+(it.custom?it.custom.base:id)+'.svg'):''; }
  function nameOf(id){ var it=T.get(id); return it?it.name:id; }

  /* --- 왼쪽: 슬롯 --- */
  function renderSlots(){
    var eq=G.state().equipped, box=$('lk-slots'); box.replaceChildren();
    SLOTS.forEach(function(s){
      var id=eq[s[0]], dye=id?G.dyeOf(id):null;
      var row=document.createElement('div');
      row.className='slotrow'+(sel===s[0]?' is-on':'');
      row.dataset.slot=s[0]; row.tabIndex=0; row.setAttribute('role','button');
      row.innerHTML='<div class="slotrow__i">'+(id?'<img alt="" src="'+ico(id)+'">':'')+'</div>'+
        '<div class="slotrow__c"><div class="slotrow__k">'+s[1]+'</div>'+
        '<div class="slotrow__t'+(id?'':' is-empty')+'">'+(id?nameOf(id):'비어 있음')+'</div></div>'+
        '<span class="slotrow__dot"'+(dye?' style="background:'+dye+'"':' hidden')+'></span>';
      box.append(row);
    });
    var C=window.TW_WORLD&&TW_WORLD.CHARS[G.char()]; $('lk-char').textContent=(C&&(C.nm||C.name))||G.char();
  }

  /* --- 가운데 아래: 이 슬롯에 넣을 수 있는 소지품 --- */
  function renderPicks(){
    var g=G.state(), eq=g.equipped, box=$('lk-picks'); box.replaceChildren();
    $('lk-pick-t').textContent=LABEL[sel]+' — 소지품';
    var list=g.owned.filter(function(id){ var it=T.get(id);
      return it && it.slot===sel && G.canEquip(id) && eq[sel]!==id; });
    if(!list.length){ var e=document.createElement('div');
      e.className='xs t-ghost lk-empty'; e.style.cssText='grid-column:1/-1;text-align:center';
      e.textContent='이 부위에 넣을 장비가 없습니다.'; box.append(e); return; }
    list.forEach(function(id){
      var b=document.createElement('button'); b.type='button'; b.className='pick'; b.dataset.id=id;
      b.title=nameOf(id);
      b.innerHTML='<img alt="" src="'+ico(id)+'"><span class="pick__n">'+nameOf(id)+'</span>';
      box.append(b);
    });
  }

  /* --- 오른쪽: 염색 --- */
  function renderDye(){
    var eq=G.state().equipped, id=eq[sel];
    var t=$('lk-dye-t');
    if(!id){ t.textContent=LABEL[sel]+' 부위가 비어 있습니다.'; }
    else t.innerHTML=LABEL[sel]+' · <b>'+nameOf(id)+'</b>';
    var dye=id?G.dyeOf(id):null;
    cur=cur||dye||'#8a2420';
    $('lk-color').value=cur; $('lk-hex').textContent=cur.toUpperCase();
    $('lk-cost').textContent=id?(G.dyeCost().toLocaleString()+' G'):'—';
    $('lk-apply').disabled=!id; $('lk-reset').disabled=!id||!dye;
    var sw=$('lk-sw'); sw.replaceChildren();
    SWATCH.forEach(function(c){
      var b=document.createElement('button'); b.type='button'; b.dataset.c=c;
      b.style.background=c; b.title=c; b.setAttribute('aria-label','색 '+c);
      if(c===cur) b.className='is-on';
      sw.append(b);
    });
  }

  /* --- 오른쪽: 프리셋 3칸 --- */
  function renderPresets(){
    var L=G.looks(), box=$('lk-presets'); box.replaceChildren();
    for(var i=0;i<3;i++){ (function(i){
      var p=L[i], b=document.createElement('button'); b.type='button';
      b.className='pset'+(p?'':' is-empty'); b.dataset.i=i;
      var n=p?Object.keys(p.equipped).filter(function(k){ return p.equipped[k]; }).length:0;
      b.innerHTML='<div class="pset__n">'+(p?p.name:'빈 칸')+'</div>'+
        '<div class="pset__s">'+(p?(n+'점 · 입기'):'지금 모습 저장')+'</div>';
      box.append(b);
    })(i); }
  }

  function wallet(){ var w=G.wallet?G.wallet():null;
    $('lk-wallet').querySelector('.num').textContent=(w==null?'—':w.toLocaleString()); }

  function note(msg,bad){ var n=$('lk-note'); n.textContent=msg;
    n.className='xs '+(bad?'t-bad':'t-faint'); }

  /* --- 3D --- */
  var frame=$('lk-3d'), ready=false;
  function send(m){ try{ if(ready&&frame.contentWindow) frame.contentWindow.postMessage(m,'*'); }catch(e){} }
  function relook(){ send({t:'relook'}); }
  function loadFrame(){
    ready=false;
    frame.src='viewer.html?equip=1&fit=1&char='+encodeURIComponent(G.char())+
      '&wind='+encodeURIComponent($('lk-wind').value)+'&t='+Date.now();
  }
  frame.addEventListener('load', function(){ ready=true;
    /* 뷰어가 모델을 다 붙일 때까지 잠깐 — 붙기 전에 지시하면 조용히 흘러간다 */
    setTimeout(function(){ send({t:'pose',v:$('lk-pose').value});
      send({t:'light',v:$('lk-light').value}); }, 1200); });

  function redraw(){ renderSlots(); renderPicks(); renderDye(); renderPresets(); wallet(); }

  /* --- 조작 --- */
  $('lk-slots').addEventListener('click', function(e){
    var r=e.target.closest('[data-slot]'); if(!r) return;
    sel=r.dataset.slot; cur=null; redraw(); });
  $('lk-slots').addEventListener('keydown', function(e){
    if(e.key!=='Enter'&&e.key!==' ') return; var r=e.target.closest('[data-slot]'); if(!r) return;
    e.preventDefault(); sel=r.dataset.slot; cur=null; redraw(); });

  $('lk-picks').addEventListener('click', function(e){
    var b=e.target.closest('[data-id]'); if(!b) return;
    try{ G.equip(sel, b.dataset.id); }
    catch(x){ note(x.message||'장착할 수 없습니다.', true); return; }
    note(nameOf(b.dataset.id)+' 착용'); redraw(); relook(); });

  $('lk-off').addEventListener('click', function(){
    var eq=G.state().equipped; if(!eq[sel]){ note(LABEL[sel]+' 부위가 이미 비어 있습니다.'); return; }
    var n=nameOf(eq[sel]); G.unequip(sel); note(n+' 벗음'); redraw(); relook(); });

  $('lk-sw').addEventListener('click', function(e){
    var b=e.target.closest('[data-c]'); if(!b) return; cur=b.dataset.c; renderDye(); });
  $('lk-color').addEventListener('input', function(){ cur=$('lk-color').value; renderDye(); });

  $('lk-apply').addEventListener('click', function(){
    var id=G.state().equipped[sel]; if(!id) return;
    var cost=G.dyeCost();
    if(!G.canPay(null, cost)){ note('금화가 '+cost.toLocaleString()+' G 필요합니다.', true); return; }
    try{ G.spend(null, cost); G.setDye(id, cur); }
    catch(x){ note(x.message||'물들일 수 없습니다.', true); return; }
    note(nameOf(id)+' 을(를) '+cur.toUpperCase()+' 로 물들였습니다.');
    redraw(); relook(); });

  $('lk-reset').addEventListener('click', function(){
    var id=G.state().equipped[sel]; if(!id) return;
    G.clearDye(id); cur=null; note(nameOf(id)+' 의 색을 되돌렸습니다.'); redraw(); relook(); });

  /* 빈 칸은 저장, 찬 칸은 입기. 길게 누르면(우클릭) 비운다 */
  $('lk-presets').addEventListener('click', function(e){
    var b=e.target.closest('[data-i]'); if(!b) return; var i=+b.dataset.i;
    if(!G.looks()[i]){ G.saveLook(i, '외형 '+(i+1)); note('지금 모습을 '+(i+1)+'번 칸에 저장했습니다.'); redraw(); return; }
    var r; try{ r=G.wearLook(i); }catch(x){ note(x.message||'입을 수 없습니다.', true); return; }
    note(r.missing.length? (r.worn+'점 착용 · '+r.missing.length+'점은 지금 없습니다.')
                         : (r.worn+'점을 갈아입었습니다.'), !!r.missing.length);
    redraw(); relook(); });
  $('lk-presets').addEventListener('contextmenu', function(e){
    var b=e.target.closest('[data-i]'); if(!b) return; e.preventDefault();
    G.clearLook(+b.dataset.i); note((+b.dataset.i+1)+'번 칸을 비웠습니다.'); redraw(); });

  $('lk-pose').addEventListener('change', function(){ send({t:'pose',v:this.value}); });
  $('lk-wind').addEventListener('change', function(){ send({t:'wind',v:this.value}); });
  $('lk-light').addEventListener('change', function(){ send({t:'light',v:this.value}); });
  var spin=false;
  $('lk-spin').addEventListener('click', function(){ spin=!spin; send({t:'spin',v:spin});
    this.classList.toggle('is-on',spin); this.textContent=spin?'회전 멈춤':'자동 회전'; });

  redraw(); loadFrame();
  window.TW_LOOKS_SCREEN={ redraw:redraw, slot:function(){ return sel; }, SWATCH:SWATCH, SLOTS:SLOTS };
})();
