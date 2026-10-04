$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$env:MH_NAMES='Sera'; $p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/export_geo.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
"geo: " + (Get-Content C:\w\mhlab\export_geo_log.txt -Tail 1)
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P C:\w\hwanghon\tools\metahuman\place_on_state.py -- C:/w/mhlab/sera_wrapped_lid.fbx C:/w/mhlab/state_Sera.fbx C:/w/mhlab/sera_hair.glb C:/w/mhlab/sera_hair_placed.fbx 2>$null | Select-String "^PLACE"
$env:MH_EXISTING='1'; $env:MH_ONLY='Sera'; $env:MH_QUALITY='HIGH'; $env:MH_SKIP_RIG='1'; $env:MH_HAIR='WI_Hair_L_Straight'; $env:MH_HAIR_PARAMS='Melanin=0,Whiteness=1,Redness=0'
$env:MH_IRIS_TINT='0.85,0.88,0.9'; $env:MH_IRIS_UV='0.9,0.9'; $env:MH_IRIS_SAT='0.3'; $env:MH_PUPIL='0.6'; $env:MH_HAIR_MESH='C:/w/mhlab/sera_hair_placed.fbx'
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
"build: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
