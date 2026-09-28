"""Boss turnaround sheet -> front / back / side views for Hi3D multiview (docs/design/151).
Views are cut at the emptiest column near each third (sheets where views touch), cropped to the figure and padded
square on the sheet's own background. Output: art/3d/src/part1_views/<boss>_{front,back,side}.png
  python tools/3d/split_turnaround.py
"""
import os
import numpy as np
from PIL import Image

SRC = 'docs/story/source/design/bosses/turnaround'
OUT = 'art/3d/src/part1_views'
# sheet -> view order on the sheet (left to right); None = drop that segment
SHEETS = {
    # the shutter stands beside the body in every view (columns overlap): it goes in with the body and is split off
    # afterwards as its own mesh island - the novel's shutter (L1774-L1796) becomes the prop
    'clave': ('front', 'side', 'back'),
    'celestial': ('front', 'side', 'back'),
    'subject_09': ('front', 'side', 'back'),
    'shadow_fang': ('front', 'side', 'back'),
    'arsenal_overlord': ('front', 'side', 'back'),
    'amplifier_tower': ('front', 'side', 'back'),
    'minister_jeong_candidate': ('front', 'side', 'back'),
}


def load(name):
    im = Image.open(os.path.join(SRC, name + '.jpg')).convert('RGB')
    a = np.asarray(im).astype(int)
    bg = np.median(np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3)]), axis=0)
    fg = np.abs(a - bg).sum(axis=2) > 45
    return im, a, bg, fg


def square(im, bg, box, size=1024, margin=0.08):
    x0, y0, x1, y1 = box
    crop = im.crop(box)
    side = int(max(x1 - x0, y1 - y0) * (1 + 2 * margin))
    canvas = Image.new('RGB', (side, side), tuple(int(v) for v in bg))
    canvas.paste(crop, ((side - (x1 - x0)) // 2, (side - (y1 - y0)) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def bbox(fg, x0, x1):
    sub = fg[:, x0:x1]
    ys, xs = np.nonzero(sub)
    return x0 + xs.min(), ys.min(), x0 + xs.max() + 1, ys.max() + 1


def cuts_by_thirds(fg, n):
    col = fg.sum(axis=0)
    W = len(col)
    cuts = []
    for k in range(1, n):
        lo, hi = int(W * (k / n - 0.1)), int(W * (k / n + 0.1))
        cuts.append(lo + int(np.argmin(col[lo:hi])))
    return [0] + cuts + [W]


def segments(fg, min_w=15):
    col = fg.sum(axis=0) > 3
    segs, x, W = [], 0, len(col)
    while x < W:
        if col[x]:
            s = x
            while x < W and col[x]:
                x += 1
            if x - s > min_w:
                segs.append((s, x))
        x += 1
    return segs


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, order in SHEETS.items():
        im, a, bg, fg = load(name)
        if len(order) == 6:
            segs = segments(fg)
            assert len(segs) == 6, (name, segs)
            spans = segs
        else:
            c = cuts_by_thirds(fg, 3)
            spans = [(c[i], c[i + 1]) for i in range(3)]
        for view, (x0, x1) in zip(order, spans):
            if view:
                square(im, bg, bbox(fg, x0, x1)).save(os.path.join(OUT, f'{name}_{view}.png'))
        print(name, spans)
    # Leviathan: side view on top, head-on view below; no back view on the sheet
    im, a, bg, fg = load('leviathan')
    rows = fg.sum(axis=1)
    H = len(rows)
    cut = int(H * 0.45) + int(np.argmin(rows[int(H * 0.45):int(H * 0.75)]))
    for view, (y0, y1) in (('side', (0, cut)), ('front', (cut, H))):
        sub = fg[y0:y1]
        ys, xs = np.nonzero(sub)
        square(im, bg, (xs.min(), y0 + ys.min(), xs.max() + 1, y0 + ys.max() + 1)).save(os.path.join(OUT, f'leviathan_{view}.png'))
    print('leviathan rows cut at', cut)
    # Aegis-07: only a design sheet (dark, framed panels) - FRONT / SIDE / REAR boxes read off the sheet
    im = Image.open('docs/story/source/design/bosses/aegis_07_sheet.jpg').convert('RGB')
    for view, box in (('front', (604, 42, 878, 428)), ('side', (884, 42, 1382, 428)), ('back', (1388, 42, 1636, 428))):
        square(im, (12, 11, 10), box, margin=0.04).save(os.path.join(OUT, f'aegis_07_{view}.png'))


if __name__ == '__main__':
    main()
