param([string]$UERoot = $env:UE58_ROOT)
$ErrorActionPreference = "Stop"
$Repo=(Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Project=Join-Path $Repo "ue\HwanghonCombatUE\HwanghonCombatUE.uproject"
if([string]::IsNullOrWhiteSpace($UERoot)){ throw "Set UE58_ROOT." }
$Editor=Join-Path $UERoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$Setup=Join-Path $Repo "ue\HwanghonCombatUE\Scripts\setup_story_dungeon_workspace.py"
$Audit=Join-Path $Repo "ue\HwanghonCombatUE\Scripts\dungeon_asset_audit.py"
Push-Location $Repo
try {
  & $Editor $Project "-ExecutePythonScript=$Setup" -unattended -nop4 -nosplash
  if($LASTEXITCODE -ne 0){ throw "workspace setup failed" }
  & $Editor $Project "-ExecutePythonScript=$Audit" -unattended -nop4 -nosplash
  if($LASTEXITCODE -ne 0){ throw "asset audit failed" }
  Write-Host "Dungeon asset audit complete."
  Write-Host "Saved\DungeonAssetAudit\asset_candidates.csv"
} finally { Pop-Location }
