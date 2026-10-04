$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$mk = "C:\w\hwanghon\tools\metahuman\make_hair_groom.py"
$env:GROOM_HAIRLINE_CENTER = '0.125'; $env:GROOM_HAIRLINE = '0.095,0.17'
$env:GROOM_ROOTS = '60000'; $env:GROOM_GUIDES = '900'; $env:GROOM_CHILD = '40'; $env:GROOM_CLUMP = '0'; $env:GROOM_FLICK = '0'; $env:GROOM_HUG = '0.007,0.03'; $env:GROOM_FRONT_W = '5'; $env:GROOM_SPREAD = '0.004'; $env:GROOM_LIFT = '0.002'; $env:GROOM_WOB = '0.0003'; $env:GROOM_SMOOTH = '12'; $env:GROOM_HAIRLINE = '0.095,0.17'; $env:GROOM_MESSY = '0'; $env:GROOM_FOREHEAD_X = '0.035'; $env:GROOM_FOREHEAD_TOP = '0.095'; $env:GROOM_FOREHEAD_DROP = '1'; $env:GROOM_HAIRLINE_CENTER = '0.125'
& $bl -b -P C:\w\hwanghon\tools\metahuman\scalp_mask.py -- C:/w/mhlab/state_Sera.fbx C:/w/mhlab/sera_scalp 2048 2>$null | Select-String "^SCALP faces"
python C:\w\hwanghon\tools\metahuman\scalp_paint.py C:/w/mhlab/tex_Sera_BC_straight.png C:/w/mhlab/sera_scalp.npz C:/w/mhlab/tex_Sera_BC_scalp.png 0.62,0.62,0.64 0.9
& $bl -b -P $mk -- C:/w/mhlab/sera_hair_placed.fbx C:/w/mhlab/sera_groom.abc - C:/w/mhlab/state_Sera.fbx 2>$null | Select-String "^GROOM (strands|scalp strands)"
"fit: done"
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$env:MH_EXISTING = '1'; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_BROW = ''
$env:MH_HAIR_MESH = ''; $env:MH_KEEP_GROOM = '0'
$env:MH_ONLY = 'Sera'; $env:MH_SCALP_DARK = '0'; $env:MH_HAIR = 'WI_Hair_L_Straight'; $env:MH_HAIR_PARAMS = 'Melanin=0,Whiteness=1,Redness=0,Scraggle=0'
$env:MH_IRIS_TINT = '0.85,0.88,0.9'; $env:MH_IRIS_SAT = '0.3'; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_scalp.png'; $env:MH_GROOM_ABC = 'C:/w/mhlab/sera_groom.abc'; $env:MH_OUTFIT_FBX = 'C:/w/mhlab/outfit/sera_v84.fbx'; $env:MH_OUTFIT_TEX = 'C:/w/mhlab/outfit/sera_v86_albedo.png'; $env:MH_OUTFIT_GRADE = '0.3,0.9'
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head", "portrait", "back", "full") { Copy-Item "C:\w\mhlab\shots\Sera_${v}_late.png" "C:\w\mhlab\shots\v86_Sera_${v}.png" }
"Sera: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
