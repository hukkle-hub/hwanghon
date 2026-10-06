/* 황혼 — 장비 · 재료 · 제작 데이터 (단일 원본)
   출처: 디자인 시트(05-inventory, 06-forge, 08-result, 02-quest)에서 확인되는 항목을 그대로 옮기고,
   시트에 이름이 없는 칸(+N 표기만 있는 슬롯)은 src:'fill' 로 표시해 채웠다.
   실제 기획 자료가 오면 이 파일만 교체하면 된다. */
(function(){
  'use strict';

  var RARITY = {
    common:{ name:'일반', cls:'common', color:'#6E7078' },
    rare:  { name:'희귀', cls:'rare',   color:'#4C7FD1' },
    hero:  { name:'영웅', cls:'hero',   color:'#8B5BD6' },
    legend:{ name:'전설', cls:'legend', color:'#C98A2B' },
    myth:  { name:'신화', cls:'myth',   color:'#C0392B' }
  };
  var TYPE = {
    weapon:'무기', armor:'방어구', acc:'악세서리', material:'재료', consumable:'소모품', quest:'임무 아이템'
  };
  var SLOT = {
    main:'메인 무기', sub:'보조 무기', off:'서브 무기', merc:'용병 장비',
    head:'머리', chest:'상의', legs:'하의', gloves:'장갑', boots:'신발', acc:'악세서리'
  };

  /* ---------- 장비 ---------- */
  var EQUIP = [
    { id:'w_marsh_scythe', name:'메마른 갈대밭 정찰', type:'weapon', slot:'main', kind:'낫(대형)', rarity:'legend', icon:'scythe',
      origin:'외곽지대 > 갈대습지', cp:2980, enh:5, enhMax:10, reqLv:20, bind:'캐릭터 귀속', dur:[72,100], price:18000, src:'sheet',
      stats:{ atk:1870, atkEx:1110, crit:6.5, critDmg:18.6, skill:4.2 },
      effect:'일반 공격 시 7% 확률로 <span class="t-red">출혈</span> 부여(3초)',
      flavor:'흑슨 갈대 위에 내려앉은 붉은 이슬처럼,<br>그 피만이 살아 있음을 증명한다.' },
    { id:'w_rust_executioner', name:'부식된 사형 집행자', type:'weapon', slot:'main', kind:'낫(대형)', rarity:'hero', icon:'scythe',
      origin:'외곽지대 > 매립지', cp:2410, enh:3, enhMax:10, reqLv:18, bind:'미귀속', dur:[88,100], price:9800, src:'sheet',
      stats:{ atk:1520, atkEx:890, crit:4.8, critDmg:14.2, skill:3.1 },
      effect:'<span style="color:#7C9AD6">출혈 지속 시간 1초 증가</span>',
      flavor:'집행은 끝났으나 녹은 멈추지 않는다.' },
    { id:'w_marsh_blade', name:'메마른 갈대밭 검창', type:'weapon', slot:'main', kind:'근접 무기(검)', rarity:'legend', icon:'sword',
      origin:'외적등급 S', cp:2980, enh:5, enhMax:10, reqLv:20, bind:'캐릭터 귀속', dur:[72,100], price:18000, src:'sheet',
      stats:{ atk:1820, atkEx:1160, crit:6.5, critDmg:17.9, skill:4.2, bleed:18 },
      effect:'출혈 적중 시 스킬 피해 증가',
      flavor:'무기는 살아있어. 손이 기억해야, 녀석도 네게 응답하지.' },
    { id:'w_ash_dirk', name:'재의 단도', type:'weapon', slot:'sub', kind:'단검', rarity:'hero', icon:'sword',
      origin:'도심지 > 침수 지하로', cp:1240, enh:3, enhMax:10, reqLv:16, bind:'미귀속', dur:[64,100], price:5200, src:'fill',
      stats:{ atk:720, atkEx:410, crit:8.2, critDmg:9.4, skill:1.8 }, effect:'배후 공격 시 치명타 확률 +4%', flavor:'재는 식지 않는다.' },
    { id:'w_hook_scythe', name:'갈고리 낫', type:'weapon', slot:'off', kind:'낫(소형)', rarity:'hero', icon:'scythe',
      origin:'외곽지대 > 버려진 식물원', cp:980, enh:2, enhMax:10, reqLv:14, bind:'미귀속', dur:[91,100], price:4100, src:'fill',
      stats:{ atk:560, atkEx:300, crit:5.1, critDmg:7.0, skill:2.4 }, effect:'부위 파괴 피해 +6%', flavor:'' },
    { id:'w_ruin_spear', name:'폐허의 장창', type:'weapon', slot:'main', kind:'장창', rarity:'rare', icon:'crosshair',
      origin:'외곽지대 > 끊어진 도로', cp:1610, enh:3, enhMax:10, reqLv:15, bind:'미귀속', dur:[40,100], price:3600, src:'fill',
      stats:{ atk:1010, atkEx:520, crit:3.2, critDmg:8.0, skill:1.2 }, effect:'', flavor:'' },
    { id:'w_kain_greatsword', name:'모루의 대검', type:'weapon', slot:'main', kind:'대검', rarity:'hero', icon:'sword', cls:['kain'],
      origin:'대장간 > 카인 제작', cp:2650, enh:4, enhMax:10, reqLv:20, bind:'캐릭터 귀속', dur:[90,100], price:12000, src:'fill',
      stats:{ atk:1740, atkEx:980, crit:3.8, critDmg:12.0, skill:2.6 }, effect:'부위 파괴 피해 +12%', flavor:'모루 위에서 태어나, 모루처럼 버틴다.' },
    /* 카인 상·하위 대검 (docs/design/82) — 류·세라와 같은 희귀 Lv12 / 전설 Lv24 두 칸. 수치는 모루의 대검에서 비율로(근거 없음) */
    { id:'w_kain_scrap', name:'쇠판 대검', type:'weapon', slot:'main', kind:'대검', rarity:'rare', icon:'sword', cls:['kain'],
      origin:'외곽지대 > 끊어진 수송로', cp:1640, enh:2, enhMax:10, reqLv:12, bind:'미귀속', dur:[62,100], price:3600, src:'fill',
      stats:{ atk:1080, atkEx:580, crit:2.4, critDmg:8.0, skill:1.4 }, effect:'', flavor:'날은 없어도 무게는 있다.' },
    { id:'w_kain_crusher', name:'파쇄 기갑의 턱', type:'weapon', slot:'main', kind:'대검', rarity:'legend', icon:'sword', cls:['kain'],
      origin:'외곽지대 > 끊어진 수송로 · 파쇄 기갑', cp:3080, enh:4, enhMax:10, reqLv:24, bind:'캐릭터 귀속', dur:[88,100], price:19500, src:'fill',
      stats:{ atk:2090, atkEx:1180, crit:4.6, critDmg:16.0, skill:3.4 },
      effect:'부위 파괴 피해 +18% · 강공격 명중 시 보스 경직 누적 +10%',
      flavor:'그 턱이 물었던 것은 전부 부서졌다. 이제 물 차례다.' },
    { id:'w_ryu_dagger', name:'붉은 그림자 쌍단검', type:'weapon', slot:'main', kind:'쌍단검', rarity:'hero', icon:'crosshair', cls:['ryu'],
      origin:'도심지 > 침수 지하로', cp:2380, enh:4, enhMax:10, reqLv:18, bind:'캐릭터 귀속', dur:[84,100], price:9800, src:'fill',
      stats:{ atk:1420, atkEx:760, crit:9.6, critDmg:16.4, skill:3.4 }, effect:'배후 공격 시 치명타 확률 +6%', flavor:'먼저 보는 쪽이 이긴다.' },
    { id:'w_sera_flask', name:'촉매 시약병', type:'weapon', slot:'main', kind:'시약', rarity:'hero', icon:'potion', cls:['sera'],
      origin:'정제소 > 세라 조제', cp:2100, enh:3, enhMax:10, reqLv:18, bind:'캐릭터 귀속', dur:[100,100], price:8600, src:'fill',
      stats:{ atk:980, atkEx:520, crit:4.0, critDmg:10.0, skill:6.2 }, effect:'스킬 피해 +8% · 파티 회복량 +5%', flavor:'상처는 닦아낼 수 있어.' },
    { id:'w_ryu_shiv', name:'갈라진 쌍칼', type:'weapon', slot:'main', kind:'쌍단검', rarity:'rare', icon:'crosshair', cls:['ryu'],
      origin:'도심지 > 뒷골목 노점', cp:1580, enh:2, enhMax:10, reqLv:12, bind:'미귀속', dur:[58,100], price:3400, src:'fill',
      stats:{ atk:940, atkEx:500, crit:7.8, critDmg:12.0, skill:2.2 }, effect:'', flavor:'날이 갈라져도 두 자루면 충분하다.' },
    { id:'w_ryu_twinfang', name:'쌍아', type:'weapon', slot:'main', kind:'쌍단검', rarity:'legend', icon:'crosshair', cls:['ryu'],
      origin:'정화장 > 침전조 바닥', cp:2960, enh:4, enhMax:10, reqLv:24, bind:'캐릭터 귀속', dur:[80,100], price:19000, src:'fill',
      stats:{ atk:1760, atkEx:980, crit:12.4, critDmg:21.0, skill:4.0 },
      effect:'연속 명중 3회마다 다음 공격 <span class="t-red">치명타 확정</span>',
      flavor:'두 번 물린 자리는 아물지 않는다.' },
    { id:'w_sera_vial', name:'흐린 시약병', type:'weapon', slot:'main', kind:'시약', rarity:'rare', icon:'potion', cls:['sera'],
      origin:'정제소 > 폐기 선반', cp:1520, enh:2, enhMax:10, reqLv:12, bind:'미귀속', dur:[70,100], price:3200, src:'fill',
      stats:{ atk:640, atkEx:340, crit:3.0, critDmg:8.0, skill:4.4 }, effect:'스킬 피해 +4%', flavor:'침전물은 가라앉히면 그만이야.' },
    { id:'w_sera_reagent', name:'정제 촉매', type:'weapon', slot:'main', kind:'시약', rarity:'legend', icon:'potion', cls:['sera'],
      origin:'정화장 > 촉매 저장고', cp:2900, enh:4, enhMax:10, reqLv:24, bind:'캐릭터 귀속', dur:[100,100], price:18500, src:'fill',
      stats:{ atk:1180, atkEx:640, crit:5.2, critDmg:12.4, skill:8.6 },
      effect:'스킬 피해 +14% · 파티 회복량 +9%',
      flavor:'섞는 순서를 바꾸면 약이 무기가 된다.' },
    { id:'w_rust_sword', name:'녹슨 집행검', type:'weapon', slot:'main', kind:'검', rarity:'common', icon:'sword',
      origin:'도심지 > 폐병원', cp:640, enh:0, enhMax:10, reqLv:8, bind:'미귀속', dur:[22,100], price:600, src:'fill',
      stats:{ atk:420, atkEx:180, crit:1.5, critDmg:2.0, skill:0 }, effect:'', flavor:'' },

    { id:'a_reed_cuirass', name:'갈대 가죽 흉갑', type:'armor', slot:'chest', kind:'경갑', rarity:'rare', icon:'chest',
      origin:'외곽지대 > 갈대습지', cp:860, enh:4, enhMax:10, reqLv:18, bind:'미귀속', dur:[80,100], price:4200, src:'fill',
      stats:{ def:610, hp:1800, crit:0, critDmg:0, skill:0 }, effect:'출혈 저항 +8%', flavor:'' },
    { id:'a_black_greaves', name:'검은 각반', type:'armor', slot:'legs', kind:'경갑', rarity:'rare', icon:'pants',
      origin:'외곽지대 > 갈대습지', cp:720, enh:4, enhMax:10, reqLv:18, bind:'미귀속', dur:[77,100], price:3800, src:'fill',
      stats:{ def:520, hp:1400 }, effect:'이동 속도 +2%', flavor:'' },
    { id:'a_steel_gauntlet', name:'강철 건틀릿', type:'armor', slot:'gloves', kind:'중갑', rarity:'rare', icon:'glove',
      origin:'제작', cp:690, enh:5, enhMax:10, reqLv:20, bind:'미귀속', dur:[92,100], price:4600, src:'fill',
      stats:{ def:480, hp:900, crit:1.2 }, effect:'카운터 성공 시 공격력 +3% (5초)', flavor:'' },
    { id:'a_ranger_boots', name:'순찰자의 장화', type:'armor', slot:'boots', kind:'경갑', rarity:'rare', icon:'boot',
      origin:'제작', cp:610, enh:4, enhMax:10, reqLv:17, bind:'미귀속', dur:[70,100], price:3300, src:'fill',
      stats:{ def:390, hp:1100 }, effect:'회피 후 이동 속도 +5% (3초)', flavor:'' },
    { id:'a_hood', name:'낡은 후드', type:'armor', slot:'head', kind:'천', rarity:'rare', icon:'helm',
      origin:'도심지 > 폐병원', cp:410, enh:0, enhMax:10, reqLv:10, bind:'미귀속', dur:[55,100], price:1200, src:'fill',
      stats:{ def:240, hp:600 }, effect:'', flavor:'' },
    /* «수문지기» 중갑 5부위 — 2경구 정화장(d03) 수문기 드롭. «방역» 경갑 4부위 — 폐병원(d07) 소생기 드롭 (docs/design/82·83).
       수치는 기존 희귀 방어구(갈대·검은 각반·강철 건틀릿·순찰자 장화·후드)를 기준으로 중갑 +방어/−속도, 경갑 +회피 쪽으로(근거 없음) */
    { id:'a_sluice_helm', name:'수문지기 투구', type:'armor', slot:'head', kind:'중갑', rarity:'hero', icon:'helm',
      origin:'지하시설 > 2경구 정화장', cp:720, enh:0, enhMax:10, reqLv:22, bind:'미귀속', dur:[90,100], price:5200, src:'fill',
      stats:{ def:520, hp:1300 }, effect:'독 저항 +10%', flavor:'숨구멍은 좁다. 오수는 더 좁은 틈으로도 들어온다.' },
    { id:'a_sluice_cuirass', name:'수문지기 흉갑', type:'armor', slot:'chest', kind:'중갑', rarity:'hero', icon:'chest',
      origin:'지하시설 > 2경구 정화장', cp:1080, enh:0, enhMax:10, reqLv:22, bind:'미귀속', dur:[90,100], price:7400, src:'fill',
      stats:{ def:820, hp:2400 }, effect:'받는 피해 −4% · 이동 속도 −2%', flavor:'압력계 바늘은 한 번도 0 을 가리킨 적이 없다.' },
    { id:'a_sluice_greaves', name:'수문지기 각반', type:'armor', slot:'legs', kind:'중갑', rarity:'hero', icon:'pants',
      origin:'지하시설 > 2경구 정화장', cp:880, enh:0, enhMax:10, reqLv:22, bind:'미귀속', dur:[90,100], price:5800, src:'fill',
      stats:{ def:640, hp:1700 }, effect:'넘어짐 저항 +10%', flavor:'' },
    { id:'a_sluice_gauntlet', name:'수문지기 완갑', type:'armor', slot:'gloves', kind:'중갑', rarity:'hero', icon:'glove',
      origin:'지하시설 > 2경구 정화장', cp:820, enh:0, enhMax:10, reqLv:22, bind:'미귀속', dur:[90,100], price:5600, src:'fill',
      stats:{ def:560, hp:1100, crit:0.8 }, effect:'카운터 성공 시 받는 피해 −6% (5초)', flavor:'' },
    { id:'a_sluice_boots', name:'수문지기 장화', type:'armor', slot:'boots', kind:'중갑', rarity:'hero', icon:'boot',
      origin:'지하시설 > 2경구 정화장', cp:760, enh:0, enhMax:10, reqLv:22, bind:'미귀속', dur:[90,100], price:5000, src:'fill',
      stats:{ def:480, hp:1300 }, effect:'수중·늪 감속 −30%', flavor:'' },
    { id:'a_ward_mask', name:'방역 부리 가면', type:'armor', slot:'head', kind:'천', rarity:'hero', icon:'helm',
      origin:'도심지 > 폐병원', cp:640, enh:0, enhMax:10, reqLv:25, bind:'미귀속', dur:[80,100], price:6100, src:'fill',
      stats:{ def:360, hp:900, skill:1.2 }, effect:'상태 이상 지속 −20%', flavor:'필터는 두 개. 하나는 숨, 하나는 기도.' },
    { id:'a_ward_coat', name:'방역 외투', type:'armor', slot:'chest', kind:'천', rarity:'hero', icon:'chest',
      origin:'도심지 > 폐병원', cp:820, enh:0, enhMax:10, reqLv:25, bind:'미귀속', dur:[80,100], price:6800, src:'fill',
      stats:{ def:600, hp:1600, skill:0.8 }, effect:'출혈 피해 −25%', flavor:'무릎까지 오는 흰 외투. 몸을 따라 접히고 펄럭인다.' },
    { id:'a_ward_greaves', name:'방역 각반', type:'armor', slot:'legs', kind:'경갑', rarity:'hero', icon:'pants',
      origin:'도심지 > 폐병원', cp:760, enh:0, enhMax:10, reqLv:25, bind:'미귀속', dur:[80,100], price:5400, src:'fill',
      stats:{ def:500, hp:1300 }, effect:'회피 거리 +5%', flavor:'' },
    { id:'a_ward_gloves', name:'방역 장갑', type:'armor', slot:'gloves', kind:'경갑', rarity:'hero', icon:'glove',
      origin:'도심지 > 폐병원', cp:700, enh:0, enhMax:10, reqLv:25, bind:'미귀속', dur:[80,100], price:5100, src:'fill',
      stats:{ def:420, hp:900, skill:1.6 }, effect:'회복 아이템 효과 +10%', flavor:'' },
    { id:'a_ward_boots', name:'방역 장화', type:'armor', slot:'boots', kind:'경갑', rarity:'hero', icon:'boot',
      origin:'도심지 > 폐병원', cp:680, enh:0, enhMax:10, reqLv:25, bind:'미귀속', dur:[80,100], price:4800, src:'fill',
      stats:{ def:420, hp:1200 }, effect:'회피 후 이동 속도 +6% (3초)', flavor:'' },
    { id:'acc_blood_ring', name:'핏빛 인장 반지', type:'acc', slot:'acc', kind:'반지', rarity:'hero', icon:'ring',
      origin:'외곽지대 > 매립지', cp:540, enh:4, enhMax:10, reqLv:20, bind:'캐릭터 귀속', dur:[100,100], price:7400, src:'fill',
      stats:{ crit:2.4, critDmg:6.0, skill:1.6 }, effect:'출혈 피해 +10%', flavor:'' },
    { id:'acc_charm', name:'부적 목걸이', type:'acc', slot:'acc', kind:'목걸이', rarity:'rare', icon:'seal',
      origin:'제작', cp:380, enh:2, enhMax:10, reqLv:14, bind:'미귀속', dur:[100,100], price:2900, src:'fill',
      stats:{ hp:800, def:120 }, effect:'상태 이상 지속 -10%', flavor:'' },
    { id:'acc_band', name:'구리 밴드', type:'acc', slot:'acc', kind:'반지', rarity:'common', icon:'ring',
      origin:'도심지', cp:120, enh:1, enhMax:10, reqLv:5, bind:'미귀속', dur:[100,100], price:300, src:'fill',
      stats:{ crit:0.6 }, effect:'', flavor:'' },

    /* ---- 필드 보스 고유 장비 (docs/design/188 §4) — 그 보스만 떨어뜨린다. 확률은 server/boss-table.cjs 한 곳에서.
       boss: 떨어뜨리는 보스 id (maps/2d/<zone>/map.json bosses[].id). 교환 가능(미귀속) — 돌아야 로망이 된다. ---- */
    { id:'w_clave_blade', name:'달아오른 장검', type:'weapon', slot:'main', kind:'대검', rarity:'legend', icon:'sword', cls:['kain'], boss:'clave',
      origin:'강남역 지하 1층 > 중앙 광장 · 클레이브', cp:3420, enh:0, enhMax:10, reqLv:24, bind:'미귀속', dur:[100,100], price:42000, src:'boss',
      stats:{ atk:2480, atkEx:1320, crit:5.2, critDmg:19.5, skill:3.8 },
      effect:'칼날이 붉게 달아오른다 · 강공격 명중 시 <span class="t-red">화상</span>(3초) · 휘두르면 불티',
      flavor:'셔터를 끌고 다니던 손이 쥐고 있던 것. 아직 식지 않았다.' },
    { id:'a_clave_helm', name:'티타늄 기사 투구', type:'armor', slot:'head', kind:'중갑', rarity:'hero', icon:'helm', boss:'clave',
      origin:'강남역 지하 1층 · 클레이브', cp:860, enh:0, enhMax:10, reqLv:24, bind:'미귀속', dur:[100,100], price:9800, src:'boss',
      stats:{ def:640, hp:1600 }, effect:'세트 4: 피격 경직 −30%', flavor:'면갑 틈으로 붉은빛이 샌다.' },
    { id:'a_clave_cuirass', name:'티타늄 기사 흉갑', type:'armor', slot:'chest', kind:'중갑', rarity:'hero', icon:'chest', boss:'clave',
      origin:'강남역 지하 1층 · 클레이브', cp:980, enh:0, enhMax:10, reqLv:24, bind:'미귀속', dur:[100,100], price:11200, src:'boss',
      stats:{ def:820, hp:2100 }, effect:'세트 4: 피격 경직 −30%', flavor:'2.5 m 짜리를 사람 몸에 맞게 두드려 줄였다.' },
    { id:'a_clave_gauntlet', name:'티타늄 기사 건틀릿', type:'armor', slot:'gloves', kind:'중갑', rarity:'hero', icon:'glove', boss:'clave',
      origin:'강남역 지하 1층 · 클레이브', cp:720, enh:0, enhMax:10, reqLv:24, bind:'미귀속', dur:[100,100], price:8600, src:'boss',
      stats:{ def:430, hp:1100, atk:60 }, effect:'세트 4: 피격 경직 −30%', flavor:'' },
    { id:'a_clave_greaves', name:'티타늄 기사 각반', type:'armor', slot:'legs', kind:'중갑', rarity:'hero', icon:'pants', boss:'clave',
      origin:'강남역 지하 1층 · 클레이브', cp:760, enh:0, enhMax:10, reqLv:24, bind:'미귀속', dur:[100,100], price:9000, src:'boss',
      stats:{ def:560, hp:1400 }, effect:'세트 4: 피격 경직 −30%', flavor:'' },
    { id:'x_clave_shutter', name:'셔터 방패', type:'armor', slot:'off', kind:'방패(대형)', rarity:'myth', icon:'shield', boss:'clave',
      origin:'강남역 지하 · 클레이브', cp:4200, enh:0, enhMax:10, reqLv:30, bind:'미귀속', dur:[100,100], price:300000, src:'boss',
      stats:{ def:1800, hp:5200 }, effect:'등에 메면 보인다 · 정면 피해 −25% · 막는 순간 셔터가 내려오는 소리',
      flavor:'폭 3 m. 상가 하나의 입구였다.' },

    { id:'w_celestial_claws', name:'세 발톱', type:'weapon', slot:'main', kind:'쌍단검', rarity:'legend', icon:'crosshair', cls:['ryu'], boss:'celestial',
      origin:'남산 > 타워 광장 · 셀레스티얼', cp:3380, enh:0, enhMax:10, reqLv:26, bind:'미귀속', dur:[100,100], price:41000, src:'boss',
      stats:{ atk:2260, atkEx:1240, crit:8.4, critDmg:22.0, skill:3.6 }, effect:'세 번째 연속 적중마다 강선이 끊어지는 소리 · 추가 타격',
      flavor:'내려오지 않던 것의 발톱. 이제는 내 손끝에서 내려온다.' },
    { id:'a_celestial_cloak', name:'강선 막 망토', type:'acc', slot:'acc', kind:'망토', rarity:'hero', icon:'seal', boss:'celestial',
      origin:'남산 · 셀레스티얼', cp:820, enh:0, enhMax:10, reqLv:26, bind:'미귀속', dur:[100,100], price:9400, src:'boss',
      stats:{ hp:1200, def:200, crit:1.6 }, effect:'등에 강선 막이 펼쳐진다 · 낙하 피해 없음', flavor:'' },
    { id:'x_celestial_wings', name:'날개 넷', type:'acc', slot:'acc', kind:'날개', rarity:'myth', icon:'seal', boss:'celestial2',
      origin:'남부 도로 · 격파된 셀레스티얼', cp:4100, enh:0, enhMax:10, reqLv:32, bind:'미귀속', dur:[100,100], price:300000, src:'boss',
      stats:{ hp:3800, def:600, crit:3.5, critDmg:8.0 }, effect:'등에 강선 날개 넷 · 회피 후 0.4초 활공', flavor:'둘은 꺾였고 둘은 남았다.' },

    { id:'w_aegis_catalyst', name:'포문 촉매', type:'weapon', slot:'main', kind:'시약', rarity:'legend', icon:'potion', cls:['sera'], boss:'aegis',
      origin:'여의도 > 빌딩 협곡 · 에이지스-07', cp:3300, enh:0, enhMax:10, reqLv:26, bind:'미귀속', dur:[100,100], price:40000, src:'boss',
      stats:{ atk:1760, atkEx:980, crit:4.0, critDmg:14.0, skill:6.2 }, effect:'투척 시 포문이 열리는 빛 · 방벽 위 적에게 피해 +20%', flavor:'' },
    { id:'a_aegis_gauntlet', name:'배리어 건틀릿', type:'armor', slot:'gloves', kind:'중갑', rarity:'hero', icon:'glove', boss:'aegis',
      origin:'여의도 · 에이지스-07', cp:760, enh:0, enhMax:10, reqLv:26, bind:'미귀속', dur:[100,100], price:9200, src:'boss',
      stats:{ def:520, hp:1300 }, effect:'맞는 순간 보이지 않던 막이 번쩍인다 · 피해 −6%', flavor:'수방사 마크가 긁혀 있다.' },

    { id:'w_leviathan_scythe', name:'결정 띠 낫', type:'weapon', slot:'main', kind:'낫(대형)', rarity:'legend', icon:'scythe', cls:['ain'], boss:'leviathan',
      origin:'한강 지하 > 차수문 3-B · 레비아탄', cp:3460, enh:0, enhMax:10, reqLv:28, bind:'미귀속', dur:[100,100], price:43000, src:'boss',
      stats:{ atk:2420, atkEx:1300, crit:7.0, critDmg:20.0, skill:4.4 }, effect:'날을 따라 결정 띠가 빛난다 · 출혈 대신 결정화(둔화)', flavor:'' },
    { id:'a_leviathan_helm', name:'아가미 투구', type:'armor', slot:'head', kind:'경갑', rarity:'hero', icon:'helm', boss:'leviathan',
      origin:'한강 지하 · 레비아탄', cp:780, enh:0, enhMax:10, reqLv:28, bind:'미귀속', dur:[100,100], price:9000, src:'boss',
      stats:{ def:480, hp:1500 }, effect:'물속 숨 +100%', flavor:'' },
    { id:'a_leviathan_cuirass', name:'마디 흉갑', type:'armor', slot:'chest', kind:'경갑', rarity:'hero', icon:'chest', boss:'leviathan',
      origin:'한강 지하 · 레비아탄', cp:920, enh:0, enhMax:10, reqLv:28, bind:'미귀속', dur:[100,100], price:10400, src:'boss',
      stats:{ def:700, hp:1900 }, effect:'', flavor:'' },

    { id:'w_subject_fixative', name:'고정액', type:'weapon', slot:'main', kind:'시약', rarity:'legend', icon:'potion', cls:['sera'], boss:'subject09',
      origin:'판교 연구소 > 봉인실 · 실험체 09호', cp:3340, enh:0, enhMax:10, reqLv:28, bind:'미귀속', dur:[100,100], price:41000, src:'boss',
      stats:{ atk:1800, atkEx:1000, crit:4.4, critDmg:15.0, skill:6.8 }, effect:'적의 재생을 4초간 멈춘다', flavor:'나뉘는 것을 한 덩어리로 묶어 두던 약.' },
    { id:'a_subject_cuirass', name:'봉합 흉갑', type:'armor', slot:'chest', kind:'천', rarity:'hero', icon:'chest', boss:'subject09',
      origin:'판교 연구소 · 실험체 09호', cp:880, enh:0, enhMax:10, reqLv:28, bind:'미귀속', dur:[100,100], price:9800, src:'boss',
      stats:{ def:520, hp:2200 }, effect:'전투 밖에서 초당 체력 1% 재생', flavor:'' },

    { id:'w_shadow_silence', name:'무음', type:'weapon', slot:'main', kind:'쌍단검', rarity:'legend', icon:'crosshair', cls:['ryu'], boss:'shadowfang',
      origin:'남부 도로 > 물류창고 앞마당 · 섀도우 팽', cp:3360, enh:0, enhMax:10, reqLv:30, bind:'미귀속', dur:[100,100], price:42000, src:'boss',
      stats:{ atk:2300, atkEx:1260, crit:9.0, critDmg:21.0, skill:3.4 }, effect:'발소리가 없다 · 등 뒤 첫 공격 치명타', flavor:'소리가 오다가 죽는다.' },
    { id:'a_shadow_helm', name:'꽃잎 투구', type:'armor', slot:'head', kind:'경갑', rarity:'hero', icon:'helm', boss:'shadowfang',
      origin:'남부 도로 · 섀도우 팽', cp:760, enh:0, enhMax:10, reqLv:30, bind:'미귀속', dur:[100,100], price:9000, src:'boss',
      stats:{ def:420, hp:1300, crit:1.2 }, effect:'숨은 적이 보인다(8 m)', flavor:'' },

    { id:'w_dropper_hook', name:'거는 낫', type:'weapon', slot:'main', kind:'낫(대형)', rarity:'legend', icon:'scythe', cls:['ain'], boss:'dropper',
      origin:'남산타워 하부 > 옛 식당 · 케이블카 드로퍼', cp:3200, enh:0, enhMax:10, reqLv:24, bind:'미귀속', dur:[100,100], price:36000, src:'boss',
      stats:{ atk:2240, atkEx:1200, crit:6.0, critDmg:17.0, skill:4.0 }, effect:'강공격이 적을 끌어당긴다', flavor:'천장에서 떨어지던 넷의 손.' },
    { id:'a_dropper_gloves', name:'긴 팔 장갑', type:'armor', slot:'gloves', kind:'중갑', rarity:'hero', icon:'glove', boss:'dropper',
      origin:'남산타워 하부 · 케이블카 드로퍼', cp:700, enh:0, enhMax:10, reqLv:24, bind:'미귀속', dur:[100,100], price:8200, src:'boss',
      stats:{ def:400, hp:1000, atk:50 }, effect:'근접 사거리 +0.4 m', flavor:'' },

    { id:'w_arsenal_wrench', name:'격납고 대형 렌치', type:'weapon', slot:'main', kind:'대검', rarity:'legend', icon:'sword', cls:['kain'], boss:'arsenal',
      origin:'계룡 기지 > 주 격납고 · 아스널 오버로드', cp:3520, enh:0, enhMax:10, reqLv:32, bind:'미귀속', dur:[100,100], price:46000, src:'boss',
      stats:{ atk:2560, atkEx:1360, crit:4.8, critDmg:18.0, skill:3.6 }, effect:'기계형 적에게 부위 파괴 +30%', flavor:'포탑 열여덟을 이걸로 하나씩 풀었다.' },
    { id:'a_arsenal_pauldron', name:'포탑 어깨', type:'acc', slot:'acc', kind:'어깨', rarity:'hero', icon:'seal', boss:'arsenal',
      origin:'계룡 기지 · 아스널 오버로드', cp:840, enh:0, enhMax:10, reqLv:32, bind:'미귀속', dur:[100,100], price:9800, src:'boss',
      stats:{ def:380, hp:1400, atk:40 }, effect:'어깨 위 소형 포탑이 적을 따라 돈다', flavor:'' },

    { id:'w_park_saber', name:'지휘도', type:'weapon', slot:'main', kind:'쌍단검', rarity:'legend', icon:'crosshair', cls:['ryu'], boss:'park',
      origin:'계룡 기지 > 소독약 복도 · 박 준장', cp:3300, enh:0, enhMax:10, reqLv:32, bind:'미귀속', dur:[100,100], price:40000, src:'boss',
      stats:{ atk:2280, atkEx:1240, crit:8.0, critDmg:20.0, skill:4.0 }, effect:'파티원 공격력 +3%(15 m)', flavor:'' },
    { id:'a_park_coat', name:'방호복 상의', type:'armor', slot:'chest', kind:'천', rarity:'hero', icon:'chest', boss:'park',
      origin:'계룡 기지 · 박 준장', cp:840, enh:0, enhMax:10, reqLv:32, bind:'미귀속', dur:[100,100], price:9400, src:'boss',
      stats:{ def:560, hp:1800 }, effect:'독 저항 +20%', flavor:'소독약 냄새가 빠지지 않는다.' },
    { id:'a_park_pants', name:'방호복 하의', type:'armor', slot:'legs', kind:'천', rarity:'hero', icon:'pants', boss:'park',
      origin:'계룡 기지 · 박 준장', cp:720, enh:0, enhMax:10, reqLv:32, bind:'미귀속', dur:[100,100], price:8400, src:'boss',
      stats:{ def:460, hp:1400 }, effect:'독 저항 +20%', flavor:'' },

    { id:'w_jeong_staff', name:'결계 지팡이', type:'weapon', slot:'main', kind:'시약', rarity:'legend', icon:'potion', cls:['sera'], boss:'jeong',
      origin:'고흥 > 발사장 도로 · 정 장관', cp:3480, enh:0, enhMax:10, reqLv:34, bind:'미귀속', dur:[100,100], price:45000, src:'boss',
      stats:{ atk:1880, atkEx:1060, crit:4.6, critDmg:15.0, skill:7.4 }, effect:'회복 시약이 결계를 남긴다(피해 −10%, 4초)', flavor:'' },
    { id:'a_jeong_regalia', name:'의장대 예복', type:'armor', slot:'chest', kind:'예복', rarity:'hero', icon:'chest', boss:'jeong',
      origin:'고흥 · 정 장관', cp:900, enh:0, enhMax:10, reqLv:34, bind:'미귀속', dur:[100,100], price:12000, src:'boss',
      stats:{ def:600, hp:2000 }, effect:'자랑용 외형 — 금실 견장과 흰 장갑', flavor:'의장대는 주인이 죽어도 줄을 맞춘다.' },

    { id:'x_nova_scythe', name:'노바 결정 낫', type:'weapon', slot:'main', kind:'낫(대형)', rarity:'myth', icon:'scythe', cls:['ain'], boss:'nova',
      origin:'고흥 발사대 지하 · 나노-노바 코어', cp:4800, enh:0, enhMax:10, reqLv:36, bind:'미귀속', dur:[100,100], price:500000, src:'boss',
      stats:{ atk:3200, atkEx:1700, crit:9.0, critDmg:26.0, skill:5.6 }, effect:'날이 결정 산처럼 자란다 · 휘두를 때마다 결정 파편',
      flavor:'산이 곧 보스였다. 이제 그 산의 한 조각이 낫이 되었다.' }
  ];

  /* ---------- 재료 (수량은 시트의 강화 재료 / 재료 보관함 표기) ---------- */
  var MATERIAL = [
    { id:'m_alloy',   name:'강화 합금',        rarity:'rare',   icon:'ingot',  qty:124, src:'sheet', desc:'무기·방어구 강화의 기본 재료. 검은 철광을 정련해 만든다.' },
    { id:'m_shard',   name:'응축된 파편',      rarity:'hero',   icon:'gem',    qty:78,  src:'sheet', desc:'변이체 핵에서 떨어져 나온 결정. 강화 성공률을 지탱한다.' },
    { id:'m_core',    name:'정제된 에너지 코어', rarity:'hero',  icon:'bolt',   qty:24,  src:'sheet', desc:'대형 변이체에서만 나온다. 고단계 강화와 전설 제작에 쓴다.' },
    { id:'m_booster', name:'고급 강화 보조제',  rarity:'rare',   icon:'potion', qty:9,   src:'sheet', desc:'실패 시 단계 유지. 붉은 이슬과 정제유로 조제한다.' },
    { id:'m_fiber',   name:'갈대 섬유',        rarity:'common', icon:'ingot',  qty:312, src:'fill',  desc:'갈대습지에서 채집. 경갑과 소모품의 기본 재료.' },
    { id:'m_bone',    name:'변이체 뼛조각',    rarity:'common', icon:'drop',   qty:156, src:'fill',  desc:'토벌 후 회수. 파편 정련의 원료.' },
    { id:'m_ore',     name:'검은 철광',        rarity:'common', icon:'ingot',  qty:98,  src:'fill',  desc:'끊어진 도로 일대의 폐구조물에서 회수.' },
    { id:'m_dew',     name:'붉은 이슬',        rarity:'rare',   icon:'drop',   qty:37,  src:'fill',  desc:'갈대밭 새벽에만 맺힌다. 조제 재료.' },
    { id:'m_heart',   name:'심장 결정',        rarity:'legend', icon:'gem',    qty:11,  src:'fill',  desc:'보스급 변이체의 심장. 전설 장비 제작의 핵.' },
    { id:'m_oil',     name:'정제유',           rarity:'common', icon:'potion', qty:6,   src:'fill',  desc:'조제·수리에 쓰는 기름.' }
  ];

  /* ---------- 소모품 / 임무 아이템 ---------- */
  var CONSUMABLE = [
    { id:'c_potion',  name:'회복약',      type:'consumable', rarity:'common', icon:'potion', qty:47, src:'sheet', desc:'HP 35% 회복. 전투 중 사용 가능.' },
    { id:'c_throw',   name:'투척 폭약',   type:'consumable', rarity:'rare',   icon:'flame',  qty:18, src:'fill',  desc:'범위 피해 + 부위 파괴 게이지 증가.' },
    { id:'c_tool',    name:'채집 도구',   type:'consumable', rarity:'common', icon:'hammer', qty:2,  src:'sheet', desc:'출격 체크리스트 항목. 채집 노드 회수에 필요.' },
    { id:'c_antidote',name:'지혈제',      type:'consumable', rarity:'common', icon:'drop',   qty:6,  src:'fill',  desc:'출혈 상태 즉시 해제.' },
    { id:'q_record',  name:'정찰대의 기록', type:'quest',    rarity:'rare',   icon:'book',   qty:12, src:'sheet', desc:'의뢰 선택 목표. 갈대습지 정찰대가 남긴 기록.' },
    { id:'q_fragment',name:'변이체의 핵심 파편', type:'quest', rarity:'hero', icon:'gem',    qty:2,  src:'sheet', desc:'의뢰 선택 목표. 보스 도감 갱신에 사용.' }
  ];

  /* ---------- 보급소(상점) 카탈로그: buy = 구매 단가(없으면 판매 전용), sell = 판매 단가 ---------- */
  var SHOP = [
    { id:'c_potion',   buy:120,  sell:40,  tag:'출격 필수' },
    { id:'c_throw',    buy:450,  sell:160 },
    { id:'c_antidote', buy:90,   sell:30 },
    { id:'c_tool',     buy:300,  sell:100, tag:'체크리스트' },
    { id:'m_fiber',    buy:15,   sell:5 },
    { id:'m_ore',      buy:40,   sell:14 },
    { id:'m_bone',     buy:30,   sell:10 },
    { id:'m_dew',      buy:160,  sell:55 },
    { id:'m_oil',      buy:220,  sell:75 },
    { id:'m_alloy',    buy:350,  sell:120, tag:'강화' },
    { id:'m_shard',    buy:null, sell:600 },
    { id:'m_core',     buy:null, sell:1500 },
    { id:'m_booster',  buy:null, sell:700 },
    { id:'m_heart',    buy:null, sell:3000 }
  ];

  /* ---------- 제작 레시피 (강화 재료 요구량은 06-forge 시트의 필요 수치와 동일) ---------- */
  var RECIPE = [
    { id:'r_ryu_twinfang', result:'w_ryu_twinfang', cat:'weapon', craftLv:24, time:'00:14:00', cost:19000, src:'fill',
      mats:[['m_alloy',34],['m_shard',20],['m_core',5],['m_heart',1]] },
    { id:'r_sera_reagent', result:'w_sera_reagent', cat:'weapon', craftLv:24, time:'00:14:00', cost:18500, src:'fill',
      mats:[['m_alloy',28],['m_shard',16],['m_core',7],['m_dew',12]] },
    { id:'r_kain_crusher', result:'w_kain_crusher', cat:'weapon', craftLv:24, time:'00:14:00', cost:19500, src:'fill',
      mats:[['m_alloy',38],['m_ore',30],['m_core',6],['m_heart',1]] },
    { id:'r_kain_scrap', result:'w_kain_scrap', cat:'weapon', craftLv:12, time:'00:04:00', cost:3600, src:'fill',
      mats:[['m_ore',18],['m_alloy',6],['m_oil',6]] },
    { id:'r_ryu_shiv', result:'w_ryu_shiv', cat:'weapon', craftLv:12, time:'00:04:00', cost:3400, src:'fill',
      mats:[['m_ore',14],['m_alloy',6],['m_fiber',8]] },
    { id:'r_sera_vial', result:'w_sera_vial', cat:'weapon', craftLv:12, time:'00:04:00', cost:3200, src:'fill',
      mats:[['m_dew',8],['m_oil',6],['m_fiber',10]] },
    { id:'r_marsh_blade', result:'w_marsh_blade', cat:'weapon', craftLv:20, time:'00:12:00', cost:18000, src:'sheet',
      mats:[['m_alloy',36],['m_shard',18],['m_core',6],['m_heart',1]] },
    { id:'r_gauntlet', result:'a_steel_gauntlet', cat:'armor', craftLv:18, time:'00:06:00', cost:6200, src:'fill',
      mats:[['m_alloy',12],['m_ore',20],['m_fiber',8]] },
    { id:'r_boots', result:'a_ranger_boots', cat:'armor', craftLv:16, time:'00:05:00', cost:4400, src:'fill',
      mats:[['m_fiber',24],['m_bone',10],['m_alloy',4]] },
    { id:'r_charm', result:'acc_charm', cat:'acc', craftLv:14, time:'00:04:00', cost:3100, src:'fill',
      mats:[['m_dew',6],['m_bone',12],['m_shard',2]] },
    { id:'r_alloy', result:'m_alloy', cat:'material', craftLv:5, time:'00:00:30', cost:120, yield:2, src:'fill',
      mats:[['m_ore',10],['m_fiber',4]] },
    { id:'r_shard', result:'m_shard', cat:'material', craftLv:12, time:'00:01:00', cost:600, yield:1, src:'fill',
      mats:[['m_bone',6],['m_heart',1]] },
    { id:'r_booster', result:'m_booster', cat:'material', craftLv:15, time:'00:02:00', cost:900, yield:1, src:'fill',
      mats:[['m_dew',5],['m_oil',2]] },
    { id:'r_potion', result:'c_potion', cat:'consumable', craftLv:1, time:'00:00:20', cost:40, yield:3, src:'fill',
      mats:[['m_fiber',3],['m_dew',1]] },
    { id:'r_throw', result:'c_throw', cat:'consumable', craftLv:10, time:'00:00:45', cost:220, yield:2, src:'fill',
      mats:[['m_oil',1],['m_bone',4],['m_ore',2]] }
  ];

  /* ---------- 제작 자유도: 장비 레시피는 주재료·보조 재료·촉매를 고른다. 재료가 수치·이름·외형(색·광택·발광·크기)을 바꾼다 ---------- */
  var CRAFT_SLOTS = [
    { key:'core', name:'주재료', n:8, opts:['m_ore','m_alloy','m_core','m_heart'], hint:'날·판의 재질. 공격·방어의 뼈대' },
    { key:'grip', name:'보조 재료', n:6, opts:['m_fiber','m_bone','m_dew','m_oil'], hint:'자루·안감. 손맛과 부가 능력' },
    { key:'cat',  name:'촉매', n:2, opts:[null,'m_shard','m_booster'], hint:'선택. 마무리 처리' }
  ];
  var CRAFT_FX = {
    m_ore:    { mul:{atk:1.00,def:1.00,hp:1.00}, add:{}, name:'철',   look:{ tint:'#6f5b4a', metal:0.6, rough:0.75, glow:0 }, desc:'기본. 녹슨 철의 무게' },
    m_alloy:  { mul:{atk:1.08,def:1.08,hp:1.04}, add:{}, name:'합금', look:{ tint:'#9aa3ad', metal:0.9, rough:0.35, glow:0 }, desc:'공격·방어 +8%, 강철 광택' },
    m_core:   { mul:{atk:1.15,def:1.06,hp:1.06}, add:{skill:3}, name:'코어', look:{ tint:'#c8503c', metal:0.7, rough:0.45, glow:0.6, glowColor:'#ff4a2a' }, desc:'공격 +15%, 스킬 피해 +3%, 날이 붉게 달아오름', rarityUp:1 },
    m_heart:  { mul:{atk:1.25,def:1.12,hp:1.10}, add:{crit:4}, name:'심장', look:{ tint:'#7a4bd6', metal:0.5, rough:0.30, glow:0.9, glowColor:'#b06cff', scale:1.08 }, desc:'공격 +25%, 치명타 +4%, 결정 광택·날이 커짐', rarityUp:1 },
    m_fiber:  { mul:{}, add:{hp:300}, name:'섬유', look:{}, desc:'HP +300 (가벼운 감기)' },
    m_bone:   { mul:{}, add:{crit:2,critDmg:5}, name:'골각', look:{ rough:0.1 }, desc:'치명타 +2%, 치명타 피해 +5%, 뼈 장식(거친 결)' },
    m_dew:    { mul:{}, add:{crit:3}, name:'이슬', look:{ glow:0.3, glowColor:'#ff6a6a' }, desc:'치명타 +3%, 붉은 기운' },
    m_oil:    { mul:{}, add:{bleed:12}, name:'정제', look:{ rough:-0.15 }, desc:'출혈 적중 +12, 기름 광택' },
    m_shard:  { mul:{}, add:{skill:4}, name:'파편', look:{ glow:0.2 }, desc:'스킬 피해 +4%' },
    m_booster:{ mul:{}, add:{}, name:'담금', look:{}, startEnh:1, desc:'완성과 동시에 +1 강화' }
  };
  function register(it){ byId[it.id]=it; return it; }

  /* ---------- 강화 단계표 (+5 → 65% / 18,000 은 06-forge 시트 수치) ---------- */
  var ENHANCE = [
    { to:1, rate:92,  cost:1200,  mats:[['m_alloy',4]] },
    { to:2, rate:88,  cost:2400,  mats:[['m_alloy',8]] },
    { to:3, rate:82,  cost:4800,  mats:[['m_alloy',12],['m_shard',2]] },
    { to:4, rate:78,  cost:9600,  mats:[['m_alloy',20],['m_shard',8]] },
    { to:5, rate:65,  cost:18000, mats:[['m_alloy',36],['m_shard',18],['m_core',6],['m_booster',2]] },
    { to:6, rate:52,  cost:26000, mats:[['m_alloy',48],['m_shard',24],['m_core',10],['m_booster',3]] },
    { to:7, rate:40,  cost:36000, mats:[['m_alloy',64],['m_shard',32],['m_core',16],['m_booster',4]], unlock:'옵션 잠금 해제' },
    { to:8, rate:30,  cost:48000, mats:[['m_alloy',80],['m_shard',40],['m_core',24],['m_booster',6]] },
    { to:9, rate:22,  cost:64000, mats:[['m_alloy',100],['m_shard',52],['m_core',32],['m_booster',8]] },
    { to:10,rate:15,  cost:90000, mats:[['m_alloy',128],['m_shard',64],['m_core',48],['m_booster',12],['m_heart',1]] }
  ];

  /* ---------- 플레이어 상태 (시트 기준: 아인 LV.26, 골드 75,300) ---------- */
  var PLAYER = {
    gold: 75300, craftLv: 20,
    equipped: { main:'w_marsh_scythe', sub:'w_ash_dirk', off:'w_hook_scythe', merc:null,
                head:null, chest:'a_reed_cuirass', legs:'a_black_greaves', gloves:'a_steel_gauntlet', boots:'a_ranger_boots', acc:'acc_blood_ring' },
    /* 인벤토리 (장착품 제외) — 05-inventory 시트 그리드 순서 */
    bag: [
      { item:'w_rust_executioner' }, { item:'w_marsh_blade' }, { item:'w_ruin_spear' }, { item:'w_rust_sword' },
      { item:'a_hood' }, { item:'acc_charm' }, { item:'acc_band' }
    ]
  };

  /* ---------- 조회 ---------- */
  var byId = {};
  EQUIP.forEach(function(x){ byId[x.id]=x; });
  MATERIAL.forEach(function(x){ x.type='material'; byId[x.id]=x; });
  CONSUMABLE.forEach(function(x){ byId[x.id]=x; });

  /* 무기 사용 가능 캐릭터: cls 가 없으면 종류로 판단 */
  var CLS_BY_KIND={ '낫(대형)':['ain'], '낫(소형)':['ain'], '검':['kain','ain'], '근접 무기(검)':['kain','ain'], '장창':['kain','ain'], '대검':['kain'], '단검':['ryu','ain'], '쌍단검':['ryu'], '시약':['sera'] };
  function usableBy(id, cid){ var it=get(id); if(!it) return false; if(it.type!=='weapon') return true; var cls=it.cls||CLS_BY_KIND[it.kind]||['ain','kain','ryu','sera']; return cls.indexOf(cid)>=0; }
  function get(id){ return byId[id] || null; }
  function rarityOf(id){ var it=get(id); return it ? RARITY[it.rarity] : RARITY.common; }
  function fmt(n){ return (n==null) ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function slotIcon(id){ var it=get(id); return it ? it.icon : 'lock'; }
  /* 아이템 고유 이미지(art/items/<id>.svg). 제작품은 기본형 이미지 + 재료 색조·광채를 덧씌운다. 이미지가 없으면 스프라이트 아이콘으로 대체. */
  var ART_DIR='art/items/';
  function artOf(id){ var it=(id&&typeof id==='object')?id:get(id); if(!it) return null; return ART_DIR+(it.custom?it.custom.base:it.id)+'.svg'; }
  function artHTML(id, cls){
    var it=(id&&typeof id==='object')?id:get(id); if(!it) return '';
    var src=artOf(it), look=it.custom&&it.custom.look, glow=look&&look.glow>0;
    var h='<span class="itart'+(cls?' '+cls:'')+(glow?' itart--glow':'')+'"'+(glow?' style="--glow:'+(look.glowColor||'#ff6a6a')+'"':'')+'>'+
      '<img src="'+src+'" alt="" draggable="false" onerror="this.parentNode.classList.add(\'noimg\')">';
    if(look&&look.tint) h+='<i style="background:'+look.tint+';-webkit-mask-image:url('+src+');mask-image:url('+src+')"></i>';
    return h+'<svg class="ico"><use href="#i-'+it.icon+'"/></svg></span>';
  }
  function canCraft(r){
    return r.mats.every(function(m){ var it=get(m[0]); return it && (it.qty||0) >= m[1]; }) && PLAYER.gold >= r.cost && PLAYER.craftLv >= r.craftLv;
  }
  function craft(r, n){
    n = n || 1;
    for (var i=0;i<n;i++){
      if (!canCraft(r)) return i;
      r.mats.forEach(function(m){ get(m[0]).qty -= m[1]; });
      PLAYER.gold -= r.cost;
      var res = get(r.result);
      if (res.type==='material' || res.type==='consumable') res.qty = (res.qty||0) + (r.yield||1);
      else PLAYER.bag.push({ item:r.result, made:true });
    }
    return n;
  }
  /* 슬롯 마크업 (공용) */
  function slotHTML(id, opt){
    opt = opt || {};
    var it = get(id); if(!it) return '<div class="slot slot--empty"></div>';
    var r = RARITY[it.rarity].cls;
    var tag = opt.noTag ? '' : it.type==='material'||it.type==='consumable'||it.type==='quest'
      ? '<span class="slot__ct">'+fmt(opt.qty!=null?opt.qty:it.qty)+'</span>'
      : (it.enh ? '<span class="slot__lv">+'+it.enh+'</span>' : '');
    return '<div class="slot'+(opt.on?' is-on':'')+'" data-r="'+r+'" data-id="'+id+'" title="'+it.name+'">'+
           artHTML(id)+tag+'</div>';
  }

  window.TW_ITEMS = {
    RARITY:RARITY, TYPE:TYPE, SLOT:SLOT,
    usableBy:usableBy, EQUIP:EQUIP, MATERIAL:MATERIAL, CONSUMABLE:CONSUMABLE, RECIPE:RECIPE, ENHANCE:ENHANCE, PLAYER:PLAYER, SHOP:SHOP, CRAFT_SLOTS:CRAFT_SLOTS, CRAFT_FX:CRAFT_FX, register:register,
    get:get, rarityOf:rarityOf, fmt:fmt, slotIcon:slotIcon, artOf:artOf, artHTML:artHTML, canCraft:canCraft, craft:craft, slotHTML:slotHTML
  };
})();
