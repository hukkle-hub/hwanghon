"""
Convert the web art the Clean UI v1 screens use (repo art/*.webp) to PNG for UE import.
UE's texture importer does not read WebP. Plain Python + Pillow, run before ue_ui_setup.py:

  python Scripts/prepare_ui_art.py            # -> Saved/UIArtSrc/*.png
"""
from pathlib import Path
from PIL import Image

PROJECT = Path(__file__).resolve().parent.parent
REPO = PROJECT.parent.parent
OUT = PROJECT / "Saved" / "UIArtSrc"

NAMES = [
    "lobby-bg", "title-ain", "office-brief", "forge-kain", "story-city", "lobby-city", "boss-marsh",
    "full-ain", "full-kain", "full-ryu", "full-sera",
    "face-ain", "face-kain", "face-ryu", "face-sera", "face-matteo",
    "portrait-ain", "portrait-kain", "portrait-ryu", "portrait-sera",
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        src = REPO / "art" / f"{name}.webp"
        if not src.exists():
            print(f"missing {src}")
            continue
        img = Image.open(src)
        img = img.convert("RGBA") if img.mode in ("RGBA", "LA", "P") else img.convert("RGB")
        dst = OUT / f"{name}.png"
        img.save(dst)
        print(f"{dst.name} {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
