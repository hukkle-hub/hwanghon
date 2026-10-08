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
  var messages=[],channel='world',lastSent=0,capacity=100,contacts=[];
  var board=[],myApp=null;          /* 모집 중인 길드 목록 · 내가 낸 가입 신청 */
  var node=null, picks=null;         /* 거점 남산 N-01 (server/node-store.cjs nodeView) · 고르는 중인 정책 */

  function state(text,bad){ var el=$('sh-state'); el.textContent=text||''; el.classList.toggle('is-bad',!!bad); }
  function send(msg){ if(!connected||!socket||socket.readyState!==1) return false;
    socket.send(JSON.stringify(Object.assign({},msg,{seq:++seq}))); return true; }


  /* ── 거점 관리 (docs/design/201 §6) — 보는 건 누구나, 고치는 건 관리 길드의 직책만 (서버가 다시 검사한다) ── */
  var POL=[['gate_reinforce','정문 강화',4],['generator_reinforce','발전기 강화',4],['arm_npcs','NPC 무장',3],
           ['scouting','정찰 강화',3],['medical_stock','의료 비축',3],['reserve_power','예비 전력',4]];
  var ND_STATE={stable:['안정','is-ok'],uneasy:['불안',''],alert:['경계',''],invasion:['침공','is-bad'],recovering:['복구',''],
                fallen:['함락','is-bad'],retakeable:['탈환 가능','is-bad'],retaking:['탈환전','is-bad']};
  var ND_TIER={initial:'점령 초기 · 탈환 불가',basic:'기본 탈환',elite_up:'엘리트 증가',fortress:'요새화',infection_core:'감염 핵심지'};
  var ND_ROLE={leader:'길드장',vice:'부길드장',combat:'전투대장',supply:'보급대장',craft:'제작대장',member:'길드원'};
  function renderNode(){
    var n=node, st=n?ND_STATE[n.state]||[n.state,'']:['—',''];
    $('nd-state').textContent=st[0]; $('nd-state').className=st[1];
    $('nd-tier').textContent=n&&(n.state==='fallen'||n.state==='retakeable')?ND_TIER[n.tier]+' · 점령 '+n.occupiedHours.toFixed(1)+'시간'+(n.retakeIn>0?' · '+n.retakeIn.toFixed(1)+'시간 뒤 탈환 가능':''):'';
    $('nd-period').textContent=n?'관리 주기 '+n.period:'—';
    if(!n){ $('nd-kv').innerHTML=''; $('nd-policy').hidden=$('nd-supply').hidden=true; $('nd-note').textContent=connected?'불러오는 중…':'접속하면 보입니다.'; return; }
    var me=n.me, can=function(p){ return !!(me&&me.can&&me.can.indexOf(p)>=0); };
    var pols=(n.policies||[]).map(function(id){ var p=POL.filter(function(x){return x[0]===id;})[0]; return p?p[1]:id; });
    $('nd-kv').innerHTML=
      '<span>관리 길드</span><span>'+(n.steward?esc(n.steward.name):'없음 — 지난 주기 공헌이 없었다')+'</span>'+
      '<span>정책</span><span>'+(pols.length?esc(pols.join(' · ')):'없음')+'</span>'+
      '<span>이번 주기</span><span>'+(n.standings&&n.standings.length?n.standings.slice(0,3).map(function(g,i){ var mine=me&&me.guild===g.guild;
        return (mine?'<b class="t-gold">':'')+(i+1)+'. '+esc(g.name)+' '+g.score+(mine?'</b>':''); }).join(' · '):'공헌 없음')+
        ' <small class="t-faint">· '+Math.max(0,Math.ceil((n.nextPeriodAt-Date.now())/86400000))+'일 뒤 결정</small></span>'+
      '<span>보급</span><span>'+n.supply+' / '+(n.supplyCap||12)+'</span>'+
      /* 서울 망이 이 판에 닿는 것 (문서 202 §2.5) — 다 정상이면 줄을 안 띄운다 */
      (n.region&&(n.region.services.logistics<1||n.region.services.recon<1||n.region.services.manufacturing<1)?'<span>서울 망</span><span>'+
        ['물류 '+Math.round(n.region.services.logistics*100)+'% → 보급 상한 '+n.region.effects.supplyCap,
         '정찰 '+Math.round(n.region.services.recon*100)+'% → 준비 '+(n.region.effects.prepDeltaSeconds<0?n.region.effects.prepDeltaSeconds.toFixed(1)+'초':'그대로'),
         '제작 '+Math.round(n.region.services.manufacturing*100)+'% → 포탑 수리 ×'+n.region.effects.turretRepairScale.toFixed(2)].join(' · ')+'</span>':'')+
      '<span>정보</span><span>지도 '+Math.round(n.services.mapIntel*100)+'% · 구조신호 '+(n.services.rescueSignals?'켜짐':'꺼짐')+' · 침공 예보 '+(n.services.invasionForecast?'켜짐':'꺼짐')+'</span>'+
      (n.state==='fallen'||n.state==='retakeable'?'<span>탈환</span><span>난이도 ×'+n.difficulty+' · 보상 ×'+n.reward+(n.extraElites?' · 엘리트 +'+n.extraElites:'')+'</span>':'')+
      '<span>내 직책</span><span>'+(me?esc(me.name)+' '+ND_ROLE[me.role]+(me.steward?' · 관리 길드':' · 관리 길드 아님 (보기만)'):'길드 없음 (보기만)')+'</span>';
    $('nd-policy').hidden=!can('select_policy');
    if(can('select_policy')){
      if(!picks) picks=(n.policies||[]).slice();
      var cost=picks.reduce(function(a,id){ var p=POL.filter(function(x){return x[0]===id;})[0]; return a+(p?p[2]:0); },0);
      $('nd-pols').innerHTML=POL.map(function(p){ var on=picks.indexOf(p[0])>=0;
        return '<label class="nd-pol'+(on?' is-on':'')+'"><input type="checkbox" data-p="'+p[0]+'"'+(on?' checked':'')+'>'+p[1]+'<small>'+p[2]+'</small></label>'; }).join('');
      $('nd-budget').textContent='예산 '+cost+' / 10'+(cost>10?' — 넘었습니다':'');
      $('nd-budget').classList.toggle('is-bad',cost>10);
      $('nd-psave').disabled=cost>10;
    }
    $('nd-supply').hidden=!can('allocate_supply');
    var cap=n.supplyCap||12; $('nd-sup').textContent='이번 주기 '+n.supply+' / '+cap+(cap<12?' (서울 물류)':'')+' · 바리케이드 하나 = 3'; $('nd-sgo').disabled=n.supply+3>cap;
    $('nd-note').textContent=me&&me.steward?'관리권 ≠ 소유권 — 정책·보급만 정하고, 누구도 막지 못합니다.':
      '관리 길드는 지난 주기의 공헌(처치·방어·수리·구조·보스·보급·지휘)으로 정해집니다. 돈 입찰은 없습니다.';
  }
  /* ── 서울 전략망 · 길드 전략 명령 (docs/design/202) — 상태·압력·관리 길드는 서버가 정한다. 여기선 보이고, 명령만 낸다 ── */
  var RG_STATE={online:['정상','#8FD3A8'],degraded:['저하','#E0B060'],occupied:['점령','#E58A7A'],recovering:['복구','#9FC7E8']};
  var RG_ROLE=[['intel','정보'],['safe_hub','피난'],['logistics','물류'],['manufacturing','제작'],['recon','정찰'],['resource','자원']];
  var RG_ORDER={defend:'방어',reinforce:'증원',supply:'보급',repair:'수리',recon:'정찰',evacuate:'대피',prepare_retake:'탈환 준비'};
  var region=null, rgPick=null, ally=null, national=null;
  var KR_BAND={stable:'#8FD3A8',tension:'#C9D27A',invasion:'#E0B060',crisis:'#E58A7A',collapsed:'#B0443A'};
  var KR_PHASE={dormant:['평시','t-faint'],mobilization:['동원','is-mid'],active:['전국 작전 진행','is-bad'],critical:['결정적 국면','is-bad']};
  var KR_COR={open:['열림','rgba(143,211,168,.35)'],strained:['긴장','rgba(224,176,96,.8)'],cut:['단절','#E58A7A']};
  function renderNational(){
    var v=national; if(!v){ $('krw-map').innerHTML=''; $('krw-side').textContent=''; $('krw-phase').textContent=''; return; }
    var by={}, svg='', xy=function(r){ return [8+r.at[0]*134, 6+r.at[1]*148]; }; v.regions.forEach(function(r){ by[r.id]=r; });
    v.corridors.forEach(function(c){ var c2=KR_COR[c.status]||KR_COR.open, pts=c.regions.filter(function(id){ return by[id]; }).map(function(id){ return xy(by[id]).join(','); }).join(' ');
      svg+='<polyline points="'+pts+'" fill="none" stroke="'+c2[1]+'" stroke-width="'+(c.status==='open'?1:2)+'"'+(c.status==='cut'?' stroke-dasharray="3 2"':'')+'/>'; });
    v.regions.forEach(function(r){ var p=xy(r); svg+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(r.id==='seoul'?5:4)+'" fill="'+(KR_BAND[r.band.id]||'#888')+'"><title>'+esc(r.name+' — 압력 '+Math.round(r.pressure)+' '+r.band.name+' · 운영 '+Math.round(r.operational*100)+'% · '+r.identity)+'</title></circle>'; });
    $('krw-map').innerHTML=svg;
    var ph=KR_PHASE[v.phase]||[v.phase,'']; $('krw-phase').innerHTML='<b class="'+ph[1]+'">'+ph[0]+'</b>';
    var hot=v.regions.filter(function(r){ return r.band.id!=='stable'; }).sort(function(a,b){ return b.pressure-a.pressure; });
    var bad=v.corridors.filter(function(c){ return c.status!=='open'; });
    $('krw-side').innerHTML=(hot.length?hot.slice(0,4).map(function(r){ return '<span style="color:'+KR_BAND[r.band.id]+'">●</span> '+esc(r.name)+' '+esc(r.band.name)+' '+Math.round(r.pressure); }).join('<br>'):'<span class="t-faint">16권역 모두 안정</span>')+
      (v.field&&v.field.length?'<br><span style="color:#E58A7A">▲</span> 필드 보스 '+v.field.length+'마리가 거점을 위협 중':'')+
      '<br>'+(bad.length?bad.map(function(c){ return '회랑 '+esc(c.purpose)+' <b style="color:'+(c.status==='cut'?'#E58A7A':'#E0B060')+'">'+KR_COR[c.status][0]+'</b>'; }).join('<br>'):'<span class="t-faint">회랑 7개 모두 열림</span>');
  }
  function renderRegion(){
    var r=region; if(!r){ $('rgw-map').innerHTML=''; $('rgw-svc').innerHTML=''; $('rgw-band').textContent=''; $('rgw-cmd').hidden=true; return; }
    var W=340,H=196,P=16, xy=function(n){ return [P+n.at[0]*(W-110), 14+n.at[1]*(H-28)]; }, by={}; r.nodes.forEach(function(n){ by[n.id]=n; });
    var me=r.me, svg='';
    r.links.forEach(function(l){ var a=xy(by[l[0]]), b=xy(by[l[1]]); svg+='<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="rgba(201,164,94,.28)" stroke-width="1.5"/>'; });
    var allyIds=me&&me.alliance?me.alliance.guilds.map(function(g){ return g.id; }):[];
    r.nodes.forEach(function(n){ var p=xy(n), st=RG_STATE[n.state]||['?','#888'], mine=me&&n.steward&&n.steward.guild===me.guild, pick=rgPick===n.id,
      allied=!mine&&n.steward&&allyIds.indexOf(n.steward.guild)>=0;
      var rad=n.tier===3?10:n.tier===2?8:6;
      if(n.threat>0) svg+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(rad+3+n.threat/30).toFixed(1)+'" fill="none" stroke="'+st[1]+'" stroke-opacity=".35" stroke-width="2"/>';
      svg+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+rad+'" fill="'+st[1]+'"'+(mine?' stroke="#C9A45E" stroke-width="3"':allied?' stroke="#9FC7E8" stroke-width="3" stroke-dasharray="3 2"':pick?' stroke="#fff" stroke-width="2"':'')+'/>';
      svg+='<text x="'+(p[0]+rad+4)+'" y="'+(p[1]+3.5)+'">'+esc(n.name.split(' ')[0])+(n.state!=='online'?' · '+st[0]:'')+'</text>';
      /* 이 거점을 위협하는 필드 보스가 살아 있다 (잡으면 위협 −15) — 빨간 삼각형 */
      if(n.fieldBoss&&n.fieldBoss.length) svg+='<path d="M'+(p[0]-rad-9)+' '+(p[1]+4)+'l5 -9l5 9z" fill="#E58A7A"><title>필드 보스 ('+esc(n.fieldBoss.join(', '))+') — 살아 있는 동안 위협 +6/30분, 잡으면 −15</title></path>';
      svg+='<circle class="rgw-hit" data-n="'+n.id+'" cx="'+p[0]+'" cy="'+p[1]+'" r="20" fill="transparent" stroke="none"><title>'+esc(n.name+' — '+st[0]+' · 위협 '+n.threat+' · '+n.effect+(n.steward?' · 관리 '+n.steward.name:''))+'</title></circle>'; });
    $('rgw-map').innerHTML=svg;
    $('rgw-band').innerHTML='압력 <b>'+Math.round(r.pressure)+'</b> '+esc(r.band.name)+' · 운영 '+Math.round(r.operational*100)+'%';
    $('rgw-svc').innerHTML=RG_ROLE.map(function(x){ var v=r.services[x[0]]; if(v==null) return ''; var c=v>=0.95?'':v>=0.6?'is-mid':'is-bad';
      return '<span>'+x[1]+' '+Math.round(v*100)+'%<i><b class="'+c+'" style="width:'+Math.round(v*100)+'%"></b></i></span>'; }).join('');
    $('rgw-crisis').hidden=!(r.crisis&&r.crisis.active);
    if(r.crisis&&r.crisis.active) $('rgw-crisis').innerHTML='<b style="color:#E58A7A">'+esc(r.crisis.name)+'</b> — 동시 작전: '+r.crisis.fronts.map(function(f){ return esc((by[f.node]||{name:f.node}).name.split(' ')[0])+' '+f.squads+'분대'; }).join(' · ');
    $('rgw-admin').textContent=me?'관리 용량 '+me.admin.used+' / '+me.admin.capacity+(me.admin.managed.length?' · '+me.admin.managed.map(function(id){ return by[id].name.split(' ')[0]; }).join(', '):' · 관리 거점 없음')+' — 지역 허브는 길드당 하나':'';
    $('rgw-cmd').hidden=!me;
    if(!me) return;
    var lead=me.role==='leader'||me.role==='vice';
    $('rgw-orders').innerHTML=me.orders.length?me.orders.map(function(o){ var mine=profile&&o.issuer===profile.id;
      /* 명령 보너스 (서버가 판 보고 때 다시 잰다): 걸린 지 3분 지난 명령의 거점에서 판하면 공헌 +10% — 지금 전술 판이 있는 곳만 */
      var wait=Math.ceil((o.at+180000-Date.now())/60000), bonus=by[o.node]&&by[o.node].node?(wait>0?'<small class="t-faint"> · '+wait+'분 뒤 판 +10%</small>':'<small style="color:#8FD3A8"> · 판 +10%</small>'):'';
      return '<div class="rgw-order"><b style="color:#C9A45E">'+o.priority+'</b><span class="fill">'+esc(o.name)+' · '+esc((by[o.node]||{name:o.node}).name)+bonus+' <small class="t-faint">'+esc(o.issuerName)+'</small></span>'+
        (mine||lead?'<button type="button" class="btn btn--sm" data-cancel="'+o.id+'">내리기</button>':'')+'</div>'; }).join(''):'<div class="xs t-faint">걸린 명령 없음</div>';
    /* 동맹 길드의 명령 — 보기만 (내리기·보너스는 그 길드 것) */
    $('rgw-orders').innerHTML+=(me.allyOrders||[]).map(function(o){ return '<div class="rgw-order"><b style="color:#9FC7E8">'+o.priority+'</b><span class="fill"><span class="rgw-ally-g">'+esc(o.guildName)+'</span> · '+esc(o.name)+' · '+esc((by[o.node]||{name:o.node}).name)+'</span></div>'; }).join('');
    $('rgw-issue').hidden=!me.canOrder.length;
    $('rgw-pick').textContent=rgPick?(by[rgPick].name+' — '+by[rgPick].effect):'지도에서 거점을 누르면 명령을 낼 수 있습니다 ('+ND_ROLE[me.role]+')';
    $('rgw-types').innerHTML=rgPick?me.canOrder.map(function(t){ return '<button type="button" class="btn btn--sm" data-order="'+t+'">'+RG_ORDER[t]+'</button>'; }).join(''):'';
  }
  function renderAlly(){
    var a=ally, al=a&&a.alliance, mineG=region&&region.me?region.me.guild:null;
    $('rgw-ally').innerHTML=!a?'':al?'<b class="rgw-ally-g">'+esc(al.name)+'</b> · '+al.guilds.map(function(g){ return g.id===mineG?'<b>'+esc(g.name)+'</b>':esc(g.name); }).join(' · ')+' <small class="t-faint">('+al.guilds.length+'/'+a.max+')</small>'+
      (a.sent&&a.sent.length?' <small class="t-faint">· 초대 보냄: '+a.sent.map(esc).join(', ')+'</small>':''):'<span class="t-faint">동맹 없음'+(a.leader?'':' — 길드장이 만들거나 받는다')+'</span>';
    var canGrow=a&&a.leader&&(!al||al.guilds.length+(a.sent||[]).length<a.max);
    $('rgw-ally-form').hidden=!canGrow;
    if(canGrow){ $('rgw-ally-name').placeholder=al?'초대할 길드 이름':'새 동맹 이름 (2–24자)'; $('rgw-ally-go').textContent=al?'초대':'동맹 만들기'; }
    $('rgw-ally-inv').innerHTML=(a&&a.invites||[]).map(function(i){ return '<div class="rgw-order"><span class="fill">초대 받음 · <b class="rgw-ally-g">'+esc(i.name)+'</b></span>'+
      '<button type="button" class="btn btn--sm btn--primary" data-ally-ok="'+esc(i.id)+'">수락</button><button type="button" class="btn btn--sm" data-ally-no="'+esc(i.id)+'">거절</button></div>'; }).join('')+
      (a&&a.leader&&al?'<button type="button" class="btn btn--sm mt2" id="rgw-ally-leave">우리 길드 동맹 탈퇴</button>':'');
  }
  function allySend(msg){ ndSend(msg); setTimeout(function(){ ndSend({type:'node',action:'region',region:'seoul'}); },10); }
  $('rgw-ally-go').onclick=function(){ var v=$('rgw-ally-name').value.trim(); if(!v) return; var al=ally&&ally.alliance;
    allySend(al?{type:'node',action:'ally',op:'invite',guild:v}:{type:'node',action:'ally',op:'create',name:v}); $('rgw-ally-name').value=''; };
  $('rgw-ally-inv').addEventListener('click',function(e){ var d=e.target&&e.target.dataset||{};
    if(d.allyOk) allySend({type:'node',action:'ally',op:'accept',alliance:d.allyOk});
    else if(d.allyNo) allySend({type:'node',action:'ally',op:'decline',alliance:d.allyNo});
    else if(e.target&&e.target.id==='rgw-ally-leave') allySend({type:'node',action:'ally',op:'leave'}); });
  $('rgw-map').addEventListener('click',function(e){ var id=e.target&&e.target.dataset&&e.target.dataset.n; if(!id) return; rgPick=rgPick===id?null:id; renderRegion(); });
  $('rgw-types').addEventListener('click',function(e){ var t=e.target&&e.target.dataset&&e.target.dataset.order; if(!t||!rgPick) return;
    ndSend({type:'node',action:'order',region:'seoul',order:{node:rgPick,type:t,priority:$('rgw-urgent').checked?5:3}}); });
  $('rgw-orders').addEventListener('click',function(e){ var id=e.target&&e.target.dataset&&e.target.dataset.cancel; if(!id) return;
    ndSend({type:'node',action:'cancel',region:'seoul',order:+id}); });

  /* node 명령은 서버가 200ms 간격으로만 받는다 — 접속 직후 «welcome» 과 «guild» 가 거의 같이 와서 조회 두 번이
     부딪혀 «처리 중입니다» 가 떴다. 조회는 하나로 합치고, 모든 node 명령은 간격을 두고 보낸다. */
  var ndLast=0, ndInfo=0;
  function ndSend(msg){ var w=Math.max(0,240-(Date.now()-ndLast)); ndLast=Date.now()+w;
    setTimeout(function(){ if(!send(msg)) state('접속한 뒤 이용할 수 있습니다.',true); },w); }
  function refreshNode(){ clearTimeout(ndInfo); ndInfo=setTimeout(function(){ ndSend({type:'node',action:'info',node:'namsan_n01'}); ndSend({type:'node',action:'region',region:'seoul'}); ndSend({type:'node',action:'ally',op:'info'}); ndSend({type:'node',action:'national'}); },60); }

  /* ── 화면 ── */
  function pane(id){ ['sh-gate','sh-name','sh-nogu','sh-guild'].forEach(function(p){ $(p).hidden=p!==id; }); }
  function renderGate(){
    if(!profile){ pane('sh-gate'); $('sh-gstate').textContent=connected?'접속 중':'접속 전'; return; }
    if(!profile.characterCreated){ pane('sh-name'); $('sh-gstate').textContent='이름 미정'; return; }
    if(!guild){ pane('sh-nogu'); $('sh-gstate').textContent=myApp?'신청 중':'길드 없음';
      $('sh-applied').hidden=!myApp;
      if(myApp) $('sh-appliedto').textContent=myApp.name;
      $('sh-gatehint')&&($('sh-gatehint').textContent=''); return; }
    pane('sh-guild'); $('sh-gstate').textContent='소속';
  }
  /* 내 권한: 길드장 > 임원 > 길드원. 서버가 guildDetails 로 role 을 내려 준다 —
     클라이언트가 정하는 게 아니다. 여기서는 «무엇을 보여 줄지» 만 결정한다. */
  function myRole(){
    if(!guild||!profile) return 'none';
    var me=guild.members.filter(function(m){return m.id===profile.id;})[0];
    return me?me.role:'none';
  }
  var ROLE={owner:'길드장',officer:'임원',member:'',combat:'전투대장',supply:'보급대장',craft:'제작대장'};
  var CAPTAIN={combat:'전투대장',supply:'보급대장',craft:'제작대장'};
  function renderGuild(){
    renderGate();
    var list=$('sh-members');
    /* 길드가 없을 때 이 칸은 «명단» 이 아니라 «모집 목록» 이다 */
    $('sh-mtitle').textContent=guild?'길드 명단':'길드 찾기';
    if(!guild){ $('sh-count').textContent=board.length?board.length+'곳 모집 중':'—';
      $('sh-grole').textContent=''; renderBoard(list); return; }
    var role=myRole(), boss=role==='owner', staff=boss||role==='officer';
    $('sh-gtitle').textContent=guild.name;
    $('sh-gsub').textContent=guild.members.length+'명 · 정원 100명';
    $('sh-ginvite').textContent=guild.code;
    $('sh-grole').textContent=ROLE[role]?'내 권한 '+ROLE[role]:'';
    var ta=$('sh-gnotice');
    if(document.activeElement!==ta) ta.value=guild.notice||'';
    ta.readOnly=!staff;
    ta.placeholder=staff?'공지를 적고 저장하세요 (240자)':'등록된 길드 공지가 없습니다.';
    $('sh-gnsave').hidden=!staff;
    $('sh-gopen').hidden=!staff;
    $('sh-gopen').textContent=guild.open?'공개 모집 닫기':'공개 모집 열기';
    var on=guild.members.filter(function(m){return m.online;}).length;
    $('sh-count').textContent='접속 '+on+' / '+guild.members.length+'명'+(guild.open?' · 모집 중':'');
    /* 관리자에게만 신청 목록이 내려온다 (서버가 거른다) */
    var apps=(staff&&guild.applications||[]).map(function(a){
      return '<div class="mrow2"><span class="mrow2__d"></span>'+
        '<span class="mrow2__n">'+esc(a.name)+
        (a.message?'<div class="arow__msg">'+esc(a.message)+'</div>':'')+'</span>'+
        '<span class="arow__a"><button type="button" class="btn btn--sm" data-a="yes" data-t="'+a.id+'">승인</button>'+
        '<button type="button" class="btn btn--sm" data-a="no" data-t="'+a.id+'">거절</button></span></div>';
    }).join('');
    list.innerHTML=(apps?'<div class="sec">가입 신청 '+guild.applications.length+'건</div>'+apps+'<div class="sec">길드원</div>':'')+
      guild.members.map(function(m){
      var mine=profile&&m.id===profile.id, acts='';
      /* 서버 규칙(rpg-store.guildManage)을 그대로 비춘다:
         길드장만 위임·임원 임명, 임원은 평 길드원만 추방, 길드장은 못 쫓아낸다. */
      if(!mine&&staff){
        if(boss&&m.role==='officer') acts+=btn('member',m.id,'임원 해제');
        if(boss&&m.role==='member')  acts+=btn('officer',m.id,'임원 임명');
        if(boss&&m.role!=='owner')   acts+=btn('transfer',m.id,'길드장 위임');
        if(m.role!=='owner'&&!(role==='officer'&&m.role==='officer')) acts+=btn('kick',m.id,'추방');
      }
      return '<div class="mrow2'+(m.online?' is-on':'')+'"><span class="mrow2__d"></span>'+
        '<span class="mrow2__n">'+esc(m.name)+'</span>'+
        (m.role==='owner'?'<span class="mrow2__t">길드장</span>':
         m.role==='officer'?'<span class="mrow2__t mrow2__t--o">임원</span>':
         CAPTAIN[m.role]&&!boss?'<span class="mrow2__t mrow2__t--c">'+CAPTAIN[m.role]+'</span>':'')+   /* 길드장에게는 아래 선택 칸이 곧 표시 */
        (boss&&!mine&&m.role!=='owner'&&m.role!=='officer'?'<select class="nd-role" data-cap="'+m.id+'" title="대장 임명 (길드장)">'+
          ['member','combat','supply','craft'].map(function(r){ return '<option value="'+r+'"'+((m.role===r||(!CAPTAIN[m.role]&&r==='member'))?' selected':'')+'>'+(CAPTAIN[r]||'대장 없음')+'</option>'; }).join('')+'</select>':'')+
        (acts?'<span class="mrow2__a">'+acts+'</span>':'')+'</div>';
    }).join('');
  }
  function refreshBoard(){ send({type:'rpg',action:'guildBoard'}); }
  function renderBoard(list){
    if(!connected){ list.innerHTML='<div class="chat__empty">접속하면 모집 중인 길드가 표시됩니다.</div>'; return; }
    if(myApp){ list.innerHTML='<div class="chat__empty">'+esc(myApp.name)+
      ' 에 가입을 신청했습니다. 승인을 기다리는 동안에는 다른 곳에 신청할 수 없습니다.</div>'; return; }
    if(!board.length){ list.innerHTML='<div class="chat__empty">공개 모집 중인 길드가 없습니다.'+
      '<br>초대 코드를 받았다면 왼쪽에서 바로 합류할 수 있습니다.'+
      '<br><button type="button" class="btn btn--sm mt3" id="sh-brefresh">새로고침</button></div>'; return; }
    list.innerHTML='<div class="sec">모집 중인 길드 <button type="button" class="btn btn--sm" '+
      'id="sh-brefresh" style="float:right;margin-top:-4px">새로고침</button></div>'+board.map(function(g){
      return '<div class="grow"><span class="grow__m"><svg class="ico"><use href="#i-sigil"/></svg></span>'+
        '<div class="fill"><div class="grow__n">'+esc(g.name)+'</div>'+
        '<div class="grow__s">'+(g.notice?esc(g.notice):'등록된 공지가 없습니다.')+'</div></div>'+
        '<span class="grow__c">'+g.members+' / 100</span>'+
        '<button type="button" class="btn btn--sm" data-g="'+g.id+'">신청</button></div>';
    }).join('')+
    '<div class="applyrow"><div class="field"><input id="sh-appmsg" maxlength="120" '+
    'placeholder="신청 한마디 (선택, 120자) — 신청 버튼과 함께 전달됩니다"></div></div>';
  }
  function btn(op,target,label){
    return '<button type="button" class="btn btn--sm" data-op="'+op+'" data-t="'+target+'">'+label+'</button>';
  }
  function manage(operation,target,value){
    if(!send({type:'rpg',action:'guildManage',operation:operation,target:target,value:value}))
      state('접속한 뒤 이용할 수 있습니다.',true);
  }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  var CHN={world:'월드',guild:'길드',party:'파티',whisper:'귓속말'};
  function renderChat(){
    var log=$('sh-log'), rows=messages.filter(function(m){ return m.channel===channel; });
    if(!rows.length){ log.innerHTML='<div class="chat__empty">'+
      (connected?CHN[channel]+' 채널에 아직 대화가 없습니다.':'접속하면 대화가 표시됩니다.')+'</div>'; return; }
    log.innerHTML=rows.map(function(m){
      /* 귓속말은 «누가 → 누구에게» 를 보여 준다. 내가 보낸 것도 같은 줄로 돌아온다. */
      var who=m.channel==='whisper'&&m.toName
        ? esc(m.name)+' → '+esc(m.toName) : esc(m.name);
      return '<div class="chat__m" data-c="'+m.channel+'"><span class="chat__ch">'+CHN[m.channel]+'</span>'+
        '<span class="chat__who">'+who+'</span> <span class="chat__t">'+esc(m.text)+'</span></div>';
    }).join('');
    log.scrollTop=log.scrollHeight;
  }
  var KIND={friend:'친구',request:'요청',block:'차단'};
  function renderContacts(){
    var box=$('sh-contacts');
    if(!connected){ $('sh-cmeta').textContent='—';
      box.innerHTML='<div class="chat__empty">접속하면 동료 목록이 표시됩니다.</div>'; return; }
    if(!contacts.length){ $('sh-cmeta').textContent='0명';
      box.innerHTML='<div class="chat__empty">캐릭터 이름으로 친구 요청을 보내세요.</div>'; return; }
    var friends=contacts.filter(function(c){return c.kind==='friend';}).length;
    var blocks=contacts.filter(function(c){return c.kind==='block';}).length;
    $('sh-cmeta').textContent='친구 '+friends+' · 차단 '+blocks;
    box.innerHTML=contacts.map(function(c){
      /* 서버 규칙 그대로: 받은 요청만 수락할 수 있고, 차단은 해제만 된다. */
      var acts='';
      if(c.kind==='request'&&c.incoming) acts+=cbtn('accept',c.id,'수락');
      if(c.kind==='friend') acts+=cbtn('whisper',c.id,'귓속말');
      acts+=c.kind==='block'?cbtn('unblock',c.id,'차단 해제')
           :c.kind==='request'?cbtn('remove',c.id,'취소')
           :cbtn('remove',c.id,'삭제');
      if(c.kind==='friend') acts+=cbtn('block',c.id,'차단');
      var label=c.kind==='request'?(c.incoming?'받은 요청':'보낸 요청'):KIND[c.kind];
      return '<div class="crow'+(c.online?' is-on':'')+(c.kind==='block'?' crow--block':'')+'">'+
        '<span class="crow__d"></span><span class="crow__n">'+esc(c.name)+'</span>'+
        '<span class="crow__k">'+label+'</span><span class="crow__a">'+acts+'</span></div>';
    }).join('');
  }
  function cbtn(op,id,label){
    return '<button type="button" class="btn btn--sm" data-c="'+op+'" data-t="'+id+'">'+label+'</button>';
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
        renderProfile(); renderGuild(); renderChat(); presence(1);
        send({type:'rpg',action:'state'});          /* 동료·차단 목록 */
        setTimeout(refreshBoard,260);               /* 모집 목록 — rpg 명령은 120ms 간격 제한이 있다 */
        setTimeout(refreshNode,520);                /* 거점 — node 명령은 200ms 간격 */
        return; }
      if(msg.type==='profile'){ profile=msg.profile; renderProfile(); renderGate(); return; }
      if(msg.type==='guild'){ guild=msg.guild; if(guild) myApp=null; renderGuild(); setTimeout(refreshNode,320); return; }
      if(msg.type==='node'){ node=msg.node; picks=null; renderNode(); return; }
      if(msg.type==='region'){ region=msg.region; renderRegion(); renderAlly(); return; }
      if(msg.type==='ally'){ ally=msg.ally; renderAlly(); return; }
      if(msg.type==='national'){ national=msg.national; renderNational(); return; }
      if(msg.type==='guildRole'){ if(guild) guild.members.forEach(function(m){ if(m.id===msg.target) m.role=msg.role.role==='member'?'member':msg.role.role; });
        renderGuild(); state('직책을 맡겼습니다.'); setTimeout(refreshNode,260); return; }
      if(msg.type==='guildBoard'){ board=msg.guilds||[]; myApp=msg.mine||null; renderGuild(); return; }
      if(msg.type==='board'){ capacity=msg.capacity||capacity; presence(msg.online||0); return; }
      if(msg.type==='chatHistory'){ messages=msg.messages||[]; renderChat(); return; }
      if(msg.type==='chat'){ messages.push(msg.message); if(messages.length>200) messages.shift();
        renderChat(); return; }
      if(msg.type==='rpgNotice'){ state(msg.text); return; }
      if(msg.type==='rpg'){ if(msg.data&&msg.data.contacts){ contacts=msg.data.contacts; renderContacts(); }
        /* 운영 도구는 권한이 있을 때만 드러낸다 — 서버가 어차피 거절하지만 없는 문을 보이지 않는다 */
        if(msg.data&&typeof msg.data.admin==='boolean') $('sh-admin').hidden=!msg.data.admin;
        return; }
      if(msg.type==='state'){ room=msg; return; }
      if(msg.type==='left'){ room=null; return; }
      if(msg.type==='loggedOut'){ stopped=true; connected=false; profile=null; guild=null; room=null;
        messages=[]; contacts=[]; board=[]; myApp=null; store.del(tokenKey); renderGuild(); renderChat(); renderContacts();
        presence(0); state('로그아웃했습니다.'); return; }
      if(msg.type==='error'){ state(msg.message,true); if(!connected){ stopped=true; socket.close(); } }
    });
    socket.addEventListener('close',function(){ connected=false; presence(0); renderGate();
      if(!stopped&&profile){ state('연결을 복구하고 있습니다…'); retry=setTimeout(function(){connect(null);},1500); }
      else if(!profile&&!stopped) state('파티 서버에 연결할 수 없습니다. 서버를 실행한 주소로 열거나 ?server=주소 를 붙이세요.',true); });
    socket.addEventListener('error',function(){ if(!connected)
      state('파티 서버에 연결할 수 없습니다. 서버를 실행한 주소로 열거나 ?server=주소 를 붙이세요.',true); });
  }

  /* ── 거점 조작 ── */
  $('nd-pols').addEventListener('change',function(e){ var id=e.target&&e.target.dataset.p; if(!id||!picks) return;
    picks=e.target.checked?picks.concat([id]):picks.filter(function(x){return x!==id;}); var keep=picks; renderNode(); picks=keep; });
  $('nd-psave').onclick=function(){ ndSend({type:'node',action:'policy',node:'namsan_n01',picks:picks||[]}); };
  $('nd-sgo').onclick=function(){ ndSend({type:'node',action:'supply',node:'namsan_n01',amount:3}); };
  $('sh-members').addEventListener('change',function(e){ var t=e.target; if(!t||!t.dataset||!t.dataset.cap) return;
    ndSend({type:'node',action:'role',target:t.dataset.cap,role:t.value}); });
  window.__ND={ get node(){ return node; }, get region(){ return region; }, get ally(){ return ally; }, get national(){ return national; }, refresh:refreshNode, render:renderNode };

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
  $('sh-gnsave').onclick=function(){ manage('notice',null,$('sh-gnotice').value); };
  $('sh-gopen').onclick=function(){
    var on=!(guild&&guild.open);
    if(!on&&!confirm('공개 모집을 닫습니다. 대기 중인 가입 신청도 함께 정리됩니다. 계속할까요?')) return;
    manage('open',null,on); };
  $('sh-appcancel').onclick=function(){
    if(!send({type:'rpg',action:'guildCancelApply'})) state('접속한 뒤 이용할 수 있습니다.',true); };
  /* 모집 목록의 «신청», 그리고 관리자 화면의 «승인·거절» */
  $('sh-members').addEventListener('click',function(e){
    if(e.target.closest('#sh-brefresh')){ refreshBoard(); return; }
    var g=e.target.closest('[data-g]');
    if(g){ var el=$('sh-appmsg');
      if(!send({type:'rpg',action:'guildApply',guild:g.dataset.g,message:el?el.value.trim():''}))
        state('접속한 뒤 이용할 수 있습니다.',true);
      return; }
    var a=e.target.closest('[data-a]');
    if(a){ var yes=a.dataset.a==='yes';
      if(!yes&&!confirm('가입 신청을 거절합니다. 계속할까요?')) return;
      if(!send({type:'rpg',action:'guildDecide',target:a.dataset.t,accept:yes}))
        state('접속한 뒤 이용할 수 있습니다.',true); }
  });
  $('sh-members').addEventListener('click',function(e){
    var b=e.target.closest('[data-op]'); if(!b||!guild) return;
    var op=b.dataset.op, id=b.dataset.t;
    var who=(guild.members.filter(function(m){return m.id===id;})[0]||{}).name||'길드원';
    /* 추방·위임은 되돌릴 수 없다 — 확인을 받는다. */
    if(op==='kick'&&!confirm(who+' 님을 길드에서 추방합니다. 계속할까요?')) return;
    if(op==='transfer'&&!confirm('길드장을 '+who+' 님에게 넘깁니다. 되돌리려면 새 길드장이 다시 넘겨야 합니다. 계속할까요?')) return;
    manage(op,id,null);
  });
  /* 동료·차단 — 서버의 relationship(request/accept/remove/block/unblock) 을 그대로 쓴다 */
  function social(op,fields){
    if(!send(Object.assign({type:'rpg',action:op},fields)))
      state('접속한 뒤 이용할 수 있습니다.',true);
  }
  function whoField(){ var v=$('sh-who').value.trim(); if(!v) state('캐릭터 이름을 적으세요.',true); return v; }
  $('sh-friend').onclick=function(){ var n=whoField(); if(n) social('request',{name:n}); };
  $('sh-block').onclick=function(){ var n=whoField(); if(!n) return;
    if(!confirm(n+' 님을 차단합니다. 서로 귓속말·친구·파티 초대를 할 수 없게 됩니다. 계속할까요?')) return;
    social('block',{name:n}); };
  $('sh-report').onclick=function(){ var n=whoField(); if(!n) return;
    var reason=prompt('신고 사유를 적어 주세요 (240자 이내).'); if(!reason||!reason.trim()) return;
    social('report',{name:n,reason:reason.trim()}); };
  $('sh-contacts').addEventListener('click',function(e){
    var b=e.target.closest('[data-c]'); if(!b) return;
    var op=b.dataset.c, id=b.dataset.t;
    var who=(contacts.filter(function(c){return c.id===id;})[0]||{}).name||'';
    if(op==='whisper'){ setChannel('whisper'); $('sh-to').value=who; $('sh-text').focus(); return; }
    if(op==='block'&&!confirm(who+' 님을 차단합니다. 계속할까요?')) return;
    if(op==='remove'&&!confirm(who+' 님과의 관계를 정리합니다. 계속할까요?')) return;
    social(op,{target:id});
  });

  $('sh-gcopy').onclick=function(){ var t=$('sh-ginvite').textContent;
    if(navigator.clipboard) navigator.clipboard.writeText(t).then(function(){state('초대 코드를 복사했습니다.');},function(){});
    else state('초대 코드: '+t); };

  $('sh-chtabs').addEventListener('click',function(e){
    var b=e.target.closest('[data-ch]'); if(!b) return;
    setChannel(b.dataset.ch);
  });
  function setChannel(ch){
    channel=ch;
    [].forEach.call($('sh-chtabs').querySelectorAll('.tab'),function(t){
      t.classList.toggle('is-on',t.dataset.ch===ch); });
    document.querySelector('.chat').dataset.ch=ch;   /* 귓속말일 때만 대상 칸이 뜬다 */
    renderChat();
  }
  function say(){
    var text=$('sh-text').value.trim(); if(!text) return;
    if(Date.now()-lastSent<1000){ state('채팅은 1초 간격으로 보낼 수 있습니다.',true); return; }
    /* 귓속말은 채널이 아니라 별도 명령이다 (server/rpg-server.cjs 의 whisper). */
    var ok=channel==='whisper'
      ? (function(){ var to=$('sh-to').value.trim();
          if(!to){ state('받는 캐릭터 이름을 적으세요.',true); return false; }
          return send({type:'rpg',action:'whisper',name:to,text:text}); })()
      : send({type:'chat',channel:channel,text:text});
    if(ok){ lastSent=Date.now(); $('sh-text').value=''; }
    else if(connected===false) state('접속한 뒤 이용할 수 있습니다.',true);
  }
  $('sh-send').onclick=say;
  ['sh-text','sh-to','sh-id','sh-pw','sh-cname','sh-gname','sh-gcode','sh-who'].forEach(function(id){
    $(id).addEventListener('keydown',function(e){ if(e.key!=='Enter') return; e.preventDefault();
      ({'sh-text':say,'sh-to':function(){$('sh-text').focus();},
        'sh-id':function(){account('login');},'sh-pw':function(){account('login');},
        'sh-cname':function(){$('sh-cgo').click();},'sh-gname':function(){$('sh-gcreate').click();},
        'sh-gcode':function(){$('sh-gjoin').click();},'sh-who':function(){$('sh-friend').click();}})[id](); });
  });

  presence(0); renderGate(); renderChat(); renderContacts();
  /* 이미 받아 둔 접속 키가 있으면 바로 붙는다 — 없으면 화면만 보여 준다. */
  if(store.get(tokenKey)) connect(null);
  window.TW_SHELTER={ state:function(){ return {connected:connected,guild:guild,profile:profile,
    channel:channel,messages:messages.length,contacts:contacts,board:board,myApp:myApp}; } };
})();
