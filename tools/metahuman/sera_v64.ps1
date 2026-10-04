# doc 177 짠24: Sera (denser front, less frizz) + Ain (black, messy) strand hair from the design shapes
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$mk = "C:\w\hwanghon\tools\metahuman\make_hair_groom.py"
$env:GROOM_HAIRLINE_CENTER = '0.05'; $env:GROOM_HAIRLINE = '0.075,0.17'
$env:GROOM_ROOTS = '60000'; $env:GROOM_FRONT_W = '3'; $env:GROOM_SPREAD = '0.004'; $env:GROOM_LIFT = '0.002'; $env:GROOM_WOB = '0.0003'; $env:GROOM_SMOOTH = '12'; $env:GROOM_HAIRLINE = '0.075,0.17'; $env:GROOM_MESSY = '0'; $env:GROOM_FOREHEAD_X = '0.05'; $env:GROOM_FOREHEAD_TOP = '0.045'; $env:GROOM_HAIRLINE_CENTER = '0.05'
& $bl -b -P C:\w\hwanghon\tools\metahuman\scalp_mask.py -- C:/w/mhlab/state_Sera.fbx C:/w/mhlab/sera_scalp 2048 2>$null | Select-String "^SCALP faces"
python C:\w\hwanghon\tools\metahuman\scalp_paint.py C:/w/mhlab/tex_Sera_BC_straight.png C:/w/mhlab/sera_scalp.npz C:/w/mhlab/tex_Sera_BC_scalp.png 0.78,0.78,0.80 0.85
& $bl -b -P $mk -- C:/w/mhlab/sera_hair_placed.fbx C:/w/mhlab/sera_groom.abc - C:/w/mhlab/state_Sera.fbx 2>$null | Select-String "^GROOM (strands|scalp strands)"
$env:MH_EXISTING = '1'; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_BROW = ''
$env:MH_HAIR_MESH = ''; $env:MH_KEEP_GROOM = '0'
$env:MH_ONLY = 'Sera'; $env:MH_SCALP_DARK = '0'; $env:MH_HAIR = 'WI_Hair_L_Straight'; $env:MH_HAIR_PARAMS = 'Melanin=0,Whiteness=1,Redness=0,Scraggle=0'
$env:MH_IRIS_TINT = '0.85,0.88,0.9'; $env:MH_IRIS_SAT = '0.3'; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_scalp.png'; $env:MH_GROOM_ABC = 'C:/w/mhlab/sera_groom.abc'
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head", "portrait", "back", "full") { Copy-Item "C:\w\mhlab\shots\Sera_${v}_late.png" "C:\w\mhlab\shots\v64_Sera_${v}.png" }
"Sera: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
$env:GROOM_ROOTS = '50000'; $env:GROOM_FRONT_W = '2'; $env:GROOM_SPREAD = '0.006'; $env:GROOM_LIFT = '0.004'; $env:GROOM_WOB = '0.0015'; $env:GROOM_SMOOTH = '4'; $env:GROOM_HUG = '0.03,0.06'; $env:GROOM_FLICK = '0.02'; $env:GROOM_HAIRLINE = '0.075,0.17'; $env:GROOM_MESSY = '1'; $env:GROOM_FOREHEAD_X = '0'; $env:GROOM_GUIDES = '250'; $env:GROOM_CHILD = '120'; $env:GROOM_CLUMP = '0.85'; $env:GROOM_MESSY_CLUMP = '0.025'; $env:GROOM_MESSY_STRAND = '0.002'
