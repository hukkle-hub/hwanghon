# 섀도우 팽 — Boss Dungeon Spec (소설 기반 초안, 자동 생성)

> 공식: Story → Boss Entry → Boss Arena → Boss Battle → Boss Result → Story. 잡몹 방 없음.
> 아래 «소설에서 온 것» 은 원문 사실. «게임 설계» 는 원문과 충돌하지 않게 채울 칸이며, 비어 있으면 TBD.

## 소설에서 온 것

| 필드 | 내용 |
|---|---|
| BossId | boss_shadow_fang |
| EpisodeId | EP16, EP17 |
| SceneRange | EP16_SC003, EP16_SC004, EP16_SC005, EP16_SC006, EP16_SC007, EP16_SC008, EP16_SC009, EP16_SC010, EP16_SC011, EP16_SC012, EP16_SC013, EP17_SC001, EP17_SC002, EP17_SC003, EP17_SC004 |
| NovelReasonForBattle | 인계 지점 추정 1호를 조사하던 중, 밝기를 사냥하는 것의 영역 한가운데에서 가장 밝은 코어를 지닌 아인을 노려 수풀 그늘에서 기습 / EP16에서 이어진 전투 — 세라를 향해 도약한 놈을 4인 공식으로 마무리 |
| ArenaLocation | loc_logistics_warehouse_yard |
| PhasesInNovel | 개전: 예비 동작 없는 무음 돌진 — 류가 아인을 밀어 관통을 피함, 첫 받아넘김; 읽기: 코어가 켜지는 순간(출력 발화)을 읽고 모든 반격을 칼이 출발하기 전에 회피; 소등: 아인이 마지막 억제제로 코어를 끄자 조준을 잃고 다음으로 밝은 카인에게 재정렬; 분산: 오정길이 뿌린 파편 미끼로 감각기 절반이 갈라짐 → 진형 재구성; 첫 유효타: 미끼를 후려치는 반 박자에 어두운 아인의 낫이 옆구리 표피를 가름(얕음); 광폭화: 공세가 배로 빨라짐 — 카인의 가드 금이 넓어짐; 세라의 빛기둥에 조준이 증발했다가 복귀 — 상처 입고 학습해 더 낮게 웅크림, 세라에게 도약; 공식 성립: 세라 결계(3초)로 급습을 흘림 → 카인 모루로 반 박자 → 류가 뒷다리 두 관절에 쌍단검 고정 → 세라 감각기 봉쇄(2초) → 밝은 채의 아인이 출력을 실어 어제 상처를 심부까지 가름; 봉쇄 해제 후 전장이 아닌 하늘의 셀레스티얼(골짜기에서 제일 밝은 몸)을 향해 도약, 공중 충돌 후 함께 추락; 지면 난투 중 아인이 같은 자리에 세 번째 — 심부의 빛 소멸 |
| PatternsInNovel | 예비 동작이 그늘에 녹은, 시작이 보이지 않는 무음 돌진(아스팔트에 매끄러운 절단흔); 칼이 아니라 목의 빛을 읽고 공격 전에 이미 다른 곳에 있음; 가장 밝은 대상에게 공세 집중; 주변 소리를 삼킴 — 소리가 오다가 죽음; 상처 후 광폭화(공세 두 배); 가장 밝은 빛을 향한 도약; 예비 동작 없는 급습, 소리 없는 낙하; 가장 밝은 대상에게 쇄도; 가장 밝은 광원(상공의 셀레스티얼)으로 표적 전환·도약 |
| PartBreak/Weakpoints | 머리 자리의 꽃잎처럼 벌어지는 감각기(눈·귀 없음); 이음매 없는 검은 표피 — 그 아래 흐린 빛의 속살(옆구리); 꽃잎형 감각기(봉쇄 대상); 뒷다리 두 관절(고정 대상); 전날의 옆구리 상처 → 흐린 빛의 심부 |
| Break/Counter | 코어를 어둡게 하면 감각기가 길을 잃음(억제제); 각인 없는 오정길은 인지되지 않음 — 코어 파편을 흩어 감각기 조준을 둘로 찢음; 공격에 전념한 반 박자 — 한 곳에만 존재하는 유일한 시간; 더 밝은 광원(세라의 빛기둥)에 감각기가 통째로 젖혀짐; 제약: 어두운 채로는 출력이 부족해 표피까지만 벰('밝으면 읽히고, 어두우면 얕다'); 세라의 봉쇄로 감각기를 조여 2초간 열리지 못하게 함 — 밝은 코어가 더 이상 봉화가 아님; 카인의 가드가 만든 반 박자; 류의 관절 고정 |
| EnvironmentInBattle | 무음 지대 — 경고가 소리가 아니라 몸으로 전달됨, 수신호로 소통; 수풀 그늘(은신·기습); 뒤집힌 수레·빈 방호복·코어 도려내진 집행관 사체; 전장 밖 폐허 능선(세라의 빛기둥 위치); 골짜기 — 무음 지대; 상공을 지나는 셀레스티얼의 순찰 경로 |
| Outcome | 전투 지속 — 첫 유효타(얕은 옆구리 상처, 세라 판단 반나절 안에 아묾). 아인의 억제제·세라의 촉매 고갈, 봉쇄 1회 남음. 놈이 세라를 향해 도약하며 화가 끝남 / 격파 — 죽은 놈이 삼키고 있던 소리가 세계로 반환됨 |
| Source | EP16 L10697-L10926, EP17 L10959-L11040 |

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
