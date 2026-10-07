# 200 · UE 3D 복귀 — 남산 N-01 정문 슬라이스 (2026-10-07)

GPT → Claude 핸드오프 «못생겨도 실제로 플레이되는 황혼» 의 1~5단계. 디렉터가 Windows UE 5.5 에서 6단계(빌드·PIE)를 돌린다.

## 0. 먼저 알아야 할 것 (정직하게)

| | |
|---|---|
| **이 컨테이너에 Unreal 이 없다** | C++ 는 썼지만 **UE 로 컴파일·PIE 를 못 했다.** 대신 ① 규칙 전부를 엔진 없는 C++ 헤더(`HWNodeRules.h`)로 빼서 g++·clang 으로 엄격 경고(-Werror -Wshadow -Wconversion)까지 **컴파일·시험**했고, ② 그레이박스 기하를 같은 JSON 으로 셈해서 **적이 걷는 길이 끊기지 않는지 재고 그림으로 확인**했고, ③ 별도 에이전트로 UE 5.5 API 대조 검토를 했다. UE 쪽 껍데기(액터·컴포넌트)는 **Windows 에서 첫 컴파일이 진짜 확인**이다. |
| **GPT 가 말한 보스 코드가 저장소에 없다** | `AHwanghonBossBase`, `AHwanghonBossAIController`, Blackboard/BehaviorTree, 키 `IsCounterStance`·`VulnerableWindowType` 등 — 이 저장소 모든 브랜치·이 계정의 다른 저장소에 **없다.** `AIModule` 도 Build.cs 에 없다. 디렉터 PC 에만 있는 코드라면 올려 주셔야 «재사용» 할 수 있다. 지금 있는 것은 아래 §1 의 손으로 짠 상태 기계(`AHWBossCharacter`)다. |
| 엔진 버전 | `.uproject` 는 5.5 인데 **지금까지 빌드·자동 시험 기록은 전부 UE 5.8.1** (Docs/FULLGAME_FOUNDATION_KR). 5.5 빌드·PIE·Android 패키징은 한 번도 안 돌았다. |
| `Content/` | `.umap`·`.uasset` 은 저장소에 없다(.gitignore). 맵은 파이썬/C++ 가 만든다. 그래서 남산도 **C++ 가 빈 레벨에 JSON 으로 짓는다** — 에셋이 필요 없다. |

## 1. 기획 ↔ 기존 코드 (조사 결과)

| 기획 항목 | 기존 | 이번 |
|---|---|---|
| 이동·카메라·락온 | ✔ `AHWAinCharacter`(스프링암·자유/락온 프레이밍), `UHWLockOnComponent` | 재사용 |
| 모바일 이동 | ✘ `MoveForward/Right` 가 W/A/S/D 에만 — 화면 조이스틱(`Gamepad_LeftX/Y`)을 아무도 안 읽었다 | **고침**: 왼쪽 스틱 축 추가 |
| Android 가로 | ✘ 설정 없음 | **고침**: `Orientation=SensorLandscape` |
| 기본 공격 | △ 3타·히트스톱 있음. 그러나 **락온 대상에게만** 맞는다 — 락온 없으면 허공 | **고침**: 락온 없거나 사거리 밖이면 앞쪽 가장 가까운 몸에 (`FindFrontTarget`) |
| 피격·경직 | ✔ `ApplyIncomingDamage`, 보스 `ReceivePlayerHit`·자세(Posture) | 재사용 |
| 사망·복귀 | △ 죽음·`Revive` 는 있으나 혼자일 때 자동 복귀 없음 | 노드에서 5초 뒤 정문에서 복귀 |
| 회피(무적) | ✔ `RequestDodge`, i-frame 0.30 | 재사용 |
| 궤적 회피 | △ 투사체 없음. 표시된 원(`bAtTarget`)·안전 부채꼴·점프 회피는 있음 | 다음 |
| 패링/일반 카운터 | ✔ `RequestCounter`·`TryCountered` | 재사용 |
| **퍼펙트 카운터** | ✘ `PerfectCounterWindow 0.10` 이 **선언만 되고 아무도 안 읽었다** | **연결**: `IsPerfectCounterActive()` + 보스 `OnBossCounterGraded(bPerfect)` |
| 잡기·잡기 카운터 | ✘ 온라인 서버에만 | 다음 |
| 그로기 | ✔ 자세 붕괴 → `EHWBossState::Break` | 재사용 (코어 노출 = Break) |
| 부분파괴·부위 HP | ✔ `UHWBossSystemComponent` head/armor/limb | 재사용 — 팔 장갑 파괴 = `limb` 파괴 |
| 보스 취약창 | △ 리포스트(`CanRiposteFrom`), 대본 보스의 `IsOpen` | 재사용 |
| **코어 노출·적출** | ✘ | **신규** `UHWBossCoreComponent` |
| 웨이브·시설·거점·NPC·길드·공헌도 | ✘ (던전 적 `AHWDungeonEnemy` 만) | **신규** Node 시스템 |

## 2. 만든 것

```
Public/Node/HWNodeRules.h        엔진 없는 규칙 — 카운터 판정 · 코어 장갑/적출 · 시설 · 거점 상태 기계 · 점령 단계 ·
                                 정보 거점 기능 · 적 역할/목표 · 정문 막힘 · 웨이브 · NPC · 공헌도 · 관리권 · 정책 예산
Public/Node/HWNodeConfig.h/.cpp  Content/Data/node_<id>.json → 받침·경사로·벽·시설·길·시작점 (남산 = 첫 데이터)
Public/Node/HWNodeFacility       정문/발전기/통신센터 — 개별 HP, 정문은 부서지면 길이 열린다, 발전기는 전력 단계
Public/Node/HWNodeEnemy          역할 5종 — 일반·질주형(우회)·파괴자(시설 우선)·추적자(NPC 우선)·철갑 엘리트(카운터로 장갑 깸)
Public/Node/HWNodeNpc            기술자 — 정상→부상→실종(→구조), 상태가 복구 속도를 정한다
Public/Node/HWNodeDirector       거점 하나를 돌린다 — 그레이박스·시설·웨이브·상태·복귀·HUD·보스
Public/Node/HWBossCoreComponent  인간형 보스의 왼팔 코어
Content/Data/node_namsan_n01.json  남산 N-01 정문 구간 (핸드오프 §7 좌표 그대로)
```

**남산 전용 하드코딩 없음.** 용산·서울역·한강은 `node_<id>.json` 하나씩.

### 실행

빈 레벨(또는 아무 전투 맵)에서 GameMode `HWCombatGameMode` + 옵션 **`?HWNode=namsan_n01`**.
에디터: `Play` 옵션의 URL 에 붙이거나, 명령줄 `UnrealEditor.exe HwanghonCombatUE.uproject /Game/Maps/Seohan_Combat_VS01?HWNode=namsan_n01 -game`.
기존 `?HWDungeon=` 과 같은 길이고, 진행도(퀘스트)에는 기록되지 않는다.

### 한 판 (약 4분 + 보스)

1. 경계(ALERT) 6초 → 침공. 플레이어는 정문 안쪽.
2. 웨이브 1 일반4+질주2 → 55초 웨이브 2 일반5+질주3 → 115초 웨이브 3 일반6+파괴자1 → 175초 Final 철갑 엘리트1+일반4. 웨이브를 다 잡으면 8초 뒤 다음이 당겨진다.
3. 질주형은 서·동 숲길로 정문 벽을 돌아 뒤(기술자·발전기)로. 파괴자는 플레이어를 지나쳐 시설로(정문이 서 있으면 정문부터 부순다). 철갑 엘리트는 1/4 피해만 받다가 **카운터(퍼펙트면 더 길게) 로 장갑이 깨진다.**
4. 다 잡으면 **중계자**(임시: 기존 보스 몸)가 중앙방벽으로. 1페이즈 인간형 전투 → 70% 아래 2페이즈부터 **왼팔 코어 점등**, 카운터마다 코어 장갑 −8(퍼펙트 −22) → 0 이면 `limb` 부위 파괴 + 그로기 4초 + 코어 노출 → HP 10% 이하에서 **계속 때리면 사살 / Execute(V) 를 누르고 1.5초 맞지 않고 버티면 적출.** 확률 없음.
5. 보스가 쓰러지면 **방어 성공 → 복구(기술자 상태가 속도) → 안정.** 통신센터가 부서지거나 적이 20초 차지하면 **함락** — 지도 정보 35%, 이벤트 탐지 15%, 구조신호·침공 예보 꺼짐. 점령 2시간 전엔 탈환 불가, 이후 단계별 강화(2·6·12·24시간).
6. Interact(G) 로 다시 시작. 화면 왼쪽 위 글줄 = 임시 HUD(상태·웨이브·시설 %·전력·정보 기능·카운터/퍼펙트 횟수).

## 3. 확인한 것 / 못 한 것

| | 결과 |
|---|---|
| 규칙 (g++·clang, 엄격 경고) | `tests/ue-node-rules.test.cjs` 통과 — 카운터 판정 경계, 코어 장갑(퍼펙트 5번·일반 13번에 파괴, 한 번만), 적출(맞으면 끊김·다시 가능), 상태 기계 전 경로, 점령 단계, 함락 시 정보 기능, 역할별 목표, 정문 막힘, 웨이브 26마리·시각·당기기, NPC, 공헌도(보스 딜 1위 < 방어·수리·구조한 사람), 관리권, 정책 예산. **일부러 깨 본 4가지 모두 실패로 잡힘.** |
| 그레이박스 (`tests/ue-node-config.test.cjs`) | 시작점·기술자·보스·적 시작점이 바닥 위 · 정면/서/동 우회/발전동/통신센터 길이 50 cm 마다 바닥이 있고 턱 45 cm 이하 · 정문이 정면 길을 막고 정문 줄 전체가 벽+정문으로 막힘 · 우회로는 벽을 안 뚫음. **벽 틈·길 빠짐·우회로가 벽 관통·떠 있는 시작점 4가지를 일부러 넣어 모두 잡힘.** |
| 그림 | `tools/ue/node-graybox.html` (같은 JSON, 같은 셈) |
| UE 자동 시험 | `Hwanghon.Node.*` 4개 추가 (규칙 + JSON 로드 + 경사로 윗면) — **Windows 에서 처음 돈다** |
| UE 컴파일·PIE·안드로이드 | **못 했다** (엔진 없음). 별도 에이전트 API 대조 검토만. |

## 4. 디렉터 PC 에서

```powershell
cd ue\HwanghonCombatUE
powershell -ExecutionPolicy Bypass -File .\Scripts\build_setup_test_windows.ps1 -SkipImport
```
컴파일 실패하면 로그 첫 오류만 붙여 주시면 고친다. 통과하면 위 «실행» 으로 한 판 해 보고, 정문 방어가 재미있는지가 이번 합격 기준(핸드오프 §10).

## 5. 다음 (핸드오프 §11 순서)

1. Windows 컴파일·PIE 결과로 고치기 · 정문 4분 손맛 조정(적 수·HP·텔레그래프 시간은 `HWNodeRules.h` 한 곳)
2. 서측 순환로 → 동측 숲길 → 발전동 내부 → 생활구역/NPC (JSON 에 받침·길 추가)
3. 잡기·잡기 카운터, 궤적 회피(투사체) — 전투 P1 남은 것
4. 인간형 더미 몸: 지금 보스는 기존 훈련 보스 몸. `WearBody` 는 같은 골격만 받으므로 매니퀸으로 갈아입히려면 애니 세트가 필요
5. 함락 상태 지속(서버 저장) · 탈환전 — 상태 기계는 이미 있음(`StartRetake`/`RetakeEnded`)
6. 길드 관리권·정책 — 규칙은 있음(`StewardGuild`, `ValidPolicies`), 서버·UI 는 웹 쪽 길드(문서 27·29)와 연결
