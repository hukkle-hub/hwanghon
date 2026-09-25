# 스킬·공격 모션 레퍼런스 조사 v1 (2026-09-25)

대상: 아인(낫) · 카인(대검) · 류(쌍단검) · 세라(투척). 벤치마크: 마영전 · 몬헌 · 명조 + 엘든 링 · 세키로 · 오공 · DMC.
레퍼런스 GIF 78개·콘택트 시트 156장은 게임 저작물이라 저장소에 넣지 않는다(내부 참고, 스크래치).

표기: **[ER]** 엘든 링 프레임 데이터 익스플로러(https://er-frame-data.nyasu.business/ , 레귤레이션 1.17, 30 fps) · **[GIF]** 위키 GIF 에서 잰 값(캡처 속도 불확실, 보조) ·
**「근거 없음」** 출처 없는 추정 — 모바일 권장 시간은 ER ×0.55~0.7 로 압축한 **제안**이라 전부 「근거 없음」. 무적·패리 창은 압축하지 않는다.

## 1. 공통 기준
| 항목 | 값 | 출처 |
|---|---|---|
| 반응 시간 | 0.25 s — 적 예비 동작 ≥ 반응 + 방어 발동 + 여유 | https://gdkeys.com/keys-to-combat-design-1-anatomy-of-an-attack/ |
| 약공격 | 전체 20–35f@30, 스윙 6–12f, 예비 0.1–0.2 s | https://mocaponline.com/blogs/mocap-news/sword-melee-animation-guide |
| 강공격 | 전체 45–80f@30, 스윙 12–24f, 양손 후딜 0.8–1.5 s | 같음 |
| 히트스톱 | 1–4f, 피해 비례·상한, 공격자도 멈춤, 투사체는 짧게 | MoCap · https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/ |
| 세키로 튕겨내기 | 가드 입력 후 12f@60(0.2 s) | https://sekiroshadowsdietwice.wiki.fextralife.com/Deflection |
| ER 패리 | 판정 4–10f, 첫 캔슬 21–23f | [ER] |
| ER 구르기 / 퀵스텝 | 무적 0–13f / 0–15f, 퀵스텝 공격 캔슬 21f | [ER] |
| 몬헌 대검 | 차지 1초/단계, 참 모아베기 16+209 (Lv3) | https://monsterhunterwiki.org/wiki/MHWilds/Great_Sword_Mechanics |

## 2. 기본공격 [ER] 원본
- **낫 양손 R1 1–4**: 판정 시작 14/18/18/22f, 다음공격 캔슬 27/30/30/50f, 회피 캔슬 29/33/32/40f. 차지 R2 2타 44–46f·58–60f.
- **대검 R1 1–4**: 판정 15/18/16/24f, 슈퍼아머 판정 약 7f 전부터 5–8f 뒤까지. 차지 R2 38f(슈퍼아머 22–48f).
- **단검 R1 1–5**: 판정 10/8/9/8/9f, 캔슬 14–16f. 6타만 14f(느린 마무리). 쌍날검 R1-1 은 7f 간격 2히트.
- **투척(Pot Throw)**: 34f 생성, 캔슬 54f — 우리 게임엔 느리다.

## 3. 스킬별 레퍼런스 · 단계 제안 (시간·각도 「근거 없음」)
### 아인
- **낫 베기** — ER 로레타의 베기(판정 19–25/44–51f, 슈퍼아머 12–60f), 마영전 Life Drain. 예비 .20 → 동작 .08(골반→흉곽→팔 .03 s 시차, 날을 대상 뒤에 걸어 당김) → 히트스톱 3f → 팔로스루 .15 → 회복 .22.
- **그림자 걸음** — 마영전 Blink(투명 구간 약 0.4 s 에 무적), ER 퀵스텝. 무적 0–.30 s, 4–5 m, 한 무릎 착지.
- **피의 회전** — ER Spinning Slash(한 바퀴 약 .57 s)·Spinning Weapon. 1.5 회전 2히트, 머리 스포팅, 전 구간 슈퍼아머.
- **결의** — 오공 Rock Solid, 명조 감심. 진입 .25(낫을 중심선에 세움) → 루프 → 해제 .2.
- **낫의 황혼** — ER Bloody Slash(판정 30f, 날에 피 묻히고 대각 베기). 혈인 .35 → 감기 .25 → 동작 .10 → 히트스톱 6f + 슬로우 → 결정 포즈.
- **반격** — 마영전 Counterattack/Cross Cut, ER 패리. 판정창 .20 s(압축 금지) → 흘려내기 .08 → 역회전 당겨베기.
### 카인
- **내려치기** — 몬헌 모아베기, ER Carian Greatsword([GIF] 들어올림 → 앞발 디딤 → 콘택트 → 지면 충돌). 들어올림 .40(슈퍼아머) → 홀드 .06 → 낙하 .10 → 히트스톱 5f.
- **철벽** — 마영전 허크 Deflection([GIF] 낮은 대기 → 쳐올림 → 반격). 칼 면을 적 쪽, 왼손으로 칼 옆면 받침, 넓은 자세.
- **강철 회전** — 마영전 Butterfly Swing, ER Spinning Slash. 2회전, 끝에 검 무게로 30° 더 돌며 비틀.
- **지면 강타** — 마영전 Earthquake, ER Gravitas(판정 20–22f, [GIF] 무릎 꿇고 꽂기 → 충격파). 발 스톰프와 검 박기 동시, 히트스톱 6f + 방사 흔들림.
- **모루의 심판** — ER Lion's Claw(판정 42–45f, 도약 반 바퀴 내려치기), 몬헌 참 모아베기처럼 2타째가 본타.
### 류
- **기본** — 좌우 교대(역수 베기 → 정수 찌르기 → 교차), 약 .27 s 간격, 6타만 느린 X 마무리.
- **쌍날 난무** — 몬헌 쌍검 난무, 마영전 Fanning Slash/Thousand Needles, ER Blood Tax(히트 간격 .17–.37 s). 6히트 × .13 s, 마지막 히트스톱 3f.
- **그림자 도약** — 마영전 Aerial Evasion, ER Bloodhound's Step(무적 0–16f). 도약 .30 무적, 착지 즉시 반격 캔슬.
- **칼날 폭풍** — 마영전 Typhoon Slash, DMC Round Trip. 3바퀴 × .25 + 수평 대형 베기.
- **표식** — 마영전 Mark of Death([GIF] 손가락 튕김 후 약 .2 s 뒤 폭발).
- **붉은 그림자** — 마영전 Lethal Crosscut/Fury No.7, ER Bloodblade Dance. 12히트 난타 + X 마무리.
### 세라
- **부식 시약** — 세키로 Ceramic Shard([GIF] 감기 → 약 .92 s 릴리스 → 팔로스루), 반대 팔로 조준. 예비 .18 → 릴리스 .06(골반→흉곽→어깨→팔꿈치→손목 채찍) → 팔로스루 .15.
- **정제 안개** — 세키로 Mist Raven(팔 교차 → 깃털 폭발 → 재출현). 백스텝 무적 .25.
- **연쇄 폭발** — 마영전 Big Bang, 세키로 Flame Vent. 3연투 .12 s 간격, 폭발 연쇄 .15 s, 투사체라 히트스톱 1–2f.
- **회복 결계** — 명조 백지 해방(팔 들어 시전 → 바닥 원). 무릎 꿇고 병 깨기.
- **촉매 폭발** — 마영전 Massive Impact, 명조 Encore 해방. 조합(병 흔들기) → 투척 → 얼굴 가리는 포즈 → 대폭발.

## 4. 무료 클립 라이브러리
| 라이브러리 | 라이선스 | 받기 | 내용 |
|---|---|---|---|
| Quaternius UAL 1 Standard | CC0 | https://opengameart.org/content/universal-animation-library — 됨 | 46 클립, 무기 `Sword_Attack` 하나, `Roll`, `Spell_Simple_*` |
| Quaternius UAL 2 Standard | CC0 | https://opengameart.org/content/universal-animation-library-2 — 됨 | 43 클립: `Sword_Regular_A/B/C/Combo`, `Sword_Dash_RM`, `Sword_Block`, `OverhandThrow`, `NinjaJump_*`, `Slide_*` |
| KayKit Character Animations 1.1 | CC0 | https://kaylousberg.itch.io/kaykit-character-animations — 됨(무료 흐름, 로그인 없음) | Medium/Large 리그, 근접 22·원거리/마법 20·회피 4, 목·쇄골 없음 |
| Bandai Namco Motion Dataset | CC BY-NC 4.0 | — | **사용 불가**(비상업) |
| Mixamo | 로그인 필요 | — | 제외 |

## 5. 막힌 것
유튜브(봇 확인, 우회 안 함) · Fandom HTML(Cloudflare, 공식 api.php 로 대체) · Wikimedia Commons 429 · CMU FAQ 503. TLS 검증·프록시는 그대로.
