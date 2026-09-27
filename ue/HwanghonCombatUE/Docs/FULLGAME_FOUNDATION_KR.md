# 전체 게임 연결 기반 — 2026-09-28

이 문서는 첫 기반 작업(`50af9fe`) 당시의 기록이다. 이후 추가한 의뢰 상태·출격 검증·
보수 수령·v2 저장 계약은 [의뢰 진행 연결](QUEST_PROGRESSION_KR.md)을 따른다.
아래의 ‘보상 지급 미구현’과 10개 엔진 테스트 수치는 첫 단계에 해당한다.

기준 커밋은 `9612ada787d994e3848a2b8b6610ff8a48a9780d`이며 목표 엔진은 **UE 5.5**다.
모바일 대화에서 언급된 `HWANGHON_UE_FULLGAME_V2_3_WHOLE_SHELL_FINAL.zip` 원본은
이번 작업에서 확보하지 못했다. 이 변경은 저장소에 실제 존재하는 전투 코드 위에
추가한 기반 작업이다. 전체 게임이나 v2.3 패키지의 적용 완료를 뜻하지 않는다.

## 이번 연결

1. `node tools/ue/export-game-content.mjs`가 기존 JS 정적 데이터를
   `Content/Data/game_content.json`으로 변환한다. 생성 JSON을 직접 편집하지 않는다.
2. `UHWGameContentSubsystem`이 해당 JSON을 로드하고 검증한 의뢰 정의를
   `GetQuests` / `GetQuest`로 제공한다. 오류는 `IsContentLoaded` / `GetLoadError`로 확인한다.
3. 보스 HP가 0이 되면 `Dead`로 전환하고 공격·돌진·이동·충돌·기존 락온을 종료한다.
   `OnBossDied`는 한 번만 발생한다. 카운터·경직 중단 뒤 같은 프레임의 후속 타격도 취소한다.
4. `AHWCombatGameMode`가 한 전투마다 생성한 RunId로 처치를 기록한다.
   기본 EncounterId는 **`Seohan_Combat_VS01`**이다. 아직 의뢰 arenaId와 동일한 체계가 아니다.
5. `UHWProfileSubsystem` / `UHWSaveGame`이 전투별 처치 영수증을
   `HwanghonCombatUE_Profile_v1` 슬롯에 저장한다. 같은 RunId의 재호출은 중복 계산하지 않는다.
   다른 RunId로 다시 처치하면 별도 기록으로 계산한다.

## 저장 상태 확인

- `GetClearCount(EncounterId)`는 **저장 성공한** 횟수다.
- `OnClearSaved(EncounterId, ClearCount)`는 디스크 저장에 성공한 뒤 발생한다.
- 실패한 저장 후보는 GameInstance 메모리에 유지한다. 이후 승리도 후보에 누적한다.
  `HasPendingSave`와 `RetryPendingSave`로 상태 확인/재시도한다.
- 앱이 종료되기 전에 저장 재시도가 성공하지 않으면 메모리의 미저장 기록은 사라진다.
- 읽기 오류·지원하지 않는 버전·잘못된 영수증을 가진 기존 세이브는 덮어쓰지 않는다.
  `GetLastError`와 `OnProfileError`로 문제를 표시한다.
- UI 콜백에서 추가 저장이 발생해도 완료 알림은 각 커밋 시점의 횟수를 순서대로 전달한다.

## 경제와 데이터 경계

JSON에는 캐릭터 4명, 의뢰 6개, 아이템 50개, 제작법 15개, 던전/arena 7개,
스토리 챕터 8개 및 관련 카탈로그가 있다. UE의 첫 조회 API는 의뢰·수령 보상에 한정한다.
좌표와 시간 단위는 JSON의 `units`를 읽는다. 모든 좌표가 UE cm로 변환된 것은 아니다.

`claimRewards`는 인력사무소에서 수령하는 기존 보상이다. arena 전투 보상과 합치지 않는다.
예를 들어 `q_marsh`의 사무소 합금 보상 2100과 arena 합금 보상 24는 원본부터 서로 다르다.
이번 변경은 보상 지급, XP/레벨업, 장비, 강화, 경제 수치 변경을 수행하지 않는다.
전투 수치도 변경하지 않는다.

## 다음 구현 순서

1. UE 5.5에서 Editor target 빌드 후 `Hwanghon.` 자동화 전체 실행.
2. 의뢰 수락 상태와 전투 출격 설정을 만들고, `arenaId` / `dungeonId` / UE 맵을 명시적으로 연결.
   현재 서한역 전투 결과를 임의로 모든 의뢰 클리어로 취급하지 않는다.
3. JSON 조회 API를 사용하는 의뢰/결과 화면 연결. 보상 미지급·저장 실패 상태를 표시.
4. 의뢰 보상 수령 플래그와 골드/XP/인벤토리를 **한 저장 트랜잭션**에 반영.
   재실행·중복 클릭·저장 실패로 보상이 중복 지급되지 않는 테스트를 먼저 둔다.
5. 실제 New Game → 의뢰 → 보스 처치 → 결과 → 저장 → 재실행 흐름을 영상으로 검증.
6. 이후 기존 데이터 기반 장비/스킬/제작/상점/외형/스토리 화면과 Android 실기기 검증.

## 검증 명령

```powershell
node tools/ue/export-game-content.mjs
npm test
python ue/HwanghonCombatUE/Scripts/verify_scaffold.py
& ue/HwanghonCombatUE/Scripts/build_setup_test_windows.ps1 -UERoot 'C:\Program Files\Epic Games\UE_5.5' -HwanghonRepo (Get-Location).Path
```

빌드 스크립트는 엔진 버전을 확인하고, 매 실행의 새 자동화 JSON 보고서를 검사한다.
프로세스 종료 코드만으로 테스트 성공을 선언하지 않는다.
UE 5.8에서 수행한 호환성 진단은 UE 5.5 검증이나 Android 검증을 대체하지 않는다.
실제 화면을 바꾸는 후속 작업은 프로젝트 규약에 따라 렌더 이미지와 실기 영상으로 확인한다.

## 이번 실행 결과

2026-09-28 Windows 환경에서 확인했다.

| 검사 | 결과 |
|---|---|
| 전체 `npm test` | 547/547 PASS |
| 정적 콘텐츠 변환 테스트 | 7/7 PASS, 생성 JSON 변조를 테스트가 탐지 |
| 자동화 보고서 검증 테스트 | 3/3 PASS, 43개 PowerShell 조건 및 상태 검사 제거 변조 탐지 |
| Python scaffold 검사 | PASS — 컴파일 검증과 별개 |
| UE 5.8.1 Win64 Editor 호환성 빌드 | PASS |
| UE 5.8.1 `Hwanghon.` 자동화 | 10/10 PASS, 오류·경고·미실행 0 |
| 목표 UE 5.5 빌드/PIE | 미실행 — 이 PC에서 해당 엔진을 찾지 못함 |
| Android 패키징·실기·화면 검수 | 미실행 |

UE 자동화는 Combat 5개, Content 2개, Progression 3개다. 첫 실행에서
중복 영수증을 만드는 테스트 자체가 같은 TArray의 요소를 직접 Add해서 assert가 났다.
요소를 별도 값으로 복사한 뒤 추가하도록 고쳤고, 전체 10개를 다시 실행해 통과했다.
호환성 검사 중 에디터가 자동 생성한 5.8 전용 설정과 AndroidFileServer 토큰은
최종 변경에 포함하지 않았다. 목표 버전은 5.5 그대로다.
