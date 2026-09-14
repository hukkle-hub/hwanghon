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

  var TOUCH = !!(window.matchMedia && (matchMedia('(pointer:coarse)').matches || matchMedia('(hover:none)').matches));
  if (TOUCH) document.documentElement.classList.add('touch');
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
    d.querySelector('.navdock__hide').onclick = function(){ d.classList.remove('is-open'); d.style.display = TOUCH ? '' : 'none'; };
    /* 터치 기기: 독은 접어두고 우하단 버튼으로 연다 (하단 내비를 가리지 않도록) */
    if (TOUCH){
      var t = document.createElement('button');
      t.className = 'navdock__toggle'; t.type = 'button'; t.setAttribute('aria-label','화면 전환');
      t.innerHTML = '<svg class="ico ico--lg"><use href="#i-map"/></svg>';
      t.onclick = function(){ d.classList.toggle('is-open'); };
      document.body.appendChild(t);
    }
    document.addEventListener('keydown', function(e){
      if (e.key === 'h' || e.key === 'H') d.style.display = d.style.display==='none' ? '' : 'none';
    });
  }

  /* ---------- 스테이지 피팅 (1672×952 기준) ----------
     · 데스크톱: 폭 기준 축소 (세로 스크롤 허용)
     · 터치 기기(안드로이드 등): 폭·높이 모두 맞춰(contain) 한 화면에 들어오게, 가로 중앙 정렬
     · 세로로 든 휴대폰: 가로 회전 안내를 띄우고 폭 기준으로만 축소 */

  function viewport(){
    var vv = window.visualViewport;
    return { w: vv ? vv.width : window.innerWidth, h: vv ? vv.height : window.innerHeight };
  }
  function fitStage(){
    var st = $('.stage'); if(!st) return;
    var v = viewport(), base = 1672, baseH = st.offsetHeight || 952;
    var portrait = v.h > v.w;
    var k = Math.min(1, (v.w - (TOUCH ? 0 : 8)) / base);
    if (TOUCH && !portrait) k = Math.min(k, v.h / baseH);
    k = Math.max(k, 0.18);
    st.style.transform = 'scale(' + k + ')';
    st.style.transformOrigin = 'top left';
    var left = Math.max(0, (v.w - base * k) / 2);
    st.style.marginLeft = left + 'px';
    document.body.style.height = (baseH * k + (TOUCH ? 0 : 16)) + 'px';
    document.body.style.overflowX = 'hidden';
    document.documentElement.classList.toggle('portrait', TOUCH && portrait);
  }
  /* 세로 화면 안내 (터치 기기) */
  function rotateHint(){
    if (!TOUCH || document.body.hasAttribute('data-nonav')) return;
    var h = document.createElement('div');
    h.className = 'rotate-hint';
    h.innerHTML = '<svg class="ico ico--xl"><use href="#i-refresh"/></svg><b>가로로 돌려 주세요</b><span>황혼은 가로 화면 기준으로 설계되었습니다.</span><button type="button">이대로 보기</button>';
    h.querySelector('button').onclick = function(){ document.documentElement.classList.add('portrait-ok'); };
    document.body.appendChild(h);
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
    if (!embedded) rotateHint();
    fitStage();
    window.addEventListener('resize', fitStage);
    window.addEventListener('orientationchange', function(){ setTimeout(fitStage, 120); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fitStage);
    /* 터치 기기: 더블탭 확대 방지 (touch-action 은 CSS 에서) · 마지막 화면 기억 */
    try { localStorage.setItem('tw:last', location.pathname.split('/').pop()); } catch(e){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.TW = { $:$, $$:$$, SCREENS:SCREENS };
})();
