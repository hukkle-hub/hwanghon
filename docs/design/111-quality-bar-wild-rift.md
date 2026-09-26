# 111. 품질 기준선 — 「와일드리프트 급」 으로 본 전투 시스템·전체 평가 (2026-09-27)

디렉터 지시: 「lol 와일드리프트인데 최상의 퀄리티가 아니면 이것도 괜찮아. 전투시스템이랑 전체적으로 보고 평가. 사진 외에도 유튜브나 타 엔진 자료 수집」.

디렉터가 준 와일드리프트 화면 7장(금고·로드아웃·수집/패스·순위표·라인 선택·챔피언 선택·로딩 카드)은 저작권 자료라 저장소 밖(작업 폴더 `wr/`)에만 둔다. 이 문서는 그 화면에서 읽은 관례와, 아래 공개 출처를 근거로 쓴다. 출처가 없는 수치는 「근거 없음」 으로 표시.

## 0. 결론 먼저

- **「와일드리프트 급」 은 장르가 아니라 완성도의 기준선이다.** 와일드리프트는 탑뷰 MOBA, 우리는 3인칭 보스전 액션 RPG라 조작·카메라를 그대로 베낄 수 없다. 대신 그 게임이 «상용 모바일 급» 으로 인정받는 이유 네 가지를 기준선으로 삼는다: ① 폰에서 프레임이 안 흔들린다(60 fps 기본, 기기 따라 90/120), ② 한눈에 읽힌다(이펙트·표식·HUD 가 정보 위계를 지킨다), ③ 조작이 기기에 맞게 다시 설계됐다(락온·타깃 우선순위·자유 조준), ④ 전투 밖 화면(로비·장비·수집·순위·로딩)이 «게임처럼» 완결돼 있다.
- **우리 위치(2026-09-27 main d6cf735):** 전투 규칙·연출·HUD 는 «근접» — 히트스톱 계층, 회피 무적 0.30 s, 자세/부위 파괴, 처형·궁극기 L2 컷, GPT HUD v09 까지 들어와 정보 위계는 갖춰졌다. **미달은 두 군데다: (a) 실기 프레임 — 폰에서 60 fps 를 지키는지 아직 한 번도 재지 못했다(근거 없음), (b) 전투 밖 화면 — 로드아웃 프리셋·수집·순위표·로딩 카드·소모품 슬롯이 없다.** 아트(서한역 배경·보스 모델·VFX 밀도)는 «미달이지만 방향은 맞음».
- **순서 제안:** ① 실기 프레임 측정(디렉터 폰, `frame-metrics` 이미 있음) → 예산 초과분 정리 ② 전투 읽기 마무리(사거리 원 하한, 소모품 슬롯 — GPT) ③ 로드아웃 프리셋·로딩 카드·순위표(GPT UI) ④ 서한역 배경·보스 모델·VFX(나).

## 1. 와일드리프트가 «그 급» 인 이유 — 출처로 확인한 사실

| 항목 | 사실 | 출처 |
|---|---|---|
| 엔진·플랫폼 | Unity, Android/iOS/iPadOS. 2020-10-27 출시, 메타크리틱 89/100 | [Wikipedia](https://en.wikipedia.org/wiki/League_of_Legends:_Wild_Rift) |
| 프레임 | 설정에서 60/90/120 fps 선택. 패치 2.2 부터 120 fps 지원. 최저 설정이면 대부분의 현행 폰에서 «부드럽게», 고/최고 설정은 중급기 필요 | [Notebookcheck 벤치](https://www.notebookcheck.net/League-of-Legends-Wild-Rift-Android-benchmarks-and-iOS-benchmarks.517115.0.html) · [Sportskeeda 설정](https://www.sportskeeda.com/esports/best-league-legends-wild-rift-settings-win-matches) |
| 세션 길이 | PC 30~45 분 → 모바일 15~20 분. 지도 축소, 레벨 캡 18→15, 넥서스 포탑 제거, 골드 획득 가속, 재생 시간 절반 | [Wikipedia](https://en.wikipedia.org/wiki/League_of_Legends:_Wild_Rift) · [GameRant 15가지 차이](https://gamerant.com/league-legends-wild-rift-pc-vs-mobile/) · [TheGamer](https://www.thegamer.com/lol-wild-rift-mobile-vs-pc/) |
| 조작 재설계 | 가상 스틱(왼) + 스킬 버튼(오른). 마우스가 없으니 **락온**(기본 공격·스킬이 잠근 대상에만), **타깃 우선순위**(체력 낮은 순 등), **초상 잠금**(혼전에서 초상 눌러 대상 고정), 포인트 클릭 스킬 → 자유 조준 스킬샷, 궁극기 5 레벨 해금, «이동 방향으로 대시» 옵션 | [Naavik — MOBA 를 모바일로 옮긴 법](https://naavik.co/f2p-mobile/wild-rift-adapting-moba/) · [Dot Esports 설정](https://dotesports.com/mobile/news/the-best-wild-rift-gameplay-settings-for-mobile-devices) · [WildRiftMeta 조작·카메라](https://www.wildriftmeta.com/status/controls-camera-settings/) · [PlayerAssist 타깃 우선순위](https://playerassist.com/league-legends-wild-rift-change-targeting-priority-target-lock-filtering/) |
| 카메라 | 수동 카메라를 없애고, 원하면 «세미 락» 으로 우상단 보조 스틱만 | [Naavik](https://naavik.co/f2p-mobile/wild-rift-adapting-moba/) · [WildRiftMeta](https://www.wildriftmeta.com/status/controls-camera-settings/) |
| 설계 기둥 | «접근성과 편의» 두 기둥. 손재주가 아니라 판단이 실력이 되게 | [Naavik](https://naavik.co/f2p-mobile/wild-rift-adapting-moba/) · [Android Police 핸즈온](https://www.androidpolice.com/2021/03/28/hands-on-league-of-legends-wild-rift-android/) |
| VFX 원칙 (LoL 스타일 가이드) | ① 읽기 우선 — 1차·2차 형태만, 잡음 제거 ② 중요도에 비례한 크기 ③ 순흑·순백 피하고 중간 명도 ④ 빛으로 힘·방향·지속을 알린다 ⑤ 채도 0%·100% 피함 ⑥ 주색 하나, 나머지는 채도 낮춤 ⑦ 손으로 그린 형태 ⑧ 이동에 모션 블러 ⑨ 예비 → 순간 → 여운 ⑩ 짧게 — 오래 남는 이펙트는 전투를 흐린다 | [VFX Apprentice — LoL VFX 가이드 10항](https://www.vfxapprentice.com/blog/10-league-of-legends-vfx-design-tips) |
| 애니메이션 원칙 | 과장된 포즈·단순화한 동작·뚜렷한 실루엣, VFX 와 동기 — «헷갈리는 애니메이션은 실패» | [Riot 애니 기법 정리](https://yelzkizi.org/riot-games-animation-techniques-workflow-tools-style/) · [Riot 채용 — Wild Rift VFX 리드(«만족감과 명료함의 균형»)](https://www.riotgames.com/en/work-with-us/job/4522432/vfx-art-lead-wild-rift-los-angeles-usa) |
| 전투 밖 화면 | 로드아웃(아이템·룬·스펠 프리셋), 금고(보상·상자), 4.2 에서 UI 를 미니멀로 재편, 개인화·이모트를 «인게임 커스터마이즈» 탭으로 통합 | [ONE Esports 클라이언트 안내](https://www.oneesports.gg/wild-rift/wild-rift-beginners-guide-everything-you-need-to-know-about-the-client/) · [LoL Wiki V4.2](https://leagueoflegends.fandom.com/wiki/V4.2_(Wild_Rift)) · [Interface In Game 화면 모음](https://interfaceingame.com/games/league-of-legends-wild-rift/) |

디렉터가 준 7 장에서 읽은 UI 관례(저장소 밖 자료라 그림은 없음):
- **금고/인벤토리** — 정사각 격자, 희귀도 테두리, 우측 상세 패널. 우리 `inventory.html` 과 같은 골격.
- **로드아웃** — 프리셋 3 개를 탭으로, 아이템·룬·스펠을 한 화면에. 우리는 캐릭터별 장비 1 세트만.
- **수집/패스** — 진행 막대 + 단계별 보상 카드. 우리에게 없음.
- **순위표** — 초상·티어·점수 목록. 우리에게 없음.
- **라인 선택** — 지도 위에 역할 아이콘. 우리는 파티 모집에서 «역할» 이 글자뿐.
- **챔피언 선택** — 5 인 라인업 + 로딩 카드(초상·스킨·칭호). 우리 파티 카드는 초상만.

## 2. 우리 현황 — 코드·실측으로 본 것

| 영역 | 지금 (main d6cf735) | 근거 |
|---|---|---|
| 전투 규칙 | 4 캐릭터(아인·카인·류·세라), 약공 4 연·스매시, 회피 무적 0.30 s(완벽 회피 0.14 s), 히트스톱 계층 0.09~0.38 s, 자세 100/붕괴 40/다운 5 s, 부위 파괴, 처형, 페이즈 전환 | `js/dungeons.js` 109·138 행, 문서 50 |
| 보스전 | d01 훈련장 허수아비 ~ d07 폐병원 소생기, 보스별 연계·지연타 데이터 | `js/dungeon.js`, `js/*-boss.js` |
| 연출 | 연출 감독 L1(흘림·튕김·맞대기·완벽 회피·연계 마무리) · L2(처형·궁극기·자세 붕괴 컷) · L3(등장·페이즈·승리), 예산 8%/20 s | `js/cine-director.js`, 문서 103 |
| HUD | GPT v02~v09: 보스 바·자세·부위 줄·피해 숫자 밀도 제한·카운터 배너·처형 표식·락온·월드 표식 위계 | 문서 103~110 |
| 카메라 | 3 인칭 추적 + 락온, 벽 슬라이드, 붙음 15~25 %, FOV -4° | 문서 22·103 |
| 그래픽 등급 | low/medium/high: 픽셀비 0.9/1.25/2, 픽셀 상한 100/180/320 만, 그림자 0/1024/2048. 모바일 기본 medium, 프레임 낮으면 자동 low(블룸 끔) | `js/graphics-profile.js`, `js/game3d.js` 165·260 행 |
| 프레임 계측 | rAF 간격 히스토그램·60 s 창·50 ms 초과 수(기기 추정 안 함) — **폰 실측치는 아직 없음(근거 없음)** | `js/frame-metrics.js` |
| 드로우콜 (전투 중, 헤드리스) | PC 1280×720: **93 콜 / 55.9 만 삼각형** · 모바일 915×412: **96 콜 / 55.9 만 삼각형** (그림자 패스 포함 한 프레임 평균 · 장면 자체는 30.5 만 삼각형, 조명 16(PC)/12(모바일), 그림자 드리우는 메시 39, 스킨 메시 3). swiftshader 라 시간은 못 잼. three.js 모바일 권장치(콜 50 이하·정점 10 만 이하, §4)와 견주면 콜 약 2 배·삼각형 약 5 배 | 작업 폴더 `perfprobe.mjs` |
| 온라인 | Supabase Realtime 파티 로비 + 호스트 권위 코옵 | 문서 (파티 온라인) |
| 전투 밖 화면 | 인력사무실·의뢰·파티·모집·장비·강화·제작·상점·기술·외형·프로필·결과·스토리·캐릭터 시트·타이틀 | `*.html` |

## 3. 서브시스템별 판정

판정: **도달** = 와일드리프트 급 완성도 · **근접** = 항목은 있고 마감만 남음 · **미달** = 없거나 핵심이 빠짐.

| 서브시스템 | «와일드리프트 급» 이 뜻하는 것 | 우리 | 판정 | 격차 · 담당 |
|---|---|---|---|---|
| 전투 감각 (타격·경직·회피) | 입력 → 반응이 한 프레임 안, 타격마다 무게가 다름 | 히트스톱 계층·방향 흔들림·타격 벡터 파티클·접점 감속·무기별 리듬 | **근접** | 폰 실측 없이는 «한 프레임 안» 을 못 말한다. → 프레임 측정 먼저 (나) |
| 전투 읽기 (표식·이펙트 위계) | 1차·2차 형태만, 중요도에 비례, 짧게 | v09 로 부위 링·락온·바닥 범위 낮춤. 사거리 원 0.035 는 붉은 바닥에서 안 보임(문서 103 §1-8) | **근접** | 사거리 원 하한 0.06~0.08(근거 없음 — 육안), 스킬 VFX 지속 시간 재점검 (GPT 표식·나 VFX) |
| 조작 (모바일) | 스틱 + 버튼, 락온·타깃 우선순위·초상 잠금, 대시 방향 옵션 | 스틱 + 버튼, 락온, Q 부위 전환, 카운터 탭 방향 분기 | **근접** | «타깃 우선순위» 에 해당하는 «부위 우선순위(약점 우선)» 설정 없음, 소모품 슬롯 없음 → GPT |
| 카메라 | 수동 카메라 제거 + 보조 스틱 | 자동 추적 + 락온 + 드래그 | **도달** (장르 차이) | 폰에서 붙음 17 % 멀미 확인 남음 (나) |
| 연출 | 궁극기·킬에 짧은 강조, 조작 안 뺏음 | L1 조작 유지, L2 1.1~1.7 s 무적, 예산 8 % | **도달** | — |
| HUD | 미니멀, 정보 위계, 모바일 별도 배치 | v09 까지. 모바일 카운터 배너가 근접 시 보스 머리와 겹침 | **근접** | 배너 위치(GPT) |
| 그래픽·아트 | 실루엣이 뚜렷하고 배경이 전투를 방해하지 않음. 최상 아니어도 «일관» | d01 지하철 개조 공간은 있으나 목표 그림(서한역 표지·열차·낙서·잔해) 미구현, 보스는 허수아비 임시 모델 | **미달** | 서한역 배경 → 보스 모델 → VFX 밀도 (나, 문서 103 목표 그림 항목) |
| 성능 | 60 fps 기본, 기기별 90/120, 저사양 «부드럽게» | 등급 3 단계 + 자동 하향 + 계측기 있음. **폰 수치 없음** | **미달 (측정 전)** | 디렉터 폰에서 `frame-metrics` 60 s 창 값 받기 → 드로우콜·그림자·블룸 순으로 정리 (나) |
| 세션 구조 | 15~20 분 매치, 다운타임 제거 | 보스전 1 회 = 수 분, 던전 7 개 | **도달** (구조는 이미 짧음) | 재도전·다음 던전 흐름이 결과 화면에서 한 번에 이어지는지 확인 (GPT) |
| 전투 밖 화면 | 로드아웃 프리셋·금고·수집/패스·순위표·라인 선택·로딩 카드 | 장비·제작·상점·기술·외형·프로필은 있음. 프리셋·수집·순위표·로딩 카드 없음 | **미달** | GPT UI: 로드아웃 프리셋(3) → 로딩 카드(파티 4 인) → 순위표(온라인 기록) → 수집/패스는 보류(운영 요소) |
| 온라인 | 매치메이킹·랭크·강등 보호 | 방 코드 파티 코옵 | **미달** (범위 밖) | 지금 목표 아님 — 기록만 |

## 4. 수집한 유튜브·타 엔진 자료 — 무엇을 가져올지

| 자료 | 종류 | 가져올 것 |
|---|---|---|
| [Vindictus: Defying Fate — 22 분 4K 알파 플레이](https://www.youtube.com/watch?v=hXgiEitF3NQ) · [전 클래스 쇼케이스](https://www.youtube.com/watch?v=HgIATe8nFOA) · [전투 업데이트 해설](https://www.youtube.com/watch?v=p2KmQ0ervN0) | UE5 · 던전형 액션 RPG(우리와 같은 구조) | 보스 한 마리 대 소수 플레이어의 카메라 거리·타격 정지 길이·처형 컷 길이를 프레임 단위로 재서 문서 50 표에 추가. 우리 장르의 «최상» 기준 |
| [Wuthering Waves (UE4, Android/iOS 포함)](https://en.wikipedia.org/wiki/Wuthering_Waves) | 모바일에서 60 fps 를 내는 3D 액션 | 모바일 그래픽 등급표(그림자·해상도·이펙트 단계)의 설계 — 우리 3 단계와 비교 |
| [Unreal ARPG 샘플 (UE 4.20, 모바일 고사양 목적)](https://apps.apple.com/jp/app/id1411473790) | 엔진 공식 샘플 | 어빌리티 시스템 구조·모바일 드로우콜 예산 |
| [Unity URP 3D 샘플](https://unity.com/demos/urp-3d-sample) · [80.lv 해설](https://80.lv/articles/master-universal-render-pipeline-with-unity-s-new-urp-3d-sample) | 엔진 공식 샘플 | «모바일에서 확장되는 환경» 한 장면의 조명·후처리 구성(포워드+, 데칼, 볼륨) — 우리 d01 조명에 참고 |
| [three.js 100 팁 (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips) · [모바일 최적화](https://digitalstrategyforce.com/journal/how-do-you-optimize-threejs-performance-for-mobile-devices/) · [60 fps 패턴](https://www.intelligentgraphicandcode.com/development/threejs-interfaces/performance) | 우리 엔진 | 모바일 드로우콜 «50 이하», 정점 «10 만 이하» 권장, 5~10 분 지속 부하 뒤 발열 하향을 실기에서 재야 함(지속 테스트) |
| [LoL VFX 가이드 10항](https://www.vfxapprentice.com/blog/10-league-of-legends-vfx-design-tips) | 스타일 가이드 | §1 표의 ①②⑨⑩ 을 우리 스킬 VFX 검수 항목으로 |
| [Blade & Soul 2 (UE4, 모바일)](https://www.mmorpg.com/blade-and-soul-2) · [Black Desert Mobile](https://en.wikipedia.org/wiki/Black_Desert_Online) | 국내 모바일 액션 | 한국 시장의 «모바일 액션» 기대치. 히트스톱·카메라 흔들림 수치 자료는 못 찾음(근거 없음) |

## 5. 다음 손질 순서 (담당 표시)

1. **폰 실측 (나)** — 디렉터 폰에서 d01 전투 60 s 창의 평균·최대·50 ms 초과 수를 받는다(`frame-metrics`). 60 fps 못 지키면 §2 실측 기준으로 줄인다: 그림자 드리우는 메시 39 → 캐릭터·보스만(그림자 패스가 삼각형을 두 배로 만든다), 조명 12~16 → 주광 + 보조 2~3, 소품 병합(콜 96 → 50 대), 블룸은 마지막. 이게 «와일드리프트 급» 의 첫 관문이다.
2. **전투 읽기 마감** — 사거리 원 하한(GPT v10 요청), 소모품 슬롯 Z/X(GPT, 목표 그림 항목), 모바일 카운터 배너 위치(GPT).
3. **전투 밖 화면 (GPT)** — 로드아웃 프리셋 3 → 로딩 카드 → 순위표.
4. **아트 (나)** — 서한역 배경(표지·열차·낙서·출구·잔해) → 허수아비 대체 보스 모델 → 스킬 VFX 를 LoL 가이드 ①②⑨⑩ 으로 재검수.
5. **Vindictus 프레임 계측 (나)** — 위 영상 3 편에서 카메라 거리·타격 정지·처형 길이를 재서 문서 50 표에 추가.

## 6. 근거 없음 목록

- 우리 게임의 폰 프레임(어떤 기기든) — 측정 전.
- 사거리 원 «0.06~0.08 이 하한» — 캡처 육안.
- Blade & Soul 2·Black Desert Mobile 의 히트스톱·카메라 수치 — 자료 못 찾음.
- 와일드리프트 화면 7 장의 세부 치수 — 저작권 자료라 문서에 싣지 않음. 관례만 글로 옮김.
