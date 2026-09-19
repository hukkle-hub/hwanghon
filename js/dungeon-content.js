/* Dungeon content extends the existing renderer and combat data. */
(function(){
  var levels=window.TW_LEVELS,arenas=window.TW_DUNGEONS.ARENAS;
  levels.d01.attackMotion={'느린 내려찍기':{distance:65,stop:110,at:.65},'찌르기':{distance:115,stop:95,at:.6},'양손 내려찍기':{distance:85,stop:110,at:.65}};
  levels.d02.attackMotion={'돌진 베기':{distance:260,stop:110,at:.48},'대지 강타':{distance:90,stop:140,at:.65},'피의 광란':{distance:100,stop:110,at:.55}};
  arenas.marsh.stages[0].patterns.forEach(function(p){if(p.name==='꼬리 휘두르기')p.disabledBy=['tail'];if(p.name==='돌진 베기')p.disabledBy=['legf'];});
  levels.d01.expedition={nodes:[{id:'training_rest',kind:'checkpoint',cx:9,cy:7,name:'훈련실 앞 보급대',text:'재도전 지점을 기록했다. 회복하고 허수아비에게 가자.'}]};
  levels.d02.expedition={nodes:[
    {id:'marsh_cache',kind:'cache',cx:8,cy:3,name:'정찰대 보급품',text:'젖은 보급품에서 쓸 만한 재료를 챙겼다.',loot:[['m_fiber',4],['m_dew',2]]},
    {id:'marsh_record',kind:'record',cx:23,cy:11,name:'정찰대의 기록',objective:'record',text:'“분지 아래에서 울음소리. 하나가 아니다. 지하로 이어지는 물길이 있다.”',loot:[['q_record',1]]},
    {id:'marsh_valve',kind:'valve',cx:20,cy:7,name:'배수 레버',text:'고인 오염수가 빠졌다. 기록으로 가는 길이 안전해졌다.'},
    {id:'marsh_rest',kind:'checkpoint',cx:24,cy:8,name:'망루의 야영지',text:'재도전 지점을 기록했다. 탐색한 흔적과 회수한 물품은 유지된다.'}
  ],hazards:[{id:'marsh_miasma',cx:22,cy:10,r:115,period:6,warning:1.5,active:2,disabledBy:'marsh_valve',damage:.08,reason:'오염수가 솟을 때 안에 머물렀다. 배수 레버를 찾거나 분출이 잦아들면 지나가라.'}]};
  levels.d02.beats.start='정찰대 흔적을 따라 망루로 · F / 조사 버튼으로 상호작용';
  levels.d02.beats.introHint='보급품과 기록을 찾고, 배수 레버로 위험 구역을 정리해라. 망루 야영지는 재도전 지점이다.';

  var w=48,h=23,grid=Array.from({length:h},function(){return Array(w).fill('#');});
  function room(x1,y1,x2,y2){for(var y=y1;y<=y2;y++)for(var x=x1;x<=x2;x++)grid[y][x]='.';}
  room(1,1,10,21);room(12,1,30,7);room(12,9,30,14);room(12,16,30,21);room(34,2,46,20);
  room(10,4,12,5);room(10,11,12,12);room(10,18,12,19);room(16,7,17,9);room(25,14,26,16);room(30,10,34,12);
  // A narrow final entrance seals cleanly across every traversable tile.
  for(var gy=10;gy<=12;gy++)grid[gy][33]='#';grid[11][33]='G';grid[11][3]='S';grid[11][41]='B';grid[10][4]='s';
  [[6,4],[6,18],[14,3],[27,4],[14,11],[28,12],[15,19],[28,19],[36,4],[44,18]].forEach(function(p){grid[p[1]][p[0]]='t';});
  var source=JSON.parse(JSON.stringify(levels.d01));
  Object.assign(source,{id:'d03',code:'던전 03',name:'2경구 정화장',place:'지하시설 · 오염수 처리 구역',arena:'sewage',env:'bunker',bg:'story-city',diff:'의뢰 A · 지하시설',rows:grid.map(function(r){return r.join('');}),bossRoom:{minCx:34},bossR:72,camDist:8.6,mobs:{},mob:null,
    ai:[{speed:65,keep:155,start:330,pick:'auto'},{speed:95,keep:145,start:360,pick:'auto'}],
    attackMotion:{'압력 망치':{distance:105,stop:115,at:.6}},
    zones:{'압력 망치':{kind:'circle',r:170,fwd:110},'배출관 쓸기':{kind:'circle',r:215,fwd:0},'고압 분사':{kind:'line',len:370,w:100},'과압 폭발':{kind:'circle',r:260,fwd:0}},
    beats:{questTitle:'지하 오염수 처리',start:'세 처리실의 밸브를 잠가라 · 북쪽, 중앙, 남쪽 처리실',gateLocked:'오염원 세 곳을 차단해야 격벽을 열 수 있다.',gate:'격벽이 닫혔다. 남은 압력이 수문기에 몰린다.',sign:'작업 메모 — “북·중앙·남측 밸브를 모두 잠근 뒤 주 펌프를 정지할 것.”',
      dialog:[['마태오','오염원은 세 곳이다. 밸브를 잠가라. 막무가내로 주 펌프에 가면 압력에 휩쓸린다.'],['아인','분출이 멎을 때 움직이면 되겠네요.'],['마태오','안쪽 수문기는 아직 움직인다. 배관을 부수고 핵을 노려라.']],
      intro:'마태오 — “길부터 읽어라. 여기서는 바닥도 적이다.”',introHint:'밸브 3개 차단 → 정비소에서 재정비 → 수문기 격파. F / 조사 버튼으로 상호작용한다.',
      quest:[['오염원 차단',3,'valves'],['주 펌프실 진입',1,'gate'],['오염 수문기 정지',1,'boss'],['정화 장치 회수',1,'purifier',true]],
      phase:['흡입관·배출관을 먼저 부숴라. 주황색 폭발은 튕길 수 없다.', '압력 한계 — 분출을 피하고 반격해라'],enter:['','비상 압력 밸브 해제'],
      death:{k:'쓰러졌다',line:'마태오 — “밸브는 잠겨 있다. 남은 일부터 해라.”',hint:'최근 정비 지점에서 다시 시작한다. 차단한 밸브와 회수품은 유지된다.',btn:'정비 지점에서 재도전'}},
    expedition:{required:['north_valve','middle_valve','south_valve'],nodes:[
      {id:'entry_rest',kind:'checkpoint',cx:6,cy:11,name:'입구 정비대',text:'입구 정비 지점을 기록했다.'},
      {id:'north_valve',kind:'valve',cx:27,cy:3,name:'북측 오염원 차단',objective:'valves',text:'북측 배관 차단. 분출이 멎는다.'},
      {id:'middle_valve',kind:'valve',cx:28,cy:11,name:'중앙 오염원 차단',objective:'valves',text:'중앙 배관 차단. 주 펌프 압력이 떨어진다.'},
      {id:'south_valve',kind:'valve',cx:27,cy:19,name:'남측 오염원 차단',objective:'valves',text:'남측 배관 차단. 이동 경로가 안전해졌다.'},
      {id:'purifier',kind:'cache',cx:14,cy:20,name:'정화 장치 회수',objective:'purifier',text:'보존된 정화 장치를 회수했다. 사무소에서 의뢰와 함께 보고하자.',loot:[['m_core',2],['m_alloy',5]]},
      {id:'pump_rest',kind:'checkpoint',cx:31,cy:11,name:'주 펌프실 정비대',text:'주 펌프실 앞에 재도전 지점을 기록했다.',requires:['north_valve','middle_valve','south_valve']}
    ],hazards:[
      {id:'north_jet',cx:21,cy:4,r:100,period:5,warning:1.2,active:1.6,disabledBy:'north_valve',damage:.10},
      {id:'middle_jet',cx:22,cy:11,r:105,period:4.6,offset:1.3,warning:1.2,active:1.4,disabledBy:'middle_valve',damage:.10},
      {id:'south_jet',cx:21,cy:18,r:100,period:5.2,offset:2,warning:1.4,active:1.6,disabledBy:'south_valve',damage:.10}
    ]},praise:{S:'배관도, 수문기도 정확히 끊었다.',A:'시설이 멎었다. 물길이 다시 흐른다.',B:'살아 돌아왔군. 정화 장치를 점검하자.',C:'간신히 멈췄다. 분출 간격부터 다시 읽어라.'}
  });levels.d03=source;

  /* ── 던전 04 · 3경구 변전소 ─────────────────────────────────────────────
     d03 이 밸브 세 곳을 «병렬»로 잠그는 구조였다면, 여기는 «순차»다.
     축전기 A 충전 → B 충전(A 필요) → 주 차단기 개방(A·B 필요). 방전 구역은
     차단기를 올릴수록 줄어들지만 중앙 모선은 끝까지 살아 있어 타이밍을 봐야 한다. */
  var w4=50,h4=25,g4=Array.from({length:h4},function(){return Array(w4).fill('#');});
  function room4(x1,y1,x2,y2){for(var y=y1;y<=y2;y++)for(var x=x1;x<=x2;x++)g4[y][x]='.';}
  room4(1,9,9,15);                       /* 입구 배전실 */
  room4(11,2,22,8);                      /* 북 축전기 베이 */
  room4(11,16,22,22);                    /* 남 축전기 베이 */
  room4(11,10,30,14);                    /* 중앙 모선 통로 */
  room4(24,3,32,8);                      /* 예비 부품 창고 */
  room4(32,9,38,15);                     /* 차단기실 */
  room4(41,4,48,20);                     /* 보스 홀 */
  room4(9,11,11,13);room4(16,8,18,10);room4(16,14,18,16);room4(26,8,28,10);room4(30,11,32,13);
  /* 보스 홀 진입로는 한 칸만 — 격벽(G)이 유일한 목이여야 한다 */
  for(var y4=9;y4<=15;y4++)for(var x4=39;x4<=40;x4++)g4[y4][x4]='#';
  g4[12][39]='G';g4[12][40]='.';
  g4[12][3]='S';g4[12][45]='B';g4[11][4]='s';
  [[5,10],[5,14],[13,3],[20,3],[13,21],[20,21],[26,4],[31,4],[35,10],[35,14],[43,6],[47,18]].forEach(function(p){g4[p[1]][p[0]]='t';});
  var src4=JSON.parse(JSON.stringify(levels.d01));
  Object.assign(src4,{id:'d04',code:'던전 04',name:'3경구 변전소',place:'지하시설 · 배전 통제 구역',arena:'relay',env:'bunker',bg:'story-city',
    diff:'의뢰 S · 배전 통제', rows:g4.map(function(r){return r.join('');}), bossRoom:{minCx:41},
    ai:[{speed:75,keep:150,start:340,pick:'auto'},{speed:110,keep:135,start:370,pick:'auto'}],
    attackMotion:{'접점 내려찍기':{distance:110,stop:118,at:.6}},
    zones:{'접점 내려찍기':{kind:'circle',r:175,fwd:115},'모선 방전':{kind:'line',len:400,w:110},'접점 쓸기':{kind:'circle',r:225,fwd:0},'과부하 방전':{kind:'circle',r:280,fwd:0}},
    beats:{questTitle:'배전 통제실 정지',
      start:'축전기를 순서대로 충전하고 주 차단기를 올려라 · 북 → 남 → 차단기실',
      gateLocked:'주 차단기를 올려야 보스 홀의 격벽이 열린다.',
      gate:'격벽이 닫혔다. 계전기가 남은 전력을 끌어모은다',
      sign:'배전반의 경고문 — “모선 통전 중. 방전 간격 4초.”',
      mobsClear:'',
      dialog:[['마태오','변전소는 아직 살아 있다. 모선에 손대지 말고 축전기부터 채워라.'],['아인','순서가 있나요?'],['마태오','북쪽을 먼저. 남쪽은 북쪽 전압이 올라야 받는다. 둘 다 차면 차단기실이 열린다.']],
      intro:'마태오 — “여기선 서두르는 쪽이 먼저 탄다.”',
      introHint:'북 축전기 → 남 축전기 → 주 차단기. 파란 방전 예고가 뜨면 물러나라. F / 조사 버튼으로 상호작용한다.',
      quest:[['축전기 충전',2,'cells'],['주 차단기 개방',1,'breaker'],['과부하 계전기 정지',1,'boss'],['예비 접점 회수',1,'spares',true]],
      phase:['접점 두 개를 부수면 방전이 약해진다. 주황 폭발은 튕길 수 없다.','과부하 — 모선이 전부 살아났다. 피하고 반격해라'],
      enter:['','차단기가 되살아난다'],
      death:{k:'쓰러졌다',line:'마태오 — “전기는 기다려 주지 않는다.”',hint:'최근 정비 지점에서 다시 시작한다. 충전한 축전기와 회수품은 유지된다.',btn:'정비 지점에서 재도전'}},
    expedition:{required:['main_breaker'],nodes:[
      {id:'entry_rest',kind:'checkpoint',cx:5,cy:12,name:'입구 배전실',text:'입구 정비 지점을 기록했다.'},
      {id:'cell_north',kind:'valve',cx:20,cy:5,name:'북 축전기 충전',objective:'cells',text:'북 축전기 충전 완료. 남쪽 베이에 전압이 걸린다.'},
      {id:'cell_south',kind:'valve',cx:20,cy:19,name:'남 축전기 충전',objective:'cells',text:'남 축전기 충전 완료. 차단기실 잠금이 풀렸다.',requires:['cell_north']},
      {id:'spares',kind:'cache',cx:29,cy:5,name:'예비 접점 회수',objective:'spares',text:'창고에서 예비 접점을 회수했다. 사무소에 보고하자.',loot:[['m_core',2],['m_shard',3],['m_alloy',6]]},
      {id:'main_breaker',kind:'valve',cx:35,cy:12,name:'주 차단기 개방',objective:'breaker',text:'주 차단기 개방. 보스 홀 격벽이 열린다.',requires:['cell_north','cell_south']},
      {id:'breaker_rest',kind:'checkpoint',cx:37,cy:12,name:'차단기실 정비대',text:'차단기실 앞에 재도전 지점을 기록했다.',requires:['main_breaker']}
    ],hazards:[
      {id:'bus_mid',cx:24,cy:12,r:112,period:4,warning:1.1,active:1.5,damage:.11,reason:' 중앙 모선은 끝까지 통전된다. 예고 뒤 빈틈에 지나가라.'},
      {id:'arc_north',cx:16,cy:5,r:98,period:4.8,offset:1.1,warning:1.2,active:1.5,disabledBy:'cell_north',damage:.10},
      {id:'arc_south',cx:16,cy:19,r:98,period:5.2,offset:2.2,warning:1.3,active:1.5,disabledBy:'cell_south',damage:.10},
      {id:'arc_breaker',cx:33,cy:12,r:104,period:4.4,offset:.7,warning:1.1,active:1.4,disabledBy:'main_breaker',damage:.12}
    ]},
    praise:{S:'차단기도, 계전기도 한 번에 끊었다.',A:'전력이 죽었다. 3경구가 조용해졌다.',B:'살아 나왔군. 접점부터 다시 보자.',C:'간신히 내렸다. 방전 간격을 먼저 읽어라.'}
  });levels.d04=src4;

  function stage4(rage){return {id:rage?'overload':'relay',kind:rage?'rage':'relay',name:rage?'과부하 계전기':'계전기',
    lesson:rage?'회피와 반격':'접점 파괴',hp:rage?260000:360000,timeLimit:rage?150:220,patternGap:rage?.95:1.45,
    counterWindow:rage?.14:.16,perfectWindow:.04,allBrokenDown:true,
    discipline:{normal:.3,skill:.65,partMult:1.3,precisePartMult:1.6,breakBurst:2.5,exposed:1.8,evadeMult:2.2,evadeWindow:.85},
    parts:rage?[{id:'core',name:'방전 코일',weak:true,hp:null},{id:'body',name:'애자 기둥',hp:null}]:[
      {id:'contactl',name:'좌 접점',hp:42000,breakable:true,onBreak:{zoneScale:.78},pos:'tl'},
      {id:'contactr',name:'우 접점',hp:42000,breakable:true,onBreak:{slow:.62,telePlus:.12},pos:'tr'},
      {id:'core',name:'방전 코일',weak:true,hp:null,guardedBy:['contactl','contactr'],guardReduce:.6},
      {id:'body',name:'애자 기둥',hp:null}],
    /* 연계·지연타: docs/design/18-boss-fight-design.md §2.
       내려찍기는 접점을 부수면 그 타격이 통째로 빠진다 — 파괴가 연계를 짧게 만든다. */
    patterns:[
      {name:'접점 내려찍기',icon:'hammer',tele:rage?.85:1.2,dmg:rage?6800:5400,posture:35,guardCost:28,recovery:.8,range:'near',
       chain:rage?[{tele:.5,dmg:5200,posture:28,gap:.2,icon:'hammerL',disabledBy:['contactl']},{tele:.5,dmg:5600,posture:30,gap:.2,icon:'hammerC',disabledBy:['contactr']}]
                 :[{tele:.6,dmg:4200,posture:28,gap:.24,icon:'hammerL',disabledBy:['contactl']}]},
      {name:'모선 방전',icon:'bolt',tele:rage?1.15:1.5,dmg:rage?6200:5000,posture:30,guardCost:32,recovery:.8,range:'far',disabledBy:rage?[]:['contactl'],
       hold:{at:.5,dur:rage?.35:.45}},
      {name:'접점 쓸기',icon:'scythe',tele:rage?.95:1.3,dmg:rage?7000:5600,posture:32,guardCost:30,recovery:.9,range:'near',disabledBy:rage?[]:['contactr'],
       chain:[{tele:.55,dmg:rage?5600:4400,posture:26,gap:.2}]},
      {name:'과부하 방전',icon:'flame',tele:rage?1.3:1.65,dmg:rage?8600:6900,counterable:false,unblockable:true,recovery:1.15,range:'any'}],
    hint:'접점 파괴로 약화 · 주황 폭발은 회피 · 실패하면 정비 지점에서 재도전',
    line:rage?'전압이 한계를 넘는다.':'계전기가 깨어난다.',mastery:[]};}

  arenas.relay={id:'relay',name:'3경구 변전소',place:src4.place,char:'ain',hudName:'과부하 계전기',
    procedural:'relay',rigidRig:true,pieces:'nodes',
    tint:{relay:0xc4d2e0,rage:0xffc0a8},glow:{relay:.7,rage:1.4},
    parts3d:{core:{bone:'Core',off:[0,0,.4],r:.45},head:{bone:'Head',off:[0,0,0],r:.4},body:{bone:'Spine',off:[0,0,.6],r:.9},
      contactl:{bone:'ContactL',off:[0,-.3,.2],r:.55},contactr:{bone:'ContactR',off:[0,-.3,.2],r:.55}},
    atk:{hammer:{clip:'atk_slam',hitFrac:.47},bolt:{clip:'atk_arc',hitFrac:.49},scythe:{clip:'atk_sweep',hitFrac:.53},flame:{clip:'atk_surge',hitFrac:.52},
      hammerL:{clip:'atk_slam_l',hitFrac:.45},hammerC:{clip:'atk_slam_c',hitFrac:.46}},   /* 연계 2·3타 전용 모션 */
    rewards:{gold:3600,items:[['m_alloy',16],['m_ore',18],['m_core',2]],sBonus:[['m_heart',1]]},
    /* 광란 페이즈: 바닥 모선이 살아난다 — 네 구역이 번갈아 방전한다 */
    stageFx:[null,{light:0.86,fog:1.28,sky:0x0d1014,color:0x7FC8FF,line:'바닥 모선에 전압이 걸렸다 — 방전 자리를 피해라',
      reason:'바닥 모선에 감전됐다. 파란 원이 켜지기 전에 비켜라.',
      hazards:[{dx:-210,dy:-120,r:135,period:3.6,warning:1.0,active:1.2,offset:0,damage:0.07},
               {dx: 210,dy:-120,r:135,period:3.6,warning:1.0,active:1.2,offset:0.9,damage:0.07},
               {dx:-210,dy: 130,r:135,period:3.6,warning:1.0,active:1.2,offset:1.8,damage:0.07},
               {dx: 210,dy: 130,r:135,period:3.6,warning:1.0,active:1.2,offset:2.7,damage:0.07}]}],
    stages:[stage4(false),stage4(true)]};

  function stage(rage){return {id:rage?'overpressure':'pressure',kind:rage?'rage':'pump',name:rage?'과압 수문기':'오염 수문기',lesson:rage?'회피와 반격':'배관 파괴',hp:rage?210000:300000,timeLimit:rage?150:210,patternGap:rage?1:1.5,counterWindow:rage?.14:.18,perfectWindow:.04,
    discipline:{normal:.3,skill:.65,partMult:1.3,precisePartMult:1.6,breakBurst:2.5,exposed:1.8,evadeMult:2.2,evadeWindow:.85},
    parts:rage?[{id:'core',name:'과압 핵',weak:true,hp:null},{id:'body',name:'주 펌프',hp:null}]:[
      {id:'intake',name:'흡입관',hp:36000,breakable:true,onBreak:{slow:.6},pos:'tl'},
      {id:'exhaust',name:'배출관',hp:36000,breakable:true,onBreak:{zoneScale:.75},pos:'tr'},
      {id:'core',name:'압력 핵',weak:true,hp:null,guardedBy:['intake','exhaust'],guardReduce:.6},
      {id:'body',name:'주 펌프',hp:null}],
    /* 연계·지연타: docs/design/18-boss-fight-design.md §2. 흡입관을 부수면 망치의 되돌림이 빠진다 */
    patterns:[{name:'압력 망치',icon:'hammer',tele:rage?.9:1.25,dmg:rage?6200:5000,posture:35,guardCost:28,recovery:.8,range:'near',
       chain:[{tele:.6,dmg:rage?4800:3900,posture:26,gap:.24,icon:'hammerB',disabledBy:['intake']}]},
      {name:'고압 분사',icon:'bolt',tele:rage?.85:1.15,dmg:rage?5700:4600,posture:30,guardCost:30,recovery:.8,range:'far',disabledBy:rage?[]:['exhaust'],
       chain:[{tele:.45,dmg:rage?4600:3700,posture:24,gap:.16},{tele:.45,dmg:rage?4600:3700,posture:24,gap:.16}]},
      {name:'배출관 쓸기',icon:'scythe',tele:rage?1.25:1.6,dmg:rage?6500:5300,posture:30,guardCost:30,recovery:.9,range:'near',disabledBy:rage?[]:['exhaust'],
       hold:{at:.6,dur:.3}},
      {name:'과압 폭발',icon:'flame',tele:rage?1.35:1.7,dmg:rage?8000:6500,counterable:false,unblockable:true,recovery:1.1,range:'any'}],
    hint:'배관 파괴로 약화 · 주황 폭발은 회피 · 실패하면 정비 지점에서 재도전',line:'압력이 차오른다.',mastery:[]};}
  arenas.sewage={id:'sewage',name:'2경구 정화장',place:source.place,char:'ain',hudName:'오염 수문기',procedural:'pump',rigidRig:true,pieces:'nodes',tint:{pump:0xbed0c0,rage:0xffb0a0},glow:{pump:.6,rage:1.3},
    parts3d:{core:{bone:'Core',off:[0,0,.4],r:.45},head:{bone:'Head',off:[0,0,0],r:.4},body:{bone:'Spine',off:[0,0,.6],r:.9},intake:{bone:'Intake',off:[0,-.1,.2],r:.55},exhaust:{bone:'Exhaust',off:[0,-.1,.2],r:.55}},
    atk:{hammer:{clip:'atk_hammer',hitFrac:.45},bolt:{clip:'atk_bolt',hitFrac:.45},scythe:{clip:'atk_scythe',hitFrac:.5},flame:{clip:'atk_flame',hitFrac:.5},
      hammerB:{clip:'atk_hammer_back',hitFrac:.4}},   /* 연계 2타: 되돌림 망치 */
    rewards:{gold:2400,items:[['m_alloy',12],['m_ore',15],['m_oil',2]],sBonus:[['m_core',2]]},
    /* 광란 페이즈: 배수구에서 오염수가 분출한다 */
    stageFx:[null,{light:0.88,fog:1.30,sky:0x0f1512,color:0x8FD06A,line:'배수구가 터진다 — 분출 자리를 피해라',
      reason:'오염수 분출에 맞았다. 초록 원이 켜지기 전에 비켜라.',
      hazards:[{dx:-190,dy:-100,r:125,period:4.0,warning:1.1,active:1.3,offset:0,damage:0.07},
               {dx: 200,dy: -60,r:125,period:4.0,warning:1.1,active:1.3,offset:1.3,damage:0.07},
               {dx: -40,dy: 190,r:145,period:4.6,warning:1.2,active:1.4,offset:2.6,damage:0.08}]}],
    stages:[stage(false),stage(true)]};
})();
