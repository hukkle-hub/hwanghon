param([string]$Name)
$log = "C:\w\mhlab\conform_log.txt"
if (Test-Path $log) { Clear-Content $log }
$env:MH_NAME = $Name
$p = Start-Process -FilePath "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe" -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/conform.py"','-nosplash','-unattended','-abslog=C:\w\mhlab\conform_editor.log') -PassThru
$deadline=(Get-Date).AddMinutes(25)
while(-not $p.HasExited -and (Get-Date) -lt $deadline){ Start-Sleep 15; if ((Select-String -Path $log -Pattern "^done" -Quiet -ErrorAction SilentlyContinue)) { Start-Sleep 20; if (-not $p.HasExited) { $p.Kill() }; break } }
if (-not $p.HasExited) { $p.Kill(); "KILLED" }
"== $Name"
Get-Content $log -Encoding utf8 | Select-String "front|image_size|moved|align|done|ERROR" | ForEach-Object { $_.Line.Substring(0,[Math]::Min(200,$_.Line.Length)) }
Select-String -Path C:\w\mhlab\conform_editor.log -Pattern "Invalid image|Conform failed|viewport camera" | Select-Object -Last 2 | ForEach-Object { $_.Line.Substring(30) }
