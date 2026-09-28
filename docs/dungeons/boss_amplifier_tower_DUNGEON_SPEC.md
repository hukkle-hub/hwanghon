# 발사대 탑 (증폭기) — Boss Dungeon Spec (소설 기반 초안, 자동 생성)

> 공식: Story → Boss Entry → Boss Arena → Boss Battle → Boss Result → Story. 잡몹 방 없음.
> 아래 «소설에서 온 것» 은 원문 사실. «게임 설계» 는 원문과 충돌하지 않게 채울 칸이며, 비어 있으면 TBD.

## 소설에서 온 것

| 필드 | 내용 |
|---|---|
| BossId | boss_amplifier_tower |
| EpisodeId | EP28 |
| SceneRange | EP28_SC001, EP28_SC002, EP28_SC003 |
| NovelReasonForBattle | 「이 년의 마지막 적은, 괴물이 아니라 탑이었다」 — 다 익은 코어 넷(송신원)의 신호를 하늘까지 쏘아 올리는 증폭기. 멀어지는 것으로는 막을 수 없어 탑을 부순다. |
| ArenaLocation | loc_balsadae_tap |
| PhasesInNovel | 단일 국면: 구조 판독 → 결정 신경(케이블) 차단 → 응력점 전사 → 첫 주각 지렛대 → 두 번째 주각 단일 타격 → 바다 쪽 붕괴 |
| PatternsInNovel | 목덜미로 듣는 노래 — 박자를 맞출 때마다 그래프가 한 눈금씩 자람(시간 압박); 탑 자체의 능동 공격은 원고에 없음 |
| PartBreak/Weakpoints | 주각 넷(같은 쪽 둘을 끊으면 자중으로 바다 쪽 전도); 결정이 신경처럼 오른 케이블 다발의 소켓; 주각 이음매의 응력점(촉매로 드러남) |
| Break/Counter | 류의 소켓 절단 → 주각 결정이 빛을 잃고 순수한 쇠로; 세라의 서명 전사 → 응력점 발광; 카인의 모루 지렛대(첫 주각); 아인의 가장 큰 원 한 번(두 번째 주각) |
| EnvironmentInBattle | 새벽의 발사장; 트러스·케이블(낫을 걸어 수직 등반); 바다 쪽으로 기우는 구조 |
| Outcome | 탑이 바다 쪽으로 넘어가 물속으로 무너지고 노래가 끊김. 그러나 그래프는 멈추지 않고 느려졌을 뿐. |
| Source | EP28 L14986-L15060 |

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
