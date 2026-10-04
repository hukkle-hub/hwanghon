"""Paint the scalp of a face base-colour texture with the hair colour (doc 177 §23), from scalp_mask.py's UV polygons.

python scalp_paint.py in_BC.png scalp.npz out_BC.png r,g,b [strength]
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, npz, out, rgb = sys.argv[1:5]
k = float(sys.argv[5]) if len(sys.argv) > 5 else 0.85
im = Image.open(src).convert("RGB")
S = im.size[0]
d = np.load(npz)
mask = Image.new("L", im.size, 0)
dr = ImageDraw.Draw(mask)
for P, w in zip(d["polys"], d["w"]):
    pts = [(u * S, (1 - v) * S) for u, v in P if not np.isnan(u)]
    dr.polygon(pts, fill=int(255 * w))
mask = mask.filter(ImageFilter.GaussianBlur(S / 400))
m = np.asarray(mask, np.float32)[..., None] / 255 * k
c = np.array([float(x) for x in rgb.split(",")]) * 255
a = np.asarray(im, np.float32)
Image.fromarray(np.clip(a * (1 - m) + c * m, 0, 255).astype(np.uint8)).save(out)
mask.save(out.replace(".png", "_mask.png"))
print("painted", out, "mask mean", round(float(m.mean()), 4))
