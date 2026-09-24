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
  /* ⚠ 위 표는 «매끄러움만» 보고 고른 72번 값이다. 디렉터가 «맞는 순간 속도는
     줄어드는게 맞다» 고 해서, 이제는 «실제로 잰 접점 감속»(접점 뒤 50 ms 평균
     각속도 ÷ 앞 50 ms)을 목표에 맞추도록 다시 쓸었다 (biteSweep 0.3~2.1).
     목표는 js/ain-two-hand.js 의 BITE (근거 없음, 같이 조정할 값).

       클립      k     잰 감속   목표   rJerkX(접점 제외 거칠기)
       attack1  1.05   0.69    0.68   1.07
       attack2  1.00   0.11    0.68   0.59   ← 땅에 박힌다(바닥 가드). 어떤 k 로도 0.10~0.14
       attack3  1.95   0.70    0.70   0.87
       smash    2.10   0.58    0.55   0.73
       counter  0.45   0.56    0.80   1.01   ← 어떤 k 로도 0.57 이하. 튕겨 내는 기술이라 둔다
       skill1   0.90   0.57    0.62   0.29
       skill2   1.50   0.74    0.74   0.81
       skill3   1.50   0.62    0.60   0.22
       skill4   —      0.75    0.78   0.18   (무기 경로가 정한다 — k 무관)
       ult      1.95   0.56    0.52   0.54
       exec     0.30   0.30    0.55   1.22   ← 처형은 내리꽂아 멈춘다. k 무관 0.29~0.32 */
  var SEAM_BIAS = { attack1:1.05, attack3:1.95, smash:2.10, counter:0.45,
                    skill1:0.90, skill2:1.50, skill3:1.50, ult:1.95, exec:0.30 };
  /* ── 접점 감속 (bite) ──
     디렉터: 「맞는 순간 속도는 줄어드는게 맞아」.
     위 SEAM_BIAS 는 «클립 자체의 속도 변화를 상쇄해 매끄럽게 잇는» 중립점이다.
     그 위에 일부러 감속을 얹는다: 접점 직전 기울기는 그대로 두고, 직후만
     BITE 배로 떨어뜨린다. 무게를 따른다 — 무거울수록 깊이 박히고 크게 잃는다.
       bite(h) = 1 / (1 + 0.5·h)     smash 0.58 · 평타 0.67 · counter 0.80
     값은 근거 없음 — 디렉터와 같이 조정할 값이다.
     무기 경로의 감속(js/ain-two-hand.js BITE)과 같은 쪽으로 움직여야
     몸과 날이 따로 놀지 않는다. */
  function biteOf(h){ return 1/(1+0.5*(h==null?1:h)); }
  function seam(h, hit, clip){
    if(hit==null||hit<=0.02||hit>=0.98) return [0,0];
    var pc=coilPow(h), pt=throwPow(h);
    var k=Math.sqrt(SEAM_BIAS[clip]||1);                      /* 중립 s⁻ : s⁺ = k² */
    var sm=(hit*pc/0.42 + (1-hit)*pt/0.58)/2;                 /* 맞출 기울기 */
    var a=pc-sm*k*0.42/hit, b=pt-(sm/k)*biteOf(h)*0.58/(1-hit);
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

  /* ── 세 박자 템포: 들고 → 머물고 → 내려친다 ─────────────────────────────
     디렉터: 「스매쉬의 속도도 처음과 중간 마지막이 달라야하고」.
     몬헌 대검의 모아베기, 마영전의 강타가 다 이 세 박자다:
         들기     [0 , lift]   정점까지 올린다 — 보통 속도, 끝에서 느려진다
         머묾     [lift, hold]  정점에서 거의 멈춘다 — 무게가 실리고 상대가 읽는 곳
         내려치기  [hold, .42]  남은 호를 가속하며 쏟아붓는다 — 제일 빠르다
         접점      .42         물리며 속도를 잃는다 (bite)
         여운·회수 [.42, 1]    감속하며 제자리로
     ⚠ 처음엔 무기 경로에만 걸었다. 그랬더니 몸(클립 재생·몸통 비틀기)이 머묾
        구간에도 계속 돌아서 날끝 각속도로는 머묾(167°/s)이 들기(195°/s)와
        구분이 안 됐다. 몸·몸통·무기가 «같은 곡선» 을 써야 박자가 보인다.
        그래서 곡선을 여기 한 곳에 둔다.

     tempoCurve(u, spec, pre, post) → [0, pre+post]
       pre  = 접점까지 가야 할 양 (무기: 접점 키의 각도 비율, 몸: 접점의 클립 시각)
       post = 접점 뒤 남은 양
     접점(.42)에서 값이 정확히 pre — 판정·접점 자세 불변.
     구간 경계는 기울기를 공유하는 3차 에르미트, 각 끝 기울기는 할선의 3배를
     넘지 않게 묶어 단조를 지킨다(Fritsch–Carlson). 접점만 일부러 끊는다:
     직후 기울기 = 직전 기울기 × bite (절대 속도 기준).

     값은 근거 없음 — 관절 한 표본 이동량 8° 게이트 안에서 고른 것이다
     (tests/ain-two-hand; strike 2.7 이면 14.9° 로 깨졌다). */
  var TEMPO = { smash:{ lift:.20, hold:.28, top:.40, creep:.05, strike:1.2, bite:.55, bodyBite:.30, dwell:.06 } };
  function herm(p, y0, y1, m0, m1, h){ var p2=p*p, p3=p2*p;
    return (2*p3-3*p2+1)*y0+(p3-2*p2+p)*m0*h+(-2*p3+3*p2)*y1+(p3-p2)*m1*h; }
  function tempoCurve(u, s, pre, post){
    var x=Math.max(0,Math.min(1,u));
    var X=[0,s.lift,s.hold,.42], P=[0,s.top,s.top+s.creep*(1-s.top),1], d=[];
    for(var i=0;i<3;i++) d.push((P[i+1]-P[i])/(X[i+1]-X[i]));
    var mh=Math.min(d[1],3*d[0],3*d[2]);                 /* 머묾 기울기를 양쪽이 나눠 쓴다 */
    var m=[0, mh, mh, Math.min(s.strike,2.95)*d[2]];
    if(x<=.42){ var k=0; while(k<2&&x>X[k+1]) k++;
      var h=X[k+1]-X[k];
      return pre*herm((x-X[k])/h, P[k], P[k+1], m[k], m[k+1], h); }
    /* 접점 뒤: 물린 속도(bite)로 dwell 동안 «버티고», 그다음 회수.
       ⚠ dwell 없이 바로 회수 곡선을 이으면, 접점 뒤에 남은 양(스매시 몸 클립은
          70%)을 채우려고 곡선이 곧장 다시 가속해서 감속이 50 ms 도 안 보였다
          (잰 감속 0.93). 물린 채 잠깐 버텨야 «박혔다» 로 읽힌다. */
    var mp=post>1e-9?s.bite*m[3]*pre/post:0, dw=s.dwell||0;
    if(dw>0){
      var g=Math.min(.5, mp*dw*.9), m2=Math.min(mp*.8, 3*(1-g)/(.58-dw));
      if(x<=.42+dw) return pre+post*herm((x-.42)/dw, 0, g, Math.min(mp,3*g/dw), m2, dw);
      return pre+post*herm((x-.42-dw)/(.58-dw), g, 1, m2, 0, .58-dw);
    }
    return pre+post*herm((x-.42)/.58, 0, 1, Math.min(mp,2.95/.58), 0, .58);
  }
  /* 몸통 비틀기(shape)는 .28 에서 다 감기고 .42 에서 풀린다. 템포가 있는 기술은
     그 «다 감긴» 순간이 머묾 구간 안에 머물도록 위상을 비튼다 — 몸도 정점에서 멈춘다. */
  function tempoPhase(k, clip){
    var s=TEMPO[clip]; if(!s||k>=.42) return k;
    var X=[0,s.lift,s.hold,.42], Y=[0,.26,.29,.42], d=[];
    for(var i=0;i<3;i++) d.push((Y[i+1]-Y[i])/(X[i+1]-X[i]));
    var mh=Math.min(d[1],3*d[0],3*d[2]), m=[d[0], mh, mh, d[2]];
    var j=0; while(j<2&&k>X[j+1]) j++;
    var h=X[j+1]-X[j];
    return herm((k-X[j])/h, Y[j], Y[j+1], m[j], m[j+1], h);
  }
  var api = { WEIGHT:WEIGHT, YAW:YAW, LEAN:LEAN, SHARE:SHARE, HEFT:HEFT,
              shape:shape, weightOf:weightOf, comboGain:comboGain,
              chainSide:chainSide, sideOf:sideOf,
              heftOf:heftOf, coilPow:coilPow, throwPow:throwPow,
              coilEase:coilEase, throwEase:throwEase, seam:seam, SEAM_BIAS:SEAM_BIAS, biteOf:biteOf,
              TEMPO:TEMPO, tempoCurve:tempoCurve, tempoPhase:tempoPhase };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TW_SWING_BODY = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
