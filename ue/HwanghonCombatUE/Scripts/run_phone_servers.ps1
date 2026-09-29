# The shelter and dungeon servers for the phone build (docs/design/160): matchmaker + one shelter + one dungeon on this
# PC, advertised on the LAN address so a phone on the same Wi-Fi joins them (package_android_phone.ps1 points the APK at
# http://<this PC>:8080). Runs until Enter is pressed. The first time, Windows asks to let UnrealEditor and node through
# the firewall on private networks - allow it (this script does not touch firewall settings).
#   .\Scripts\run_phone_servers.ps1 [-HostIp 192.168.x.y]
param([string]$HostIp = "")
$ErrorActionPreference = "Stop"
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$project = (Resolve-Path "$PSScriptRoot\..\HwanghonCombatUE.uproject").Path
$repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$out = Join-Path $PSScriptRoot "..\Saved\PhoneServers"
New-Item -ItemType Directory -Force $out | Out-Null
if (-not $HostIp) {
    $HostIp = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.PrefixOrigin -in "Dhcp", "Manual" -and $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" } |
        Sort-Object InterfaceMetric | Select-Object -First 1).IPAddress
}
foreach ($port in 8080, 7777, 7780) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "port $port is taken - an earlier run is still up" }
}
$secret = [guid]::NewGuid().ToString()
$procs = @()
function Start-UE([string]$name, [string[]]$ueArgs) {
    $all = @("`"$project`"") + $ueArgs + @("-abslog=`"$(Join-Path $out "$name.log")`"", "-nosplash", "-unattended")
    return Start-Process -FilePath $ue -ArgumentList $all -PassThru
}
try {
    $env:INSTANCE_SECRET = $secret
    $procs += Start-Process -FilePath "node" -ArgumentList @("`"$repo\tools\online\gateway.mjs`"") -PassThru `
        -RedirectStandardOutput (Join-Path $out "gateway.log") -RedirectStandardError (Join-Path $out "gateway.err.log")
    Remove-Item Env:\INSTANCE_SECRET
    $common = @("-server", "-log", "-nullrhi", "-InstanceSecret=$secret", "-Matchmaker=http://127.0.0.1:8080")
    $procs += Start-UE "server_shelter" (@("/Game/Hwanghon/Maps/Hub/L_GangnamBunker_B1?game=/Script/HwanghonCombatUE.HWShelterOnlineGameMode",
        "-port=7777", "-Advertise=${HostIp}:7777", "-InstanceId=shelter-001") + $common)
    $procs += Start-UE "server_dungeon" (@("/Game/Hwanghon/Story/EP03/EP03_World?game=/Script/HwanghonCombatUE.HWDungeonOnlineGameMode",
        "-port=7780", "-Advertise=${HostIp}:7780", "-InstanceId=dungeon-001", "-Mission=GangnamStation_B2") + $common)
    Write-Output "matchmaker http://${HostIp}:8080  shelter ${HostIp}:7777  dungeon ${HostIp}:7780 - Enter stops them"
    [void](Read-Host)
}
finally {
    foreach ($p in $procs) { if ($p -and -not $p.HasExited) { $p.Kill() } }
}
