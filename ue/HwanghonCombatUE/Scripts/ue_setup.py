"""
Hwanghon UE Vertical Slice editor bootstrap.

Run inside Unreal Editor after the C++ project compiles:
  py "ABSOLUTE_PATH/HwanghonCombatUE/Scripts/ue_setup.py"

Environment:
  HWANGHON_REPO=/path/to/original/hwanghon
  HW_SHELL_ONLY=1  # create native prototype shell maps without legacy imports

It imports the existing placeholder GLBs, creates Seohan_Combat_VS01,
and places the C++ graybox arena + boss + PlayerStart. It also creates
HW_Lobby and HW_Training for the native shell; the other quests have no
authored playable maps yet. Existing maps and materials are preserved.
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


def ensure_prototype_material():
    """Editor-generated material; generate with the project's target UE version."""
    asset_path = "/Game/Materials/M_HWPrototypeColor"
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        log(f"preserving existing material {asset_path}")
        return asset_path

    material = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        "M_HWPrototypeColor", "/Game/Materials", unreal.Material,
        unreal.MaterialFactoryNew()
    )
    if not material:
        raise RuntimeError(f"failed to create material {asset_path}")
    editing = unreal.MaterialEditingLibrary
    tint = editing.create_material_expression(
        material, unreal.MaterialExpressionVectorParameter, -400, 0
    )
    tint.set_editor_property("parameter_name", "Tint")
    tint.set_editor_property("default_value", unreal.LinearColor(0.25, 0.4, 0.65, 1.0))
    editing.connect_material_property(tint, "", unreal.MaterialProperty.MP_BASE_COLOR)
    roughness = editing.create_material_expression(
        material, unreal.MaterialExpressionConstant, -200, 140
    )
    roughness.set_editor_property("r", 0.85)
    editing.connect_material_property(roughness, "", unreal.MaterialProperty.MP_ROUGHNESS)
    # A small fill makes the stand-ins legible without hiding their lit shape.
    emissive = editing.create_material_expression(
        material, unreal.MaterialExpressionMultiply, -200, 280
    )
    emissive.set_editor_property("const_b", 0.035)
    editing.connect_material_expressions(tint, "", emissive, "A")
    editing.connect_material_property(emissive, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    editing.recompile_material(material)
    if not unreal.EditorAssetLibrary.save_loaded_asset(material):
        raise RuntimeError(f"failed to save material {asset_path}")
    log(f"saved {asset_path}")
    return asset_path


def create_shell_level(level_path: str, mode_path: str, training: bool):
    level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    mode_class = load_cpp_class(mode_path)
    if unreal.EditorAssetLibrary.does_asset_exist(level_path):
        if not level_subsystem.load_level(level_path):
            raise RuntimeError(f"failed to open existing level {level_path}")
        world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
        actual_mode = world.get_world_settings().get_editor_property("default_game_mode")
        if actual_mode != mode_class:
            warn(f"preserving authored level {level_path}, but its GameMode is "
                 f"{actual_mode}; shell route expects {mode_path}. Review World Settings.")
        else:
            log(f"verified existing level {level_path}: {mode_path}")
        return level_path

    if not level_subsystem.new_level(level_path):
        raise RuntimeError(f"failed to create level {level_path}")
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    world.get_world_settings().set_editor_property("default_game_mode", mode_class)
    spawn_actor(actor_subsystem, unreal.PlayerStart, (-450.0, 0.0, 96.0))
    if training:
        arena_class = load_cpp_class("/Script/HwanghonCombatUE.HWTrainingArena")
        spawn_actor(actor_subsystem, arena_class, (0.0, 0.0, 0.0))
        # GameMode spawns the visible native boss and player. Do not duplicate them.
    if not level_subsystem.save_current_level():
        raise RuntimeError(f"failed to save level {level_path}")
    log(f"saved {level_path}: {mode_path}")
    return level_path


def create_shell_levels():
    ensure_prototype_material()
    lobby = create_shell_level(
        "/Game/Maps/HW_Lobby", "/Script/HwanghonCombatUE.HWShellGameMode", False
    )
    training = create_shell_level(
        "/Game/Maps/HW_Training", "/Script/HwanghonCombatUE.HWTrainingGameMode", True
    )
    return [lobby, training]

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
    shell_only = os.environ.get("HW_SHELL_ONLY", "").strip().lower() in ("1", "true", "yes")
    imported = [] if shell_only else import_assets()
    legacy_level = None if shell_only else create_vertical_slice_level()
    shell_levels = create_shell_levels()
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level(shell_levels[0])
    log(f"done: legacy={legacy_level}, shell={shell_levels}, imported={len(imported)} objects")
    log("HW_Training uses explicit native stand-ins. Other quest arenas remain unavailable.")
    if not shell_only:
        log("Next: create AnimBP parents HWAinAnimInstance / HWBossAnimInstance and assign imported skeletal meshes.")

if __name__ == "__main__":
    main()
