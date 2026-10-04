"""Joints of an unrigged Hi3D figure (doc 180): front and side orthographic renders -> mediapipe pose -> 3D joints
(x and z from the front view, y and z from the side view). Used by fit_outfit.py to pose the MetaHuman skeleton like
the design figure before moving the clothes onto it.

blender -b -P tools/metahuman/outfit_joints.py -- figure.glb out.json
"""
import json
import math
import os
import subprocess
import sys

import bpy
import numpy as np
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = a[0], a[1]
FACE_PY = os.environ.get("FACE_PY", "C:/w/tools/face-venv/Scripts/python.exe")
WORK = os.path.splitext(os.path.abspath(OUT))[0] + "_work"
os.makedirs(WORK, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=os.path.abspath(SRC))
ms = [o for o in sc.objects if o.type == "MESH"]
fig = max(ms, key=lambda o: len(o.data.vertices))
for o in ms:
    o.hide_render = o is not fig
bpy.context.view_layer.update()
V = np.array([list(fig.matrix_world @ v.co) for v in fig.data.vertices])
lo, hi = V.min(0), V.max(0)
H = hi[2] - lo[2]
ORTHO = H * 1.1
zc = (lo[2] + hi[2]) / 2
xc, yc = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
RES = 1024
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.color_type = "TEXTURE"
sc.display.shading.light = "STUDIO"
sc.render.resolution_x = sc.render.resolution_y = RES
sc.world = bpy.data.worlds.new("w")
sc.world.color = (0.75, 0.75, 0.75)
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = ORTHO
views = {"front": ((xc, yc - 5, zc), (math.pi / 2, 0, 0)), "side": ((xc + 5, yc, zc), (math.pi / 2, 0, math.pi / 2))}
for k, (loc, rot) in views.items():
    cam.location, cam.rotation_euler = Vector(loc), rot
    sc.render.filepath = f"{WORK}/{k}.png"
    bpy.ops.render.render(write_still=True)
DETECT = r"""
import json, sys, cv2, mediapipe as mp
out = {}
with mp.solutions.pose.Pose(static_image_mode=True, model_complexity=2, min_detection_confidence=0.2) as po:
    for p in sys.argv[2:]:
        r = po.process(cv2.cvtColor(cv2.imread(p), cv2.COLOR_BGR2RGB))
        out[p] = [[l.x, l.y, l.visibility] for l in r.pose_landmarks.landmark] if r.pose_landmarks else None
json.dump(out, open(sys.argv[1], "w"))
"""
open(f"{WORK}/detect.py", "w").write(DETECT)
subprocess.run([FACE_PY, f"{WORK}/detect.py", f"{WORK}/lm.json", f"{WORK}/front.png", f"{WORK}/side.png"], check=True)
lm = json.load(open(f"{WORK}/lm.json"))
F, S = lm[f"{WORK}/front.png"], lm[f"{WORK}/side.png"]
print("JOINTS detected front", F is not None, "side", S is not None)
NAMES = {"shoulder_l": 11, "shoulder_r": 12, "elbow_l": 13, "elbow_r": 14, "wrist_l": 15, "wrist_r": 16,
         "hip_l": 23, "hip_r": 24, "knee_l": 25, "knee_r": 26, "ankle_l": 27, "ankle_r": 28, "nose": 0}
J = {}
for nm, k in NAMES.items():
    fx, fz = F[k][0], F[k][1]
    x = xc + (fx - 0.5) * ORTHO
    z = zc + (0.5 - fz) * ORTHO
    y = yc
    if S:
        # side camera looks along -X from +X: image right = +Y? (camera at +X facing -X, rotated 90 about Z: right = +Y)
        y = yc + (S[k][0] - 0.5) * ORTHO
        z = (z + zc + (0.5 - S[k][1]) * ORTHO) / 2
    J[nm] = [round(x, 4), round(y, 4), round(z, 4), round(F[k][2], 2)]
if not S:
    # no side view: the depth from the torso itself (the bounds centre includes props - a scythe put it 13 cm back)
    zs_, zh_ = J["shoulder_l"][2], J["hip_l"][2]
    mx_ = (J["shoulder_l"][0] + J["shoulder_r"][0]) / 2
    tor = V[(V[:, 2] > zh_) & (V[:, 2] < zs_) & (np.abs(V[:, 0] - mx_) < 0.12)]
    ty = float((np.percentile(tor[:, 1], 5) + np.percentile(tor[:, 1], 95)) / 2)
    for k in J:
        J[k][1] = round(ty, 4)
    print("JOINTS no side view: torso depth", round(ty, 4), "bounds centre was", round(float(yc), 4))
# mediapipe left/right is the person's own; in the front view the person's left is image right (+X)
json.dump({"joints": J, "bounds": [lo.tolist(), hi.tolist()]}, open(OUT, "w"), indent=1)
for nm, v in J.items():
    print("JOINTS", nm, v)
