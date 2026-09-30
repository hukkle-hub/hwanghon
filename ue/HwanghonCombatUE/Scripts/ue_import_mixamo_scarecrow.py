"""Mixamo clips for the EP01 scarecrow (docs/design/168): X Bot clips retargeted onto the 3 m scarecrow body.

Source: art/anim/mixamo_scarecrow/*.fbx (X Bot, without skin, 30 fps; downloaded 2026-10-01) and
_XBot_TPose_skin.fbx (the X Bot body). Mutant family for the 3 m body's weight, Injured family for the
part-break gaits, the 360 attack for the spin.

Why a retarget and not a plain import onto the scarecrow skeleton: the names match (mixamorig_*) but the bone
axes do not - the scarecrow's bones run along +Z, X Bot's along -Y - and X Bot's bones are shorter (hips 102
against 155). Imported directly, the body shrank to 1.8 m and every joint turned the wrong way.
The FBX files have "mixamorig:" rewritten to "mixamorig_" (same byte length) so the root matches.

Steps: legacy FBX import (Interchange ignores FbxImportUI) of the X Bot mesh and the clips onto its skeleton ->
auto IK rig for X Bot -> the scarecrow's IK_TrainingBoss -> retargeter with fuzzy chain map and the target
aligned to the source rest pose -> duplicate_and_retarget into /Game/Animation/Boss/Scarecrow/Mixamo (MX_*).
Writes Saved/mixamo_scarecrow.json: per clip length and hips/head/hand/foot heights against the idle.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_import_mixamo_scarecrow.py" -unattended -nullrhi
"""
import json
import os

import unreal

SRC = os.path.normpath(os.path.join(unreal.Paths.project_dir(), "..", "..", "art", "anim", "mixamo_scarecrow"))
ROOT = "/Game/Animation/Boss/Scarecrow"
XBOT = ROOT + "/XBot"
OUT = ROOT + "/Mixamo"
TARGET_MESH = "/Game/Bosses/Training/boss_anim/SkeletalMeshes/boss_anim"
TARGET_RIG = "/Game/Animation/Boss/IK_TrainingBoss"
REF_IDLE = "/Game/Bosses/Training/boss_anim/SkeletalMeshes/boss_animidle"
BONES = ["mixamorig_Hips", "mixamorig_Head", "mixamorig_LeftHand", "mixamorig_RightHand", "mixamorig_LeftFoot", "mixamorig_RightFoot"]
lib = unreal.EditorAssetLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()
unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX False")
notes = []


def fbx_task(path, dest, name, skeleton=None):
    ui = unreal.FbxImportUI()
    ui.set_editor_property("import_materials", False)
    ui.set_editor_property("import_textures", False)
    ui.set_editor_property("import_as_skeletal", True)
    if skeleton:
        ui.set_editor_property("import_mesh", False)
        ui.set_editor_property("import_animations", True)
        ui.set_editor_property("skeleton", skeleton)
        ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_ANIMATION)
    else:
        ui.set_editor_property("import_mesh", True)
        ui.set_editor_property("import_animations", False)
        ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_SKELETAL_MESH)
    t = unreal.AssetImportTask()
    for k, v in (("filename", path), ("destination_path", dest), ("destination_name", name), ("automated", True),
                 ("save", True), ("replace_existing", True), ("options", ui)):
        t.set_editor_property(k, v)
    return t


# Run in two sessions (HW_STEP=mesh, then HW_STEP=clips): clips imported in the same session as the X Bot body
# came out with no skeleton (the freshly made skeleton was not the one they bound to) and retargeted empty.
STEP = os.environ.get("HW_STEP", "clips")
if STEP == "mesh":
    for old in (OUT, XBOT):
        if lib.does_directory_exist(old):
            lib.delete_directory(old)
    tools.import_asset_tasks([fbx_task(os.path.join(SRC, "_XBot_TPose_skin.fbx"), XBOT, "SK_XBot")])
    lib.save_directory(XBOT)
    raise SystemExit(0)
xbot_mesh = unreal.load_asset(XBOT + "/SK_XBot")
xbot_skel = next((unreal.load_asset(a) for a in lib.list_assets(XBOT, recursive=False, include_folder=False)
                  if isinstance(unreal.load_asset(a), unreal.Skeleton)), None)   # the mesh's own property read back None
notes.append(f"xbot skeleton: {xbot_skel.get_name() if xbot_skel else None}")
clips = [f for f in sorted(os.listdir(SRC)) if f.lower().endswith(".fbx") and not f.startswith("_")]
if lib.does_directory_exist(XBOT + "/Anims"):
    lib.delete_directory(XBOT + "/Anims")
if lib.does_directory_exist(OUT):
    lib.delete_directory(OUT)
tools.import_asset_tasks([fbx_task(os.path.join(SRC, f), XBOT + "/Anims", "X_" + f[:-4].replace(" ", "_"), xbot_skel) for f in clips])
lib.save_directory(XBOT + "/Anims")

# 2. rigs and the retargeter
def fresh(path, cls, factory):
    if lib.does_asset_exist(path):
        lib.delete_asset(path)
    d, n = path.rsplit("/", 1)
    return tools.create_asset(n, d, cls, factory)


src_rig = fresh(XBOT + "/IK_XBot", unreal.IKRigDefinition, unreal.IKRigDefinitionFactory())
sc = unreal.IKRigController.get_controller(src_rig)
sc.set_skeletal_mesh(xbot_mesh)
sc.apply_auto_generated_retarget_definition()
lib.save_loaded_asset(src_rig)
dst_rig = unreal.load_asset(TARGET_RIG)
rtg = fresh(XBOT + "/RTG_XBot_To_Scarecrow", unreal.IKRetargeter, unreal.IKRetargetFactory())
rc = unreal.IKRetargeterController.get_controller(rtg)
S, T = unreal.RetargetSourceOrTarget.SOURCE, unreal.RetargetSourceOrTarget.TARGET
rc.set_ik_rig(S, src_rig)
rc.set_ik_rig(T, dst_rig)
# UE 5.8 retargeters run an op stack; with no ops the chain map stays empty and every clip comes out in the
# reference pose (it did: hips 155 cm for all 13 clips). Add the default ops, then map the scarecrow's 11 chains
# to X Bot's chains of the same name (fuzzy auto-map left all of them None).
def set_pelvis():
    # the Pelvis Motion op scales the hips by the height ratio (155 / 104 cm) only once it knows the pelvis bones;
    # left unset it passed X Bot's 102 cm hips through and the 3 m body walked crouched
    pc = rc.get_op_controller(rc.get_index_of_op_by_name("Pelvis Motion"))
    pc.set_source_pelvis_bone("mixamorig_Hips")
    pc.set_target_pelvis_bone("mixamorig_Hips")
    # "Run IK Rig" pinned the long legs' feet to X Bot's foot positions: the knees folded and the 3 m body
    # squatted (idle hips 85 cm on a 155 cm pelvis). Forcing the pelvis scale made it worse (toes at hip height).
    # Pure FK: the scarecrow's legs follow X Bot's joint angles; the ground offset in the set handles the rest.
    rc.set_retarget_op_enabled(rc.get_index_of_op_by_name("Run IK Rig"), False)


def map_chains():
    for chain in unreal.IKRigController.get_controller(dst_rig).get_retarget_chains():
        rc.set_source_chain(chain.chain_name, chain.chain_name)


for step, call in (("add_default_ops", lambda: rc.add_default_ops()),
                   ("auto_map_chains", lambda: rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True)),
                   ("map_chains", map_chains),
                   ("auto_align_all_bones", lambda: rc.auto_align_all_bones(T)),
                   ("pelvis", lambda: set_pelvis())):
    try:
        call()
    except Exception as e:   # noqa: BLE001 - logged into the report
        notes.append(f"{step}: {e}")
lib.save_loaded_asset(rtg)
tc = unreal.IKRigController.get_controller(dst_rig)
notes.append("map: " + ", ".join(f"{c.chain_name}<-{rc.get_source_chain(c.chain_name)}" for c in tc.get_retarget_chains()))

# 3. retarget the clips onto the scarecrow
reg = unreal.AssetRegistryHelpers.get_asset_registry()
datas = []
for p in lib.list_assets(XBOT + "/Anims", recursive=False, include_folder=False):
    a = reg.get_asset_by_object_path(p if "." in p else f"{p}.{p.rsplit('/', 1)[-1]}")
    if a.is_valid():
        datas.append(a)
out = unreal.IKRetargetBatchOperation.duplicate_and_retarget(
    datas, xbot_mesh, unreal.load_asset(TARGET_MESH), rtg, "X_", "MX_", "", "", OUT, False, False, True)
moved = sum(1 for d in out or [] if str(d.package_name).startswith(OUT))
lib.save_directory(OUT)
notes.append(f"retargeted {len(out or [])}, moved {moved}")


# 4. measure
def pose_at(seq, t):
    pose = unreal.AnimPoseExtensions.get_anim_pose_at_time(seq, t, unreal.AnimPoseEvaluationOptions())
    return {b: [round(c, 1) for c in (lambda v: (v.x, v.y, v.z))(
        unreal.AnimPoseExtensions.get_bone_pose(pose, b, unreal.AnimPoseSpaces.WORLD).translation)] for b in BONES}


report = {"_notes": notes}
ref = unreal.load_asset(REF_IDLE)
if ref:
    report["_ref_idle"] = pose_at(ref, 0.0)
for path in lib.list_assets(OUT, recursive=False, include_folder=False):
    seq = unreal.load_asset(path)
    if isinstance(seq, unreal.AnimSequence):
        n = seq.get_play_length()
        report[seq.get_name()] = {"len": round(n, 2), "t0": pose_at(seq, 0.0), "tmid": pose_at(seq, n * 0.5)}
with open(os.path.join(unreal.Paths.project_saved_dir(), "mixamo_scarecrow.json"), "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=1)
