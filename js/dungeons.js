/* 황혼 — 던전 데이터
   window.TW_DUNGEONS = { RULES, ARENAS, SKILLS }
   · RULES  : 모든 던전이 공유하는 전투 공통 규칙 (docs/design/01-training-arena.md §3)
   · ARENAS : 훈련장 등 아레나. 허수아비는 world.js BOSSES 와 같은 형식(weakpoints/patterns/mastery/hud) 위에 엔진 필드를 얹는다
   · 수치 원본: 캐릭터 스탯은 world.js CHARS, 보상 아이템은 items.js. 그 외 상수는 기획서 v0.1 제안값 */
(function(){
  var RULES = {
    tick: 1/60,
    hitstop: { hit:0.08, counter:0.16, brk:0.24 },
    stamina: { max:120, regen:18, delay:0.6, dodge:25, guardPerSec:12 },
    dodge:   { iframes:0.30, cooldown:0.45 },
    guard:   { reduce:0.70, holdMs:220 },
    counter: { window:0.25, perfect:0.10, mult:2.5, perfectMult:3.0, posture:30, ult:18 },
    combo:   { gap:0.45, mults:[1.0,1.0,1.4] },
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
      id:'tutorial', name:'뒷마당 훈련장', place:'마태오의 인력사무소 뒷마당', char:'ain', unlock:'q_marsh',
      art:'lobby-city',
      rewards:{ gold:1500, items:[['m_fiber',20],['m_ore',10],['c_potion',3],['c_antidote',2]], sBonus:[['m_oil',2]] },
      stages:[
        dummy({ id:'straw', name:'짚 허수아비', lesson:'기본', timeLimit:30, hp:120000, kind:'straw',
          line:'머리를 노려라. 낫은 거기서 제일 잘 든다.', hint:'우측을 탭해 공격 · 허수아비의 부위를 탭해 조준',
          parts:[ { id:'head', name:'머리', hp:null, weak:true, pos:'tl', effect:'피해 증가' }, { id:'body', name:'몸통', hp:null, pos:'br' } ],
          patterns:[],
          mastery:[ ['S','15초 이내'], ['A','22초 이내'], ['B','30초 이내'], ['C','30초 초과'] ] }),
        dummy({ id:'iron', name:'철갑 허수아비', lesson:'부위 파괴', timeLimit:45, hp:260000, kind:'iron',
          line:'갑주부터. 겉을 벗기면 안이 보인다.', hint:'좌측을 쓸어 회피 · 견갑 두 개를 부수면 격추',
          parts:[ { id:'shl', name:'좌 견갑', hp:45000, breakable:true, pos:'tl', effect:'몸통 보호 해제' },
                  { id:'shr', name:'우 견갑', hp:45000, breakable:true, pos:'tr', effect:'몸통 보호 해제' },
                  { id:'body', name:'몸통', hp:null, pos:'br', guardedBy:['shl','shr'], guardReduce:0.5 } ],
          allBrokenDown:true,
          patterns:[ { icon:'hammer', name:'느린 휘두르기', rank:'B', tele:1.0, window:0.40, dmg:400, posture:30, guardCost:15, every:6, desc:'예고가 길다. 회피를 익힌다' } ],
          mastery:[ ['S','25초 이내 · 견갑 2개 파괴'], ['A','34초 이내 · 견갑 1개 이상'], ['B','45초 이내'], ['C','45초 초과'] ] }),
        dummy({ id:'clock', name:'태엽 허수아비', lesson:'카운터', timeLimit:60, hp:380000, kind:'clock',
          line:'예고를 보고 치지 마라. 예고가 끝나는 순간에 쳐라.', hint:'붉은 고리가 닫히는 순간 탭 = 카운터',
          parts:[ { id:'head', name:'머리', hp:null, weak:true, pos:'tl', effect:'피해 증가' },
                  { id:'gear', name:'태엽 등판', hp:60000, breakable:true, pos:'tr', effect:'예고 +0.2초', onBreak:{ telePlus:0.2 } },
                  { id:'body', name:'몸통', hp:null, pos:'br' } ],
          firstCounterUlt:true, counterWindow:0.40,
          patterns:[ { icon:'bolt',   name:'찌르기',     rank:'A', tele:0.6, window:0.40, dmg:600,  posture:30, guardCost:15, desc:'짧은 예고' },
                     { icon:'scythe', name:'회전 베기',  rank:'A', tele:0.9, window:0.40, dmg:900,  posture:30, guardCost:30, desc:'방어 시 스태미나 30' },
                     { icon:'hammer', name:'내려찍기',   rank:'S', tele:1.2, window:0.40, dmg:1400, posture:60, guardCost:20, desc:'카운터 성공 시 즉시 격추' } ],
          patternGap:1.4,
          mastery:[ ['S','30초 이내 · 등판 파괴 · 카운터 70%'], ['A','45초 이내 · 카운터 50%'], ['B','60초 이내'], ['C','60초 초과'] ] })
      ]
    }
  };

  window.TW_DUNGEONS = { RULES:RULES, ARENAS:ARENAS, SKILLS:SKILLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.TW_DUNGEONS;
})();
