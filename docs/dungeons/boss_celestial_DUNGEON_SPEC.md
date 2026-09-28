# 셀레스티얼 — Boss Dungeon Spec (소설 기반 초안, 자동 생성)

> 공식: Story → Boss Entry → Boss Arena → Boss Battle → Boss Result → Story. 잡몹 방 없음.
> 아래 «소설에서 온 것» 은 원문 사실. «게임 설계» 는 원문과 충돌하지 않게 채울 칸이며, 비어 있으면 TBD.

## 소설에서 온 것

| 필드 | 내용 |
|---|---|
| BossId | boss_celestial |
| EpisodeId | EP04, EP05, EP17 |
| SceneRange | EP04_SC009, EP04_SC010, EP04_SC011, EP05_SC003, EP05_SC012, EP05_SC013, EP17_SC003, EP17_SC004, EP17_SC005, EP17_SC006, EP17_SC007, EP17_SC008, EP17_SC009, EP17_SC010, EP17_SC011 |
| NovelReasonForBattle | 클레이브 수트 코어에서 해독된 좌표를 따라 남산 전망대에 올랐을 때 셀레스티얼이 습격해 난간을 부수며 일행을 떨어뜨리려 한다. / EP04에서 놓친 놈을 다시 잡으러 남산에 오지만, 놈은 나타나지 않는다(교전 없음). / 순찰 경로대로 골짜기 상공을 지나던 중 섀도우 팽에게 끌어내려져 추락 — 세라: '오늘이 아니면 못 잡아' |
| ArenaLocation | loc_namsan_observatory |
| PhasesInNovel | 단일 국면 — 공중 선회와 급강하만 하고 지면으로 내려오지 않음. 일행 후퇴로 종료(미격파); 강하: 구름 아래 광점 → 4m 활공체(접힌 금속 날개, 몸통 아래 수납부 격자), 섀도우 팽과 공중 충돌·추락; P1 저공: 한쪽 날개 찢김, 양력 6할·고도 상한 15m — 공간 접기 급습·강하·낙사 유도 돌풍; 끌어내리기: 결계가 펴 낸 반 박자에 아인이 낫으로 찢긴 날개 관절을 걸어 끌어내림 → 연격으로 날개 관절(경질 소재+관절 제어 코어) 절단; P2 재구축: 수납부 격자의 수거 코어 수십 개를 흡수해 더 크게 재구성 — 날개 넷, 외장 틈새로 빛, 잘린 관절도 빛으로 메움; P3 다중 접힘: 한 번에 세 곳에서 동시 강하 — 결계 한 장 남음, 벽에 몰림; 종결: 세라가 아인의 코어 서명을 촉매에 베껴 던져 착지 좌표 지정 → 카인 가드가 강하를 완전히 묾(대검 파단) → 아인이 목덜미 코어 정중앙 절단 |
| PatternsInNovel | 전망대 위 선회 활공(날갯짓 없음); 급강하 → 발톱으로 난간을 긁고 재상승(난간 구간 파괴, 40m 아래로 낙하); 급강하 발톱 공격(오정길을 나가떨어지게 하고 카인의 어깨를 긁음); 난간 연속 파괴로 발판 축소 — 떨어뜨리려는 의도; 공간 접기 — 15m 거리를 종잇장처럼 접어 머리 위로 순간 도달; 연속 강하(두 번, 세 번); 낙사를 유도하는 돌풍; 수거한 코어를 연료로 흡수·재생; 다중 접힘 — 세 방향 동시 공격; 가장 밝은 코어 서명을 좌표로 접혀 들어옴; 찢어지는 금속성 포효 |
| PartBreak/Weakpoints | 등에서 뻗어 나온 나노 강선 막(펼치면 약 4미터); 발톱(EP05 L5011에서 '셋'으로 언급); 약점: TBD_CANON(본문 서술 없음); 발톱 셋(L5011 '어제 그놈은 셋이었다'); 찢긴 날개 관절 — 경질 소재와 심에 박힌 관절 제어 코어; 목덜미 코어(최종 약점); 몸통 아래 수납부 격자(수거 코어 저장고) |
| Break/Counter | 세라의 차원 결계: 접힌 공간을 결계 면에서 도로 펴 급습을 15m 밖으로 되돌림, 돌풍도 막 바깥으로 갈라짐; 낫을 '거는 손'으로 — 날개 관절에 걸어 전 체중·원심력으로 끌어내림(남산 와이어 경험); 접힐 때 먼저 서는 가늘고 하얀 이음매 선(문턱 넘은 아인의 눈); 코어 서명 복제 촉매 투척으로 착지 좌표를 아군이 지정 |
| EnvironmentInBattle | 반파된 전망대, 유리 벽 없음; 자물쇠 수백 개가 걸린 남은 난간; 난간 파괴로 바닥 절반 이하로 축소; 가장자리 40m 아래 붉은 안개(바닥 안 보임); 케이블카 와이어(시신 넷); 골짜기 바닥과 벽 — 다섯이 벽을 등지고 몰림; 고도 상한 15m(날개 손상); 섀도우 팽 사후 소리가 돌아온 전장 |
| Outcome | 미격파. 낫·대검 모두 닿지 않고 오정길은 발사하지 않음. 셋이 계단으로 후퇴, 놈은 추격하지 않고 케이블카 와이어의 시신 넷 옆에 내려앉음. / 출현하지 않음. 순찰 일정표 「남산 → 여의도 인수인계 / 진행 중」으로 놈이 넘겨주러 떠났다고 판단, 잡을 이유가 없어져 교전 없이 철수. / 격파 — 삼킨 빛이 일제히 꺼지고 '하늘의 왕이 땅에서 죽음'. 잔해: 규격 용기, 경질 소재 판, 장비 잔해, 식어 가는 융합 코어 결정 1, 인식표(닳은 A). 대가: 카인의 대검 파단, 세라의 촉매 전량 소진 |
| Source | EP04 L4380-L4579, EP05 L4957-L4994, L5468-L5597, EP17 L11001-L11219 |

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
