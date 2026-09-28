"""
Graybox Ain animation setup (placeholder source until Paragon — docs/design/125).

Run after ue_setup.py (the map must exist):
  UnrealEditor-Cmd.exe HwanghonCombatUE.uproject -ExecutePythonScript=<abs>/Scripts/ue_graybox_anim_setup.py -unattended

What it builds (all under /Game, nothing binary is committed):
  1. Copies the engine's template Mannequin pack (UE_x/Templates/TemplateResources/High/Characters)
     into Content/Characters/Mannequins. Epic content, UE-only licence.
  2. For attack1/2/3 · smash · counter: AS_Ain_* (duplicated sequence) and AM_Ain_* (montage),
     each with an HWContact notify (UHWAnimNotify_Contact) on track "HWContact".
  3. DA_Ain_Graybox (UHWAnimationSetAsset). SourceContactNormalized = notify time / length,
     so the runtime contact retime lands the authored contact on the combat HitAt.
  4. Seohan_Combat_VS01: World Settings GameMode = HWCombatGameMode, and a placed
     HWAinCharacter "Ain_Graybox" (Manny body, ABP_Unarmed with DefaultSlot, auto-possess Player0).
"""
from __future__ import annotations

import shutil
from pathlib import Path
import unreal

LEVEL = "/Game/Maps/Seohan_Combat_VS01"
MANNY = "/Game/Characters/Mannequins"
OUT = "/Game/Animation/Ain/Graybox"
SRC = MANNY + "/Anims/Unarmed/Attack/"

# Contact times are Epic's own authored hit frames: the DoAttackTrace notifies in
# TP_ThirdPerson Variant_Combat AM_ComboAttack (0.4667 / 1.4667-1.0 / 2.4-2.0 s) and
# AM_ChargedAttack (1.1613 s). An independent check (max hand/foot reach from pelvis,
# AnimPose world space, 60 Hz samples) agrees within 3 frames: 0.467 / 0.467 / 0.354 / 1.200 s.
CLIPS = [
    # key, source sequence, contact seconds (source clock)
    ("Attack1", "MM_Attack_01", 0.4667),
    ("Attack2", "MM_Attack_02", 0.4667),
    ("Attack3", "MM_Attack_03", 0.4000),
    ("Smash", "MM_ChargedAttack", 1.1613),
    # No counter source in the template: a left cross stands in (placeholder).
    ("Counter", "MM_Attack_02", 0.4667),
]
# Bound without contact (their combat HitAt is 0, so the retime is linear).
EXTRA = [
    ("Dodge", MANNY + "/Anims/Unarmed/Jump/MM_Dash"),
    ("Jump", MANNY + "/Anims/Unarmed/Jump/MM_Jump"),
]
SLOT = "DefaultSlot"  # ABP_Unarmed's slot node


def log(msg: str):
    unreal.log(f"[HwanghonGrayboxAnim] {msg}")


def copy_mannequin_pack():
    proj = Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
    eng = Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.engine_dir()))
    src = eng.parent / "Templates/TemplateResources/High/Characters/Content/Mannequins"
    dst = proj / "Content/Characters/Mannequins"
    if not src.exists():
        raise RuntimeError(f"template Mannequin pack not found: {src}")
    if not dst.exists():
        shutil.copytree(src, dst)
        log(f"copied {src} -> {dst}")
    unreal.AssetRegistryHelpers.get_asset_registry().scan_paths_synchronous([MANNY], True)


def fresh_duplicate(src_path: str, dst_path: str):
    if unreal.EditorAssetLibrary.does_asset_exist(dst_path):
        unreal.EditorAssetLibrary.delete_asset(dst_path)
    obj = unreal.EditorAssetLibrary.duplicate_asset(src_path, dst_path)
    if not obj:
        raise RuntimeError(f"duplicate failed: {src_path} -> {dst_path}")
    return obj


def add_contact(anim, seconds: float):
    lib = unreal.AnimationLibrary
    if lib.is_valid_anim_notify_track_name(anim, "HWContact"):
        lib.remove_animation_notify_track(anim, "HWContact")
    lib.add_animation_notify_track(anim, "HWContact")
    notify = lib.add_animation_notify_event(anim, "HWContact", seconds, unreal.HWAnimNotify_Contact)
    if not notify:
        raise RuntimeError(f"could not add HWContact to {anim.get_path_name()}")


def make_montage(seq, name: str):
    path = f"{OUT}/{name}"
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        unreal.EditorAssetLibrary.delete_asset(path)
    factory = unreal.AnimMontageFactory()
    factory.set_editor_property("source_animation", seq)
    factory.set_editor_property("target_skeleton", seq.get_editor_property("skeleton"))
    montage = unreal.AssetToolsHelpers.get_asset_tools().create_asset(name, OUT, unreal.AnimMontage, factory)
    if not montage:
        raise RuntimeError(f"montage create failed: {path}")
    return montage


def binding(seq, contact_norm: float):
    b = unreal.HWSequenceBinding()
    b.set_editor_property("sequence", seq)
    b.set_editor_property("source_contact_normalized", contact_norm)
    b.set_editor_property("blend_in", 0.05)
    b.set_editor_property("blend_out", 0.14)
    b.set_editor_property("slot_name", SLOT)
    return b


def build_animation_set():
    unreal.EditorAssetLibrary.make_directory(OUT)
    bindings = {}
    report = []
    for key, src, contact in CLIPS:
        seq = fresh_duplicate(SRC + src, f"{OUT}/AS_Ain_{key}")
        length = seq.get_play_length()
        add_contact(seq, contact)
        unreal.EditorAssetLibrary.save_loaded_asset(seq)

        montage = make_montage(seq, f"AM_Ain_{key}")
        # The montage inherits the sequence notify at runtime; this copy makes the
        # contact visible in the montage editor too. The notify carries no gameplay.
        add_contact(montage, contact)
        unreal.EditorAssetLibrary.save_loaded_asset(montage)

        norm = contact / length
        bindings[key] = binding(seq, norm)
        report.append(f"{key}: {src} len={length:.3f}s contact={contact:.4f}s norm={norm:.3f}")

    for key, path in EXTRA:
        seq = unreal.load_asset(path)
        if seq:
            bindings[key] = binding(seq, 0.5)

    da_path = f"{OUT}/DA_Ain_Graybox"
    if unreal.EditorAssetLibrary.does_asset_exist(da_path):
        unreal.EditorAssetLibrary.delete_asset(da_path)
    factory = unreal.DataAssetFactory()
    factory.set_editor_property("data_asset_class", unreal.HWAnimationSetAsset)
    da = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        "DA_Ain_Graybox", OUT, unreal.HWAnimationSetAsset, factory)
    for key, b in bindings.items():
        da.set_editor_property(key.lower(), b)
    unreal.EditorAssetLibrary.save_loaded_asset(da)
    for line in report:
        log(line)
    return da


def configure_level(anim_set):
    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not les.load_level(LEVEL):
        raise RuntimeError(f"cannot load {LEVEL}")

    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    ws = world.get_world_settings()
    gm = unreal.load_class(None, "/Script/HwanghonCombatUE.HWCombatGameMode")
    ws.set_editor_property("default_game_mode", gm)

    ain_cls = unreal.load_class(None, "/Script/HwanghonCombatUE.HWAinCharacter")
    for a in eas.get_all_level_actors():
        if a.get_class() == ain_cls:
            eas.destroy_actor(a)

    ain = eas.spawn_actor_from_class(ain_cls, unreal.Vector(-450.0, 0.0, 96.0), unreal.Rotator(0.0, 0.0, 0.0))
    ain.set_actor_label("Ain_Graybox")
    ain.set_editor_property("auto_possess_player", unreal.AutoReceiveInput.PLAYER0)

    mesh = ain.get_editor_property("mesh")
    mesh.set_skeletal_mesh_asset(unreal.load_asset(MANNY + "/Meshes/SKM_Manny_Simple"))
    abp = unreal.load_asset(MANNY + "/Anims/Unarmed/ABP_Unarmed")
    mesh.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_BLUEPRINT)
    mesh.set_editor_property("anim_class", abp.generated_class())
    mesh.set_editor_property("relative_location", unreal.Vector(0.0, 0.0, -92.0))
    mesh.set_editor_property("relative_rotation", unreal.Rotator(roll=0.0, pitch=0.0, yaw=-90.0))

    ain.get_presentation().set_editor_property("animation_set", anim_set)

    # The C++ boss is a bare capsule (no visible mesh). Give the placed boss a
    # stand-in body so captures show where it is and which way it faces.
    # Capsule and gameplay are unchanged; boss pattern animation is not bound yet.
    boss_cls = unreal.load_class(None, "/Script/HwanghonCombatUE.HWBossCharacter")
    for boss in [a for a in eas.get_all_level_actors() if a.get_class() == boss_cls]:
        bmesh = boss.get_editor_property("mesh")
        bmesh.set_skeletal_mesh_asset(unreal.load_asset(MANNY + "/Meshes/SKM_Quinn_Simple"))
        bmesh.set_editor_property("animation_mode", unreal.AnimationMode.ANIMATION_BLUEPRINT)
        bmesh.set_editor_property("anim_class", abp.generated_class())
        half = boss.get_editor_property("capsule_component").get_unscaled_capsule_half_height()
        bmesh.set_editor_property("relative_location", unreal.Vector(0.0, 0.0, -half))
        bmesh.set_editor_property("relative_rotation", unreal.Rotator(roll=0.0, pitch=0.0, yaw=-90.0))
        bmesh.set_editor_property("relative_scale3d", unreal.Vector(1.25, 1.25, 1.25))
        log(f"boss stand-in body on {boss.get_actor_label()} (capsule half-height {half:.0f})")

    # Review camera for ue_pie_capture.py HW_CAPTURE_VIEW=side. Not auto-activated:
    # play uses the lock-on camera unless the capture script switches the view target.
    for a in eas.get_all_level_actors():
        if a.get_class() == unreal.CameraActor.static_class() and a.get_actor_label() == "ReviewCamera":
            eas.destroy_actor(a)
    cam = eas.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(0.0, -900.0, 170.0), unreal.Rotator(0.0, 0.0, 90.0))
    cam.set_actor_label("ReviewCamera")
    cam.root_component.set_mobility(unreal.ComponentMobility.MOVABLE)

    les.save_current_level()
    log(f"level saved: GameMode={gm.get_name()} pawn={ain.get_actor_label()}")


def main():
    copy_mannequin_pack()
    anim_set = build_animation_set()
    configure_level(anim_set)
    log("done")


if __name__ == "__main__":
    main()
