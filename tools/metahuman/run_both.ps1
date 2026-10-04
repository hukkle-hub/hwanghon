# Ain rebuilt with the pale skin (whole-rig face kept), then Sera through the full chain (doc 177 §8)
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$env:MH_EXISTING='1'; $env:MH_ONLY='Ain'; $env:MH_QUALITY='HIGH'; $env:MH_SKIP_RIG='1'
$env:MH_HAIR='WI_Hair_M_SideSweptFringe'; $env:MH_HAIR_PARAMS='Melanin=1,Redness=0.05'; $env:MH_IRIS_TINT='1.0,0.15,0.1'; $env:MH_IRIS_UV='0.9,0.9'; $env:MH_IRIS_SAT='3.0'; $env:MH_PUPIL='0.6'
$p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru; $p.WaitForExit() | Out-Null
foreach ($v in "head","side","full","back") { Copy-Item "C:\w\mhlab\shots\Ain_${v}_late.png" "C:\w\mhlab\shots\v23_Ain_${v}.png" -ErrorAction SilentlyContinue }
"Ain pale: " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
& C:\w\mhlab\full_chain.ps1 -Name Sera -Wrapped C:/w/mhlab/sera_wrapped_lid.fbx -Hair WI_Hair_L_Straight -HairParams "Melanin=0,Whiteness=1,Redness=0" -IrisTint "0.85,0.88,0.9" -IrisUV "0.9,0.9" -Pupil "0.6" -IrisSat "0.3"

