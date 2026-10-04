# doc 177 §22: hair cards from the design hair shape, both heroes
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$env:CARDS_N = '450'; $env:CARDS_STEP = '0.025'; $env:CARDS_LAYERS = '1.5,6'
$env:CARDS_RGB = '0.62,0.62,0.64'
& $bl -b -P C:\w\hwanghon\tools\metahuman\make_hair_cards.py -- C:/w/mhlab/sera_hair_placed.fbx C:/w/mhlab/sera_cards.fbx C:/w/mhlab/sera_cards_preview.png 2>$null | Select-String "^CARDS (strands|ribbons)"
$env:CARDS_RGB = '0.035,0.032,0.034'; $env:CARDS_W = '0.018'
& $bl -b -P C:\w\hwanghon\tools\metahuman\make_hair_cards.py -- C:/w/mhlab/ain_hair_placed.fbx C:/w/mhlab/ain_cards.fbx C:/w/mhlab/ain_cards_preview.png 2>$null | Select-String "^CARDS (strands|ribbons)"
$env:MH_EXISTING = '1'; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_BROW = ''
$env:MH_HAIR_ROUGH = '0.55'; $env:MH_HAIR_SPEC = '0.35'; $env:MH_KEEP_GROOM = '0'
$env:MH_ONLY = 'Ain'; $env:MH_SCALP_DARK = '1'; $env:MH_HAIR = 'WI_Hair_M_SideSweptFringe'; $env:MH_HAIR_PARAMS = 'Melanin=1,Redness=0.05'; $env:MH_IRIS_TINT = '1.0,0.15,0.1'; $env:MH_IRIS_SAT = '3.0'
$env:MH_HAIR_MESH = 'C:/w/mhlab/ain_cards.fbx'; $env:MH_HAIR_TEX = 'C:/w/mhlab/ain_cards_cards.png'; $env:MH_FACE_BC = ''
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head", "portrait", "back", "full") { Copy-Item "C:\w\mhlab\shots\Ain_${v}_late.png" "C:\w\mhlab\shots\v58_Ain_${v}.png" }
"Ain: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
$env:MH_ONLY = 'Sera'; $env:MH_SCALP_DARK = '0'; $env:MH_HAIR = 'WI_Hair_L_Straight'; $env:MH_HAIR_PARAMS = 'Melanin=0,Whiteness=1,Redness=0'; $env:MH_IRIS_TINT = '0.85,0.88,0.9'; $env:MH_IRIS_SAT = '0.3'
$env:MH_HAIR_MESH = 'C:/w/mhlab/sera_cards.fbx'; $env:MH_HAIR_TEX = 'C:/w/mhlab/sera_cards_cards.png'; $env:MH_FACE_BC = 'C:/w/mhlab/tex_Sera_BC_straight.png'
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head", "portrait", "back", "full") { Copy-Item "C:\w\mhlab\shots\Sera_${v}_late.png" "C:\w\mhlab\shots\v58_Sera_${v}.png" }
"Sera: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
