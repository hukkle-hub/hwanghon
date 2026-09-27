param(
    [string]$UERoot = $env:UE58_ROOT,
    [ValidateSet("Development","Shipping","DebugGame")]
    [string]$Configuration = "Development",
    [string]$ArchiveDir = "",
    [switch]$InstallSDK
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $PSScriptRoot
$Project = Join-Path $ProjectDir "HwanghonCombatUE.uproject"

if ([string]::IsNullOrWhiteSpace($UERoot)) {
    $Candidates = @(
        "C:\Program Files\Epic Games\UE_5.8",
        "D:\Epic Games\UE_5.8"
    )
    foreach ($C in $Candidates) {
        if (Test-Path $C) {
            $UERoot = $C
            break
        }
    }
}

if ([string]::IsNullOrWhiteSpace($UERoot) -or !(Test-Path $UERoot)) {
    throw "UE 5.8 root not found. Set UE58_ROOT or pass -UERoot."
}

$RunUAT = Join-Path $UERoot "Engine\Build\BatchFiles\RunUAT.bat"
if (!(Test-Path $RunUAT)) {
    throw "RunUAT.bat not found: $RunUAT"
}

if ([string]::IsNullOrWhiteSpace($ArchiveDir)) {
    $ArchiveDir = Join-Path $ProjectDir "Saved\AndroidPackage\$Configuration"
}

New-Item -ItemType Directory -Force -Path $ArchiveDir | Out-Null

Write-Host "== Hwanghon Android Package =="
Write-Host "UE: $UERoot"
Write-Host "Config: $Configuration"
Write-Host "Archive: $ArchiveDir"

if ($InstallSDK) {
    Write-Host "`n[Turnkey] Install/verify Android SDK"
    & $RunUAT Turnkey `
        -Command=InstallSDK `
        -platform=Android `
        -SdkType=Full `
        -BestAvailable `
        -Unattended `
        -nocompile `
        -nocompileuat

    if ($LASTEXITCODE -ne 0) {
        throw "Android Turnkey failed: exit $LASTEXITCODE"
    }
}

Write-Host "`n[BuildCookRun] Android package"

& $RunUAT BuildCookRun `
    "-project=$Project" `
    -noP4 `
    -platform=Android `
    "-clientconfig=$Configuration" `
    -build `
    -cook `
    -stage `
    -package `
    -pak `
    -archive `
    "-archivedirectory=$ArchiveDir" `
    -utf8output

if ($LASTEXITCODE -ne 0) {
    throw "Android BuildCookRun failed: exit $LASTEXITCODE"
}

Write-Host "`nPASS"
Write-Host "Android package: $ArchiveDir"
Write-Host "After install: press F10 in Development build to capture ~30 seconds of CSV profiler data."
