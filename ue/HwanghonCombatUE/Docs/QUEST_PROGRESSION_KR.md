# 의뢰 출격·클리어·보상 저장 연결

이 문서는 의뢰 진행을 담당하는 C++ API와 저장 계약을 설명한다. 목표 엔진은 **UE 5.5**다.
구현 범위는 의뢰 상태 조회, 출격 티켓과 맵 신원 확인, 전투 결과 기록, 인력사무소 보상 수령이다.
실제 의뢰 맵·로비·결과 UI를 완성했다는 뜻은 아니다. 현재 설정에 활성화된 의뢰 맵 경로는 없다.
빌드·자동화·실기 검증 결과는 실행 보고서에서 별도로 확인한다. 이 문서에는 통과 결과를 기재하지 않는다.

## 데이터와 책임

| 구성 요소 | 책임 |
|---|---|
| `UHWGameContentSubsystem` | `Content/Data/game_content.json`을 검증하고 의뢰 카탈로그 제공 |
| `UHWQuestRunSubsystem` | 일시적인 선택·출격·전투 상태와 한 번의 실행을 식별하는 티켓 관리 |
| `AHWCombatGameMode` | 로드된 맵의 신원 확인, 실제 참여 보스·플레이어의 승패 관찰 |
| `UHWProfileSubsystem` | 저장 후보를 만들고 디스크 저장 성공 후 조회 값과 알림 공개 |
| `UHWSaveGame` | 클리어·보상 영수증, 누적 수령량, 버전·일관성 검사 |

세 GameInstance subsystem은 콘텐츠 → 프로필 → 출격 순서로 의존성을 초기화한다.
콘텐츠는 기존 웹 데이터의 정적 변환본이다. 수정은 원본과 `tools/ue/export-game-content.mjs`에서 수행하고 생성 JSON을 직접 수정하지 않는다.
카탈로그 로드가 실패하면 부분 의뢰 목록을 노출하지 않으며 프로필도 기존 저장을 대체하지 않는다.

## 의뢰 상태와 공개 조회 API

GameInstance에서 `UHWGameContentSubsystem`을 얻어 다음 API를 사용한다.

- `IsContentLoaded()` / `GetLoadError()`: 카탈로그 사용 가능 여부와 실패 사유.
- `GetQuests()`: `FHWQuestDefinition` 목록의 복사본.
- `GetQuest(QuestId, OutQuest)`: 단일 의뢰 조회. 실패하면 `OutQuest`도 빈 정의로 초기화한다.

`FHWQuestDefinition`에는 표시명, 추천 레벨·전투력, ChapterId, ArenaId, DungeonId,
선행 arena 목록, ClaimFlag와 ClaimRewards가 있다. 보상 정의의 Min/Max는 양 끝을 포함한다.

`UHWProfileSubsystem::GetQuestState(QuestId)`는 **저장 성공한 프로필**을 기준으로 다음 상태를 반환한다.

| 상태 | 조건 |
|---|---|
| `Unavailable` | 프로필·의뢰가 없거나 정의/영수증을 사용할 수 없음 |
| `Claimed` | 해당 의뢰의 일치하는 수령 영수증이 있음 |
| `Cleared` | 수령 전이며 의뢰 ArenaId의 클리어 기록이 있음 |
| `Locked` | 위 상태가 아니며 선행 arena 중 하나라도 클리어 기록이 없음 |
| `Available` | 선행 조건을 모두 충족했고 아직 해당 arena를 클리어하지 않음 |

판정 우선순위는 수령 → 해당 arena 클리어 → 선행 조건이다. 추천 레벨·전투력은 현재 표시용이며 출격 잠금 조건이 아니다.
별도의 영구적인 ‘의뢰 수락’ 플래그는 없다. 선택은 GameInstance 메모리에만 유지한다.
`Claimed` 의뢰도 재출격을 준비할 수 있지만 보상은 다시 수령할 수 없다.

## 출격 API와 상태 전이

`UHWQuestRunSubsystem`의 Blueprint 공개 API는 다음과 같다.

| API | 동작 |
|---|---|
| `PrepareQuest(QuestId)` | 사용할 수 있는 의뢰의 arena/dungeon과 등록 맵을 확인하고 새 티켓 준비 |
| `PrepareTraining()` | QuestId 없이 `tutorial` / `d01` 조합으로 훈련 티켓 준비 |
| `OpenPreparedEncounter()` | 준비한 맵으로 이동 요청. 반환값 true는 맵 도착 완료를 뜻하지 않음 |
| `GetRunState()` / `GetRunTicket()` / `GetLastError()` | 현재 진행 상태, 티켓 복사본, 실패 사유 조회 |
| `RetryVictorySave()` | 미저장 승리 영수증을 재시도하고 저장된 결과를 확인하면 Victory로 전환 |
| `ResetRun()` | 종료된 실행 또는 준비 상태를 지우고 Idle로 전환 |

정상 경로는 `Idle → Prepared → Traveling → InCombat → VictoryPendingSave → Victory`다.
저장 성공은 동기적으로 이루어지므로 정상 저장에서는 VictoryPendingSave를 짧게 거친다.
플레이어 사망/파괴는 Defeat, 보스의 비정상 파괴나 전투 종료·이동 불일치는 Aborted로 끝난다.
로드된 맵이 GameMode 확인을 하지 않은 경우에도 같은 GameInstance의 로드 완료를 관찰해 Traveling을 Aborted로 종료한다.

준비는 Idle/Prepared에서만 가능하며 미저장 프로필 후보가 있으면 거부한다.
실패한 준비로 기존 티켓을 교체하지 않는다. Traveling, InCombat, VictoryPendingSave,
저장 콜백 처리 중 또는 프로필 미저장 후보가 있는 동안에는 ResetRun을 거부한다.
전투 중 외부 화면 이동으로 월드가 종료되면 실행은 Aborted가 된다. ResetRun 자체가 로비로 이동시키지는 않는다.

티켓에는 `RunId`, `QuestId`, `ArenaId`, `DungeonId`, `MapPackageName`이 들어간다.
`OpenPreparedEncounter()`는 `HWRun=<32자리 GUID>` 옵션으로 OpenLevel을 요청한다.
GameMode는 같은 RunId, arena, dungeon, 맵 패키지를 모두 확인한 뒤에만 InCombat으로 연결한다.
PIE 맵 이름의 StreamingLevelsPrefix는 비교 전에 제거한다.
오래된 토큰, 수동으로 연 맵, 다른 의뢰 맵은 선택 중이던 의뢰의 승리로 인정하지 않는다.
이 토큰은 로컬 실행 연결용이며 서버 인증이나 부정행위 방지 수단은 아니다.

## 맵 경로 등록과 GameMode 설정

현재 `DefaultGame.ini`에는 `UHWEncounterSettings`의 Routes가 등록되어 있지 않다.
훈련도 등록 맵이 없으므로 PrepareTraining 호출만으로 즉시 플레이할 수 없다.
다음은 **작성 형식만 보여 주는 예시**다. 아래 `/Game/Maps/EXAMPLE_*` 맵은 이 변경에 포함되거나 플레이 가능한 맵이 아니다.

```ini
[/Script/HwanghonCombatUE.HWEncounterSettings]
+Routes=(ArenaId="tutorial",DungeonId="d01",Map="/Game/Maps/EXAMPLE_Training.EXAMPLE_Training")
+Routes=(ArenaId="marsh",DungeonId="d02",Map="/Game/Maps/EXAMPLE_Marsh.EXAMPLE_Marsh")
```

실제 World 에셋을 만든 뒤 정확한 경로로 바꾸고 패키징 대상에 포함해야 한다.
경로는 `/Game/` 아래의 World 에셋이며 서브오브젝트 경로를 사용할 수 없다.
같은 arena/dungeon의 중복·불일치 등록과 여러 encounter의 동일 맵 공유를 거부한다.
맵 패키지가 설치/쿠킹되어 있는지도 준비와 이동 요청 때 확인한다.

각 맵의 World Settings에서 `AHWCombatGameMode` 파생 GameMode를 지정하고 클래스 기본값을 맞춘다.

| 예시 맵 | GameMode `EncounterId` | GameMode `DungeonId` |
|---|---|---|
| 훈련 맵 | `tutorial` | `d01` |
| `q_marsh` 맵 | `marsh` | `d02` |

`EncounterId`에는 의뢰의 **ArenaId**를 넣는다. `q_marsh` 같은 QuestId를 넣지 않는다.
`q_marsh`는 저장된 `tutorial` 클리어가 있어야 처음 출격할 수 있다.
등록만 한 뒤 일반 OpenLevel로 열면 의뢰 승리가 인정되지 않는다. 반드시 출격 subsystem을 통해 준비·이동한다.

기존 기본 GameMode의 `Seohan_Combat_VS01`은 별도 회색상자 전투 기록이다.
이 기록을 `tutorial`이나 `marsh`로 변환하지 않으며 의뢰 선행 조건도 풀지 않는다.
실제 arena마다 적절한 전투 콘텐츠를 제작해야 한다. 기존 회색상자를 이름만 바꾸어 전체 의뢰 구현으로 취급하지 않는다.
현재 GameMode는 참여 보스 하나를 선택하고 없으면 기본 보스를 생성하며, 플레이어 시작 위치·회색상자·조명·감사 액터도 배치한다.
다중 보스·웨이브 목표와 arena별 구성, 완성된 맵 연출은 별도 작업이다.

GameMode는 시작 시 원래 플레이어 객체를 보관하므로 possession 변경으로 사망 판정을 우회하지 않는다.
해당 플레이어가 죽었거나 유효하지 않으면 보스 사망 콜백에서도 승리를 기록하지 않는다.
이미 결정된 승패는 뒤이은 콜백으로 다시 기록하지 않는다. 퀘스트 실행 완료와 패배 처리 API는 GameMode 전용이며 Blueprint에 공개하지 않는다.

## 보상 수령과 저장 API

`UHWProfileSubsystem`에서 `ClaimQuest(QuestId)`를 호출하면 Cleared인 의뢰의 사무소 보상을 수령한다.
의뢰별 한 번만 수령하며 이미 저장된 Claimed 의뢰의 재호출은 false다.
다음 조회 API는 미저장 후보를 포함하지 않는다.

- `IsProfileAvailable()`: 사용할 수 있는 프로필 존재 여부.
- `GetClearCount(EncounterId)`: 저장된 해당 encounter 클리어 횟수.
- `GetGold()` / `GetExperience()` / `GetItemCount(ItemId)`: 저장된 사무소 보상 누적 수령량.
- `HasPendingSave()` / `GetLastError()`: 저장 실패 후보와 오류 확인.
- `RetryPendingSave()`: 같은 미저장 후보를 다시 저장. 후보가 없으면 false.

`RecordVictory(RunId, EncounterId)`와 `HasSavedVictory(RunId, EncounterId)`는 C++ API다.
UI에서 승리를 만들어 내는 용도로 사용하지 않는다. 같은 RunId/EncounterId의 기록은 중복 증가하지 않고,
같은 RunId를 다른 EncounterId에 재사용하면 거부한다. 다른 RunId의 재클리어는 별도 횟수로 기록한다.

저장은 프로필 복사본에서 먼저 계산한다. 클리어 또는 보상 영수증과 Gold/Experience/Inventory를 함께 저장하고,
저장이 성공한 뒤에만 조회용 프로필을 교체한다. 음수·불일치·중복 영수증과 int64 합계 오버플로를 거부한다.
랜덤 보상은 양 끝을 포함한 정수 범위에서 한 번 결정하고 실제 수량을 영수증에 남긴다.
같은 미저장 의뢰를 다시 ClaimQuest하거나 RetryPendingSave해도 그 후보의 수량을 다시 뽑지 않는다.

저장 실패 후보는 GameInstance 메모리에 남아 맵 이동 뒤에도 재시도할 수 있다.
Profile API의 후속 클리어/수령도 이 후보에 누적될 수 있지만 출격 subsystem은 후보가 남아 있으면 새 실행을 시작하지 않는다.
실패한 클리어가 후보에만 있으면 공개 의뢰 상태는 아직 Cleared가 아닐 수 있다. UI는 먼저 저장 오류와 재시도를 안내한다.
앱 종료 전에 저장에 성공하지 못한 후보는 사라진다. 디스크에 별도 미저장 저널을 남기거나 프로세스 재시작을 복원하는 구현은 없다.

| 이벤트 | 발생 시점 |
|---|---|
| `OnClearSaved(EncounterId, ClearCount)` | 디스크 저장 성공 후, 그 저장에서 바뀐 encounter의 확정 횟수 |
| `OnQuestClaimed(QuestId)` | 새 수령 영수증이 디스크에 저장된 뒤 |
| `OnProfileError(Message)` | 실패 사유 공개. 오류 리스너의 재시도로 재귀적인 오류 알림이 반복되지 않도록 방어 |

완료 알림은 커밋된 값을 큐에 넣어 순서대로 전달하므로 알림 중 후속 저장이 발생해도 앞선 값이 바뀌지 않는다.
실패나 변경 없는 재시도에는 보상 완료 알림을 내보내지 않는다.
승리 저장 중 리스너에서 RetryVictorySave/ResetRun을 호출해 현재 티켓을 바꾸는 것은 차단한다.
Profile의 재시도로 승리가 저장되었더라도 실행 상태가 VictoryPendingSave라면 RetryVictorySave를 호출해 Victory로 마무리한다.

### 사무소 수령량과 경제의 경계

이번 수령은 JSON `claimRewards`만 사용한다. arena의 rewards, firstClear, drops, loot는 지급하지 않으며 합치지 않는다.
예를 들어 `q_marsh`의 사무소 합금 2100과 arena의 합금 24는 서로 다른 원본 값이다.
GetGold/GetExperience/GetItemCount는 0에서 시작한 **사무소 보상 누적 수령 기록**이다.
웹 게임의 초기 소지량·현재 지갑·상점 구매·아이템 소비·장비 보유량을 이식한 값이 아니다.
경험치 임계값이나 레벨업도 구현하지 않았다.

현재 프로필 검증은 수령 영수증을 모두 합산한 값과 Gold/Experience/Inventory가 정확히 일치해야 통과한다.
따라서 상점이나 제작 구현에서 이 필드를 그대로 차감하면 저장 검증이 실패한다.
소비 가능한 지갑·인벤토리는 별도 거래 계약과 마이그레이션을 설계한 뒤 연결해야 한다.

## 저장 버전과 마이그레이션

저장 객체의 현재 Version은 **2**이며 슬롯 이름은 기존 **`HwanghonCombatUE_Profile_v1`**, 사용자 인덱스 0을 유지한다.
슬롯 이름의 v1은 현재 내부 버전 번호가 아니다.

- 유효한 v1 클리어 영수증을 유지하고 v2의 누적 수령량과 Claims를 빈 상태로 초기화한다.
- v1인데 v2 전용 금액·아이템·수령 기록이 들어 있는 경우는 버리지 않고 로드를 거부한다.
- v1→v2 변환은 로드 시 메모리에서 이루어지며, 초기화만으로 슬롯을 다시 쓰지 않는다. 이후 변경 저장에 v2가 기록된다.
- 새 프로필도 첫 변경 저장 전에는 디스크에 쓰지 않는다.
- 알 수 없는 버전, 잘린 직렬화 데이터, 중복·잘못된 영수증, 합계 불일치, 카탈로그와 맞지 않는 수령 기록은 프로필 사용을 거부한다.
- 실패한 기존 파일을 빈 세이브로 덮어쓰는 자동 복구는 없다. UI는 IsProfileAvailable과 오류를 표시해야 한다.
- 저장된 수령량은 현재 의뢰 정의의 ID·종류·수량 범위와 일치해야 한다. 후속 콘텐츠 변경으로 범위를 바꾸려면 기존 세이브 호환 정책도 함께 설계한다.

`InitializeProfile(Storage, Quests)`는 C++ 초기화/테스트용 진입점이며 저장 adapter와 카탈로그 복사본을 받는다.
이미 초기화한 프로필을 다시 초기화하는 호출은 거부한다.

## UI 연결 순서와 남은 작업

UI 구현 시에는 카탈로그/프로필 사용 가능 여부를 확인한 뒤 의뢰 목록에 저장된 QuestState를 표시한다.
선택 → PrepareQuest 또는 PrepareTraining → OpenPreparedEncounter를 연결하고,
결과에서는 RunState와 저장 오류를 구분한다. Victory에서 보상 수령을 요청하고 OnQuestClaimed 뒤 수령 완료를 표시한다.
복귀·재도전은 미저장 데이터를 해소한 뒤 ResetRun하고 별도 맵 이동/준비를 수행한다.

남은 검증·구현은 다음과 같다.

1. 실제 훈련/의뢰 맵과 arena별 전투 콘텐츠 제작, GameMode 식별자 설정, Routes와 패키징 등록.
2. 로비·의뢰·출격·패배·승리·보상·저장 실패 UI, 복귀와 재도전 조작 연결.
3. 목표 UE 5.5에서 빌드와 자동화, 실제 이동·플레이·종료·재실행 검증. UE 5.8 호환성 진단은 대체 검증이 아니다.
4. Android 패키징, 실기기 입력·성능·저장 실패/종료 복구 검증.
5. 화면 변경 시 저장소 규약에 따른 렌더 이미지, 모바일 가로·세로 확인, 실제 게임 흐름 영상.
6. 소비 가능한 경제, 장비·스킬·제작·상점·스토리와 별도의 저장 계약 연결.

맵 경로가 비어 있는 현 상태에서 자동화 테스트가 통과하더라도 전체 게임 루프의 실플레이 완료로 보고하지 않는다.
