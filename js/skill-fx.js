/* 황혼 — 스킬 연출 사양
   «무엇을 언제 얼마나» 만 담는다. 그리는 일은 game3d.js 가 한다.
   여기 있으면 테스트가 숫자를 직접 읽을 수 있고, 온라인(party-avatar)도 같은
   사양을 쓸 수 있다.

   ── 벤치마킹 (docs/design/63-skill-vfx.md)
   · 마영전: 카메라가 가깝고 흔들림이 세다. 크리티컬은 «짧게 번쩍 + 특유의 소리».
     잔상(afterimage)이 캐릭터 실루엣으로 남는다. 물리로 흔들리는 사슬·천이
     타격의 2차 운동을 만든다.
   · 몬헌: 히트스톱이 정체성이다. 슬래시 액스 내려치기가 8프레임(30fps 기준
     0.27초). 이게 빠지면 «가벼워졌다» 는 말이 바로 나온다.
   · 실시간 VFX 관행: 슬래시 하나를 3~4겹으로 쌓는다. 같은 색 다른 채도의
     리본 여러 겹 + 큰 것에서 0 으로 줄어드는 아크 메시 + 연기/파편 + 충격.
     한 겹으로는 «기술» 로 안 읽힌다.

   ── 그래서 한 타에 네 박자를 준다
     예비(tell) → 타격(strike) → 여운(dissipate) 그리고 그 위에 카메라.
   각 스킬은 «면(plane)» 이 다르다. 베기는 비스듬히, 회전은 수평으로, 궁극기는
   내리꽂는다. 전부 같은 도넛을 띄우면 스킬이 구분되지 않는다. */
(function(root){
  'use strict';

  /* plane: 아크가 놓이는 면
       diag  비스듬한 베기 (오른위 → 왼아래)
       flat  수평 쓸기 (회전 베기)
       vert  내리꽂기
     arc   아크가 덮는 각도(라디안)
     r     아크 반지름(m)
     tell  예비 연출 세기 0~1 (0 이면 예비 없음)
     after 잔상 장수
     dust  바닥 먼지 고리 반지름(m), 0 이면 없음 */
  var LOOK = {
    skill1: { plane:'diag', arc:Math.PI*1.15, r:1.30, tilt:-0.55, tell:0.85, after:3, dust:1.5, embers:14 },
    skill2: { plane:'flat', arc:Math.PI*0.60, r:1.00, tilt:0,     tell:0.35, after:5, dust:0.9, embers:6  },
    skill3: { plane:'flat', arc:Math.PI*1.85, r:1.55, tilt:0.10,  tell:0.95, after:4, dust:2.3, embers:20 },
    skill4: { plane:'flat', arc:Math.PI*2.00, r:1.15, tilt:0,     tell:0.70, after:0, dust:1.2, embers:10 },
    ult:    { plane:'vert', arc:Math.PI*1.35, r:1.75, tilt:-0.18, tell:1.00, after:6, dust:3.0, embers:30 }
  };
  var DEFAULT = { plane:'diag', arc:Math.PI*1.05, r:1.15, tilt:-0.4, tell:0.5, after:2, dust:1.1, embers:8 };

  /* 등급이 오르면 연출이 커진다. 다만 «반지름» 과 «양» 을 다르게 키운다.
     반지름을 그냥 키웠더니(레벨당 17%) 3레벨 회전 베기가 2.48 m 가 됐다 —
     낫의 실제 사거리(손에서 날 끝까지 1.86 m)보다 크다. 무기보다 큰 궤적은
     «낫을 휘두른 자국» 이 아니라 그냥 떠 있는 고리로 보인다.
     그래서 반지름은 조금만(레벨당 8%, 최대 1.32배 → 회전 베기 2.05 m) 키우고,
     불티·먼지 같은 «양» 은 넉넉히(17%) 키운다. 등급은 크기가 아니라 밀도로 읽힌다. */
  function grow(lv){ return 1 + Math.max(0, Math.min(4, (lv||1)-1)) * 0.17; }   /* 양: 1.00 ~ 1.68 */
  function growR(lv){ return 1 + Math.max(0, Math.min(4, (lv||1)-1)) * 0.08; }  /* 반지름: 1.00 ~ 1.32 */

  /* clip 이름(또는 스킬 id)으로 생김새를 고른다 */
  function look(name, lv, branch){
    var base = LOOK[name] || DEFAULT, g = grow(lv), gr = growR(lv);
    return {
      plane: base.plane, tilt: base.tilt,
      arc:   base.arc,
      r:     base.r * gr,
      tell:  base.tell,
      after: base.after ? Math.round(base.after * (branch ? 1.2 : 1)) : 0,
      dust:  base.dust * g,
      embers: Math.round(base.embers * g)
    };
  }

  /* 예비는 «접점 직전» 에 붙어야 한다. 너무 일찍 띄우면 스킬을 쓴 줄도 모르는
     사이에 사라지고, 접점에 겹치면 타격이 예비에 묻힌다.
     접점의 0.42 지점에서 시작해 접점에서 끝난다. */
  var TELL_FROM = 0.42;
  function tellWindow(hitAt){
    var h = hitAt > 0 ? hitAt : 0.4;
    return { start: h * TELL_FROM, end: h, dur: h * (1 - TELL_FROM) };
  }

  /* 잔상은 «휘두르는 동안» 만 남는다. 접점 뒤로 조금 끌고 간다. */
  function afterWindow(hitAt, duration){
    var h = hitAt > 0 ? hitAt : 0.4;
    return { start: h * 0.55, end: Math.min(duration || h + 0.3, h + 0.20) };
  }

  var api = { LOOK:LOOK, DEFAULT:DEFAULT, look:look, grow:grow, growR:growR,
              tellWindow:tellWindow, afterWindow:afterWindow, TELL_FROM:TELL_FROM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TW_SKILL_FX = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
