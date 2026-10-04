# Ain hair options from the design sheet (messy short black, bangs) - one HIGH build each, shots kept per option
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$env:MH_EXISTING='1'; $env:MH_ONLY='Ain'; $env:MH_QUALITY='HIGH'; $env:MH_SKIP_RIG='1'
$env:MH_HAIR_PARAMS='Melanin=1,Redness=0.05'; $env:MH_IRIS_TINT='1.0,0.15,0.1'; $env:MH_IRIS_SAT='3.0'; $env:MH_PUPIL='0.6'; $env:MH_IRIS_UV='0.9,0.9'
foreach ($h in $args) {
    $env:MH_HAIR = $h
    $p = Start-Process -FilePath $ue -ArgumentList @('"C:\w\mhlab\MHLab.uproject"','-ExecCmds="py C:/w/mhlab/lab_build.py"','-nosplash','-unattended') -PassThru
    $p.WaitForExit() | Out-Null
    foreach ($v in "head","side","full","back") { Copy-Item "C:\w\mhlab\shots\Ain_${v}_late.png" "C:\w\mhlab\shots\hair_${h}_${v}.png" -ErrorAction SilentlyContinue }
    "$h " + (Get-Content C:\w\mhlab\lab_log.txt -Tail 1)
}
