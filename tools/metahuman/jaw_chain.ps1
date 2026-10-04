# doc 177 §11: lower face fixed (wrap fade under the chin + design ratio), whole-rig swap with the chin from the wrap,
# hair re-placed on the new state, final HIGH build
param([string]$Name, [string]$Hair, [string]$HairParams, [string]$IrisTint, [string]$IrisSat, [string]$Brow, [string]$BrowParams, [string]$Cap = "0", [string]$Darken = "0", [string]$CapColor = "0.008,0.008,0.01", [string]$UseHairMesh = "1")
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$n = $Name.ToLower()
function RunUE($script) { $p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"', "-ExecCmds=`"py C:/w/mhlab/$script`"", '-nosplash', '-unattended') -PassThru; $p.WaitForExit() | Out-Null }
& $bl -b -P C:\w\hwanghon\tools\metahuman\split_template.py -- "C:/w/mhlab/${n}_wrapped_jaw.fbx" "C:/w/mhlab/${n}_wrapped_head.fbx" 2>$null | Select-String "^SPLIT"
$env:MH_NAME = $Name; $env:MH_ALIGN = 'srt'; RunUE 'import_template.py'; "import: " + (Get-Content C:\w\mhlab\import_template_log.txt | Select-String "import_from_template")
$env:MH_DNA_REUSE = '1'; $env:MH_CHIN_JSON = "C:/w/mhlab/${n}_wrapped_jaw.json"; RunUE 'whole_rig.py'; "whole rig: " + ((Get-Content C:\w\mhlab\whole_rig_log.txt | Select-String "chin from|import_from_face_dna") -join ' | ')
$env:MH_NAMES = $Name; $env:MH_BODY = '1'; RunUE 'export_geo.py'; "geo: " + ((Get-Content C:\w\mhlab\export_geo_log.txt) -join ' | ')
$env:HAIR_CAP = $Cap; $env:HAIR_DARKEN = $Darken; $env:EXTRA_GLB = ""; $env:MH_CAP_COLOR = $CapColor
if ($UseHairMesh -eq "1") { & $bl -b -P C:\w\hwanghon\tools\metahuman\place_on_state.py -- "C:/w/mhlab/${n}_wrapped_lid.fbx" "C:/w/mhlab/state_${Name}.fbx" "C:/w/mhlab/${n}_hair.glb" "C:/w/mhlab/${n}_hair_placed.fbx" "C:/w/mhlab/state_${Name}_body.fbx" 2>$null | Select-String "^PLACE" }
$env:MH_EXISTING = '1'; $env:MH_ONLY = $Name; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_SCALP_DARK = $Darken
$env:MH_HAIR = $Hair; $env:MH_HAIR_PARAMS = $HairParams; $env:MH_IRIS_TINT = $IrisTint; $env:MH_IRIS_SAT = $IrisSat
$env:MH_HAIR_MESH = $(if ($UseHairMesh -eq "1") { "C:/w/mhlab/${n}_hair_placed.fbx" } else { "" }); $env:MH_BROW = $Brow; $env:MH_BROW_PARAMS = $BrowParams
RunUE 'lab_build.py'; foreach ($v in "head", "portrait", "back") { Copy-Item "C:\w\mhlab\shots\${Name}_${v}_late.png" "C:\w\mhlab\shots\v50_${Name}_${v}.png" }
"${Name}: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
