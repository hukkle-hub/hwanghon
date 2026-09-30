"""Draw and judge boss clips from bone positions (docs/design/165; data from Scripts/ue_boss_clip_bones.py).

  python tools/3d/clip_bone_sheet.py <clip_bones.json> <out dir> [--forward y|x]

Per clip one row: stick figures side view (forward axis vs up) at every sample, floor line at z = 0, the game's
"lowest bone onto the floor" drop drawn for down / lie / death / up (what the fight does for Dead and Break).
Checks, in centimetres:
  standing clips   - float: lowest foot/toe above the floor; sink: below it
  down/lie/death   - lying: head-to-floor and hips-to-floor after grounding; leg up: a foot higher than the hips
"""
import argparse
import json
import os

import cv2
import numpy as np

CHAINS = [
    ["mixamorig_Hips", "mixamorig_Spine", "mixamorig_Spine1", "mixamorig_Spine2", "mixamorig_Neck", "mixamorig_Head"],
    ["mixamorig_Spine2", "mixamorig_LeftShoulder", "mixamorig_LeftArm", "mixamorig_LeftForeArm", "mixamorig_LeftHand"],
    ["mixamorig_Spine2", "mixamorig_RightShoulder", "mixamorig_RightArm", "mixamorig_RightForeArm", "mixamorig_RightHand"],
    ["mixamorig_Hips", "mixamorig_LeftUpLeg", "mixamorig_LeftLeg", "mixamorig_LeftFoot", "mixamorig_LeftToeBase"],
    ["mixamorig_Hips", "mixamorig_RightUpLeg", "mixamorig_RightLeg", "mixamorig_RightFoot", "mixamorig_RightToeBase"],
]
COLORS = [(230, 230, 230), (80, 200, 255), (80, 120, 255), (120, 255, 120), (60, 180, 60)]   # right side darker
GROUNDED = ("down", "lie", "death", "up")
FEET = ("mixamorig_LeftFoot", "mixamorig_RightFoot", "mixamorig_LeftToeBase", "mixamorig_RightToeBase")


def judge(clip, samples):
    notes = []
    grounded = any(k in clip for k in GROUNDED)
    end = samples[-1]["bones"]
    low = min(p[2] for p in end.values())
    if grounded:
        hips = end["mixamorig_Hips"][2] - low
        head = end["mixamorig_Head"][2] - low
        feet = max(end[f][2] for f in ("mixamorig_LeftFoot", "mixamorig_RightFoot")) - low
        notes.append(f"end after grounding: hips {hips:.0f}, head {head:.0f}, highest foot {feet:.0f}")
        if clip.endswith(("death", "lie")) or "down" in clip:
            if hips > 60 or head > 70:
                notes.append("NOT LYING (hips/head high)")
            if feet > hips + 10:
                notes.append("LEG UP (a foot above the hips)")
    else:
        worst_float, worst_sink = 0.0, 0.0
        for s in samples:
            fz = min(s["bones"][f][2] for f in FEET if f in s["bones"])
            worst_float = max(worst_float, fz)
            worst_sink = min(worst_sink, fz)
        if worst_float > 12:
            notes.append(f"FEET OFF FLOOR up to {worst_float:.0f}")
        if worst_sink < -8:
            notes.append(f"FEET BELOW FLOOR to {worst_sink:.0f}")
    moving = max(abs(a - b) for s in samples for a, b in zip(s["bones"]["mixamorig_Head"], samples[0]["bones"]["mixamorig_Head"]))
    if moving < 3:
        notes.append("STATIC (head moves < 3 cm)")
    return notes


def draw(data, out, fwd):
    ax = 1 if fwd == "y" else 0
    cell, pad = 150, 4
    rows = []
    report = []
    for clip in sorted(data):
        samples = data[clip]["samples"]
        grounded = any(k in clip for k in GROUNDED)
        row = np.full((cell + 34, cell * len(samples), 3), 18, np.uint8)
        for i, s in enumerate(samples):
            b = s["bones"]
            drop = min(p[2] for p in b.values()) if grounded else 0.0
            x0 = i * cell
            sc = cell / 330.0

            def P(p):
                return (int(x0 + cell / 2 + p[ax] * sc), int(cell - 6 - (p[2] - drop) * sc) + 28)
            cv2.line(row, (x0 + pad, cell + 22), (x0 + cell - pad, cell + 22), (70, 70, 70), 1)
            for ch, col in zip(CHAINS, COLORS):
                pts = [P(b[n]) for n in ch if n in b]
                for a, c in zip(pts, pts[1:]):
                    cv2.line(row, a, c, col, 2)
            cv2.circle(row, P(b["mixamorig_Head"]), 5, (200, 200, 255), -1)
            cv2.putText(row, f"{s['t']:.2f}", (x0 + 4, 44), 0, 0.35, (150, 150, 150), 1)
        notes = judge(clip, samples)
        report.append((clip, data[clip]["len"], notes))
        bad = any(n.isupper() or n.split(" ")[0].isupper() for n in notes)
        cv2.putText(row, f"{clip}  {data[clip]['len']:.2f}s  " + " | ".join(notes)[:150], (6, 16), 0, 0.45,
                    (80, 80, 255) if any(w in " ".join(notes) for w in ("NOT", "LEG UP", "OFF", "BELOW", "STATIC")) else (120, 230, 120), 1)
        rows.append(row)
    w = max(r.shape[1] for r in rows)
    rows = [np.pad(r, ((0, 0), (0, w - r.shape[1]), (0, 0))) for r in rows]
    sheet = np.vstack(rows)
    cv2.imwrite(os.path.join(out, "clip_bone_sheet.png"), sheet)
    with open(os.path.join(out, "clip_report.txt"), "w", encoding="utf-8") as f:
        for clip, ln, notes in report:
            f.write(f"{clip}\t{ln:.2f}s\t{' | '.join(notes)}\n")
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json")
    ap.add_argument("out")
    ap.add_argument("--forward", default="y")
    a = ap.parse_args()
    data = json.load(open(a.json, encoding="utf-8"))
    for clip, ln, notes in draw(data, a.out, a.forward):
        print(f"{clip:28s} {ln:5.2f}s  {' | '.join(notes)}")


if __name__ == "__main__":
    main()
