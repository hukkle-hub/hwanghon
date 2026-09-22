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
  /* 기준 비틀기 진폭(rad). 몸통 셋에 나눠 담는다.
     0.30(17°)에서 0.52(30°)로 올렸다. 업계 기준은 두 손 무기 = 「몸통 회전이
     휘두름을 «구동» 한다」인데 17°는 그냥 어깨만 도는 정도였다.
     무게 배수까지 곱하면 스매시·궁극기는 43~45° 로 몸을 통째로 쓴다.

     ⚠ 위쪽 한계는 계측으로 잡았다. 0.54 까지는 리그가 버티고 0.58 에서
        tests/ain-two-hand 의 «손목 한계·연속성» 검사가 깨진다
        (두 손 그립 IK 의 팔꿈치 특이점 — docs/design/64 §3).
        여유를 두고 0.52. 이 위로 올리려면 solveGripCircle 을 먼저 고쳐야 한다. */
  var YAW = 0.52;
  var LEAN = 0.22;   /* 앞뒤 기울기 — 가슴이 앞으로 나가면 사거리가 늘고 무게가 실린다 */

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
  /* ── 무게 ─────────────────────────────────────────────────────────────
     디렉터: 「그 길고 무거운 걸 휘두르는데 무게감도 없고」.

     계측해 보니 원인이 하나로 모였다. **정점 속도가 너무 일찍 온다.**
     (tools/3d/swing-measure.html, 240 표본)

       클립      정점 위치(궤적의 %)     업계 권장 60~70%
       attack1        33%
       attack2        25%
       smash          48%
       ult            46%
       exec           19%

     전부 앞에서 최고속을 찍고 남은 궤적을 «흘러간다». 가벼운 막대기가 딱
     그렇게 움직인다. 무거운 것은 반대다 — 천천히 감다가 궤적 후반에
     최고속을 찍는다. 질량이 있으면 가속에 시간이 걸리기 때문이다.

     고치는 법은 «클립 표본 위치» 를 다시 깎는 것이다. 판정 시각은 그대로 두고
     (접점은 sampleAction 이 못 박는다), 그 앞뒤 «안에서» 만 시간을 재배분한다:
       감기 구간  u^p    — 처음엔 굼뜨게, 접점으로 갈수록 가속 (p>1)
       풀림 구간  1−(1−u)^q — 접점 직후가 제일 빠르고 뒤로 갈수록 감속 (q>1)
     이러면 최고속이 접점 근처로 밀린다. 접점은 궤적의 52~77% 지점이므로
     권장 구간에 들어온다.

     ⚠ 이건 «표본 위치» 만 바꾼다. 행동 시계도 판정 시각도 안 건드린다
        (65번 문서에서 행동 시계를 늦췄다가 던전을 못 깨게 만든 적이 있다).
     ⚠ p=q=1 이면 예전 그대로 — 선형이다. */
  var HEFT = {
    attack1:1.00, attack2:1.00, attack3:0.95,
    smash:1.45, exec:1.45,
    skill1:1.20, skill2:0.70, skill3:1.35, skill4:0.55, ult:1.50,
    counter:0.50
  };
  function heftOf(clip){ var h=HEFT[clip]; return h==null?1:h; }
  /* 그런데 «감기 구간을 통째로 굼뜨게» 만 하면 무거운 기술이 오히려 나빠진다.
     처음에 u^p 만 썼더니 궁극기의 정점이 46% → 19% 로 «더» 앞으로 갔다.
     이유는 클립 자체에 있었다. 계측:

       클립     접점 前 각폭   접점 後 각폭
       smash        373°           108°
       ult          279°           172°
       skill3       303°           139°

     감기에서 자루가 세 바퀴 가까이 «휘돈다». 원본 모캡(KayKit 2H)이 크게
     돌려 감는 동작이라 그렇다. 그 구간을 균일하게 늦추면 휘도는 게 더 오래
     보일 뿐이다 — 이게 「촐싹댄다」의 정체다.

     무거운 것의 실제 박자는 셋이다: **들고 → 멈추고 → 내려친다.**
     몬헌 대검의 모아베기, 마영전의 큰 기술, 무협의 큰 초식이 전부 그렇다.
     그래서 감기 구간을 세 마디로 나눈다.
       들기  휘도는 구간을 «빨리» 지나 정점 자세까지 간다
       멈춤  정점에서 머문다 — 무게가 실리는 곳이자 상대가 읽는 곳
       치기  남은 구간을 가속해서 접점으로 꽂는다
     멈춤 길이는 무게에 비례한다. 평타는 0, 스매시·궁극기는 감기 시간의 4분의 1.
     경계는 스무스스텝이라 속도가 끊기지 않는다 — 완전 정지가 아니라 «느려짐» 이다. */
  function coilPow(h){ return Math.min(2.2, 1 + 0.55*(h==null?1:h)); }
  function throwPow(h){ return Math.min(2.2, 1 + 0.40*(h==null?1:h)); }
  function coilEase(u, clip){ var x=Math.max(0,Math.min(1,u)); return Math.pow(x, coilPow(heftOf(clip))); }
  function throwEase(u, clip){ var x=Math.max(0,Math.min(1,u)); return 1-Math.pow(1-x, throwPow(heftOf(clip))); }

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

  var api = { WEIGHT:WEIGHT, YAW:YAW, LEAN:LEAN, SHARE:SHARE, HEFT:HEFT,
              shape:shape, weightOf:weightOf, comboGain:comboGain,
              heftOf:heftOf, coilPow:coilPow, throwPow:throwPow,
              coilEase:coilEase, throwEase:throwEase };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TW_SWING_BODY = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
