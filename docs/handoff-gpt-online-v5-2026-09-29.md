# GPT 전달 — 온라인 v4·v5 (HwanghonShelter UE5.8) 검토 결과 (2026-09-29, Claude)

v4·v5 패키지를 실제 프로젝트(`hukkle-hub/hwanghon`, `ue/HwanghonCombatUE`)와 대조했다. 전체 감사는 `docs/design/153-online-v4-audit.md`.
**v5 기준**으로 적는다. 아래를 플러그인 원본에 반영해 다음 판을 주면, 이쪽에서 고쳐 쓰는 보정이 줄어든다.

## 0. 프로젝트 사실 (패키지 가정과 다른 것)

- 프로젝트: `ue/HwanghonCombatUE/HwanghonCombatUE.uproject`, 모듈 `HwanghonCombatUE` (`UEIntroProject` 아님).
  플러그인은 `ue/HwanghonCombatUE/Plugins/HwanghonShelter/` 에 v2 + 아래 §2 두 수정이 이미 들어가 있다.
- 엔진: **UE 5.8.1 런처 설치판** — `Server` 타깃을 빌드할 수 없다. `UEIntroProjectServer.exe` 를 부르는 `ServerScripts/*` 는 이 PC 에서 돌지 않는다.
  개발 검증은 `UnrealEditor.exe <uproject> <map> -server -log -port=7777`. 소스 엔진 도입은 디렉터가 검토 중.
- 캐릭터 폰: **Pawn BP 가 아니라 C++** `AHWAinCharacter` + 카인·류·세라 파생(`HWPlayableCharacterVariants`).
- 쉘터 게임모드: 이쪽 `AHWShelterGameMode`(아인 폰 · 원문 NPC 대사 `Content/Data/shelter_npcs.json` · 초상화 · 터치). v5 게임모드는 이것을 모른다 — §6.
- v5 `00_START_HERE.md` 가 읽으라는 `02_PROJECT_REFERENCES/EP01_B1_Bunker_DesignSheet.png` 가 패키지에 **없다**.

## 1. v5 에서 고쳐진 것 (확인함)

- 쉘터도 1회용 입장권을 검증하고, 검증 전에는 폰을 주지 않는다(`AHHShelterOnlineGameMode::RestartPlayer` 가 `bAdmissionValidated` 확인).
- 던전은 URL 이 아니라 입장권 소비 응답의 character/party/mission 을 쓴다.
- `DEV` 입장은 서버 `-AllowDevAdmission` 일 때만(실행 스크립트에 없음 — 좋다).

## 2. v2 에서 고친 것이 v4·v5 에 계속 되돌아옴 (반드시)

| 파일 | 문제 | 고칠 것 |
|---|---|---|
| `Source/HwanghonShelter/Public/HHShelterNPC.h:5` | `#include "Engine/SoftObjectPtr.h"` — UE 5.8 에 없음, **컴파일 실패** | `#include "UObject/SoftObjectPtr.h"` |
| `Content/Python/build_hwanghon_shelter_blockout.py:44, 106, 176, 333` / `build_hwanghon_frontend_flow.py:43` | `unreal.Rotator(0, yaw, 0)` — 파이썬 `unreal.Rotator` 위치 인자는 **(roll, pitch, yaw)**. 복도가 세로 판으로 서고 NPC 가 거꾸로 선다 | `unreal.Rotator(roll=0, pitch=0, yaw=yaw)` 키워드로 |

## 3. 보안 — 아직 남은 것

| # | 어디 | 문제 | 고칠 것 |
|---|---|---|---|
| 1 | `HHDungeonOnlineGameMode` (부모 `AGameModeBase`, `RestartPlayer` 재정의 없음) | 쉘터와 달리 던전은 **PostLogin 에서 기본 폰이 먼저 스폰**되고, 입장권 검증(비동기)이 끝난 뒤 다시 `RestartPlayer`. 무효 입장권 클라도 킥 전까지 던전 안에서 움직인다 | 쉘터와 같게: `RestartPlayer` 재정의로 `bAdmissionValidated` 전에는 스폰 안 함 |
| 2 | `gateway.mjs:223` `/v1/match/dungeon` | 공개 — 누구나 파티를 만들어 던전을 잡고 입장권을 찍어낼 수 있다 | 쉘터 서버만 부른다(`HHShelterOnlineGameMode.cpp:552`) → `requireInternal` |
| 3 | `gateway.mjs:311` `/v1/match/return-shelter` (**v5 신규**) | 공개 — 누구나 임의 party/leader/members 로 **쉘터 입장권을 발급**받는다(파티장 위조) | 던전 서버만 부른다(`HHDungeonOnlineGameMode.cpp:205`) → `requireInternal` |
| 4 | `gateway.mjs:5`, `HHShelterOnlineGameMode.cpp:670`, `HHDungeonOnlineGameMode.cpp:276`, `ServerScripts/*`, `README` | 기본 비밀 `change-me` | 비밀이 없으면 **기동 거부**. 스크립트는 환경변수만 |
| 5 | `gateway.mjs:132` `/v1/status` | 인스턴스 주소·인원 공개 | 내부 전용 또는 개수만 |
| 6 | `/v1/match/shelter` | 계정은 클라가 만든 UUID(문서에 명시) | 상용 전 로그인 서비스 필요 — 알고 있음, 기록만 |

## 4. 블록아웃 레이아웃 (v2 와 같은 문제, 걸어서 못 감)

이쪽 도달 검사(아인 캡슐 100 cm 격자 BFS) 결과와 보정: `docs/design/152-gangnam-bunker-hub.md §3`
- 코어가 닫힌 방 — 벽이 복도를 끊는다(문 14곳을 내야 했다).
- 복도 끝과 방 사이 바닥이 비어 있다(전실 3개 추가).
- 03·05·06·07 방은 복도 쪽이 뒷벽이고 허공 쪽이 열려 있다(허공 쪽 벽 4개).
- PlayerStart z 90 < 캡슐 반높이 92 → 스폰 실패(`build_hwanghon_shelter_blockout.py:333`). **z ≥ 110**.
- 정적 조명·라이트맵 없음 → «LIGHTING NEEDS TO BE REBUILT». Movable 조명 + 월드 `force_no_precomputed_lighting`.
- 빌더가 **현재 열린 월드에** 짓는다 — 다른 맵이 열려 있으면 그 맵을 덮는다(이쪽 프론트엔드 맵이 한 번 덮였다). 대상 맵이 아니면 거부할 것.
- v5 출격 셔터(`AHHDeploymentGate`)도 이 레이아웃 위에 놓이므로, 셔터 대기구역까지 걸어서 닿는지 같은 검사로 확인할 예정.

## 5. 설정·흐름·휴대폰

- `Config/DefaultEngine.ini.append:4` 가 `GameDefaultMap` 을 `L_Loading` 으로 바꾼다 — **Config 는 덮어쓰지 말 것**. 이쪽에서 의도한 줄만 넣는다.
- **디렉터 결정(2026-09-29): 앱 첫 화면 = 로딩 화면에서 «스토리 모드» / «쉘터» 를 고른다.**
  스토리 모드 = 기존 제1부(EP01 부터, 이쪽 `HWStoryGameMode`, 맵 `/Game/Hwanghon/Story/EP01/EP01_TrainingRoom_World`).
  쉘터 = 캐릭터 선택 → 쉘터 입장권 → 쉘터 서버. `HHLoadingGameMode`/HUD 에 두 갈래 버튼, 스토리 맵 경로는 설정값으로.
- 휴대폰(디렉터는 안드로이드로 논다): 프롬프트·조작이 키보드 전용이다.
  - `HHShelterNPC.cpp` «F 대화하기», `HHShelterStation.cpp` «F …», `HHShelterHUD.cpp` «F / ENTER 다음 E … ESC 닫기»
  - 파티 P/I/Y/N/R/L, 출정 **G** — 터치 버튼이 없다.
  - 이쪽 터치 규칙: 짧게 탭 = F, 0.5초 누르기 = E, 오른쪽 위 모서리 = ESC (`AHWShelterTouchInput`). 파티·출정은 화면 버튼이 필요하다.
  - 터치 기기(`FPlatformMisc::SupportsTouchInput()`)에서는 문구를 «탭 대화하기 · 길게 눌러 {시설} · 오른쪽 위 닫기» 로.

## 6. 확장 지점 (이쪽 코드와 합치려면)

`AHHShelterOnlineGameMode` / `AHHDungeonOnlineGameMode` 를 **상속해서** 쓰겠다. 필요한 것:
- `CharacterPawnClasses` 를 서브클래스·설정에서 채울 수 있게, 허용 ID `ain/kain/ryu/sera`(C++ 클래스).
- NPC 스폰·설정이 끝난 **뒤** 부르는 가상 훅(예: `OnHubReady()`) — 원문 대사·초상화를 덮어쓰기 위해.
- HUD 클래스 지정 가능(터치 프롬프트·버튼).
- 던전: 이쪽 전투(`UHWCombatComponent`, 보스)는 아직 UE 복제용이 아니다. `CompleteDungeonRun()` 을 부를 **완료 이벤트 훅**만 열어 두면 된다.

NPC 기본 대사는 21줄 중 19줄이 원문에 없는 창작이다. **대사는 플러그인에 넣지 말고** 데이터(`shelter_npcs.json` 형식)로 받게 하라 — 원문 줄 번호까지 이쪽에서 검증한다.
«한 장인» 은 이름이 아니라 **한(이름) + 장인(직업)**. 두호·오정길은 디자인 시트가 아직 없다(외형을 만들지 말 것).

## 7. 컴파일 때 확인할 것 (추정, 실제 빌드에서 확정)

- `Pawn->NetUpdateFrequency = …`, `MinNetUpdateFrequency` 직접 대입(`HHShelterOnlineGameMode.cpp` `RestartPlayer`) — 5.5 부터 폐기 경고, `SetNetUpdateFrequency()`/`SetMinNetUpdateFrequency()` 로.

## 8. 수치

24/32 명, 20–30 Hz 는 목표값이다(실측 없음). 이쪽에서 `-nullrhi` 봇으로 8/16/24/32 명을 실측하기 전에는 보장으로 쓰지 않는다.

## 9. 좋았던 점 (유지)

파티 RPC 서버 권한(생성·초대·수락·준비·나가기·4인 제한), 입장권 1회용·만료·인스턴스 한정, v5 쉘터 입장 보류, 셔터 대기구역 전원 확인 후 출정, 매치메이커 입력 검증, 하트비트.
