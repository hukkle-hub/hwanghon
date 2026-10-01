"""Generate the Kimodo takes in art/anim/kimodo/prompts.json and turn each into an X Bot FBX (docs/design/172).

Run with the Kimodo venv python:  C:/w/tools/kimodo-venv/Scripts/python.exe tools/3d/kimodo_batch.py [id ...]
Output: C:/w/tools/kimodo_out/<id>/motion_0N.bvh  ->  <id>_s0N.fbx (X Bot, via tools/3d/kimodo_to_xbot.py)
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = r"C:/w/tools/kimodo_out"
BLENDER = r"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
PY = sys.executable
SAMPLES = 3

prompts = json.load(open(os.path.join(REPO, "art", "anim", "kimodo", "prompts.json"), encoding="utf-8"))
ids = sys.argv[1:] or [k for k in prompts if not k.startswith("_")]
for cid in ids:
    p = prompts[cid]
    d = os.path.join(OUT, cid)
    os.makedirs(d, exist_ok=True)
    subprocess.run([PY, "-m", "kimodo.scripts.generate", p["prompt"], "--duration", str(p["duration"]),
                    "--num_samples", str(SAMPLES), "--seed", "7", "--bvh", "--bvh_standard_tpose",
                    "--output", os.path.join(d, "motion")], check=True)
    for i in range(SAMPLES):
        bvh = os.path.join(d, "motion", f"motion_{i:02d}.bvh")
        if not os.path.isfile(bvh):
            bvh = os.path.join(d, f"motion_{i:02d}.bvh")
        fbx = os.path.join(d, f"{cid}_s{i:02d}.fbx")
        subprocess.run([BLENDER, "-b", "-P", os.path.join(HERE, "kimodo_to_xbot.py"), "--", bvh, fbx], check=True,
                       stdout=subprocess.DEVNULL)
        print("TAKE", cid, i, fbx, os.path.isfile(fbx))
