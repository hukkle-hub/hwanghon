"""
UE 5.5 editor asset quality audit for Hwanghon Vertical Slice.

Run:
  UnrealEditor-Cmd.exe HwanghonCombatUE.uproject -ExecutePythonScript=Scripts/ue_asset_audit.py -unattended

Outputs:
  Saved/AssetAudit/asset_audit.csv
  Saved/AssetAudit/asset_audit.json

This report is intentionally non-fatal: existing imported GLBs are placeholders and
are expected to fail some Hero-quality gates. The report tells us what must be replaced.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path
import unreal

PROJECT_DIR = Path(unreal.Paths.project_dir())
SAVED_DIR = Path(unreal.Paths.project_saved_dir()) / "AssetAudit"
SAVED_DIR.mkdir(parents=True, exist_ok=True)

SCAN_PATHS = [
    "/Game/Characters",
    "/Game/Bosses",
    "/Game/Weapons",
    "/Game/Materials",
    "/Game/VFX",
]

BUDGETS = json.loads((PROJECT_DIR / "Docs" / "HERO_ASSET_BUDGETS.json").read_text(encoding="utf-8"))

def safe_editor_property(obj, name, default=None):
    try:
        return obj.get_editor_property(name)
    except Exception:
        return default

def safe_method(obj, name, *args, default=None):
    try:
        fn = getattr(obj, name)
        return fn(*args)
    except Exception:
        return default

def classify_path(path: str) -> str:
    p = path.lower()
    if "/bosses/" in p:
        return "hero_boss"
    if "/characters/" in p:
        return "hero_character"
    if "/weapons/" in p:
        return "weapon"
    if "/materials/" in p:
        return "material"
    if "/vfx/" in p:
        return "vfx"
    return "other"

def material_slots(asset):
    mats = safe_editor_property(asset, "materials", [])
    try:
        return len(mats)
    except Exception:
        return None

def skeleton_path(asset):
    skel = safe_editor_property(asset, "skeleton", None)
    if not skel:
        return ""
    return unreal.EditorAssetLibrary.get_path_name_for_loaded_asset(skel)

def lod_count(asset):
    # Editor subsystem is the supported UE5 path when available.
    try:
        subsystem = unreal.get_editor_subsystem(unreal.SkeletalMeshEditorSubsystem)
        return int(subsystem.get_lod_count(asset))
    except Exception:
        return safe_method(asset, "get_lod_num", default=None)

def texture_size(asset):
    x = safe_method(asset, "blueprint_get_size_x", default=None)
    y = safe_method(asset, "blueprint_get_size_y", default=None)
    if x is None:
        x = safe_method(asset, "get_size_x", default=None)
    if y is None:
        y = safe_method(asset, "get_size_y", default=None)
    return x, y

def sequence_length(asset):
    v = safe_method(asset, "get_play_length", default=None)
    if v is None:
        v = safe_editor_property(asset, "sequence_length", None)
    return v

def evaluate(row):
    checks = []
    role = row["role"]

    if row["class"] == "SkeletalMesh":
        min_lods = BUDGETS.get(role, {}).get("min_lods")
        max_slots = BUDGETS.get(role, {}).get("max_material_slots")

        if min_lods and row["lod_count"] is not None:
            if row["lod_count"] < min_lods:
                checks.append(f"FAIL_LOD<{min_lods}")

        if max_slots and row["material_slots"] is not None:
            if row["material_slots"] > max_slots:
                checks.append(f"CHECK_MATERIAL_SLOTS>{max_slots}")

        if not row["skeleton"]:
            checks.append("FAIL_NO_SKELETON")

    if row["class"].startswith("Texture"):
        max_tex = BUDGETS.get(role, {}).get("texture_max_default", 2048)
        if row["width"] and row["height"] and max(row["width"], row["height"]) > max_tex:
            checks.append(f"CHECK_TEXTURE>{max_tex}")

    if row["class"] in ("AnimSequence", "AnimSequenceBase"):
        if row["duration"] is not None and row["duration"] <= 0.05:
            checks.append("FAIL_ANIM_TOO_SHORT")

    return "PASS" if not checks else "|".join(checks)

def main():
    paths = []
    for folder in SCAN_PATHS:
        paths.extend(unreal.EditorAssetLibrary.list_assets(folder, recursive=True, include_folder=False))

    # Keep order stable and remove duplicates.
    paths = sorted(set(paths))
    rows = []

    for path in paths:
        asset = unreal.EditorAssetLibrary.load_asset(path)
        if not asset:
            continue

        cls = asset.get_class().get_name()
        role = classify_path(path)
        row = {
            "path": path,
            "name": asset.get_name(),
            "class": cls,
            "role": role,
            "lod_count": None,
            "material_slots": None,
            "skeleton": "",
            "width": None,
            "height": None,
            "duration": None,
            "status": "PASS",
        }

        if cls == "SkeletalMesh":
            row["lod_count"] = lod_count(asset)
            row["material_slots"] = material_slots(asset)
            row["skeleton"] = skeleton_path(asset)
        elif cls.startswith("Texture"):
            row["width"], row["height"] = texture_size(asset)
        elif "AnimSequence" in cls:
            row["duration"] = sequence_length(asset)

        row["status"] = evaluate(row)
        rows.append(row)

    csv_path = SAVED_DIR / "asset_audit.csv"
    json_path = SAVED_DIR / "asset_audit.json"

    fields = [
        "path", "name", "class", "role", "lod_count", "material_slots",
        "skeleton", "width", "height", "duration", "status"
    ]

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fields)
        w.writeheader()
        w.writerows(rows)

    summary = {
        "asset_count": len(rows),
        "pass": sum(r["status"] == "PASS" for r in rows),
        "check_or_fail": sum(r["status"] != "PASS" for r in rows),
        "rows": rows,
        "budgets": BUDGETS,
    }
    json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    unreal.log(f"[HwanghonAssetAudit] {summary['asset_count']} assets")
    unreal.log(f"[HwanghonAssetAudit] PASS={summary['pass']} CHECK/FAIL={summary['check_or_fail']}")
    unreal.log(f"[HwanghonAssetAudit] CSV={csv_path}")
    unreal.log(f"[HwanghonAssetAudit] JSON={json_path}")

if __name__ == "__main__":
    main()
