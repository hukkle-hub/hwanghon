/* 황혼 — 쉘터 (길드 쉼터)
   docs/design/15-shelter-social-server.md 가 정한 «텍스트형 쉼터» 를 게임 화면으로 만든 것.
   server/index.cjs 의 파티 서버 프로토콜을 그대로 쓴다 — 서버는 건드리지 않는다.
     account / hello  → welcome        접속
     character        → profile        캐릭터 이름
     guildCreate|Join|Leave → guild    길드
     chat             → chat           채팅 (월드·길드·파티)
     board            → 접속 인원
   정적 호스팅(GitHub Pages)에는 파티 서버가 없다. 그때는 화면을 그대로 두고
   «서버 주소가 필요하다» 고만 알린다 — 빈 화면을 보여 주지 않는다. */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);};

  /* ── 서버 주소: party.html 과 같은 규칙 (?server= → localStorage) ── */
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
             set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}},
             del:function(k){try{localStorage.removeItem(k);}catch(e){}}};

  var socket,seq=0,connected=false,stopped=false,retry,profile=null,guild=null,room=null;
  var messages=[],channel='world',lastSent=0,capacity=100;

  function state(text,bad){ var el=$('sh-state'); el.textContent=text||''; el.classList.toggle('is-bad',!!bad); }
  function send(msg){ if(!connected||!socket||socket.readyState!==1) return false;
    socket.send(JSON.stringify(Object.assign({},msg,{seq:++seq}))); return true; }

  /* ── 화면 ── */
  function pane(id){ ['sh-gate','sh-name','sh-nogu','sh-guild'].forEach(function(p){ $(p).hidden=p!==id; }); }
  function renderGate(){
    if(!profile){ pane('sh-gate'); $('sh-gstate').textContent=connected?'접속 중':'접속 전'; return; }
    if(!profile.characterCreated){ pane('sh-name'); $('sh-gstate').textContent='이름 미정'; return; }
    if(!guild){ pane('sh-nogu'); $('sh-gstate').textContent='길드 없음';
      $('sh-gatehint')&&($('sh-gatehint').textContent=''); return; }
    pane('sh-guild'); $('sh-gstate').textContent='소속';
  }
  function renderGuild(){
    renderGate();
    var list=$('sh-members');
    if(!guild){ $('sh-count').textContent='—';
      list.innerHTML='<div class="chat__empty">길드에 가입하면 동료 명단이 여기에 나타납니다.</div>'; return; }
    $('sh-gtitle').textContent=guild.name;
    $('sh-gsub').textContent=guild.members.length+'명 · 정원 100명';
    $('sh-ginvite').textContent=guild.code;
    $('sh-gnotice').textContent=guild.notice||'등록된 길드 공지가 없습니다.';
    var on=guild.members.filter(function(m){return m.online;}).length;
    $('sh-count').textContent='접속 '+on+' / '+guild.members.length+'명';
    list.innerHTML=guild.members.map(function(m){
      return '<div class="mrow2'+(m.online?' is-on':'')+'"><span class="mrow2__d"></span>'+
        '<span class="mrow2__n">'+esc(m.name)+'</span>'+
        (m.id===guild.owner?'<span class="mrow2__t">길드장</span>':'')+'</div>';
    }).join('');
  }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  var CHN={world:'월드',guild:'길드',party:'파티'};
  function renderChat(){
    var log=$('sh-log'), rows=messages.filter(function(m){ return m.channel===channel; });
    if(!rows.length){ log.innerHTML='<div class="chat__empty">'+
      (connected?CHN[channel]+' 채널에 아직 대화가 없습니다.':'접속하면 대화가 표시됩니다.')+'</div>'; return; }
    log.innerHTML=rows.map(function(m){
      return '<div class="chat__m" data-c="'+m.channel+'"><span class="chat__ch">'+CHN[m.channel]+'</span>'+
        '<span class="chat__who">'+esc(m.name)+'</span> <span class="chat__t">'+esc(m.text)+'</span></div>';
    }).join('');
    log.scrollTop=log.scrollHeight;
  }
  function renderProfile(){
    var w=$('sh-wallet').querySelector('.num');
    w.textContent=profile?Number(profile.gold||0).toLocaleString():'—';
  }
  function presence(n){
    $('sh-online').firstChild.nodeValue=String(n);
    $('sh-cap').textContent=' / '+capacity;
    $('sh-dot').classList.toggle('is-up',connected);
  }

  /* ── 접속 ── */
  function connect(request){
    if(socket&&(socket.readyState===0||socket.readyState===1)) return;
    stopped=false; clearTimeout(retry);
    if(!/^https?:$/.test(location.protocol)){ state('파티 서버 주소에서 이 화면을 열어 주세요.',true); return; }
    var scheme=(server.remote?server.origin.indexOf('https')===0:location.protocol==='https:')?'wss:':'ws:';
    state('접속 중…');
    try{ socket=new WebSocket(scheme+'//'+server.host+'/party-socket'); }
    catch(e){ state('파티 서버에 연결할 수 없습니다.',true); return; }
    var pending=request;
    socket.addEventListener('open',function(){ seq=0;
      socket.send(JSON.stringify(pending||{type:'hello',token:store.get(tokenKey),name:'아인'})); });
    socket.addEventListener('message',function(e){
      var msg; try{ msg=JSON.parse(e.data); }catch(err){ return; }
      if(msg.type==='welcome'){ connected=true; profile=msg.profile; store.set(tokenKey,msg.token);
        state(msg.ephemeral?'테스트 서버입니다 — 재시작 시 초기화됩니다.':'접속했습니다.');
        renderProfile(); renderGuild(); renderChat(); presence(1); return; }
      if(msg.type==='profile'){ profile=msg.profile; renderProfile(); renderGate(); return; }
      if(msg.type==='guild'){ guild=msg.guild; renderGuild(); return; }
      if(msg.type==='board'){ capacity=msg.capacity||capacity; presence(msg.online||0); return; }
      if(msg.type==='chatHistory'){ messages=msg.messages||[]; renderChat(); return; }
      if(msg.type==='chat'){ messages.push(msg.message); if(messages.length>200) messages.shift();
        renderChat(); return; }
      if(msg.type==='state'){ room=msg; return; }
      if(msg.type==='left'){ room=null; return; }
      if(msg.type==='loggedOut'){ stopped=true; connected=false; profile=null; guild=null; room=null;
        messages=[]; store.del(tokenKey); renderGuild(); renderChat(); presence(0);
        state('로그아웃했습니다.'); return; }
      if(msg.type==='error'){ state(msg.message,true); if(!connected){ stopped=true; socket.close(); } }
    });
    socket.addEventListener('close',function(){ connected=false; presence(0); renderGate();
      if(!stopped&&profile){ state('연결을 복구하고 있습니다…'); retry=setTimeout(function(){connect(null);},1500); }
      else if(!profile&&!stopped) state('파티 서버에 연결할 수 없습니다. 서버를 실행한 주소로 열거나 ?server=주소 를 붙이세요.',true); });
    socket.addEventListener('error',function(){ if(!connected)
      state('파티 서버에 연결할 수 없습니다. 서버를 실행한 주소로 열거나 ?server=주소 를 붙이세요.',true); });
  }

  /* ── 조작 ── */
  function account(mode){
    var id=$('sh-id').value.trim(), pw=$('sh-pw').value;
    if(!id||!pw){ state('계정 ID와 비밀번호를 입력하세요.',true); return; }
    var req={type:'account',mode:mode,username:id,password:pw,name:'아인'};
    $('sh-pw').value='';
    if(connected) send(req); else connect(req);
  }
  $('sh-login').onclick=function(){ account('login'); };
  $('sh-register').onclick=function(){ account('register'); };
  $('sh-guest').onclick=function(){ connect({type:'hello',token:store.get(tokenKey),name:'아인'}); };
  $('sh-cgo').onclick=function(){ send({type:'character',name:$('sh-cname').value.trim(),character:$('sh-cpick').value}); };
  $('sh-gcreate').onclick=function(){ send({type:'guildCreate',name:$('sh-gname').value.trim()}); };
  $('sh-gjoin').onclick=function(){ send({type:'guildJoin',code:$('sh-gcode').value.trim()}); };
  $('sh-gleave').onclick=function(){ send({type:'guildLeave'}); };
  $('sh-gcopy').onclick=function(){ var t=$('sh-ginvite').textContent;
    if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){state('초대 코드를 복사했습니다.');},function(){});
    else state('초대 코드: '+t); };

  $('sh-chtabs').addEventListener('click',function(e){
    var b=e.target.closest('[data-ch]'); if(!b) return;
    channel=b.dataset.ch;
    [].forEach.call(this.querySelectorAll('.tab'),function(t){ t.classList.toggle('is-on',t===b); });
    renderChat();
  });
  function say(){
    var text=$('sh-text').value.trim(); if(!text) return;
    if(Date.now()-lastSent<1000){ state('채팅은 1초 간격으로 보낼 수 있습니다.',true); return; }
    if(send({type:'chat',channel:channel,text:text})){ lastSent=Date.now(); $('sh-text').value=''; }
    else state('접속한 뒤 이용할 수 있습니다.',true);
  }
  $('sh-send').onclick=say;
  ['sh-text','sh-id','sh-pw','sh-cname','sh-gname','sh-gcode'].forEach(function(id){
    $(id).addEventListener('keydown',function(e){ if(e.key!=='Enter') return; e.preventDefault();
      ({'sh-text':say,'sh-id':function(){account('login');},'sh-pw':function(){account('login');},
        'sh-cname':function(){$('sh-cgo').click();},'sh-gname':function(){$('sh-gcreate').click();},
        'sh-gcode':function(){$('sh-gjoin').click();}})[id](); });
  });

  presence(0); renderGate(); renderChat();
  /* 이미 받아 둔 접속 키가 있으면 바로 붙는다 — 없으면 화면만 보여 준다. */
  if(store.get(tokenKey)) connect(null);
  window.TW_SHELTER={ state:function(){ return {connected:connected,guild:guild,profile:profile,
    channel:channel,messages:messages.length}; } };
})();
