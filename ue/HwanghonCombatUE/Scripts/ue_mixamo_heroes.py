"""The four heroes' own skill motion (docs/design/170): Mixamo X Bot clips -> the Paragon Countess skeleton the
combat bodies wear, one animation set per hero.

Source: art/anim/mixamo_heroes/hw_<hero>_<slot>.fbx (slot 1-4, R) listed in clips.json; "mixamorig:" already
rewritten to "mixamorig_". The X Bot body and its IK rig come from the scarecrow pipeline
(Scripts/ue_import_mixamo_scarecrow.py, HW_STEP=mesh) - the same traps apply (docs/design/168 §3):
legacy FBX import, default ops + chains mapped by name, Run IK Rig off.

Steps: import clips onto SK_XBot_Skeleton -> RTG_XBot_To_Countess -> /Game/Animation/Heroes/Mixamo/MX_hw_*
-> measure each clip's contact (right hand furthest in front of the pelvis) -> DA_Hero_<id> = DA_Ain_Graybox with
Skill1-4 / Ultimate replaced (slot names kept). Writes Saved/mixamo_heroes.json.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_mixamo_heroes.py" -unattended -nullrhi
"""
import json
import os

import unreal

SRC = os.path.normpath(os.path.join(unreal.Paths.project_dir(), "..", "..", "art", "anim", "mixamo_heroes"))
XBOT = "/Game/Animation/Boss/Scarecrow/XBot"
CLIPS = "/Game/Animation/Heroes/XBotClips"
OUT = "/Game/Animation/Heroes/Mixamo"
COUNTESS = "/Game/ParagonCountess/Characters/Heroes/Countess/Meshes/SM_Countess"
COUNTESS_RIG = "/Game/Animation/Retarget/IK_Countess_Auto"
BASE_SET = "/Game/Animation/Ain/Graybox/DA_Ain_Graybox"
SETS = "/Game/Animation/Heroes"
SLOTS = {"1": "skill1", "2": "skill2", "3": "skill3", "4": "skill4", "R": "ultimate"}
MELEE_DEFAULT = 0.42
# contacts read off the bone sheet where "hand furthest in front" picks the wrong moment
CONTACT_OVERRIDE = {"sera_3": 0.5}   # Toss Grenade: the stance holds the hands forward at 0.1; the toss is at 1.6 s
lib = unreal.EditorAssetLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()
unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX False")
report = {"notes": []}

# 1. clips onto the X Bot skeleton
xbot_mesh = unreal.load_asset(XBOT + "/SK_XBot")
xbot_skel = next((unreal.load_asset(a) for a in lib.list_assets(XBOT, recursive=False, include_folder=False)
                  if isinstance(unreal.load_asset(a), unreal.Skeleton)), None)
for d in (CLIPS, OUT):
    if lib.does_directory_exist(d):
        lib.delete_directory(d)
tasks = []
for f in sorted(os.listdir(SRC)):
    if not (f.startswith("hw_") and f.lower().endswith(".fbx")):
        continue
    ui = unreal.FbxImportUI()
    for k, v in (("import_mesh", False), ("import_animations", True), ("import_as_skeletal", True), ("import_materials", False),
                 ("import_textures", False), ("skeleton", xbot_skel), ("mesh_type_to_import", unreal.FBXImportType.FBXIT_ANIMATION)):
        ui.set_editor_property(k, v)
    t = unreal.AssetImportTask()
    for k, v in (("filename", os.path.join(SRC, f)), ("destination_path", CLIPS), ("destination_name", "X_" + f[:-4]),
                 ("automated", True), ("save", True), ("replace_existing", True), ("options", ui)):
        t.set_editor_property(k, v)
    tasks.append(t)
tools.import_asset_tasks(tasks)
lib.save_directory(CLIPS)

# 2. retargeter X Bot -> Countess
rtg_path = SETS + "/RTG_XBot_To_Countess"
if lib.does_asset_exist(rtg_path):
    lib.delete_asset(rtg_path)
rtg = tools.create_asset("RTG_XBot_To_Countess", SETS, unreal.IKRetargeter, unreal.IKRetargetFactory())
rc = unreal.IKRetargeterController.get_controller(rtg)
S, T = unreal.RetargetSourceOrTarget.SOURCE, unreal.RetargetSourceOrTarget.TARGET
dst_rig = unreal.load_asset(COUNTESS_RIG)
rc.set_ik_rig(S, unreal.load_asset(XBOT + "/IK_XBot"))
rc.set_ik_rig(T, dst_rig)
tc = unreal.IKRigController.get_controller(dst_rig)


def step(name, fn):
    try:
        fn()
    except Exception as e:  # noqa: BLE001
        report["notes"].append(f"{name}: {e}")


step("add_default_ops", lambda: rc.add_default_ops())
step("auto_map_chains", lambda: rc.auto_map_chains(unreal.AutoMapChainType.FUZZY, True))
step("map_by_name", lambda: [rc.set_source_chain(c.chain_name, c.chain_name) for c in tc.get_retarget_chains()
                             if rc.get_source_chain(c.chain_name) in (None, "None", "")])
step("auto_align", lambda: rc.auto_align_all_bones(T))


def pelvis():
    pc = rc.get_op_controller(rc.get_index_of_op_by_name("Pelvis Motion"))
    pc.set_source_pelvis_bone("mixamorig_Hips")
    # Countess rig's retarget root is "root" (the floor bone): the hips motion went onto it - root at 98 cm, pelvis 11 cm
    # above it, the body floated in game. Paragon clips keep root at 0 and pelvis at 115 cm.
    pc.set_target_pelvis_bone("pelvis")
    # in place: the kit moves the capsule (dodges) or not at all (attacks); a clip that carries the hips 1-2 m away
    # walked the body out of the shot and snapped it back at the end (Ain's back dodge and leap attack)
    st = pc.get_settings()
    st.set_editor_property("scale_horizontal", 0.0)
    pc.set_settings(st)
    rc.set_retarget_op_enabled(rc.get_index_of_op_by_name("Run IK Rig"), False)
    # X Bot has no root bone (mixamorig_Hips is the top): "Root Motion" copied the hips height onto Countess's root
    # (root 98 cm in every clip) - the body floated in game. Paragon clips keep root at 0; the kit does not use root motion.
    rc.set_retarget_op_enabled(rc.get_index_of_op_by_name("Root Motion"), False)


step("pelvis", pelvis)
lib.save_loaded_asset(rtg)
report["target_root"] = str(tc.get_retarget_root())
report["map"] = {str(c.chain_name): str(rc.get_source_chain(c.chain_name)) for c in tc.get_retarget_chains()}

# 3. retarget
reg = unreal.AssetRegistryHelpers.get_asset_registry()
datas = []
for p in lib.list_assets(CLIPS, recursive=False, include_folder=False):
    a = reg.get_asset_by_object_path(p if "." in p else f"{p}.{p.rsplit('/', 1)[-1]}")
    if a.is_valid():
        datas.append(a)
out = unreal.IKRetargetBatchOperation.duplicate_and_retarget(
    datas, xbot_mesh, unreal.load_asset(COUNTESS), rtg, "X_hw_", "MX_", "", "", OUT, False, False, True)
lib.save_directory(OUT)
report["retargeted"] = len(out or [])


# 4. contacts: the right hand furthest in front of the pelvis (the swing / the throw's release / the thrust)
def contact(seq, n=61):
    opt = unreal.AnimPoseEvaluationOptions()
    ln = seq.get_play_length()
    p0 = unreal.AnimPoseExtensions.get_anim_pose_at_time(seq, 0.0, opt)
    g = lambda pose, b: unreal.AnimPoseExtensions.get_bone_pose(pose, b, unreal.AnimPoseSpaces.WORLD).translation
    fwd = g(p0, "ball_l") - g(p0, "foot_l")
    fwd.z = 0.0
    fwd = fwd.normal() if fwd.length() > 1 else unreal.Vector(0, 1, 0)
    best, best_t, low = -1e9, 0.42, 1e9
    for i in range(n):
        t = ln * i / (n - 1)
        pose = unreal.AnimPoseExtensions.get_anim_pose_at_time(seq, t, opt)
        for b in ("hand_r", "hand_l"):
            v = g(pose, b) - g(pose, "pelvis")
            f = v.x * fwd.x + v.y * fwd.y
            if f > best:
                best, best_t = f, t / ln
        low = min(low, g(pose, "foot_l").z, g(pose, "foot_r").z)
    return round(best_t, 3), round(best, 1), round(low, 1), round(ln, 2)


clips = json.load(open(os.path.join(SRC, "clips.json"), encoding="utf-8"))
for hero in ("ain", "kain", "ryu", "sera"):
    set_path = f"{SETS}/DA_Hero_{hero}"
    if lib.does_asset_exist(set_path):
        lib.delete_asset(set_path)
    lib.duplicate_asset(BASE_SET, set_path)
    da = unreal.load_asset(set_path)
    rows = {}
    for slot, prop in SLOTS.items():
        seq = unreal.load_asset(f"{OUT}/MX_{hero}_{slot}")
        if not seq:
            report["notes"].append(f"missing MX_{hero}_{slot}")
            continue
        c, reach, low, ln = contact(seq)
        is_move = slot in ("2",) or (slot == "4" and hero != "kain")   # dodges and buffs: no contact
        b = da.get_editor_property(prop)
        b.set_editor_property("sequence", seq)
        c = CONTACT_OVERRIDE.get(f"{hero}_{slot}", c)
        b.set_editor_property("source_contact_normalized", MELEE_DEFAULT if is_move else c)
        da.set_editor_property(prop, b)
        rows[slot] = {"clip": clips[hero][slot], "len": ln, "contact": c, "reach_cm": reach, "lowest_foot": low}
    lib.save_loaded_asset(da)
    report[hero] = rows

with open(os.path.join(unreal.Paths.project_saved_dir(), "mixamo_heroes.json"), "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=1, ensure_ascii=False)
