# One hero, wrapped template -> exact face in a HIGH build (doc 177 §7-8):
# split -> import_from_template -> fit (detail kept) -> rigged HIGH build (for the DNA) -> whole-rig DNA swap -> final HIGH build
#   .\full_chain.ps1 -Name Ain -Wrapped C:/w/mhlab/ain_wrapped_lid.fbx -Hair WI_Hair_M_Layered -HairParams "Melanin=1,Redness=0.05" -IrisTint "1.0,0.15,0.1" -IrisUV "0.9,0.9"
param([string]$Name = "Ain", [string]$Wrapped, [string]$Hair = "", [string]$HairParams = "", [string]$IrisTint = "", [string]$IrisUV = "", [string]$Pupil = "0.95", [string]$IrisSat = "3.0")
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$bl = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$n = $Name.ToLower()
function RunUE($script) {
    $p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"', "-ExecCmds=`"py C:/w/mhlab/$script`"", '-nosplash', '-unattended') -PassThru
    $p.WaitForExit() | Out-Null
}
& $bl -b -P C:\w\hwanghon\tools\metahuman\split_template.py -- $Wrapped "C:/w/mhlab/${n}_wrapped_head.fbx" 2>$null | Select-String "^SPLIT"
$env:MH_NAME = $Name; $env:MH_ALIGN = 'srt'; RunUE 'import_template.py'; "import: " + (Get-Content C:\w\mhlab\import_template_log.txt | Select-String "import_from_template")
$env:MH_HF = '1'; RunUE 'fit_hf.py'; "fit: " + (Get-Content C:\w\mhlab\fit_hf_log.txt | Select-String "^fit ")
$env:MH_EXISTING = '1'; $env:MH_ONLY = $Name; $env:MH_QUALITY = 'HIGH'; $env:MH_SKIP_RIG = '0'
$env:MH_HAIR = $Hair; $env:MH_HAIR_PARAMS = $HairParams; $env:MH_IRIS_TINT = $IrisTint; $env:MH_IRIS_UV = $IrisUV; $env:MH_IRIS_SAT = $IrisSat; $env:MH_PUPIL = $Pupil
RunUE 'lab_build.py'; "rigged build: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
Get-ChildItem "C:\w\mhlab\dna\$Name" -Filter *.dna -ErrorAction SilentlyContinue | Remove-Item -Force
$env:MH_DNA_REUSE = '0'; RunUE 'whole_rig.py'; "whole rig: " + (Get-Content C:\w\mhlab\whole_rig_log.txt | Select-String "import_from_face_dna")
$env:MH_SKIP_RIG = '1'; RunUE 'lab_build.py'; "final build: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
