/* 기술표형 필드 보스 (문서 222) — 클레이브(field-boss-combat.cjs)의 서버 권위 AI 를 «보스별 기술표 한 장» 으로.
   디렉터: «지금 있는 보스 하나 먼저 하고 그걸 토대로 나머지도». 섀도우 팽부터 — 문서 181 §3 «그림자 난무 하나를 먼저».
   상태는 o.kit 에 둔다(클레이브 o.combat · 지배형 o.dom 과 섞이지 않게). 보스 체력·단계는 여기서도 내보내지 않는다.
   혼자 연습(world3d)은 이 파일을 그대로 불러 쓴다 — 서버와 같은 박자 · 같은 판정 · 같은 예고. */
const seq = (from, n, gap) => Array.from({ length: n }, (_, i) => from + i * gap);

/* 시간표는 2D 모션 스터디(tools/vfx/shadowfang-motion-study.html)·3D 애니매틱(문서 181 §6) 그대로.
   hits: 판정 · tells: 박자(예전 바닥 예고 — 지금은 준비 동작·소리만, style = 준비 모양) · winds: 준비 동작 창을 따로 줄 때 · wind: 기본 모양 · lift: 몸 높이(m) · move: 정면 이동(m) · cue: 클립 진행(0~1, 없으면 1:1) */
const SF_SET = { shape: 'cone', range: 4.0, angle: 2.09, damage: .022, heal: .015 };
const KITS = {
  shadowfang: {
    aggro: 16, leash: 24, walk: 3.1, ret: 3.8, engage: 4.0, recovery: [900, 700], phases: [.5], open: 'bloom',
    skills: {
      flurry: { clip: 'atk_sfflurry', duration: 6400, reach: 4.2,   /* 그림자 난무: 떠올라 5·5·7타 + 내리꽂기, 맞을 때마다 흡혈 */
        lift: [[900, 0], [1250, 2.4], [4750, 2.4], [5000, 0]],
        hits: [...seq(1250, 5, 140).map((at, i) => ({ at, ...SF_SET, aim: i === 0 })), ...seq(2550, 5, 140).map((at, i) => ({ at, ...SF_SET, aim: i === 0 })),
          ...seq(3850, 7, 120).map((at, i) => ({ at, ...SF_SET, aim: i === 0 })), { at: 4750, shape: 'circle', radius: 4, damage: .12, knock: 2.4 }],
        tells: [{ from: 0, at: 1250, to: 1810, shape: 'cone', range: 4.0, angle: 2.09, style: 'crouch' }, { from: 1950, at: 2550, to: 3110, shape: 'cone', range: 4.0, angle: 2.09, style: 'coil' },
          { from: 3250, at: 3850, to: 4570, shape: 'cone', range: 4.0, angle: 2.09, style: 'coil' }, { from: 4300, at: 4750, to: 4900, shape: 'circle', radius: 4, style: 'rear' }] },
      thrust: { clip: 'atk_charge', duration: 2770, reach: 9.4, wind: 'crouch',   /* 무음 찌르기: 1.25 s 완전히 멈췄다가 0.12 s 에 9 m */
        cue: [[0, 0], [1250, .28], [1370, .62], [1770, 1]], move: [[1250, 0], [1370, 9], [1770, 10.5]],
        hits: [{ at: 1250, shape: 'line', range: 9.6, width: 1.6, back: .4, damage: .24, knock: 3, heal: .015 }], counter: [1050, 1250],
        tells: [{ from: 0, at: 1250, to: 1370, shape: 'line', range: 9.6, width: 1.6, back: .4 }] },
      bloom: { clip: 'atk_sfbloom', duration: 6400, reach: 99, only: true, winds: [{ from: 0, at: 1000, style: 'rear' }, { from: 1600, at: 3200, style: 'brace' }],   /* 그림자 개화: 50 % 아래로 들어설 때 한 번 — 원 밖이 안전 */
        lift: [[1000, 0], [1600, 6], [3200, 6], [3400, 0]],
        hits: [{ at: 3200, shape: 'circle', radius: 2.6, damage: .18 }, { at: 3400, shape: 'circle', radius: 8, damage: .30, knock: 2 },
          ...seq(3900, 5, 500).map(at => ({ at, shape: 'circle', radius: 8, damage: .025, pool: true }))],
        tells: [{ from: 1600, at: 3400, to: 3600, shape: 'circle', radius: 8 }, { from: 3900, at: 3900, to: 6400, shape: 'circle', radius: 8, post: true }] },
    },
    weights: (d, phase) => d > 4.6 ? { thrust: 1 } : phase === 1 ? { flurry: 3, thrust: 2 } : { flurry: 4, thrust: 3 },
  },
  /* 실험체 09호 — 문서 181 §2·§7 · UE boss_skills.json(subject_09) 박자 그대로. 고유 규칙 «리듬 깨기»: 폭주 연타의 멈춤이 매번 0/0.2/0.4 s 다르다 */
  subject09: {
    aggro: 16, leash: 24, walk: 2.6, ret: 3.6, engage: 3.4, recovery: [1000, 800], phases: [.5], open: 'storm',
    skills: {
      frenzy: { clip: 'atk_s09frenzy', duration: 4000, reach: 3.6,   /* 폭주 연타: 빠른 2타 → 거의 멈춤 → 무거운 3타(마지막 강타) */
        jitter: { at: 1100, steps: [0, 200, 400] },   /* 멈춤 뒤 박자가 통째로 밀린다 — 외운 박자로는 못 피한다 */
        hits: [{ at: 550, shape: 'cone', range: 3.4, angle: 2.2, damage: .06 }, { at: 850, shape: 'cone', range: 3.4, angle: 2.2, damage: .06 },
          { at: 1950, shape: 'cone', range: 3.4, angle: 2.4, damage: .08, aim: true }, { at: 2200, shape: 'cone', range: 3.4, angle: 2.4, damage: .08 },
          { at: 2500, shape: 'cone', range: 3.8, angle: 2.6, damage: .16, knock: 2.6 }], counter: [2250, 2500],
        tells: [{ from: 0, at: 550, to: 850, shape: 'cone', range: 3.4, angle: 2.2, style: 'coil' }, { from: 1100, at: 1950, to: 2200, shape: 'cone', range: 3.4, angle: 2.4, style: 'coil' },
          { from: 2200, at: 2500, to: 2600, shape: 'cone', range: 3.8, angle: 2.6, style: 'rear' }] },
      storm: { clip: 'atk_s09storm', duration: 5200, reach: 30, only: true, winds: [{ from: 0, at: 1200, style: 'rear' }],   /* 방전 폭우: 50 % 아래로 들어설 때 — 하늘이 어두워지고 대상 발밑에 낙뢰 6발 */
        dim: [[0, 0], [1200, .62], [4700, .62], [5200, 0]],
        hits: seq(2800, 6, 350).map(at => ({ at, shape: 'circle', radius: 1.4, damage: .16, atTarget: true, lead: 1200 })),
        tells: [] },   /* 원은 marks 로 따로 그린다 (대상 자리에 찍힌 예고) */
    },
    weights: (d, phase) => d > 3.6 ? {} : { frenzy: 1 },
  },
  /* 정 장관 — 원작 EP26(문서 149 §3): 의전용 군도 · 변주 없는 원 · 정면 결계 3합 · 보지 않고 쳐내는 등 뒤 · 왼손이 그리는 각도.
     전용 동작은 tools/3d/jeong-clips.mjs 가 굽는다(문서 223). 고유 규칙 «외운 원»: 원은 매번 소수점까지 같고, 반격창은 네 번째 원에만 열린다 */
  jeong: {
    aggro: 14, leash: 22, walk: 2.2, ret: 3.2, engage: 3.2, recovery: [900, 750], phases: [], idleClip: 'idle_jeong', deathClip: 'death_jeong', prop: 'saber',
    skills: {
      circle: { clip: 'atk_jeong_circle', duration: 2800, reach: 3.2, counterEvery: 4, wind: 'coil',   /* 완성된 원: 감기 → 한 바퀴 — 같은 박자·같은 반경 */
        hits: [{ at: 1500, shape: 'circle', radius: 3.0, damage: .16, knock: 2.2 }], counter: [1250, 1500],
        tells: [{ from: 550, at: 1500, to: 1650, shape: 'circle', radius: 3.0 }] },
      triple: { clip: 'atk_jeong_triple', duration: 2600, reach: 3.4,   /* 결계 가르기: 정면 3합, 한 걸음씩 */
        move: [[500, 0], [750, .3], [1280, .55], [1820, .85]],
        hits: [{ at: 750, shape: 'cone', range: 2.8, angle: 1.3, damage: .08 }, { at: 1280, shape: 'cone', range: 2.8, angle: 1.3, damage: .08 },
          { at: 1820, shape: 'cone', range: 3.2, angle: 1.0, damage: .15, knock: 2.4 }],
        tells: [{ from: 350, at: 750, to: 800, shape: 'cone', range: 2.8, angle: 1.3, style: 'coil' }, { from: 900, at: 1280, to: 1330, shape: 'cone', range: 2.8, angle: 1.3, style: 'coil' },
          { from: 1400, at: 1820, to: 1900, shape: 'cone', range: 3.2, angle: 1.0, style: 'rear' }] },
      back: { clip: 'atk_jeong_back', duration: 1500, reach: 3.4, behind: true, wind: 'coil',   /* 다 아는 검: 등 뒤의 대상을 고개도 안 돌리고 */
        hits: [{ at: 450, shape: 'cone', range: 3.0, angle: 2.4, damage: .14, knock: 2.6, turn: Math.PI }],
        tells: [{ from: 120, at: 450, to: 520, shape: 'cone', range: 3.0, angle: 2.4, turn: Math.PI }] },
      command: { clip: 'atk_jeong_command', duration: 2400, reach: 12, wind: 'rear',   /* 지휘 — 각도: 왼손이 그은 각도로 의장대의 그림자 셋이 파고든다 */
        hits: [-.32, 0, .32].map((yawOff, i) => ({ at: 1500 + i * 150, shape: 'line', range: 12, width: 1.4, back: 0, damage: .12, yawOff })),
        tells: [{ from: 600, at: 1500, to: 1850, shape: 'lines', range: 12, width: 1.4, offs: [-.32, 0, .32] }] },
    },
    weights: (d, phase, rel) => rel > 1.9 && d < 3.4 ? { back: 1 } : d > 4.2 ? { command: 1 } : { circle: 2, triple: 3 },
  },
  /* ---------- 정지 모델 다섯 (2026-10-14, 디렉터 «지피티가 한계라» — GPT 몫이던 docs/gpt/2026-10-13-bosses-all.md §2.1 을 대신) ----------
     몸에 클립이 없어 «몸은 그대로, 판정만» — 준비 동작(windup)·가슴 빛·낙뢰·고리는 kit-motion 이 그대로 그린다. 던전 장치(문서 233)와 맞물린 숫자는 env-rules 와 같은 값을 적고 시험이 대조한다.
     fixed: 자리도 방향도 바꾸지 않는 보스(탑·산) — 판정은 전부 «대상 자리»(atTarget) 또는 «둘레 고리»(ring) 라 yaw 가 없다 */
  /* 레비아탄 — 원작 EP08~09(문서 146 §3·§5): 옆에서 스치는 돌진(예고 거의 없음) · 머리 앞 격자 «흡입» · 잠복(정적) 뒤 터널 단면 전체 소용돌이 · 방향을 틀 때 아가미가 펼쳐진다(유효타 = 반격창).
     결말은 처치가 아니라 가둠: 소리를 따라 두 문 사이로 들어오는 «유인» 은 aggro 24 — 터널 안에서 사람이 보이면 따라온다(KIT 보스는 world3d 에서 같은 walkMeta 막이를 쓰니 떨어진 차수문이 놈도 막는다, 문서 233 §4) */
  leviathan: {
    aggro: 24, leash: 70, walk: 3.4, ret: 3.0, engage: 5.0, recovery: [900, 800], phases: [.5], open: 'vortex',
    skills: {
      rush: { clip: 'atk_lev_rush', duration: 2200, reach: 12, wind: 'crouch',   /* 측면 급속 돌진 — 0.8 s 뒤 0.4 s 에 10 m, 잠근 방향으로만 («청각상 방향이 반대로 느껴짐» 은 물 띠 hear 가 맡는다) */
        move: [[800, 0], [1200, 10], [1700, 11]],
        hits: [{ at: 800, shape: 'line', range: 11, width: 2.4, back: .5, damage: .16, knock: 2.6 }],
        tells: [{ from: 150, at: 800, to: 1000, shape: 'line', range: 11, width: 2.4, back: .5, style: 'crouch' }] },
      suck: { clip: 'atk_lev_suck', duration: 3000, reach: 9, wind: 'rear',   /* 흡입 — 격자가 열리고 앞 9 m 가 1.2 s 동안 네 번 끌려온다(knock 음수) · 2.5 s 에 격자가 닫히며 문다 */
        hits: [...seq(1200, 4, 300).map(at => ({ at, shape: 'cone', range: 9, angle: 1.6, damage: .03, knock: -1.6 })), { at: 2500, shape: 'cone', range: 3.4, angle: 1.5, damage: .14, knock: 1.2 }],
        tells: [{ from: 0, at: 1200, to: 2200, shape: 'cone', range: 9, angle: 1.6, style: 'rear' }, { from: 2200, at: 2500, to: 2600, shape: 'cone', range: 3.4, angle: 1.5, style: 'coil' }] },
      gill: { clip: 'atk_lev_turn', duration: 2600, reach: 5.5, wind: 'coil',   /* 방향 전환 — 옆구리 아가미 한 쌍이 펼쳐진다: 1.15~1.4 s 가 «아가미 뿌리» 반격창 · 1.4 s 에 꼬리가 둘레를 친다 */
        hits: [{ at: 1400, shape: 'circle', radius: 4.4, damage: .10, knock: 1.8 }], counter: [1150, 1400],
        tells: [{ from: 300, at: 1400, to: 1500, shape: 'circle', radius: 4.4, style: 'coil' }] },
      vortex: { clip: 'atk_lev_vortex', duration: 6000, reach: 99, only: true, winds: [{ from: 2200, at: 3400, style: 'rear' }],   /* 잠복: 2.2 s 완전한 정적(«조용함 = 안전 아님») → 수면이 부풀어 → 3.4 s 터널 단면 전체 소용돌이 14 m · 뒤 파편 넷 */
        hits: [{ at: 3400, shape: 'circle', radius: 14, damage: .22, knock: 3.2 }, ...seq(3900, 4, 500).map(at => ({ at, shape: 'circle', radius: 14, damage: .03, pool: true }))],
        tells: [{ from: 2200, at: 3400, to: 3600, shape: 'circle', radius: 14 }, { from: 3900, at: 3900, to: 6000, shape: 'circle', radius: 14, post: true }] },
    },
    weights: (d, phase) => d > 6 ? { rush: 1 } : d > 4.4 ? { suck: 2, rush: 1 } : { gill: 3, suck: 2 },
  },
  /* 에이지스-07 — 원작 EP06~07(문서 146 §1·§2): 4 m 다각보행체, 보이지 않는 벽. 정면 타격은 «틱—» 튕기고(0) · 옆은 반 · 등 뒤(열 배출구)는 그대로 — 등 뒤를 셋 맞히면 «꺼졌어요!» down ms 동안 벽이 내려가 모든 타격 ×1.5 (hitMul).
     기술: 다리 휩쓸기(반격창) · 상체 포문 사격 «콰창» · 발 내려찍기 «쿵» · 50 % 에 등 과부하(벽이 스스로 내려간다). 절뚝이니 walk 2.4 */
  aegis: {
    aggro: 26, leash: 40, walk: 2.4, ret: 3.0, engage: 4.5, recovery: [1000, 800], phases: [.5], open: 'vent',
    guard: { front: 1.05, back: 2.2, sideMul: .5, hits: 3, down: 8000, openMul: 1.5 },   /* front/back: 정면·등 뒤 각(rad, 대상 방위 − yaw) */
    skills: {
      sweep: { clip: 'atk_aegis_sweep', duration: 2400, reach: 5.6, wind: 'coil',   /* 다리 휩쓸기 — 앞 반원 5.2 m, 1.1~1.3 s 반격창 */
        hits: [{ at: 1300, shape: 'cone', range: 5.2, angle: 3.4, damage: .14, knock: 2.4 }], counter: [1100, 1300],
        tells: [{ from: 300, at: 1300, to: 1400, shape: 'cone', range: 5.2, angle: 3.4, style: 'coil' }] },
      cannon: { clip: 'atk_aegis_cannon', duration: 3200, reach: 16, wind: 'rear',   /* 상체 포문 — 1.7 s 에 앞 16 m 한 줄 «콰창» · 바로 뒤 포구 둘레 폭풍 */
        hits: [{ at: 1700, shape: 'line', range: 16, width: 2.4, back: 0, damage: .20, knock: 3.5 }, { at: 1900, shape: 'circle', radius: 3, damage: .06, knock: 1.5 }],
        tells: [{ from: 400, at: 1700, to: 1800, shape: 'line', range: 16, width: 2.4, back: 0, style: 'rear' }] },
      stomp: { clip: 'atk_aegis_stomp', duration: 1900, reach: 3.8, wind: 'crouch',   /* 쿵 — 발밑 3.4 m */
        hits: [{ at: 1000, shape: 'circle', radius: 3.4, damage: .12, knock: 2.8 }],
        tells: [{ from: 200, at: 1000, to: 1100, shape: 'circle', radius: 3.4, style: 'crouch' }] },
      vent: { clip: 'atk_aegis_vent', duration: 4200, reach: 99, only: true, guardDown: 10000, winds: [{ from: 0, at: 2200, style: 'brace' }],   /* 50 %: 등 불꽃 «치직» — 벽이 10 s 내려간 채 둘레 7 m 를 밀어낸다 */
        hits: [{ at: 2200, shape: 'circle', radius: 7, damage: .16, knock: 3 }],
        tells: [{ from: 600, at: 2200, to: 2400, shape: 'circle', radius: 7, style: 'brace' }] },
    },
    weights: (d, phase) => d > 6 ? { cannon: 1 } : d > 3.8 ? { sweep: 3, cannon: 1 } : { stomp: 3, sweep: 2 },
  },
  /* 셀레스티얼 — 원작 EP04·EP17(문서 145 §1·§4): 4 m 활공체(zones fly 3.4), 급강하 발톱(예고 없음 → 0.7 s 만) · 낙사 유도 돌풍(골짜기 벽에 등을 대면 ⅓, env VALLEY) · 공간 접기 15 m 순간 급습(2 단계) · 50 % 코어 흡수 재구성(날개 넷).
     고도 상한 15 m(날개 손상): lift 최대 8 + 3.4 = 11.4 m. 반격창은 «거는 손» — 지나가는 날개 관절에 낫을 건다 */
  celestial2: {
    aggro: 34, leash: 60, walk: 5.5, ret: 5.0, engage: 6.0, recovery: [800, 650], phases: [.5], open: 'devour',
    skills: {
      dive: { clip: 'atk_cel_dive', duration: 2600, reach: 14, wind: 'rear',   /* 급강하 — 0.7 s 솟았다 1.5 s 에 바닥 0.6 m 로 12 m 를 긁고 지나간다 */
        lift: [[0, 0], [700, 8], [1300, 8], [1500, -2.8], [2000, -2.8], [2600, 0]], move: [[700, 0], [1500, 11], [2000, 12]],
        hits: [{ at: 1500, shape: 'line', range: 12, width: 2.4, back: 0, damage: .18, knock: 3 }], counter: [1300, 1500],
        tells: [{ from: 0, at: 1500, to: 1600, shape: 'line', range: 12, width: 2.4, back: 0, style: 'rear' }] },
      gust: { clip: 'atk_cel_gust', duration: 3000, reach: 12, wind: 'brace',   /* 낙사 유도 돌풍 — 앞 12 m 를 0.3 s 마다 네 번 민다 */
        hits: seq(1200, 4, 300).map(at => ({ at, shape: 'cone', range: 12, angle: 1.9, damage: .025, knock: 2.2 })),
        tells: [{ from: 200, at: 1200, to: 2100, shape: 'cone', range: 12, angle: 1.9, style: 'brace' }] },
      fold: { clip: 'atk_cel_fold', duration: 2200, reach: 16, wind: 'coil',   /* 공간 접기 — 0.9 s 에 15 m 를 접어 대상 머리 위, 1.0 s 에 내려찍는다 (2 단계부터) */
        move: [[900, 0], [950, 15], [1600, 15]],
        hits: [{ at: 1000, shape: 'circle', radius: 3.4, damage: .20, knock: 2.6 }],
        tells: [{ from: 0, at: 1000, to: 1100, shape: 'circle', radius: 3.4, style: 'coil' }] },
      devour: { clip: 'atk_cel_devour', duration: 5200, reach: 99, only: true, winds: [{ from: 0, at: 2400, style: 'rear' }],   /* 50 %: 수납부 격자가 열려 수거한 코어를 삼킨다 — 6 m 떠서 2.4 s 에 빛이 넘쳐 둘레 9 m 를 민다 */
        lift: [[0, 0], [1200, 6], [3000, 6], [3600, 0]], dim: [[0, 0], [1200, .4], [3600, .4], [5200, 0]],
        hits: [{ at: 2400, shape: 'circle', radius: 9, damage: .14, knock: 3.5 }],
        tells: [{ from: 1200, at: 2400, to: 2600, shape: 'circle', radius: 9, style: 'rear' }] },
    },
    weights: (d, phase) => d > 7 ? (phase > 1 ? { dive: 2, fold: 2 } : { dive: 1 }) : d > 4 ? { gust: 2, dive: 1 } : phase > 1 ? { gust: 1, fold: 1 } : { gust: 1 },
  },
  /* 아스널 오버로드 — 원작 EP21~22(문서 148 §2·§3): 10 m 복합체, 이동·추격 없음(fixed). 내 방위의 포탑 셋이 «공기음» 0.5 s 뒤 그 자리에 사출 · 전탄 제압 = 1.8 s 완전한 정적 뒤 18 발 집중 · 50 % 과부하 → 눈먼 탑(무작위 사출·천장 낙하).
     혼자 연습의 물리 포탑(world3d TURRET 4·5·6 초)은 그대로 따로 돈다 — 이 표는 서버·온라인에서도 같은 박자로 맞는 «판정». 엄폐물 단계는 클라 fieldDevice(cover) */
  arsenal: {
    aggro: 30, leash: 999, walk: 0, ret: 0, engage: 30, recovery: [1200, 900], phases: [.5], open: 'collapse', fixed: true,
    skills: {
      volley: { clip: 'atk_ars_volley', duration: 2400, reach: 30, winds: [{ from: 0, at: 900, style: 'brace' }],   /* 사출 셋 — 0.5 s 전 내 자리에 찍히고 떨어진다: 계속 움직이면 안 맞는다 */
        hits: seq(900, 3, 500).map(at => ({ at, shape: 'circle', radius: 1.3, damage: .05, knock: .8, atTarget: true, lead: 500 })), tells: [] },
      suppress: { clip: 'atk_ars_suppress', duration: 4200, reach: 30, winds: [{ from: 1800, at: 2800, style: 'brace' }],   /* 전탄 제압 — 1.8 s 정적(«선회·장전음 소실이 유일한 예고») → 2.8 s 18 발 집중 3.2 m · 파편 6 m */
        hits: [{ at: 2800, shape: 'circle', radius: 3.2, damage: .28, knock: 2.5, atTarget: true, lead: 1800 }, { at: 2900, shape: 'circle', radius: 6, damage: .10, knock: 1.2, atTarget: true, lead: 1900 }], tells: [] },
      collapse: { clip: 'atk_ars_collapse', duration: 5000, reach: 99, only: true, winds: [{ from: 0, at: 1500, style: 'rear' }],   /* 50 %: 포탑 다섯이 죽어 출력이 코어로 — 눈먼 탑: 1.3 s 전 자리에 다섯 번 천장이 떨어진다 */
        hits: seq(1500, 5, 600).map(at => ({ at, shape: 'circle', radius: 2.6, damage: .12, knock: 1.8, atTarget: true, lead: 1300 })), tells: [] },
    },
    weights: (d, phase) => phase > 1 ? { volley: 2, suppress: 2 } : { volley: 3, suppress: 1 },
  },
  /* 나노-노바 코어 — 원작 EP27(문서 149 §4): 결정 산이 곧 보스(fixed). 팔이 앞 보스를 «복습»한다 — 셔터 팔(내려찍기, 반격창) · 접힘 팔(공간 주름: 대상 자리 폭발) · 무음 팔(소리 지움, 둘레) · 원의 팔(거대한 원 참격).
     «원 궤적 안쪽이 안전지대»: 둘레 판정은 전부 ring — inner 4.5 는 env-rules SAFE.r 과 같다(tests/kit-motion 이 대조). 원의 팔은 50 % 에 처음, 2 단계부터는 보통 기술 */
  nova: {
    aggro: 30, leash: 999, walk: 0, ret: 0, engage: 30, recovery: [1100, 850], phases: [.5], open: 'ring', fixed: true,
    skills: {
      shutter: { clip: 'atk_nova_shutter', duration: 2300, reach: 12, winds: [{ from: 0, at: 1200, style: 'rear' }],   /* 셔터 팔 — 0.9 s 전 내 자리에 셔터가 선다, 1.2 s 내려찍기 · 1.0~1.2 s 반격창 */
        hits: [{ at: 1200, shape: 'circle', radius: 2.6, damage: .16, knock: 2.4, atTarget: true, lead: 900 }], counter: [1000, 1200], tells: [] },
      fold: { clip: 'atk_nova_fold', duration: 2800, reach: 24, winds: [{ from: 0, at: 1500, style: 'coil' }],   /* 접힘 팔 — 1.2 s 전 자리가 접힌다 */
        hits: [{ at: 1500, shape: 'circle', radius: 3.2, damage: .18, knock: 2.0, atTarget: true, lead: 1200 }], tells: [] },
      mute: { clip: 'atk_nova_mute', duration: 3200, reach: 14, wind: 'brace', dim: [[0, 0], [600, .5], [2600, .5], [3200, 0]],   /* 무음 팔 — 빛이 죽고 1.9 s 둘레 4.5~11 m 를 친다 (가운데는 안전) */
        hits: [{ at: 1900, shape: 'ring', inner: 4.5, radius: 11, damage: .12, knock: 2.4 }],
        tells: [{ from: 400, at: 1900, to: 2000, shape: 'ring', inner: 4.5, radius: 11, style: 'brace' }] },
      ring: { clip: 'atk_nova_ring', duration: 4400, reach: 99, winds: [{ from: 0, at: 2200, style: 'coil' }],   /* 원의 팔 — «수백 배로 키운 아인의 원»: 2.2 s 둘레 4.5~18 m, 2.6 s 되돌아오는 끝자락 */
        hits: [{ at: 2200, shape: 'ring', inner: 4.5, radius: 18, damage: .30, knock: 3.5 }, { at: 2600, shape: 'ring', inner: 4.5, radius: 18, damage: .10, knock: 1.5 }],
        tells: [{ from: 800, at: 2200, to: 2400, shape: 'ring', inner: 4.5, radius: 18, style: 'coil' }] },
    },
    weights: (d, phase) => phase > 1 ? (d > 6 ? { fold: 2, ring: 1 } : { shutter: 2, mute: 1, ring: 1 }) : d > 6 ? { fold: 1 } : { shutter: 3, mute: 1 },
  },
};
const round2 = n => +n.toFixed(2), angle = (x, z) => Math.atan2(x, z), dAng = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const kitOf = o => KITS[o && o.id] || null, k = kitOf;
function enabled(o) { return !!kitOf(o); }
function phaseOf(o) { const k = kitOf(o), max = Math.max(1, Number(o?.max) || 1), r = Math.max(0, Math.min(max, Number.isFinite(o?.hp) ? o.hp : max)) / max; let p = 1; for (const t of (k && k.phases) || []) if (r <= t) p++; return p; }
/* 시간표 곡선: [[t, v], …] 사이를 곧게 */
function curve(pts, t) { if (!pts || !pts.length) return 0; if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return v0 + (v1 - v0) * (t - t0) / Math.max(1, t1 - t0); } return pts[pts.length - 1][1]; }

function setup(o, now = Date.now()) {
  if (!enabled(o)) return null; o.homeX = o.homeX ?? o.x; o.homeZ = o.homeZ ?? o.z;
  o.kit = { state: 'idle', skill: '', seq: 0, startedAt: now, endsAt: now + 700, lastAt: now, yaw: o.yaw || 0, target: null, hitIndex: 0, fromX: o.x, fromZ: o.z, countered: false, phase: phaseOf(o), opened: false, history: [], pattern: null };
  o.yaw = o.kit.yaw; return o.kit;
}
function reset(o, now = Date.now()) { if (enabled(o)) { if (Number.isFinite(o.homeX)) { o.x = o.homeX; o.z = o.homeZ; } setup(o, now); } }
function setState(o, state, now, duration = 0, extra = {}) { const a = o.kit; a.state = state; a.skill = extra.skill || ''; a.startedAt = now; a.endsAt = now + duration; a.seq++; a.hitIndex = 0; a.countered = false; a.recovering = false; Object.assign(a, extra); return a; }
const live = (field, o) => [...field.players.values()].filter(p => p.zone === o.zone && !p.dead && Number.isFinite(p.hp));
function nearest(field, o, r) { let best = null, bd = Infinity; for (const p of live(field, o)) { const d = Math.hypot(p.x - o.x, p.z - o.z); if (d < bd) { best = p; bd = d; } } return bd <= r ? { p: best, d: bd } : null; }
function target(field, o) { const id = o.kit.target, p = id && field.players.get(id); return p && p.zone === o.zone && !p.dead ? p : null; }
function turn(o, x, z, max) { if (kitOf(o)?.fixed) return;   /* 탑·산은 돌아서지 않는다 */ const d = dAng(angle(x - o.x, z - o.z), o.yaw || 0); o.yaw = (o.yaw || 0) + Math.max(-max, Math.min(max, d)); o.kit.yaw = o.yaw; }
function move(o, x, z, speed, dt) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz); if (d < 1e-5) return d; const n = Math.min(d, speed * dt); o.x += dx / d * n; o.z += dz / d * n; return d - n; }
function inShape(o, p, h) {
  const dx = p.x - o.x, dz = p.z - o.z, fx = Math.sin(o.yaw || 0), fz = Math.cos(o.yaw || 0), f = dx * fx + dz * fz, s = dx * fz - dz * fx;
  if (h.shape === 'circle') return dx * dx + dz * dz <= h.radius * h.radius;
  if (h.shape === 'ring') { const q = dx * dx + dz * dz, i = h.inner || 0; return q <= h.radius * h.radius && q >= i * i; }   /* 둘레 고리 — 안쪽(inner)은 안전지대 (노바, 문서 233 §8) */
  if (h.shape === 'line') return f >= -(h.back || 0) && f <= h.range && Math.abs(s) <= h.width * .5;
  if (h.shape === 'cone') return f >= 0 && Math.hypot(dx, dz) <= h.range && Math.abs(Math.atan2(s, f)) <= h.angle * .5;
  return false;
}
function skillWeights(o, p) {
  const k = kitOf(o), a = o.kit, d = Math.hypot(p.x - o.x, p.z - o.z), rel = Math.abs(dAng(angle(p.x - o.x, p.z - o.z), o.yaw || 0)), w = { ...k.weights(d, phaseOf(o), rel) };   /* rel: 대상이 정면에서 몇 rad — 등 뒤 기술용 */
  for (const id of Object.keys(w)) { const s = k.skills[id]; if (!s || s.only || d > s.reach + .15) w[id] = 0; }
  const last = a.history[a.history.length - 1]; if (last && w[last] > 0 && Object.keys(w).filter(id => w[id] > 0).length > 1) w[last] *= .3;   /* 같은 기술 연달아는 드물게 */
  return w;
}
function choose(field, o, p) {
  const k = kitOf(o), a = o.kit;
  if (a.pattern && k.skills[a.pattern]) { const f = a.pattern; a.pattern = null; return f; }   /* 시험·검수가 기술을 고르는 통로 */
  const w = skillWeights(o, p), ids = Object.keys(w); let total = 0; for (const id of ids) total += Math.max(0, w[id]); if (total <= 0) return null;
  let r = Math.max(0, Math.min(.999999, Number(field?.rng?.()) || 0)) * total; for (const id of ids) { r -= Math.max(0, w[id]); if (r < 0) return id; } return ids.find(id => w[id] > 0) || null;
}
function begin(field, o, p, now, skill) {
  const def = kitOf(o).skills[skill]; if (p && !def.behind) turn(o, p.x, p.z, Math.PI);   /* 등 뒤 기술은 돌아서지 않는다 — «보지도 않고» */
  const j = def.jitter, shift = j ? j.steps[Math.min(j.steps.length - 1, Math.floor(Math.max(0, Math.min(.999999, Number(field?.rng?.()) || 0)) * j.steps.length))] : 0;
  let live = true; if (def.counterEvery) { const c = o.kit.counts || (o.kit.counts = {}); c[skill] = (c[skill] || 0) + 1; live = c[skill] % def.counterEvery === 0; }   /* 외운 원: 네 번째마다 */
  setState(o, 'skill', now, def.duration + shift, { skill, target: p ? p.id : null, fromX: o.x, fromZ: o.z, shift, marks: [], counterLive: live });
  if (def.guardDown) { const gs = o.kit.guard || (o.kit.guard = { hits: 0, downUntil: 0 }); gs.hits = 0; gs.downUntil = now + def.guardDown; }   /* 등 과부하 — 벽이 스스로 내려간다 */
  const h = o.kit.history; h.push(skill); while (h.length > 4) h.shift();
}
function finish(o, now) { const k = kitOf(o), rec = k.recovery[Math.min(k.recovery.length, phaseOf(o)) - 1]; setState(o, 'idle', now, rec, { target: null, recovering: true }); }
function skillTick(field, o, now) {
  const a = o.kit, def = kitOf(o).skills[a.skill]; if (!def) { finish(o, now); return; }
  const t = now - a.startedAt;
  if (def.move) { const dist = curve(def.move, t); o.x = a.fromX + Math.sin(o.yaw) * dist; o.z = a.fromZ + Math.cos(o.yaw) * dist; }   /* 돌진: 예고 때 잠근 방향으로만 */
  const at = h => h.at + (def.jitter && h.at >= def.jitter.at ? a.shift || 0 : 0);   /* 리듬 깨기: 멈춤 뒤 박자만 민다 */
  /* 대상 발밑 표식: 판정 lead ms 전에 그 순간의 대상 자리를 찍어 둔다 (화면은 marks 를 보고 원을 그린다) */
  for (let i = 0; i < def.hits.length; i++) { const h = def.hits[i]; if (!h.atTarget || a.marks[i] || t < at(h) - h.lead) continue; const p = target(field, o) || nearest(field, o, k(o).leash)?.p; a.marks[i] = p ? [round2(p.x), round2(p.z)] : [round2(o.x), round2(o.z)]; }
  while (a.hitIndex < def.hits.length && t >= at(def.hits[a.hitIndex])) {
    const h = def.hits[a.hitIndex]; a.hitIndex++;
    if (h.aim) { const p = target(field, o); if (p) turn(o, p.x, p.z, Math.PI / 2); }   /* 난무: 세트마다 방향을 다시 잡는다 (숨 동안 틀어짐) */
    const mk = h.atTarget && a.marks[a.hitIndex - 1], yh = (o.yaw || 0) + (h.turn || 0) + (h.yawOff || 0), origin = mk ? { x: mk[0], z: mk[1], yaw: 0 } : def.move && h.shape === 'line' ? { x: a.fromX, z: a.fromZ, yaw: yh } : { x: o.x, z: o.z, yaw: yh }, hit = { ...h, skill: a.skill, beat: a.hitIndex, beats: def.hits.length };
    for (const p of live(field, o)) if (inShape(origin, p, hit)) { const r = field.bossStrike(o, p, hit, now);
      if (h.heal && r && r.amount > 0) o.hp = Math.min(o.max, (o.hp || 0) + Math.round(o.max * h.heal)); }   /* 흡혈: 맞힌 만큼 보스가 회복 (보스 고유 규칙, 문서 181 §1 ④) */
  }
  if (now >= a.endsAt) finish(o, now);
}
function tick(field, o, now = Date.now()) {
  if (!enabled(o) || !o.alive) return; if (!o.kit) setup(o, now);
  const k = kitOf(o), a = o.kit, dt = Math.min(.1, Math.max(0, (now - a.lastAt) / 1000)); a.lastAt = now;
  const ph = phaseOf(o); if (ph !== a.phase) { a.phase = ph; }
  if (a.state === 'skill') { skillTick(field, o, now); return; }
  if (a.state === 'stagger') { if (now >= a.endsAt) finish(o, now); return; }
  /* 단계 문턱을 넘으면 «여는 기술» 을 한 번 (섀도우 팽: 그림자 개화) — 누가 근처에 있을 때만 */
  if (k.open && !a.opened && a.phase > 1) { const n = nearest(field, o, k.leash); if (n) { a.opened = true; begin(field, o, n.p, now, k.open); return; } }
  /* finish clears the target; nearest() must not replace this idle with walk
     (and reset endsAt) before the configured recovery has elapsed. */
  if (a.recovering && now < a.endsAt) return;
  const t = target(field, o), homeD = Math.hypot(o.x - o.homeX, o.z - o.homeZ);
  if (t) { const d = Math.hypot(t.x - o.x, t.z - o.z);
    if (d > k.leash || homeD > k.leash) setState(o, 'return', now, 0, { target: null });
    else if (now >= a.endsAt) { const s = choose(field, o, t); if (s) { begin(field, o, t, now, s); return; }
      if (a.state !== 'walk') setState(o, 'walk', now, 0, { target: t.id }); turn(o, t.x, t.z, dt * 3); move(o, t.x, t.z, k.walk, dt); return; }
    else return; }
  if (a.state === 'return' || homeD > 1) { if (a.state !== 'return') setState(o, 'return', now, 0, { target: null }); turn(o, o.homeX, o.homeZ, dt * 3.2);
    if (move(o, o.homeX, o.homeZ, k.ret, dt) <= .08) { o.x = o.homeX; o.z = o.homeZ; setState(o, 'idle', now, 650, { target: null }); } return; }
  const n = nearest(field, o, k.aggro); if (n) { a.target = n.p.id; if (a.state !== 'walk') setState(o, 'walk', now, 0, { target: n.p.id }); }
  else if (a.state !== 'idle') setState(o, 'idle', now, 0, { target: null });
}
function tryCounter(o, now = Date.now()) {
  const a = o && o.kit, def = a && kitOf(o).skills[a.skill]; if (!a || a.state !== 'skill' || !def?.counter || a.countered || a.counterLive === false) return false;
  const sh = def.jitter && def.counter[0] >= def.jitter.at ? a.shift || 0 : 0, t = now - a.startedAt - sh; if (t < def.counter[0] || t > def.counter[1]) return false;
  a.countered = true; setState(o, 'stagger', now, 1350, { skill: a.skill, target: null }); return true;
}
/* 보이지 않는 벽 (에이지스, 문서 146 §1·§2 «틱—» · «셋이 필요했다» · «꺼졌어요!»): 내 타격 배율. 정면(front 안)은 0 — 튕긴다 · 옆은 sideMul · 등 뒤(back 밖)는 1 이고 hits 번 맞히면 down ms 동안 벽이 내려가 openMul.
   서버 hit() 과 혼자 연습 strike() 가 같은 함수를 부른다. guard 가 없는 보스는 늘 1 */
function hitMul(o, p, now = Date.now()) {
  const k = kitOf(o), g = k && k.guard, a = o && o.kit; if (!g || !a || !o.alive) return { mul: 1 };
  const gs = a.guard || (a.guard = { hits: 0, downUntil: 0 }); if (now < gs.downUntil) return { mul: g.openMul, open: true };
  const rel = Math.abs(dAng(angle(p.x - o.x, p.z - o.z), o.yaw || 0));
  if (rel < g.front) return { mul: 0, blocked: true };
  if (rel > g.back) { gs.hits++; if (gs.hits >= g.hits) { gs.hits = 0; gs.downUntil = now + g.down; return { mul: 1, broke: true }; } return { mul: 1, back: gs.hits }; }
  return { mul: g.sideMul, side: true };
}
function view(o, now = Date.now()) {
  if (!enabled(o) || !o.alive || !o.kit) return null; const a = o.kit, def = kitOf(o).skills[a.skill], c = a.counterLive === false ? null : def?.counter, sk = a.state === 'skill';
  return { id: o.id, ai: 'kit', x: round2(o.x), z: round2(o.z), yaw: round2(o.yaw || 0), motion: a.state, skill: a.skill, seq: a.seq, startedAt: a.startedAt, endsAt: a.endsAt,
    fromX: sk ? round2(a.fromX) : 0, fromZ: sk ? round2(a.fromZ) : 0, shift: sk ? a.shift || 0 : 0, marks: sk && a.marks && a.marks.length ? a.marks.map(m => m || null) : undefined,
    counterOpen: c && sk ? a.startedAt + c[0] + (def.jitter && c[0] >= def.jitter.at ? a.shift || 0 : 0) : 0, counterClose: c && sk ? a.startedAt + c[1] + (def.jitter && c[0] >= def.jitter.at ? a.shift || 0 : 0) : 0,
    guard: kitOf(o).guard ? (a.guard && now < a.guard.downUntil ? 0 : 1) : undefined };   /* 벽: 1 켜짐 · 0 내려감 (에이지스만) */
}
module.exports = { KITS, enabled, hitMul, shiftAt: (def, a, at) => at + (def.jitter && at >= def.jitter.at ? (a && a.shift) || 0 : 0), phaseOf, curve, setup, reset, tick, tryCounter, view, inShape, skillWeights };
