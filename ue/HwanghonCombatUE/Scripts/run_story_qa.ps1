# Story mode QA for Part 1 episode worlds (docs/design/150): -HWQA=storyshow per episode, shots + log per episode.
# .\Scripts\run_story_qa.ps1 -Episodes EP02,EP03 -Out C:\tmp\storyqa
param(
    [string[]]$Episodes = @(),
    [string]$Out = "$PSScriptRoot\..\Saved\StoryQA",
    [int]$ResX = 1280,
    [int]$ResY = 720,
    [string[]]$Extra = @()   # extra game arguments, e.g. -Extra "-HWNoFraming" for before/after camera QA (doc 165)
)
$ErrorActionPreference = "Stop"
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$project = (Resolve-Path "$PSScriptRoot\..\HwanghonCombatUE.uproject").Path
if ($Episodes.Count -eq 0) { $Episodes = 1..28 | ForEach-Object { "EP{0:D2}" -f $_ } }
New-Item -ItemType Directory -Force $Out | Out-Null
$summary = @()
foreach ($ep in $Episodes) {
    $dir = Join-Path $Out $ep
    New-Item -ItemType Directory -Force $dir | Out-Null
    $log = Join-Path $dir "qa.log"
    $map = if ($ep -eq "EP01") { "/Game/Hwanghon/Story/EP01/EP01_TrainingRoom_World" } else { "/Game/Hwanghon/Story/$ep/${ep}_World" }
    $args = @("`"$project`"", $map, "-game", "-windowed", "-ResX=$ResX", "-ResY=$ResY", "-HWQA=storyshow",
              "-HWQAShots=`"$dir`"", "-abslog=`"$log`"", "-nosplash", "-unattended") + $Extra
    $p = Start-Process -FilePath $ue -ArgumentList $args -PassThru
    if (-not $p.WaitForExit(1500 * 1000)) { $p.Kill(); $result = "TIMEOUT" }
    $lines = if (Test-Path $log) { Get-Content $log -Encoding UTF8 } else { @() }
    $done = $lines | Select-String -Pattern "HWQA .*FINISH ok=" | Select-Object -Last 1
    if (-not $result) { $result = if ($done) { $done.Line } else { "no result line" } }
    $summary += "$ep  $result"
    Write-Output "$ep  $result"
    $result = $null
}
$summary | Set-Content -Encoding utf8 (Join-Path $Out "summary.txt")
