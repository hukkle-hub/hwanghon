$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$env:LOWER_FACE_K = '1.06'; $env:SYMMETRIZE = '1'; $env:UPPER_LID_DROP = '3.5'; $env:LOWER_LID_RAISE = '1.0'; $env:JAW_NARROW = '1.08'; $env:CHIN_NARROW = '0.90'
& $bl -b -P C:\w\hwanghon\tools\metahuman\wrap_template.py -- C:/w/mhlab/template_Archetype.fbx C:/w/mhlab/sera2_head.glb C:/w/mhlab/sera_wrapped_jaw.fbx C:/w/mhlab/sera_wrap_jaw_preview.png 2>$null | Select-String "^WRAP (lower|upper|jaw|sym|out)"
$env:UPPER_LID_DROP = '0'; $env:LOWER_LID_RAISE = '0'; $env:SYMMETRIZE = '0'; $env:JAW_NARROW = '1.0'; $env:CHIN_NARROW = '1.0'; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_straight.png'
$env:MH_EYE_DEPTH = '0.09'; $env:MH_EYE_DZ = '0.12'
& C:\w\mhlab\jaw_chain.ps1 -Name Sera -Hair WI_Hair_L_Straight -HairParams "Melanin=0,Whiteness=1,Redness=0" -IrisTint "0.85,0.88,0.9" -IrisSat "0.3" -Brow "" -BrowParams "" -Cap "0" -Darken "0" -UseHairMesh "0"
$env:MH_GROOM_ABC = ''; $env:MH_OUTFIT_FBX = ''
$mk = "C:\w\hwanghon\tools\metahuman\make_hair_groom.py"
$env:GROOM_HAIRLINE_CENTER = '0.095'; $env:GROOM_HAIRLINE = '0.095,0.17'
$env:GROOM_ROOTS = '60000'; $env:GROOM_FRONT_W = '3'; $env:GROOM_SPREAD = '0.004'; $env:GROOM_LIFT = '0.002'; $env:GROOM_WOB = '0.0003'; $env:GROOM_SMOOTH = '12'; $env:GROOM_HAIRLINE = '0.095,0.17'; $env:GROOM_MESSY = '0'; $env:GROOM_FOREHEAD_X = '0.05'; $env:GROOM_FOREHEAD_TOP = '0.095'; $env:GROOM_HAIRLINE_CENTER = '0.095'
& $bl -b -P C:\w\hwanghon\tools\metahuman\scalp_mask.py -- C:/w/mhlab/state_Sera.fbx C:/w/mhlab/sera_scalp 2048 2>$null | Select-String "^SCALP faces"
python C:\w\hwanghon\tools\metahuman\scalp_paint.py C:/w/mhlab/tex_Sera_BC_straight.png C:/w/mhlab/sera_scalp.npz C:/w/mhlab/tex_Sera_BC_scalp.png 0.50,0.50,0.52 0.85
& $bl -b -P $mk -- C:/w/mhlab/sera_hair_placed.fbx C:/w/mhlab/sera_groom.abc - C:/w/mhlab/state_Sera.fbx 2>$null | Select-String "^GROOM (strands|scalp strands)"
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$env:MH_EXISTING = '1'; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_BROW = ''
$env:MH_HAIR_MESH = ''; $env:MH_KEEP_GROOM = '0'
$env:MH_ONLY = 'Sera'; $env:MH_SCALP_DARK = '0'; $env:MH_HAIR = 'WI_Hair_L_Straight'; $env:MH_HAIR_PARAMS = 'Melanin=0,Whiteness=1,Redness=0,Scraggle=0'
$env:MH_IRIS_TINT = '0.85,0.88,0.9'; $env:MH_IRIS_SAT = '0.3'; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_scalp.png'; $env:MH_GROOM_ABC = 'C:/w/mhlab/sera_groom.abc'; $env:MH_OUTFIT_FBX = 'C:/w/mhlab/outfit/sera_v75.fbx'; $env:MH_OUTFIT_TEX = 'C:/w/mhlab/outfit/sera_v75_albedo.png'
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head", "portrait", "back", "full") { Copy-Item "C:\w\mhlab\shots\Sera_${v}_late.png" "C:\w\mhlab\shots\v79_Sera_${v}.png" }
"Sera: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
