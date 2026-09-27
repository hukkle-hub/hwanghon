# Windows 원클릭 Build / Setup / Test

UE 5.8이 설치된 Windows PC에서:

```powershell
cd HwanghonCombatUE
powershell -ExecutionPolicy Bypass -File .\Scripts\build_setup_test_windows.ps1 `
  -UERoot "C:\Program Files\Epic Games\UE_5.8" `
  -HwanghonRepo "D:\work\hwanghon"
```

자동 실행:

1. `HwanghonCombatUEEditor Win64 Development` 컴파일
2. UE Editor Python으로 기존 GLB 임포트 + `Seohan_Combat_VS01` 생성
3. `Hwanghon.Combat` Automation tests
4. `Saved/AutomationReport`에 리포트

에셋 임포트 없이 코드만:

```powershell
powershell -ExecutionPolicy Bypass -File .\Scripts\build_setup_test_windows.ps1 -SkipImport
```

환경변수로도 가능:

```powershell
$env:UE58_ROOT="C:\Program Files\Epic Games\UE_5.8"
$env:HWANGHON_REPO="D:\work\hwanghon"
.\Scripts\build_setup_test_windows.ps1
```

## 실패 시

스크립트는 첫 실패에서 즉시 종료한다.

- Compile 실패 → C++ 먼저 수정
- Setup 실패 → Editor Python/import 문제
- Test 실패 → combat rule 문제

UI/그래픽 작업은 이 세 단계가 PASS한 뒤 시작한다.
