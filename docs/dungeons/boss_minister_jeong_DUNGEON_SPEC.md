# 정 장관 — Boss Dungeon Spec (소설 기반 초안, 자동 생성)

> 공식: Story → Boss Entry → Boss Arena → Boss Battle → Boss Result → Story. 잡몹 방 없음.
> 아래 «소설에서 온 것» 은 원문 사실. «게임 설계» 는 원문과 충돌하지 않게 채울 칸이며, 비어 있으면 TBD.

## 소설에서 온 것

| 필드 | 내용 |
|---|---|
| BossId | boss_minister_jeong |
| EpisodeId | EP25, EP26 |
| SceneRange | EP25_SC008, EP26_SC001, EP26_SC002, EP26_SC003, EP26_SC004, EP26_SC005, EP26_SC006 |
| NovelReasonForBattle | 발사장에 도착한 일행을 향해 의장대가 갈라지고 이 나라의 마지막 국방장관이 성숙한 집행관으로 걸어옴(EP25는 등장만, 전투는 EP26). / 발사장에 도착한 일행 앞에 의장대가 갈라지고 정 장관이었던 것이 「미확인 인원 다섯. 신원 대조」 명령 후 군도를 뽑아 공격. 발사대·갱도로 가는 길을 막는 최후의 지휘관. |
| ArenaLocation | loc_balsajang_doro |
| PhasesInNovel | EP25: 등장만 — 전투 없음; 지휘관: 의장대 군단을 몸처럼 부림 — 세라의 가짜 명령으로 좌익 교란(§2); 검과 낫: 결계 파쇄·배후 공격 쳐냄·아인과 같은 원, 아인 어깨 부상(§3~4); 외운 원: 카인 3합 방어·남은 의장대 이탈·왼팔 관절 봉인 중 아인이 원을 외워 네 번째 원을 받아넘기고 목덜미 타격(§5) |
| PatternsInNovel | 의장대 전체를 일제히 움직임(고개 돌림, 대열 갈라짐); 군도 휘두름 → 의장대 열 이동; 왼손 각도 → 클레이브 셋이 그 각도로 돌입; 고개를 반쯤 돌림 → 점거 차량이 도로 차단; 결계를 세 합 만에 가르는 연속 참격; 보지 않고 배후를 쳐냄; 아인과 같은 원 참격 — 더 크고 빠르며 매번 완전히 동일(변주 없음); 명령 계통을 어지럽히는 자(세라)를 우선 표적화 |
| PartBreak/Weakpoints | 목덜미 결정(최종 타격점); 왼팔 관절 소켓(류가 봉인); 코어 서명 명령 채널(세라가 복제 가능) |
| Break/Counter | 세라의 가짜 명령 → 좌익이 제 그림자와 싸움, 이후 남은 절반을 반대편 활주로로 몰아냄; 류의 배후 소켓 공략 → 왼팔 관절 봉인; 세 번 동일한 원 관찰 후 네 번째 원의 궤적 끝자락(원심이 다 실리기 직전)에서 받아넘김 → 젖혀진 목덜미에 낫 끝자락 1/4 |
| EnvironmentInBattle | 의장대 도열; 점거 차량 열; 의장대 도열·클레이브·점거 차량; 활주로(반대편 활주로로 대열 이탈); 석양과 두 그림자를 비추는 벽 |
| Outcome | EP26에서 전투 — 이 화는 등장 클리프행어로 끝남 / 목의 결정이 갈라진 채 군도를 짚고 부동자세로 「…미안—」을 끝맺지 못하고 빛을 잃음. 의장대 전체 정지. |
| Source | EP25 L14214-L14234, EP26 L14271-L14432 |

## 게임 설계 (TBD — 원문 근거를 달아 채운다)

| 필드 | 값 |
|---|---|
| ArenaBeforeBattle | TBD |
| ArenaPhase1 | TBD |
| ArenaPhase2 | TBD |
| ArenaPhase3 | TBD |
| ArenaAfterBattle | TBD |
| PlayerCharacter | TBD |
| SupportingCharacters | TBD |
| Phase1Patterns | TBD |
| Phase2Patterns | TBD |
| Phase3Patterns | TBD |
| BreakRules | TBD |
| CounterRules | TBD |
| PartBreakRules | TBD |
| StoryMechanics | TBD |
| EnvironmentalMechanics | TBD |
| BossEntryCinematic | TBD |
| PhaseTransitionCinematics | TBD |
| BossDeathCinematic | TBD |
| PostBattleScene | TBD |
| AnimationAssets | TBD |
| AudioAssets | TBD |
| VFXAssets | TBD |
| RequiredStoryFlags | TBD |
