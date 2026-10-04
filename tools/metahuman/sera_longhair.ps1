# doc 177 §21: Sera's hair length - MetaHuman long straight groom on top, the Hi3D design hair below the shoulders
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$env:HAIR_CAP = '0'; $env:HAIR_DARKEN = '0'; $env:EXTRA_GLB = ''; $env:HAIR_BELOW = '0.34'
& $bl -b -P C:\w\hwanghon\tools\metahuman\place_on_state.py -- C:/w/mhlab/sera_wrapped_lid.fbx C:/w/mhlab/state_Sera.fbx C:/w/mhlab/sera_hair.glb C:/w/mhlab/sera_tail_placed.fbx C:/w/mhlab/state_Sera_body.fbx 2>$null | Select-String "^PLACE"
$env:HAIR_BELOW = ''
$env:MH_EXISTING = '1'; $env:MH_ONLY = 'Sera'; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_SCALP_DARK = '0'
$env:MH_HAIR = 'WI_Hair_L_Straight'; $env:MH_HAIR_PARAMS = 'Melanin=0,Whiteness=1,Redness=0'; $env:MH_IRIS_TINT = '0.85,0.88,0.9'; $env:MH_IRIS_SAT = '0.3'
$env:MH_HAIR_MESH = 'C:/w/mhlab/sera_tail_placed.fbx'; $env:MH_KEEP_GROOM = '1'; $env:MH_HAIR_ROUGH = '0.6'; $env:MH_HAIR_SPEC = '0.3'
$env:MH_BROW = ''; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_straight.png'
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head", "portrait", "back", "full") { Copy-Item "C:\w\mhlab\shots\Sera_${v}_late.png" "C:\w\mhlab\shots\v57_Sera_${v}.png" }
"Sera: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
