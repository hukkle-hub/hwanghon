/* 황혼 — 운영 도구 (신고 처리 · 제재 · 서버 공지)
   server/rpg-server.cjs 의 운영 명령을 그대로 쓴다. 전부 ADMIN_IDS 로 걸려 있다.
     rpg adminState                       신고 50 · 운영 기록 50 · 거래 50 · 현재 공지
     rpg adminFind   {name}               캐릭터 이름 → 계정 · 현재 제재
     rpg moderate    {operation,target,minutes,reason}
                     mute | ban | lift    target = 플레이어 id
                     resolve              target = 신고 번호
     rpg announcement {text}              접속한 모두에게 한 번
   운영자가 아니면 화면은 «권한 없음» 한 장만 보여 준다 — 서버가 어차피 거절하지만
   못 쓰는 단추를 늘어놓지 않는다. 쉘터·파티 모집과 같은 접속 키를 쓴다. */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);};

  /* ── 서버 주소 · 접속 키: 쉘터와 동일 ── */
  var params=new URLSearchParams(location.search), sp=params.get('server');
  if(sp!==null){try{ sp?localStorage.setItem('tw:party-server',sp):localStorage.removeItem('tw:party-server'); }catch(e){}}
  function partyServer(){
    var v=''; try{ v=sp||localStorage.getItem('tw:party-server')||''; }catch(e){ v=sp||''; }
    if(!v) return {host:location.host, origin:location.origin, remote:false};
    var u; try{ u=new URL(/^(https?|wss?):\/\//.test(v)?v.replace(/^ws/,'http'):'https://'+v); }
    catch(e){ return {host:location.host, origin:location.origin, remote:false}; }
    return {host:u.host, origin:u.origin, remote:u.host!==location.host};
  }
  var server=partyServer(), tokenKey='tw:party-token:'+server.host;
  var store={get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},
             set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}}};

  var socket,seq=0,connected=false,stopped=false,retry;
  var profile=null,admin=null,isAdmin=false,data=null;
  var filter='open',logTab='audit',pick=null,found=null;

  function state(text,bad){ var el=$('ad-state'); el.textContent=text||''; el.classList.toggle('is-bad',!!bad); }
  function send(msg){ if(!connected||!socket||socket.readyState!==1) return false;
    socket.send(JSON.stringify(Object.assign({},msg,{seq:++seq}))); return true; }
  function rpg(action,fields){ return send(Object.assign({type:'rpg',action:action},fields||{})); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  var fmt=function(n){ return Number(n||0).toLocaleString(); };
  function when(ms){ if(!ms) return '';
    var d=new Date(ms), p=function(n){ return (n<10?'0':'')+n; };
    return p(d.getMonth()+1)+'.'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
  /* 남은 제재 시간을 «분» 이 아니라 사람이 읽는 단위로 */
  function left(until){
    var ms=until-Date.now(); if(ms<=0) return '';
    var m=Math.ceil(ms/60000);
    if(m<60) return m+'분';
    if(m<1440) return Math.floor(m/60)+'시간 '+(m%60?(m%60)+'분':'');
    return Math.floor(m/1440)+'일 '+(Math.floor(m/60)%24?(Math.floor(m/60)%24)+'시간':'');
  }

  /* ── 권한 없음 ── */
  function gate(){
    var why=!connected?'파티 서버에 접속하지 않았습니다.'
      :!profile?'접속을 기다리는 중입니다.'
      :'이 계정에는 운영 권한이 없습니다.';
    $('ad-reports').innerHTML='<div class="nogate"><div class="nogate__t">운영 도구</div>'+
      '<div class="nogate__s">'+esc(why)+'</div></div>';
    $('ad-detail').innerHTML='<div class="nogate"><div class="nogate__t">권한이 필요합니다</div>'+
      '<div class="nogate__s">운영자는 서버의 <code>ADMIN_IDS</code> 환경변수로 지정합니다.<br>'+
      '쉼표로 구분한 플레이어 id 목록입니다.'+
      (profile?'<br><br>내 id <code>'+esc(profile.id)+'</code>':'')+'</div></div>';
    $('ad-log').innerHTML=''; $('ad-rcount').textContent='—'; $('ad-lcount').textContent='—';
    $('ad-notice').disabled=true; $('ad-post').disabled=true; $('ad-clear').disabled=true;
  }

  /* ── 신고 목록 ── */
  function reports(){
    var box=$('ad-reports'), all=(admin&&admin.reports)||[];
    var rows=all.filter(function(r){
      return filter==='all'||(filter==='open'?r.status!=='resolved':r.status==='resolved'); });
    var open=all.filter(function(r){ return r.status!=='resolved'; }).length;
    $('ad-rcount').textContent=open?('미처리 '+open+' / '+all.length):(all.length+'건');
    if(!rows.length){ box.innerHTML='<div class="chat__empty">'+
      (all.length?'이 상태의 신고가 없습니다.':'접수된 신고가 없습니다.')+'</div>'; return; }
    box.innerHTML=rows.map(function(r){
      var done=r.status==='resolved';
      return '<div class="rprow'+(pick&&pick.id===r.id?' is-on':'')+(done?' is-done':'')+'" data-r="'+r.id+'">'+
        '<span class="rprow__n">#'+r.id+'</span>'+
        '<div class="fill"><div class="rprow__t">'+esc(r.targetName||r.target)+'</div>'+
        '<div class="rprow__s">'+esc(r.reason)+' · '+when(r.created)+'</div></div>'+
        '<span class="rprow__st'+(done?' rprow__st--done':'')+'">'+(done?'완료':'미처리')+'</span></div>';
    }).join('');
  }

  /* ── 처리 ── */
  var MIN=[['10','10분'],['60','1시간'],['360','6시간'],['1440','1일'],['10080','7일'],['43200','30일']];
  function sanctionLine(s){
    if(!s) return '';
    var ban=left(s.ban||0), mute=left(s.mute||0);
    if(!ban&&!mute) return '<div class="sanc sanc--ok"><span>현재 제재</span><b>없음</b></div>';
    return '<div class="sanc"><span>현재 제재</span>'+
      (ban?'<b>접속 제한 '+ban+' 남음</b>':'')+(ban&&mute?' · ':'')+
      (mute?'<b>채팅 제한 '+mute+' 남음</b>':'')+
      (s.reason?'<span class="xs t-faint" style="margin-left:auto">'+esc(s.reason)+'</span>':'')+'</div>';
  }
  function detail(){
    var box=$('ad-detail');
    var t=pick?{id:pick.target,name:pick.targetName||pick.target,sanction:pick.sanction}
           :found?{id:found.id,name:found.name,sanction:found.sanction}:null;
    $('ad-who').textContent=t?t.name:'대상 없음';
    $('ad-when').textContent=pick?('신고 #'+pick.id+' · '+when(pick.created)):found?'이름으로 찾음':'';
    $('ad-pid').textContent=t?t.id:'';

    var find='<div class="label-ko">캐릭터로 찾기</div>'+
      '<div class="adrow"><div class="field"><input id="ad-find" maxlength="16" placeholder="캐릭터 이름"></div>'+
      '<button type="button" class="btn btn--sm" id="ad-findbtn">찾기</button></div>';
    if(!t){ box.innerHTML=find+'<div class="hr"></div>'+
      '<div class="chat__empty">왼쪽에서 신고를 고르거나, 위에서 이름으로 찾으세요.</div>'; bindFind(); return; }

    box.innerHTML=find+'<div class="hr"></div>'+
      (pick?'<div class="label-ko">신고 내용</div>'+
        '<div class="sm t-dim">'+esc(pick.reason)+' · 신고자 '+esc(pick.reporterName||pick.reporter)+'</div>'+
        (pick.evidence?'<p class="quote">'+esc(pick.evidence)+'</p>'
                      :'<p class="xs t-faint mt2">첨부된 대화가 없습니다.</p>')+
        '<div class="hr"></div>':'')+
      sanctionLine(t.sanction)+
      '<div class="label-ko mt3">제재</div>'+
      '<div class="adrow"><span class="adrow__k">기간</span>'+
        '<div class="field"><select id="ad-min">'+MIN.map(function(m,i){
          return '<option value="'+m[0]+'"'+(i===1?' selected':'')+'>'+m[1]+'</option>'; }).join('')+
        '</select></div></div>'+
      '<div class="adrow"><span class="adrow__k">사유</span>'+
        '<div class="field"><input id="ad-reason" maxlength="240" value="'+
        esc(pick?pick.reason:'')+'" placeholder="기록에 남습니다"></div></div>'+
      '<div class="adacts">'+
        '<button type="button" class="btn btn--sm" data-op="mute">채팅 제한</button>'+
        '<button type="button" class="btn btn--sm btn--danger" data-op="ban">접속 제한</button>'+
        '<button type="button" class="btn btn--sm" data-op="lift">제재 해제</button>'+
        '<button type="button" class="btn btn--sm'+(pick?' btn--primary':'')+'" data-op="resolve"'+
          (pick?'':' disabled')+'>검토 완료</button>'+
      '</div>'+
      '<div class="xs t-faint mt3">접속 제한은 지금 붙어 있는 연결도 끊습니다. 모든 조작은 운영 기록에 남습니다.</div>';
    bindFind();
  }
  function bindFind(){
    var b=$('ad-findbtn'), i=$('ad-find'); if(!b) return;
    b.onclick=function(){ var n=(i.value||'').trim();
      if(!n){ state('캐릭터 이름을 입력하세요.',true); return; }
      if(!rpg('adminFind',{name:n})) state('접속한 뒤 이용할 수 있습니다.',true); };
    i.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); b.click(); } });
  }

  /* ── 기록 ── */
  function logs(){
    var box=$('ad-log'), rows;
    if(logTab==='audit'){
      rows=((admin&&admin.audit)||[]).map(function(r){
        var d=''; try{ var o=JSON.parse(r.detail); d=o&&Object.keys(o).length?JSON.stringify(o):''; }catch(e){ d=r.detail||''; }
        return '<div class="logrow"><time>'+when(r.created)+'</time>'+
          '<b>'+esc(r.actorName||r.actor)+'</b>'+
          '<span>'+esc(r.action)+(r.target?' → '+esc(r.targetName||String(r.target).slice(0,12)):'')+
          (d?' <span class="t-ghost">'+esc(d).slice(0,80)+'</span>':'')+'</span></div>'; });
    } else {
      var T=window.TW_ITEMS;
      rows=((admin&&admin.trades)||[]).map(function(r){
        var it=T&&T.get?T.get(r.item):null;
        return '<div class="logrow"><time>'+when(r.created)+'</time>'+
          '<b>'+esc(r.sellerName||r.seller)+'</b>'+
          '<span>'+esc((it&&it.name)||r.item)+' ×'+r.quantity+' · '+fmt(r.total)+' G → '+
          esc(r.buyerName||r.buyer)+'</span></div>'; });
    }
    $('ad-lcount').textContent=rows.length+'건';
    box.innerHTML=rows.length?rows.join(''):'<div class="chat__empty">기록이 없습니다.</div>';
  }

  function render(){
    if(!isAdmin){ gate(); return; }
    $('ad-notice').disabled=false; $('ad-post').disabled=false; $('ad-clear').disabled=false;
    reports(); detail(); logs();
  }

  /* ── 접속 ── */
  function connect(){
    if(socket&&(socket.readyState===0||socket.readyState===1)) return;
    stopped=false; clearTimeout(retry);
    if(!/^https?:$/.test(location.protocol)){ state('파티 서버 주소에서 이 화면을 열어 주세요.',true); return; }
    var scheme=(server.remote?server.origin.indexOf('https')===0:location.protocol==='https:')?'wss:':'ws:';
    state('접속 중…');
    try{ socket=new WebSocket(scheme+'//'+server.host+'/party-socket'); }
    catch(e){ state('파티 서버에 연결할 수 없습니다.',true); return; }
    socket.addEventListener('open',function(){ seq=0;
      socket.send(JSON.stringify({type:'hello',token:store.get(tokenKey),name:'아인'})); });
    socket.addEventListener('message',function(e){
      var msg; try{ msg=JSON.parse(e.data); }catch(err){ return; }
      if(msg.type==='welcome'){ connected=true; profile=msg.profile; store.set(tokenKey,msg.token);
        state('접속했습니다.'); render(); return; }
      if(msg.type==='board'){ $('ad-online').textContent='접속 '+(msg.online||0)+' / '+(msg.capacity||100); return; }
      if(msg.type==='rpg'){ if(msg.data&&typeof msg.data.admin==='boolean'){
          var was=isAdmin; isAdmin=msg.data.admin;
          if(isAdmin&&!was) setTimeout(function(){ rpg('adminState'); },260);  /* rpg 명령은 120ms 간격 제한 */
          render(); }
        return; }
      if(msg.type==='adminState'){ admin=msg;
        if(typeof msg.announcement==='string'&&document.activeElement!==$('ad-notice'))
          $('ad-notice').value=msg.announcement;
        /* 고른 신고를 새 목록에서 다시 집는다 — 처리 후에도 선택이 유지되게 */
        if(pick) pick=(msg.reports||[]).filter(function(r){ return r.id===pick.id; })[0]||null;
        render(); return; }
      if(msg.type==='adminFind'){ found=msg.player; pick=null; detail(); reports();
        state(found.name+' 님을 찾았습니다.'); return; }
      if(msg.type==='rpgNotice'){ state(msg.text); return; }
      if(msg.type==='error'){ state(msg.message,true); if(!connected){ stopped=true; socket.close(); } }
    });
    socket.addEventListener('close',function(){ connected=false; $('ad-online').textContent='연결 끊김';
      if(!stopped&&profile){ state('연결을 복구하고 있습니다…'); retry=setTimeout(connect,1500); }
      else if(!profile&&!stopped){ state('파티 서버에 연결할 수 없습니다. 서버를 실행한 주소로 열거나 ?server=주소 를 붙이세요.',true); gate(); } });
    socket.addEventListener('error',function(){ if(!connected)
      state('파티 서버에 연결할 수 없습니다.',true); });
  }

  /* ── 조작 ── */
  $('ad-filter').addEventListener('click',function(e){
    var b=e.target.closest('[data-f]'); if(!b) return;
    filter=b.dataset.f;
    [].forEach.call(this.querySelectorAll('.tab'),function(t){ t.classList.toggle('is-on',t.dataset.f===filter); });
    reports(); });
  $('ad-logtab').addEventListener('click',function(e){
    var b=e.target.closest('[data-l]'); if(!b) return;
    logTab=b.dataset.l;
    [].forEach.call(this.querySelectorAll('.tab'),function(t){ t.classList.toggle('is-on',t.dataset.l===logTab); });
    logs(); });
  $('ad-reports').addEventListener('click',function(e){
    var r=e.target.closest('[data-r]'); if(!r) return;
    var id=Number(r.dataset.r);
    pick=((admin&&admin.reports)||[]).filter(function(x){ return x.id===id; })[0]||null;
    found=null; reports(); detail(); });
  $('ad-detail').addEventListener('click',function(e){
    var b=e.target.closest('[data-op]'); if(!b||b.disabled) return;
    var op=b.dataset.op;
    var target=pick?pick.target:found?found.id:null;
    var reason=($('ad-reason')&&$('ad-reason').value||'').trim();
    if(op==='resolve'){
      if(!pick){ state('신고를 골라야 검토 완료를 누를 수 있습니다.',true); return; }
      act({operation:'resolve',target:String(pick.id),minutes:1,reason:'reviewed'},'#'+pick.id+' 검토 완료'); return; }
    if(!target){ state('대상을 먼저 고르세요.',true); return; }
    if(!reason){ state('사유를 적어 주세요 — 기록에 남습니다.',true); return; }
    var minutes=Number($('ad-min').value)||60;
    var label={mute:'채팅 제한',ban:'접속 제한',lift:'제재 해제'}[op];
    var who=pick?(pick.targetName||pick.target):found.name;
    var text=op==='lift'?(who+' 님의 제재를 해제합니다.')
      :(who+' 님에게 '+label+' '+(MIN.filter(function(m){return m[0]===String(minutes);})[0]||['',minutes+'분'])[1]+'. 계속할까요?');
    if(!confirm(text)) return;
    act({operation:op,target:target,minutes:op==='lift'?1:minutes,reason:reason},who+' — '+label);
  });
  function act(fields,done){
    if(!rpg('moderate',fields)){ state('접속한 뒤 이용할 수 있습니다.',true); return; }
    state(done+' 처리를 보냈습니다.');
    /* moderate 응답은 adminState 다. 120ms 간격 제한이 있어 한 박자 뒤에 새로 받는다. */
    setTimeout(function(){ rpg('adminState'); if(found) rpg2Find(); },300);
  }
  function rpg2Find(){ setTimeout(function(){ if(found) rpg('adminFind',{name:found.name}); },300); }
  $('ad-reload').onclick=function(){
    if(rpg('adminState')) state('기록을 새로 받았습니다.');
    else state('접속한 뒤 이용할 수 있습니다.',true); };
  $('ad-post').onclick=function(){
    var t=$('ad-notice').value.trim();
    if(!t){ state('공지 내용을 적어 주세요.',true); return; }
    if(!confirm('접속한 모든 사람에게 공지를 보냅니다. 계속할까요?')) return;
    if(rpg('announcement',{text:t})) state('공지를 게시했습니다.');
    else state('접속한 뒤 이용할 수 있습니다.',true); };
  $('ad-clear').onclick=function(){ $('ad-notice').value=''; };

  gate();
  if(store.get(tokenKey)) connect();
  else state('쉘터에서 먼저 접속하면 여기서도 바로 이어집니다.');

  window.TW_ADMIN={ state:function(){ return {connected:connected,admin:isAdmin,filter:filter,logTab:logTab,
    reports:(admin&&admin.reports||[]).length, pick:pick&&pick.id||null, found:found&&found.name||null}; } };
})();
