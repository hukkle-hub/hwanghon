param(
    [string]$UERoot = $env:UE55_ROOT
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $PSScriptRoot
$Project = Join-Path $ProjectDir "HwanghonCombatUE.uproject"
$Script = Join-Path $ProjectDir "Scripts\ue_create_material_library.py"

if ([string]::IsNullOrWhiteSpace($UERoot)) {
    $Candidates = @(
        "C:\Program Files\Epic Games\UE_5.5",
        "D:\Epic Games\UE_5.5"
    )
    foreach ($C in $Candidates) {
        if (Test-Path $C) { $UERoot = $C; break }
    }
}

if ([string]::IsNullOrWhiteSpace($UERoot) -or !(Test-Path $UERoot)) {
    throw "UE 5.5 root not found."
}

$EditorCmd = Join-Path $UERoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"

& $EditorCmd $Project "-ExecutePythonScript=$Script" -unattended -nop4 -nosplash
if ($LASTEXITCODE -ne 0) {
    throw "Material library generation failed: exit $LASTEXITCODE"
}

Write-Host "PASS: /Game/Materials/Hwanghon"
