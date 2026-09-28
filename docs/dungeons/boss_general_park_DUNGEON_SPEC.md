# 박 준장 — Boss Dungeon Spec (소설 기반 초안, 자동 생성)

> 공식: Story → Boss Entry → Boss Arena → Boss Battle → Boss Result → Story. 잡몹 방 없음.
> 아래 «소설에서 온 것» 은 원문 사실. «게임 설계» 는 원문과 충돌하지 않게 채울 칸이며, 비어 있으면 TBD.

## 소설에서 온 것

| 필드 | 내용 |
|---|---|
| BossId | boss_general_park |
| EpisodeId | EP22, EP23 |
| SceneRange | EP22_SC012, EP22_SC013, EP23_SC001, EP23_SC002 |
| NovelReasonForBattle | 각인 표본 보관실로 통하는 복도 끝 마지막 문의 문지기로 세워져 있음. 경례 후 공격 개시. / 각인 표본 보관실 강화문의 문지기. EP22 말미 경례 후 공격 개시. |
| ArenaLocation | loc_gyeryong_sterile_corridor |
| PhasesInNovel | 등장(EP22): 부동자세 → 경례 → 변형(팔 두 배, 등줄기 결정 창) — 본전투는 EP23; P1: 읽기·카운터 우세 — 다섯 합에 카인 어깨 부상, 여덟 합에 류 잔상 간파(L13322-L13347); P2: 소등/점등 페인트 — 세라가 아인 출력 소등, 카인 최대 출력 미끼, 아인 무출력 사각 베기, 재점등 두 번째 원으로 결착(L13348-L13373) |
| PatternsInNovel | 공격 전 경례(L13271-L13279); 출력이 실리는 순간의 코어 발화를 읽어 반보 물러남(L13326, L13332); 류 잔상 중 진짜 쪽으로 몸을 틂; 원의 끝자락 도착 지점에 팔을 세워 카운터(L13326); 지치지 않음, 사람의 검술(L13332-L13334) |
| PartBreak/Weakpoints | 목덜미 결정(L13251); 목덜미 결정(L13360); 카운터 자세로 굳은 순간(읽은 미래에 몸을 전부 건 자세, L13356) |
| Break/Counter | 출력을 끈 아인은 읽히지 않음 → 사각 진입 얕은 베기 → 자세 붕괴(반 박자) → 재점등 두 번째 원으로 끊음 |
| EnvironmentInBattle | 좁은 복도(병원 냄새, 관측창); 좁은 복도 — 원을 그릴 반경이 늘 반 뼘 모자람(L13334); 세라 결계 뒤 엄폐 |
| Outcome | EP23에서 결착. / 격파. 무릎을 꿇고 오른손이 경례 각도로 반쯤 오르다 바닥에 떨어짐. |
| Source | EP22 L13243-L13307, EP23 L13322-L13373 |

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
