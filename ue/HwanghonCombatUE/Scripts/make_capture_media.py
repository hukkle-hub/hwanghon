"""
Turn a ue_pie_capture.py run into review media (docs/design/125).

  python Scripts/make_capture_media.py <frames_dir> <pie_log_view.json> <out_prefix>

Writes <out_prefix>.mp4 (real time: shot_every frames at 30 fps, captioned with the
logged combat state) and <out_prefix>_keys.png (the first contact of attack1/2/3,
smash and counter, plus dodge and jump). Needs Pillow and imageio-ffmpeg.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

# Combat clock contact times (HWCombatTuningAsset.cpp / combat_rules.json).
HIT_AT = {"ATTACK1": 0.24, "ATTACK2": 0.24, "ATTACK3": 0.24, "SMASH": 0.48, "COUNTER": 0.18}
# Visual sample points for actions without contact.
POSE_AT = {"DODGE": 0.10, "JUMP": 0.20}


def font(size):
    for name in ("malgun.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def caption(im, lines, big, small):
    d = ImageDraw.Draw(im)
    h = 10 + 26 + 20 * (len(lines) - 1)
    d.rectangle([0, 0, im.width, h], fill=(0, 0, 0))
    d.text((10, 4), lines[0], font=big, fill=(255, 214, 120))
    for i, line in enumerate(lines[1:]):
        d.text((10, 32 + 20 * i), line, font=small, fill=(225, 225, 225))


def row_lines(r):
    return [
        f"t={r['t']:5.2f}s  {r['action']} {r['elapsed']:.2f}s",
        f"boss {r['boss']} {r['pattern']}  hp {r['boss_hp']:.0f} | ain hp {r['hp']:.0f} st {r['st']:.0f}"
        f" | src {r['src_seq'] or '-'} {r['src_norm']:.2f}",
    ]


def key_rows(rows):
    """First instance of each action at its contact (or pose) time, by combat clock."""
    picks, seen = [], set()
    prev = None
    for r in rows:
        a = r["action"]
        mark = HIT_AT.get(a, POSE_AT.get(a))
        if mark is not None and a not in seen and r["elapsed"] >= mark:
            if prev is None or prev["action"] != a or prev["elapsed"] < mark:
                picks.append((f"{a} {'contact' if a in HIT_AT else 'pose'} (combat {mark:.2f}s)", r))
                seen.add(a)
        prev = r
    # Every counter that staggered the boss (clash shows best one frame later).
    for i, r in enumerate(rows):
        if r["boss"] == "STAGGER" and i and rows[i - 1]["boss"] != "STAGGER":
            picks.append((f"COUNTER -> boss STAGGER ({r['pattern']})", r))
    return picks


def main():
    frames_dir, log_path, out_prefix = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    log = json.loads(log_path.read_text(encoding="utf-8"))
    log.setdefault("view", "game")
    rows = [r for r in log["rows"] if "shot" in r]
    fps = 30 / log["shot_every"]
    big, small = font(22), font(16)

    ff = imageio_ffmpeg.get_ffmpeg_exe()
    first = Image.open(frames_dir / f"HighresScreenshot{rows[0]['shot']:05d}.png")
    w, h = first.size
    enc = subprocess.Popen(
        [ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
         "-r", f"{fps}", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23",
         str(out_prefix.with_suffix(".mp4"))],
        stdin=subprocess.PIPE)
    for r in rows:
        im = Image.open(frames_dir / f"HighresScreenshot{r['shot']:05d}.png").convert("RGB")
        caption(im, [f"[{log['view']}] " + row_lines(r)[0], row_lines(r)[1]], big, small)
        enc.stdin.write(im.tobytes())
    enc.stdin.close()
    enc.wait()

    picks = key_rows(rows)
    tw, th = 640, 360
    cols = 4
    sheet = Image.new("RGB", (tw * cols, th * ((len(picks) + cols - 1) // cols)), (0, 0, 0))
    for i, (label, r) in enumerate(picks):
        im = Image.open(frames_dir / f"HighresScreenshot{r['shot']:05d}.png").convert("RGB").resize((tw, th))
        caption(im, [label, *row_lines(r)], font(18), font(13))
        sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
    sheet.save(out_prefix.parent / (out_prefix.name + "_keys.png"))
    print(f"{out_prefix}.mp4 ({len(rows)} frames @ {fps:g} fps) + keys ({len(picks)})")


if __name__ == "__main__":
    main()
