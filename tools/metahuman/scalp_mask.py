"""Scalp mask in the head texture's UV space (doc 177 §23): the scalp under light hair shows through the part, so the
painted face texture gets the hair colour there. Same scalp rule as make_hair_groom.py (GROOM_HAIRLINE).

blender -b -P tools/metahuman/scalp_mask.py -- head_state.fbx out_prefix SIZE   (writes out_prefix.npz; scalp_paint.py paints)
"""
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix

a = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT, SIZE = a[0], a[1], int(a[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.abspath(SRC))
ms = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in ms:
    print("SCALP mesh", o.name, len(o.data.vertices), [m.name for m in o.data.materials][:4], len(o.data.uv_layers))
head = max(ms, key=lambda o: len(o.data.vertices))
mw = head.matrix_world
V = np.array([list(mw @ v.co) for v in head.data.vertices])
if V[:, 2].max() > 10:
    V *= 0.01
htop = V[:, 2].max()
yc = (V[:, 1].max() + V[:, 1].min()) / 2
fh, bh = (float(x) for x in os.environ.get("GROOM_HAIRLINE", "0.075,0.17").split(","))
# soft weight: 1 well inside the scalp, 0 at the hairline (2 cm ramp)
hxc = (V[:, 0].max() + V[:, 0].min()) / 2
fc = float(os.environ.get("GROOM_HAIRLINE_CENTER", str(fh)))
fl = fh - (fh - fc) * np.clip(1 - np.abs(V[:, 0] - hxc) / 0.045, 0, 1) * (V[:, 1] < yc)
w_front = np.clip((V[:, 2] - (htop - fl)) / 0.02, 0, 1)
w_back = np.clip((V[:, 2] - (htop - bh)) / 0.02, 0, 1) * np.clip((V[:, 1] - (yc + 0.01)) / 0.02, 0, 1)
W = np.maximum(w_front, w_back)
uv = head.data.uv_layers[0].data
polys, wts = [], []
for poly in head.data.polygons:
    if head.data.materials[poly.material_index].name.find("Head") < 0:
        continue
    ws = [W[v] for v in poly.vertices]
    if max(ws) <= 0:
        continue
    polys.append([(uv[li].uv[0], uv[li].uv[1]) for li in poly.loop_indices][:4] + [(np.nan, np.nan)] * (4 - min(4, len(poly.loop_indices))))
    wts.append(float(np.mean(ws)))
np.savez(OUT + ".npz", polys=np.array(polys), w=np.array(wts))
print("SCALP faces", len(polys), "->", OUT + ".npz (rasterize: scalp_paint.py)")
