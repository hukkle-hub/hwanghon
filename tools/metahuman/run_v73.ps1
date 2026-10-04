# doc 180 §8: old game models as the cloth source - boots kept (skin never below the boot top), shaded thighs out, neck lining; Ain hair less volume
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$fo = "C:\w\hwanghon\tools\metahuman\fit_outfit.py"
$env:OUTFIT_CUT = 'skin'; $env:OUTFIT_MIN_ISLAND = '30'; $env:OUTFIT_BOOT_TOP = '0.16'; $env:OUTFIT_BOOT_CLEAN = '0'; $env:OUTFIT_GLOVES = '1'; $env:OUTFIT_ARM_NEAR = '1.0'; $env:OUTFIT_LINING_NECK = '1'
$env:OUTFIT_SKIN_MIN_Z = '0.34'; $env:OUTFIT_DROP_BELOW_NOSE = '0.02'; $env:OUTFIT_FAR = '0.30'; $env:OUTFIT_LINING_W = '0.6'
& $bl -b -P $fo -- C:/w/hwanghon/art/3d/sera_tex_lo.glb C:/w/mhlab/outfit/sera_lo_joints.json C:/w/mhlab/state_Sera_body.fbx C:/w/mhlab/outfit/sera_v73.fbx C:/w/mhlab/outfit/sera_v73.png 2>$null | Select-String "^OUTFIT (faces|out)"
$env:OUTFIT_SKIN_MIN_Z = '0.50'; $env:OUTFIT_DROP_BELOW_NOSE = '0.055'; $env:OUTFIT_FAR = '0.12'; $env:OUTFIT_LINING_W = '0.35'
& $bl -b -P $fo -- C:/w/hwanghon/art/3d/ain_tex_lo.glb C:/w/mhlab/outfit/ain_lo_joints.json C:/w/mhlab/state_Ain_body.fbx C:/w/mhlab/outfit/ain_v73.fbx C:/w/mhlab/outfit/ain_v73.png 2>$null | Select-String "^OUTFIT (faces|out)"
$env:GROOM_ROOTS = '50000'; $env:GROOM_FRONT_W = '2'; $env:GROOM_SPREAD = '0.005'; $env:GROOM_LIFT = '0.003'; $env:GROOM_WOB = '0.0012'; $env:GROOM_SMOOTH = '5'
$env:GROOM_HUG = '0.012,0.03'; $env:GROOM_FLICK = '0.012'; $env:GROOM_HAIRLINE = '0.075,0.17'; $env:GROOM_MESSY = '0.8'; $env:GROOM_FOREHEAD_X = '0'
$env:GROOM_GUIDES = '250'; $env:GROOM_CHILD = '120'; $env:GROOM_CLUMP = '0.85'; $env:GROOM_MESSY_CLUMP = '0.02'; $env:GROOM_MESSY_STRAND = '0.002'
"fit: done"
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$env:MH_EXISTING = '1'; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_BROW = ''
$env:MH_HAIR_MESH = ''; $env:MH_KEEP_GROOM = '0'
$env:MH_ONLY = 'Sera'; $env:MH_SCALP_DARK = '0'; $env:MH_HAIR = 'WI_Hair_L_Straight'; $env:MH_HAIR_PARAMS = 'Melanin=0,Whiteness=1,Redness=0,Scraggle=0'
$env:MH_IRIS_TINT = '0.85,0.88,0.9'; $env:MH_IRIS_SAT = '0.3'; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_scalp.png'; $env:MH_GROOM_ABC = 'C:/w/mhlab/sera_groom.abc'; $env:MH_OUTFIT_FBX = 'C:/w/mhlab/outfit/sera_v73.fbx'; $env:MH_OUTFIT_TEX = 'C:/w/mhlab/outfit/sera_v73_albedo.png'
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head", "portrait", "back", "full") { Copy-Item "C:\w\mhlab\shots\Sera_${v}_late.png" "C:\w\mhlab\shots\v73_Sera_${v}.png" }
"Sera: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
$env:MH_EXISTING = '1'; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_BROW = ''
$env:MH_ONLY = 'Ain'; $env:MH_SCALP_DARK = '1'; $env:MH_HAIR = 'WI_Hair_M_SideSweptFringe'; $env:MH_HAIR_PARAMS = 'Melanin=1,Redness=0.05'
$env:MH_IRIS_TINT = '1.0,0.15,0.1'; $env:MH_IRIS_SAT = '3.0'; $env:MH_FACE_BC = ''; $env:MH_GROOM_ABC = 'C:/w/mhlab/ain_groom.abc'; $env:MH_OUTFIT_FBX = 'C:/w/mhlab/outfit/ain_v73.fbx'; $env:MH_OUTFIT_TEX = 'C:/w/mhlab/outfit/ain_v73_albedo.png'; $env:MH_OUTFIT_NOLEADER = ''
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head", "portrait", "back", "full") { Copy-Item "C:\w\mhlab\shots\Ain_${v}_late.png" "C:\w\mhlab\shots\v73_Ain_${v}.png" }
"Ain: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
