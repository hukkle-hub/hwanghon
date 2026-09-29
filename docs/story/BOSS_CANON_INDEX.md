# 황혼 제1부 보스 캐논 인덱스 — 소설 × 디자인 시트

- **원문**: `docs/story/source/`(통합본 EP02–28, 마감본 EP01)
- **시트**:
  - `docs/story/source/design/bosses/turnaround/`: 2026-09-28 디렉터가 보낸 턴어라운드 16 장
  - `docs/story/source/design/bosses/ueintro_sheets/`: UEIntroProject `Content/Twilight/UI/BossArt` 11 장
- **카탈로그**: UEIntroProject `Source/UEIntroProject/HwanghonBossData.cpp`(보스 12 종)
- 디렉터 지시에 따라 **소설 보스는 전부 게임 전투로 구현한다.** 등장마다 그 보스의 던전(Story → Boss Entry → Arena → Battle → Result → Story)을 만든다.
- 원문 결말(후퇴·가둠·미격파)은 그대로 전투의 결말이 된다.

## 1. 보스 12 체 — 원문 등장 순

| # | 보스(원문 이름) | BossId | 등장(던전) | 원문 결말 | 턴어라운드 | UEIntro 시트 | 카탈로그 |
|---|---|---|---|---|---|---|---|
| 1 | 훈련용 짚단 허수아비(각성체) | `boss_training_heosuabi` | EP01 지하 훈련장 | 관절 절단·결정 회수, 가루 | `training_heosuabi.jpg` | Scarecrow | TestBoss |
| 2 | 클레이브 | `boss_clave` | EP02 지하상가 중앙 광장(조우·퇴각) · EP03 광장 → 2호선 침수 선로(격파) | 패퇴 → 격파 | `clave.jpg`(셔터 방패 — 원문 «셔터를 방패·곤봉으로») | Clave | Cleave |
| 3 | 셀레스티얼(하늘의 왕) | `boss_celestial` | EP04 남산 케이블카 승강장·전망대(이길 수 없음·후퇴) · EP05 부재 · **EP17 골짜기(격파)** | 미격파 → 격파 | `celestial.jpg` | Celestial | Celestial |
| 4 | 에이지스-07 | `boss_aegis_07` | EP06 여의도 금융가 빌딩 협곡(다리 절단·이탈) · EP07 같은 곳(격파) | 패퇴 → 격파 | `aegis_07_sheet.jpg` | Aegis07 | Aegis07 |
| 5 | 레비아탄 | `boss_leviathan` | EP08 한강 침수 터널(아가미 절단·물러남) · EP09 터널·수문(**가둠**) | 미격파 → 봉쇄 | `leviathan.jpg` | Leviathan(«레비아탄 나노») | LeviathanNano |
| 6 | 실험체 09호 | `boss_subject_09` | EP14 판교 연구단지 지하(세 번 격파해도 재생) · EP15 로비(격파) | 재생 → 격파 | `subject_09.jpg` | Subject09 | Subject09 |
| 7 | 섀도우 팽(괴물을 먹는 괴물) | `boss_shadow_fang` | EP16 물류창고 앞마당(무음의 전장) · EP17 골짜기(격파) | 지속 → 격파 | `shadow_fang.jpg` | ShadowFang | ShadowFang |
| 8 | 아스널 오버로드 | `boss_arsenal_overlord` | EP21 계룡 주 격납고(부포탑 1 기 파괴·퇴각) · EP22 같은 곳(격파) | 진입 실패 → 격파 | `arsenal_overlord.jpg` · 부포탑 후보 `arsenal_subturret_candidate.jpg` | Arsenal | ArsenalOverlord |
| 9 | 박 준장(문지기) | `boss_general_park` | EP22 소독약 냄새 복도(소개) · EP23 각인 표본 보관실(격파) | 격파(경례) | **없음** | GeneralPark | GeneralPark |
| 10 | 정 장관(정 장관이었던 것) | `boss_minister_jeong` | EP25 발사장(등장) · EP26 발사장 도로·활주로(격파) | 격파(부동자세) | 후보 `minister_jeong_candidate.jpg` — **TBD_CANON**. 원문은 군도·의장대 지휘, 시트에 군도 없음 | **없음** | MinisterJeong |
| 11 | 나노-노바 코어(결정의 산·차한별) | `boss_nano_nova_core` | EP27 발사대 아래 지하(격파) | 코어 소등, 위의 목소리 물러남 | **없음** — 원문으로 새로 그린다(docs/design/156) | NanoNovaCore — **탑 그림이다(아래)** | NanoNovaCore |
| 12 | 발사대 탑(증폭기) | `boss_amplifier_tower` | EP28 고흥 발사장 지상(파괴) — 원문 «이 년의 마지막 적은, 괴물이 아니라 탑이었다» | 넘어감, 노래 끊김 | `amplifier_tower.jpg` | NanoNovaCore 그림(같은 탑) | NanoNovaCore 2 페이즈 «증폭 탑 앵커» → **별도 보스로 확정(2026-09-29)** |

- 통합본 머리말의 «보스 11체»와 12 체가 맞지 않는다.
  - 허수아비를 튜토리얼로 빼면 11 이다(TBD_CANON).
- **나노-노바 코어 ≠ 증폭 탑 (디렉터 결정 2026-09-29 «나눠서 하자. 문맥에 맞게 만들어»).**
  UEIntroProject(GPT 킷 v3.0 §19.14)는 EP27·EP28 을 한 보스로 합쳐 탑 그림(`T_BossArt_NanoNovaCore` = `amplifier_tower.jpg` 와 같은 디자인)에
  나노-노바 이름을 붙였다. 원문대로 둘로 나눈다 — 탑 그림은 EP28 증폭 탑, EP27 나노-노바는 원문의 «결정의 산»으로 새로 디자인한다.
  GPT 설계의 «링 노드 동시 차단»은 탑전으로, «심장이 멎어도 신호가 남는다»는 EP27 끝 → EP28 시작 연결로 옮긴다.
  - 디렉터 지시(«소설 속 모든 보스는 전투»)에 따라 **던전은 12 개 보스 모두 만든다.**

## 2. 시트는 있는데 1부 원문에 없는 것

| 시트 | 내용 | 판정 |
|---|---|---|
| 아이언 워든 — 턴어라운드·시트(가면·코트·검) | 카탈로그는 «여의도 장갑 보스, 무한궤도 돌격체» 라 시트와도 다르다 | **1부 원문 등장 없음 — TBD_CANON**. 본편 던전을 만들지 않는다 |
| 전차 턴어라운드 `tank_unassigned.jpg` | 원문에 전차·탱크·무한궤도 보스 없음 | 카탈로그 아이언 워든(무한궤도)과 닮았다 — TBD_CANON |
| 이 중장 — 턴어라운드·시트(가면·조끼 핵, 지휘장) | 카탈로그 «최종 방어선» SS | **1부 원문 등장 없음(«중장» 0 회) — TBD_CANON**. 2 부 보호 구역일 수 있다 |

## 3. 원문 비보스 전투 (게임 표현 TBD)

«보스만 싸운다» 원칙과 원문이 부딪히는 곳이다. 원문에 있으니 빼지 않는다. 표현 방식(컷신/짧은 연출 전투)은 디렉터 결정이다.

- EP02 쇼윈도 리퍼, 광장의 2 m 감염체
- EP05 케이블카 드로퍼 4 체(EP04 제목의 그것)
- EP08 감염된 현 중위
- EP10 클레이브 둘
- EP11 방호복 병사·클레이브
- EP18 벙커 습격(방호복 인원·군 표식 집행관)
- EP21 정비창 기계들
