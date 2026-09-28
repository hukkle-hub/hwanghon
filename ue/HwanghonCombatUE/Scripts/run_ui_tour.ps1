# Clean UI v1 capture tour at the reference 2340x1080 (docs/design/126).
# Writes Saved/UITour/*.png stills, Saved/UITour/video/f_*.png (15 fps) and tour_log.txt,
# then Saved/UITour/ui_navigation.mp4 when Pillow + imageio-ffmpeg are available.
param(
    [string]$UERoot = 'C:\Program Files\Epic Games\UE_5.8',
    [int]$Width = 2340,
    [int]$Height = 1080
)
$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $PSScriptRoot
$Editor = Join-Path $UERoot 'Engine\Binaries\Win64\UnrealEditor.exe'

# -ResX/-ResY lose to a saved GameUserSettings, and UHWGraphicsQualitySubsystem::ApplyTier
# re-applies those settings on every tier switch. Pin a windowed reference resolution first.
# Version must match UE_GAMEUSERSETTINGS_VERSION (5 in 5.8) or the engine resets to WindowedFullscreen.
$Cfg = Join-Path $Project 'Saved\Config\WindowsEditor'
New-Item -ItemType Directory -Force $Cfg | Out-Null
@"
[/Script/Engine.GameUserSettings]
Version=5
ResolutionSizeX=$Width
ResolutionSizeY=$Height
LastUserConfirmedResolutionSizeX=$Width
LastUserConfirmedResolutionSizeY=$Height
FullscreenMode=2
LastConfirmedFullscreenMode=2
PreferredFullscreenMode=2
bUseDynamicResolution=False
"@ | Set-Content -Encoding ASCII (Join-Path $Cfg 'GameUserSettings.ini')

$p = Start-Process -FilePath $Editor -PassThru -Wait -ArgumentList @(
    "`"$Project\HwanghonCombatUE.uproject`"", '/Game/Maps/HW_Frontend', '-game', '-windowed',
    "-ResX=$Width", "-ResY=$Height", '-ForceRes', '-benchmark', '-fps=30', '-HWUITour',
    '-nosplash', '-nop4', "-abslog=$Project\Saved\Logs\ui_tour.log")
"tour exit $($p.ExitCode)"

$Tour = Join-Path $Project 'Saved\UITour'
python (Join-Path $PSScriptRoot 'make_frames_video.py') (Join-Path $Tour 'video') (Join-Path $Tour 'ui_navigation.mp4') 15
