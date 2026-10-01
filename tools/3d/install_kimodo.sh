#!/bin/bash
# Kimodo install, the Kimodo Blender Bridge installer's steps without Blender (docs/design/172)
set -e
PY=/c/Users/MIN/AppData/Local/Programs/Python/Python310/python.exe
V=/c/w/tools/kimodo-venv
VP=$V/Scripts/python.exe
[ -x "$VP" ] || "$PY" -m venv "$V"
"$VP" -m pip install -q --upgrade pip
"$VP" -m pip install -q torch --index-url https://download.pytorch.org/whl/cu121
"$VP" -m pip install -q https://github.com/Aero-Ex/kimodo/releases/download/v1.0.0/motion_correction-1.0.0-cp310-cp310-win_amd64.whl
"$VP" -m pip install -q "bitsandbytes>=0.46.1" safetensors psutil
SKIP_MOTION_CORRECTION_IN_SETUP=1 "$VP" -m pip install -q https://github.com/Aero-Ex/kimodo/archive/HEAD.zip
"$VP" -m pip install -q https://github.com/nv-tlabs/kimodo-viser/archive/HEAD.zip
mkdir -p $V/llm2vec-model
"$VP" -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Aero-Ex/KIMODO-Meta3_llm2vec_NF4', local_dir=r'C:/w/tools/kimodo-venv/llm2vec-model')"
"$VP" -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='nvidia/Kimodo-SOMA-RP-v1')"
echo INSTALL_DONE
