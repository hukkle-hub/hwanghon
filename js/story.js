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
    { id:'ch3', name:'3장', title:'지하 오염수 처리', art:'story-city', quest:'q_sewage', locked:true,
      lines:[ ['narr','2경구 정화장 — 다음 장에서 계속.'] ] }
  ];
  function ch(id){ return CHAPTERS.filter(function(c){ return c.id===id; })[0]; }
  function flag(k,v){ return SV ? SV.flag(k,v) : false; }
  function arenaRec(id){ try{ return JSON.parse(localStorage.getItem('tw:arena:'+id)||'null'); }catch(e){ return null; } }
  function cleared(id){ var r=arenaRec(id); return !!(r&&r.cleared); }
  /* ---------- 의뢰 상태 ---------- */
  var QUEST_ARENA={ q_marsh:'marsh' };
  function questState(qid){ var a=QUEST_ARENA[qid]; if(!a) return 'locked'; if(flag('claim_'+qid)) return 'claimed'; if(cleared(a)) return 'cleared'; return 'available'; }
  function rnd(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }
  function claim(qid){ if(questState(qid)!=='cleared') return null; var q=W.quest(qid); var got=[]; if(SV) SV.addGold(q.reward); got.push(['gold', q.reward]);
    (q.rewards||[]).forEach(function(r){ var n=r[1]; if(typeof n==='string'){ var m=n.match(/(\d+)~(\d+)/); n=m?rnd(+m[1],+m[2]):parseInt(n,10)||1; }
      if(r[0]==='exp'){ if(SV) SV.addXp(n); got.push(['exp', n]); return; }
      if(window.TW_LOOT) TW_LOOT.grant([[r[0], n]]); else if(SV) SV.addItem(r[0], n); got.push([r[0], n]); });
    flag('claim_'+qid, true); try{ document.dispatchEvent(new CustomEvent('tw:wallet', { detail:{ gold:q.reward } })); }catch(e){} return got; }
  function chapterState(c){ if(c.locked) return 'locked'; if(flag(c.flag)) return 'done'; if(c.arena && cleared(c.arena)) return 'cleared'; return 'available'; }
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
  window.TW_STORY={ CHAPTERS:CHAPTERS, NPC:NPC, play:play, once:once, brief:brief, afterClear:afterClear, questState:questState, claim:claim, chapterState:chapterState, cleared:cleared, stateLabel:stateLabel, ch:ch };
})();
