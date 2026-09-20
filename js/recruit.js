/* 황혼 — 파티 모집 (설계 시트 03-party)
   server/index.cjs 의 방 프로토콜을 그대로 쓴다.
     create / join / ready / start / leave        방
     board                                        모집 목록 · 접속 인원
     rpg partyPurpose | partyTransfer             모집 목적 · 파티장 위임
     chat channel:'party'                         파티 채팅
   쉘터(js/shelter.js)와 같은 서버 주소 규칙·접속 키를 쓴다 — 한쪽에서 로그인해 두면
   여기서도 바로 붙는다. 파티 서버가 없는 정적 호스팅에서는 화면을 그대로 띄우고
   «서버 주소가 필요하다» 고만 알린다. */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);};
  var W=window.TW_WORLD, LV=window.TW_LEVELS||{}, AR=(window.TW_DUNGEONS||{}).ARENAS||{};
  /* 아레나 → 의뢰. story.js 의 QUEST_ARENA 와 같은 짝이다 (여기서는 story.js 를 안 읽는다). */
  var QUEST_OF={marsh:'q_marsh',sewage:'q_sewage',relay:'q_relay',grove:'q_plant',road:'q_road',ward:'q_med'};

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
             set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}},
             del:function(k){try{localStorage.removeItem(k);}catch(e){}}};

  var socket,seq=0,connected=false,stopped=false,retry;
  var profile=null,room=null,rooms=[],unlocked=[],messages=[],view='find',pick='d02';

  function state(text,bad){ var el=$('rc-state'); el.textContent=text||''; el.classList.toggle('is-bad',!!bad); }
  function send(msg){ if(!connected||!socket||socket.readyState!==1) return false;
    socket.send(JSON.stringify(Object.assign({},msg,{seq:++seq}))); return true; }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  var fmt=function(n){ return Number(n||0).toLocaleString(); };

  /* ── 임무 목록 ── */
  var PURPOSE={first:'첫 클리어',repeat:'반복 파밍',practice:'연습'};
  function missions(){
    var ids=Object.keys(LV), box=$('rc-missions');
    $('rc-mcount').textContent=ids.length+'곳';
    box.innerHTML=ids.map(function(id){
      var L=LV[id], a=AR[L.arena]||{}, q=W&&W.quest&&QUEST_OF[L.arena]?W.quest(QUEST_OF[L.arena]):null;
      /* 해금 여부는 서버가 rpgState.unlocked 로 알려 준다. 접속 전에는 모두 열어 보여 준다. */
      var open=!connected||unlocked.indexOf(id)>=0;
      var n=rooms.filter(function(r){return r.level===id;}).length;
      return '<div class="mrow3'+(id===pick?' is-on':'')+(open?'':' is-locked')+'" data-lv="'+id+'">'+
        '<div class="fill"><div class="mrow3__t">'+esc(L.name)+'</div>'+
        '<div class="mrow3__s">'+esc((L.diff||'').split(' · ')[0])+(q?' · 위험도 '+q.risk:'')+'</div></div>'+
        '<span class="mrow3__n'+(n?'':' mrow3__n--0')+'">'+(n?'모집 '+n:'모집 0')+'</span></div>';
    }).join('');
  }

  /* ── 임무 상세 ── */
  function detail(){
    var L=LV[pick]; if(!L){ $('rc-detail').innerHTML=''; return; }
    var a=AR[L.arena]||{}, q=QUEST_OF[L.arena]&&W&&W.quest?W.quest(QUEST_OF[L.arena]):null;
    $('rc-risk').innerHTML=q?'위험도 '+W.riskBadge(q.risk):'';
    var foes=''; for(var i=0;i<((q&&q.enemies)||1);i++)
      foes+='<span><svg class="ico ico--sm"><use href="#i-'+['skull','tree','bolt','anvil'][i%4]+'"/></svg></span>';
    $('rc-detail').innerHTML=
      '<h2 class="lg" style="color:var(--tx-hi);letter-spacing:.04em">'+esc(L.name)+'</h2>'+
      '<div class="xs t-faint mt1">'+esc(L.place||'')+'</div>'+
      '<div class="qart2 art"><img src="art/'+((a.art)||'lobby-city')+'.webp" alt=""></div>'+
      '<div class="label-ko">격파 대상</div><div class="sm t-dim">'+esc(a.hudName||'—')+'</div>'+
      '<div class="hr"></div><div class="label-ko">임무 목표</div>'+
      '<div class="sm t-dim">'+esc((q&&q.goal)||'지역을 확보하고 귀환한다.')+'</div>'+
      '<div class="hr"></div><div class="label-ko">주요 적</div><div class="foes">'+foes+'</div>'+
      (q?'<div class="hr"></div><div class="flex ac jb"><span class="label-ko" style="margin:0">의뢰 보수</span>'+
         '<span class="currency"><svg class="ico ico--sm"><use href="#i-coin"/></svg>'+
         '<span class="num">'+fmt(q.reward)+'</span></span></div>':'')+
      '<div class="xs t-faint mt3">출격 인원 2~4명 · 전원 준비 후 파티장이 출발합니다.</div>';
  }

  /* ── 모집 목록 ── */
  function findList(){
    var box=$('rc-find');
    if(!connected){ box.innerHTML='<div class="chat__empty">접속하면 모집 중인 파티가 표시됩니다.'+
      '<br>오른쪽에서 새 파티를 만들거나 방 코드로 합류할 수 있습니다.</div>'; return; }
    var list=rooms.filter(function(r){ return r.level===pick; }), all=rooms;
    var use=list.length?list:all, only=list.length>0;
    if(!use.length){ box.innerHTML='<div class="chat__empty">공개 모집 중인 파티가 없습니다.'+
      '<br>오른쪽에서 새 파티를 만들어 동료를 기다리세요.</div>'; return; }
    box.innerHTML=(only?'':'<div class="xs t-faint" style="padding:6px 2px">'+
        esc(LV[pick]?LV[pick].name:'')+' 모집이 없어 전체를 보여 줍니다.</div>')+
      use.map(function(r){
      var L=LV[r.level]||{};
      return '<div class="prow2"><span class="prow2__c">'+esc(r.code)+'</span>'+
        '<div class="fill"><div class="prow2__t">'+esc(L.name||r.level)+'</div>'+
        '<div class="prow2__s">'+esc(r.leader)+' · '+(PURPOSE[r.purpose]||r.purpose)+'</div></div>'+
        '<span class="prow2__n">'+r.count+' / 4</span>'+
        '<button type="button" class="btn btn--sm" data-join="'+esc(r.code)+'">참가</button></div>';
    }).join('');
  }

  /* ── 파티 (4인 카드) ── */
  var CHAR={ain:'아인 · 낫',kain:'카인 · 대검',ryu:'류 · 쌍단검',sera:'세라 · 시약'};
  function slots(){
    var box=$('rc-slots'), ms=(room&&room.members)||[], out='';
    for(var i=0;i<4;i++){
      var m=ms[i];
      if(!m){ out+='<div class="slot4 is-empty"><div class="slot4__h"><span class="slot4__p">'+(i+1)+'P</span>'+
        '<span class="slot4__st">모집 중</span></div><div class="slot4__e">방 코드를 전달해<br>동료를 부르세요</div></div>';
        continue; }
      var me=profile&&m.id===profile.id, lead=room.leader===m.id;
      var st=!m.connected?'재접속 대기':lead?'파티장':m.ready?'준비 완료':'준비 중';
      out+='<div class="slot4'+(me?' is-me':'')+'"><div class="slot4__h">'+
        '<span class="slot4__p">'+(i+1)+'P</span>'+
        '<span class="slot4__st'+(lead?' lead':m.ready?' on':'')+'">'+st+'</span></div>'+
        '<div class="slot4__art art"><img src="art/full-'+(m.character||'ain')+'.webp" alt=""></div>'+
        '<div class="slot4__b"><div class="slot4__n">'+esc(m.name)+'</div>'+
        '<div class="slot4__m">'+(CHAR[m.character]||m.character||'—')+'</div>'+
        '<div class="slot4__cp">Lv.'+(m.level||1)+' · 전투력 '+fmt(m.power||0)+'</div></div></div>';
    }
    box.innerHTML=out;
  }
  function head(){
    if(!room){ $('rc-vis').textContent=connected?'모집 중인 파티':'접속 전'; $('rc-code').textContent='';
      $('rc-copy').hidden=true;
      $('rc-avg').innerHTML=rooms.length?'모집 '+rooms.length+'개 파티':'모집 중인 파티 없음'; return; }
    $('rc-vis').textContent=(room.public?'공개 파티':'비공개 파티')+' · '+(LV[room.level]?LV[room.level].name:room.level);
    $('rc-code').textContent=room.code; $('rc-copy').hidden=false;
    var ps=room.members.map(function(m){return m.power||0;});
    var avg=ps.length?Math.round(ps.reduce(function(a,b){return a+b;},0)/ps.length):0;
    $('rc-avg').innerHTML='평균 전투력 <b>'+fmt(avg)+'</b>';
  }
  function chat(){
    var log=$('rc-log'), rows=messages.filter(function(m){return m.channel==='party';});
    log.innerHTML=rows.length?rows.map(function(m){
      return '<div class="pchat__m"><b>'+esc(m.name)+'</b> '+esc(m.text)+'</div>'; }).join('')
      :'<div class="chat__empty">'+(room?'파티 채팅':'파티에 들어가면 대화할 수 있습니다.')+'</div>';
    log.scrollTop=log.scrollHeight;
  }
  function buttons(){
    var me=room&&profile&&room.members.filter(function(m){return m.id===profile.id;})[0];
    var lead=room&&profile&&room.leader===profile.id;
    var all=room&&room.members.length>=2&&room.members.every(function(m){return m.connected&&m.ready;});
    $('rc-ready').disabled=!me; $('rc-ready').textContent=me&&me.ready?'준비 취소':'준비 완료';
    $('rc-start').disabled=!lead||!all;
    $('rc-start').textContent=!room?'모집 시작':lead?'모집 시작':'파티장이 출발합니다';
    $('rc-leave').hidden=!room;
    $('rc-text').disabled=!room; $('rc-say').disabled=!room;
  }
  function setView(v){
    view=v;
    [].forEach.call($('rc-tabs').querySelectorAll('.tab'),function(t){ t.classList.toggle('is-on',t.dataset.v===v); });
    $('rc-find').hidden=v!=='find'; $('rc-mine').hidden=v!=='mine';
  }
  function render(){ missions(); detail(); findList(); slots(); head(); chat(); buttons(); }

  /* ── 접속 ── */
  function connect(request){
    if(socket&&(socket.readyState===0||socket.readyState===1)) return;
    stopped=false; clearTimeout(retry);
    if(!/^https?:$/.test(location.protocol)){ state('파티 서버 주소에서 이 화면을 열어 주세요.',true); return; }
    var scheme=(server.remote?server.origin.indexOf('https')===0:location.protocol==='https:')?'wss:':'ws:';
    state('접속 중…');
    try{ socket=new WebSocket(scheme+'//'+server.host+'/party-socket'); }
    catch(e){ state('파티 서버에 연결할 수 없습니다.',true); return; }
    socket.addEventListener('open',function(){ seq=0;
      socket.send(JSON.stringify(request||{type:'hello',token:store.get(tokenKey),name:'아인'})); });
    socket.addEventListener('message',function(e){
      var msg; try{ msg=JSON.parse(e.data); }catch(err){ return; }
      if(msg.type==='welcome'){ connected=true; profile=msg.profile; store.set(tokenKey,msg.token);
        $('rc-wallet').querySelector('.num').textContent=fmt(profile.gold);
        state(msg.ephemeral?'테스트 서버입니다 — 재시작 시 초기화됩니다.':'접속했습니다.');
        setTimeout(function(){ send({type:'rpg',action:'state'}); },260);   /* 해금 지역 */
        render(); return; }
      if(msg.type==='profile'){ profile=msg.profile;
        $('rc-wallet').querySelector('.num').textContent=fmt(profile.gold); render(); return; }
      if(msg.type==='board'){ rooms=msg.rooms||[];
        $('rc-online').textContent='접속 '+(msg.online||0)+' / '+(msg.capacity||100); render(); return; }
      if(msg.type==='rpg'){ if(msg.data&&msg.data.unlocked){ unlocked=msg.data.unlocked; missions(); } return; }
      if(msg.type==='chatHistory'){ messages=msg.messages||[]; chat(); return; }
      if(msg.type==='chat'){ messages.push(msg.message); if(messages.length>200) messages.shift(); chat(); return; }
      if(msg.type==='rpgNotice'){ state(msg.text); return; }
      if(msg.type==='patch'){ if(!room||!window.TW_PARTY_WIRE) return; msg=window.TW_PARTY_WIRE.apply(room,msg.patch); }
      if(msg.type==='state'){ room=msg; setView('mine');
        /* 파티가 출격하면 이 화면에서 할 일이 끝난다 — 전투 화면으로 넘긴다 */
        if(room.raid){ state('출격했습니다. 협동 출격 화면으로 이동합니다.');
          setTimeout(function(){ location.href='party.html'; },900); }
        render(); return; }
      if(msg.type==='left'){ room=null; setView('find'); state('파티에서 나왔습니다.'); render(); return; }
      if(msg.type==='loggedOut'){ stopped=true; connected=false; profile=null; room=null; rooms=[];
        messages=[]; store.del(tokenKey); setView('find'); state('로그아웃했습니다.'); render(); return; }
      if(msg.type==='error'){ state(msg.message,true); if(!connected){ stopped=true; socket.close(); } }
    });
    socket.addEventListener('close',function(){ connected=false; $('rc-online').textContent='연결 끊김'; render();
      if(!stopped&&profile){ state('연결을 복구하고 있습니다…'); retry=setTimeout(function(){connect(null);},1500); }
      else if(!profile&&!stopped) state('파티 서버에 연결할 수 없습니다. 서버를 실행한 주소로 열거나 ?server=주소 를 붙이세요.',true); });
    socket.addEventListener('error',function(){ if(!connected)
      state('파티 서버에 연결할 수 없습니다. 서버를 실행한 주소로 열거나 ?server=주소 를 붙이세요.',true); });
  }

  /* ── 조작 ── */
  $('rc-tabs').addEventListener('click',function(e){
    var b=e.target.closest('[data-v]'); if(b) setView(b.dataset.v); });
  $('rc-missions').addEventListener('click',function(e){
    var r=e.target.closest('[data-lv]'); if(!r) return;
    pick=r.dataset.lv; render(); });
  $('rc-find').addEventListener('click',function(e){
    var b=e.target.closest('[data-join]'); if(!b) return;
    if(!send({type:'join',code:b.dataset.join})) state('접속한 뒤 이용할 수 있습니다.',true); });
  $('rc-create').onclick=function(){
    if(!send({type:'create',level:pick,public:$('rc-public').value==='1',purpose:$('rc-purpose').value}))
      state('접속한 뒤 이용할 수 있습니다.',true); };
  $('rc-joinbtn').onclick=function(){ var c=$('rc-join').value.trim();
    if(!c){ state('방 코드를 입력하세요.',true); return; }
    if(!send({type:'join',code:c})) state('접속한 뒤 이용할 수 있습니다.',true); };
  $('rc-ready').onclick=function(){
    var me=room&&profile&&room.members.filter(function(m){return m.id===profile.id;})[0];
    send({type:'ready',ready:!(me&&me.ready)}); };
  $('rc-start').onclick=function(){ send({type:'start'}); };
  $('rc-leave').onclick=function(){ if(confirm('파티에서 나갑니다. 계속할까요?')) send({type:'leave'}); };
  $('rc-copy').onclick=function(){ var t=$('rc-code').textContent;
    if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){state('방 코드를 복사했습니다.');},function(){});
    else state('방 코드: '+t); };
  $('rc-purpose').onchange=function(){
    if(room&&profile&&room.leader===profile.id) send({type:'rpg',action:'partyPurpose',purpose:this.value}); };
  function say(){ var t=$('rc-text').value.trim(); if(!t) return;
    if(send({type:'chat',channel:'party',text:t})) $('rc-text').value='';
    else state('파티에 들어간 뒤 이용할 수 있습니다.',true); }
  $('rc-say').onclick=say;
  $('rc-text').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); say(); } });
  $('rc-join').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); $('rc-joinbtn').click(); } });

  setView('find'); render();
  if(store.get(tokenKey)) connect(null);
  else state('협동 출격 화면에서 먼저 접속하면 여기서도 바로 이어집니다.');
  window.TW_RECRUIT={ state:function(){ return {connected:connected,view:view,pick:pick,
    rooms:rooms.length,room:room&&{code:room.code,members:room.members.length,leader:room.leader}}; } };
})();
