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
    ['game3d.html',    '던전 01 (3D)'],
    ['game.html',      '던전 01 (2D판)'],
    ['viewer.html',    '3D 뷰어'],
    ['dungeon.html',   '던전 (캔버스판)'],
    ['arena.html',     '훈련 연습'],
    ['battle.html',    '전투 HUD'],
    ['result.html',    '전투 결과'],
    ['benchmark.html', '벤치마크'],
    ['compare.html',   '시트 대조']
  ];

  var TOUCH = !!(window.matchMedia && (matchMedia('(pointer:coarse)').matches || matchMedia('(hover:none)').matches));
  if (TOUCH) document.documentElement.classList.add('touch');
  /* 휴대폰 판정: 터치 기기이면서 짧은 변이 640 CSS px 이하 (태블릿은 축소 스테이지 유지) */
  var MOBILE = TOUCH && Math.min(window.innerWidth, window.innerHeight) <= 640 && !document.body.hasAttribute('data-nomobile');
  if (MOBILE) document.documentElement.classList.add('mobile');
  var $  = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

  /* ---------- 화면 전환 독 ---------- */
  function navDock(){
    var here = (location.pathname.split('/').pop() || 'index.html');
    var d = document.createElement('nav');
    d.className = 'navdock';
    d.innerHTML = SCREENS.map(function(s){
      return '<a href="'+s[0]+'"'+(s[0]===here?' class="is-on"':'')+'>'+s[1]+'</a>';
    }).join('') + '<span class="navdock__build" title="배포 빌드">'+(BUILD.indexOf('__')===0?'dev':BUILD)+'</span><button class="navdock__hide" title="숨기기 (H)">&times;</button>';
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
    if (MOBILE){ /* 네이티브 레이아웃 — 축소하지 않는다 */
      st.style.transform=''; st.style.marginLeft=''; document.body.style.height='';
      document.documentElement.classList.toggle('portrait', window.innerHeight > window.innerWidth);
      return;
    }
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
    if (MOBILE && !document.body.hasAttribute('data-landscape')) return;   /* 휴대폰은 세로도 지원 — HUD 화면만 안내 */
    if (document.body.hasAttribute('data-landscape')) document.documentElement.setAttribute('data-landscape','');
    var h = document.createElement('div');
    h.className = 'rotate-hint';
    h.innerHTML = '<svg class="ico ico--xl"><use href="#i-refresh"/></svg><b>가로로 돌려 주세요</b><span>황혼은 가로 화면 기준으로 설계되었습니다.</span><button type="button">이대로 보기</button>';
    h.querySelector('button').onclick = function(){ document.documentElement.classList.add('portrait-ok'); };
    document.body.appendChild(h);
  }

  /* ---------- 휴대폰 레이아웃: 패널 탭 + 하단 행동 바 ----------
     main 의 직계 자식이 패널이 된다. data-mpane="라벨" 로 이름을 붙이고, 같은 라벨이 이어지면 한 패널로 합친다.
     main[data-mdefault] 가 처음 열릴 패널. [data-primary] 는 하단 바로 이동. [data-mgoto="라벨"] 안을 누르면 그 패널로 이동. */
  function mobileLayout(){
    if (!MOBILE) return;
    var main = $('main'); if (!main) return;
    var panes = [], last = null;
    [].slice.call(main.children).forEach(function(el){
      var lb = el.getAttribute('data-mpane');
      if (!lb){ var t = el.querySelector('.panel__title, .bmp__t, .label-ko, h2, h3'); lb = t ? t.textContent.trim() : ('패널 '+(panes.length+1)); }
      var found = null; panes.forEach(function(p){ if (p.label === lb) found = p; });
      if (found){ found.wrap.appendChild(el); last = found; return; }   /* 같은 라벨은 떨어져 있어도 한 패널로 */
      var wrap = document.createElement('div'); wrap.className = 'mpane'; wrap.setAttribute('data-label', lb);
      main.appendChild(wrap); wrap.appendChild(el);
      last = { label: lb, wrap: wrap }; panes.push(last);
    });
    if (!panes.length) return;
    var tabs = document.createElement('div'); tabs.className = 'mtabs'; tabs.setAttribute('role','tablist');
    tabs.innerHTML = panes.map(function(p){ return '<button type="button" role="tab" data-label="'+p.label+'">'+p.label+'</button>'; }).join('');
    function activate(lb){
      panes.forEach(function(p){ p.wrap.classList.toggle('is-active', p.label === lb); });
      [].forEach.call(tabs.children, function(b){ b.classList.toggle('is-on', b.getAttribute('data-label') === lb); });
      var on = tabs.querySelector('.is-on'); if (on && on.scrollIntoView) on.scrollIntoView({ block:'nearest', inline:'center' });
      try { sessionStorage.setItem('tw:pane:'+location.pathname.split('/').pop(), lb); } catch(e){}
    }
    tabs.addEventListener('click', function(e){ var b = e.target.closest('[data-label]'); if (b) activate(b.getAttribute('data-label')); });
    var tb = $('.topbar') || $('.sheethead') || $('.bmhead');
    if (tb){ tb.classList.add('has-mtabs'); tb.insertBefore(tabs, tb.querySelector('.topbar__spacer, .sheethead__r, .principles')); }
    else { /* 상단 바가 없는 화면(컨셉 시트): 제목 + 패널 탭으로 된 압축 상단 바를 만든다 */
      var hb = document.createElement('header'); hb.className = 'topbar topbar--m has-mtabs';
      var h1 = document.querySelector('main h1'); var ttl = h1 ? h1.textContent.trim() : document.title.split('—')[0].trim();
      hb.innerHTML = '<svg class="topbar__sigil"><use href="#i-sigil"/></svg><div><div class="topbar__title">'+ttl+'</div></div>';
      hb.appendChild(tabs); main.parentNode.insertBefore(hb, main);
    }
    /* 캡처 단계: 화면 스크립트가 목록을 재렌더해 e.target 이 떨어져 나가기 전에 조상을 읽는다 */
    document.addEventListener('click', function(e){
      var g = e.target.closest ? e.target.closest('[data-mgoto]') : null; if (!g) return;
      var lb = g.getAttribute('data-mgoto');
      if (panes.some(function(p){ return p.label === lb; })) setTimeout(function(){ activate(lb); }, 80);
    }, true);
    var def = main.getAttribute('data-mdefault'); var saved = null;
    try { saved = sessionStorage.getItem('tw:pane:'+location.pathname.split('/').pop()); } catch(e){}
    var has = function(lb){ return lb && panes.some(function(p){ return p.label === lb; }); };
    activate(has(saved) ? saved : has(def) ? def : panes[Math.min(1, panes.length-1)].label);

    /* 하단 행동 바: 뒤로 + 주 행동 */
    var prim = $('[data-primary]');
    var back = $('.hotbar a[href], .backbar a[href], .gnb a[href]');
    var bar = document.createElement('div'); bar.className = 'mbar';
    var b = document.createElement('a'); b.className = 'mbar__back'; b.href = back ? back.getAttribute('href') : 'index.html';
    b.innerHTML = '<svg class="ico"><use href="#i-arrowl"/></svg>뒤로'; bar.appendChild(b);
    if (prim){ prim.classList.add('mbar__primary'); bar.appendChild(prim); }
    document.body.appendChild(bar);
    document.documentElement.classList.add('has-mbar');
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
        var r = e.target.closest('.row, .pcard, .mcard, .slot, [data-pickitem]');
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


  /* ---------- 서버 업데이트 반영 ----------
     1) 새 서비스워커가 활성화되면 워커가 화면을 직접 다시 불러온다(sw.js). 메시지(TW_UPDATED)로 올 때는 빌드가 다를 때만 새로고침
     2) 접속·앱 복귀 때마다 서버의 version.json 을 읽어 빌드가 다르면 워커 갱신 → 새 워커가 없으면 스스로 새로고침 (1회 보호) */
  var BUILD = '__BUILD__';
  var MYBUILD = BUILD.indexOf('__') === 0 ? 'dev' : BUILD;
  function reloadOnce(tag){
    var key = 'tw:reloaded:' + tag; try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch(err){}
    location.reload();
  }
  function swUpdates(){
    if (location.protocol.indexOf('http') !== 0) return;
    var hasSW = 'serviceWorker' in navigator;
    if (hasSW) navigator.serviceWorker.addEventListener('message', function(e){
      if (!e.data || e.data.type !== 'TW_UPDATED') return;
      if (e.data.version === 'tw-' + MYBUILD) return;
      reloadOnce(e.data.version);
    });
    function check(){
      fetch('version.json?t=' + Date.now(), {cache:'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(v){
        if (!v || !v.build || v.build === MYBUILD || MYBUILD === 'dev') return;
        if (hasSW) navigator.serviceWorker.getRegistration().then(function(r){
          if (r) r.update().catch(function(){});
          setTimeout(function(){ reloadOnce(v.build); }, 2500);   /* 워커가 먼저 재로드하면 이 타이머는 실행되지 않는다 */
        }); else reloadOnce(v.build);
      }).catch(function(){});
    }
    document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible') check(); });
    check();
  }

  /* ---------- 부팅 ---------- */
  function boot(){
    tabs(); pickers(); checks(); gauges(); slots(); countdowns(); bars(); segbars();
    var embedded = (window.self !== window.top);
    if (!embedded && !document.body.hasAttribute('data-nonav')) navDock();
    if (!embedded) rotateHint();
    if (!embedded) mobileLayout();
    if (!embedded) swUpdates();
    fitStage();
    window.addEventListener('resize', fitStage);
    window.addEventListener('orientationchange', function(){ setTimeout(fitStage, 120); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fitStage);
    /* 터치 기기: 더블탭 확대 방지 (touch-action 은 CSS 에서) · 마지막 화면 기억 */
    try { localStorage.setItem('tw:last', location.pathname.split('/').pop()); } catch(e){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.TW = { $:$, $$:$$, SCREENS:SCREENS, BUILD:(BUILD.indexOf('__')===0?'dev':BUILD) };
})();
