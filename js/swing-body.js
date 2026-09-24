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

  /* ── 접점 이음매 ──────────────────────────────────────────────────────
     감기(coilEase)와 내치기(throwEase)는 접점에서 «값» 은 이어지지만
     «속도» 는 안 이어진다. 클립 시간으로 풀어 쓰면

        접점 직전 기울기  hit·pc / .42
        접점 직후 기울기  (1−hit)·pt / .58

     이 둘이 다르면 **맞는 순간 몸 애니메이션의 재생 속도가 툭 바뀐다.**
     스매시는 1.28 → 1.91 (+49%), 3타는 1.81 → 1.19 (−34%) 였다.

     실측 (각속도 곡선 거칠기 rJerk, 전문가 클립 Heavy_Hammer_Swing = 1.50):
     이 둘이 우리 클립 중 제일 거칠었다 — 스매시 4.06, 3타 4.88.
     최악 위상도 각각 0.411 / 0.356 으로 접점 언저리였다.

     고치는 법: 값을 1 로 유지한 채 «끝 기울기만» 바꿀 수 있는 보정항을 건다.
        감기   x^pc · (1 + a(1−x))      → 값 h(1)=1 그대로, h'(1) = pc − a
        내치기 1 − (1−x)^pt · (1 + b·x) → 값 h(0)=0 그대로, h'(0) = pt − b
     a·b 를 양쪽 기울기가 «같아지도록» 잡는다. 접점의 값(clipHit)은 한 톨도
     안 움직이므로 판정은 그대로다 — 「연출이 판정을 옮기지 않는다」.
     hit 를 안 넘기면(옛 호출) 보정 없이 예전과 같이 동작한다. */
  /* 그런데 «딱 1:1 로 맞추는 게» 언제나 최선은 아니다. 클립 자체가 접점에서
     속도를 바꾸는 경우가 있어서, 그때는 이음매를 살짝 기울여 그걸 상쇄해야
     최종 곡선이 매끄러워진다. 그래서 비율을 클립별로 둔다 — 기본은 1(맞춤).
     값은 짐작이 아니라 tools/3d/swing-measure.html seamSweep() 으로 «재서» 넣는다. */
  /* 실측값 — 매끄러움(rJerk)만 보고 고르면 안 된다. k<1 은 «접점으로 들어가는
     속도를 깎아서» 매끄러워지는데, 그건 디렉터가 요구한 무게를 버리는 짓이다.
     그래서 rJerk 와 «접점 날끝 속도» 를 같이 쓸어 보고 골랐다
     (seamSweep 0.4~1.65. 전문가 클립 Heavy_Hammer_Swing 의 rJerk = 1.50):

       클립      k     rJerk          접점속도(m/s)
       attack1  1.00   1.47 ← 1.47    53.9  (k=1 이 최솟값이자 최고속)
       attack2  1.00   1.23 ← 1.23    23.8  (k=0.4 면 0.81 이지만 속도 18.1 로 −24%)
       attack3  1.20   3.26 ← 4.37    36.4
       smash    0.60   0.71 ← 1.75    31.8  (−5% 속도로 매끄러움 2.5배)
       counter  0.80   1.33 ← 2.41    27.1
       skill1   1.40   0.92 ← 2.51    11.9
       skill2   0.80   0.95 ← 1.27    17.2
       skill3   1.00   1.08 ← 1.08    17.8
       ult      1.60   0.57 ← 0.71     7.5
       exec     0.40   1.73 ← 1.95    12.9

     k<1 은 «천천히 감았다가 빠르게 내친다», k>1 은 그 반대로 클립 자체가
     접점 뒤에서 느려지는 것을 상쇄한다. 적지 않은 클립은 k=1(정확히 맞춤)이다. */
  var SEAM_BIAS = { attack3:1.20, smash:0.60, counter:0.80,
                    skill1:1.40, skill2:0.80, ult:1.60, exec:0.40 };
  function seam(h, hit, clip){
    if(hit==null||hit<=0.02||hit>=0.98) return [0,0];
    var pc=coilPow(h), pt=throwPow(h);
    var k=Math.sqrt(SEAM_BIAS[clip]||1);                      /* s⁻ : s⁺ = k² */
    var sm=(hit*pc/0.42 + (1-hit)*pt/0.58)/2;                 /* 맞출 기울기 */
    var a=pc-sm*k*0.42/hit, b=pt-(sm/k)*0.58/(1-hit);
    /* 단조성 보호: 보정이 세면 곡선이 되돌아간다. 양쪽 다 묶어 둔다. */
    a=Math.max(-0.8, Math.min(pc-0.35, a));
    b=Math.max(-0.8, Math.min(pt-0.35, b));
    return [a,b];
  }
  function coilEase(u, clip, hit){ var x=Math.max(0,Math.min(1,u)), h=heftOf(clip);
    var a=seam(h,hit,clip)[0];
    return Math.pow(x, coilPow(h))*(1+a*(1-x)); }
  function throwEase(u, clip, hit){ var x=Math.max(0,Math.min(1,u)), h=heftOf(clip);
    var b=seam(h,hit,clip)[1];
    return 1-Math.pow(1-x, throwPow(h))*(1+b*x); }

  /* ── 연계는 «방향» 이 바뀌어야 한다
     디렉터: 「기본공격도 연계가 전혀 없고」.
     조사: 전투용 낫은 창·봉 계열이고 기본기가 봉술이다. 「쓸어치는 호를
     찌르기로 굴리고, 날의 양면을 다 쓰고, 손을 바꿔 가며 여덟 방향으로
     계속 회전 상태를 유지한다」 (docs/design/66 §1).
     핵심은 크기가 아니라 **방향이 번갈아 바뀐다**는 것이다. 세 타가 다 같은
     쪽으로 나가면 아무리 커도 «이어진다» 로 안 읽힌다.

     몸통 비틀기의 부호를 타수마다 뒤집는다. 1타 오른쪽에서 왼쪽, 2타는
     그 끝에서 «되돌아» 오른쪽으로, 3타는 다시 왼쪽. 되돌아오는 타는 이미
     감겨 있으므로 예비가 필요 없다 — 그래서 연계가 빨라 보이기도 한다.
     자루 방향(ain-two-hand 의 slash/chop/thrust)이 이미 셋 다 다르므로
     여기서는 «몸이 어느 쪽으로 도는가» 만 맡는다. */
  function chainSide(n){ return (n|0) % 2 === 1 ? -1 : 1; }

  /* 연계가 이어질수록 몸을 더 쓴다. 1타 1.00 · 2타 1.12 · 3타 1.24.
     「기본공격도 연계가 전혀 없고」 — 세 타가 같은 크기로 나가면 이어지는 느낌이
     안 난다. 뒤로 갈수록 커져야 «쌓인다» 로 읽힌다 (마영전 평타 연계). */
  function comboGain(n){ return 1 + 0.12 * Math.max(0, Math.min(2, (n||0))); }
  function weightOf(clip, combo){
    var w = WEIGHT[clip]; w = (w == null ? 1 : w);
    return /^attack[123]$/.test(clip) ? w * comboGain(combo) : w;
  }
  /* 평타 연계만 방향을 뒤집는다. 스매시·스킬·궁극기는 «한 방» 이라 방향이
     고정이어야 읽힌다 — 매번 반대로 돌면 어느 쪽이 본체인지 흐려진다. */
  function sideOf(clip, combo){
    return /^attack[123]$/.test(clip) ? chainSide(combo) : 1;
  }
  /* 몸통 세 마디에 나누는 비율. 골반이 먼저 돌고 가슴이 따라간다 */
  var SHARE = { Hips:0.40, Spine:0.34, Spine2:0.26 };

  var api = { WEIGHT:WEIGHT, YAW:YAW, LEAN:LEAN, SHARE:SHARE, HEFT:HEFT,
              shape:shape, weightOf:weightOf, comboGain:comboGain,
              chainSide:chainSide, sideOf:sideOf,
              heftOf:heftOf, coilPow:coilPow, throwPow:throwPow,
              coilEase:coilEase, throwEase:throwEase, seam:seam, SEAM_BIAS:SEAM_BIAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TW_SWING_BODY = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
