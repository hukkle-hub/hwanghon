# 레비아탄 (원문 EP27 L14590 «터널의 레비아탄», 시트 «레비아탄 나노») — Boss Dungeon Spec (소설 기반 초안, 자동 생성)

> 공식: Story → Boss Entry → Boss Arena → Boss Battle → Boss Result → Story. 잡몹 방 없음.
> 아래 «소설에서 온 것» 은 원문 사실. «게임 설계» 는 원문과 충돌하지 않게 채울 칸이며, 비어 있으면 TBD.

## 소설에서 온 것

| 필드 | 내용 |
|---|---|
| BossId | boss_leviathan |
| EpisodeId | EP08, EP09 |
| SceneRange | EP08_SC005, EP08_SC006, EP08_SC010, EP08_SC011, EP08_SC012, EP09_SC008, EP09_SC009, EP09_SC010, EP09_SC011, EP09_SC012, EP09_SC013, EP09_SC014, EP09_SC015 |
| NovelReasonForBattle | 관제실 계측기가 사흘째 오르기만 하는 한강 침수 터널(지역④ 1/2) 원정. 두 번째 진입의 목표는 이기는 것이 아니라 600m 차수문 3-B까지 지나가는 것. / 물을 당겨 커지고 있어(관제실 그래프 상승), 터널이 좁아지면 한강으로 나가 가둘 수 없게 되기 때문에 차수문이 있는 동안 터널에 가둔다 (L7922-L7932). |
| ArenaLocation | loc_hangang_flooded_tunnel |
| PhasesInNovel | 첫 접촉(500m): 소리 방향 착오, 옆구리 스침(§5); 두 번째 접촉: 머리 앞 격자 흡입 → 물결 멎음(잠복) → 터널 단면 소용돌이, 강 씨 손실(§6); 재진입(400m, 오후): 시각으로 방향 판단 → 결정 띠 긁힘 → 아가미 뿌리 절단 → 후퇴(§10-12); P1 유인·내측 폐쇄: 카인의 수면 타격으로 끌어내고, 내측 차수문 라인 통과 시 아인의 2회 신호 → 류가 내측 문 낙하 (L7960-L8031); P2 해일 추격: 문이 닫힌 것을 안 덩어리가 돌아서 물 전체를 외측으로 밀어냄, 카인 탈출과 아인의 두 거리 측정 (L8037-L8063); P3 외측 폐쇄: 카인 문턱 통과 직후 아인의 핀 절단 → 외측 문이 앞부분 절단 (L8069-L8109) |
| PatternsInNovel | 측면 돌진·스침(파동 방향이 청각상 반대로 느껴짐); 머리 앞 격자 개방 흡입; 잠복(물결이 멎음); 터널 단면 전체 소용돌이(콘크리트·철근 파편 동반); 옆구리 아가미 한 쌍을 펼쳐 방향 전환; 진동(수면 타격)에 반응해 낮은 울음으로 응답 (L7968-L7970); 접근 시 물살이 안에서 밖으로 급변, 수면이 부풀어 오름 (L7986); 문이 닫힌 것을 감지하고 돌아서 터널 물 전체를 해일로 밀어냄 (L8039-L8043); 벽 같은 질량으로 추격 (L8049); 폐쇄 후 문 너머에서 한 번 두드림 (L8117-L8121) |
| PartBreak/Weakpoints | 마디진 긴 몸통, 마디마다 결정의 띠; 머리 앞 격자(흡입구); 옆구리 부채 = 아가미 한 쌍(방향 전환 + 호흡); 몸이 없어 목이 없고, 잴 곳(약점)이 없음 — 해답은 터널 양 끝 차수문 (L7860-L7876); 내부에 눈 감은 여러 얼굴이 겹쳐 있음 (L8081-L8083) |
| Break/Counter | 부유물 흐름으로 접근 방향을 읽어 결정 띠 타격 → 처음으로 궤도를 틈; 카인 대검 난간 → 아인 수중 도약 → 펼쳐지는 아가미 뿌리 절단 → 방향 전환 한 박자 지연·벽 충돌·물속 체류 시간 감소; 차수문 두 개의 거의 동시 낙하로 가둠; 외측 문이 문턱을 넘은 앞부분을 절단 (L8101-L8109); 절단된 부분은 코어·파편 없이 형태를 잃음 — 죽은 것이 아니라 본체에서 떨어진 것 (L8111-L8113) |
| EnvironmentInBattle | 입구 300m부터 수몰(허리→가슴→어깨); 물속 소리 다중 반사 — 청각 방향 불가; 헤드램프의 좁은 시야, 부유물; 윈치 케이블 80m 생명줄; 차수문 3-B(600m, 작동 여부 미상); 가슴께 수위의 침수 터널 (L7942); 내측·외측 기계실의 고정핀·평형추·체인·차수문 (L8019-L8031, L8101-L8103); 배관을 통한 두드림 신호 (1회 대기, 2회 낙하) (L7906-L7912, L8007-L8017); 비상등 (L8077); 입구 윈치(오정길) (L7944) |
| Outcome | 미격파 — 한쪽 아가미 파괴, 놈이 터널 안쪽으로 물러남(한쪽 아가미로 호흡). 강 씨 손실 / 가둠 — 놈의 앞부분이 절단되고 본체는 터널 안에 봉쇄됨. 관제실 그래프는 수평(끝이 아니라 멈춤). 터널 경로 폐쇄로 ⑤구역 사흘 길이 열흘이 됨. |
| Source | EP08 L7446-L7531, L7635-L7707, EP09 L7940-L8157 |

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
