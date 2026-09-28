param(
    [string]$UERoot = $env:UE58_ROOT
)

$ErrorActionPreference="Stop"
$Repo=(Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Project=Join-Path $Repo "ue\HwanghonCombatUE\HwanghonCombatUE.uproject"

Push-Location $Repo
try {
    python tools/animation/verify_donor_manifest.py
    if($LASTEXITCODE -ne 0){throw "donor manifest verify failed"}

    if($UERoot){
        $Editor=Join-Path $UERoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
        $Audit=Join-Path $Repo "ue\HwanghonCombatUE\Scripts\audit_animation_donors.py"
        & $Editor $Project "-ExecutePythonScript=$Audit" -unattended -nop4 -nosplash
        if($LASTEXITCODE -ne 0){throw "UE donor audit failed"}
    }

    Write-Host "ANIMATION DONOR AUDIT PASS"
    Write-Host "Review: ue\HwanghonCombatUE\Saved\HwanghonAnimationDonorAudit\donor_candidates.csv"
}
finally {
    Pop-Location
}
