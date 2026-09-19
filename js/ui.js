/* 황혼 UI — 공용 런타임
   탭 / 리스트 선택 / 원형 게이지 / 슬롯 그리드 / 화면 전환 독 / 스테이지 피팅 */
(function(){
  'use strict';

  /* ---------- 화면 목록 ---------- */
  var SCREENS = [
    ['index.html',     '타이틀'],
    ['index.html',     '메인 로비'],
    ['title.html',     '타이틀'],
    ['board.html',     '컨셉 시트 (개발)'],
    ['office.html',    '인력사무실'],
    ['quest.html',     '의뢰 상세'],
    ['party.html',     '파티 모집'],
    ['story.html',     '이야기'],
    ['characters.html','캐릭터'],
    ['inventory.html', '장비/인벤토리'],
    ['shop.html',      '보급소'],
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
  var navDockToggle = function(){};
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
    /* 터치 기기: 화면 전환 독은 개발용 → 타이틀의 '개발 메뉴' 로 켠 경우(tw:dev)에만 토글을 띄운다 */
    var DEV = false; try { DEV = localStorage.getItem('tw:dev') === '1' || /[?&]dev=1/.test(location.search); if (/[?&]dev=1/.test(location.search)) localStorage.setItem('tw:dev','1'); } catch(e){}
    if (TOUCH && !DEV){ d.style.display = 'none'; }
    navDockToggle = function(){
      var t = document.createElement('button');
      t.className = 'navdock__toggle'; t.type = 'button'; t.setAttribute('aria-label','화면 전환');
      t.innerHTML = '<svg class="ico ico--lg"><use href="#i-map"/></svg>';
      t.onclick = function(){ d.classList.toggle('is-open'); };
      document.body.appendChild(t);
    };
    if (TOUCH && DEV) navDockToggle();
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
    var b = document.createElement('a'); b.className = 'mbar__back';
    /* data-mback 은 body 에 붙이는 화면이 많다 — 둘 다 본다 (상단 나가기 버튼과 같은 곳으로) */
    b.href = main.getAttribute('data-mback') || document.body.getAttribute('data-mback') || (back ? back.getAttribute('href') : 'office.html');
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


  /* ---------- 공용 시트(모달): 상단 바의 우편 · 기록 · 설정 ----------
     저장(tw:save)·설정(tw:settings)·우편 수령(tw:mail)은 localStorage. save.js 가 없는 화면에서도 동작하도록 직접 읽고 쓴다. */
  function lsGet(k, def){ try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v === null ? def : v; } catch(e){ return def; } }
  function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  function fmt(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function sheet(title, html, cls){
    var old = $('.sheet'); if (old) old.remove();
    var o = document.createElement('div'); o.className = 'sheet' + (cls ? ' ' + cls : '');
    o.innerHTML = '<div class="sheet__box panel panel--framed"><div class="panel__head"><span class="panel__title">'+title+'</span>' +
      '<button class="iconbtn sheet__x" aria-label="닫기"><svg class="ico"><use href="#i-x"/></svg></button></div><div class="panel__body sheet__body">'+html+'</div></div>';
    document.body.appendChild(o);
    function close(){ o.classList.add('is-out'); setTimeout(function(){ o.remove(); }, 180); document.removeEventListener('keydown', esc); }
    function esc(e){ if (e.key === 'Escape') close(); }
    o.addEventListener('click', function(e){ if (e.target === o || e.target.closest('.sheet__x')) close(); });
    document.addEventListener('keydown', esc);
    if (window.TW_SFX) TW_SFX.play('ui');
    return { el:o, close:close };
  }
  var MAIL = [
    { id:'m01', from:'마태오', sub:'지하 훈련장 개방', body:'사무소 지하에 허수아비를 묶어 뒀다. 살아 있는 것처럼 굴 테니, 살아 있는 것처럼 상대해라. 준비금이다.', gold:2000 },
    { id:'m02', from:'카인 (대장간)', sub:'강화 합금 견본', body:'무기는 살아있어. 손이 기억해야, 녀석도 네게 응답하지. 합금 다섯 개 보낸다. 낫에 써 봐.', items:{ m_alloy:5 } },
    { id:'m03', from:'룩킥톤 운영', sub:'프로토타입 빌드 안내', body:'현재 빌드는 프로토타입입니다. 진행 저장은 이 기기 안에만 남습니다. 이상한 점이 보이면 디렉터에게 알려 주세요.' }
  ];
  function mailClaimed(){ return lsGet('tw:mail', []); }
  function mailUnread(){ var c = mailClaimed(); return MAIL.filter(function(m){ return c.indexOf(m.id) < 0; }).length; }
  function giveReward(m){
    var S = window.TW_SAVE ? null : lsGet('tw:save', { gold:0, xp:0, lv:1, bag:{}, flags:{}, stats:{ kills:0, runs:0 }, v:1 });
    if (m.gold){ if (window.TW_SAVE) TW_SAVE.addGold(m.gold); else S.gold = (S.gold||0) + m.gold; }
    if (m.items) Object.keys(m.items).forEach(function(id){ if (window.TW_SAVE) TW_SAVE.addItem(id, m.items[id]); else { S.bag = S.bag || {}; S.bag[id] = (S.bag[id]||0) + m.items[id]; } });
    if (S) lsSet('tw:save', S);
    var c = mailClaimed(); c.push(m.id); lsSet('tw:mail', c);
  }
  function itemName(id){ try { var T = window.TW_ITEMS; var it = T && (typeof T.byId === 'function' ? T.byId(id) : (T.byId && T.byId[id])); if (!it && T && T.MATERIAL) it = T.MATERIAL.filter(function(m){ return m.id === id; })[0]; return it ? it.name : id; } catch(e){ return id; } }
  function mailSheet(){
    var c = mailClaimed();
    var html = MAIL.map(function(m){
      var done = c.indexOf(m.id) >= 0, att = [];
      if (m.gold) att.push('<span class="sheet__att"><svg class="ico ico--xs" style="color:var(--gold-dim)"><use href="#i-coin"/></svg>'+fmt(m.gold)+'</span>');
      if (m.items) Object.keys(m.items).forEach(function(id){ att.push('<span class="sheet__att">'+itemName(id)+' ×'+m.items[id]+'</span>'); });
      return '<div class="mail'+(done?' is-done':'')+'" data-id="'+m.id+'"><div class="mail__h"><b>'+m.sub+'</b><span class="xs t-faint">'+m.from+'</span></div>' +
        '<div class="mail__b">'+m.body+(m.id==='m03'?' <span class="t-faint">(build '+(BUILD.indexOf('__')===0?'dev':BUILD)+')</span>':'')+'</div>' +
        (att.length ? '<div class="mail__f">'+att.join('')+'<button class="btn btn--sm '+(done?'btn--ghost':'btn--primary')+'" data-claim'+(done?' disabled':'')+'>'+(done?'수령 완료':'받기')+'</button></div>' : '') + '</div>';
    }).join('');
    var sh = sheet('우편함', html || '<div class="t-faint">받은 우편이 없습니다.</div>', 'sheet--mail');
    sh.el.addEventListener('click', function(e){
      var h = e.target.closest('.mail__h');
      if (h){ var row = h.closest('.mail'), open = row.classList.contains('is-open');
        sh.el.querySelectorAll('.mail.is-open').forEach(function(x){ x.classList.remove('is-open'); });
        if (!open) row.classList.add('is-open');
        return; }
      var b = e.target.closest('[data-claim]'); if (!b || b.disabled) return;
      var id = b.closest('.mail').getAttribute('data-id'), m = MAIL.filter(function(x){ return x.id === id; })[0];
      giveReward(m); b.disabled = true; b.textContent = '수령 완료'; b.classList.remove('btn--primary'); b.classList.add('btn--ghost'); b.closest('.mail').classList.add('is-done');
      mailBadge(); if (window.TW_SFX) TW_SFX.play('clear');
      var g = $('.topbar .currency .num, .sheethead .currency .num'); if (g && m.gold){ var cur = parseInt(g.textContent.replace(/[^\d]/g,''), 10) || 0; g.textContent = fmt(cur + m.gold); }
      /* 화면 스크립트(보급소 등)가 지갑·가방 표시를 다시 계산하도록 알린다 — 위의 단순 가산 뒤에 보내야 이중 반영되지 않는다 */
      try { document.dispatchEvent(new CustomEvent('tw:wallet', { detail:{ gold:m.gold||0, items:m.items||null } })); } catch(e){}
    });
  }
  function mailBadge(){
    var b = $('.iconbtn[data-sheet="mail"]'); if (!b) return;
    var dot = b.querySelector('.iconbtn__dot'); var n = mailUnread();
    if (n && !dot){ dot = document.createElement('i'); dot.className = 'iconbtn__dot'; b.appendChild(dot); } else if (!n && dot) dot.remove();
  }
  function recordsSheet(){
    var S = window.TW_SAVE ? TW_SAVE.get() : lsGet('tw:save', { gold:0, xp:0, lv:1, bag:{}, stats:{} });
    var need = Math.round(120 * Math.pow(S.lv || 1, 1.45));
    var bagN = window.TW_ITEMS ? TW_ITEMS.MATERIAL.concat(TW_ITEMS.CONSUMABLE).reduce(function(a, it){ return a + Math.max(0, it.qty || 0); }, 0) : Object.keys(S.bag || {}).reduce(function(a, k){ return a + Math.max(0, S.bag[k] || 0); }, 0);
    var st = S.stats || {};
    var arenas = []; try { for (var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if (k.indexOf('tw:arena:') === 0) arenas.push({ id:k.slice(9), r:JSON.parse(localStorage.getItem(k)) }); } } catch(e){}
    function row(k, v){ return '<div class="srow"><span class="t-faint">'+k+'</span><b class="num">'+v+'</b></div>'; }
    var wallet = window.TW_SAVE && TW_SAVE.wallet ? TW_SAVE.wallet() : 75300 + (S.gold||0);   /* 표시 지갑 = 시트 기준 자금 + 저장 골드 (save.js BASE 와 동일) */
    var html = '<div class="label-ko">아인 · 진행</div>' + row('레벨', 'Lv.'+(S.lv||1)) + row('경험치', fmt(S.xp||0)+' / '+fmt(need)) + row('골드', fmt(wallet)) + row('가방', bagN+' 개') +
      '<div class="hr"></div><div class="label-ko">전투 기록</div>' + row('처치', fmt(st.kills||0)) + row('출격', fmt(st.runs||0)) +
      '<div class="hr"></div><div class="label-ko">던전 최고 기록</div>' +
      (arenas.length ? arenas.map(function(a){ var r = a.r || {}; var t = r.time != null ? (Math.floor(r.time/60)+':'+('0'+Math.floor(r.time%60)).slice(-2)) : '-';
        return row((a.id === 'd01' ? '던전 01 · 지하 훈련장' : a.id), (r.cleared ? '클리어 · ' : '') + (r.rank ? r.rank+'등급' : '-') + ' · ' + t + (r.counterRate != null ? ' · 카운터 '+Math.round(r.counterRate*100)+'%' : '')); }).join('')
        : '<div class="xs t-faint">아직 클리어한 던전이 없습니다. 인력사무실에서 출격하세요.</div>') +
      '<div class="hr"></div><div class="xs t-faint">저장은 이 기기의 브라우저/앱 안에만 남습니다.</div>';
    sheet('기록', html, 'sheet--rec');
  }
  function settingsSheet(){
    var SET = Object.assign({ bright:1, lights:true, vib:true, sound:true, quality:'auto' }, lsGet('tw:settings', {}));
    var dev = false; try { dev = localStorage.getItem('tw:dev') === '1'; } catch(e){}
    function tog(k, lb, sub){ return '<div class="srow"><span>'+lb+(sub?'<small class="t-faint">'+sub+'</small>':'')+'</span><button class="tog'+(SET[k]?' is-on':'')+'" data-tog="'+k+'" role="switch" aria-checked="'+(!!SET[k])+'"><i></i></button></div>'; }
    var html = '<div class="label-ko">게임</div>' + tog('sound', '효과음', '전투 효과음 · 환경음') + tog('vib', '진동', '피격 · 카운터 시 진동') +
      '<div class="srow"><span>밝기<small class="t-faint">던전 화면</small></span><input type="range" min="0.7" max="1.5" step="0.05" value="'+SET.bright+'" data-rng="bright"></div>' +
      '<div class="srow"><span>화질<small class="t-faint">해상도 · 낮을수록 가볍다</small></span><span class="segs" data-seg="quality">' +
        ['low','auto','high'].map(function(q){ return '<button class="'+(SET.quality===q?'is-on':'')+'" data-q="'+q+'">'+({low:'낮음',auto:'자동',high:'높음'})[q]+'</button>'; }).join('') + '</span></div>' +
      tog('lights', '조명 효과', '벙커 등 · 그림자 (끄면 가벼워짐)') +
      '<div class="hr"></div><div class="label-ko">화면</div>' +
      '<div class="srow"><span>전체 화면</span><button class="btn btn--sm btn--ghost" data-act="fs">전환</button></div>' +
      '<div class="srow"><span>개발 메뉴<small class="t-faint">화면 전환 독 · 컨셉 보드</small></span><button class="tog'+(dev?' is-on':'')+'" data-tog="dev" role="switch" aria-checked="'+dev+'"><i></i></button></div>' +
      '<div class="hr"></div><div class="label-ko">데이터</div>' +
      '<div class="srow"><span>진행 초기화<small class="t-faint">레벨 · 골드 · 가방 · 기록</small></span><button class="btn btn--sm btn--ghost" data-act="reset" style="color:#D9544E;border-color:rgba(199,58,54,.5)">초기화</button></div>' +
      '<div class="hr"></div><div class="xs t-faint" style="line-height:1.9">황혼 · 프로토타입 · build '+(BUILD.indexOf('__')===0?'dev':BUILD)+'<br>' +
      '<a href="app/hwanghon.apk" style="color:var(--tx-dim)">Android 앱 설치 파일</a> · <a href="index.html" style="color:var(--tx-dim)">타이틀로</a></div>';
    var sh = sheet('설정', html, 'sheet--set');
    function save(){ lsSet('tw:settings', SET); if (window.TW_SFX) TW_SFX.enabled = !!SET.sound; if (window.TW_DUNGEON && TW_DUNGEON.applySettings) TW_DUNGEON.applySettings(SET); }
    sh.el.addEventListener('click', function(e){
      var t = e.target.closest('[data-tog]'); if (t){ var k = t.getAttribute('data-tog'); var on = !t.classList.contains('is-on'); t.classList.toggle('is-on', on); t.setAttribute('aria-checked', on);
        if (k === 'dev'){ try { on ? localStorage.setItem('tw:dev','1') : localStorage.removeItem('tw:dev'); } catch(e){} var d = $('.navdock'), tg = $('.navdock__toggle'); if (d) d.style.display = on ? '' : 'none'; if (tg) tg.style.display = on ? '' : 'none'; if (on && TOUCH && !tg) navDockToggle(); return; }
        SET[k] = on; save(); return; }
      var q = e.target.closest('[data-q]'); if (q){ SET.quality = q.getAttribute('data-q'); [].forEach.call(q.parentNode.children, function(b){ b.classList.toggle('is-on', b === q); }); save(); return; }
      var a = e.target.closest('[data-act]'); if (!a) return;
      if (a.getAttribute('data-act') === 'fs'){ var de = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (de.requestFullscreen) de.requestFullscreen().catch(function(){}); }
      if (a.getAttribute('data-act') === 'reset'){ if (!confirm('진행(레벨·골드·가방·기록)을 모두 지웁니다. 계속할까요?')) return;
        try { if (window.TW_SAVE) TW_SAVE.reset(); else localStorage.removeItem('tw:save'); localStorage.removeItem('tw:mail'); for (var i = localStorage.length-1; i >= 0; i--){ var k = localStorage.key(i); if (k.indexOf('tw:arena:') === 0) localStorage.removeItem(k); } } catch(e){}
        sh.close(); location.reload(); }
    });
    sh.el.addEventListener('input', function(e){ var r = e.target.closest('[data-rng]'); if (r){ SET[r.getAttribute('data-rng')] = parseFloat(r.value); save(); } });
  }
  /* 상단 바 나가기 버튼: body[data-mback] 을 선언한 화면에 «데스크톱에서도» 붙인다.
     휴대폰은 하단 행동 바(mbar)가 뒤로를 맡지만, 그건 mobileLayout 에서만 만들어져서
     데스크톱에서는 나갈 길이 아예 없었다 (이야기 화면이 그랬다). */
  function backButton(){
    var to = document.body.getAttribute('data-mback'); if (!to) return;
    var tb = $('.topbar'); if (!tb || $('.topbar__back')) return;
    var a = document.createElement('a'); a.className = 'iconbtn topbar__back'; a.href = to; a.title = '나가기';
    a.innerHTML = '<svg class="ico ico--lg"><use href="#i-arrowl"/></svg>';
    tb.insertBefore(a, tb.firstChild);
  }

  function bindTopbar(){
    var map = { 'i-mail':mailSheet, 'i-book':recordsSheet, 'i-gear':settingsSheet };
    $$('.topbar .iconbtn, .sheethead .iconbtn, .bmhead .iconbtn').forEach(function(b){
      var u = b.querySelector('use'); var k = u && (u.getAttribute('href') || '').slice(1); if (!map[k] || b.getAttribute('data-bound')) return;
      b.setAttribute('data-bound', '1'); b.setAttribute('data-sheet', k.slice(2)); if (!b.title) b.title = { 'i-mail':'우편', 'i-book':'기록', 'i-gear':'설정' }[k];
      b.addEventListener('click', function(){ map[k](); });
    });
    mailBadge();
  }
  /* ---------- 부팅 ---------- */
  function boot(){
    tabs(); pickers(); checks(); gauges(); slots(); countdowns(); bars(); segbars();
    var embedded = (window.self !== window.top);
    if (!embedded && !document.body.hasAttribute('data-nonav')) navDock();
    if (!embedded) rotateHint();
    if (!embedded) mobileLayout();
    if (!embedded) swUpdates();
    bindTopbar(); backButton();
    fitStage();
    window.addEventListener('resize', fitStage);
    window.addEventListener('orientationchange', function(){ setTimeout(fitStage, 120); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fitStage);
    /* 터치 기기: 더블탭 확대 방지 (touch-action 은 CSS 에서) · 마지막 화면 기억 */
    try { localStorage.setItem('tw:last', location.pathname.split('/').pop()); } catch(e){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.TW = { $:$, $$:$$, SCREENS:SCREENS, BUILD:(BUILD.indexOf('__')===0?'dev':BUILD), sheet:sheet, mail:mailSheet, records:recordsSheet, settings:settingsSheet };
})();
