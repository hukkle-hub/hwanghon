# The director's phone build (docs/design/160): UE 5.8 -> Android APK (ASTC, arm64), with the online shelter pointed at
# this PC on the LAN, so the phone can play story mode offline and join the PC's shelter/dungeon servers
# (Scripts/run_phone_servers.ps1) on the same Wi-Fi.
#   .\Scripts\package_android_phone.ps1 [-HostIp 192.168.x.y] [-Configuration Development] [-Install]
# -Install: adb install -r onto the phone connected by USB (USB debugging on).
# Config/Android/AndroidGame.ini is written here (not committed - it carries this PC's LAN address).
param(
    [string]$HostIp = "",
    [ValidateSet("Development", "Shipping")]
    [string]$Configuration = "Development",
    [switch]$Install,
    [switch]$SkipBuild
)
$ErrorActionPreference = "Stop"
$ue = "C:\Program Files\Epic Games\UE_5.8"
$project = (Resolve-Path "$PSScriptRoot\..\HwanghonCombatUE.uproject").Path
$projDir = Split-Path $project
$archive = Join-Path $projDir "Saved\AndroidPackage\Phone_$Configuration"

if (-not $HostIp) {
    # the Wi-Fi / Ethernet address the phone can reach (not a virtual adapter)
    $HostIp = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.PrefixOrigin -in "Dhcp", "Manual" -and $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" } |
        Sort-Object InterfaceMetric | Select-Object -First 1).IPAddress
}
if (-not $HostIp) { throw "no LAN IPv4 address found - pass -HostIp" }
Write-Output "phone -> matchmaker http://${HostIp}:8080, fallback shelter ${HostIp}:7777"

New-Item -ItemType Directory -Force (Join-Path $projDir "Config\Android") | Out-Null
@"
; written by Scripts/package_android_phone.ps1 - this PC's LAN address for the phone build (not committed)
[/Script/HwanghonShelter.HHOnlineFlowSubsystem]
MatchmakerUrl=http://${HostIp}:8080/v1/match/shelter
FallbackShelterAddress=${HostIp}:7777
"@ | Set-Content -Encoding utf8 (Join-Path $projDir "Config\Android\AndroidGame.ini")

if (-not $SkipBuild) {
    & "$ue\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun "-project=$project" -noP4 -platform=Android -cookflavor=ASTC `
        "-clientconfig=$Configuration" -build -cook -stage -package -pak -compressed -archive "-archivedirectory=$archive" `
        -utf8output -unattended
    if ($LASTEXITCODE -ne 0) { throw "BuildCookRun failed: exit $LASTEXITCODE" }
}
$apk = Get-ChildItem $archive -Recurse -Filter *.apk | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) { throw "no APK under $archive" }
Write-Output ("APK {0}  {1:N0} MB" -f $apk.FullName, ($apk.Length / 1MB))
if ($Install) {
    $adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
    $devices = & $adb devices | Select-String "\tdevice$"
    if (-not $devices) { throw "no phone on adb - connect USB and allow USB debugging" }
    & $adb install -r $apk.FullName
}
