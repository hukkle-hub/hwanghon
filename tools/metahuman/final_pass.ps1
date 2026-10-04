# doc 177 §13: brow decals dropped (harsh bar on Ain, invisible on Sera), Sera without the cap (its front edge cut a
# straight line across her forehead); hair re-placed, final HIGH builds
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
function RunUE($script) { $p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"', "-ExecCmds=`"py C:/w/mhlab/$script`"", '-nosplash', '-unattended') -PassThru; $p.WaitForExit() | Out-Null }
foreach ($h in @(
    @{H='Ain'; Hair='WI_Hair_M_SideSweptFringe'; HP='Melanin=1,Redness=0.05'; IT='1.0,0.15,0.1'; IS='3.0'; Cap='1'; Dark='1'},
    @{H='Sera'; Hair='WI_Hair_L_Straight'; HP='Melanin=0,Whiteness=1,Redness=0'; IT='0.85,0.88,0.9'; IS='0.3'; Cap='0'; Dark='0'})) {
    $Hero = $h.H; $low = $Hero.ToLower()
    $env:HAIR_CAP = $h.Cap; $env:HAIR_DARKEN = $h.Dark; $env:EXTRA_GLB = ''; $env:MH_CAP_COLOR = '0.008,0.008,0.01'
    & $bl -b -P C:\w\hwanghon\tools\metahuman\place_on_state.py -- "C:/w/mhlab/${low}_wrapped_lid.fbx" "C:/w/mhlab/state_${Hero}.fbx" "C:/w/mhlab/${low}_hair.glb" "C:/w/mhlab/${low}_hair_placed.fbx" "C:/w/mhlab/state_${Hero}_body.fbx" 2>$null | Select-String "^PLACE out"
    Remove-Item "C:/w/mhlab/${low}_hair_placed_brows_albedo.png" -ErrorAction SilentlyContinue
    $env:MH_EXISTING = '1'; $env:MH_ONLY = $Hero; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '1'; $env:MH_PUPIL = '0.6'; $env:MH_IRIS_UV = '0.9,0.9'; $env:MH_SCALP_DARK = $h.Dark
    $env:MH_HAIR = $h.Hair; $env:MH_HAIR_PARAMS = $h.HP; $env:MH_IRIS_TINT = $h.IT; $env:MH_IRIS_SAT = $h.IS
    $env:MH_HAIR_MESH = "C:/w/mhlab/${low}_hair_placed.fbx"; $env:MH_BROW = ''
    RunUE 'lab_build.py'; foreach ($v in "head", "portrait", "back") { Copy-Item "C:\w\mhlab\shots\${Hero}_${v}_late.png" "C:\w\mhlab\shots\v35_${Hero}_${v}.png" }
    "${Hero}: " + ((Get-Content C:\w\mhlab\lab_log.txt | Select-String "hair part") -join ' | ') + " | " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
}
