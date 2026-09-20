/* 황혼 — 뒤로 가기 (공용). 어느 화면에 넣어도 «나가는 길» 이 생긴다 (docs/design/37).

   왜 따로 두나: ui.js 의 backButton() 은 «.topbar 가 있는 화면» 만 챙겼다.
   그런데 협동 출격·로비처럼 제 헤더를 쓰는 화면은 .topbar 가 없어서
   안드로이드 시스템 뒤로 말고는 나갈 길이 아예 없었다 (디렉터가 짚은 것).

   규약: body[data-mback="돌아갈 곳"] 한 줄. 없으면 아무것도 하지 않는다.
   · .topbar 가 있으면 그 맨 앞에 아이콘 단추로 넣는다 (기존 모양 그대로)
   · 없으면 왼쪽 위에 떠 있는 단추를 만든다 (안전 영역을 피해서)
   · 휴대폰 하단 행동 바(mbar)는 ui.js 가 따로 만든다 — 겹치지 않게 한 쪽만 남긴다 */
(function(){
  if (window.TW_BACK) return;
  function make(){
    /* main 에 붙인 화면도 있다 (인력사무실) — ui.js 의 하단 바와 같은 자리를 본다 */
    var mn = document.querySelector('main');
    var to = document.body.getAttribute('data-mback') || (mn && mn.getAttribute('data-mback'));
    if (!to) return null;
    if (document.querySelector('.topbar__back, .backfab')) return null;   /* 이미 있다 */

    var tb = document.querySelector('.topbar');
    if (tb){
      var a = document.createElement('a');
      a.className = 'iconbtn topbar__back'; a.href = to; a.title = '나가기';
      a.setAttribute('aria-label','나가기');
      a.innerHTML = '<svg class="ico ico--lg"><use href="#i-arrowl"/></svg>';
      tb.insertBefore(a, tb.firstChild);
      return a;
    }
    /* 헤더가 제각각인 화면 — 글자 단추. 아이콘 묶음이 없을 수도 있어 «‹ 뒤로» 로 그린다 */
    var b = document.createElement('a');
    b.className = 'backfab'; b.href = to; b.title = '나가기';
    b.setAttribute('aria-label','나가기');
    b.innerHTML = '<span aria-hidden="true">\u2039</span> 뒤로';

    /* 제 헤더를 쓰는 화면(협동 출격)은 그 헤더 «안» 에 넣는다.
       띄워 두면 제목 위에 겹친다 — 실제로 «황 혼» 글자를 가렸다. */
    var hd = document.querySelector('main > header, body > header, header');
    if (hd && hd.getBoundingClientRect().top < 120){
      b.className = 'backfab backfab--inline';
      b.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-right:14px;'+
        'min-height:40px;padding:0 14px 0 11px;box-sizing:border-box;flex:none;'+
        'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);'+
        'color:#c8c2b6;font-size:13px;letter-spacing:.04em;text-decoration:none;line-height:1;';
      b.firstChild.style.cssText = 'font-size:18px;line-height:1;color:#C9A24B;';
      hd.insertBefore(b, hd.firstChild);
      return b;
    }
    /* css/ui.css 를 안 읽는 화면(협동 출격)이 있다 — 최소한의 모양은 여기서 준다.
       안 그러면 높이 19px 짜리 글자 링크가 된다(실제로 그랬다). ui.css 가 있으면 그쪽이 다듬는다. */
    b.style.cssText = 'position:fixed;z-index:60;display:inline-flex;align-items:center;gap:6px;'+
      'left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top));'+
      'min-height:44px;padding:0 16px 0 13px;box-sizing:border-box;'+
      'background:rgba(8,9,12,.82);border:1px solid rgba(255,255,255,.16);'+
      'color:#c8c2b6;font-size:13px;letter-spacing:.04em;text-decoration:none;line-height:1;';
    b.firstChild.style.cssText = 'font-size:18px;line-height:1;color:#C9A24B;';
    document.body.appendChild(b);
    return b;
  }
  function run(){ try{ make(); }catch(e){} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  window.TW_BACK = { make: make };
})();
