"""
Graybox Ain animation setup (docs/design/125, 127).

Run after ue_setup.py (the map must exist):
  UnrealEditor-Cmd.exe HwanghonCombatUE.uproject -ExecutePythonScript=<abs>/Scripts/ue_graybox_anim_setup.py -unattended

Source (HW_ANIM_SOURCE=countess|manny; default countess when the pack is present):
  countess  Paragon: Countess (Fab, free, UE-only licence). Not committed: the pack is copied from
            HW_PARAGON_COUNTESS_SRC (a Content/ParagonCountess folder of another 5.x project) when
            /Game/ParagonCountess is missing. Body = SM_Countess + Countess_AnimBlueprint (UpperBody slot).
  manny     Engine template Mannequin (UE_x/Templates/TemplateResources/High/Characters), placeholder of doc 125.

What it builds (all under /Game, nothing binary is committed):
  1. For attack1/2/3 · smash · counter: AS_Ain_* (duplicated sequence) and AM_Ain_* (montage),
     each with an HWContact notify (UHWAnimNotify_Contact) on track "HWContact".
  2. DA_Ain_Graybox (UHWAnimationSetAsset). SourceContactNormalized = notify time / length,
     so the runtime contact retime lands the authored contact on the combat HitAt.
  3. Seohan_Combat_VS01: World Settings GameMode = HWCombatGameMode, a placed HWAinCharacter
     "Ain_Graybox" (auto-possess Player0), no baked boss body (config applies it), and a ReviewCamera.
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path
import unreal

LEVEL = "/Game/Maps/Seohan_Combat_VS01"
MANNY = "/Game/Characters/Mannequins"
COUNTESS = "/Game/ParagonCountess/Characters/Heroes/Countess"
OUT = "/Game/Animation/Ain/Graybox"

SOURCES = {
    # Contact times: Epic's authored DoAttackTrace notifies in TP_ThirdPerson Variant_Combat
    # (AM_ComboAttack 0.4667 / 1.4667-1.0 / 2.4-2.0 s, AM_ChargedAttack 1.1613 s); max hand/foot
    # reach agrees within 3 frames (doc 125 §5).
    "manny": {
        "mesh": MANNY + "/Meshes/SKM_Manny_Simple",
        "abp": MANNY + "/Anims/Unarmed/ABP_Unarmed",
        "slot": "DefaultSlot",
        "clips": [
            ("Attack1", MANNY + "/Anims/Unarmed/Attack/MM_Attack_01", 0.4667),
            ("Attack2", MANNY + "/Anims/Unarmed/Attack/MM_Attack_02", 0.4667),
            ("Attack3", MANNY + "/Anims/Unarmed/Attack/MM_Attack_03", 0.4000),
            ("Smash", MANNY + "/Anims/Unarmed/Attack/MM_ChargedAttack", 1.1613),
            ("Counter", MANNY + "/Anims/Unarmed/Attack/MM_Attack_02", 0.4667),   # no counter source: stand-in
        ],
        "extra": [("Dodge", MANNY + "/Anims/Unarmed/Jump/MM_Dash"), ("Jump", MANNY + "/Anims/Unarmed/Jump/MM_Jump")],
    },
    # Paragon montages carry only combo-window notifies (SaveAttack/ResetCombo), no hit frame.
    # Contact = blade (weapon_l/r, sword_tail) forward-reach maximum and local speed peak, AnimPose
    # world space at 60 Hz, clips chosen from stick-figure sheets (doc 127 §2).
    "countess": {
        "mesh": COUNTESS + "/Meshes/SM_Countess",
        "abp": COUNTESS + "/Countess_AnimBlueprint",
        "slot": "UpperBody",   # the pack's own montages use it; with FullBody the attacks never showed on the body (doc 127 §3)
        "clips": [
            ("Attack1", COUNTESS + "/Animations/Primary_Attack_A_Normal", 0.200),   # r 0.187 / l 0.221 speed peaks
            ("Attack2", COUNTESS + "/Animations/Primary_Attack_B_Normal", 0.187),   # lunge, fwd max 0.170, speed 0.187
            ("Attack3", COUNTESS + "/Animations/Primary_Attack_Normal", 0.170),     # left blade 4,440 cm/s
            ("Smash", COUNTESS + "/Animations/Ability_RMB", 0.467),                 # leap slam: fwd max 0.450, landing 0.533
            ("Counter", COUNTESS + "/Animations/Primary_Attack_Fast_V1", 0.167),    # fast cut, 0.6 s ~ combat 0.56 s
        ],
        "extra": [("Jump", COUNTESS + "/Animations/Jump_Start"), ("Hit", COUNTESS + "/Animations/Hitreact_Fwd"),
                  ("Stagger", COUNTESS + "/Animations/Knock_Bwd"),
                  # SYSTEM CORE kit / life (doc 128 §2: chosen from stick-figure sheets and measured):
                  # Skill1 lunge strike, Skill2 dash thrust (dodge-type skills), Skill3 spinning slash
                  # (shoulder line turns 296 deg; Ability_RMB spins 720 deg but is already Smash),
                  # Skill4 cast (buffs), Ultimate leap-flip-slam 3.17 s.
                  ("Skill1", COUNTESS + "/Animations/Ability_Q"), ("Skill2", COUNTESS + "/Animations/Ability_E"),
                  ("Skill3", COUNTESS + "/Animations/Primary_Attack_B_Slow"), ("Skill4", COUNTESS + "/Animations/Cast"),
                  ("Ultimate", COUNTESS + "/Animations/Ability_Ultimate"),
                  # The pack has no lying-down clip: Death floats up (pelvis 113 -> 179 cm) and Knock_* are
                  # airborne (feet 30-60 cm up). Stun keeps the feet on the floor, bent double (head 115 cm).
                  # Downed/Death are the fallback when a body has no physics asset; the Countess bodies ragdoll
                  # and get up with Respawn from 0.4 s (crouch -> stand, doc 130).
                  ("Downed", COUNTESS + "/Animations/Stun_Loop", True), ("Death", COUNTESS + "/Animations/Stun_Start"),
                  ("GetUp", COUNTESS + "/Animations/Respawn")],
    },
}


def pick_source():
    wanted = os.environ.get("HW_ANIM_SOURCE", "").strip().lower()
    proj = Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
    pack = proj / "Content/ParagonCountess"
    if wanted in ("", "countess") and not pack.exists():
        src = os.environ.get("HW_PARAGON_COUNTESS_SRC", "").strip()
        if src and Path(src).exists():
            shutil.copytree(src, pack)
            log(f"copied Paragon Countess {src} -> {pack}")
    if wanted == "manny" or not pack.exists():
        if wanted == "countess":
            raise RuntimeError("HW_ANIM_SOURCE=countess but Content/ParagonCountess is missing (set HW_PARAGON_COUNTESS_SRC)")
        return "manny"
    unreal.AssetRegistryHelpers.get_asset_registry().scan_paths_synchronous(["/Game/ParagonCountess"], True)
    return "countess"


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


def sanitize_countess_pawn():
    """The pack's sample pawn (CountessPlayerCharacter) fails to compile on UE5: its event graph calls
    the old HMD ResetOrientationAndPosition (moved to the XRBase plugin) and legacy input axes. We never
    spawn it, but Countess_AnimBlueprint casts to it, so it loads, and PIE stops on the
    'blueprints have errors' prompt. Drop only its event graph in our local copy; variables stay."""
    bp = unreal.load_asset(COUNTESS + "/CountessPlayerCharacter")
    if not bp:
        return
    graph = unreal.BlueprintEditorLibrary.find_event_graph(bp)
    if graph:
        unreal.BlueprintEditorLibrary.remove_graph(bp, graph)
    # The AnimBP's SaveAttack/ResetCombo notifies call these (Paragon's own combo, unused here:
    # our combat clock owns the chain). Keep them as empty functions so the AnimBP compiles.
    # Compile first so the removed custom events leave the class; otherwise the new graphs get "_0" names.
    unreal.BlueprintEditorLibrary.compile_blueprint(bp)
    for fn in ("ResetCombo", "ComboAttackSave"):
        if not unreal.BlueprintEditorLibrary.find_graph(bp, fn):
            unreal.BlueprintEditorLibrary.add_function_graph(bp, fn)
    ok = unreal.BlueprintEditorLibrary.compile_blueprint(bp)
    unreal.EditorAssetLibrary.save_loaded_asset(bp)
    abp = unreal.load_asset(COUNTESS + "/Countess_AnimBlueprint")
    abp_ok = unreal.BlueprintEditorLibrary.compile_blueprint(abp) if abp else False
    if abp:
        unreal.EditorAssetLibrary.save_loaded_asset(abp)
    log(f"CountessPlayerCharacter event graph removed: compile {'ok' if ok else 'FAILED'}; AnimBP compile {'ok' if abp_ok else 'FAILED'}")


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


def make_montage(seq, name: str, slot: str):
    path = f"{OUT}/{name}"
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        unreal.EditorAssetLibrary.delete_asset(path)
    factory = unreal.AnimMontageFactory()
    factory.set_editor_property("source_animation", seq)
    factory.set_editor_property("target_skeleton", seq.get_editor_property("skeleton"))
    montage = unreal.AssetToolsHelpers.get_asset_tools().create_asset(name, OUT, unreal.AnimMontage, factory)
    if not montage:
        raise RuntimeError(f"montage create failed: {path}")
    # Play on the body's own slot (FullBody for Countess, DefaultSlot for Manny).
    tracks = montage.get_editor_property("slot_anim_tracks")
    if tracks:
        tracks[0].set_editor_property("slot_name", slot)
        montage.set_editor_property("slot_anim_tracks", tracks)
    return montage


def binding(seq, contact_norm: float, slot: str):
    b = unreal.HWSequenceBinding()
    b.set_editor_property("sequence", seq)
    b.set_editor_property("source_contact_normalized", contact_norm)
    b.set_editor_property("blend_in", 0.05)
    b.set_editor_property("blend_out", 0.14)
    b.set_editor_property("slot_name", slot)
    return b


def build_animation_set(source: str):
    spec = SOURCES[source]
    slot = spec["slot"]
    unreal.EditorAssetLibrary.make_directory(OUT)
    bindings = {}
    report = []
    for key, src, contact in spec["clips"]:
        seq = fresh_duplicate(src, f"{OUT}/AS_Ain_{key}")
        length = seq.get_play_length()
        add_contact(seq, contact)
        unreal.EditorAssetLibrary.save_loaded_asset(seq)

        montage = make_montage(seq, f"AM_Ain_{key}", slot)
        # The montage inherits the sequence notify at runtime; this copy makes the
        # contact visible in the montage editor too. The notify carries no gameplay.
        add_contact(montage, contact)
        unreal.EditorAssetLibrary.save_loaded_asset(montage)

        norm = contact / length
        bindings[key] = binding(seq, norm, slot)
        report.append(f"{key}: {src.rsplit('/', 1)[-1]} len={length:.3f}s contact={contact:.4f}s norm={norm:.3f}")

    for entry in spec["extra"]:
        key, path, loop = (entry + (False,))[:3]
        seq = unreal.load_asset(path)
        if seq:
            bindings[key] = binding(seq, 0.5, slot)
            bindings[key].set_editor_property("loop", loop)   # bLoop

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
    log(f"source: {source}")
    for line in report:
        log(line)
    return da


def configure_level(anim_set, source: str):
    spec = SOURCES[source]
    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not les.load_level(LEVEL):
        raise RuntimeError(f"cannot load {LEVEL}")

    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    ws = world.get_world_settings()
    gm = unreal.load_class(None, "/Script/HwanghonCombatUE.HWCombatGameMode")
    ws.set_editor_property("default_game_mode", gm)

    # No placed player pawn: an auto-possessed Ain here overrode the character selection (SYSTEM CORE).
    # The GameMode spawns the selected class; it wears its body and this motion set from
    # UHWCharacterVisualSettings in Config/DefaultGame.ini (doc 128).
    ain_cls = unreal.load_class(None, "/Script/HwanghonCombatUE.HWAinCharacter")
    for a in eas.get_all_level_actors():
        if unreal.MathLibrary.class_is_child_of(a.get_class(), ain_cls):
            eas.destroy_actor(a)
    # The placed boss wears no baked body: AHWBossCharacter::BeginPlay puts on the "boss" entry of
    # UHWCharacterVisualSettings (the training boss and its clips, doc 132) when the mesh is empty.
    boss_cls = unreal.load_class(None, "/Script/HwanghonCombatUE.HWBossCharacter")
    for boss in [a for a in eas.get_all_level_actors() if a.get_class() == boss_cls]:
        boss.get_editor_property("mesh").set_skeletal_mesh_asset(None)
        log(f"boss body cleared on {boss.get_actor_label()} (config body applies at BeginPlay)")

    # Review camera for ue_pie_capture.py HW_CAPTURE_VIEW=side. Not auto-activated:
    # play uses the lock-on camera unless the capture script switches the view target.
    for a in eas.get_all_level_actors():
        if a.get_class() == unreal.CameraActor.static_class() and a.get_actor_label() == "ReviewCamera":
            eas.destroy_actor(a)
    cam = eas.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(0.0, -900.0, 170.0), unreal.Rotator(0.0, 0.0, 90.0))
    cam.set_actor_label("ReviewCamera")
    cam.root_component.set_mobility(unreal.ComponentMobility.MOVABLE)

    les.save_current_level()
    log(f"level saved: GameMode={gm.get_name()} (player pawn spawned by class)")


def main():
    copy_mannequin_pack()   # the dungeon enemy stand-in (Manny) uses it
    source = pick_source()
    if source == "countess":
        sanitize_countess_pawn()
    anim_set = build_animation_set(source)
    configure_level(anim_set, source)
    log("done")


if __name__ == "__main__":
    main()
