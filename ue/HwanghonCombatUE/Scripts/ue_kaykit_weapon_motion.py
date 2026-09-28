"""Weapon motions for the four characters from KayKit Adventurers (CC0, doc 133).

The Countess pack (doc 127/129) gives every character twin-blade motions. KayKit's Adventurers pack
(Kay Lousberg, CC0, github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) has 2H / dual
wield / throw / spell attacks on one rig. This imports Knight.glb, auto-rigs it, retargets the chosen
clips onto the Countess skeleton into /Game/Animation/KayKit (suffix _Countess).

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_kaykit_weapon_motion.py" -unattended -nullrhi
  env HW_KAYKIT_GLB = path to Knight.glb (download it from the repo above; the pack is not committed)
  env HW_KAYKIT_STEP = import | rig | retarget | all (default all)
"""
import os

import unreal

SRC_DIR = "/Game/FreeAssets/KayKit"
OUT = "/Game/Animation/KayKit"
COUNTESS_MESH = "/Game/ParagonCountess/Characters/Heroes/Countess/Meshes/SM_Countess"
CLIPS = ["2H_Melee_Attack_Chop", "2H_Melee_Attack_Slice", "2H_Melee_Attack_Spin", "2H_Melee_Attack_Stab",
         "2H_Melee_Idle", "Dualwield_Melee_Attack_Chop", "Dualwield_Melee_Attack_Slice",
         "Dualwield_Melee_Attack_Stab", "1H_Melee_Attack_Chop", "1H_Melee_Attack_Slice_Diagonal",
         "1H_Melee_Attack_Slice_Horizontal", "1H_Melee_Attack_Stab", "Throw", "Spellcast_Shoot",
         "Spellcast_Raise", "Spellcast_Long", "Use_Item"]
tools = unreal.AssetToolsHelpers.get_asset_tools()
lib = unreal.EditorAssetLibrary


def log(msg):
    unreal.log(f"[HWKayKit] {msg}")


def import_glb():
    glb = os.environ.get("HW_KAYKIT_GLB", "")
    if not os.path.isfile(glb):
        raise RuntimeError(f"HW_KAYKIT_GLB not found: {glb!r}")
    task = unreal.AssetImportTask()
    task.filename = glb
    task.destination_path = SRC_DIR
    task.automated = True
    task.replace_existing = True
    task.save = True
    tools.import_asset_tasks([task])
    paths = list(task.imported_object_paths)
    log(f"imported {len(paths)} objects")
    return paths


def find_assets(cls_name):
    out = []
    for p in lib.list_assets(SRC_DIR, recursive=True):
        a = unreal.load_asset(p)
        if a and a.get_class().get_name() == cls_name:
            out.append(a)
    return out


def fresh(name, cls, factory):
    path = f"{OUT}/{name}"
    if lib.does_asset_exist(path):
        return unreal.load_asset(path)
    asset = tools.create_asset(name, OUT, cls, factory)
    if not asset:
        raise RuntimeError(f"create failed: {path}")
    return asset


def make_rig(name, mesh):
    rig = fresh(name, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
    c = unreal.IKRigController.get_controller(rig)
    c.set_skeletal_mesh(mesh)
    c.apply_auto_generated_retarget_definition()
    bone = lambda ref: str(ref.get_editor_property("bone_name"))
    chains = {str(ch.get_editor_property("chain_name")): (bone(ch.get_editor_property("start_bone")),
                                                          bone(ch.get_editor_property("end_bone")))
              for ch in c.get_retarget_chains()}
    log(f"{name}: root={c.get_retarget_root()} chains={chains}")
    lib.save_loaded_asset(rig)
    return rig, c


# KayKit bone names (after import: "upperarm.l" -> "upperarm_l"); chain names match the Countess rig so
# auto-mapping pairs them. The auto definition only finds arms/head on this rig (no root, spine or legs).
KAYKIT_CHAINS = [("Spine", "spine", "chest"), ("Head", "head", "head"),
                 ("LeftArm", "upperarm_l", "hand_l"), ("RightArm", "upperarm_r", "hand_r"),
                 ("LeftLeg", "upperleg_l", "foot_l"), ("RightLeg", "upperleg_r", "foot_r"),
                 ("LeftFoot", "toes_l", "toes_l"), ("RightFoot", "toes_r", "toes_r")]


def make_kaykit_rig(mesh):
    rig = fresh("IK_KayKit", unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
    c = unreal.IKRigController.get_controller(rig)
    c.set_skeletal_mesh(mesh)
    for ch in list(c.get_retarget_chains()):
        c.remove_retarget_chain(ch.get_editor_property("chain_name"))
    c.set_retarget_root("hips")
    for name, start, end in KAYKIT_CHAINS:
        c.add_retarget_chain(name, start, end, "")
    log(f"IK_KayKit: root={c.get_retarget_root()} chains={[str(ch.get_editor_property('chain_name')) for ch in c.get_retarget_chains()]}")
    lib.save_loaded_asset(rig)
    return rig


def main():
    lib.make_directory(OUT)
    step = os.environ.get("HW_KAYKIT_STEP", "all")
    if step in ("import", "all") and not lib.does_directory_exist(SRC_DIR + "/Knight"):
        import_glb()
    meshes = find_assets("SkeletalMesh")
    anims = find_assets("AnimSequence")
    log(f"meshes {[m.get_path_name() for m in meshes]}")
    log(f"anims {len(anims)}: {[a.get_name() for a in anims][:80]}")
    if not meshes:
        return
    # The GLB splits into part meshes on one skeleton; the body carries the whole rig.
    knight = next((m for m in meshes if m.get_name().endswith("_Body")), meshes[0])
    src_rig = make_kaykit_rig(knight)
    dst_rig, _ = make_rig("IK_Countess_KayKit", unreal.load_asset(COUNTESS_MESH))
    if step == "rig":
        return
    rtg = fresh("RTG_KayKit_To_Countess", unreal.IKRetargeter, unreal.IKRetargetFactory())
    rc = unreal.IKRetargeterController.get_controller(rtg)
    src_side, dst_side = unreal.RetargetSourceOrTarget.SOURCE, unreal.RetargetSourceOrTarget.TARGET
    rc.set_ik_rig(src_side, src_rig)
    rc.set_ik_rig(dst_side, dst_rig)
    try:
        rc.add_default_ops()
        rc.assign_ik_rig_to_all_ops(dst_side, dst_rig)
    except Exception as e:
        log(f"ops: {e}")
    rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True)
    rc.auto_align_all_bones(dst_side)
    lib.save_loaded_asset(rtg)
    wanted = [a for a in anims if any(a.get_name().endswith(c) for c in CLIPS)]
    reg = unreal.AssetRegistryHelpers.get_asset_registry()
    datas = [reg.get_asset_by_object_path(a.get_path_name()) for a in wanted]
    out = unreal.IKRetargetBatchOperation.duplicate_and_retarget(
        datas, knight, unreal.load_asset(COUNTESS_MESH), rtg, "", "", "", "_Countess", OUT, False, False, True)
    saved = []
    for d in out or []:
        path = str(d.package_name)
        lib.save_asset(path)
        saved.append(path.rsplit("/", 1)[-1])
    log(f"retargeted {len(saved)}: {saved}")


main()
