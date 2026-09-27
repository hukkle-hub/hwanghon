from __future__ import annotations
import csv, math, statistics, sys
from pathlib import Path

if len(sys.argv) < 2:
    raise SystemExit("usage: python Scripts/analyze_audit.py <Saved/CombatAudit/*.csv>")

path = Path(sys.argv[1])
rows = list(csv.DictReader(path.open(encoding="utf-8")))

samples = [r for r in rows if r["event"] == "sample"]
events = [r for r in rows if r["event"] != "sample"]

def nums(key):
    out = []
    for r in samples:
        try:
            out.append(float(r[key]))
        except (ValueError, TypeError):
            pass
    return out

def pct(xs, p):
    if not xs:
        return None
    xs = sorted(xs)
    i = min(len(xs)-1, max(0, math.ceil(p*len(xs))-1))
    return xs[i]

frames = nums("frame_ms")
pens = nums("penetration_cm")
gaps = nums("gap_cm")
reaction = nums("last_reaction_age_ms")

print(f"file: {path}")
print(f"samples: {len(samples)}, events: {len(events)}")
if frames:
    print(f"frame avg={statistics.mean(frames):.2f}ms p95={pct(frames,.95):.2f}ms p99={pct(frames,.99):.2f}ms >50ms={sum(x>50 for x in frames)}")
if pens:
    print(f"penetration max={max(pens):.2f}cm p95={pct(pens,.95):.2f}cm")
if gaps:
    print(f"gap min={min(gaps):.2f}cm")
if reaction:
    # Ignore stale reaction ages beyond 250ms for contact responsiveness summary.
    fresh = [x for x in reaction if x <= 250]
    if fresh:
        print(f"reaction fresh min={min(fresh):.2f}ms p95={pct(fresh,.95):.2f}ms")
print("events:")
for r in events:
    print(f"  {r['time']} {r['event']} {r['detail']}")
