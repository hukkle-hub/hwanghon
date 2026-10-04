# doc 177 §10: body collision for the hair meshes, dark brows, Ain's crown - both heroes rebuilt
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
function RunUE($script) { $p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"', "-ExecCmds=`"py C:/w/mhlab/$script`"", '-nosplash', '-unattended') -PassThru; $p.WaitForExit() | Out-Null }
$env:MH_NAMES='Ain,Sera'; $env:MH_BODY='1'; RunUE 'export_geo.py'; "geo: " + ((Get-Content C:\w\mhlab\export_geo_log.txt) -join ' | ')
$env:HAIR_MODE='dark'; & $bl -b -P C:\w\hwanghon\tools\metahuman\fit_hair.py -- C:/w/hwanghon/art/3d/heroes/ain.glb C:/w/mhlab/ain_wrapped_lid.fbx C:/w/mhlab/ain_hair.glb C:/w/mhlab/ain_hair_preview.png 2>$null | Select-String "^HAIR"
& $bl -b -P C:\w\hwanghon\tools\metahuman\place_on_state.py -- C:/w/mhlab/ain_wrapped_lid.fbx C:/w/mhlab/state_Ain.fbx C:/w/mhlab/ain_hair.glb C:/w/mhlab/ain_hair_placed.fbx C:/w/mhlab/state_Ain_body.fbx 2>$null | Select-String "^PLACE"
& $bl -b -P C:\w\hwanghon\tools\metahuman\place_on_state.py -- C:/w/mhlab/sera_wrapped_lid.fbx C:/w/mhlab/state_Sera.fbx C:/w/mhlab/sera_hair.glb C:/w/mhlab/sera_hair_placed.fbx C:/w/mhlab/state_Sera_body.fbx 2>$null | Select-String "^PLACE"
$env:MH_EXISTING='1'; $env:MH_QUALITY='HIGH'; $env:MH_SKIP_RIG='1'; $env:MH_PUPIL='0.6'; $env:MH_IRIS_UV='0.9,0.9'
$env:MH_ONLY='Ain'; $env:MH_HAIR='WI_Hair_M_SideSweptFringe'; $env:MH_HAIR_PARAMS='Melanin=1,Redness=0.05'; $env:MH_IRIS_TINT='1.0,0.15,0.1'; $env:MH_IRIS_SAT='3.0'
$env:MH_HAIR_MESH='C:/w/mhlab/ain_hair_placed.fbx'; $env:MH_BROW='WI_Eyebrows_M_Thick'; $env:MH_BROW_PARAMS='Melanin=1,Redness=0.05'
RunUE 'lab_build.py'; foreach ($v in "head","back") { Copy-Item "C:\w\mhlab\shots\Ain_${v}_late.png" "C:\w\mhlab\shots\v27_Ain_${v}.png" }; "Ain: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
$env:MH_ONLY='Sera'; $env:MH_HAIR='WI_Hair_L_Straight'; $env:MH_HAIR_PARAMS='Melanin=0,Whiteness=1,Redness=0'; $env:MH_IRIS_TINT='0.85,0.88,0.9'; $env:MH_IRIS_SAT='0.3'
$env:MH_HAIR_MESH='C:/w/mhlab/sera_hair_placed.fbx'; $env:MH_BROW='WI_Eyebrows_M_Fine'; $env:MH_BROW_PARAMS='Melanin=0.55,Redness=0'
RunUE 'lab_build.py'; foreach ($v in "head","back") { Copy-Item "C:\w\mhlab\shots\Sera_${v}_late.png" "C:\w\mhlab\shots\v27_Sera_${v}.png" }; "Sera: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
