# HwanghonCombatUE — 네이티브 전투·사무소 프로토타입

이 폴더는 황혼의 기존 Three.js 전투를 꾸미는 패치가 아니라,
**새 UE5 모바일 전투 Vertical Slice의 첫 C++ 기반**이다.

## 사무소 → 훈련장 실행

`HW_Lobby`에서 지하 훈련장을 출격하면 `HW_Training`으로 이동한다.
전투 HUD, 클리어·패배 화면, 저장 재시도, 재도전, 사무소 복귀를 연결했다.
의뢰 목록과 저장된 해금·보수 상태를 표시하지만, 현재 실행 가능한 경로는
**훈련장(`tutorial` / `d01`) 하나**다. 나머지 의뢰는 전투 맵 준비 중이다.

훈련장 플레이어·보스는 Engine 기본 도형으로 만든 색상 실루엣이다.
공격 자세, 예고·타격 색, 쓰러짐을 보여 주는 회색상자 단계이며 최종 캐릭터·애니메이션은 아직 필요하다.

프로젝트 목표 버전은 **UE 5.5**다. 아래 명령은 이 폴더에서 실행한다.
`UE55_ROOT`를 설치한 5.5 경로로 설정하고, 그 엔진으로 C++와 맵을 함께 만든다.

```powershell
$UERoot = $env:UE55_ROOT
$Project = (Resolve-Path .\HwanghonCombatUE.uproject).Path
. .\Scripts\build_validation.ps1
Assert-HWEngineVersion -UERoot $UERoot -Project $Project
& "$UERoot\Engine\Build\BatchFiles\Build.bat" HwanghonCombatUEEditor Win64 Development "-Project=$Project" -WaitMutex
if ($LASTEXITCODE -ne 0) { throw 'C++ build failed' }
$Setup = (Resolve-Path .\Scripts\ue_setup.py).Path
$PriorShellOnly = $env:HW_SHELL_ONLY
try {
    $env:HW_SHELL_ONLY = '1'
    & "$UERoot\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" $Project /Engine/Maps/Entry "-ExecutePythonScript=$Setup" -unattended -nop4 -nosplash
    if ($LASTEXITCODE -ne 0) { throw 'Shell setup failed' }
} finally {
    $env:HW_SHELL_ONLY = $PriorShellOnly
}
& "$UERoot\Engine\Binaries\Win64\UnrealEditor.exe" $Project
```

`HW_SHELL_ONLY=1`은 기존 GLB 수입과 기존 전투 맵 생성을 건너뛴다.
스크립트는 `/Game/Maps/HW_Lobby`, `/Game/Maps/HW_Training`,
`/Game/Materials/M_HWPrototypeColor`를 없을 때만 생성한다.
이 세 바이너리 에셋은 Git에서 제외되며 사용하는 엔진에서 다시 생성해야 한다.
5.8 진단용 에셋이 남은 작업 폴더를 5.5에서 재사용하지 말고 새 체크아웃에서 생성한다.
기존 맵은 보존하고 GameMode가 예상과 다르면 로그로 알린다.
에디터에서 `HW_Lobby`를 열고 PIE로 시작한다.

이동은 WASD, 락온 T, 공격 J/Space, 강타 U, 회피 K, 점프 I, 카운터 L이다.
화면의 이동 버튼은 누르는 동안 이동하며, 행동 버튼도 마우스·터치 입력을 받는다.
실제 Android 기기의 멀티터치·성능은 별도 검증 대상이다.

### 격리된 화면·저장 실패 QA

개발 빌드의 자동 시나리오는 실제 맵 이동과 Slate 버튼 입력을 수행하고
PNG 및 `shell-qa.json`을 지정한 폴더에 남긴다. 일반 저장과 분리하기 위해
`-HWShellQA`, `Hwanghon_Automation_`으로 시작하는 영숫자·밑줄 슬롯,
절대 경로 `-HWScreenshotDir`를 함께 지정한다. QA 드라이버는 Shipping 빌드에 포함되지 않는다.

```powershell
$ShellQaSlot = 'Hwanghon_Automation_' + [guid]::NewGuid().ToString('N')
$ShellQaDir = Join-Path (Get-Location) 'Saved\ShellQA\Desktop'
& "$UERoot\Engine\Binaries\Win64\UnrealEditor.exe" $Project /Game/Maps/HW_Lobby -game -windowed -ResX=1672 -ResY=952 -HWShellQA "-HWProfileSlot=$ShellQaSlot" "-HWScreenshotDir=$ShellQaDir" -HWShellScenario=full
```

`full`은 근거리로 이동시킨 뒤 실제 공격 접촉, 저장 실패 주입·재시도,
승리·재도전·패배·복귀, 종료 확인 중 일시정지·취소·중도 종료를 검사한다. 승리·패배 전환에는 스크립트 피해를 사용한다.
`lobby`는 사무소 화면만, `reload`는 동일 QA 슬롯을 다시 열어 훈련 기록 보존을 검사한다.
저장 실패 변수 `hw.QA.FailProfileSaves`는 유효한 격리 QA 슬롯에만 적용된다.
아래 runner는 1672×952 전체·재로드, 390×844 전체, 844×390 전체를 각각 격리 실행한다.
정확한 PNG 치수, 64px 이상 버튼, 포인터 클릭, 저장 횟수를 검사하며 전체 25장을 생성한다.
목록 패널 내부에서 의도적으로 스크롤되는 행의 세로 잘림은 별도 수치로 기록한다.

```powershell
.\Scripts\run_shell_qa.ps1 -UERoot $UERoot
```

UE 5.8에서 수행한 호환성 진단은 UE 5.5 빌드·Android 기기 검증을 대신하지 않는다.

## 현재 들어간 것

### 플레이어
- WASD 이동
- T 락온
- Space/J 기본 공격
- U Smash
- K Dodge
- I Jump
- L Counter
- Attack1 → Attack2 → Attack3 direct queue/handoff
- 0.66s / hit 0.24s 기본 3타
- dodge iframe / jumpOnly 판정 기반
- hitstop
- stamina

### 보스
- LockOnTarget
- HookCombo
- Charge
- Slam
- Spin
- GroundWave(jumpOnly)
- tell → strike → recovery state
- lunge 이동
- counterable beat
- additive reaction용 Blueprint event

### Graybox
- 바닥/벽
- warm key + red accent
- empty level에서 GameMode가 arena와 boss를 자동 spawn
- player를 시작 위치로 재배치

### 모바일
- Android Vulkan
- Mobile Deferred `r.Mobile.ShadingPath=1`
- High-tier baseline

Mobile Deferred를 High tier 기준으로 설정했다. 실제 Android 성능·화질은 측정이 필요하다.

## 아직 없는 것

- 실제 아인/카인/보스 hero mesh
- Animation Blueprint
- Montage/animation source
- weapon socket
- trail/VFX
- 최종 HUD 아트와 실제 장비·상점 화면
- Android 실기기 빌드 측정
- Mobile Forward fallback profile

이것들은 다음 단계에서 얹는다.

## 기존 전투 전용 맵 실행

1. UE 5.5에서 `HwanghonCombatUE.uproject` 열기 (uproject EngineAssociation 5.5 — 디렉터 결정 2026-09-27)
2. C++ compile
3. Empty Level 생성
4. World Settings GameMode = `HWCombatGameMode`
5. PIE
6. T로 보스 lock-on
7. 1→2→3 / smash / dodge / jump / counter 확인

GameMode가 player 위치, graybox arena, boss를 자동으로 준비한다.

## 코드 검증

UE 없이도:

```bash
python Scripts/verify_scaffold.py
```

UE가 있는 환경에서는 Automation:
- `Hwanghon.Combat.PlayerTimingDefaults`
- `Hwanghon.Combat.BossVerticalSlicePatterns`

를 실행한다.

## 다음 우선순위

1. Animation Blueprint + Montage section
2. Ain 1/2/3 실제 animation source
3. boss tell/strike/recover 실제 animation
4. contact notify
5. foot plant
6. gray material 상태 20초 영상
7. 그 뒤 hero model/material/lighting
