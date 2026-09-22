/* 황혼 — 휘두름의 «몸» 
   큰 동작은 팔이 아니라 몸통에서 나온다.

   왜 몸통인가. 낫은 두 손으로 잡고 있어서 팔만으로는 크게 못 휘두른다 —
   손은 팔 길이에 갇혀 어깨에서 ±0.45 m 밖에 못 가고, 자루 방향을 억지로 크게
   돌리면 두 손의 앞뒤/위아래 순서가 뒤집히며 팔꿈치 해가 튄다
   (실측: 한 프레임에 166°. docs/design/64-swing-size.md).

   몸통을 돌리면 그 문제가 없다. 어깨가 통째로 돌므로 **팔과 무기의 상대 자세는
   그대로**이고, 날 끝만 몸통 회전 × 팔 길이만큼 더 지나간다. 실제 검술도 그렇다.

   박자는 «감았다 → 친다 → 멈춘다» 세 마디다:
     coil    접점 전까지 반대로 감는다        (−A)
     release 접점에서 반대편까지 휘두른다      (+0.9A)
     settle  끝에서 0 으로 돌아온다
   접점 시각은 전투가 정한 것(phase 0.42)을 그대로 쓴다 — 연출이 판정을 옮기지 않는다. */
(function(root){
  'use strict';
  /* 기술마다 몸을 얼마나 쓰는가. 1.0 = 기준(평타) */
  var WEIGHT = {
    attack1:1.00, attack2:1.15, attack3:0.95,
    smash:1.45, exec:1.45,
    skill1:1.30, skill2:0.70, skill3:1.40, skill4:0.55, ult:1.50,
    counter:0.55, hit:0, hit2:0, guard:0, guardHit:0
  };
  var YAW = 0.30;    /* 기준 비틀기 진폭(rad). 몸통 셋에 나눠 담는다 */
  var LEAN = 0.16;   /* 앞뒤 기울기 */

  function smoother(e0,e1,x){
    var t = Math.max(0, Math.min(1, (x-e0)/(e1-e0 || 1e-6)));
    return t*t*t*(t*(t*6-15)+10);
  }
  /* k = 전투가 준 진행도(접점이 0.42). 반환은 «몸통 전체» 기준 각도.

     ⚠ 접점(k=0.42)에서 요우는 반드시 0 이다.
     처음에는 접점에 감기의 «최대»(−25°)를 놓았는데, 그러면 때리는 순간 몸이
     비틀린 채라 낫이 목표를 0.44 m 빗나가고 날이 앞을 안 본다
     (tests/ain-contact-target · ain-skill-motions 가 바로 잡았다).
     실제 검술도 «치는 순간 몸은 정면» 이다 — 감기는 그 전에 끝나고, 풀림은
     그 뒤에 온다. 그게 채찍처럼 보이는 이유이기도 하다.
       0 → .28 감는다(−A) → .42 정면(0) → .72 끝까지 풀린다(+A) → 1 제자리 */
  function shape(k, weight){
    var w = weight == null ? 1 : weight;
    if(!(w > 0)) return {yaw:0, lean:0, coil:0, release:0};
    var coil = smoother(0, .28, k) - smoother(.28, .42, k),   /* .28 에서 1, .42 에서 0 */
        release = smoother(.42, .72, k),
        settle = smoother(.80, 1, k),
        live = 1 - settle;
    return {
      yaw:  YAW  * w * (-coil + release) * live,
      /* 기울기는 접점에서 살짝 앞으로 — 가슴이 앞으로 나가면 사거리가 늘어난다 */
      lean: LEAN * w * (-0.35*coil + 1.1*release) * live,
      coil:coil, release:release
    };
  }
  /* 연계가 이어질수록 몸을 더 쓴다. 1타 1.00 · 2타 1.12 · 3타 1.24.
     「기본공격도 연계가 전혀 없고」 — 세 타가 같은 크기로 나가면 이어지는 느낌이
     안 난다. 뒤로 갈수록 커져야 «쌓인다» 로 읽힌다 (마영전 평타 연계). */
  function comboGain(n){ return 1 + 0.12 * Math.max(0, Math.min(2, (n||0))); }
  function weightOf(clip, combo){
    var w = WEIGHT[clip]; w = (w == null ? 1 : w);
    return /^attack[123]$/.test(clip) ? w * comboGain(combo) : w;
  }
  /* 몸통 세 마디에 나누는 비율. 골반이 먼저 돌고 가슴이 따라간다 */
  var SHARE = { Hips:0.40, Spine:0.34, Spine2:0.26 };

  var api = { WEIGHT:WEIGHT, YAW:YAW, LEAN:LEAN, SHARE:SHARE, shape:shape, weightOf:weightOf, comboGain:comboGain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TW_SWING_BODY = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
