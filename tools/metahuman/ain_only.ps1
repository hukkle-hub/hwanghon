$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$env:MH_EXISTING = '1'; $env:MH_ONLY = 'Ain'; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_SCALP_DARK = '1'
$env:MH_HAIR = 'WI_Hair_M_SideSweptFringe'; $env:MH_HAIR_PARAMS = 'Melanin=1,Redness=0.05'; $env:MH_IRIS_TINT = '1.0,0.15,0.1'; $env:MH_IRIS_SAT = '3.0'
$env:MH_HAIR_MESH = 'C:/w/mhlab/ain_hair_placed.fbx'; $env:MH_BROW = ''; $env:MH_FACE_BC = ''
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head", "portrait", "back") { Copy-Item "C:\w\mhlab\shots\Ain_${v}_late.png" "C:\w\mhlab\shots\v56_Ain_${v}.png" }
"Ain: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
