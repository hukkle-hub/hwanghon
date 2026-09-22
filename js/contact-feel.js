/* 황혼 — 날이 «몸에 들어갈 때» 일어나는 일
   디렉터: 「보스의 몸에 무기가 닿았을 때의 저항감」

   그동안 우리가 가진 건 히트스톱(완전 정지) 하나였다. 정지는 «맞았다» 는
   신호일 뿐, «살을 가르며 지나간다» 가 아니다. 둘은 다른 것이다.

   ── 조사에서 가져온 수치 (docs/design/65-contact-feel.md)
   · 히트스톱: 1~4프레임. 1~2프레임만으로도 체감이 확 달라진다
   · **접점 감속: 2~4프레임 동안 애니메이션 «속도» 를 낮춘다** — 멈추는 게
     아니라 느려진다. 이게 «히트 컨펌» 이자 저항감의 정체다. 우리에게 없던 것.
   · 몬헌: 단단한 부위에 튕기면 피해 30% 감소 + 예리도 2배 소모 +
     **사냥꾼이 경직 모션에 묶인다**. 저항이 «플레이어 몸» 으로 돌아온다
   · 肉質(부위 경도)가 0~100 으로 나뉘고, 무른 곳과 단단한 곳의 반응이 다르다

   ── 그래서 세 가지를 재질별로 나눈다
     stop   히트스톱 (완전 정지, 초)
     drag   그 뒤로 이어지는 «느려짐» — {t: 지속, rate: 시간 배율}
     depth  날이 파고들었다가 멈추는 깊이(m). 단단할수록 얕다 */
(function(root){
  'use strict';

  /* 재질별 저항. straw=짚·살, metal=금속 판·사슬, core=붉은 핵 */
  var MAT = {
    straw: { drag:0.070, rate:0.42, depth:0.16, ring:0.00 },   /* 잘 들어간다 — 깊고 짧게 끈다 */
    core:  { drag:0.095, rate:0.34, depth:0.11, ring:0.35 },   /* 핵은 질기다 */
    metal: { drag:0.130, rate:0.22, depth:0.04, ring:1.00 }    /* 거의 안 들어간다 — 길게 끌리고 쇳소리 */
  };
  /* 기술이 무거울수록 더 밀고 들어간다 */
  var PUSH = { attack1:1.0, attack2:1.0, attack3:1.0,
               smash:1.45, exec:1.6, counter:1.15,
               skill1:1.25, skill3:1.3, ult:1.7 };

  function pushOf(clip){ var p = PUSH[clip]; return p == null ? 1 : p; }

  /* 접점에서 무엇이 일어나는가. stop 은 기존 히트스톱 값을 그대로 받는다 —
     연출이 판정 시각을 옮기지 않는다는 규칙은 그대로다. */
  function onContact(material, clip, stop){
    var m = MAT[material] || MAT.straw, push = pushOf(clip);
    return {
      stop: stop || 0,
      /* 무거운 기술일수록 오래 끌린다. 다만 0.20초를 넘기면 «랙» 으로 느껴진다 */
      dragT: Math.min(0.20, m.drag * push),
      /* 무거울수록 더 느려진다(더 작은 배율). 0.15 밑으로는 사실상 정지라 막는다 */
      dragRate: Math.max(0.15, m.rate / Math.min(1.6, push)),
      /* 파고드는 깊이. 무거운 기술은 더 깊이 */
      depth: m.depth * Math.min(1.5, push),
      ring: m.ring
    };
  }

  /* ── 튕김(弾かれ)
     몬헌: 단단한 부위를 «가벼운» 공격으로 치면 무기가 튕긴다. 피해 30% 감소 +
     예리도 2배 소모 + **사냥꾼이 경직 모션에 묶인다.** 이게 「아무데나 치면 안
     된다」를 가르치는 장치다. 마영전의 경직/넉백도 같은 역할을 한다.

     우리 판: 부서지지 않은 «금속» 부위를 약공격(attack1~3)으로 치면 튕긴다.
     · 피해 ×0.70
     · 부위 피해 0 — 약공격으로는 장갑이 «영영» 안 벗겨진다
     · 짧은 경직 0.22초 + 콤보 끊김
     · 쇳소리·불꽃이 세진다 (ring 2배)

     **무거운 것은 절대 안 튕긴다.** 스매시·스킬·궁극기·카운터·처형은 그대로
     들어간다. 튕김이 벌이 아니라 «답이 따로 있다» 는 신호가 되려면, 그 답이
     항상 통해야 한다. 부위가 한 번 부서지면 그 뒤로는 안 튕긴다. */
  var LIGHT   = { attack1:1, attack2:1, attack3:1 };
  var DEFLECT = { dmg:0.70, lock:0.22, ring:2.0 };

  function deflects(material, clip, broken){
    return material === 'metal' && !broken && !!LIGHT[clip];
  }

  /* 감속 창 안에서 시간이 얼마나 느리게 흐르는가. 끝으로 갈수록 원래 속도로
     돌아온다 — 딱 끊으면 «툭» 하고 다시 빨라져 더 어색하다. */
  function dragScale(left, total, rate){
    if(!(left > 0) || !(total > 0)) return 1;
    var u = 1 - left / total;              /* 0 → 1 로 진행 */
    return rate + (1 - rate) * (u * u);    /* 끝에서 부드럽게 1 로 */
  }

  var api = { MAT:MAT, PUSH:PUSH, LIGHT:LIGHT, DEFLECT:DEFLECT,
              pushOf:pushOf, onContact:onContact, deflects:deflects, dragScale:dragScale };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TW_CONTACT_FEEL = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
