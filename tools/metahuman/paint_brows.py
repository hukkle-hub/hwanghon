"""Paint the design's brows into a built MetaHuman face base colour (doc 177 §14).
The MetaHuman skin texture carries the preset's pale brows; the brow area is found by its greyness against the local
skin redness (two biggest blobs in the brow band), painted with the design colour at 0.95 with a little strand noise.
The result goes back as the official face texture override (lab_build.py MH_FACE_BC).
python paint_brows.py in_BC.png out_BC.png [r,g,b=0.22,0.21,0.21] [shift_px=0]
shift_px: the painted brow moves down by this many texture pixels (the design brows sit lower than the preset's)
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
col = np.array([float(x) for x in (sys.argv[3] if len(sys.argv) > 3 else "0.22,0.21,0.21").split(",")])
im = np.asarray(Image.open(src).convert("RGB")).astype(float) / 255
H, W, _ = im.shape
red = im[..., 0] - im[..., 2]
local = np.asarray(Image.fromarray(np.clip(red * 765, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(30))).astype(float) / 765
d = local - red
box = np.zeros(red.shape, bool)
box[int(0.27 * H):int(0.35 * H), int(0.30 * W):int(0.70 * W)] = True
mb = (box & (d > np.percentile(d[box], 88))).astype(np.uint8)
mb = np.asarray(Image.fromarray(mb * 255).filter(ImageFilter.MaxFilter(5))) > 0
lab, n = ndimage.label(mb)
sizes = ndimage.sum(mb, lab, range(1, n + 1))
keep = np.isin(lab, np.argsort(-sizes)[:2] + 1).astype(np.uint8) * 255
SHIFT = int(sys.argv[4]) if len(sys.argv) > 4 else 0
SHIFT_HAIR = SHIFT
STYLE = sys.argv[5] if len(sys.argv) > 5 else "trace"
if STYLE.startswith("straight"):
    # the design's brows: thin and nearly straight, the inner end a little lower and thicker (a stern look).
    # The preset's arched brow is filled with the surrounding skin first, then a tapered straight stroke is drawn
    # over the same span. straight[:thick_px[:tail_px[:inner_drop_px]]]
    parts = (STYLE.split(":") + [None] * 4)[:4]
    TH = float(parts[1] or 16); TT = float(parts[2] or 6); DROP = float(parts[3] or 6)
    hole = np.asarray(Image.fromarray(keep).filter(ImageFilter.MaxFilter(9))) > 0
    keep_mask = (~hole).astype(float)
    num = np.stack([ndimage.gaussian_filter(im[..., c] * keep_mask, 18) for c in range(3)], -1)
    den = ndimage.gaussian_filter(keep_mask, 18)[..., None]
    fill = num / np.maximum(den, 1e-3)
    soft = ndimage.gaussian_filter(hole.astype(float), 3)[..., None]
    im = im * (1 - soft) + fill * soft
    new = np.zeros((H, W), float)
    yy, xx = np.mgrid[0:H, 0:W]
    for lab_id in np.argsort(-sizes)[:2] + 1:
        ys, xs = np.nonzero(lab == lab_id)
        x0b, x1b = xs.min(), xs.max()
        base = np.median(ys) + SHIFT
        inner_x = x1b if (x0b + x1b) / 2 < W / 2 else x0b       # the end towards the face centre
        outer_x = x0b if inner_x == x1b else x1b
        t = np.clip((xx - outer_x) / (inner_x - outer_x), 0, 1)  # 0 outer -> 1 inner
        inside = (xx >= x0b) & (xx <= x1b)
        yc = base + DROP * t
        th = TT + (TH - TT) * t ** 0.7
        # soft edge (1.5 px) and rounded, fading ends
        edge = np.clip((th / 2 - np.abs(yy - yc)) / 1.5 + 0.5, 0, 1)
        ends = np.clip(np.minimum(xx - x0b, x1b - xx) / 6.0, 0, 1)
        new = np.maximum(new, edge * ends * inside)
    if STYLE.startswith("straighthair"):
        # hair strokes instead of a solid bar: short thin lines inside the brow shape, the inner ones rising, the tail
        # ones lying towards the outer end; the inner end fades over 25 px (a bar with a square end read as drawn on)
        from PIL import ImageDraw
        rng_ = np.random.default_rng(3)
        canvas = Image.new("L", (W, H), 0)
        dr_ = ImageDraw.Draw(canvas)
        for lab_id in np.argsort(-sizes)[:2] + 1:
            ys, xs = np.nonzero(lab == lab_id)
            x0b, x1b = xs.min(), xs.max()
            base = np.median(ys) + SHIFT_HAIR
            inner_x = x1b if (x0b + x1b) / 2 < W / 2 else x0b
            outer_x = x0b if inner_x == x1b else x1b
            sgn = 1 if outer_x > inner_x else -1                 # +x towards the outer end
            for _ in range(int((x1b - x0b) * 3.2)):
                t_ = rng_.random()                              # 0 outer .. 1 inner
                x_ = outer_x + (inner_x - outer_x) * t_
                th_ = TT + (TH - TT) * t_ ** 0.7
                yc_ = base + DROP * t_ + (rng_.random() - 0.5) * th_ * 0.9
                ang = np.radians(55 * t_ ** 1.5 + 12)              # from the horizontal: inner rises, tail lies flat
                L_ = 10 + 8 * rng_.random()
                dx, dy = np.cos(ang) * L_ * sgn, -np.sin(ang) * L_
                fade = min(1.0, (1 - t_) * (x1b - x0b) / 25.0) if t_ > 0.5 else min(1.0, t_ * (x1b - x0b) / 10.0)
                dr_.line((x_ - dx / 2, yc_ - dy / 2, x_ + dx / 2, yc_ + dy / 2), fill=int(255 * (0.55 + 0.45 * rng_.random()) * fade), width=2)
        new = np.asarray(canvas.filter(ImageFilter.GaussianBlur(0.7))).astype(float) / 255
    keep = (new * 255).astype(np.uint8)
    SHIFT = 0
keep = np.roll(keep, SHIFT, axis=0)
if STYLE.startswith("straighthair"):
    m = keep.astype(float) / 255
else:
    m = np.asarray(Image.fromarray(keep).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(2.5))).astype(float) / 255
noise = np.asarray(Image.fromarray((np.random.default_rng(1).random((H, W)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(float) / 255
a = np.clip(m * 0.95 * (0.8 + 0.4 * noise), 0, 1)[..., None]
Image.fromarray((np.clip(im * (1 - a) + col * a, 0, 1) * 255).astype(np.uint8)).save(dst)
print("brows painted px", int((m > 0.5).sum()))
