# Online v6 full loop on one PC (docs/design/154): matchmaker + shelter server + dungeon server + two real clients.
# The launcher engine cannot build a Server target, so both servers are the editor run as a dedicated server (-server).
#   .\Scripts\run_online_loop.ps1 -Out C:\tmp\online            # leader (ain) + member (kain), full loop
#   .\Scripts\run_online_loop.ps1 -Out C:\tmp\online -Story     # one client: the loading screen's story card
#   .\Scripts\run_online_loop.ps1 -Out C:\tmp\online -Fallback  # the first shelter closes during the run -> the
#                                                               # party returns to a second shelter, still at the office
param(
    [string]$Out = "$PSScriptRoot\..\Saved\OnlineLoop",
    [switch]$Story,
    [switch]$Fallback,
    [int]$TimeoutSec = 420
)
$ErrorActionPreference = "Stop"
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$project = (Resolve-Path "$PSScriptRoot\..\HwanghonCombatUE.uproject").Path
$repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
New-Item -ItemType Directory -Force $Out | Out-Null
$secret = [guid]::NewGuid().ToString()   # one per run, never written to a file
$procs = @()

function Start-UE([string]$name, [string[]]$ueArgs) {
    $log = Join-Path $Out "$name.log"
    $all = @("`"$project`"") + $ueArgs + @("-abslog=`"$log`"", "-nosplash", "-unattended")
    return Start-Process -FilePath $ue -ArgumentList $all -PassThru
}

function Health() {
    try { return Invoke-RestMethod -Uri "http://127.0.0.1:8080/health" -TimeoutSec 2 } catch { return $null }
}

# a run left behind (stopped from outside, so its finally never ran) would answer for this one
if (-not $Story) {
    foreach ($port in 8080, 7777, 7778, 7780) {
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "port $port is taken - an earlier run is still up" }
    }
}

try {
    if (-not $Story) {
        $env:INSTANCE_SECRET = $secret
        $gw = Start-Process -FilePath "node" -ArgumentList @("`"$repo\tools\online\gateway.mjs`"") -PassThru `
            -RedirectStandardOutput (Join-Path $Out "gateway.log") -RedirectStandardError (Join-Path $Out "gateway.err.log")
        $procs += $gw
        Remove-Item Env:\INSTANCE_SECRET
        Start-Sleep -Seconds 1
        if ($gw.HasExited) { throw "matchmaker exited: $(Get-Content (Join-Path $Out 'gateway.err.log') -Raw)" }
        $common = @("-server", "-log", "-nullrhi", "-InstanceSecret=$secret", "-Matchmaker=http://127.0.0.1:8080")
        $shelterMap = "/Game/Hwanghon/Maps/Hub/L_GangnamBunker_B1?game=/Script/HwanghonCombatUE.HWShelterOnlineGameMode"
        $shelter1 = Start-UE "server_shelter1" (@($shelterMap, "-port=7777", "-Advertise=127.0.0.1:7777", "-InstanceId=shelter-001") + $common)
        $procs += $shelter1
        $dungeon = Start-UE "server_dungeon" (@("/Game/Hwanghon/Story/EP03/EP03_World?game=/Script/HwanghonCombatUE.HWDungeonOnlineGameMode",
            "-port=7780", "-Advertise=127.0.0.1:7780", "-InstanceId=dungeon-001", "-Mission=GangnamStation_B2", "-AllowDevComplete") + $common)
        $procs += $dungeon
        $want = 2
        $t0 = Get-Date
        while ($true) {
            $h = Health
            if ($h -and $h.instances -ge $want) { break }
            if (((Get-Date) - $t0).TotalSeconds -gt 240) { throw "servers did not register with the matchmaker ($want expected)" }
            Start-Sleep -Seconds 2
        }
        Write-Output "servers up: $($h.shelters) shelter, $($h.dungeons) dungeon"
    }

    $clients = @()
    # a list, not an if-expression: PowerShell unrolls a one-role array into its two strings
    $roles = New-Object System.Collections.ArrayList
    if ($Story) { [void]$roles.Add(@("story", "ain")) } else { [void]$roles.Add(@("leader", "ain")); [void]$roles.Add(@("member", "kain")) }
    $i = 0
    foreach ($r in $roles) {
        $role = $r[0]; $hero = $r[1]
        $shots = Join-Path $Out "shots_$role"
        New-Item -ItemType Directory -Force $shots | Out-Null
        $clients += Start-UE "client_$role" @("/Game/Hwanghon/Frontend/L_Loading", "-game", "-windowed", "-ResX=1280", "-ResY=720",
            "-WinX=$(20 + 660 * $i)", "-WinY=40", "-HWQA=onlineloop", "-HWQARole=$role", "-HWQASelect=$hero",
            "-HHClientProfile=qa_$role", "-HWQAShots=`"$shots`"", "-HWQAOut=`"$(Join-Path $Out "report_$role.json")`"",
            "-HWQACompleteAfter=$(if ($Fallback) { 45 } else { 3 })")
        $i++
        Start-Sleep -Seconds 3
    }

    if ($Fallback) {
        # the matchmaker spreads logins over the least-loaded shelter: open the second one only after both players are
        # in shelter-001, then close shelter-001 once the party is in the dungeon - the return must fall back to it
        $t0 = Get-Date
        while (((Get-Date) - $t0).TotalSeconds -lt $TimeoutSec) {
            $n = @("leader", "member") | Where-Object { $l = Join-Path $Out "client_$_.log"; (Test-Path $l) -and (Select-String -Path $l -Pattern "GATE first_spawn_town_start" -Quiet) }
            if (@($n).Count -ge 2) { break }
            Start-Sleep -Seconds 2
        }
        $shelter2 = Start-UE "server_shelter2" (@($shelterMap, "-port=7778", "-Advertise=127.0.0.1:7778", "-InstanceId=shelter-002") + $common)
        $procs += $shelter2
        Write-Output "shelter-002 started"
        $t0 = Get-Date
        while (((Get-Date) - $t0).TotalSeconds -lt $TimeoutSec) {
            $leaderLog = Join-Path $Out "client_leader.log"
            if ((Test-Path $leaderLog) -and (Select-String -Path $leaderLog -Pattern "GATE dungeon_admitted" -Quiet)) { break }
            Start-Sleep -Seconds 2
        }
        Stop-Process -Id $shelter1.Id -Force
        Write-Output "shelter-001 closed during the dungeon run"
    }

    foreach ($c in $clients) {
        if (-not $c.WaitForExit($TimeoutSec * 1000)) { $c.Kill(); Write-Output "client $($c.Id) TIMEOUT" }
    }
    foreach ($r in $roles) {
        $log = Join-Path $Out "client_$($r[0]).log"
        $done = if (Test-Path $log) { Select-String -Path $log -Pattern "HWQA .*FINISH ok=" | Select-Object -Last 1 } else { $null }
        Write-Output ("{0,-7} {1}" -f $r[0], $(if ($done) { $done.Line } else { "no result line" }))
    }
}
finally {
    foreach ($p in $procs) { if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } }
}
