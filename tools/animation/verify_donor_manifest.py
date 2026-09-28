#!/usr/bin/env python3
from pathlib import Path
import json, sys

root=Path.cwd()
manifest=root/"ue/HwanghonCombatUE/Content/Data/animation_donor_manifest.json"
sources=root/"ue/HwanghonCombatUE/Content/Data/animation_donor_sources.json"

for p in (manifest,sources):
    if not p.exists():
        raise SystemExit(f"missing: {p}")

m=json.loads(manifest.read_text(encoding="utf-8"))
s=json.loads(sources.read_text(encoding="utf-8"))

assert m["rules"]["no_character_switching"] is True
assert m["rules"]["combat_timing_is_authoritative"] is True
assert m["rules"]["paragon_ai_processing_forbidden"] is True
assert set(m["characters"])=={"ain","kain","ryu","sera"}
assert set(["paragon_sevarog","paragon_grux","paragon_rampage"]).issubset(
    set(m["boss"]["primary"]))

source_ids={x["id"] for x in s["sources"]}
for owner,body in m["characters"].items():
    for donor in body["primary"]+body["secondary"]+[body["locomotion"]]:
        assert donor in source_ids,(owner,donor)
    for slot,spec in body["slots"].items():
        assert spec["donors"],(owner,slot)
        assert spec["keywords"],(owner,slot)
        for donor in spec["donors"]:
            assert donor in source_ids,(owner,slot,donor)

for slot,spec in m["boss"]["slots"].items():
    assert spec["donors"] and spec["keywords"],slot
    for donor in spec["donors"]:
        assert donor in source_ids,(slot,donor)

for src in s["sources"]:
    if src["id"].startswith("paragon_"):
        assert src["ai_input_allowed"] is False,src["id"]

t=m["rules"]["timings"]
assert t["basic"]["duration"]==0.66 and t["basic"]["hit"]==0.24
assert t["smash"]["duration"]==1.15 and t["smash"]["hit"]==0.48
assert t["counter"]["duration"]==0.56 and t["counter"]["hit"]==0.18

print("ANIMATION DONOR MANIFEST VERIFY: PASS")
