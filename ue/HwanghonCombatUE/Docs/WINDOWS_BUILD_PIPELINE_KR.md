# Windows 원클릭 Build / Setup / Test

UE 5.5가 설치된 Windows PC에서:

```powershell
cd HwanghonCombatUE
powershell -ExecutionPolicy Bypass -File .\Scripts\build_setup_test_windows.ps1 `
  -UERoot "C:\Program Files\Epic Games\UE_5.5" `
  -HwanghonRepo "D:\work\hwanghon"
```

자동 실행:

0. 선택한 엔진의 `Engine/Build/Build.version`과 `.uproject`의 `EngineAssociation` 비교
1. `HwanghonCombatUEEditor Win64 Development` 컴파일
2. UE Editor Python으로 기존 GLB 임포트 + `Seohan_Combat_VS01` 생성
3. `ue_asset_audit.py` 실행
4. `Hwanghon.` Automation tests 실행 후 리포트 검증 (`Combat`, `Progression` 포함)

프로젝트 대상은 **UE 5.5**다. `UE_5.5`처럼 보이는 폴더 이름만 믿지 않고
실제 엔진 버전을 읽는다. 5.5 패치는 허용하지만 5.8 등 다른 마이너 버전은
컴파일·에디터 실행 **전에** 실패한다. 프로젝트를 자동으로 다른 버전으로 변경하지 않는다.

에셋 임포트와 맵 생성을 건너뛰고 컴파일·에셋 감사·테스트만 실행:

```powershell
powershell -ExecutionPolicy Bypass -File .\Scripts\build_setup_test_windows.ps1 -SkipImport
```

환경변수로도 가능:

```powershell
$env:UE55_ROOT="C:\Program Files\Epic Games\UE_5.5"
$env:HWANGHON_REPO="D:\work\hwanghon"
.\Scripts\build_setup_test_windows.ps1
```

## 실패 시

스크립트는 첫 실패에서 즉시 종료한다.

- Engine version 실패 → UE 5.5 설치 경로를 지정
- Compile 실패 → C++ 먼저 수정
- Setup 실패 → Editor Python/import 문제
- Asset audit 실패 → 에셋 감사 로그 확인
- Test 실패 → 해당 실행의 `automation.log`와 `index.json` 확인

## Automation PASS 조건

매 실행은 `Saved/AutomationReport/<새 GUID>/`에 `index.json`과 `automation.log`를
기록한다. 기존 실행 폴더를 재사용하거나 오래된 리포트를 대신 읽지 않는다.

다음 조건을 모두 만족해야 마지막에 `PASS: N automation tests`를 출력한다.

- 에디터 프로세스 종료 코드가 0
- 이번 실행의 `index.json`이 존재하고 수정 시각이 실행 시작 이후
- JSON 구조와 정수 집계가 올바르고 테스트 수가 1 이상
- `failed`, `notRun`, `inProcess`가 모두 0
- 모든 개별 테스트가 `Success`이고 오류 수와 오류 이벤트가 없음
- 성공 수와 경고가 있는 성공 수가 개별 테스트 수 및 경고 기록과 일치
- 테스트 경로가 `Hwanghon.`으로 시작하고 중복이 없음
- `Hwanghon.Combat.`와 `Hwanghon.Progression.`에서 각각 최소 1개 실행

경고가 있는 성공은 허용하되 최종 출력에 별도 개수를 표시한다. 프로세스 종료 코드만
0이거나 테스트가 0개인 실행은 성공으로 처리하지 않는다.

명령은 `-ExecCmds="Automation RunTest Hwanghon.;Quit"`을 사용한다.
이 `Quit`은 Automation 큐의 테스트 종료 후 실행하는 UE 5.5 공식 문서의 구문이다.
`-TestExit`는 Epic의 이슈 설명에서 legacy 방식으로 분류하므로 추가하지 않는다.

- [UE 5.5 Automation 실행 및 JSON 리포트](https://dev.epicgames.com/documentation/en-us/unreal-engine/run-automation-tests-in-unreal-engine?application_version=5.5)
- [Epic UE-170942: Automation 큐와 종료 구문](https://issues.unrealengine.com/issue/UE-170942)
- [Build.version의 엔진 버전 필드](https://dev.epicgames.com/documentation/en-us/unreal-engine/versioning-of-assets-and-packages-in-unreal-engine?application_version=5.5)

## 에디터 없이 검증기 회귀 테스트

저장소 루트에서:

```powershell
node --test tests/ue-automation-report.test.mjs
python ue/HwanghonCombatUE/Scripts/verify_scaffold.py
```

첫 명령은 Windows PowerShell(다른 OS에서는 `pwsh`)로 실제 검증 함수를 실행한다.
성공·실패·미실행·실행 중·0개·오래된 파일·깨진 JSON·잘못된 집계·중복 경로·필수
스위트 누락·엔진 버전 불일치를 검사한다. 개별 테스트 상태 검사 코드를 임시 복사본에서
일부러 비활성화했을 때 회귀 테스트가 실패하는 mutation 검사도 포함한다.
PowerShell이 없는 환경에서는 이 테스트를 건너뛴 것으로 표시한다.

두 번째 명령은 파일 구조와 코드 연결을 확인한다. 이 두 명령의 성공은 **UE 컴파일,
PIE 플레이, Android 패키징 또는 화면 품질을 검증했다는 의미가 아니다**. 실제 엔진
테스트는 위 Windows 빌드 파이프라인으로 별도 실행해야 한다.
