"""
Measure Clean UI v1 pass criteria on tour captures (docs/design/126 §4).

  python Scripts/measure_ui_captures.py Saved/UITour

For every X.png that has an X_noui.png twin (same frame, key art only: on the frontend the tour hides
chrome/panels/text but keeps the background and hero illustration, which are UMG too; in combat the twin
is the 3D view with the UI layer off):
  changed     = pixels whose largest channel moved by more than DIFF (full resolution; dark translucent
                panels over dark art move only a little, so the threshold is low)
  ui cells    = CELL x CELL blocks where at least CELL_SHARE of pixels changed ("the UI touches this block";
                thin text and 1 px outlines count, which a downscaled mask would average away)
  ui cover    = share of all cells touched
  centre open = share of centre cells (x 25-75 %, y 10-90 %) NOT touched
  accents     = opaque UI pixels (changed by > SOLID_DIFF) close to an accent token (Gold, Cyan, Danger, Success)
Writes <dir>/ui_metrics.json and prints a table.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

DIFF = 10
CELL = 12
CELL_SHARE = 0.08
ACCENTS = {
    "Gold": (0xD0, 0xAE, 0x5A),
    "Cyan": (0x62, 0xB7, 0xCF),
    "Danger": (0xB7, 0x46, 0x43),
    "Success": (0x62, 0xA9, 0x84),
}
ACCENT_RADIUS = 40          # RGB distance to count as that token
MIN_CHROMA = 45             # max-min channel spread; greys (TextMuted #727D8C sits 47 from Success) are never accents
ACCENT_MIN_PIXELS = 150     # below this it is anti-aliasing, not a used accent
SOLID_DIFF = 60             # opaque UI mark vs translucent panel blend


def measure(ui_path, bare_path):
    ui = np.asarray(Image.open(ui_path).convert("RGB")).astype(np.int16)
    bare = np.asarray(Image.open(bare_path).convert("RGB")).astype(np.int16)
    h, w, _ = ui.shape
    changed = np.abs(ui - bare).max(axis=2) > DIFF

    ch, cw = h // CELL, w // CELL
    cells = changed[: ch * CELL, : cw * CELL].reshape(ch, CELL, cw, CELL).mean(axis=(1, 3)) >= CELL_SHARE
    y0, y1, x0, x1 = int(ch * 0.10), int(ch * 0.90), int(cw * 0.25), int(cw * 0.75)
    centre = cells[y0:y1, x0:x1]

    # Accents are opaque marks (text, outlines, bars). A translucent panel over art also moves pixels,
    # and its blend can land near a token colour, so only strongly changed pixels are classified.
    chroma = ui.max(axis=2) - ui.min(axis=2)
    solid = (np.abs(ui - bare).max(axis=2) > SOLID_DIFF) & (chroma >= MIN_CHROMA)
    accents = {}
    ui_px = ui[solid]
    for name, rgb in ACCENTS.items():
        dist = np.sqrt(((ui_px - np.array(rgb)) ** 2).sum(axis=1))
        accents[name] = int((dist < ACCENT_RADIUS).sum())
    used = [k for k, v in accents.items() if v >= ACCENT_MIN_PIXELS]
    return {
        "size": [w, h],
        "ui_cover": round(float(cells.mean()), 3),
        "centre_open": round(1.0 - float(centre.mean()), 3),
        "accent_pixels": accents,
        "accents_used": used,
        "state_accents": [k for k in used if k != "Gold"],
    }


def main():
    root = Path(sys.argv[1])
    out = {}
    for ui in sorted(root.glob("*.png")):
        if ui.stem.endswith("_noui"):
            continue
        bare = ui.with_name(ui.stem + "_noui.png")
        if bare.exists():
            out[ui.stem] = measure(ui, bare)
    (root / "ui_metrics.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"{'shot':22s} {'size':>10s} {'UI cover':>9s} {'centre open':>12s}  accents (pixels)")
    for name, m in out.items():
        acc = ", ".join(f"{k} {v}" for k, v in m["accent_pixels"].items() if v)
        print(f"{name:22s} {m['size'][0]}x{m['size'][1]:<5d} {m['ui_cover']:9.1%} {m['centre_open']:12.1%}  used: {', '.join(m['accents_used']) or '-'}  [{acc}]")


if __name__ == "__main__":
    main()
