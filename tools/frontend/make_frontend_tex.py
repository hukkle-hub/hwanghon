"""Title-screen set textures (docs/design/158): the B-1 plan on the ops-room table, the four CCTV feeds, the logo.

python tools/frontend/make_frontend_tex.py  ->  art/frontend/*.png

- T_HW_FE_Plan_C   the plan paper (base colour): dark blueprint, grid, the shelter drawn in pale lines, no words
- T_HW_FE_Plan_M   masks (linear): R lines, G draw order 0 (core) -> 1 (far ends), B facility pins, A the route
                   외부 통로 -> 코어 -> 인력사무소 (첫 입장과 귀환의 길, doc 154)
                   The title material draws R where G < reveal («평면도 선이 그려지고», doc 157 S08) and the route
                   as the connect camera moves («찾아오는 길 경로 그리기», M03).
- T_HW_FE_Feed_0..3  CCTV feeds = real shots of our shelter (tour 02/07/10/03), cold, grainy, scanlined, no captions
- T_HW_FE_Logo     the logo cut from the director's selected title concept (v7 01_Selected_TitleScreen.png)

The layout is the shelter builder's (Scripts/ue_shelter_b1.py ARMS, R = 900 cm), drawn like the design sheet: north up.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "art", "frontend")
R = 900.0
DOOR_H = 380.0
ARMS = {   # Scripts/ue_shelter_b1.py - keep in step
    "Matteo":    dict(angle=90,  L=300,  W=360, room=(1000, 800)),
    "Manpower":  dict(angle=135, L=300,  W=360, room=(1200, 1000)),
    "Training":  dict(angle=45,  L=300,  W=360, room=(1600, 1400)),
    "Rank":      dict(angle=0,   L=300,  W=320, room=(900, 800)),
    "Supply":    dict(angle=315, L=300,  W=360, room=(1300, 1000)),
    "Emergency": dict(angle=270, L=1500, W=300, room=(500, 500), side=dict(at=700, side=+1, W=900, D=800)),
    "External":  dict(angle=225, L=2200, W=420, room=None),
    "B2Link":    dict(angle=180, L=1800, W=360, room=None),
}
PINS = ["Manpower", "Rank", "Training", "Supply", "Medical", "Core", "Matteo"]   # 7 시설 (v7 00_PROJECT_DECISIONS)

W, H = 2048, 1024
PLAN = 1000          # the plan square (px), left part of the sheet
SCALE = PLAN / 6400  # px per cm (the shelter spans about 60 m)
CX, CY = 60 + PLAN / 2, H / 2 + 40


def px(x, y):
    return (CX + x * SCALE, CY - y * SCALE)   # north (+y) up


def rot(a, x, y):
    r = math.radians(a)
    return (x * math.cos(r) - y * math.sin(r), x * math.sin(r) + y * math.cos(r))


def rect_poly(angle, b0, b1, w, off=0.0):
    """A rectangle along the arm direction (b forward from the core centre, w wide), off = sideways."""
    pts = [(b0, -w / 2 + off), (b1, -w / 2 + off), (b1, w / 2 + off), (b0, w / 2 + off)]
    return [px(*rot(angle, b, a)) for b, a in pts]


def shapes():
    """(polygon, order 0..1) - the core first, then each arm outward."""
    out = []
    core = [px(*rot(22.5 + 45 * k, R / math.cos(math.radians(22.5)), 0)) for k in range(8)]
    out.append((core, 0.0))
    centres = {"Core": (0.0, 0.0)}
    far = 3100.0
    for name, a in ARMS.items():
        b = R
        out.append((rect_poly(a["angle"], b, b + a["L"], a["W"]), (b + a["L"] * 0.5) / far))
        b += a["L"]
        if a.get("room"):
            rw, rd = a["room"]
            out.append((rect_poly(a["angle"], b, b + rd, rw), (b + rd * 0.5) / far))
            centres[name] = rot(a["angle"], b + rd / 2, 0)
        if a.get("side"):
            s = a["side"]
            at = R + s["at"]
            poly = rect_poly(a["angle"], at - s["W"] / 2, at + s["W"] / 2, s["D"], off=s["side"] * (a["W"] / 2 + s["D"] / 2))
            out.append((poly, at / far))
            centres["Medical"] = rot(a["angle"], at, s["side"] * (a["W"] / 2 + s["D"] / 2))
    return out, centres


def route(centres):
    """외부 통로 끝 -> 코어 -> 인력사무소 (polyline, world cm)."""
    ext = ARMS["External"]
    start = rot(ext["angle"], R + ext["L"] - 150, 0)
    return [start, rot(ext["angle"], R, 0), (0.0, 0.0), rot(ARMS["Manpower"]["angle"], R, 0), centres["Manpower"]]


def plan():
    rng = np.random.default_rng(7)
    # paper: cold dark blue-grey, uneven, with a faint grid (the sheet's «도면» look, no words)
    base = np.zeros((H, W, 3), np.float32)
    base[:] = (0.075, 0.085, 0.095)
    noise = rng.normal(0, 1, (H // 8, W // 8)).astype(np.float32)
    noise = np.array(Image.fromarray(noise).resize((W, H), Image.BICUBIC))
    base *= (1 + 0.12 * noise[..., None])
    img = Image.fromarray(np.clip(base * 255, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for x in range(0, W, 32):
        d.line([(x, 0), (x, H)], fill=(34, 40, 46), width=1)
    for y in range(0, H, 32):
        d.line([(0, y), (W, y)], fill=(34, 40, 46), width=1)
    shp, centres = shapes()
    lines = Image.new("L", (W, H), 0)
    order = Image.new("L", (W, H), 255)
    dl, do = ImageDraw.Draw(lines), ImageDraw.Draw(order)
    for poly, o in sorted(shp, key=lambda s: -s[1]):
        do.polygon(poly, fill=int(255 * min(1.0, o)))
    for poly, o in shp:
        dl.line(poly + [poly[0]], fill=255, width=4)
    # inner detail: the core's floor ring and the eight spokes (sheet §06 hub)
    c = px(0, 0)
    for rr in (0.35, 0.62):
        rpx = R * SCALE * rr
        dl.ellipse([c[0] - rpx, c[1] - rpx, c[0] + rpx, c[1] + rpx], outline=180, width=2)
    order_np = np.asarray(order.filter(ImageFilter.MaxFilter(9))).astype(np.float32) / 255
    lines_np = np.asarray(lines.filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
    # the legend column on the right: numbered rows as marks only (no text), like the concept's table plan
    for k in range(7):
        y = 170 + k * 100
        dl.rectangle([1180, y, 1250, y + 56], outline=200, width=3)
        dl.line([(1280, y + 28), (1900, y + 28)], fill=90, width=2)
    lines_np = np.maximum(lines_np, np.asarray(lines).astype(np.float32) / 255 * 0.8)
    # pins
    pins = Image.new("L", (W, H), 0)
    dp = ImageDraw.Draw(pins)
    for k, name in enumerate(PINS):
        x, y = px(*centres[name])
        dp.ellipse([x - 16, y - 16, x + 16, y + 16], fill=255)
        ly = 170 + k * 100
        dp.rectangle([1188, ly + 8, 1242, ly + 48], fill=255)     # the matching legend box lights with its pin
        order_np[ly:ly + 57, 1180:1251] = 0.35 + 0.08 * k
    pins_np = np.asarray(pins.filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255
    # route
    rt = Image.new("L", (W, H), 0)
    dr = ImageDraw.Draw(rt)
    pts = [px(*p) for p in route(centres)]
    dr.line(pts, fill=255, width=10, joint="curve")
    rt_np = np.asarray(rt.filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
    # route progress in the route's own mask: encode along-path distance in A as (0.2 .. 1] where the line is
    seg = np.cumsum([0] + [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)])
    total = seg[-1]
    yy, xx = np.nonzero(rt_np > 0.02)
    prog = np.zeros_like(rt_np)
    P = np.array(pts)
    for y, x in zip(yy, xx):
        best, bt = 1e9, 0.0
        for i in range(len(P) - 1):
            a, b = P[i], P[i + 1]
            ab = b - a
            t = np.clip(np.dot((x, y) - a, ab) / np.dot(ab, ab), 0, 1)
            dd = np.hypot(*((a + t * ab) - (x, y)))
            if dd < best:
                best, bt = dd, (seg[i] + t * math.dist(a, b)) / total
        prog[y, x] = 0.2 + 0.8 * bt
    # base colour: pale lines on the paper
    pal = np.asarray(img).astype(np.float32) / 255
    ink = np.array((0.55, 0.62, 0.66), np.float32)
    pal = pal * (1 - lines_np[..., None] * 0.75) + ink * lines_np[..., None] * 0.75
    Image.fromarray(np.clip(pal * 255, 0, 255).astype(np.uint8)).save(os.path.join(OUT, "T_HW_FE_Plan_C.png"))
    m = np.dstack([lines_np, order_np, pins_np, prog])
    Image.fromarray(np.clip(m * 255, 0, 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "T_HW_FE_Plan_M.png"))
    # a preview of the fully drawn state
    prev = pal.copy()
    glow = np.array((1.0, 0.62, 0.25), np.float32)
    prev += glow * (lines_np * 0.6 + pins_np)[..., None] + np.array((1.0, 0.45, 0.15)) * (prog > 0)[..., None] * 0.9
    Image.fromarray(np.clip(prev * 255, 0, 255).astype(np.uint8)).save(os.path.join(OUT, "preview_plan.png"))
    print("plan", {k: tuple(round(v) for v in c) for k, c in centres.items()})


def feeds(tour_dir):
    shots = ["tour_02_External_Inward", "tour_07_Training", "tour_10_Medical", "tour_03_Core_FromSW"]
    rng = np.random.default_rng(3)
    for k, s in enumerate(shots):
        im = Image.open(os.path.join(tour_dir, s + ".png")).convert("RGB").resize((512, 288), Image.LANCZOS)
        a = np.asarray(im).astype(np.float32) / 255
        g = a.mean(2, keepdims=True)
        a = g * 0.75 + a * 0.25                        # mostly grey
        a = a * np.array((0.86, 0.95, 1.0))            # cold CCTV
        a = np.clip((a - 0.04) * 1.35, 0, 1)
        a[::3] *= 0.78                                 # scanlines
        a += rng.normal(0, 0.025, a.shape)             # grain
        yy, xx = np.mgrid[0:288, 0:512]
        v = 1 - 0.55 * (((xx - 256) / 256) ** 2 + ((yy - 144) / 144) ** 2)
        a *= np.clip(v, 0.25, 1)[..., None]
        Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).save(os.path.join(OUT, f"T_HW_FE_Feed_{k}.png"))
    print("feeds", shots)


def logo(concept):
    im = Image.open(concept).convert("RGB")
    c = im.crop((590, 50, 1080, 470))
    a = np.asarray(c).astype(np.float32) / 255
    lum = a.max(2)
    alpha = np.clip((lum - 0.20) / 0.25, 0, 1)
    alpha[:, :40] = 0                                   # a lamp at the crop's left edge
    rgb = np.clip(a / np.maximum(lum[..., None], 1e-3) * np.clip(lum[..., None] * 1.15, 0, 1), 0, 1)
    out = Image.fromarray((np.dstack([rgb, alpha]) * 255).astype(np.uint8), "RGBA")
    out = out.resize((out.width * 2, out.height * 2), Image.LANCZOS)
    out.save(os.path.join(OUT, "T_HW_FE_Logo.png"))
    print("logo", out.size)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    plan()
    if len(sys.argv) > 1:
        feeds(sys.argv[1])
    if len(sys.argv) > 2:
        logo(sys.argv[2])
