"""Part 1 boss bodies (docs/design/151) -> UE.

For every GLB in art/3d/part1/ (made by tools/3d/rig_boss_template.py):
  rigged  <id>.glb        -> /Game/Bosses/Part1/<id>/SkeletalMeshes/<id> + clips <id><clip>, and DA_Boss_<id>
                             (the training boss's pattern table on this body's clips, ue_boss_training_setup.build)
  static  <id>_static.glb -> /Game/Bosses/Part1/<id>_static/StaticMeshes/...
Story fights pick them up through story_episodes.json "body" (a HWCharacterVisualSettings id in DefaultGame.ini,
boss_<id>) or "body_static" (the static mesh path). Generated assets are not committed; rerun this script.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_boss_part1_setup.py" -unattended -nullrhi
  env HW_BOSS_GLB_DIR (default <repo>/art/3d/part1), HW_BOSSES=clave,subject_09 (default: all)
"""
import os

import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.environ.get("HW_BOSS_GLB_DIR") or os.path.join(REPO, "art", "3d", "part1")
DEST = "/Game/Bosses/Part1"
lib = unreal.EditorAssetLibrary

# the training script, loaded as a module (its own __main__ block does not run)
ns = {"__name__": "ue_boss_training_setup"}
exec(open(os.path.join(HERE, "ue_boss_training_setup.py"), encoding="utf-8").read(), ns)
build_set = ns["build"]


def log(msg):
    unreal.log(f"[HWBossPart1] {msg}")


def add_skills(bid, prefix):
    """Designed skills (Content/Data/boss_skills.json, docs/design/181 §8) onto DA_Boss_<bid>: the baked clip
    <prefix><anim.clip> (tools/3d/boss_takes.py) bound to every beat, contact = (tell + beat at) / clip length, so the
    single clip plays on the move's own clock."""
    import json
    path = os.path.join(unreal.Paths.project_content_dir(), "Data", "boss_skills.json")
    skills = json.load(open(path, encoding="utf-8")).get(bid, []) if os.path.exists(path) else []
    if not skills:
        return
    da = unreal.load_asset(f"/Game/Animation/Boss/DA_Boss_{bid}")
    patterns = dict(da.get_editor_property("boss_patterns"))
    for sk in skills:
        seq = unreal.load_asset(prefix + sk["anim"]["clip"])
        if not seq:
            log(f"{bid}: skill {sk['clip']} has no clip {prefix + sk['anim']['clip']}")
            continue
        ln = seq.get_play_length()
        beats = sk.get("beats") or [{"at": sk.get("hit_at", 0.12)}]
        b = unreal.HWSequenceBinding()
        b.set_editor_property("sequence", seq)
        p = unreal.HWBossPatternAnimationBinding()
        p.set_editor_property("strike", b)
        p.set_editor_property("beat_sequences", [seq for _ in beats])
        p.set_editor_property("source_beat_normalized", [min(1.0, (sk["tell"] + x["at"]) / ln) for x in beats])
        patterns[sk["clip"]] = p
        log(f"{bid}: skill {sk['clip']} on {seq.get_name()} ({ln:.2f} s, {len(beats)} beats)")
    da.set_editor_property("boss_patterns", patterns)
    lib.save_loaded_asset(da)


def main():
    only = [x for x in os.environ.get("HW_BOSSES", "").split(",") if x]
    files = sorted(f for f in os.listdir(SRC) if f.endswith(".glb")) if os.path.isdir(SRC) else []
    tasks = []
    for f in files:
        bid = f[:-4]
        if only and bid.replace("_static", "") not in only:
            continue
        t = unreal.AssetImportTask()
        t.filename = os.path.join(SRC, f)
        t.destination_path = DEST
        t.automated = True
        t.replace_existing = True
        t.save = True
        tasks.append((bid, t))
    if not tasks:
        log(f"no GLB in {SRC}")
        return
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t for _, t in tasks])
    for bid, t in tasks:
        paths = list(t.imported_object_paths)
        log(f"{bid}: {len(paths)} objects")
        if not bid.endswith("_static"):
            prefix = f"{DEST}/{bid}/SkeletalMeshes/{bid}"
            if lib.does_asset_exist(prefix):
                build_set(prefix, f"DA_Boss_{bid}")
                add_skills(bid, prefix)
            else:
                log(f"{bid}: no skeletal mesh at {prefix} - {paths[:4]}")
    log("done")


main()
