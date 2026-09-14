/* 황혼 UI — 공용 런타임
   탭 / 리스트 선택 / 원형 게이지 / 슬롯 그리드 / 화면 전환 독 / 스테이지 피팅 */
(function(){
  'use strict';

  /* ---------- 화면 목록 ---------- */
  var SCREENS = [
    ['index.html',     '컨셉 시트'],
    ['office.html',    '인력사무실'],
    ['quest.html',     '의뢰 상세'],
    ['party.html',     '파티 모집'],
    ['characters.html','캐릭터'],
    ['inventory.html', '장비/인벤토리'],
    ['forge.html',     '강화'],
    ['craft.html',     '제작'],
    ['profile.html',   '프로필'],
    ['battle.html',    '전투 HUD'],
    ['result.html',    '전투 결과'],
    ['benchmark.html', '벤치마크'],
    ['compare.html',   '시트 대조']
  ];

  var $  = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

  /* ---------- 화면 전환 독 ---------- */
  function navDock(){
    var here = (location.pathname.split('/').pop() || 'index.html');
    var d = document.createElement('nav');
    d.className = 'navdock';
    d.innerHTML = SCREENS.map(function(s){
      return '<a href="'+s[0]+'"'+(s[0]===here?' class="is-on"':'')+'>'+s[1]+'</a>';
    }).join('') + '<button class="navdock__hide" title="숨기기 (H)">&times;</button>';
    document.body.appendChild(d);
    d.querySelector('.navdock__hide').onclick = function(){ d.style.display='none'; };
    document.addEventListener('keydown', function(e){
      if (e.key === 'h' || e.key === 'H') d.style.display = d.style.display==='none' ? '' : 'none';
    });
  }

  /* ---------- 스테이지 피팅 (1672px 기준 축소) ---------- */
  function fitStage(){
    var st = $('.stage'); if(!st) return;
    var base = st.offsetWidth || 1672;
    var k = Math.min(1, (window.innerWidth - 8) / base);
    st.style.transform = k < 1 ? 'scale('+k+')' : '';
    document.body.style.height = k < 1 ? (st.offsetHeight * k + 16) + 'px' : '';
    document.body.style.overflowX = 'hidden';
  }

  /* ---------- 탭 ---------- */
  /* [data-tabs] 컨테이너 안의 [data-tab] 클릭 → is-on 토글, [data-pane="키"] 표시 */
  function tabs(){
    $$('[data-tabs]').forEach(function(group){
      group.addEventListener('click', function(e){
        var t = e.target.closest('[data-tab]'); if(!t || !group.contains(t)) return;
        $$('[data-tab]', group).forEach(function(x){ x.classList.toggle('is-on', x===t); });
        var scope = group.getAttribute('data-tabs');
        if(!scope) return;
        $$('[data-pane-group="'+scope+'"]').forEach(function(p){
          p.hidden = (p.getAttribute('data-pane') !== t.getAttribute('data-tab'));
        });
      });
    });
  }

  /* ---------- 단일 선택 리스트 ---------- */
  function pickers(){
    $$('[data-pick]').forEach(function(list){
      list.addEventListener('click', function(e){
        var r = e.target.closest('.row, .pcard, .slot, [data-pickitem]');
        if(!r || !list.contains(r) || r.classList.contains('slot--lock')) return;
        $$('.is-on', list).forEach(function(x){ x.classList.remove('is-on'); });
        r.classList.add('is-on');
      });
    });
  }

  /* ---------- 체크박스 ---------- */
  function checks(){
    document.addEventListener('click', function(e){
      var c = e.target.closest('.check'); if(!c) return;
      c.classList.toggle('is-on');
    });
  }

  /* ---------- 원형 게이지 ---------- */
  /* <div class="gauge" data-gauge="87" data-color="var(--g-s)"> */
  function gauges(){
    $$('[data-gauge]').forEach(function(g){
      var pct = parseFloat(g.getAttribute('data-gauge')) || 0;
      var col = g.getAttribute('data-color') || 'var(--g-s)';
      var r = 44, c = 2 * Math.PI * r;
      var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 96 96');
      svg.innerHTML =
        '<circle class="gauge__track" cx="48" cy="48" r="'+r+'"/>'+
        '<circle class="gauge__val" cx="48" cy="48" r="'+r+'" stroke="'+col+'" '+
        'stroke-dasharray="0 '+c+'"/>';
      g.insertBefore(svg, g.firstChild);
      requestAnimationFrame(function(){
        svg.querySelector('.gauge__val')
           .setAttribute('stroke-dasharray', (c*pct/100)+' '+c);
      });
    });
  }

  /* ---------- 슬롯 그리드 자동 생성 ---------- */
  /* <div class="slotgrid" data-slots="30" data-icon="gem"></div> */
  var RAR = ['common','common','rare','rare','hero','legend'];
  function slots(){
    $$('[data-slots]').forEach(function(g){
      var n = +g.getAttribute('data-slots') || 0;
      var ic = (g.getAttribute('data-icon')||'gem').split(',');
      var empty = +g.getAttribute('data-empty') || 0;
      var locked = +g.getAttribute('data-lock') || 0;
      var h = '';
      for (var i=0;i<n;i++){
        if (i >= n-locked)      { h += '<div class="slot slot--lock"><svg class="ico"><use href="#i-lock"/></svg></div>'; continue; }
        if (i >= n-locked-empty){ h += '<div class="slot slot--empty"></div>'; continue; }
        var r = RAR[(i*7+3) % RAR.length];
        var name = ic[i % ic.length];
        var ct = (g.hasAttribute('data-count') && i % 3 !== 0)
          ? '<span class="slot__ct">'+((i*37)%90+4)+'</span>' : '';
        h += '<div class="slot" data-r="'+r+'"><svg class="ico"><use href="#i-'+name+'"/></svg>'+ct+'</div>';
      }
      g.innerHTML = h;
    });
  }

  /* ---------- 카운트다운 ---------- */
  /* <span data-countdown="55"> → 00:55 */
  function countdowns(){
    $$('[data-countdown]').forEach(function(el){
      var t = +el.getAttribute('data-countdown');
      (function tick(){
        var m = Math.floor(t/60), s = t%60;
        el.textContent = (m<10?'0':'')+m+' : '+(s<10?'0':'')+s;
        if (t-- > 0) setTimeout(tick, 1000);
      })();
    });
  }

  /* ---------- 진행 바 ---------- */
  /* <div class="bar" data-fill="62"> */
  function bars(){
    $$('[data-fill]').forEach(function(b){
      var f = document.createElement('i');
      f.className = 'bar__fill';
      f.style.width = '0%';
      b.appendChild(f);
      requestAnimationFrame(function(){ f.style.transition='width .9s ease'; f.style.width = b.getAttribute('data-fill')+'%'; });
    });
  }

  /* ---------- 분절 게이지 ---------- */
  /* <div class="segbar" data-seg="72"> (0~100, 12칸) */
  function segbars(){
    $$('[data-seg]').forEach(function(s){
      var v = +s.getAttribute('data-seg'), n = 12, on = Math.round(v/100*n), h='';
      for (var i=0;i<n;i++) h += '<i class="'+(i<on ? (v<30?'warn':'on') : '')+'"></i>';
      s.innerHTML = h;
    });
  }

  /* ---------- 부팅 ---------- */
  function boot(){
    tabs(); pickers(); checks(); gauges(); slots(); countdowns(); bars(); segbars();
    var embedded = (window.self !== window.top);
    if (!embedded && !document.body.hasAttribute('data-nonav')) navDock();
    fitStage();
    window.addEventListener('resize', fitStage);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.TW = { $:$, $$:$$, SCREENS:SCREENS };
})();
