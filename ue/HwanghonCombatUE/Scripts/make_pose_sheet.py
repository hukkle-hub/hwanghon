"""Stick-figure sheet from ue_anim_pose_dump.py output: one row per clip, one column per sample.

python Scripts/make_pose_sheet.py poses.json sheet.jpg [--view side|front]
side = Y (forward) x Z (up); front = X x Z. Floor line at Z=0. Blades in red.
"""
import json
import sys

from PIL import Image, ImageDraw, ImageFont

CHAINS = [
    ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head"],
    ["spine_03", "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l"],
    ["spine_03", "clavicle_r", "upperarm_r", "lowerarm_r", "hand_r"],
    ["pelvis", "thigh_l", "calf_l", "foot_l", "ball_l"],
    ["pelvis", "thigh_r", "calf_r", "foot_r", "ball_r"],
]
BLADES = [["hand_l", "weapon_l", "sword_tail_l_02"], ["hand_r", "weapon_r", "sword_tail_r_02"]]


def main():
    src, dst = sys.argv[1], sys.argv[2]
    view = "front" if "--view" in sys.argv and sys.argv[sys.argv.index("--view") + 1] == "front" else "side"
    data = json.load(open(src, encoding="utf-8"))
    names = list(data)
    cols = max(len(v["frames"]) for v in data.values())
    cw, ch, label = 150, 190, 170
    img = Image.new("RGB", (label + cols * cw, len(names) * ch), (22, 24, 28))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    scale = 0.55
    for r, name in enumerate(names):
        clip = data[name]
        d.text((8, r * ch + 8), f"{name}\n{clip['length']:.2f}s", fill=(230, 230, 230), font=font)
        for c, fr in enumerate(clip["frames"]):
            ox, oy = label + c * cw + cw // 2, r * ch + ch - 18
            d.line([(ox - 60, oy), (ox + 60, oy)], fill=(70, 70, 70))
            b = fr["bones"]

            def p(n):
                x, y, z = b[n]
                h = y if view == "side" else x
                return (ox + h * scale, oy - z * scale)

            for chain in CHAINS:
                pts = [p(n) for n in chain if n in b]
                if len(pts) > 1:
                    d.line(pts, fill=(200, 210, 225), width=2)
            for chain in BLADES:
                pts = [p(n) for n in chain if n in b]
                if len(pts) > 1:
                    d.line(pts, fill=(235, 70, 60), width=2)
            if "head" in b:
                hx, hy = p("head")
                d.ellipse([hx - 5, hy - 5, hx + 5, hy + 5], outline=(200, 210, 225))
            d.text((label + c * cw + 4, r * ch + 4), f"{fr['t']:.2f}", fill=(140, 140, 140), font=font)
    img.save(dst, quality=88)
    print(dst, img.size)


if __name__ == "__main__":
    main()
