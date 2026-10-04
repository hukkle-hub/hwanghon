$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$env:HAIR_DARKEN="1"; $env:HAIR_CAP="1"; & "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P C:\w\hwanghon\tools\metahuman\place_on_state.py -- C:/w/mhlab/ain_wrapped_lid.fbx C:/w/mhlab/state_Ain.fbx C:/w/mhlab/ain_hair.glb C:/w/mhlab/ain_hair_placed.fbx C:/w/mhlab/state_Ain_body.fbx 2>$null | Select-String "^PLACE"
$env:MH_EXISTING='1'; $env:MH_QUALITY='HIGH'; $env:MH_SKIP_RIG='1'; $env:MH_PUPIL='0.6'; $env:MH_IRIS_UV='0.9,0.9'; $env:MH_SCALP_DARK='1'
$env:MH_ONLY='Ain'; $env:MH_HAIR='WI_Hair_M_SideSweptFringe'; $env:MH_HAIR_PARAMS='Melanin=1,Redness=0.05'; $env:MH_IRIS_TINT='1.0,0.15,0.1'; $env:MH_IRIS_SAT='3.0'
$env:MH_HAIR_MESH='C:/w/mhlab/ain_hair_placed.fbx'; $env:MH_BROW='WI_Eyebrows_M_Thick'; $env:MH_BROW_PARAMS='Melanin=1,Redness=0.05'
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
"Ain: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
