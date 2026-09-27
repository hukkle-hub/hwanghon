param(
    [string]$UERoot = $env:UE55_ROOT,
    [string]$HwanghonRepo = $env:HWANGHON_REPO,
    [switch]$SkipImport
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot 'build_validation.ps1')
$ProjectDir = Split-Path -Parent $PSScriptRoot
$Project = Join-Path $ProjectDir "HwanghonCombatUE.uproject"
$SetupScript = Join-Path $ProjectDir "Scripts\ue_setup.py"
$AssetAuditScript = Join-Path $ProjectDir "Scripts\ue_asset_audit.py"
$ReportDir = Join-Path $ProjectDir "Saved\AutomationReport"

if ([string]::IsNullOrWhiteSpace($UERoot)) {
    $Candidates = @(
        "C:\Program Files\Epic Games\UE_5.5",
        "D:\Epic Games\UE_5.5"
    )
    foreach ($C in $Candidates) {
        if (Test-Path $C) {
            $UERoot = $C
            break
        }
    }
}

if ([string]::IsNullOrWhiteSpace($UERoot) -or !(Test-Path $UERoot)) {
    throw "UE 5.5 root not found. Set UE55_ROOT or pass -UERoot."
}

$EngineVersion = Assert-HWEngineVersion -UERoot $UERoot -Project $Project
$BuildBat = Join-Path $UERoot "Engine\Build\BatchFiles\Build.bat"
$EditorCmd = Join-Path $UERoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"

if (!(Test-Path $BuildBat)) { throw "Build.bat not found: $BuildBat" }
if (!(Test-Path $EditorCmd)) { throw "UnrealEditor-Cmd.exe not found: $EditorCmd" }

Write-Host "== Hwanghon UE Vertical Slice =="
Write-Host "UE: $UERoot"
Write-Host "Verified engine version: $EngineVersion"
Write-Host "Project: $Project"

Write-Host "`n[1/4] Compile Editor target"
& $BuildBat HwanghonCombatUEEditor Win64 Development "-Project=$Project" -WaitMutex
if ($LASTEXITCODE -ne 0) {
    throw "UE compile failed: exit $LASTEXITCODE"
}

if (!$SkipImport) {
    Write-Host "`n[2/4] Editor setup / import / map generation"
    if (![string]::IsNullOrWhiteSpace($HwanghonRepo)) {
        $env:HWANGHON_REPO = $HwanghonRepo
        Write-Host "HWANGHON_REPO=$HwanghonRepo"
    } else {
        Write-Warning "HWANGHON_REPO not set; setup will create map but skip legacy GLB import."
    }

    & $EditorCmd $Project "-ExecutePythonScript=$SetupScript" -unattended -nop4 -nosplash
    if ($LASTEXITCODE -ne 0) {
        throw "Editor setup failed: exit $LASTEXITCODE"
    }
} else {
    Write-Host "`n[2/4] Skip editor setup"
}

Write-Host "`n[3/4] Asset quality audit"
& $EditorCmd $Project "-ExecutePythonScript=$AssetAuditScript" -unattended -nop4 -nosplash
if ($LASTEXITCODE -ne 0) {
    throw "Asset audit failed: exit $LASTEXITCODE"
}

Write-Host "`n[4/4] Hwanghon combat / progression automation tests"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$RunDir = Join-Path $ReportDir ([guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $RunDir | Out-Null
$RunStartedUtc = [datetime]::UtcNow

# UE 5.5 documents this queued Quit syntax: it exits after the test queue.
# A zero exit code alone is insufficient: validate the completed report below.
& $EditorCmd $Project `
    '-ExecCmds=Automation RunTest Hwanghon.;Quit' `
    "-ReportExportPath=$RunDir" `
    "-abslog=$(Join-Path $RunDir 'automation.log')" `
    -unattended -nop4 -nosplash -NullRHI

if ($LASTEXITCODE -ne 0) {
    throw "Automation tests failed: exit $LASTEXITCODE"
}

$Result = Assert-HWAutomationReport -ReportDir $RunDir -RunStartedUtc $RunStartedUtc `
    -RequiredSuites @('Hwanghon.Combat.', 'Hwanghon.Progression.', 'Hwanghon.Content.')
Write-Host "`nPASS: $($Result.Passed) automation tests; $($Result.SucceededWithWarnings) passed with warnings."
Write-Host "Automation report: $($Result.ReportPath)"
Write-Host "Asset audit: $(Join-Path $ProjectDir 'Saved\AssetAudit\asset_audit.json')"
Write-Host "Open project and PIE: T lock-on / J or Space attack / U smash / K dodge / I jump / L counter / F9 audit save"
