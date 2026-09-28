"""Animation Donor v1 — first 10 retarget previews onto the Hwanghon bodies (doc 134).

Donors are only what was obtained through their normal channel (docs/licenses/animation_donors.md):
Paragon Countess (Fab, already in the project) and Quaternius UAL 1/2 Standard (itch.io, CC0). The other
Fab donors are in the Fab library but must be installed into the project from the Epic launcher first.

Targets are the game's own four bodies + training boss (art/3d/*_anim.glb, one 24-joint Mixamo rig).
Outputs go to /Game/Hwanghon/Animation/Retarget/<Char> — retarget only, nothing edited yet (/Edited, /Final
stay empty until Control Rig passes and in-game QA).

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_donor_retarget_preview.py" -unattended -nullrhi
  env HW_UAL_DIR = folder with UAL1_Standard.glb / UAL2_Standard.glb (Unreal-Godot exports)
  env HWANGHON_REPO = repository root (for art/3d/ryu_anim.glb, sera_anim.glb)
"""
import os

import unreal

ROOT = "/Game/Hwanghon/Animation"
RIGS = ROOT + "/Retarget/Rigs"
COUNTESS = "/Game/ParagonCountess/Characters/Heroes/Countess"
tools = unreal.AssetToolsHelpers.get_asset_tools()
lib = unreal.EditorAssetLibrary

TARGETS = {
    "Ain": "/Game/Characters/Ain/ain_anim/SkeletalMeshes/ain_anim",
    "Kain": "/Game/Characters/Kain/kain_anim/SkeletalMeshes/kain_anim",
    "Ryu": "/Game/Characters/Ryu/ryu_anim/SkeletalMeshes/ryu_anim",
    "Sera": "/Game/Characters/Sera/sera_anim/SkeletalMeshes/sera_anim",
    "Boss": "/Game/Bosses/Training/boss_anim/SkeletalMeshes/boss_anim",
}
WEB_BODIES = {"Ryu": ("art/3d/ryu_anim.glb", "/Game/Characters/Ryu"), "Sera": ("art/3d/sera_anim.glb", "/Game/Characters/Sera")}
UAL = {"UAL1": "UAL1_Standard.glb", "UAL2": "UAL2_Standard.glb"}

# (slot, target, donor, clip) — the ten first-pass slots of CLAUDE_APPLY_ANIMATION_DONOR_V1 §10, plus
# comparison candidates where the primary donor is not installed yet.
PLAN = [
    ("Ain_Attack1", "Ain", "Countess", "Primary_Attack_A_Normal"),
    ("Ain_Attack2", "Ain", "Countess", "Primary_Attack_B_Normal"),
    ("Ain_Attack3", "Ain", "Countess", "Primary_Attack_Normal"),
    ("Ain_Dodge", "Ain", "UAL1", "Roll"),
    ("Ain_Dodge_alt", "Ain", "Countess", "Ability_E"),
    ("Kain_Attack1", "Kain", "UAL1", "Sword_Attack"),
    ("Kain_Attack1_alt", "Kain", "UAL2", "Sword_Regular_C"),
    ("Kain_Smash", "Kain", "UAL2", "Sword_Heavy_Combo"),
    ("Ryu_Attack1", "Ryu", "Countess", "Primary_Attack_Fast_V1"),
    ("Sera_Throw", "Sera", "UAL2", "OverhandThrow"),
    ("Boss_Charge", "Boss", "UAL2", "Shield_Dash"),
]

# Mixamo rig of the game bodies (imported names: "mixamorig:Hips" -> "mixamorig_Hips"). Chain names match
# the auto-generated donor rigs so FUZZY auto-mapping pairs them.
M = "mixamorig_"
MIXAMO_CHAINS = [("Spine", "Spine", "Spine2"), ("Neck", "Neck", "Neck"), ("Head", "Head", "Head"),
                 ("LeftClavicle", "LeftShoulder", "LeftShoulder"), ("LeftArm", "LeftArm", "LeftHand"),
                 ("RightClavicle", "RightShoulder", "RightShoulder"), ("RightArm", "RightArm", "RightHand"),
                 ("LeftLeg", "LeftUpLeg", "LeftFoot"), ("LeftFoot", "LeftToeBase", "LeftToeBase"),
                 ("RightLeg", "RightUpLeg", "RightFoot"), ("RightFoot", "RightToeBase", "RightToeBase")]


def log(msg):
    unreal.log(f"[HWDonor] {msg}")


def import_glb(path, dest):
    task = unreal.AssetImportTask()
    task.filename = path
    task.destination_path = dest
    task.automated = True
    task.replace_existing = True
    task.save = True
    tools.import_asset_tasks([task])
    log(f"imported {os.path.basename(path)} -> {dest} ({len(list(task.imported_object_paths))} objects)")


def assets_of(folder, cls_name):
    out = []
    for p in lib.list_assets(folder, recursive=True):
        a = unreal.load_asset(p)
        if a and a.get_class().get_name() == cls_name:
            out.append(a)
    return out


def fresh(folder, name, cls, factory):
    path = f"{folder}/{name}"
    if lib.does_asset_exist(path):
        return unreal.load_asset(path)
    return tools.create_asset(name, folder, cls, factory)


def auto_rig(name, mesh):
    rig = fresh(RIGS, name, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
    c = unreal.IKRigController.get_controller(rig)
    c.set_skeletal_mesh(mesh)
    c.apply_auto_generated_retarget_definition()
    log(f"{name}: root={c.get_retarget_root()} chains={[str(x.get_editor_property('chain_name')) for x in c.get_retarget_chains()]}")
    lib.save_loaded_asset(rig)
    return rig


def mixamo_rig(name, mesh):
    rig = fresh(RIGS, name, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
    c = unreal.IKRigController.get_controller(rig)
    c.set_skeletal_mesh(mesh)
    for ch in list(c.get_retarget_chains()):
        c.remove_retarget_chain(ch.get_editor_property("chain_name"))
    c.set_retarget_root(M + "Hips")
    for chain, start, end in MIXAMO_CHAINS:
        c.add_retarget_chain(chain, M + start, M + end, "")
    log(f"{name}: root={c.get_retarget_root()} chains={[str(x.get_editor_property('chain_name')) for x in c.get_retarget_chains()]}")
    lib.save_loaded_asset(rig)
    return rig


def retargeter(name, src_rig, dst_rig):
    rtg = fresh(RIGS, name, unreal.IKRetargeter, unreal.IKRetargetFactory())
    rc = unreal.IKRetargeterController.get_controller(rtg)
    src, dst = unreal.RetargetSourceOrTarget.SOURCE, unreal.RetargetSourceOrTarget.TARGET
    rc.set_ik_rig(src, src_rig)
    rc.set_ik_rig(dst, dst_rig)
    try:
        rc.remove_all_ops()   # reruns must not stack a second op set
        rc.add_default_ops()
        rc.assign_ik_rig_to_all_ops(dst, dst_rig)
        # The game bodies have no separate root: Hips IS the skeleton root. The Root Motion op copies the
        # donor's (static, in-place) root onto it and wipes the pelvis motion — a roll then floats at 98 cm.
        i = rc.get_index_of_op_by_name("Root Motion")
        if i >= 0:
            rc.set_retarget_op_enabled(i, False)
    except Exception as e:
        log(f"{name} ops: {e}")
    rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True)
    rc.auto_align_all_bones(dst)   # target retarget pose first (§5): T-pose Mixamo bodies vs A-pose donors
    lib.save_loaded_asset(rtg)
    return rtg


def main():
    for sub in ("Donors/Quaternius", "Retarget/Rigs") + tuple(f"{k}/{c}" for k in ("Retarget", "Edited", "Final")
                                                               for c in ("Ain", "Kain", "Ryu", "Sera", "Boss")):
        lib.make_directory(f"{ROOT}/{sub}")
    repo = os.environ.get("HWANGHON_REPO", "")
    for char, (rel, dest) in WEB_BODIES.items():
        if not lib.does_asset_exist(TARGETS[char]) and repo:
            import_glb(os.path.join(repo, rel), dest)
    ual_dir = os.environ.get("HW_UAL_DIR", "")
    donors = {"Countess": (unreal.load_asset(f"{COUNTESS}/Meshes/SM_Countess"), f"{COUNTESS}/Animations")}
    for key, fname in UAL.items():
        folder = f"{ROOT}/Donors/Quaternius/{key}"
        if not assets_of(folder, "SkeletalMesh") and ual_dir:
            import_glb(os.path.join(ual_dir, fname), folder)
        meshes = assets_of(folder, "SkeletalMesh")
        if meshes:
            donors[key] = (meshes[0], folder)
    src_rigs = {k: auto_rig(f"IK_Donor_{k}", mesh) for k, (mesh, _) in donors.items()}
    dst_rigs = {c: mixamo_rig(f"IK_HW_{c}", unreal.load_asset(p)) for c, p in TARGETS.items() if lib.does_asset_exist(p)}

    reg = unreal.AssetRegistryHelpers.get_asset_registry()
    done = []
    for slot, char, donor, clip in PLAN:
        if donor not in donors or char not in dst_rigs:
            log(f"skip {slot}: donor {donor} or target {char} missing")
            continue
        mesh, folder = donors[donor]
        seq = next((a for a in assets_of(folder, "AnimSequence") if a.get_name() == clip or a.get_name().endswith(clip)), None)
        if not seq:
            log(f"skip {slot}: {donor} has no clip {clip}")
            continue
        rtg = retargeter(f"RTG_{donor}_To_{char}", src_rigs[donor], dst_rigs[char])
        out_dir = f"{ROOT}/Retarget/{char}"
        stale = f"{out_dir}/{seq.get_name()}_{char}"
        if lib.does_asset_exist(stale):
            lib.delete_asset(stale)
        out = unreal.IKRetargetBatchOperation.duplicate_and_retarget(
            [reg.get_asset_by_object_path(seq.get_path_name())], mesh, unreal.load_asset(TARGETS[char]), rtg,
            "", "", "", f"_{char}", out_dir, False, False, True)
        for d in out or []:
            path = str(d.package_name)
            if unreal.load_asset(path).get_class().get_name() != "AnimSequence":
                continue
            lib.save_asset(path)
            done.append((slot, donor, seq.get_name(), path))
            log(f"{slot}: {donor}/{seq.get_name()} -> {path}")
    log(f"previews {len(done)}/{len(PLAN)}")


main()
