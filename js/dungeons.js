/* 황혼 — 던전 데이터
   window.TW_DUNGEONS = { RULES, ARENAS, SKILLS }
   · RULES  : 모든 던전이 공유하는 전투 공통 규칙 (docs/design/01-training-arena.md §3)
   · ARENAS : 훈련장 등 아레나. 허수아비는 world.js BOSSES 와 같은 형식(weakpoints/patterns/mastery/hud) 위에 엔진 필드를 얹는다
   · 허수아비 원화: design-sheets/10-dummy.webp (사슬에 묶인 나무 구조체, 가슴에 붉은 핵). 3단계는 같은 개체의 잠듦→사슬→각성 상태
   · 수치 원본: 캐릭터 스탯은 world.js CHARS, 보상 아이템은 items.js. 그 외 상수는 기획서 v0.1 제안값 */
(function(){
  var RULES = {
    tick: 1/60,
    hitstop: { hit:0.08, counter:0.16, brk:0.24 },
    stamina: { max:120, regen:18, delay:0.6, dodge:25, guardPerSec:12 },
    dodge:   { iframes:0.30, cooldown:0.45 },
    guard:   { reduce:0.70, holdMs:220 },
    counter: { window:0.25, perfect:0.10, mult:2.5, perfectMult:3.0, posture:30, ult:18 },
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
      { key:'1', id:'slash',  icon:'scythe', name:'낫 베기',     mult:2.2, cd:6,  st:15, desc:'선택 부위에 강한 일격' },
      { key:'2', id:'step',   icon:'bolt',   name:'그림자 걸음', mult:0,   cd:8,  st:20, desc:'즉시 회피 + 다음 공격 치명타 확정', dodge:true, critNext:true },
      { key:'3', id:'spin',   icon:'flame',  name:'피의 회전',   mult:1.2, cd:12, st:25, desc:'모든 부위에 피해', aoe:true },
      { key:'4', id:'resolve',icon:'shield', name:'결의',        mult:0,   cd:15, st:0,  desc:'2초간 받는 피해 50% 감소', buff:{dur:2, reduce:0.5} }
    ],
    ainUlt: { key:'R', id:'twilight', icon:'scythe', name:'낫의 황혼', mult:6.0, bleed:3, desc:'궁극기. 강타 + 출혈 3중첩' }
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
      atk:{ hammer:{ clip:'atk_hammer', hitFrac:0.42 }, bolt:{ clip:'atk_bolt', hitFrac:0.45 }, scythe:{ clip:'atk_scythe', hitFrac:0.5 } },
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
      model:'art/3d/boss_marsh.glb', scale:0.85, pieces:'nodes', tint:{ marsh:0xffffff, rage:0xffb0a0 }, glow:{ marsh:0.8, rage:1.4 },
      parts3d:{ head:{ bone:'Head', off:[0,0.15,0.55], r:0.6 }, back:{ bone:'Spine1', off:[0,0.85,0], r:0.8 }, legf:{ bone:'FR_Low', off:[0,0.35,0.1], r:0.6 }, tail:{ bone:'Tail2', off:[0,0.25,0], r:0.6 }, body:{ bone:'Spine', off:[0,0.1,0], r:1.0 }, core:{ bone:'Spine2', off:[0,-0.55,0.45], r:0.4 } },
      atk:{ bolt:{ clip:'atk_bolt', hitFrac:0.5 }, flame:{ clip:'atk_flame', hitFrac:0.45 }, hammer:{ clip:'atk_hammer', hitFrac:0.5 }, scythe:{ clip:'atk_scythe', hitFrac:0.5 }, drop:{ clip:'atk_drop', hitFrac:0.35 } },
      rewards:{ gold:18000, items:[['m_alloy',24],['m_shard',1],['m_core',1],['c_potion',2]], sBonus:[['m_core',1],['m_dew',3]] },
      stages:[
        dummy({ id:'morbus', name:'모르버스', lesson:'토벌', timeLimit:600, hp:1100000, kind:'marsh',
          line:'머리를 노려라. 등·앞다리·꼬리를 부수면 놈이 무너진다.', hint:'돌진은 옆으로 구르고, 강타는 뒤로. 포효는 방어',
          parts:[ { id:'head', name:'머리', hp:null, weak:true, pos:'tl', effect:'피해 증가' },
                  { id:'back', name:'등 견갑', hp:160000, breakable:true, pos:'tr', effect:'자세 파괴', onBreak:{ posture:60 } },
                  { id:'legf', name:'앞다리', hp:140000, breakable:true, pos:'bl', effect:'이동 둔화', onBreak:{ slow:0.6 } },
                  { id:'tail', name:'꼬리', hp:120000, breakable:true, pos:'br', effect:'공격 범위 감소', onBreak:{ zoneScale:0.7 } },
                  { id:'body', name:'몸통', hp:null, pos:'br' } ],
          patterns:[ { icon:'bolt',   name:'돌진 베기',   rank:'S', tele:0.9, window:0.40, dmg:1500, posture:40, guardCost:25, range:'far',  desc:'전방으로 빠르게 돌진 후 연속 베기' },
                     { icon:'flame',  name:'광폭 포효',   rank:'A', tele:1.1, window:0.40, dmg:700,  posture:20, guardCost:35, range:'any',  desc:'넓은 범위의 충격파, 정신력 피해' },
                     { icon:'hammer', name:'대지 강타',   rank:'S', tele:1.2, window:0.40, dmg:1800, posture:60, guardCost:25, range:'near', desc:'전방 지면 강타 후 충격파' },
                     { icon:'scythe', name:'꼬리 휘두르기', rank:'A', tele:0.8, window:0.40, dmg:1100, posture:30, guardCost:30, range:'near', desc:'넓은 회전 공격, 뒤로도 판정' } ],
          patternGap:1.6, counterWindow:0.32,
          mastery:[ ['S','5분 이내 처치 · 모든 파괴 부위 파괴'], ['A','10분 이내 처치 · 파괴 부위 2개 이상'], ['B','15분 이내 처치 · 파괴 부위 1개 이상'], ['C','15분 초과'] ] }),
        dummy({ id:'rage', name:'피의 광란 모르버스', lesson:'광란', timeLimit:300, hp:480000, kind:'rage',
          line:'핵이 드러났다. 예고가 짧다. 붙어서 끝내라.', hint:'광란 연타는 옆으로 구르고, 돌진 직후가 빈틈',
          parts:[ { id:'core', name:'핵', hp:null, weak:true, pos:'tl', effect:'피해 증가' }, { id:'head', name:'머리', hp:null, weak:true, pos:'tr', effect:'피해 증가' }, { id:'body', name:'몸통', hp:null, pos:'br' } ],
          patterns:[ { icon:'drop',   name:'피의 광란',   rank:'S', tele:0.7, window:0.36, dmg:1300, posture:40, guardCost:30, range:'near', desc:'연속 발톱 공격' },
                     { icon:'bolt',   name:'돌진 베기',   rank:'S', tele:0.7, window:0.36, dmg:1600, posture:40, guardCost:25, range:'far',  desc:'더 빠른 돌진' },
                     { icon:'hammer', name:'대지 강타',   rank:'S', tele:0.95, window:0.36, dmg:2000, posture:60, guardCost:25, range:'near', desc:'강타' } ],
          patternGap:1.1, counterWindow:0.30,
          mastery:[ ['S','—'], ['A','—'], ['B','—'], ['C','—'] ] })
      ]
    }
  };

  window.TW_DUNGEONS = { RULES:RULES, ARENAS:ARENAS, SKILLS:SKILLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.TW_DUNGEONS;
})();
