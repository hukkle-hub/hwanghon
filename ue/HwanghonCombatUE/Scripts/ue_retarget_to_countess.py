"""Retarget template Mannequin clips onto the Paragon Countess skeleton (doc 129 §5, doc 130).

The Countess pack has no lying-down clip (Death floats up, Knock_* are airborne). The template's
MM_Death_* do lie down. IK rigs are auto-generated for both bodies, chains auto-mapped, the target
retarget pose auto-aligned, then the clips are duplicated with suffix _Countess into OUT.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_retarget_to_countess.py" -unattended -nullrhi
  env HW_RETARGET_CLIPS = comma separated source anim paths (default: all MM_Death_*)
"""
import os

import unreal

OUT = "/Game/Animation/Retarget"
MANNY_MESH = "/Game/Characters/Mannequins/Meshes/SKM_Manny_Simple"
COUNTESS_MESH = "/Game/ParagonCountess/Characters/Heroes/Countess/Meshes/SM_Countess"
DEATH = "/Game/Characters/Mannequins/Anims/Death"
DEFAULT = [f"{DEATH}/{n}" for n in ("MM_Death_Back_01", "MM_Death_Front_01", "MM_Death_Front_02",
                                     "MM_Death_Front_03", "MM_Death_Left_01", "MM_Death_Right_01")]
tools = unreal.AssetToolsHelpers.get_asset_tools()
lib = unreal.EditorAssetLibrary


def log(msg):
    unreal.log(f"[HWRetarget] {msg}")


def fresh(name, cls, factory):
    # Reuse on reruns: the retargeter references the rigs, so they cannot simply be deleted.
    path = f"{OUT}/{name}"
    if lib.does_asset_exist(path):
        return unreal.load_asset(path)
    asset = tools.create_asset(name, OUT, cls, factory)
    if not asset:
        raise RuntimeError(f"create failed: {path}")
    return asset


def make_rig(name, mesh_path):
    rig = fresh(name, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
    c = unreal.IKRigController.get_controller(rig)
    c.set_skeletal_mesh(unreal.load_asset(mesh_path))
    c.apply_auto_generated_retarget_definition()
    chains = [f"{ch.get_editor_property('chain_name')}" for ch in c.get_retarget_chains()]
    log(f"{name}: root={c.get_retarget_root()} chains={chains}")
    lib.save_loaded_asset(rig)
    return rig


def main():
    lib.make_directory(OUT)
    src_rig = make_rig("IK_Manny_Auto", MANNY_MESH)
    dst_rig = make_rig("IK_Countess_Auto", COUNTESS_MESH)

    rtg = fresh("RTG_Manny_To_Countess", unreal.IKRetargeter, unreal.IKRetargetFactory())
    rc = unreal.IKRetargeterController.get_controller(rtg)
    src_side, dst_side = unreal.RetargetSourceOrTarget.SOURCE, unreal.RetargetSourceOrTarget.TARGET
    rc.set_ik_rig(src_side, src_rig)
    rc.set_ik_rig(dst_side, dst_rig)
    try:
        rc.add_default_ops()
        rc.assign_ik_rig_to_all_ops(dst_side, dst_rig)
    except Exception as e:  # older op stack API
        log(f"ops: {e}")
    try:
        rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True)
    except Exception as e:
        log(f"auto_map_chains: {e}")
    try:
        rc.auto_align_all_bones(dst_side)
    except Exception as e:
        log(f"auto_align_all_bones: {e}")
    lib.save_loaded_asset(rtg)

    clips = [c for c in os.environ.get("HW_RETARGET_CLIPS", ",".join(DEFAULT)).split(",") if c]
    reg = unreal.AssetRegistryHelpers.get_asset_registry()
    datas = [reg.get_asset_by_object_path(f"{c}.{c.rsplit('/', 1)[-1]}") for c in clips]
    datas = [d for d in datas if d and d.is_valid()]
    for c in clips:
        stale = f"{OUT}/{c.rsplit('/', 1)[-1]}_Countess"
        if lib.does_asset_exist(stale):
            lib.delete_asset(stale)
    out = unreal.IKRetargetBatchOperation.duplicate_and_retarget(
        datas, unreal.load_asset(MANNY_MESH), unreal.load_asset(COUNTESS_MESH), rtg,
        "", "", "", "_Countess", OUT, False, False, True)
    moved = []
    for d in out or []:
        path = str(d.package_name)
        name = path.rsplit("/", 1)[-1]
        if not path.startswith(OUT):
            dst = f"{OUT}/{name}"
            if lib.does_asset_exist(dst):
                lib.delete_asset(dst)
            lib.rename_asset(path, dst)
            path = dst
        lib.save_asset(path)
        moved.append(path)
    log(f"retargeted {len(moved)}: {moved}")


main()
