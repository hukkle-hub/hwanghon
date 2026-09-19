/* 황혼 — 이야기·의뢰 진행 (4단계)
   window.TW_STORY = { CHAPTERS, NPC, play(lines, done), once(flag, lines, done), questState(qid), claim(qid), chapterState(ch), brief(chId, done), afterClear(arenaId, done) }
   · 진행 상태는 save.js flags 에 둔다: ch_prologue · ch_1 · ch_2 · brief_<장> · claim_<의뢰>
   · 대사 줄: [화자, 문장]. 화자 'narr' = 지문, 'record' = 문서(정찰대의 기록) */
(function(){
  var SV=window.TW_SAVE, W=window.TW_WORLD, T=window.TW_ITEMS;
  var NPC={ matteo:{ nm:'마태오', sub:'인력사무소 소장', face:'art/face-matteo.webp' }, ain:{ nm:'아인', sub:'요원', face:'art/face-ain.webp' }, kain:{ nm:'카인', sub:'대장간', face:'art/face-kain.webp' }, sera:{ nm:'세라', sub:'정제사', face:'art/face-sera.webp' }, ryu:{ nm:'류', sub:'레인저', face:'art/face-ryu.webp' }, narr:{ nm:'', face:null }, record:{ nm:'정찰대의 기록', face:'art/items/q_record.svg' } };
  var CHAPTERS=[
    { id:'prologue', name:'프롤로그', title:'황혼의 도시', art:'story-city', flag:'ch_prologue',
      lines:[ ['narr','도시는 세 번의 밤 만에 무너졌다. 남은 것은 갈대밭과 폐허, 그리고 그 사이를 걷는 변이체들.'],
              ['narr','살아남은 이들은 마태오의 인력사무소에 모였다. 의뢰를 받고, 낫을 들고, 돌아오는 사람만이 내일을 산다.'],
              ['matteo','아인. 네 낫이 닿는 곳까지가 네 세상이다. 그 이상은 욕심 부리지 마라.'],
              ['ain','…돌아올게요. 항상 그랬듯이.'] ] },
    { id:'ch1', name:'1장', title:'지하 훈련장', art:'lobby-city', arena:'tutorial', dungeon:'game3d.html', flag:'ch_1',
      brief:[ ['matteo','사무소 지하에 허수아비를 묶어 뒀다. 살아 있는 것처럼 굴 테니, 살아 있는 것처럼 상대해라.'],
              ['matteo','예고가 끝나는 순간에 쳐라. 그게 카운터다. 그걸 못 하면 습지에는 못 보낸다.'] ],
      after:[ ['matteo','됐다. 낫이 손에 붙었군.'],
              ['matteo','의뢰 목록을 열어 두겠다. 첫 의뢰는 갈대습지다 — 정찰대 넷이 들어가서 하나도 안 나왔다.'] ] },
    { id:'ch2', name:'2장', title:'메마른 갈대밭 정찰', art:'boss-marsh', quest:'q_marsh', arena:'marsh', dungeon:'game3d.html?d=d02', flag:'ch_2',
      brief:[ ['matteo','갈대습지 북동쪽. 정찰대 신호가 끊긴 자리다. 대형 변이체다.'],
              ['matteo','놈은 돌진하고, 땅을 부수고, 꼬리로 뒤를 쓴다. 옆으로 구르고, 부위를 부숴라.'],
              ['ain','정찰대는요?'],
              ['matteo','…기록이라도 찾아 와라.'] ],
      after:[ ['matteo','모르버스를 잡았다고? …앉아라.'],
              ['matteo','정찰대는 못 돌아온다. 하지만 네가 가져온 기록이 있으면, 그들이 본 것을 알 수 있다.'],
              ['record','“분지 아래에서 울음소리. 하나가 아니다. 지하로 이어지는 물길이 있다. 신호가… ”'],
              ['matteo','지하 오염수 처리 — 2경구 정화장. 다음 의뢰다. 준비되면 말해라.'] ],
      afterNoRecord:[ ['matteo','모르버스를 잡았다고? …앉아라.'],
              ['matteo','정찰대의 기록은 못 찾았군. 습지에 다시 가면 갈대 사이를 살펴라. 그들이 본 것을 알아야 다음이 보인다.'] ] },
    { id:'ch3', name:'3장', title:'지하 오염수 처리', art:'story-city', quest:'q_sewage', arena:'sewage', dungeon:'game3d.html?d=d03', flag:'ch_3',
      brief:[['matteo','정화장 하부의 오염원을 세 곳 모두 차단해라. 북측, 중앙, 남측 처리실이다.'],['ain','주 펌프는요?'],['matteo','배관을 끊으면 수문기도 약해진다. 정화 장치가 남아 있으면 가져와라.']],
      after:[['matteo','역류가 멎었다. 오늘은 하부 구역에도 깨끗한 물을 보낼 수 있겠군.'],['ain','수문기를 멈췄어요. 밸브도 전부 잠갔고요.'],['matteo','잘했다. 보수를 챙겨라. 다음 출격 전에 장비부터 손봐.']] },
    { id:'ch4', name:'4장', title:'배전 통제실 정지', art:'story-city', quest:'q_relay', arena:'relay', dungeon:'game3d.html?d=d04', flag:'ch_4',
      brief:[['matteo','3경구 변전소가 꺼지지 않는다. 계전기가 전력을 끌어모으고 있어.'],['ain','차단기를 내리면 되는 거 아니에요?'],['matteo','순서가 틀리면 역전류로 타 죽는다. 북쪽 축전기부터 채워라. 남쪽은 그 다음이다.'],['matteo','중앙 모선은 끝까지 살아 있다. 방전 간격을 세고 지나가.']],
      after:[['matteo','3경구가 조용해졌다. 이제 밤에도 불이 안 켜지겠군.'],['ain','계전기는 멈췄어요. 접점은 둘 다 부졌고요.'],['matteo','예비 접점을 가져왔으면 공방으로 돌려라. 그걸로 다음 장비를 만든다.']] },
    { id:'ch5', name:'5장', title:'변이체 토벌: 식인초', art:'boss-anatomy', quest:'q_plant', arena:'grove', dungeon:'game3d.html?d=d05', flag:'ch_5',
      brief:[['matteo','식물원이 통째로 둥지가 됐다. 군락이 다섯, 전부 태워라.'],['ain','순서가 있나요?'],['matteo','없다. 대신 안 태운 군락은 계속 포자를 뿜는다 — 길이 좁아진다는 뜻이야.'],['matteo','안쪽에 뿌리가 다 모이는 놈이 있다. 덩굴 두 갈래를 먼저 끊어라.']],
      after:[['matteo','포자가 걷혔다고? 그럼 물도 다시 끌어올 수 있겠군.'],['ain','모근체는 태웠어요. 씨앗 표본도 몇 개 건졌고요.'],['matteo','씨앗은 세라한테 넘겨라. 약을 만들 수 있으면 다음 의뢰가 덜 아프다.'],['matteo','…그리고 보급이 또 끊겼다. 수송로다. 준비되면 말해라.']] },
    { id:'ch6', name:'6장', title:'파괴된 수송로 확보', art:'lobby-city', quest:'q_road', arena:'road', dungeon:'game3d.html?d=d06', flag:'ch_6',
      brief:[['matteo','보급이 끊긴 건 길이 끊겼기 때문이다. 잔해 세 무더기를 치워라.'],['ain','기중기는요?'],['matteo','한 대뿐이다. 구간마다 조작대로 돌아와서 다시 걸어야 해. 왕복이 길다.'],['matteo','머리 위 상판이 내려앉는다. 진동이 오면 멈춰 서라 — 뛰지 말고.']],
      after:[['matteo','길이 뚫렸다. 오늘 밤엔 수레가 들어온다.'],['ain','기갑은 멈췄어요. 턱이랑 평형추, 둘 다 뜯어냈고요.'],['matteo','그 쇳덩이는 공방 몫이다. 카인이 좋아하겠군.'],['matteo','앉아라, 아인. 길이 열렸으니 이제 «밖» 얘기를 할 때가 됐다.']] }

  ];
  function ch(id){ return CHAPTERS.filter(function(c){ return c.id===id; })[0]; }
  function flag(k,v){ return SV ? SV.flag(k,v) : false; }
  function arenaRec(id){ try{ return JSON.parse(localStorage.getItem('tw:arena:'+id)||'null'); }catch(e){ return null; } }
  function cleared(id){ var r=arenaRec(id); return !!(r&&r.cleared); }
  /* ---------- 의뢰 상태 ---------- */
  var QUEST_ARENA={q_marsh:'marsh',q_sewage:'sewage',q_relay:'relay',q_plant:'grove',q_road:'road'},
      QUEST_REQUIRED={q_marsh:'tutorial',q_sewage:'marsh',q_relay:'sewage',q_plant:'relay',q_road:'grove'};
  function routeForQuest(id){return CHAPTERS.find(function(c){return c.quest===id&&!c.locked;})||null;}
  function questState(qid){ var a=QUEST_ARENA[qid]; if(!a) return 'locked'; if(flag('claim_'+qid)) return 'claimed'; if(cleared(a)) return 'cleared';if(QUEST_REQUIRED[qid]&&!cleared(QUEST_REQUIRED[qid]))return 'locked'; return 'available'; }
  function rnd(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }
  function claim(qid){ if(questState(qid)!=='cleared') return null; var q=W.quest(qid); var got=[]; if(SV) SV.addGold(q.reward); got.push(['gold', q.reward]);
    (q.rewards||[]).forEach(function(r){ var n=r[1]; if(typeof n==='string'){ var m=n.match(/(\d+)~(\d+)/); n=m?rnd(+m[1],+m[2]):parseInt(n,10)||1; }
      if(r[0]==='exp'){ if(SV) SV.addXp(n); got.push(['exp', n]); return; }
      if(window.TW_LOOT) TW_LOOT.grant([[r[0], n]]); else if(SV) SV.addItem(r[0], n); got.push([r[0], n]); });
    flag('claim_'+qid, true); try{ document.dispatchEvent(new CustomEvent('tw:wallet', { detail:{ gold:q.reward } })); }catch(e){} return got; }
  function chapterState(c){ if(c.quest&&questState(c.quest)==='locked')return 'locked'; if(c.locked) return 'locked'; if(flag(c.flag)) return 'done'; if(c.arena && cleared(c.arena)) return 'cleared'; return 'available'; }
  /* ---------- 대사 오버레이 ---------- */
  var cur=null;
  function play(lines, done, opts){ opts=opts||{}; if(cur) close(); var box=document.createElement('div'); box.className='sdlg'; box.innerHTML='<div class="sdlg__box"><button type="button" class="btn btn--sm sdlg__skip">건너뛰기</button><img class="sdlg__face" alt=""><div class="fill"><div class="sdlg__who"></div><div class="sdlg__txt"></div><div class="sdlg__hint">탭하여 계속</div></div></div>';
    document.body.appendChild(box); cur={ box:box, lines:lines, i:0, done:done };
    function show(){ var l=cur.lines[cur.i], n=NPC[l[0]]||{ nm:l[0], face:null }; var face=box.querySelector('.sdlg__face'), who=box.querySelector('.sdlg__who'), txt=box.querySelector('.sdlg__txt');
      if(n.face){ face.src=n.face; face.style.display=''; } else face.style.display='none'; who.textContent=n.nm+(n.sub?' · '+n.sub:''); who.style.display=n.nm?'':'none'; txt.textContent=l[1]; txt.classList.toggle('is-record', l[0]==='record'); txt.classList.toggle('is-narr', l[0]==='narr'); box.querySelector('.sdlg__hint').textContent=cur.i<cur.lines.length-1?'탭하여 계속':'탭하여 닫기'; if(window.TW_SFX) TW_SFX.play('ui'); }
    function next(){ if(!cur) return; cur.i++; if(cur.i>=cur.lines.length) close(true); else show(); }
    function close(fin){ var d=cur&&cur.done; if(cur&&cur.box.parentNode) cur.box.parentNode.removeChild(cur.box); cur=null; if(d) d(!!fin); }
    box.addEventListener('click', function(e){ if(e.target.closest('.sdlg__skip')){ close(true); return; } next(); });
    document.addEventListener('keydown', function onk(e){ if(!cur){ document.removeEventListener('keydown', onk); return; } if(e.code==='Space'||e.code==='Enter'){ e.preventDefault(); next(); } });
    show(); return cur; }
  function once(key, lines, done){ if(flag(key)){ done&&done(false); return false; } play(lines, function(){ flag(key, true); done&&done(true); }); return true; }
  function brief(chId, done){ var c=ch(chId); if(!c||!c.brief) { done&&done(false); return false; } return once('brief_'+chId, c.brief, done); }
  /* 던전 클리어 뒤 사무실에서: 해당 장의 후일담 (기록 유무에 따라 분기) */
  function afterClear(arenaId, done){ var c=CHAPTERS.filter(function(x){ return x.arena===arenaId; })[0]; if(!c||!cleared(arenaId)||flag(c.flag)){ done&&done(false); return false; }
    var hasRec=!!(SV&&SV.get().bag&&SV.get().bag.q_record); var lines=(c.afterNoRecord&&!hasRec)?c.afterNoRecord:c.after; play(lines, function(){ if(!(c.afterNoRecord&&!hasRec)) flag(c.flag, true); done&&done(true); }); return true; }
  function stateLabel(st){ return { locked:'잠김', available:'수행 가능', cleared:'완료 · 보수 미수령', claimed:'보수 수령 완료', done:'완료' }[st]||st; }
  window.TW_STORY={ CHAPTERS:CHAPTERS, routeForQuest:routeForQuest, NPC:NPC, play:play, once:once, brief:brief, afterClear:afterClear, questState:questState, claim:claim, chapterState:chapterState, cleared:cleared, stateLabel:stateLabel, ch:ch };
})();
