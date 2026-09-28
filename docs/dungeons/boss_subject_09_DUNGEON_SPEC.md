# 실험체 09호 — Boss Dungeon Spec (소설 기반 초안, 자동 생성)

> 공식: Story → Boss Entry → Boss Arena → Boss Battle → Boss Result → Story. 잡몹 방 없음.
> 아래 «소설에서 온 것» 은 원문 사실. «게임 설계» 는 원문과 충돌하지 않게 채울 칸이며, 비어 있으면 TBD.

## 소설에서 온 것

| 필드 | 내용 |
|---|---|
| BossId | boss_subject_09 |
| EpisodeId | EP14, EP15 |
| SceneRange | EP14_SC004, EP14_SC005, EP14_SC006, EP14_SC007, EP14_SC008, EP14_SC009, EP14_SC010, EP14_SC011, EP15_SC003, EP15_SC004, EP15_SC005, EP15_SC006, EP15_SC007, EP15_SC008, EP15_SC009 |
| NovelReasonForBattle | 닥터 진의 목록 중 냉장 보관 약품이 있는 지하 3층으로 내려가려는데, 콘크리트 봉인을 안쪽에서 밀어내고 나온 개체가 계단 아래에 있었음 / 전날 분열한 3개체가 굳힌 계단 이음매를 아래에서 치고 올라옴. 카인은 이대로 두면 뒤따르는 벙커 사람들이 만난다고 주장 |
| ArenaLocation | loc_pangyo_lab_b3 |
| PhasesInNovel | 격파 1: 카인이 받고 류가 뒷목에 단검, 아인이 코어를 한 번에 가름 → 바닥에 퍼졌다 재결합, 벤 자리에 봉합선 1개 증가; 격파 2: 아인 단독, 코어가 몸통 정중앙으로 이동 → 두 조각이 서로 기어가 붙음; 격파 3: 4인 동시(오정길은 조명) — 조각을 벽 네 군데로 흩음 → 40초 후 재결합(첫 번째보다 10초 김); 격파 4 시도: 코어 대신 몸을 잘게 나눔(낫 원 다섯 번) → 모이지 않고 사람 키만 한 3개체로 분열; 재대면: 밤사이 서로를 먹어 큰 개체 1 + 작은 개체 2로 변함, 지상층 로비로 올라옴; 자르지 않는 싸움: 자르면 늘어나므로 밀기·발 걸기·파티션·낫자루로 오전 내내 버팀(줄지 않음); 세라 개입: 금속 원통의 푸른빛 그물로 큰 개체가 벌어진 채 붙지 않음 → 봉쇄 3초 안에 같은 자리 두 번 치기; 순서 공략: 봉쇄→카인 자리 잡기→류 조각 흩기→아인 두 번. 큰 것에는 봉쇄 두 번. 여덟 번의 두 번으로 종료 |
| PatternsInNovel | 느린 팔 뻗기 — 반 박자 지연, 목표를 지나침, 복귀에 또 반 박자; 액체처럼 흐르다 어깨·목·머리가 생기며 사람 실루엣으로 재형성; 절단된 팔이 바닥에 닿기 전 방향을 틀어 대상의 다리를 감음, 잘린 조각이 각각 움직임; 표면 여러 곳이 동시에 발광해 진짜 코어 위치를 숨김; 가슴부터 양옆으로 몸을 벌려 대상을 감싸 안으로 넣음(흡수); 대검이 파고든 자리가 대검을 감싸 붙잡음; 가슴부터 양옆으로 몸을 벌려 대상을 감쌈(두 개체를 먹어 전날보다 큼); 넓은 로비에서 흩어진 조각이 사방으로 돎; 굳힌 이음매를 아래에서 부딪쳐 돌파 시도 |
| PartBreak/Weakpoints | 발광하는 코어(처음 뒷목, 이후 몸통 정중앙 등으로 이동); 몸 전체에 가로·세로·사선으로 난 봉합선(민경: 잘린 자국); 표면의 발광점(코어); 두 번째 타격으로 열린 안쪽의 '코어가 되려던 것' — 아직 형태가 없음 |
| Break/Counter | 고정액(조직 고정 시약)이 닿은 부위는 하얗게 굳어 움직이지 않음; 굳은 부위는 다시 붙지 않음 — 개체가 굳은 팔을 스스로 떼어냄; 재생 시간: 30초 → 35초 → 40초(아인의 기록); 세라의 봉쇄: 재생 신호(코어→조직)를 막아 3초간 붙지 않음 — 그 안에 끊어야 함; 같은 자리를 두 번: 첫 타가 만든 틈을 두 번째가 넓혀 신생 코어까지 도달; 금속 원통 명중 시 푸른빛 그물 — 움직임이 멎고 벌어진 채 오므라들지 못함; 고정액으로 굳힌 이음매는 시간이 지날수록 더 굳음 |
| EnvironmentInBattle | 지하 3층 계단 아래 어둠, 헤드램프·오정길의 조명; 폭이 사람 둘 너비인 좁은 계단 — 하나씩만 오르내림(이점이자 함정); 계단 난간(아인이 밟고 도약); 지하실 바닥·벽·천장에 조각이 달라붙음; 계단 위에서 민경이 고정액 병을 투척; 계단 중턱의 굳은 이음매; 지상층 로비 — 넓어서 조각이 사방으로 돎; 로비 파티션(오정길이 쓰러뜨려 길을 막음, 카인의 퇴로를 막기도 함); 나무가 밀고 있는 로비 유리창(세라가 깨고 진입) |
| Outcome | 세 번 격파했으나 전부 재생으로 무효. 분열한 3개체를 처치하지 못하고 계단 중턱 콘크리트 이음매에 마지막 고정액을 부어 임시 봉쇄 후 철수. 동행자 민경 사망. / 격파 — 여덟 번의 두 번 뒤 로비 바닥의 회백색 덩어리들이 더 이상 서로를 향해 기어가지 않음 |
| Source | EP14 L9790-L10072, EP15 L10253-L10469 |

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
