/* 황혼 — 던전 데이터
  window.TW_DUNGEONS = { RULES, ARENAS, SKILLS }
   · RULES  : 모든 던전이 공유하는 전투 공통 규칙 (docs/design/01-training-arena.md §3)
   · ARENAS : 훈련장 등 아레나. 허수아비는 world.js BOSSES 와 같은 형식(weakpoints/patterns/mastery/hud) 위에 엔진 필드를 얹는다
   · 허수아비 원화: design-sheets/10-dummy.webp (사슬에 묶인 나무 구조체, 가슴에 붉은 핵). 3단계는 같은 개체의 잠듦→사슬→각성 상태
   · 수치 원본: 캐릭터 스탯은 world.js CHARS, 보상 아이템은 items.js. 그 외 상수는 기획서 v0.1 제안값 */
(function(){
  var RULES = {
    tick: 0.01,
    motion: { clipContacts:{attack1:0.34,attack2:0.44,attack3:0.50,smash:0.78,ult:0.50,skill1:0.50,skill2:0.50,skill3:0.55,skill4:0.50,counter:0.48,exec:0.58}   /* attack3·skill2·skill4 는 모캡 클립의 손목 최고속 지점 (tools/3d/mocap.py) */, buffer:0.16, light:{hit:0.24,active:0.09,duration:0.66,cancel:0.48,clipHit:0.42},
      smash:{hit:0.40,active:0.12,duration:0.96,cancel:0.76,clipHit:0.48},
      counter:{hit:0.18,active:0.08,duration:0.56,cancel:0.40,clipHit:0.42},
      ult:{hit:0.55,active:0.15,duration:1.20,cancel:1.05,clipHit:0.50},
      skill:{hit:0.42,active:0.14,duration:1.00,cancel:0.82,clipHit:0.50},
      exec:{hit:0.72,active:0.20,duration:1.60,cancel:1.45,clipHit:0.58},
      /* 아인 공격 기술만: 준비와 회수를 늘린다. 이동/회피/버프/기본 연타는 유지.
         서버와 솔로가 같은 clip별 시간표를 사용하며, 피해량/쿨타임은 바꾸지 않는다. */
      characterProfiles:{ain:{
        skill1:{hit:.58,active:.14,duration:1.32,cancel:1.02},
        skill3:{hit:.64,active:.14,duration:1.42,cancel:1.10},
        ult:{hit:.80,active:.15,duration:1.62,cancel:1.38}
      }} },   /* 처형은 길고 확실하게 — 크게 들었다 내리꽂는다 */
    /* 히트스톱은 세기에 비례한다 (docs/design/18-boss-fight-design.md §1-2). hit 은 하위 호환용 기본값 */
    /* 히트스톱 — 올렸다. 그전에 「못 올린다」고 적어 뒀던 이유가 틀렸다.
       「행동 시계가 멈추면 회피로 빠져나갈 시점이 밀려 입력 버퍼 계약이 깨진다」고 썼는데,
       실제로 재 보니 회피는 «항상» 나간다. 늘어난 히트스톱만큼 늦게 나갈 뿐이다:

         light 0.060 → 누르고 0.07초 뒤 발동      light 0.120 → 0.14초 뒤
         light 0.090 → 0.10초 뒤                  light 0.150 → 0.16초 뒤

       버려지는 입력은 없다 (버퍼 ttl 도 멈춤 동안 같이 멈춘다). 깨진 건 계약이 아니라
       벽시계 초를 못 박아 둔 «테스트» 였다 — tick(.47) 뒤 tick(.08) 안에 끝나기를
       기대했는데, 더 오래 멈추니 그 창 밖으로 밀렸을 뿐이다. 테스트를 상대 시간으로 고쳤다.
       (docs/design/50 §2.1)

       그래서 멈춤은 «세기» 에 비례해 건다. 흘림 → 튕김 → 맞대기 로 갈수록 오래 멈춘다.
       마영전의 힘겨루기가 그 자리다. 무기별 rhythm[*].stop 으로 더 조절한다. */
    hitstop: { light:0.09, chain:0.13, smash:0.21, counter:0.21, perfect:0.24, brk:0.28, execute:0.38, hurt:0.11, guard:0.06, hit:0.10,
               deflect:0.12, clash:0.38 },
    execute: { mult:4.5 },   /* 처형 배율 (자세 붕괴 중 1회) */
    /* 경직 — 맞으면 «밀린다». 지금까지는 자리에 서서 hit 클립만 한 번 재생했다
       (최고속 1.9 m/s · 진폭 0.30 m — 맞아도 거의 안 움직였다, docs/design/50 §4).
       몬헌은 약경직/대경직/다운/기절이 나뉘어 있다. 우리는 우선 둘로 나눈다:
         · light  스쳐 맞음 — 짧게 굳고 반 걸음 밀린다
         · heavy  최대 체력의 heavyAt 이상을 한 번에 맞음 — 크게 굳고 한 걸음 반 밀린다
         · guard  막아 냄 — 거의 안 밀리고 금방 푼다
       push 는 월드 px (SCALE=50 px/m 이므로 22px = 0.44 m), lock·dur 은 초.
       밀리는 «거리» 의 벤치마크 수치는 못 찾았다 — 구르기(170px = 3.4 m)를 기준으로
       약경직을 그 1/8, 대경직을 1/3 로 잡았다. 「근거 없음」, 디렉터가 보고 정할 값. */
    stagger: { heavyAt:0.12,
               light:{ clip:'hit',      lock:0.26, push:22, dur:0.18, shake:0.010, vib:60  },
               heavy:{ clip:'hit2',     lock:0.46, push:60, dur:0.28, shake:0.019, vib:110 },
               guard:{ clip:'guardHit', lock:0,    push:14, dur:0.12, shake:0.004, vib:15  } },
    /*         ↑ 가드는 굳히지 않는다 — 막고 바로 반격하는 것이 이 게임의 설계다 */
    /* 무기별 리듬 — 몬헌의 «무기 개성». 지금까지 네 캐릭터가 같은 박자로 휘둘렀다.
       dur 은 모션 길이(클수록 느리고 무겁다), stop 은 히트스톱, st 는 스태미나 소모.
       피해량은 건드리지 않는다 — 느린 쪽은 한 방이 크고, 빠른 쪽은 자주 친다(기존 배율 유지). */
    rhythm: {
      ain:  { nm:'낫',     dur:1.00, stop:1.00, st:1.00 },   /* 기준 */
      kain: { nm:'대검',   dur:1.20, stop:1.28, st:1.14 },   /* 느리고 무겁다 — 멈춤이 길다 */
      ryu:  { nm:'쌍단검', dur:0.82, stop:0.74, st:0.86 },   /* 빠르고 가볍다 — 멈춤이 짧다 */
      sera: { nm:'시약',   dur:1.06, stop:0.86, st:1.04 }    /* 중간. 던지는 무기라 멈춤이 얕다 */
    },
    stamina: { max:120, regen:18, delay:0.6, dodge:25, guardPerSec:12 },
    dodge:   { iframes:0.30, cooldown:0.45 },
    guard:   { reduce:0.70, holdMs:220 },
    /* 카운터 3단. 남은 예고 시간(E.tele)이 «작을수록» 늦게, 즉 정확하게 받아친 것이다.
         tele <= perfect  → 맞대기 clash  : 둘 다 멈춘다. 힘겨루기.
         tele <= mid      → 튕김   repel  : 적이 밀려나고 반격창이 열린다.
         그 밖            → 흘림   deflect: 스쳐 흘린다. 이득은 작다.
       숙련도(R.counter.bonus)가 바깥 창을 넓히면 중간 경계도 같은 비율로 따라 넓어진다. */
    counter: { window:0.25, perfect:0.10, mid:0.17, mult:2.5, perfectMult:3.0, deflectMult:1.7,
               posture:30, tierPosture:{deflect:0.47, repel:1.0, clash:1.5}, ult:18 },
    combo:   { gap:0.55, mults:[1.0,1.0,1.1,1.2], smash:[1.6,2.0,2.6,3.4], smashPosture:[12,18,28,45], smashSt:[10,12,14,18], smashHold:0.2 },   /* 마영전식: 일반 4연타 + 스매시(타수별 배율) */
    weak:    { weak:1.5, broken:1.25, normal:1.0 },
    bleed:   { chance:0.07, dur:3, tickRate:0.20, maxStacks:3 },
    posture: { max:100, onBreak:40, onGuard:10, downDur:5, downMult:1.5 },
    ult:     { max:100, onBreak:25, onHit:4, onAttack:2 },
    attack:  { base:0.5, lockAfterEarly:0.15 },  /* 기본 공격 간격(초) ÷ (aspd/100) · 예고 중 성급한 공격은 적의 타격까지 + 0.15초 동안 굳는다 */
    grade:   { S:{time:0.50,parts:1.0,counter:0.70}, A:{time:0.75,parts:2,counter:0.50}, B:{time:1.0,parts:1} }
  };

  /* 아인 기술 4 + 궁극기 (icons.js 심볼 이름 사용) */
  var SKILLS = {
    ain: [
      { key:'1', id:'slash',  icon:'scythe', name:'낫 베기',     mult:2.2, cd:6,  st:15, desc:'좁은 전방의 선택 부위를 정밀하게 걸어 벤다' },
      { key:'2', id:'step',   icon:'bolt',   name:'그림자 걸음', mult:0,   cd:8,  st:20, desc:'즉시 회피 + 다음 공격 치명타 확정', dodge:true, critNext:true },
      { key:'3', id:'spin',   icon:'flame',  name:'피의 회전',   mult:1.2, cd:12, st:25, desc:'넓은 전방에서 사거리 안에 들어온 부위를 벤다', aoe:true },
      { key:'4', id:'resolve',icon:'shield', name:'결의',        mult:0,   cd:15, st:0,  desc:'2초간 받는 피해 50% 감소', buff:{dur:2, reduce:0.5} }
    ],
    ainUlt: { key:'R', id:'twilight', icon:'scythe', name:'낫의 황혼', mult:6.0, bleed:3, desc:'궁극기. 강타 + 출혈 3중첩' },
    /* 카인 — 블레이드 마스터(탱커/브루저): 대검. 파괴·버티기 */
    kain: [
      { key:'1', id:'cleave', icon:'sword',  name:'대검 내려치기', mult:2.6, cd:7,  st:18, desc:'선택 부위에 묵직한 일격 · 파괴 피해 증가' },
      { key:'2', id:'brace',  icon:'shield', name:'철벽',          mult:0,   cd:12, st:0,  desc:'3초간 받는 피해 60% 감소', buff:{dur:3, reduce:0.6} },
      { key:'3', id:'whirl',  icon:'flame',  name:'강철 회전',     mult:1.4, cd:13, st:28, desc:'모든 부위에 피해', aoe:true },
      { key:'4', id:'stomp',  icon:'hammer', name:'지면 강타',     mult:1.8, cd:10, st:20, desc:'자세 피해 큰 일격' }
    ],
    kainUlt: { key:'R', id:'anvil', icon:'sword', name:'모루의 심판', mult:5.5, bleed:1, desc:'궁극기. 대검 강타 + 출혈' },
    /* 류 — 레인저(딜러): 쌍단검. 기동·연속 처치 */
    ryu: [
      { key:'1', id:'fan',    icon:'crosshair', name:'쌍날 난무',   mult:2.0, cd:5,  st:14, desc:'선택 부위에 빠른 연속 베기' },
      { key:'2', id:'shadow', icon:'bolt',      name:'그림자 도약', mult:0,   cd:7,  st:18, desc:'즉시 회피 + 다음 공격 치명타 확정', dodge:true, critNext:true },
      { key:'3', id:'storm',  icon:'flame',     name:'칼날 폭풍',   mult:1.1, cd:11, st:24, desc:'모든 부위에 피해', aoe:true },
      { key:'4', id:'mark',   icon:'eye',       name:'표식',        mult:0,   cd:14, st:0,  desc:'2초간 받는 피해 40% 감소', buff:{dur:2, reduce:0.4} }
    ],
    ryuUlt: { key:'R', id:'redshadow', icon:'crosshair', name:'붉은 그림자', mult:5.2, bleed:3, desc:'궁극기. 연속 찌르기 + 출혈 3중첩' },
    /* 세라 — 위치 메이커(서포터): 시약 투척·정제 */
    sera: [
      { key:'1', id:'vial',   icon:'potion', name:'부식 시약',     mult:1.9, cd:6,  st:14, desc:'선택 부위에 시약 투척' },
      { key:'2', id:'mist',   icon:'seal',   name:'정제 안개',     mult:0,   cd:9,  st:16, desc:'즉시 회피 + 다음 공격 치명타 확정', dodge:true, critNext:true },
      { key:'3', id:'burst',  icon:'flame',  name:'연쇄 폭발',     mult:1.3, cd:12, st:26, desc:'모든 부위에 피해', aoe:true },
      { key:'4', id:'ward',   icon:'heart',  name:'회복 결계',     mult:0,   cd:15, st:0,  desc:'3초간 받는 피해 50% 감소', buff:{dur:3, reduce:0.5} }
    ],
    seraUlt: { key:'R', id:'catalyst', icon:'potion', name:'촉매 폭발', mult:5.0, bleed:2, desc:'궁극기. 대형 시약 폭발 + 출혈 2중첩' }
  };

  function dummy(o){
    o.parts.forEach(function(p){ p.hpMax = p.hp; });
    o.weakpoints = o.parts.map(function(p){ return { part:p.name, tag:p.weak?'약점':(p.hp?'파괴 가능':'일반'), effect:p.effect||'', pos:p.pos }; });
    o.hud = { name:o.name, src:'design' };
    return o;
  }

  var ARENAS = {
    tutorial: {
      id:'tutorial', name:'지하 훈련장', place:'마태오의 인력사무소 지하 벙커', char:'ain', unlock:'q_marsh',
      art:'lobby-city', hudName:'허수아비',
      /* 3D: 모델·부위→뼈·파괴 조각·패턴 아이콘→클립 (game3d.js) */
      model:'art/3d/boss_anim.glb', pieces:'dummy', tint:{ dormant:0xb8b0a8, chained:0xd8d0c8, awake:0xffffff }, glow:{ dormant:0.35, chained:0.6, awake:1 },
      parts3d:{ core:{ bone:'Spine2', off:[0,0.05,0.42], r:0.32 }, body:{ bone:'Spine', off:[0,0.1,0.3], r:0.7 }, head:{ bone:'Head', off:[0,0.15,0.05], r:0.4 }, shl:{ bone:'LeftArm', off:[0.05,0.1,0], r:0.36 }, shr:{ bone:'RightArm', off:[-0.05,0.1,0], r:0.36 }, chain:{ bone:'Spine1', off:[0,0.05,0.4], r:0.45 } },
      atk:{ hammer:{ clip:'atk_hammer', hitFrac:0.48 }, bolt:{ clip:'atk_bolt', hitFrac:0.35 }, scythe:{ clip:'atk_scythe', hitFrac:0.30 } },
      rewards:{ gold:1500, items:[['m_fiber',20],['m_ore',10],['c_potion',3],['c_antidote',2]], sBonus:[['m_oil',2]] },
      stages:[
        dummy({ id:'dormant', name:'잠든 허수아비', lesson:'기본', timeLimit:30, hp:120000, kind:'dormant',
          line:'가슴의 핵을 노려라. 낫은 거기서 제일 잘 든다.', hint:'우측을 탭해 공격 · 허수아비의 부위를 탭해 조준',
          parts:[ { id:'core', name:'핵', hp:null, weak:true, pos:'tl', effect:'피해 증가' }, { id:'body', name:'몸통', hp:null, pos:'br' } ],
          patterns:[],
          mastery:[ ['S','15초 이내'], ['A','22초 이내'], ['B','30초 이내'], ['C','30초 초과'] ] }),
        dummy({ id:'chained', name:'사슬 허수아비', lesson:'부위 파괴', timeLimit:45, hp:260000, kind:'chained',
          line:'견갑부터. 겉을 벗기면 안이 보인다.', hint:'좌측을 쓸어 회피 · 견갑 두 개를 부수면 격추',
          parts:[ { id:'shl', name:'왼 견갑', hp:45000, breakable:true, pos:'tl', effect:'몸통 보호 해제', rig:'padL' },
                  { id:'shr', name:'오른 견갑', hp:45000, breakable:true, pos:'tr', effect:'몸통 보호 해제', rig:'padR' },
                  { id:'core', name:'핵', hp:null, weak:true, pos:'bl', effect:'피해 증가', guardedBy:['shl','shr'], guardReduce:0.5 },
                  { id:'body', name:'몸통', hp:null, pos:'br', guardedBy:['shl','shr'], guardReduce:0.5 } ],
          allBrokenDown:true,
          patterns:[ { icon:'hammer', name:'느린 내려찍기', rank:'B', tele:1.0, window:0.40, dmg:400, posture:30, guardCost:15, every:6, desc:'예고가 길다. 회피를 익힌다' } ],
          mastery:[ ['S','25초 이내 · 견갑 2개 파괴'], ['A','34초 이내 · 견갑 1개 이상'], ['B','45초 이내'], ['C','45초 초과'] ] }),
        dummy({ id:'awake', name:'깨어난 허수아비', lesson:'카운터', timeLimit:60, hp:380000, kind:'awake',
          line:'예고를 보고 치지 마라. 예고가 끝나는 순간에 쳐라.', hint:'붉은 고리가 흰색이 되는 순간 탭 = 카운터',
          parts:[ { id:'core', name:'핵', hp:null, weak:true, pos:'tl', effect:'피해 증가' },
                  { id:'chain', name:'가슴 사슬', hp:60000, breakable:true, pos:'tr', effect:'예고 +0.2초', onBreak:{ telePlus:0.2 } },
                  { id:'body', name:'몸통', hp:null, pos:'br' } ],
          firstCounterUlt:true, counterWindow:0.40,
          patterns:[ { icon:'bolt',   name:'찌르기',     rank:'A', tele:0.6, window:0.40, dmg:600,  posture:30, guardCost:15, desc:'짧은 예고' },
                     { icon:'scythe', name:'회전 후려치기', rank:'A', tele:0.9, window:0.40, dmg:900,  posture:30, guardCost:30, desc:'방어 시 스태미나 30' },
                     { icon:'hammer', name:'양손 내려찍기', rank:'S', tele:1.2, window:0.40, dmg:1400, posture:60, guardCost:20, desc:'카운터 성공 시 즉시 격추' } ],
          patternGap:1.4,
          mastery:[ ['S','30초 이내 · 사슬 파괴 · 카운터 70%'], ['A','45초 이내 · 카운터 50%'], ['B','60초 이내'], ['C','60초 초과'] ] })
      ]
    },
    /* 던전 02 갈대습지 — 대형 변이체 「모르버스」 (world.js BOSSES.b_marsh 의 부위·패턴을 엔진 수치로). 2단계: 통상 → 피의 광란(HP 30%) */
    marsh: {
      id:'marsh', name:'갈대습지 분지', place:'외곽지대 · 갈대습지', char:'ain', unlock:null, quest:'q_marsh',
      art:'boss-marsh', hudName:'모르버스',
      model:'art/3d/boss_marsh_v2.glb', scale:0.85, pieces:'nodes', tint:{ marsh:0xffffff, rage:0xffb0a0 }, glow:{ marsh:0.8, rage:1.4 },
      parts3d:{ head:{ bone:'Head', off:[0,0.15,0.55], r:0.6 }, back:{ bone:'Spine1', off:[0,0.85,0], r:0.8 }, legf:{ bone:'FR_Low', off:[0,0.35,0.1], r:0.6 }, tail:{ bone:'Tail2', off:[0,0.25,0], r:0.6 }, body:{ bone:'Spine', off:[0,0.1,0], r:1.0 }, core:{ bone:'Spine2', off:[0,-0.55,0.45], r:0.4 } },
      atk:{ bolt:{ clip:'atk_bolt', hitFrac:0.5 }, flame:{ clip:'atk_flame', hitFrac:0.45 }, hammer:{ clip:'atk_hammer', hitFrac:0.5 }, scythe:{ clip:'atk_scythe', hitFrac:0.5 }, drop:{ clip:'atk_drop', hitFrac:0.5 },
        /* 연계 비트 전용 모션 — 같은 동작을 두 번 트는 대신 «되받는» 동작을 따로 둔다 */
        boltB:{ clip:'atk_bolt_b', hitFrac:0.5 }, dropB:{ clip:'atk_drop_b', hitFrac:0.5 }, dropC:{ clip:'atk_drop_c', hitFrac:0.5 } },
      rewards:{ gold:18000, items:[['m_alloy',24],['m_shard',1],['m_core',1],['c_potion',2]], sBonus:[['m_core',1],['m_dew',3]] },
      stages:[
        dummy({ id:'morbus', name:'모르버스', lesson:'토벌', timeLimit:600, hp:1100000, kind:'marsh',
          line:'머리를 노려라. 등·앞다리·꼬리를 부수면 놈이 무너진다.', hint:'돌진은 옆으로 구르고, 강타는 뒤로. 포효는 방어',
          parts:[ { id:'head', name:'머리', hp:null, weak:true, pos:'tl', effect:'피해 증가' },
                  { id:'back', name:'등 견갑', hp:160000, breakable:true, pos:'tr', effect:'자세 파괴', onBreak:{ posture:60 } },
                  { id:'legf', name:'앞다리', hp:140000, breakable:true, pos:'bl', effect:'이동 둔화', onBreak:{ slow:0.6 } },
                  { id:'tail', name:'꼬리', hp:120000, breakable:true, pos:'br', effect:'공격 범위 감소', onBreak:{ zoneScale:0.7 } },
                  { id:'body', name:'몸통', hp:null, pos:'br' } ],
          /* 연계·지연타: docs/design/18-boss-fight-design.md §2. 반격 창은 연계의 마지막 타격에만 열린다 */
          patterns:[ { icon:'bolt',   name:'돌진 베기',   rank:'S', tele:0.9, window:0.40, dmg:1500, posture:40, guardCost:25, range:'far',  desc:'돌진 후 두 번 벤다 · 두 번째가 반격 기회',
                       chain:[{ tele:0.55, dmg:1150, posture:30, gap:0.22, icon:'boltB' }] },
                     { icon:'flame',  name:'광폭 포효',   rank:'A', tele:1.1, window:0.40, dmg:700,  posture:20, guardCost:35, range:'any',  recovery:1.3, desc:'넓은 충격파 · 끝난 뒤 크게 비어 있다' },
                     { icon:'hammer', name:'대지 강타',   rank:'S', tele:1.35, window:0.40, dmg:1800, posture:60, guardCost:25, range:'near', hold:{ at:0.58, dur:0.35 }, desc:'앞발을 든 채 «버틴다» · 떨어지는 순간을 봐라' },
                     { icon:'scythe', name:'꼬리 휘두르기', rank:'A', tele:0.8, window:0.40, dmg:1100, posture:30, guardCost:30, range:'near', counterable:false, desc:'넓은 회전 · 튕길 수 없다, 범위 밖으로' } ],
          patternGap:1.6, counterWindow:0.32,
          mastery:[ ['S','5분 이내 처치 · 모든 파괴 부위 파괴'], ['A','10분 이내 처치 · 파괴 부위 2개 이상'], ['B','15분 이내 처치 · 파괴 부위 1개 이상'], ['C','15분 초과'] ] }),
        dummy({ id:'rage', name:'피의 광란 모르버스', lesson:'광란', timeLimit:300, hp:480000, kind:'rage',
          line:'핵이 드러났다. 예고가 짧다. 붙어서 끝내라.', hint:'광란 연타는 옆으로 구르고, 돌진 직후가 빈틈',
          parts:[ { id:'core', name:'핵', hp:null, weak:true, pos:'tl', effect:'피해 증가' }, { id:'head', name:'머리', hp:null, weak:true, pos:'tr', effect:'피해 증가' }, { id:'body', name:'몸통', hp:null, pos:'br' } ],
          patterns:[ { icon:'drop',   name:'피의 광란',   rank:'S', tele:0.7, window:0.36, dmg:1300, posture:40, guardCost:30, range:'near', desc:'발톱 3연격 · 마지막만 튕길 수 있다',
                       chain:[{ tele:0.45, dmg:1050, posture:30, gap:0.18, icon:'dropB' }, { tele:0.45, dmg:1200, posture:35, gap:0.18, icon:'dropC' }] },
                     { icon:'bolt',   name:'돌진 베기',   rank:'S', tele:0.7, window:0.36, dmg:1600, posture:40, guardCost:25, range:'far',  desc:'더 빠른 돌진' },
                     { icon:'hammer', name:'대지 강타',   rank:'S', tele:1.05, window:0.36, dmg:2000, posture:60, guardCost:25, range:'near', hold:{ at:0.6, dur:0.28 }, desc:'짧게 버텼다 내려찍는다' } ],
          patternGap:1.1, counterWindow:0.30,
          mastery:[ ['S','—'], ['A','—'], ['B','—'], ['C','—'] ] })
      ]
    }
  };

   /* 상세 게임 기획 v1 §0/§2/§3/각수-0 + 디렉터 지시: 실력 진입 시험.
     배율은 이번 구현 조정값. 첫 단계부터 반격하며, 자동 궁극기 지급 없음. */
  /* 페이즈별 아레나 변화 (docs/design/18-boss-fight-design.md §13).
     dx/dy 는 보스 자리 기준 오프셋(레벨 단위), damage 는 최대 체력 비율. */
  ARENAS.tutorial.stageFx=[ null,
    { light:0.94, fog:1.12 },
    /* 훈련장은 가르치는 곳 — 바닥 위험 구역 없이 «분위기»만 바꾼다 */
    { light:0.84, fog:1.30, sky:0x140d0e, color:0xD94A45, line:'비상등이 들어왔다' } ];
  ARENAS.marsh.stageFx=[ null,
    { light:0.88, fog:1.35, sky:0x1a1210, color:0xB05A2A, line:'늪이 끓어오른다 — 거품 위에 서지 마라',
      reason:'끓는 늪을 밟았다. 거품이 올라오는 자리를 피해라.',
      hazards:[{ dx:-200, dy:-110, r:130, period:4.4, warning:1.2, active:1.4, offset:0,   damage:0.07 },
               { dx: 210, dy: -80, r:130, period:4.4, warning:1.2, active:1.4, offset:1.5, damage:0.07 },
               { dx:   0, dy: 200, r:150, period:5.0, warning:1.3, active:1.5, offset:3.0, damage:0.08 }] } ];
  ARENAS.tutorial.stages.forEach(function(d,i){
    d.discipline={normal:0.22,skill:0.55,partMult:1.3,precisePartMult:1.6,breakBurst:2.5,exposed:1.75,evadeMult:2.2,evadeWindow:0.85};
    d.counterWindow=[0.18,0.16,0.14][i]; d.perfectWindow=0.04; d.firstCounterUlt=false;
    d.mastery=[['S','시간·카운터·파괴 종합'],['A','정확한 반격'],['B','생존 및 파괴'],['C','통과']];
    d.hp=[90000,200000,280000][i]; d.timeLimit=[90,150,180][i]; d.patternGap=[1.6,1.3,1.0][i];
    d.patterns.forEach(function(p){p.window=d.counterWindow;p.recovery=0.72;});
  });
  var training=ARENAS.tutorial.stages;
  training[0].name='눈뜬 허수아비';
  training[0].lesson='거리와 반격';
  training[0].line='마구 베면 오래 걸린다. 공격을 읽고 되돌려라.';
  training[0].hint='일반 공격은 견제 · 정확한 카운터와 회피 후 반격으로 빈틈을 노려라';
  training[0].patterns=[
    {icon:'hammer',name:'느린 내려찍기',tele:1.15,window:0.18,dmg:4200,posture:30,guardCost:24,recovery:0.8},
    {icon:'scythe',name:'회전 후려치기',tele:1.45,window:0.18,dmg:4600,posture:30,guardCost:28,recovery:0.85},
    {icon:'bolt',name:'찌르기',tele:0.85,window:0.18,dmg:3800,posture:30,guardCost:22,recovery:0.7}
  ];
  training[1].patterns[0].dmg=5500; training[1].patterns[0].every=2.2;
  training[1].patterns.push({icon:'bolt',name:'찌르기',tele:0.9,window:0.16,dmg:4800,posture:30,guardCost:26,recovery:0.7});
  training[1].parts.filter(function(p){return p.breakable;}).forEach(function(p){p.hp=32000;p.hpMax=p.hp;});
  training[2].patterns.forEach(function(p,i){p.dmg=[5600,6500,8000][i];});
  training[2].patterns[1].counterable=false; training[2].patterns[1].unblockable=true;
  training[2].patterns[1].desc='튕겨낼 수 없는 회전 공격. 위치 회피 후 반격';
  training[2].hint='백색선은 카운터 · 주황 X는 회피 · 파괴한 부위는 큰 빈틈';
  training[2].parts[1].hp=45000; training[2].parts[1].hpMax=45000;

  window.TW_DUNGEONS = { RULES:RULES, ARENAS:ARENAS, SKILLS:SKILLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.TW_DUNGEONS;
})();
