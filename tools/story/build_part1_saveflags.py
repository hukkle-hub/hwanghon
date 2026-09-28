"""Part 1 SaveFlags from the production master (docs/story/source/production/*제작마스터*.md) -> Content/Data.

Each episode's "### SaveFlag" block lists `SF_x=value` (several per line, split by " / "). The story director writes
the episode's flags when the episode ends (docs/design/143). Run: python tools/story/build_part1_saveflags.py
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "ue", "HwanghonCombatUE", "Content", "Data", "part1_saveflags.json")


def main():
    src = sorted(glob.glob(os.path.join(ROOT, "docs", "story", "source", "production", "*제작마스터*.md")))
    if not src:
        sys.exit("no production master found")
    text = open(src[-1], encoding="utf-8").read()
    episodes = {}
    for m in re.finditer(r"^# (EP\d\d) — .*?$(.*?)(?=^# EP\d\d — |^# 29\.|\Z)", text, re.S | re.M):
        ep, body = m.group(1), m.group(2)
        block = re.search(r"^### SaveFlag\s*$(.*?)(?=^### |\Z)", body, re.S | re.M)
        flags = {}
        if block:
            for k, v in re.findall(r"`(SF_[A-Za-z0-9_]+)=([^`]+)`", block.group(1)):
                flags[k] = v.strip()
        if not flags:
            sys.exit(f"{ep}: no SaveFlag block")
        episodes[ep] = flags
    if len(episodes) != 28:
        sys.exit(f"expected 28 episodes, got {len(episodes)}")
    out = {"schema": "hwanghon-part1-saveflags-v1", "source": os.path.relpath(src[-1], ROOT).replace("\\", "/"),
           "episodes": episodes}
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{len(episodes)} episodes, {sum(len(v) for v in episodes.values())} flags -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
