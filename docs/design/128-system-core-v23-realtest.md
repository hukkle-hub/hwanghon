# 128 — SYSTEM CORE v2.3 적용과 실검수 (UE 5.8.1, 2026-09-28)

디렉터 지시:

- v2.2 → v2.3 패키지를 최신 main 에 병합한다.
- preflight 가 통과해야 한다.
- UE 5.8.1 컴파일 오류는 최소 수정한다.
- `CommitDeath / OnDied / OnBossDied / UHWQuestRunSubsystem` 수명주기는 퇴행시키지 않는다.
- 캐릭터·보스·던전·멀티만 다룬다(UI·그래픽 없음).
- 1P / 2P / 4P 를 **실제로** 확인한다.

## 0. 결론

| 항목 | 결과 |
|---|---|
| preflight (v2.3) | PASS (`ok: true`, 보존 계약 5 종) |
| UE 5.8.1 에디터 컴파일 | 성공. 프로젝트 경고 0 (엔진 헤더 `GetMovementBase` 폐기 경고만) |
| Hwanghon.* 자동화 | **26 / 26** |
| npm test | **597 / 597** |
| SYSTEM CORE node 테스트 | **32 / 32** (패키지에서 서버가 없어 SKIP 이던 4 개 포함) |
| 정적 검증 v1 · v2 | PASS |
| 실검수 게이트 | **1P 16/16 · 2P 15/15 · 4P 26/26** (§3, `tools/ue/system-core-qa.cjs all`) |

## 1. 병합

- v2.3 이 v2.2 에서 바뀐 것은 네 가지다.
  - `PendingCharacterName/Id` 를 `UHWRaidNetworkSubsystem` private 로 옮겼다.
  - `SetPendingCharacterCreation()` 을 추가했다.
  - 온라인 캐릭터가 이미 있으면 프론트의 로컬 선택을 막는다(`OnlineCharacterLocked`).
  - preflight 가 선택 회귀까지 돈다.
- `integrate-system-core-v2-current.ps1` 의 적용 스크립트는 **이미 적용된 트리에서 다시 돌리면 멱등이 아니다**.
  - `Heal`/`Revive` 선언이 중복된다(UHT 오류).
  - 입력 매핑 줄이 중복된다.
  - 프론트 `NativeConstruct` 블록이 중복된다.
  - 그래서 v2.3 은 차이만 손으로 반영했다. 위 세 파일은 적용 직전 상태로 되돌렸다.

## 2. 고친 것 (최신 main 문맥, 최소 수정)

### 2-1. 컴파일·자동화 (v2.2 때)

| 대상 | 원인 → 수정 |
|---|---|
| `HWRaidNetworkSubsystem.h` | `FTSTicker::FDelegateHandle` 로 바꿨다. `Containers/Ticker.h` 를 포함했다. |
| `HWRaidWorldBridge.cpp` | `auto*` 로 `FindRef` 결과를 받던 곳을 명시 타입으로 바꿨다. |
| `HWCharacterKitComponent.h` | `Activate(EHWAbilitySlot)` 이 `UActorComponent::Activate` 를 가렸다. `using` 을 추가했다. |
| `HWBossPartTarget.h` | `GetBoss()` 를 추가했다. |
| `HWLockOnComponent` | 부위 타깃이 새 락온을 가로챘다(자동화 실패). 이제 새 락온은 몸을 먼저 잡는다. 부위는 `CycleTarget`(Tab)으로 돈다. |
| `HWQuestProgressionTest` | 스키마를 3 으로 고정해서 기대하던 것을 `UHWSaveGame::CurrentVersion` 으로 바꿨다. |
| `HWBossSystemComponent::HandleBossDied` | 테스트 월드처럼 GameInstance 가 없는 월드에서 `Destroy` 하면 경고가 났다. 그런 월드에서는 숨김과 충돌 끄기로 대신한다. |
| `scripts/verify_system_core_v2.py` | 중괄호 수를 셀 때 문자열·주석 안의 JSON 까지 셌다. 코드만 세게 했다. |

### 2-2. 실검수에서 드러난 결함

| 결함 | 증거 | 수정 |
|---|---|---|
| **UE 이동 의도의 방향이 틀림** | 브리지가 카메라 기준 스틱을 그대로 `x=Right, y=Forward` 로 보냈다. 앞으로 가면 서버에서는 옆(+y)으로 갔다. | `HWNetworkCombatBridgeComponent` 가 컨트롤 요(yaw)로 월드 축으로 바꿔 보낸다. 서버 x/y 는 UE X/Y 와 같다. |
| **아레나 위험지대가 UE 에서 1 개로 합쳐짐** | 서버 아레나 위험지대에 `id` 가 없다. UE 에서는 셋 다 `arena_None` 한 프록시가 됐다(샘플 12/192 불일치). | `id` 가 없으면 파서가 배열 순번으로 `arena3..5` 를 붙인다. |
| **온라인 레이드 맵 바닥이 좁아 폰이 떨어져 사라짐** | d03 보스 방 동쪽은 UE X ≈ 5.7 m 인데 바닥은 ±4 m 였다. 폰이 KillZ 로 사라졌고, 그 뒤 입력이 끊겨 2P 가 1000 초 동안 멈췄다. | `build_online_raid_graybox.py` 바닥을 240×120 m(d01~d07 전부 덮음)로 키웠다. 이미 만든 맵도 갱신한다. |
| **1P 던전을 열 길이 없음** | 어떤 맵도 `DungeonId` 를 설정하지 않는다. | `?HWDungeon=<id>` URL 옵션을 받는다. 이렇게 연 던전은 진행 보상을 기록하지 않는다. |
| **1P 전멸 후 재도전이 불가능** | `RetryFromCheckpoint` 가 플레이어를 되살리지 않았다. 실패한 시도의 적도 남아 이중 집계됐다. | `AHWCombatGameMode::RetryDungeonFromCheckpoint()` 를 추가했다. 토큰 1 을 쓰고, `Revive(1.0)` 하고, 체크포인트 방으로 돌린다. 감독은 재진입 전에 남은 방 액터를 치운다. `UHWCoopLifeComponent::ResetForRetry()` 도 추가했다. |
| 보스 타깃을 UE 가 모름 | 서버 `telegraph` 이벤트의 `target`·`dur` 을 버리고 있었다. | `FHWRaidNetEvent.PlayerId`(타깃)과 `Duration` 을 읽는다. 표현용이다. |

- 퀘스트 런(`bQuestRun`)의 실패는 지금처럼 즉시 `FailEncounter` 로 끝난다.
  - 재도전은 자유 출격에서만 된다.
  - `UHWQuestRunSubsystem` 수명주기는 바꾸지 않았다.
- `CommitDeath` → `OnDied` 순서와 `OnBossDied` 도 그대로다.

## 3. 실검수 — 어떻게 쟀나

- `Private/Tests/HWSystemQASubsystem` 이 실검수 봇이다.
  - `-HWQA=<select|writev2|local|net>` 일 때만 생기고, Shipping 에는 없다.
  - 실제 입력 매핑(`APlayerController::InputKey`)으로 논다. 키 → Pawn → 락온 → 키트 → 네트워크 브리지 → 서버 의도의 경로가 사람과 같다.
  - 전투 결과를 직접 쓰지 않는다.
- `tools/ue/system-core-qa.cjs` 가 전체를 돌린다.
  - `server/index.cjs` 를 같은 프로세스에서 띄운다. 권위는 그대로 `server/raid.cjs` 다.
  - `UnrealEditor.exe -game -nullrhi` 클라이언트를 1·2·4 개 띄운다.
  - 테스트 계정 준비만 서버 스토어에서 한다: d03 해금. 2P 는 장비를 갖춘 숙련 계정(xp 22800 + 방어구).
- 위협은 서버 스냅샷에서 빠져 있다(`threat` 제거).
  - 그래서 패턴이 시작되는 순간 서버의 `threat − 거리×10` 을 기록했다.
  - 그 값을 서버가 고른 타깃, 그리고 UE 가 받은 타깃과 맞춰 봤다.
- 로컬 서버를 기본이 아닌 포트로 띄우면 UE(libwebsockets)가 `Origin: http://127.0.0.1` 을 싣는다. 포트가 빠진 형태다.
  - 서버의 기존 `ALLOWED_ORIGINS` 로 허용했다.
  - 운영 서버는 기본 포트라 Host 와 일치해서 설정이 필요 없다.

결과: `ue/HwanghonCombatUE/Saved/SystemQA/final2/summary.md`

### 1P local

| 게이트 | 결과 | 근거 |
|---|---|---|
| v2 저장 작성 | PASS | 디스크 v2, 캐릭터 필드 없음(None) |
| v2→v3 마이그레이션(ain 기본값) | PASS | 디스크 v2 → 로드 ain; kain 선택 → 디스크 kain v3 |
| 재실행 후 선택 유지·Pawn (kain) | PASS | kain → HWKainCharacter ×1, kit kain |
| 재실행 후 선택 유지·Pawn (ryu) | PASS | ryu → HWRyuCharacter ×1, kit ryu |
| 재실행 후 선택 유지·Pawn (sera) | PASS | sera → HWSeraCharacter ×1, kit sera |
| 재실행 후 선택 유지·Pawn (ain) | PASS | ain → HWAinCharacter ×1, kit ain |
| 던전 방 순서 | PASS | 전투 → 목표 → 엘리트 → 보스 (엘리트 1, 목표 노드 소진) |
| 스킬 1~4 | PASS | 발동 8/8/8/8 |
| 궁극기 | PASS | 발동 12, 피해 71,280 |
| 보스 페이즈 1→2→3 | PASS | 최대 페이즈 3 |
| 자세 브레이크 | PASS | 13 회 |
| 부위 락온·파괴 | PASS | Tab 으로 부위 락온 → armor 파괴 |
| 전멸 → 체크포인트 재도전 | PASS | 보스 방(체크포인트 3), 토큰 2→1, HP 24450/24450 |
| 던전 클리어 | PASS | 265 초, 재도전 1 회 |

### 2P 온라인 (d03, Ain + Kain)

| 게이트 | 결과 | 근거 |
|---|---|---|
| 초기 캐릭터 생성 → 서버 `type: character` 저장 | PASS ×2 | TestAin/ain, TestKain/kain, 스토어 created=true |
| 서버 캐릭터로 단일 Pawn (로컬 저장은 sera) | PASS ×2 | HWAinCharacter / HWKainCharacter |
| 캐릭터 교대 없음 | PASS | 레이드 중 `CreateCharacter` 거부, 타임라인 캐릭터 불변 |
| 보스 HP 스케일 1.65 | PASS | 495,000 = 300,000 × 1.65 |
| 독립 이동·공격 | PASS | ain 255,352 · kain 583,640 피해 |
| 스킬 0~3 · 궁극기 | PASS | 두 명 모두 네 칸 쿨다운 관측, 게이지 100 → 소모 |
| 부위 타깃·파괴 | PASS | intake, exhaust (서버 판정) |
| 위협 → 보스 타깃 | PASS | 서버 패턴 28 회 최고 위협 일치 28/28, 타깃 전환 7 회 |
| UE 표시·보정 | PASS | 원격 아바타 204/204, UE 보스 HP = 서버 128/128 |
| Down | PASS | 탐험 중 분출구에서 다운, 출혈 20 초 |
| Revive 3 초 → 30 % | PASS | 14,895 / 49,650 (30 %), 다운 13.5 초 뒤 |
| 클리어 → 보상 서버 저장 | PASS | `rewardStatus=saved`, 골드 0→3400, clears sewage 1 |

### 4P 온라인 (d03, Ain · Kain · Ryu · Sera)

| 게이트 | 결과 | 근거 |
|---|---|---|
| 초기 캐릭터 생성 · 단일 Pawn | PASS ×4 | 로컬 저장 sera 와 무관하게 서버 캐릭터 |
| 보스 HP 스케일 2.95 | PASS | 885,000 = 300,000 × 2.95 |
| 독립 이동·공격·스킬·궁극기 | PASS | 네 명 모두 피해, 스킬 네 칸, 궁극기 소모 |
| 위협 → 보스 타깃 | PASS | 34/34 일치, 전환 7 회, UE 가 본 타깃 4 명 |
| 부위 · 페이즈 · 브레이크 | PASS | intake·exhaust, stage 0→1, down 8 회 |
| 위험지대 | PASS | 탐험 분출구 off/warning/active, 아레나 warning/active/off |
| 탐험 노드·상호작용·게이트 | PASS | 노드 6/6, 네 클라이언트 모두 상호작용, 밸브 3 → 게이트 열림 |
| UE 프록시 | PASS | 위험지대·노드·게이트 프록시 수 ≥ 스냅샷 |
| 전원 다운 → 전멸 | PASS | 4 명 다운 (rt 137.3) |
| 재도전 | PASS | 체크포인트 pump_rest, 전원 만피, 게이트 열린 채 |
| 재접속 (같은 프로세스, 토큰) | PASS | 같은 플레이어 ID 로 전투 중 복귀 |
| 재접속 (프로세스 강제 종료 → `-HWToken`) | PASS | 같은 ID, 레이드 맵 자동 이동, HWRyuCharacter |
| 클라이언트 간 동기 | PASS | 같은 서버 시각의 보스 HP·페이즈 445/445 일치 |

## 4. 남은 것

- `server/` 는 이번에 바꾸지 않았다.
  - 패키지의 `raid.cjs` 스냅샷 확장(노드·게이트)은 그대로 들어간다.
  - Render 재배포가 필요하고 GPT 몫이다.
- 로컬에서 UE 로 서버에 붙을 때 기본이 아닌 포트를 쓰면 `ALLOWED_ORIGINS=http://<주소>` 가 필요하다.
- 서버 좌표 y 는 비등방(DEPTH 0.55)인데 UE 는 X·Y 를 같은 배율로 옮긴다.
  - 그래서 UE 화면에서 남북 거리가 늘어나 보인다. 표현만의 문제다.
- 퀘스트 런 중 던전 전멸은 지금도 즉시 실패다(재도전 없음, 수명주기 보존).
- 적용 스크립트가 멱등이 아니다(§1). 패키지 쪽에서 고쳐야 다시 돌릴 수 있다.
- `DefaultEngine.ini`(AndroidFileServer)와 `DefaultInput.ini` 는 에디터가 다시 쓴 사본이다. 커밋하지 않았다.
  - 입력은 패키지 매핑 10 줄과 `CycleTarget`(Tab)만 넣었다.
