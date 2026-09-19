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
    lesson:rage?'회피와 반격':'접점 파괴',hp:rage?220000:360000,timeLimit:rage?150:220,patternGap:rage?.95:1.45,
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

  /* ── 던전 05 · 버려진 식물원 ───────────────────────────────────────────────
     d03 은 밸브 세 곳을 «병렬» 로, d04 는 축전기를 «순차» 로 잠갔다. 여기는 «넓게 흩어진» 구조다.
     군락 다섯 곳이 온실 전체에 퍼져 있고 순서가 없다 — 어느 것부터 태워도 되지만,
     태우지 않은 군락은 계속 포자를 뿜는다. 길을 고르는 문제지 순서를 외우는 문제가 아니다. */
  var w5=46,h5=24,g5=Array.from({length:h5},function(){return Array(w5).fill('#');});
  function room5(x1,y1,x2,y2){for(var y=y1;y<=y2;y++)for(var x=x1;x<=x2;x++)g5[y][x]='.';}
  room5(1,10,8,15);                      /* 입구 관리동 */
  room5(10,2,20,9);                      /* 북 온실 */
  room5(10,15,20,22);                    /* 남 온실 */
  room5(10,11,28,14);                    /* 중앙 통로 */
  room5(22,2,30,9);                      /* 종자 보관동 */
  room5(22,15,30,22);                    /* 퇴비장 */
  room5(32,8,37,17);                     /* 분수 광장 */
  room5(40,3,44,21);                     /* 보스 온실 */
  room5(8,11,10,13);room5(15,9,17,11);room5(15,14,17,16);room5(25,9,27,11);room5(25,14,27,16);room5(28,11,32,13);
  /* 보스 온실 진입로는 한 칸 — 격벽(G)이 유일한 목이다 */
  for(var y5=8;y5<=17;y5++)for(var x5=38;x5<=39;x5++)g5[y5][x5]='#';
  g5[12][38]='G';g5[12][39]='.';
  g5[12][3]='S';g5[12][42]='B';g5[11][4]='s';
  [[6,11],[4,14],[12,4],[18,4],[12,20],[18,20],[24,4],[28,20],[34,10],[34,15],[42,5],[42,19]].forEach(function(p){g5[p[1]][p[0]]='t';});
  var src5=JSON.parse(JSON.stringify(levels.d01));
  Object.assign(src5,{id:'d05',code:'던전 05',name:'버려진 식물원',place:'외곽지대 · 폐 온실 단지',arena:'grove',env:'swamp',bg:'boss-anatomy',
    diff:'의뢰 B · 외곽지대', rows:g5.map(function(r){return r.join('');}), bossRoom:{minCx:40}, camDist:8.4,
    ai:[{speed:70,keep:160,start:340,pick:'auto'},{speed:100,keep:140,start:360,pick:'auto'}],
    attackMotion:{'덩굴 후려치기':{distance:120,stop:112,at:.55},'아가리 내려찍기':{distance:95,stop:120,at:.62}},
    zones:{'덩굴 후려치기':{kind:'line',len:340,w:96},'아가리 내려찍기':{kind:'circle',r:165,fwd:110},'뿌리 쓸기':{kind:'circle',r:230,fwd:0},'포자 분출':{kind:'circle',r:270,fwd:0}},
    beats:{questTitle:'변이체 토벌: 식인초',
      start:'퍼져 있는 군락 다섯 곳을 태워라 · 순서는 없다',
      gateLocked:'군락이 살아 있는 한 안쪽 온실 문은 열리지 않는다.',
      gate:'문이 닫혔다. 뿌리가 바닥을 타고 모여든다',
      sign:'관리동 메모 — “종자는 북쪽 보관동. 포자는 바람을 타니 정면에서 태우지 말 것.”',
      mobsClear:'',
      dialog:[['마태오','식물원이 통째로 둥지가 됐다. 군락이 다섯, 전부 태워라.'],['아인','순서가 있나요?'],['마태오','없다. 대신 안 태운 군락은 계속 포자를 뿜는다 — 길이 좁아진다는 뜻이야.'],['마태오','안쪽에 뿌리가 다 모이는 놈이 있다. 그놈이 본체다.']],
      intro:'마태오 — “숨을 아껴라. 여기선 공기가 적이다.”',
      introHint:'군락 5곳 소각 → 안쪽 온실 진입. F / 조사 버튼으로 상호작용한다.',
      quest:[['군락 소각',5,'nests'],['본체 온실 진입',1,'gate'],['모근체 격파',1,'boss'],['씨앗 표본 채집',1,'seeds',true]],
      phase:['덩굴 두 갈래를 먼저 끊어라. 연두색 분출은 튕길 수 없다.','포자가 터진다 — 자리를 피하고 반격해라'],
      enter:['','포자낭이 부풀어 오른다'],
      death:{k:'쓰러졌다',line:'마태오 — “포자를 마셨군. 태운 군락은 그대로다.”',hint:'최근 정비 지점에서 다시 시작한다. 태운 군락과 회수품은 유지된다.',btn:'정비 지점에서 재도전'}},
    expedition:{required:['nest_nw','nest_ne','nest_sw','nest_se','nest_mid'],nodes:[
      {id:'entry_rest',kind:'checkpoint',cx:5,cy:12,name:'관리동 정비대',text:'입구 정비 지점을 기록했다.'},
      {id:'nest_nw',kind:'valve',cx:13,cy:5,name:'북서 군락 소각',objective:'nests',text:'북서 군락을 태웠다. 포자가 멎는다.'},
      {id:'nest_ne',kind:'valve',cx:27,cy:5,name:'북동 군락 소각',objective:'nests',text:'북동 군락을 태웠다. 보관동 쪽이 트인다.'},
      {id:'nest_sw',kind:'valve',cx:13,cy:19,name:'남서 군락 소각',objective:'nests',text:'남서 군락을 태웠다.'},
      {id:'nest_se',kind:'valve',cx:27,cy:19,name:'남동 군락 소각',objective:'nests',text:'남동 군락을 태웠다. 퇴비장이 조용해졌다.'},
      {id:'nest_mid',kind:'valve',cx:34,cy:12,name:'분수 광장 군락 소각',objective:'nests',text:'마지막 군락. 안쪽 온실 문이 열린다.'},
      {id:'seeds',kind:'cache',cx:24,cy:4,name:'씨앗 표본 채집',objective:'seeds',text:'보관동에서 온전한 씨앗 표본을 챙겼다.',loot:[['m_dew',4],['m_fiber',8]]},
      {id:'grove_rest',kind:'checkpoint',cx:36,cy:12,name:'분수 광장 야영지',text:'안쪽 온실 앞에 재도전 지점을 기록했다.',requires:['nest_mid']}
    ],hazards:[
      {id:'spore_nw',cx:16,cy:5,r:104,period:4.4,warning:1.2,active:1.5,disabledBy:'nest_nw',damage:.09},
      {id:'spore_ne',cx:24,cy:6,r:104,period:4.8,offset:1.2,warning:1.2,active:1.5,disabledBy:'nest_ne',damage:.09},
      {id:'spore_sw',cx:16,cy:19,r:104,period:4.6,offset:2.1,warning:1.3,active:1.5,disabledBy:'nest_sw',damage:.09},
      {id:'spore_se',cx:24,cy:18,r:104,period:5.0,offset:.6,warning:1.3,active:1.5,disabledBy:'nest_se',damage:.09},
      {id:'spore_mid',cx:31,cy:12,r:112,period:4.2,offset:1.7,warning:1.1,active:1.4,disabledBy:'nest_mid',damage:.10,reason:'광장 군락의 포자에 갇혔다. 연두색 원이 꺼진 사이에 지나가라.'}
    ]},
    praise:{S:'군락도 본체도 한 번에 태웠다.',A:'온실이 조용해졌다. 씨앗은 살릴 수 있겠군.',B:'살아 나왔군. 포자부터 다시 보자.',C:'간신히 태웠다. 분출 간격을 먼저 읽어라.'}
  });levels.d05=src5;

  function stage5(rage){return {id:rage?'bloom':'rootmass',kind:rage?'rage':'grove',name:rage?'만개한 모근체':'모근체',
    lesson:rage?'회피와 반격':'덩굴 파괴',hp:rage?240000:330000,timeLimit:rage?150:210,patternGap:rage?1.0:1.5,
    counterWindow:rage?.15:.18,perfectWindow:.04,allBrokenDown:true,
    discipline:{normal:.3,skill:.65,partMult:1.3,precisePartMult:1.6,breakBurst:2.5,exposed:1.8,evadeMult:2.2,evadeWindow:.85},
    parts:rage?[{id:'core',name:'포자낭',weak:true,hp:null},{id:'body',name:'덩이줄기',hp:null}]:[
      {id:'vinel',name:'왼 덩굴',hp:38000,breakable:true,onBreak:{zoneScale:.76},pos:'tl'},
      {id:'viner',name:'오른 덩굴',hp:38000,breakable:true,onBreak:{slow:.62,telePlus:.12},pos:'tr'},
      {id:'core',name:'포자낭',weak:true,hp:null,guardedBy:['vinel','viner'],guardReduce:.6},
      {id:'body',name:'덩이줄기',hp:null}],
    /* 연계·지연타: docs/design/18-boss-fight-design.md §2.
       덩굴을 끊으면 그 덩굴이 맡던 연계 타격이 통째로 빠진다 — 파괴가 연계를 짧게 만든다. */
    patterns:[
      {name:'덩굴 후려치기',icon:'scythe',tele:rage?.85:1.15,dmg:rage?6400:5100,posture:32,guardCost:28,recovery:.8,range:'far',
       chain:rage?[{tele:.5,dmg:5000,posture:26,gap:.2,disabledBy:['viner']},{tele:.5,dmg:5200,posture:28,gap:.2,disabledBy:['vinel']}]
                 :[{tele:.6,dmg:4000,posture:26,gap:.24,disabledBy:['viner']}]},
      {name:'아가리 내려찍기',icon:'hammer',tele:rage?.95:1.3,dmg:rage?7000:5600,posture:38,guardCost:30,recovery:.9,range:'near',
       hold:{at:.58,dur:rage?.32:.42}},
      {name:'뿌리 쓸기',icon:'bolt',tele:rage?1.05:1.4,dmg:rage?6000:4800,posture:30,guardCost:32,recovery:.85,range:'near',counterable:false,disabledBy:rage?[]:['vinel']},
      {name:'포자 분출',icon:'flame',tele:rage?1.3:1.65,dmg:rage?8200:6600,counterable:false,unblockable:true,recovery:1.15,range:'any'}],
    hint:'덩굴 파괴로 약화 · 연두색 분출은 회피 · 실패하면 정비 지점에서 재도전',
    line:rage?'포자낭이 한계를 넘는다.':'뿌리가 모여든다.',mastery:[]};}

  arenas.grove={id:'grove',name:'버려진 식물원',place:src5.place,char:'ain',hudName:'모근체',
    procedural:'root',rigidRig:true,pieces:'nodes',bossScale:1.0,
    tint:{grove:0xc6d4b0,rage:0xd8f0a0},glow:{grove:.7,rage:1.5},
    parts3d:{core:{bone:'Core',off:[0,0,.45],r:.45},head:{bone:'Head',off:[0,.1,.2],r:.5},body:{bone:'Spine',off:[0,0,.6],r:.95},
      vinel:{bone:'VineL',off:[-.5,-.3,.1],r:.6},viner:{bone:'VineR',off:[.5,-.3,.1],r:.6}},
    atk:{scythe:{clip:'atk_lash',hitFrac:.48},hammer:{clip:'atk_slam',hitFrac:.49},bolt:{clip:'atk_sweep',hitFrac:.53},flame:{clip:'atk_spore',hitFrac:.55},
      scytheB:{clip:'atk_lash_b',hitFrac:.47}},
    rewards:{gold:2100,items:[['m_fiber',26],['m_dew',8],['m_bone',10]],sBonus:[['m_shard',2]]},
    /* 광란: 터진 포자낭이 바닥에 구름을 남긴다 — 세 자리가 번갈아 켜진다 */
    stageFx:[null,{light:0.9,fog:1.24,sky:0x121a10,color:0x9FE05A,line:'포자 구름이 내려앉는다 — 연두색 자리를 피해라',
      reason:'포자 구름을 마셨다. 연두색 원이 켜지기 전에 비켜라.',
      hazards:[{dx:-200,dy:-110,r:130,period:3.8,warning:1.1,active:1.3,offset:0,damage:0.07},
               {dx: 205,dy: -70,r:130,period:3.8,warning:1.1,active:1.3,offset:1.3,damage:0.07},
               {dx: -30,dy: 200,r:150,period:4.4,warning:1.2,active:1.4,offset:2.6,damage:0.08}]}],
    stages:[stage5(false),stage5(true)]};

  /* ── 던전 06 · 끊어진 수송로 ───────────────────────────────────────────────
     여기는 «되돌아오는» 구조다. 잔해 세 무더기를 치우려면 기중기를 써야 하는데
     기중기는 한 대뿐이라, 구간을 치울 때마다 조작대로 돌아와 다시 걸어야 한다.
     앞으로만 가는 d04 와 달리 길을 왕복하게 만들어, 붕괴 구역을 몇 번이고 다시 읽게 한다. */
  var w6=52,h6=22,g6=Array.from({length:h6},function(){return Array(w6).fill('#');});
  function room6(x1,y1,x2,y2){for(var y=y1;y<=y2;y++)for(var x=x1;x<=x2;x++)g6[y][x]='.';}
  room6(1,8,7,14);                       /* 검문소 */
  room6(9,9,42,13);                      /* 수송로 본선 */
  room6(14,3,22,8);                      /* 북측 갓길 (기중기 조작대) */
  room6(26,14,34,19);                    /* 남측 갓길 (보급 적치장) */
  room6(36,3,42,9);                      /* 고가 진입부 */
  room6(45,2,50,19);                     /* 보스 구역 — 무너진 교차로 */
  room6(7,10,9,12);room6(17,8,19,10);room6(29,13,31,15);room6(38,9,40,10);room6(42,10,45,12);
  /* 보스 구역 진입로는 한 칸 — 격벽(G)이 유일한 목이다 */
  for(var y6=9;y6<=13;y6++)for(var x6=43;x6<=44;x6++)g6[y6][x6]='#';
  g6[11][43]='G';g6[11][44]='.';
  g6[11][3]='S';g6[11][47]='B';g6[10][4]='s';
  [[4,9],[4,13],[12,10],[20,12],[24,10],[32,12],[38,10],[16,5],[30,17],[47,4],[49,17]].forEach(function(p){g6[p[1]][p[0]]='t';});
  var src6=JSON.parse(JSON.stringify(levels.d01));
  Object.assign(src6,{id:'d06',code:'던전 06',name:'끊어진 수송로',place:'외곽지대 · 붕괴한 고가 하부',arena:'road',env:'bunker',bg:'lobby-city',
    diff:'의뢰 A · 수송로 확보', rows:g6.map(function(r){return r.join('');}), bossRoom:{minCx:45}, camDist:8.8,
    ai:[{speed:80,keep:170,start:360,pick:'auto'},{speed:115,keep:150,start:380,pick:'auto'}],
    attackMotion:{'파쇄 물기':{distance:130,stop:118,at:.58},'차체 돌진':{distance:280,stop:120,at:.5}},
    zones:{'파쇄 물기':{kind:'circle',r:180,fwd:125},'차체 돌진':{kind:'line',len:420,w:130},'평형추 강타':{kind:'circle',r:240,fwd:80},'과부하 배출':{kind:'circle',r:290,fwd:0}},
    beats:{questTitle:'파괴된 수송로 확보',
      start:'기중기로 잔해 세 무더기를 치워라 · 조작대는 북측 갓길 한 곳뿐이다',
      gateLocked:'잔해를 다 치워야 교차로로 넘어갈 수 있다.',
      gate:'뒤가 무너졌다. 기갑이 길을 막는다',
      sign:'수송 표지 — “고가 하중 초과. 상판 진동 감지 시 즉시 대피.”',
      mobsClear:'',
      dialog:[['마태오','보급이 끊긴 건 길이 끊겼기 때문이다. 잔해 세 무더기를 치워라.'],['아인','기중기는요?'],['마태오','한 대뿐이다. 구간마다 조작대로 돌아와서 다시 걸어야 해.'],['마태오','머리 위 상판이 내려앉는다. 진동이 오면 멈춰 서라 — 뛰지 말고.']],
      intro:'마태오 — “서두르면 길이 먼저 무너진다.”',
      introHint:'조작대에서 걸고 → 구간으로 가서 치우고 → 다시 조작대. 세 번 반복한다.',
      quest:[['수송로 구간 확보',3,'spans'],['교차로 진입',1,'gate'],['파쇄 기갑 정지',1,'boss'],['보급품 회수',1,'supply',true]],
      phase:['턱과 평형추를 먼저 부숴라. 주황 배출은 튕길 수 없다.','동력로 과부하 — 배출을 피하고 반격해라'],
      enter:['','동력로가 붉게 달아오른다'],
      death:{k:'쓰러졌다',line:'마태오 — “길은 그대로 있다. 숨 고르고 다시 가라.”',hint:'최근 정비 지점에서 다시 시작한다. 치운 구간과 회수품은 유지된다.',btn:'정비 지점에서 재도전'}},
    expedition:{required:['span_c'],nodes:[
      {id:'gate_rest',kind:'checkpoint',cx:4,cy:11,name:'검문소 정비대',text:'입구 정비 지점을 기록했다.'},
      {id:'crane',kind:'valve',cx:18,cy:5,name:'기중기 걸기',text:'기중기 붐을 다음 구간에 걸었다. 가서 치워라.'},
      {id:'span_a',kind:'valve',cx:24,cy:11,name:'1구간 잔해 제거',objective:'spans',text:'1구간을 치웠다. 조작대로 돌아가 다시 걸어라.',requires:['crane']},
      {id:'span_b',kind:'valve',cx:33,cy:11,name:'2구간 잔해 제거',objective:'spans',text:'2구간을 치웠다. 한 번 더 걸어야 한다.',requires:['span_a']},
      {id:'span_c',kind:'valve',cx:40,cy:11,name:'3구간 잔해 제거',objective:'spans',text:'3구간을 치웠다. 교차로로 가는 길이 열린다.',requires:['span_b']},
      {id:'supply',kind:'cache',cx:30,cy:17,name:'보급품 회수',objective:'supply',text:'적치장에서 남은 보급품을 회수했다.',loot:[['m_ore',12],['m_alloy',6],['c_potion',2]]},
      {id:'span_rest',kind:'checkpoint',cx:41,cy:11,name:'고가 진입부 야영지',text:'교차로 앞에 재도전 지점을 기록했다.',requires:['span_c']}
    ],hazards:[
      {id:'fall_a',cx:21,cy:11,r:110,period:4.2,warning:1.2,active:1.5,damage:.10,reason:' 이 구간은 끝까지 내려앉는다. 진동이 멎은 사이에 지나가라.'},
      {id:'fall_b',cx:28,cy:11,r:110,period:4.6,offset:1.5,warning:1.2,active:1.5,disabledBy:'span_a',damage:.10},
      {id:'fall_c',cx:36,cy:11,r:110,period:5.0,offset:2.8,warning:1.3,active:1.5,disabledBy:'span_b',damage:.10},
      {id:'fall_d',cx:12,cy:11,r:96,period:5.4,offset:.9,warning:1.3,active:1.4,disabledBy:'span_c',damage:.09}
    ]},
    praise:{S:'길도 기갑도 한 번에 뚫었다.',A:'보급이 다시 들어온다. 수고했다.',B:'살아 왔군. 잔해부터 다시 보자.',C:'간신히 뚫었다. 진동 간격을 먼저 읽어라.'}
  });levels.d06=src6;

  function stage6(rage){return {id:rage?'overload':'crusher',kind:rage?'rage':'road',name:rage?'과부하 파쇄 기갑':'파쇄 기갑',
    lesson:rage?'회피와 반격':'팔 파괴',hp:rage?270000:380000,timeLimit:rage?160:230,patternGap:rage?1.0:1.55,
    counterWindow:rage?.14:.17,perfectWindow:.04,allBrokenDown:true,
    discipline:{normal:.3,skill:.65,partMult:1.3,precisePartMult:1.6,breakBurst:2.5,exposed:1.8,evadeMult:2.2,evadeWindow:.85},
    parts:rage?[{id:'core',name:'동력로',weak:true,hp:null},{id:'body',name:'차대',hp:null}]:[
      {id:'jawr',name:'파쇄 턱',hp:46000,breakable:true,onBreak:{zoneScale:.76},pos:'tl'},
      {id:'arml',name:'평형추',hp:44000,breakable:true,onBreak:{slow:.6,telePlus:.14},pos:'tr'},
      {id:'core',name:'동력로',weak:true,hp:null,guardedBy:['jawr','arml'],guardReduce:.6},
      {id:'body',name:'차대',hp:null}],
    /* 연계·지연타: docs/design/18-boss-fight-design.md §2.
       턱을 부수면 돌진의 마무리 물기가, 평형추를 부수면 강타의 «버티는» 구간이 빠진다. */
    patterns:[
      {name:'파쇄 물기',icon:'hammer',tele:rage?.9:1.25,dmg:rage?6800:5400,posture:36,guardCost:30,recovery:.85,range:'near',
       chain:rage?[{tele:.5,dmg:5400,posture:28,gap:.2,icon:'hammerB',disabledBy:['arml']},{tele:.5,dmg:5600,posture:30,gap:.2,disabledBy:['jawr']}]
                 :[{tele:.6,dmg:4400,posture:28,gap:.24,icon:'hammerB',disabledBy:['arml']}]},
      {name:'차체 돌진',icon:'bolt',tele:rage?1.0:1.35,dmg:rage?7200:5800,posture:34,guardCost:34,recovery:1.0,range:'far',
       chain:[{tele:.5,dmg:rage?5200:4200,posture:26,gap:.18,disabledBy:['jawr']}]},
      {name:'평형추 강타',icon:'scythe',tele:rage?1.1:1.45,dmg:rage?7600:6000,posture:34,guardCost:30,recovery:.95,range:'near',
       hold:{at:.6,dur:rage?.34:.46},disabledBy:rage?[]:['arml']},
      {name:'과부하 배출',icon:'flame',tele:rage?1.35:1.7,dmg:rage?8800:7100,counterable:false,unblockable:true,recovery:1.2,range:'any'}],
    hint:'턱·평형추 파괴로 약화 · 주황 배출은 회피 · 실패하면 정비 지점에서 재도전',
    line:rage?'동력로가 한계를 넘는다.':'기갑이 다시 움직인다.',mastery:[]};}

  arenas.road={id:'road',name:'끊어진 수송로',place:src6.place,char:'ain',hudName:'파쇄 기갑',
    procedural:'hauler',rigidRig:true,pieces:'nodes',
    tint:{road:0xc8c2b4,rage:0xffb894},glow:{road:.7,rage:1.5},
    parts3d:{core:{bone:'Core',off:[0,0,-.5],r:.45},head:{bone:'Head',off:[0,0,.3],r:.45},body:{bone:'Spine',off:[0,0,.4],r:1.0},
      jawr:{bone:'JawR',off:[.7,-.2,.5],r:.65},arml:{bone:'ArmL',off:[-.9,-.4,0],r:.6}},
    atk:{hammer:{clip:'atk_bite',hitFrac:.47},bolt:{clip:'atk_ram',hitFrac:.5},scythe:{clip:'atk_quake',hitFrac:.55},flame:{clip:'atk_burst',hitFrac:.53},
      hammerB:{clip:'atk_bite_b',hitFrac:.46}},
    rewards:{gold:2600,items:[['m_ore',34],['m_alloy',10],['m_bone',12]],sBonus:[['m_core',1],['m_shard',2]]},
    /* 광란: 고가가 무너진다 — 낙석 자리 네 곳이 번갈아 켜진다 */
    stageFx:[null,{light:0.88,fog:1.26,sky:0x1a1410,color:0xE0903C,line:'상판이 내려앉는다 — 낙석 자리를 피해라',
      reason:'낙석에 맞았다. 주황 원이 켜지기 전에 비켜라.',
      hazards:[{dx:-215,dy:-125,r:132,period:3.6,warning:1.0,active:1.2,offset:0,damage:0.07},
               {dx: 215,dy:-125,r:132,period:3.6,warning:1.0,active:1.2,offset:0.9,damage:0.07},
               {dx:-215,dy: 135,r:132,period:3.6,warning:1.0,active:1.2,offset:1.8,damage:0.07},
               {dx: 215,dy: 135,r:132,period:3.6,warning:1.0,active:1.2,offset:2.7,damage:0.07}]}],
    stages:[stage6(false),stage6(true)]};
})();
