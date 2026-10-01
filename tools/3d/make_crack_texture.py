"""T_HW_Crack source (docs/design/174): radial ground cracks drawn procedurally - jagged branching lines from the
centre and a darker scorch in the middle, alpha = the crack. The packs had no crack decal usable on the phone.
python tools/3d/make_crack_texture.py art/fx/crack.png
"""
import math
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

S = 512
random.seed(17)
alpha = Image.new("L", (S, S), 0)
d = ImageDraw.Draw(alpha)


def crack(x, y, ang, length, width, depth):
    seg = 14
    for _ in range(int(length / seg)):
        ang += random.uniform(-0.45, 0.45)
        nx, ny = x + math.cos(ang) * seg, y + math.sin(ang) * seg
        d.line((x, y, nx, ny), fill=255, width=max(1, int(width)))
        x, y = nx, ny
        width *= 0.93
        if depth < 2 and random.random() < 0.16:
            crack(x, y, ang + random.choice((-1, 1)) * random.uniform(0.5, 1.0), length * 0.35, width * 0.8, depth + 1)


c = S / 2
for i in range(9):
    crack(c, c, 2 * math.pi * i / 9 + random.uniform(-0.25, 0.25), random.uniform(150, 235), random.uniform(5, 8), 0)
# scorch in the middle
scorch = Image.new("L", (S, S), 0)
ImageDraw.Draw(scorch).ellipse((c - 62, c - 62, c + 62, c + 62), fill=150)
scorch = scorch.filter(ImageFilter.GaussianBlur(24))
alpha = alpha.filter(ImageFilter.GaussianBlur(1.2))
a = Image.eval(Image.merge("L", (alpha,)), lambda v: v)
merged = Image.new("L", (S, S))
merged.putdata([max(p, q) for p, q in zip(a.getdata(), scorch.getdata())])
rgb = Image.new("RGB", (S, S), (22, 18, 15))
out = Image.merge("RGBA", (*rgb.split(), merged))
out.save(sys.argv[1])
print("CRACK", sys.argv[1])
