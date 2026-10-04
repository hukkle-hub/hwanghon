$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$env:MH_EXISTING = '1'; $env:MH_ONLY = 'Sera'; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_SCALP_DARK = '0'
$env:MH_HAIR = 'WI_Hair_L_Straight'; $env:MH_HAIR_PARAMS = 'Melanin=0,Whiteness=1,Redness=0'; $env:MH_IRIS_TINT = '0.85,0.88,0.9'; $env:MH_IRIS_SAT = '0.3'
$env:MH_HAIR_MESH = 'C:/w/mhlab/sera_hair_placed.fbx'; $env:MH_BROW = ''; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_straight.png'
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head", "portrait", "back") { Copy-Item "C:\w\mhlab\shots\Sera_${v}_late.png" "C:\w\mhlab\shots\v46_Sera_${v}.png" }
"Sera: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
