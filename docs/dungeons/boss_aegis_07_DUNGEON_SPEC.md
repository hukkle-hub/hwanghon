# 에이지스-07 — Boss Dungeon Spec (소설 기반 초안, 자동 생성)

> 공식: Story → Boss Entry → Boss Arena → Boss Battle → Boss Result → Story. 잡몹 방 없음.
> 아래 «소설에서 온 것» 은 원문 사실. «게임 설계» 는 원문과 충돌하지 않게 채울 칸이며, 비어 있으면 TBD.

## 소설에서 온 것

| 필드 | 내용 |
|---|---|
| BossId | boss_aegis_07 |
| EpisodeId | EP06, EP07 |
| SceneRange | EP06_SC008, EP06_SC009, EP06_SC010, EP06_SC011, EP07_SC005, EP07_SC006, EP07_SC008, EP07_SC009, EP07_SC010 |
| NovelReasonForBattle | 여의도 안개 속에서 조우(지역③ 1/2). 놈은 정지해 배리어를 펼 뿐이고 아인이 먼저 들어간다. 명칭은 EP06 산문에 없고 EP07 L6806에서 '에이지스-07'로 나온다. / 여의도(지역③ 2/2) 재도전. 불가시 배리어의 쏠림을 이용해 등의 방열부를 노린다. |
| ArenaLocation | loc_yeouido_fog_canyon |
| PhasesInNovel | 등장·정지·배리어 전개, 아인의 낫 튕김(§7); 카인 반사 흡수(§8); 안개 속 분산·다리 휩쓸기(§9); 등 불꽃으로 배리어 끊김 → 다리 하나 절단 → 퇴각(§10); 카인 정면 연타 → 정면 두꺼워짐 → 아인 측면 → 등 열림, 그러나 뒤에 아무도 없음(§5-6); 류 합류 후 3인 배치: 정면 카인·측면 아인·류가 다리 밟고 올라 등에 얇은 날 두 개 동시 → 배리어 꺼짐(§8); 배리어 없음 = 네 번째 조건 충족, 아인의 한 번으로 격파(§9) |
| PatternsInNovel | 다각 보행, 옆에서 '쿵' 하고 나타남; 정지 후 불가시 배리어 전개(공기 일렁임) — 낫을 허공에서 튕겨냄; 상체 포문 개방·사격; 다리로 옆을 스침; 다리 하나 잃은 채 보정하며 절뚝이는 보행; 배리어가 가장 큰 위협 방향으로 쏠림(앞이 두꺼워지면 뒤가 얇아짐); 측면 위협에 상체가 돌아감 → 등이 열림; 돌아서기; 아인 쪽으로 팔을 듦 |
| PartBreak/Weakpoints | 4미터 다각 보행체, 상체가 통째로 무기; 어깨 수도방위사령부 마크; 상체 포문; 불가시 배리어(반사를 스펀지처럼 흡수); 등 — 불꽃이 튄 자리; 다리(하나 절단); 등 상부(손그림의 동그라미) — 배리어가 켜져 있을 때만 열림(열 배출); 소켓 단면(파편 수거 부위); 불가시 배리어(방향성, 출력 한계); 다리(전 화에서 하나 절단) |
| Break/Counter | 누군가가 등에 불꽃을 냄 → 배리어 일렁임 끊김 → 그 순간 낫이 걸려 다리 하나 절단; 정면 강타로 배리어를 앞으로 쏠리게 함; 측면 진입으로 상체를 돌려 등 개방; 류의 두 군데 동시 공격 → 등 불꽃, 배리어 꺼짐; 배리어 없는 반 박자에 낫 일격 → 붕괴 |
| EnvironmentInBattle | 짙은 안개(시야 약 20걸음); 빌딩 협곡 유리벽 반향 — 소리 방향 판별 불가; 젖은 아스팔트; 벽(오정길이 붙어 있음); 얕은 안개(무릎 위 트임, 약 50걸음 시야); 소리 방향 여전히 판별 불가; 빌딩 그림자 |
| Outcome | 패퇴 — 다리 하나를 끊었으나 놈은 무너지지 않음. 셋은 안개 속으로 이탈 / 격파 — 한 번의 일격으로 무너짐. 류가 코어 파편 셋을 챙겨 하나를 아인에게 줌 |
| Source | EP06 L6215-L6444, EP07 L6802-L7126 |

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
