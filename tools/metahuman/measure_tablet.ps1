# Tablet cost of the HIGH MetaHuman heroes (doc 177 짠5). Installs the lab APK, then for each perf map: writes
# UECommandLine.txt (map + CSV profiler for 1500 frames), launches, waits, stops, pulls the CSV.
#   .\measure_tablet.ps1 [-SkipInstall]
param([switch]$SkipInstall, [int]$Seconds = 75)
$ErrorActionPreference = "Continue"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$pkg = "com.hwanghon.mhlab"
$out = "C:\w\mhlab\perf_csv"
New-Item -ItemType Directory -Force $out | Out-Null
if (-not (& $adb devices | Select-String "\tdevice$")) { throw "no tablet on adb" }
if (-not $SkipInstall) {
    $apk = Get-ChildItem "C:\w\mhlab\Saved\AndroidPackage\Perf" -Recurse -Filter *.apk | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    "APK {0} {1:N0} MB" -f $apk.FullName, ($apk.Length / 1MB)
    & $adb install -r $apk.FullName
}
$base = "/sdcard/Android/data/$pkg/files/UnrealGame/MHLab"
foreach ($map in "L_PerfEmpty", "L_PerfParty", "L_PerfRaid") {
    & $adb shell am force-stop $pkg
    & $adb shell "rm -rf $base/MHLab/Saved/Profiling/CSV"
    $cmd = "../../../MHLab/MHLab.uproject /Game/Perf/$map -csvCaptureFrames=1500 -csvNoProcessingThread"
    $tmp = Join-Path $out "UECommandLine.txt"
    [IO.File]::WriteAllText($tmp, $cmd)
    & $adb shell "mkdir -p $base"
    & $adb push $tmp "$base/UECommandLine.txt" | Out-Null
    & $adb shell monkey -p $pkg -c android.intent.category.LAUNCHER 1 | Out-Null
    Start-Sleep -Seconds $Seconds
    $files = (& $adb shell "ls $base/MHLab/Saved/Profiling/CSV/ 2>/dev/null") -split "`n" | Where-Object { $_ -match "\.csv" }
    foreach ($f in $files) { & $adb pull "$base/MHLab/Saved/Profiling/CSV/$($f.Trim())" (Join-Path $out "$map.csv") | Out-Null }
    "{0}: {1} csv" -f $map, @($files).Count
    & $adb shell am force-stop $pkg
}
& $adb shell "rm $base/UECommandLine.txt"
