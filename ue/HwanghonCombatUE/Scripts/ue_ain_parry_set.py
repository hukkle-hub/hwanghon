"""Ain's counter and riposte motions (docs/design/183 §5): Kimodo takes -> Countess skeleton -> DA_Hero_ain Counter / Riposte.

Takes (art/anim/kimodo, chosen on Ain's game body from 3 seeds each, scratch render): hw_kmd_ain_parry (s00: the
scythe raised across the body, knocked back, ready again), hw_kmd_ain_riposte (s00: wide step, weapon high overhead,
driven down). Same path as Scripts/ue_mixamo_heroes.py for these two clips only, so the other heroes' sets stay as
they are: X Bot import (roll +90, the Blender FBX trap) -> RTG_XBot_To_Countess -> mask_geo curve -> bindings.
Contacts (measured from the hand-height curve, not the fastest frame - CLAUDE.md §2): parry = the hands highest
(the scythe across the body); riposte = 75 % of the way down from the overhead peak.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_ain_parry_set.py" -unattended -nullrhi
"""
import json
import os

import unreal

KD = os.path.normpath(os.path.join(unreal.Paths.project_dir(), "..", "..", "art", "anim", "kimodo"))
XBOT = "/Game/Animation/Boss/Scarecrow/XBot"
CLIPS = "/Game/Animation/Heroes/XBotClips"
OUT = "/Game/Animation/Heroes/Mixamo"
COUNTESS = "/Game/ParagonCountess/Characters/Heroes/Countess/Meshes/SM_Countess"
RTG = "/Game/Animation/Heroes/RTG_XBot_To_Countess"
SET = "/Game/Animation/Heroes/DA_Hero_ain"
TAKES = {"hw_kmd_ain_parry": "counter", "hw_kmd_ain_riposte": "riposte"}
lib = unreal.EditorAssetLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()
unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX False")
report = {}


def log(m):
    unreal.log(f"[HWAinParry] {m}")


xbot_mesh = unreal.load_asset(XBOT + "/SK_XBot")
xbot_skel = next((unreal.load_asset(a) for a in lib.list_assets(XBOT, recursive=False, include_folder=False)
                  if isinstance(unreal.load_asset(a), unreal.Skeleton)), None)
tasks = []
for name in TAKES:
    ui = unreal.FbxImportUI()
    for k, v in (("import_mesh", False), ("import_animations", True), ("import_as_skeletal", True), ("import_materials", False),
                 ("import_textures", False), ("skeleton", xbot_skel), ("mesh_type_to_import", unreal.FBXImportType.FBXIT_ANIMATION)):
        ui.set_editor_property(k, v)
    ui.get_editor_property("anim_sequence_import_data").set_editor_property(
        "import_rotation", unreal.Rotator(roll=90.0, pitch=0.0, yaw=0.0))
    t = unreal.AssetImportTask()
    for k, v in (("filename", os.path.join(KD, name + ".fbx")), ("destination_path", CLIPS), ("destination_name", "X_" + name),
                 ("automated", True), ("save", True), ("replace_existing", True), ("options", ui)):
        t.set_editor_property(k, v)
    tasks.append(t)
tools.import_asset_tasks(tasks)

reg = unreal.AssetRegistryHelpers.get_asset_registry()
datas = []
for name in TAKES:
    for cand in (f"{CLIPS}/X_{name}", f"{CLIPS}/X_{name}_Anim"):
        a = reg.get_asset_by_object_path(f"{cand}.{cand.rsplit('/', 1)[-1]}")
        if a.is_valid():
            datas.append(a)
            break
log(f"imported {len(datas)} clips")
for name in TAKES:
    for suffix in ("", "_Anim"):
        old = f"{OUT}/MX_{name[3:]}{suffix}"
        if lib.does_asset_exist(old):
            lib.delete_asset(old)
unreal.IKRetargetBatchOperation.duplicate_and_retarget(
    datas, xbot_mesh, unreal.load_asset(COUNTESS), unreal.load_asset(RTG), "X_hw_", "MX_", "", "", OUT, False, False, True)
L = unreal.AnimationLibrary
opt = unreal.AnimPoseEvaluationOptions()


def bone(pose, b):
    return unreal.AnimPoseExtensions.get_bone_pose(pose, b, unreal.AnimPoseSpaces.WORLD).translation


def samples(seq, n=61):
    ln = seq.get_play_length()
    return [(ln * i / (n - 1), unreal.AnimPoseExtensions.get_anim_pose_at_time(seq, ln * i / (n - 1), opt)) for i in range(n)], ln


da = unreal.load_asset(SET)
for name, kind in TAKES.items():
    seq = unreal.load_asset(f"{OUT}/MX_{name[3:]}") or unreal.load_asset(f"{OUT}/MX_{name[3:]}_Anim")
    if not seq:
        log(f"missing retargeted {name}")
        continue
    if "mask_geo" not in [str(c) for c in L.get_animation_curve_names(seq, unreal.RawCurveTrackTypes.RCT_FLOAT)]:
        L.add_curve(seq, "mask_geo", unreal.RawCurveTrackTypes.RCT_FLOAT)
    L.add_float_curve_key(seq, "mask_geo", 0.0, 1.0)
    lib.save_loaded_asset(seq)
    ss, ln = samples(seq)
    p0 = ss[0][1]
    fwd = bone(p0, "ball_l") - bone(p0, "foot_l")
    fwd.z = 0.0
    fwd = fwd.normal() if fwd.length() > 1 else unreal.Vector(0, 1, 0)
    hz = [(t, max(bone(p, "hand_r").z, bone(p, "hand_l").z)) for t, p in ss]
    k = max(range(len(hz)), key=lambda i: hz[i][1])
    if kind == "counter":
        # the scythe held highest across the body is where the strike is met (hand z 195 cm at 0.62 s; the hands
        # furthest forward came earlier, 0.37 s, on the way up)
        c = hz[k][0] / ln
    else:
        # the drive down: the hands come 75 % of the way from the overhead peak to where they end (the clip's tail
        # only lowers the arms, so the lowest point - 0.98 - was the end of the clip, not the blow)
        end = hz[-1][1]
        goal = end + 0.25 * (hz[k][1] - end)
        c = next((t for t, z in hz[k:] if z <= goal), hz[-1][0]) / ln
    prop = "counter" if kind == "counter" else "riposte"
    b = da.get_editor_property(prop)
    b.set_editor_property("sequence", seq)
    b.set_editor_property("source_contact_normalized", round(c, 3))
    da.set_editor_property(prop, b)
    log(f"{kind} hand z: " + " ".join(f"{t:.2f}:{z:.0f}" for t, z in hz[::4]))
    report[kind] = {"clip": seq.get_name(), "len": round(ln, 2), "contact": round(c, 3), "hand_top_cm": round(max(h for _, h in hz), 1)}
    log(f"{kind}: {seq.get_name()} {ln:.2f} s contact {c:.3f}")
lib.save_loaded_asset(da)
with open(os.path.join(unreal.Paths.project_saved_dir(), "ain_parry_set.json"), "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=1, ensure_ascii=False)
log("done")
