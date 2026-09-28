# 아스널 오버로드 — Boss Dungeon Spec (소설 기반 초안, 자동 생성)

> 공식: Story → Boss Entry → Boss Arena → Boss Battle → Boss Result → Story. 잡몹 방 없음.
> 아래 «소설에서 온 것» 은 원문 사실. «게임 설계» 는 원문과 충돌하지 않게 채울 칸이며, 비어 있으면 TBD.

## 소설에서 온 것

| 필드 | 내용 |
|---|---|
| BossId | boss_arsenal_overlord |
| EpisodeId | EP21, EP22 |
| SceneRange | EP21_SC006, EP21_SC007, EP21_SC008, EP21_SC009, EP21_SC010, EP21_SC011, EP21_SC012, EP21_SC013, EP22_SC002, EP22_SC003, EP22_SC004, EP22_SC005, EP22_SC006, EP22_SC007, EP22_SC008, EP22_SC009, EP22_SC010 |
| NovelReasonForBattle | 계룡 지하 주 격납고 한가운데의 복합체. 세라가 이름을 대는 순간 포탑이 깨어나 일행을 조준·사출한다(격납고 출구는 등 뒤 하나). / EP21 진입 실패 후 재진입. 탑을 넘어야 격납고 안쪽(복도 문)으로 갈 수 있음. |
| ArenaLocation | loc_gyeryong_main_hangar |
| PhasesInNovel | EP21 조우전(P1로 표기): 18포탑 순차 각성 → 사출 → 엄폐물 소모 → 전탄 제압 → 부포탑 1기 파괴 후 퇴각(진입 실패); P1: 주포탑 선회 관절 1~3 파괴 — 원래 사격 박자(4·5·6초), 스물세 걸음 경로(L13027-L13046); P2: 세 번째 관절 파괴 후 간격 재배치(학습) — 관절 4~5 파괴(L13079-L13168); P3: 다섯 번째 관절 이후 출력이 코어로 몰려 과부하·붉은 코어, 여섯 번째 이후 눈먼 무작위 사격·천장 낙하 → 코어 일격(L13131-L13192) |
| PatternsInNovel | 응집 나노 덩어리 사출 — 콘크리트를 그릇처럼 파냄(L12671); 원형 탑: 18포탑이 서로 다른 방향, 어느 각도에서도 최소 3개가 조준 — 배후 사각 없음(L12689); 엄폐물(죽은 장갑차) 파괴: 1발 파임, 2발 관통, 3발 소멸(L12717); 전탄 제압: 전 포탑 정지·완전한 정적 후 18발을 한 지점에 동시 집중(L12745-L12755); 포탑별 사격 간격 4·5·6초 세 종류(안내인 종이, L12805-L12827); 18포탑(부포탑 1기 파괴 상태) 나노 사출, 포탑별 간격 4·5·6초; 사출과 재장전 사이의 골·사각이 겹치는 자리가 이동 경로(L13003); 탑 밑동 도달 시 주포탑 여섯이 일제히 아래로 꺾임(L13035); 재배치: 간격 3개가 바뀜(4→5, 6→4) — 종류(4·5·6)는 불변(L13083-L13123); 과부하: 출력이 코어로 몰려 폭발 예고, 시간은 원고상 미정(L13145-L13161); 눈먼 탑: 지향 없는 무작위 사출, 천장 콘크리트 낙하(L13173) |
| PartBreak/Weakpoints | 주포탑 6; 부포탑 12; 부포탑 급탄로 — 낫으로 그으면 다음 사출에서 자폭(L12777); 사격과 재장전 사이의 골(간격); 주포탑 선회 관절 ×6 — 포탑 밑동, 틈 손가락 두 마디, 장갑판이 못 덮는 자리, 직선(장검)만 들어감; 부포탑 사출구·급탄로 — 단검을 꽂으면 자폭; 코어 — 복합체 중앙, 갈라진 장갑 틈의 주먹만 한 코어, 높이 7m |
| Break/Counter | 부포탑 급탄로 절단 → 포탑 내부 폭발로 1기 파괴; 관절 파괴 → 해당 주포탑 조준 불능 → 사각 확대·경로 굵어짐; 부포탑 사출구 단검 → 자폭; 관절 6개 파괴 → 요새 기능 상실(눈먼 탑); 카인 장검 수평 발판 → 아인 공중 원 → 코어 절단(격파) |
| EnvironmentInBattle | 죽은 장갑차·자주포·견인 트레일러 엄폐물(소모성); 출구 하나(등 뒤); 초록 유도등 점선만의 어둠; 탑은 이동하지 않고 추격하지 않음(L12781); 세라 이동 결계(다섯 걸음마다 한 장, 한 장 3초); 류 두 겹 잔상 어그로; 천장 콘크리트 낙하(P3); 죽은 장갑차 엄폐물 |
| Outcome | 진입 실패. 부포탑 1기 파괴(18→17), 안내인 사망, 넷이 퇴각. / 격파. 열여덟 개의 눈이 위에서부터 꺼짐. 일행 생존(아인 목덜미 긁힘, 1시간 내 재생). |
| Source | EP21 L12626-L12796, EP22 L12939-L13224 |

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
