#!/bin/bash
# wrap -> split -> import -> build for one hero (doc 177). usage: run_hero.sh Ain [head.glb]
N=$1; n=$(echo $N | tr A-Z a-z); HEAD=${2:-C:/w/mhlab/${n}_head.glb}
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"; UE="/c/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor.exe"
cd /c/w/hwanghon
"$B" -b -P tools/metahuman/wrap_template.py -- C:/w/mhlab/template_Archetype.fbx $HEAD C:/w/mhlab/${n}_wrapped.fbx C:/w/mhlab/${n}_wrap_preview.png 2>&1 | grep -E "^WRAP|Traceback|Error:|Assert"
"$B" -b -P tools/metahuman/split_template.py -- C:/w/mhlab/${n}_wrapped.fbx C:/w/mhlab/${n}_wrapped_head.fbx 2>&1 | grep "^SPLIT"
MH_NAME=$N MH_ALIGN=srt "$UE" C:/w/mhlab/MHLab.uproject '-ExecCmds=py C:/w/mhlab/import_template.py' -nosplash -unattended
tail -2 /c/w/mhlab/import_template_log.txt
MH_EXISTING=1 MH_ONLY=$N "$UE" C:/w/mhlab/MHLab.uproject '-ExecCmds=py C:/w/mhlab/lab_build.py' -nosplash -unattended
tail -1 /c/w/mhlab/lab_log.txt
