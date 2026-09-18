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
    { id:'acc_blood_ring', name:'핏빛 인장 반지', type:'acc', slot:'acc', kind:'반지', rarity:'hero', icon:'ring',
      origin:'외곽지대 > 매립지', cp:540, enh:4, enhMax:10, reqLv:20, bind:'캐릭터 귀속', dur:[100,100], price:7400, src:'fill',
      stats:{ crit:2.4, critDmg:6.0, skill:1.6 }, effect:'출혈 피해 +10%', flavor:'' },
    { id:'acc_charm', name:'부적 목걸이', type:'acc', slot:'acc', kind:'목걸이', rarity:'rare', icon:'seal',
      origin:'제작', cp:380, enh:2, enhMax:10, reqLv:14, bind:'미귀속', dur:[100,100], price:2900, src:'fill',
      stats:{ hp:800, def:120 }, effect:'상태 이상 지속 -10%', flavor:'' },
    { id:'acc_band', name:'구리 밴드', type:'acc', slot:'acc', kind:'반지', rarity:'common', icon:'ring',
      origin:'도심지', cp:120, enh:1, enhMax:10, reqLv:5, bind:'미귀속', dur:[100,100], price:300, src:'fill',
      stats:{ crit:0.6 }, effect:'', flavor:'' }
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
    EQUIP:EQUIP, MATERIAL:MATERIAL, CONSUMABLE:CONSUMABLE, RECIPE:RECIPE, ENHANCE:ENHANCE, PLAYER:PLAYER, SHOP:SHOP, CRAFT_SLOTS:CRAFT_SLOTS, CRAFT_FX:CRAFT_FX, register:register,
    get:get, rarityOf:rarityOf, fmt:fmt, slotIcon:slotIcon, artOf:artOf, artHTML:artHTML, canCraft:canCraft, craft:craft, slotHTML:slotHTML
  };
})();
