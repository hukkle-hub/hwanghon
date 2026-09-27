"""
Hwanghon UE Vertical Slice editor bootstrap.

Run inside Unreal Editor after the C++ project compiles:
  py "ABSOLUTE_PATH/HwanghonCombatUE/Scripts/ue_setup.py"

Environment:
  HWANGHON_REPO=/path/to/original/hwanghon

It imports the existing placeholder GLBs, creates Seohan_Combat_VS01,
and places the C++ graybox arena + boss + PlayerStart.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import unreal

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
MANIFEST = json.loads((SCRIPT_DIR / "asset_manifest.json").read_text(encoding="utf-8"))

def log(msg: str):
    unreal.log(f"[HwanghonSetup] {msg}")

def warn(msg: str):
    unreal.log_warning(f"[HwanghonSetup] {msg}")

def import_assets():
    repo = os.environ.get(MANIFEST.get("source_root_env", "HWANGHON_REPO"), "").strip()
    if not repo:
        warn("HWANGHON_REPO is not set; skipping legacy placeholder asset import.")
        return []

    repo_path = Path(repo)
    tasks = []
    for item in MANIFEST["assets"]:
        src = repo_path / item["source"]
        if not src.exists():
            warn(f"missing source: {src}")
            continue

        task = unreal.AssetImportTask()
        task.filename = str(src)
        task.destination_path = item["destination"]
        task.automated = True
        task.replace_existing = True
        task.save = True
        tasks.append(task)

    if not tasks:
        warn("no import tasks")
        return []

    tools = unreal.AssetToolsHelpers.get_asset_tools()
    tools.import_asset_tasks(tasks)

    imported = []
    for task in tasks:
        paths = list(task.imported_object_paths)
        imported.extend(paths)
        log(f"imported {task.filename} -> {paths}")
    return imported

def load_cpp_class(path: str):
    cls = unreal.load_class(None, path)
    if not cls:
        raise RuntimeError(f"Could not load compiled C++ class: {path}")
    return cls

def spawn_actor(actor_subsystem, cls, location, rotation=(0.0, 0.0, 0.0)):
    return actor_subsystem.spawn_actor_from_class(
        cls,
        unreal.Vector(*location),
        unreal.Rotator(rotation[1], rotation[2], rotation[0])
    )

def create_vertical_slice_level():
    level_path = "/Game/Maps/Seohan_Combat_VS01"
    level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

    # Recreate only when absent. Existing authored map is preserved.
    if unreal.EditorAssetLibrary.does_asset_exist(level_path):
        log(f"opening existing level {level_path}")
        level_subsystem.load_level(level_path)
        return level_path

    log(f"creating {level_path}")
    ok = level_subsystem.new_level(level_path)
    if not ok:
        raise RuntimeError(f"failed to create level {level_path}")

    arena_cls = load_cpp_class("/Script/HwanghonCombatUE.HWGrayboxArena")
    boss_cls = load_cpp_class("/Script/HwanghonCombatUE.HWBossCharacter")

    spawn_actor(actor_subsystem, arena_cls, (0.0, 0.0, 0.0))
    spawn_actor(actor_subsystem, boss_cls, (450.0, 0.0, 115.0), (0.0, 180.0, 0.0))
    spawn_actor(actor_subsystem, unreal.PlayerStart, (-450.0, 0.0, 96.0), (0.0, 0.0, 0.0))

    level_subsystem.save_current_level()
    log(f"saved {level_path}")
    return level_path

def ensure_content_folders():
    for p in [
        "/Game/Maps",
        "/Game/Characters/Ain",
        "/Game/Characters/Kain",
        "/Game/Bosses/Training",
        "/Game/Weapons/Ain",
        "/Game/Animation",
        "/Game/Materials",
        "/Game/VFX",
    ]:
        unreal.EditorAssetLibrary.make_directory(p)

def main():
    log("starting")
    ensure_content_folders()
    imported = import_assets()
    level = create_vertical_slice_level()
    log(f"done: level={level}, imported={len(imported)} objects")
    log("Next: create AnimBP parents HWAinAnimInstance / HWBossAnimInstance and assign imported skeletal meshes.")

if __name__ == "__main__":
    main()
