# v98: Sera with the Hi3D scarf part (no band collar)
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$fo = "C:\w\hwanghon\tools\metahuman\fit_outfit.py"
$env:OUTFIT_CUT = 'skin'; $env:OUTFIT_MIN_ISLAND = '5'; $env:OUTFIT_BOOT_TOP = '0.16'; $env:OUTFIT_BOOT_CLEAN = '0'; $env:OUTFIT_GLOVES = '1'; $env:OUTFIT_ARM_NEAR = '1.0'; $env:OUTFIT_LINING_NECK = '1'
$env:OUTFIT_SKIN_MIN_Z = '0.34'; $env:OUTFIT_DROP_BELOW_NOSE = '0.075'; $env:OUTFIT_FAR = '0.30'; $env:OUTFIT_LINING_W = '0.6'; $env:OUTFIT_PALE_NEAR = '0.06'; $env:OUTFIT_COLLAR = ''; $env:OUTFIT_COLLAR_TOP = '0.0'; $env:OUTFIT_COLLAR_BACK = '-0.04'; $env:OUTFIT_COLLAR_GAP = '0.006'; $env:OUTFIT_COLLAR_FOLDS = '0.005'; $env:OUTFIT_COLLAR_FLARE = '0.008'; $env:OUTFIT_SCARF_BANDS = '5'; $env:OUTFIT_BOOT_CLEAN = '1'; $env:OUTFIT_BOOT_TOP = '0.40'; $env:OUTFIT_BOOT_NEAR = '0.05'; $env:OUTFIT_BODY_BOOTS = '0'; $env:OUTFIT_FLOOR = '0.13'
& $bl -b -P $fo -- C:/w/hwanghon/art/3d/sera_tex_lo.glb C:/w/mhlab/outfit/sera_lo_joints.json C:/w/mhlab/state_Sera_body.fbx C:/w/mhlab/outfit/sera_v103.fbx C:/w/mhlab/outfit/sera_v103.png 2>$null | Select-String "^OUTFIT (faces|out)"
$env:PART_KIND = 'boot'; $env:PART_TOP_Z = '0.37'; $env:PART_WIDTH = '1.12'; $env:PART_GAP = '0.004'; & $bl -b -P C:\w\hwanghon\tools\metahuman\fit_part.py -- C:/w/mhlab/parts/boot.glb C:/w/mhlab/state_Sera_body.fbx C:/w/mhlab/state_Sera.fbx C:/w/mhlab/parts/sera_boots.fbx C:/w/mhlab/parts/sera_boots.png 2>$null | Select-String '^PART (boots|out)'
$env:PART_KIND = 'hip'; $env:PART_W = '0.20'; $env:PART_ANG = '-40'; $env:PART_DROP = '0.05'; $env:PART_GAP = '0.012'; & $bl -b -P C:\w\hwanghon\tools\metahuman\fit_part.py -- C:/w/mhlab/parts/vials.glb C:/w/mhlab/state_Sera_body.fbx C:/w/mhlab/state_Sera.fbx C:/w/mhlab/parts/sera_vials.fbx C:/w/mhlab/parts/sera_vials.png 2>$null | Select-String '^PART (hip|out)'
& $bl -b -P C:\w\hwanghon\tools\metahuman\merge_parts.py -- C:/w/mhlab/outfit/sera_v103.fbx C:/w/mhlab/outfit/sera_v105m.fbx C:/w/mhlab/parts/sera_scarf.fbx C:/w/mhlab/parts/sera_boots.fbx C:/w/mhlab/parts/sera_vials.fbx 2>$null | Select-String '^MERGE out'
"fit: done"
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$env:MH_EXISTING = '1'; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_BROW = ''
$env:MH_HAIR_MESH = ''; $env:MH_KEEP_GROOM = '0'
$env:MH_ONLY = 'Sera'; $env:MH_SCALP_DARK = '0'; $env:MH_HAIR = 'WI_Hair_L_Straight'; $env:MH_HAIR_PARAMS = 'Melanin=0,Whiteness=1,Redness=0,Scraggle=0'
$env:MH_IRIS_TINT = '0.85,0.88,0.9'; $env:MH_IRIS_SAT = '0.3'; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_scalp.png'; $env:MH_GROOM_ABC = 'C:/w/mhlab/sera_groom.abc'; $env:MH_OUTFIT_FBX = 'C:/w/mhlab/outfit/sera_v105m.fbx'; $env:MH_OUTFIT_TEX = 'C:/w/mhlab/outfit/sera_v105_albedo.png'; $env:MH_OUTFIT_GRADE = '0.3,0.9'; $env:MH_PARTS = ''; $env:MH_OUTFIT_PART_TEX = 'C:/w/mhlab/parts/sera_scarf_albedo.png'; $env:MH_OUTFIT_PART_TEX2 = 'C:/w/mhlab/parts/sera_boots_albedo.png'; $env:MH_OUTFIT_PART_TEX3 = 'C:/w/mhlab/parts/sera_vials_albedo.png'
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head", "portrait", "back", "full") { Copy-Item "C:\w\mhlab\shots\Sera_${v}_late.png" "C:\w\mhlab\shots\v105_Sera_${v}.png" }
"Sera: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
