/* 황혼 — 월드 데이터 (캐릭터 · 의뢰 · 보스 · 파티 · 전투 결과 · 프로필 · 전투 HUD)
   출처: 디자인 시트 01~09 에 적힌 값을 그대로 옮겼다. 시트에 없는 칸은 src:'fill'.
   장비·재료·레시피는 js/items.js 에 있다. */
(function(){
  'use strict';

  /* ---------- 캐릭터 ---------- */
  var CHARS = {
    ain:  { id:'ain',  nm:'아인', en:'Ain',  tt:'새벽을 걷는 그림자 · Ain#0927', lv:26, cp:24650, cls:'암살자', role:'딜러 / DPS', sub:'브레이커',
            wp:'낫 (대형)', icon:'scythe', grades:{counter:'S',break:'S',refine:'A',drop:'A',craft:'A'}, eq:8,
            stats:{ hp:24450, atk:2980, def:1780, crit:18.2, critDmg:142.6, aspd:112.5, mspd:105.0 },
            sw:['#0B0C0F','#2A2426','#7A6A55','#A51C1C'],
            look:'짧은 흑발, 붉은 눈. 너덜거리는 검은 천을 겹친 경갑. 왼팔 전체를 감싼 금속 건틀릿과 허벅지 스트랩.',
            traits:[['scythe','카운터 특화','정확한 타이밍의 카운터로 순간 피해를 극대화'],['drop','출혈 부여','일반 공격 시 확률로 출혈'],['bolt','기동력','회피·이동 능력 보유']],
            quote:'“완벽한 타이밍, 날카로운 한 칼.<br>그 사이에 승리가 있다.”', src:'sheet' },
    kain: { id:'kain', nm:'카인', en:'Kain', tt:'대장간 운영 · Kain#0032', lv:32, cp:32180, cls:'블레이드 마스터', role:'탱커 / 브루저', sub:'제작·고정 보조',
            wp:'대검', icon:'sword', grades:{counter:'A',break:'A',refine:'B',drop:'A',craft:'S'}, eq:11,
            stats:{ hp:38200, atk:3410, def:2960, crit:9.4, critDmg:118.0, aspd:96.0, mspd:98.0 },
            sw:['#0B0C0F','#3A2E22','#8C6A3F','#A51C1C'],
            look:'짧은 흑발과 수염. 소매 없는 후드 상의에 청동빛 견갑·건틀릿·정강이 갑주. 교차 가죽 벨트.',
            traits:[['shield','강인함','격추 저항 및 높은 생존력'],['hammer','제작 숙련','강화·제작 재료 추가 획득'],['sword','파괴 특화','부위 파괴 속도 증가']],
            quote:'“무기는 살아있어. 손이 기억해야,<br>녀석도 네게 응답하지.”', src:'sheet' },
    ryu:  { id:'ryu',  nm:'류',   en:'Ryu',  tt:'붉은 그림자 · Ryu#0025', lv:25, cp:21430, cls:'레인저', role:'딜러 / 레인저', sub:'브레이커',
            wp:'쌍단검', icon:'crosshair', grades:{counter:'A',break:'A',refine:'B',drop:'A',craft:'B'}, eq:9,
            stats:{ hp:21800, atk:2640, def:1520, crit:22.6, critDmg:151.0, aspd:124.0, mspd:112.0 },
            sw:['#0B0C0F','#1E1B1D','#6E5A3A','#7A1F1F'],
            look:'언더컷 흑발, 충혈된 눈. 긴 검은 스카프와 찢어진 천을 두른 경장. 팔에 감은 끈과 청동 무릎 보호대.',
            traits:[['crosshair','연속 처치','적 처치 시 드랍 확률 증가'],['bolt','기동력','회피·이동 능력 보유'],['eye','정찰','정찰 경로 노트 자동 갱신']],
            quote:'“먼저 보는 쪽이 이긴다.<br>나는 언제나 먼저 본다.”', src:'fill' },
    sera: { id:'sera', nm:'세라', en:'Sera', tt:'정제사 · Sera#0024', lv:24, cp:19870, cls:'위치 메이커', role:'서포터 / 힐러', sub:'정제',
            wp:'정제 도구 · 시약', icon:'seal', grades:{counter:'B',break:'A',refine:'A',drop:'B',craft:'A'}, eq:8,
            stats:{ hp:19600, atk:1480, def:1610, crit:6.0, critDmg:110.0, aspd:100.0, mspd:104.0 },
            sw:['#0B0C0F','#C9C9CF','#4A4046','#7A1F1F'],
            look:'허리까지 내려오는 은백색 장발. 하이넥 검은 코트 위에 시약병을 꽂은 벨트. 긴 장갑과 찢어진 망토.',
            traits:[['potion','정제 숙련','정제 성공률·재료 획득 증가'],['heart','파티 회복','파티 회복량 증가'],['seal','출혈 저항','출혈 상태 이상 대비']],
            quote:'“상처는 닦아낼 수 있어.<br>기억은… 조금 더 걸리겠지.”', src:'fill' }
  };
  var PARTY_ORDER = ['ain','kain','ryu','sera'];

  /* ---------- 의뢰 (01-office · 02-quest · 03-party 시트) ---------- */
  var QUESTS = [
    { id:'q_marsh', name:'메마른 갈대밭 정찰', area:'외곽지대', sub:'갈대습지', risk:'S', reward:18000, recLv:26, recCp:22000, time:'00:20:00',
      party:'1~4명', penalty:'장비 내구도 10% 감소', lv:20, boss:'b_marsh', art:'boss-marsh', tags:['보스 의뢰','변이체 토벌'],
      desc:'갈대밭 외곽에서 대형 변이체가 목격되었다.<br>생존 정찰대의 신호가 끊긴 상태.<br>적의 토벌과 핵심 정보 확보가 필요하다.',
      goal:'변이체 무리 정찰 및 위협 요소 제거', enemies:4,
      objectives:{ must:['대형 변이체 토벌'], optional:[['정찰대의 기록 회수',0,1],['변이체의 핵심 파편 획득',0,1]] },
      rewards:[['exp',4200],['m_alloy',2100],['m_shard','1~2'],['m_core','1~3']],
      loot:['w_marsh_scythe','a_steel_gauntlet','a_steel_gauntlet','m_shard','m_core','c_potion'], firstClear:'c_potion',
      drops:{ common:['c_potion','m_alloy','c_antidote','m_dew','m_bone','m_dew'], rare:['m_shard','m_shard','m_booster','m_core','m_shard','m_alloy'], low:['w_marsh_scythe','w_ash_dirk','acc_blood_ring'] },
      note:'갈대 습지를 따라 북동쪽으로 이동.<br>무너진 망루를 지나면 넓은 분지에 도달한다.<br>바람의 흐름과 갈대의 흔들림을 이용해<br>은폐하며 접근할 것.',
      checklist:[['장비 내구도 100% 이상',true],['소모품 전부 보유',true],['채집 도구 장착',false],['추천 특성 충족 (2개 이상)',false]], src:'sheet' },
    { id:'q_sewage', name:'지하 오염수 처리', area:'지하시설', sub:'2경구 정화장', risk:'A', reward:12500, recLv:22, recCp:16000, time:'00:15:00',
      party:'1~4명', penalty:'장비 내구도 8% 감소', lv:22, boss:null, art:'story-city', tags:['정화'], desc:'정화장 하부에서 오염수가 역류한다.', goal:'오염원 차단 및 변이체 처리', enemies:3,
      objectives:{ must:['오염원 3곳 차단'], optional:[['정화 장치 회수',0,1]] }, rewards:[['exp',3100],['m_alloy',1500],['m_dew','2~4'],['m_oil','1~2']],
      loot:['a_black_greaves','m_dew','m_oil','c_antidote'], firstClear:'m_booster', drops:{ common:['m_fiber','m_oil','c_antidote'], rare:['m_dew','m_shard'], low:['acc_charm'] }, note:'', checklist:[], src:'fill' },
    { id:'q_road', name:'파괴된 수송로 확보', area:'외곽지대', sub:'끊어진 도로', risk:'A', reward:10800, recLv:23, recCp:15000, time:'00:15:00',
      party:'1~4명', penalty:'장비 내구도 8% 감소', lv:23, boss:null, art:'lobby-city', tags:['호위'], desc:'수송로가 끊겨 보급이 막혔다.', goal:'수송로 확보 및 잔해 제거', enemies:3,
      objectives:{ must:['수송로 3구간 확보'], optional:[['보급품 회수',0,2]] }, rewards:[['exp',2800],['m_ore',40],['m_alloy','4~8'],['m_bone','6~10']],
      loot:['w_ruin_spear','m_ore','m_alloy'], firstClear:'m_shard', drops:{ common:['m_ore','m_bone','m_fiber'], rare:['m_alloy','m_dew'], low:['w_ruin_spear'] }, note:'', checklist:[], src:'fill' },
    { id:'q_plant', name:'변이체 토벌: 식인초', area:'외곽지대', sub:'버려진 식물원', risk:'B', reward:8300, recLv:21, recCp:12000, time:'00:12:00',
      party:'1~4명', penalty:'장비 내구도 5% 감소', lv:21, boss:null, art:'boss-anatomy', tags:['토벌'], desc:'식물원이 변이체의 둥지가 되었다.', goal:'식인초 군락 소각', enemies:2,
      objectives:{ must:['식인초 군락 5곳 소각'], optional:[['씨앗 표본 채집',0,3]] }, rewards:[['exp',2200],['m_fiber',60],['m_dew','3~5'],['c_throw','1~2']],
      loot:['w_hook_scythe','m_fiber','m_dew'], firstClear:'c_throw', drops:{ common:['m_fiber','m_dew'], rare:['m_bone','m_shard'], low:['w_hook_scythe'] }, note:'', checklist:[], src:'fill' },
    { id:'q_med', name:'자원 회수: 의료품', area:'도심지', sub:'폐병원', risk:'B', reward:7200, recLv:20, recCp:10000, time:'00:10:00',
      party:'1~4명', penalty:'장비 내구도 5% 감소', lv:20, boss:null, art:'story-city', tags:['회수'], desc:'폐병원 창고에 의료품이 남아 있다.', goal:'의료품 회수', enemies:2,
      objectives:{ must:['의료품 상자 4개 회수'], optional:[['진료 기록 열람',0,1]] }, rewards:[['exp',1800],['c_potion',6],['c_antidote','2~4'],['m_oil','1~2']],
      loot:['a_hood','c_potion','c_antidote'], firstClear:'a_hood', drops:{ common:['c_potion','c_antidote','m_oil'], rare:['m_dew'], low:['a_hood'] }, note:'', checklist:[], src:'fill' }
  ];
  /* 파티 모집 임무 목록 (03-party) — 의뢰 5 + 추가 3 */
  var MISSIONS = [
    { q:'q_marsh',  lv:20, status:'모집 중' }, { q:'q_sewage', lv:22, status:'모집 중' }, { q:'q_road', lv:23, status:'모집 중' },
    { q:'q_plant',  lv:21, status:'모집 중' }, { q:'q_med',    lv:20, status:'모집 중' },
    { name:'보급선 방어',      area:'외곽지대', sub:'동부 검문소', lv:24, status:'모집 중', art:'boss-marsh', src:'sheet' },
    { name:'추적 : 붉은 그림자', area:'도심지',   sub:'침수 지하로', lv:25, status:'모집 중', art:'lobby-city', src:'sheet' }
  ];

  /* ---------- 보스 (02-quest 시트) ---------- */
  var BOSSES = {
    b_marsh: { name:'메마른 갈대밭 정찰', risk:'S', art:'boss-marsh', anatomy:'boss-anatomy',
      weakpoints:[ { part:'머리', tag:'약점', effect:'피해 증가', pos:'tl' }, { part:'등 견갑', tag:'파괴 가능', effect:'자세 파괴', pos:'tr' },
                   { part:'앞다리', tag:'파괴 가능', effect:'이동 둔화', pos:'bl' }, { part:'꼬리', tag:'파괴 가능', effect:'공격 범위 감소', pos:'br' } ],
      patterns:[ ['bolt','돌진 베기','S','전방으로 빠르게 돌진 후 연속 베기'], ['flame','광폭 포효','A','넓은 범위의 충격파, 정신력 피해'],
                 ['hammer','대지 강타','S','전방 지면 강타 후 충격파 발생'], ['scythe','꼬리 휘두르기','A','넓은 회전 공격, 뒤로도 판정 존재'],
                 ['drop','피의 광란','S','체력 30% 이하 시 사용, 연속 공격 강화'] ],
      traits:[ ['shield','강인함','격추 저항 및 생존력 보유'], ['bolt','기동력','회피/이동 능력 보유'], ['drop','출혈 저항','출혈 상태 이상 대비'], ['hammer','파괴 특화','부위 파괴 속도 증가'] ],
      mastery:[ ['S','5분 이내 처치<br>모든 파괴 부위 파괴'], ['A','10분 이내 처치<br>파괴 부위 2개 이상 파괴'], ['B','15분 이내 처치<br>파괴 부위 1개 이상 파괴'], ['C','15분 초과 처치<br>파괴 조건 미달성'] ],
      hud:{ name:'타이탄 거인, 모르버스', src:'sheet' } }
  };
  var CODEX = { collected:24, total:47, thumbs:['boss-marsh','boss-anatomy','story-city','lobby-city'] };

  /* ---------- 파티 세션 (03-party 시트) ---------- */
  var PARTY = {
    code:'TW-0417', priv:true, avgCp:76840, quest:'q_marsh', recCp:60000,
    members:[
      { slot:'1P', leader:true, char:'ain',  name:'Ain',       lv:26, cp:24650, grades:['S','S','A','A','A'], state:'ready' },
      { slot:'2P', char:'ryu',  name:'SteelRain', lv:24, cp:21430, grades:['A','A','B','A','B'], state:'ok', portrait:'portrait-ryu' },
      { slot:'3P', char:'sera', name:'WhiteDawn', lv:25, cp:19870, grades:['B','A','A','B','A'], state:'ok', portrait:'portrait-sera' },
      { slot:'4P', char:'kain', name:'IronWall',  lv:26, cp:26890, grades:['S','S','B','A','B'], state:'wait', portrait:'portrait-kain' }
    ],
    gradeKeys:['카운터','부위파괴','정 제','드 랩','제 작'],
    chat:[ ['sys','[Ain] 파티를 생성했습니다.'], ['sys','[SteelRain] 입장했습니다.'], ['sys','[WhiteDawn] 입장했습니다.'], ['hi','IronWall 님이 입장했습니다.'] ],
    settings:[ ['모집 대상',['전체','길드원']], ['모집 방식',['자동 승인','수동 승인']], ['최소 전투력',['60,000 이상','제한 없음']], ['음성 채팅',['허용','비허용']] ],
    office:{ lv:4, exp:[2850,5000], rep:'신뢰', repExp:[6250,10000], owner:'마태오의 인력사무소', prep:'훈련용 허수아비' }
  };

  /* ---------- 전투 결과 (08-result 시트) ---------- */
  var RESULT = {
    meta:[ ['작전 모드','전투 대기화면'], ['난이도','인원사무실 로비의 난이도'], ['작전 시간','2024.05.17 22:48:31'] ],
    op:{ name:'폐허 심장 격멸전', boss:'폐허의 심장 (1단계)', rank:'S', time:'08 : 47', counterRate:'78.6 %', perfect:'12 회', dmgTaken:'32,480', deaths:'0' },
    praise:'전투 수행 능력이 탁월합니다.<br>팀워크와 기여도가 매우 높아<br>최고 등급의 평가를 받았습니다.',
    exp:[38240,64560], gold:60000, expGain:72180,
    mats:[ ['m_heart',24,'myth'], ['m_shard',18,'hero'], ['m_alloy',12,'rare'], ['m_dew',6,'rare'], ['acc_charm',2,'common'] ],
    craft:[ ['m_core',8,'myth'], ['acc_band',4,'rare'], ['c_potion',3,'common'], ['a_reed_cuirass',2,'common'] ],
    bonus:[ ['파티 특성 보상','+35 %'], ['드랍 확률 보너스','+22 %'] ],
    contrib:[ ['ain','Ain','@Ain_25','부분파괴 보너스','보스 부분 파괴 기여도에 따라<br>재료 추가 획득 확률 증가','+ 15 %',true],
              ['kain','Kain','@Kain_32','제작/고정보조 보너스','제작 및 고정 보조 장비 사용으로<br>제작 재료 추가 획득','+ 10 %'],
              ['ryu','Ryu','@Ryu_25','드랍 확률 보너스','적 처치 및 연속 카운터 성공으로<br>드랍 확률 증가','+ 12 %'],
              ['sera','Sera','@Sera_24','정제 보너스','정제 성공 및 고급 정제 사용으로<br>정제 재료 추가 획득','+ 8 %'] ],
    perf:[ { ch:'ain',  tag:'1P', name:'Ain',  handle:'@Ain_25',  lv:26, cls:'암살자',        mvp:true, rows:[['총 피해량','1,284,560 (35.7%)'],['카운터 성공','18 회'],['부분 파괴 기여','4 회'],['받은 피해량','32,480']] },
           { ch:'kain', tag:'2P', name:'Kain', handle:'@Kain_32', lv:26, cls:'블레이드 마스터', rows:[['총 피해량','1,102,340 (30.6%)'],['카운터 성공','14 회'],['받은 피해량','48,210'],['제작/보조 기여','<span class="t-red">최고</span>']] },
           { ch:'ryu',  tag:'3P', name:'Ryu',  handle:'@Ryu_25',  lv:25, cls:'레인저',        rows:[['총 피해량','912,780 (25.4%)'],['카운터 성공','11 회'],['연속 처치 수','47 회'],['드랍 기여','<span class="t-red">우수</span>']] },
           { ch:'sera', tag:'4P', name:'Sera', handle:'@Sera_24', lv:25, cls:'위치 메이커',    rows:[['총 피해량','285,660 (8.3%)'],['카운터 성공','9 회'],['정제 성공','12 회'],['파티 회복량','84,320']] } ],
    autoSettle:55, src:'sheet'
  };

  /* ---------- 플레이어 프로필 (07-profile 시트) ---------- */
  var PROFILE = {
    handle:'Ain', tag:'#0927', title:'새벽을 걷는 그림자', lv:36, exp:[41860,78000], counterTier:'4등급', cp:76420,
    guild:'황혼의 인력사무소', position:'정예 요원',
    mastery:[ ['카운터 등급','S',87,'#D94A45'], ['파괴 등급','A',72,'#7B9BD6'], ['생존 등급','B+',68,'#5FAE9B'] ],
    recent:[ ['그을린 요새의 군주','02:31','S','boss-marsh'], ['황혼의 포식자','03:12','A','boss-anatomy'], ['심연의 감시자','05:08','A','story-city'],
             ['핏빛 교단장','02:45','S','portrait-sera'], ['기계의 심장','04:22','B','boss-marsh'] ],
    history:{ total:128, done:116, rate:'90.6%', byRisk:[['S',48],['A',52],['B',14],['C',2]] },
    roles:[ ['scythe','딜러/DPS','빠른 카운터와 높은 순간<br>피해로 전장을 재압합니다.'], ['hammer','브레이커','부위 파괴와 상태 이상으로<br>아군을 지원합니다.'] ],
    intro:['“완벽한 타이밍, 날카로운 한 칼.<br>그 사이에 승리가 있다.”','여전히 배우는 중입니다.<br>함께 강해지고 싶습니다.'],
    equip:{ main:'w_marsh_scythe', enh:'+5', cp:3180, slots:['a_reed_cuirass','a_black_greaves','a_steel_gauntlet','a_ranger_boots','acc_blood_ring'] },
    season:{ rank:152, top:'3.2%', playtime:'128시간 26분', last:'2시간 전', label:'시즌 01' }, src:'sheet'
  };

  /* ---------- 전투 HUD (컨셉 시트 2 · 벤치마크 1) ---------- */
  var BATTLE = {
    boss:{ name:'타이탄 거인, 모르버스', hp:68, stacks:7, seg:[1,1,1,0,0] }, timer:'02 : 41',
    party:[ ['ain',86,24450,2], ['kain',72,31120,1], ['ryu',54,18640,3], ['sera',91,16980,1] ],
    counter:{ v:'27,842', label:'C O U N T E R', sub:'약점 타격 +15%' },
    statuses:[ ['drop','#C9534E','출혈','+10%'], ['crosshair','#C9A45E','약점 노출','00:25'], ['shield','#7B9BD6','공격력 상승','00:12'] ],
    vitals:{ hp:[2450,2450,82], st:[120,120,64] }, pouch:[['potion','회복약 ×3'],['gem','투척물 ×2']],
    skills:[ ['1','scythe',0], ['2','bolt',0], ['3','flame',4], ['4','shield',0] ], ult:['R','scythe'], src:'sheet'
  };

  /* ---------- 헬퍼 ---------- */
  function quest(id){ return QUESTS.filter(function(q){ return q.id===id; })[0] || null; }
  function riskBadge(r){ return '<b class="badge badge--'+r.toLowerCase()+'">'+r+'</b>'; }
  function face(id, cls, extra){ return '<div class="'+cls+' art art--avatar"'+(extra||'')+'><img src="art/face-'+id+'.webp" alt="'+CHARS[id].nm+'"></div>'; }
  function faceSpan(id, cls){ return '<span class="'+cls+' art art--avatar"><img src="art/face-'+id+'.webp" alt=""></span>'; }
  function artDiv(name, cls, alt){ return '<div class="'+cls+' art"><img src="art/'+name+'.webp" alt="'+(alt||'')+'"></div>'; }
  function fmt(n){ return (n==null) ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  window.TW_WORLD = { CHARS:CHARS, PARTY_ORDER:PARTY_ORDER, QUESTS:QUESTS, MISSIONS:MISSIONS, BOSSES:BOSSES, CODEX:CODEX,
                      PARTY:PARTY, RESULT:RESULT, PROFILE:PROFILE, BATTLE:BATTLE,
                      quest:quest, riskBadge:riskBadge, face:face, faceSpan:faceSpan, artDiv:artDiv, fmt:fmt };
})();
