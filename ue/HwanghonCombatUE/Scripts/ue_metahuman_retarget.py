"""Countess -> MetaHuman IK Retargeter for the heroes' MetaHumans (docs/design/184).

The combat body (Paragon Countess skeleton) keeps every clip; UHWRetargetAnimInstance copies its pose onto the
MetaHuman body at run time through this retargeter. Same recipe as RTG_XBot_To_Countess (Scripts/ue_mixamo_heroes.py,
docs/design/168 §3): auto retarget definition on a fresh IK rig, default ops, chains mapped fuzzily then by name,
target aligned to the source, pelvis by name, root motion off (the capsule moves the hero).

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_metahuman_retarget.py" -unattended -nullrhi
"""
import unreal

OUT = "/Game/Animation/Retarget"
COUNTESS_RIG = "/Game/Animation/Retarget/IK_Countess_Auto"
MH_BODY = "/Game/Heroes/Built/Ain/MH_Ain/Body/SKM_MH_Ain_BodyMesh"
lib = unreal.EditorAssetLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()
notes = []


def log(m):
    unreal.log(f"[HWMHRetarget] {m}")


def fresh(name, cls, factory):
    path = f"{OUT}/{name}"
    if lib.does_asset_exist(path):
        lib.delete_asset(path)
    return tools.create_asset(name, OUT, cls, factory)


body = unreal.load_asset(MH_BODY)
# reused when it exists (the retargeter references it, so the editor will not delete it); the auto definition below
# rewrites its chains
rig = unreal.load_asset(f"{OUT}/IK_MetaHuman") or tools.create_asset("IK_MetaHuman", OUT, unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
rc_ = unreal.IKRigController.get_controller(rig)
rc_.set_skeletal_mesh(body)
rc_.apply_auto_generated_retarget_definition()
log(f"MetaHuman chains: {[str(c.chain_name) for c in rc_.get_retarget_chains()]}, root {rc_.get_retarget_root()}")
lib.save_loaded_asset(rig)

# an existing retargeter (the editor may refuse to delete it) is reused with its ops cleared
rtg = unreal.load_asset(f"{OUT}/RTG_Countess_To_MH") or tools.create_asset("RTG_Countess_To_MH", OUT, unreal.IKRetargeter, unreal.IKRetargetFactory())
rc = unreal.IKRetargeterController.get_controller(rtg)
try:
    for i in reversed(range(rc.get_num_retarget_ops())):
        rc.remove_retarget_op(i)
except Exception as e:  # noqa: BLE001
    notes.append(f"clear ops: {e}")
S, T = unreal.RetargetSourceOrTarget.SOURCE, unreal.RetargetSourceOrTarget.TARGET
rc.set_ik_rig(S, unreal.load_asset(COUNTESS_RIG))
rc.set_ik_rig(T, rig)


def step(name, fn):
    try:
        fn()
    except Exception as e:  # noqa: BLE001
        notes.append(f"{name}: {e}")


step("add_default_ops", lambda: rc.add_default_ops())
step("auto_map_chains", lambda: rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True))
tc = unreal.IKRigController.get_controller(rig)
step("map_by_name", lambda: [rc.set_source_chain(c.chain_name, c.chain_name) for c in tc.get_retarget_chains()
                             if rc.get_source_chain(c.chain_name) in (None, "None", "")])
# the MetaHuman's metacarpal chains have no Countess match: the fuzzy map gave them the finger chains (a hand would
# fold twice), so they are left unmapped
step("metacarpals", lambda: [rc.set_source_chain(unreal.Name("None"), c.chain_name) for c in tc.get_retarget_chains()
                             if "Metacarpal" in str(c.chain_name)])
step("auto_align", lambda: rc.auto_align_all_bones(T))


def pelvis():
    pc = rc.get_op_controller(rc.get_index_of_op_by_name("Pelvis Motion"))
    pc.set_source_pelvis_bone("pelvis")
    pc.set_target_pelvis_bone("pelvis")
    rc.set_retarget_op_enabled(rc.get_index_of_op_by_name("Root Motion"), False)


step("pelvis", pelvis)
lib.save_loaded_asset(rtg)
log(f"map {[(str(c.chain_name), str(rc.get_source_chain(c.chain_name))) for c in tc.get_retarget_chains()]}")
log(f"notes {notes}")
log("done")
