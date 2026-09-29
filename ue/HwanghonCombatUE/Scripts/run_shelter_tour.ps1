# Shelter camera tour (docs/design/155): every HW_View spot of the B-1 map, one shot each, plus a contact sheet.
#   .\Scripts\run_shelter_tour.ps1 -Out C:\tmp\tour
param([string]$Out = "$PSScriptRoot\..\Saved\ShelterTour")
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force $Out | Out-Null
$ue = "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
$project = (Resolve-Path "$PSScriptRoot\..\HwanghonCombatUE.uproject").Path
$p = Start-Process -FilePath $ue -PassThru -ArgumentList @("`"$project`"", "/Game/Hwanghon/Maps/Hub/L_GangnamBunker_B1", "-game", "-windowed",
    "-ResX=1280", "-ResY=720", "-HWQA=sheltertour", "-HWQAShots=`"$Out`"", "-abslog=`"$Out\qa.log`"", "-nosplash", "-unattended")
if (-not $p.WaitForExit(600000)) { $p.Kill(); throw "tour timed out" }
Select-String -Path "$Out\qa.log" -Pattern "HWQA .*FINISH" | Select-Object -Last 1 | ForEach-Object { $_.Line -replace '^.*HWQA', 'HWQA' }
$sheet = @"
from PIL import Image, ImageDraw, ImageFont
import glob, os
f = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 18)
fs = sorted(glob.glob(os.path.join(r'$Out', 'tour_*.png')))
cols = 4; rows = (len(fs) + cols - 1) // cols
out = Image.new('RGB', (cols * 480, rows * 270)); d = ImageDraw.Draw(out)
for i, p in enumerate(fs):
    x, y = (i % cols) * 480, (i // cols) * 270
    out.paste(Image.open(p).convert('RGB').resize((480, 270)), (x, y))
    d.text((x + 6, y + 4), os.path.basename(p)[5:-4], font=f, fill=(255, 255, 0))
out.save(os.path.join(r'$Out', 'tour_sheet.png'))
"@
$sheet | python -
