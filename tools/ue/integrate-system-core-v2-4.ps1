param(
    [string]$UERoot = $env:UE58_ROOT,
    [switch]$SkipUEQA,
    [switch]$SkipProjectTests
)

$ErrorActionPreference = "Stop"
$Repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Project = Join-Path $Repo "ue\HwanghonCombatUE\HwanghonCombatUE.uproject"

if ([string]::IsNullOrWhiteSpace($UERoot)) {
    foreach ($Candidate in @(
        "C:\Program Files\Epic Games\UE_5.8",
        "D:\Epic Games\UE_5.8"
    )) {
        if (Test-Path $Candidate) { $UERoot = $Candidate; break }
    }
}

function Step([string]$Name, [scriptblock]$Block) {
    Write-Host "`n===== $Name ====="
    & $Block
    if ($LASTEXITCODE -ne 0) { throw "$Name failed: exit $LASTEXITCODE" }
}

Push-Location $Repo
try {
    Step "1. v2.4 preflight" {
        python tools/ue/preflight-system-core-v2-4.py
    }

    Step "2. Apply v2.4 delta" {
        python tools/ue/apply-system-core-v2-4.py
    }

    Step "3. v2.4 static/server regression" {
        node --test tests/system-core-v2-4-delta.test.mjs tests/system-core-v2-4-server.test.cjs
    }

    if (!$SkipProjectTests) {
        Step "4. Existing project/server tests" {
            npm test
        }
    }

    if ([string]::IsNullOrWhiteSpace($UERoot) -or !(Test-Path $UERoot)) {
        throw "UE 5.8 root not found. Set UE58_ROOT."
    }

    $Build = Join-Path $UERoot "Engine\Build\BatchFiles\Build.bat"
    $EditorCmd = Join-Path $UERoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"

    Step "5. UE 5.8.1 compile" {
        & $Build HwanghonCombatUEEditor Win64 Development "-Project=$Project" -WaitMutex
    }

    Step "6. Character identity + full Hwanghon automation" {
        & $EditorCmd $Project `
            '-ExecCmds=Automation RunTest Hwanghon.System.CharacterIdentity;Automation RunTest Hwanghon.*;Quit' `
            -unattended -nop4 -nosplash -NullRHI
    }

    if (!$SkipUEQA) {
        Step "7. Existing real 1P/2P/4P SYSTEM CORE QA" {
            node tools/ue/system-core-qa.cjs all
        }
    }

    Write-Host "`n===== SYSTEM CORE v2.4 PASS ====="
}
finally {
    Pop-Location
}
