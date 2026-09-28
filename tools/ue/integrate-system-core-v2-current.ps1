param(
    [string]$UERoot = $env:UE58_ROOT,
    [switch]$SkipServerTests
)

$ErrorActionPreference = "Stop"
$Repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Project = Join-Path $Repo "ue\HwanghonCombatUE\HwanghonCombatUE.uproject"
$MapScript = Join-Path $Repo "ue\HwanghonCombatUE\Scripts\build_online_raid_graybox.py"
$ReportDir = Join-Path $Repo "ue\HwanghonCombatUE\Saved\AutomationReportSystemV2"

function Step([string]$Name,[scriptblock]$Body) {
    Write-Host "`n===== $Name ====="
    & $Body
    if ($LASTEXITCODE -ne 0) { throw "$Name failed: exit $LASTEXITCODE" }
}

Push-Location $Repo
try {
    Step "0. System-core preflight dry run" {
        python tools/ue/preflight-system-core-v2.py
    }
    Step "1. Local system core" {
        python tools/ue/apply-system-core-v1.py
    }
    Step "2. Boss + dungeon integration" {
        python tools/ue/apply-system-core-v1-part2.py
    }
    Step "3. Current-main authoritative network" {
        python tools/ue/apply-system-core-v2-current.py
    }
    Step "4. Selected-character persistence + pawn binding" {
        python tools/ue/apply-system-core-v2-1-selection.py
    }
    Step "5. System regression tests" {
        node --test tests/system-core-v1.test.mjs tests/system-core-v2-network.test.mjs tests/system-core-v2-selection.test.mjs tests/system-core-v3-server-snapshot.test.cjs tests/system-core-v2-server-smoke.test.cjs
    }
    Step "6. Static contracts" {
        python scripts/verify_system_core_v1.py
        python scripts/verify_system_core_v2.py
    }
    if (!$SkipServerTests) {
        Step "7. Existing project/server tests" {
            npm test
        }
    }

    if ([string]::IsNullOrWhiteSpace($UERoot)) {
        foreach ($Candidate in @(
            "C:\Program Files\Epic Games\UE_5.8",
            "D:\Epic Games\UE_5.8"
        )) {
            if (Test-Path $Candidate) { $UERoot = $Candidate; break }
        }
    }

    if (![string]::IsNullOrWhiteSpace($UERoot) -and (Test-Path $UERoot)) {
        $Build = Join-Path $UERoot "Engine\Build\BatchFiles\Build.bat"
        $EditorCmd = Join-Path $UERoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"

        Step "8. UE 5.8 Editor compile" {
            & $Build HwanghonCombatUEEditor Win64 Development "-Project=$Project" -WaitMutex
        }

        Step "9. Online raid graybox map" {
            & $EditorCmd $Project "-ExecutePythonScript=$MapScript" -unattended -nop4 -nosplash
        }

        New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
        Step "10. Hwanghon UE automation" {
            & $EditorCmd $Project `
                '-ExecCmds=Automation RunTest Hwanghon.;Quit' `
                "-ReportExportPath=$ReportDir" `
                -unattended -nop4 -nosplash -NullRHI
        }
    }
    else {
        Write-Warning "UE 5.8 not found. Static/tests passed; compile/runtime validation remains."
    }

    Write-Host "`n===== SYSTEM CORE V2 CURRENT PASS ====="
    Write-Host "Next manual/server QA: 1P -> 2P -> 4P -> down/revive -> parts -> phase -> wipe/retry -> reconnect"
}
finally {
    Pop-Location
}
