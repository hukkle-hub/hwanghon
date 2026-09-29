"""The app's front maps for the online flow (docs/design/154):

/Game/Hwanghon/Frontend/L_Loading          AHWLoadingGameMode   - story mode or the shelter (director 2026-09-29)
/Game/Hwanghon/Frontend/L_CharacterSelect  AHHCharacterSelectGameMode (plugin) - four heroes -> shelter ticket

Only these two maps are created or touched; any other world is refused (a builder once wrote into the frontend map).
UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_online_frontend.py" -unattended -nullrhi
"""
import unreal

les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
lib = unreal.EditorAssetLibrary
MAPS = {
    "/Game/Hwanghon/Frontend/L_Loading": "/Script/HwanghonCombatUE.HWLoadingGameMode",
    "/Game/Hwanghon/Frontend/L_CharacterSelect": "/Script/HwanghonShelter.HHCharacterSelectGameMode",
}
lib.make_directory("/Game/Hwanghon/Frontend")
for path, gm in MAPS.items():
    if lib.does_asset_exist(path):
        les.load_level(path)
    elif not les.new_level(path, False):
        raise RuntimeError(f"could not create {path}")
    world = unreal.EditorLevelLibrary.get_editor_world()
    if not world.get_path_name().startswith(path):
        raise RuntimeError(f"refusing to write into {world.get_path_name()}")
    cls = unreal.load_class(None, gm)
    if not cls:
        raise RuntimeError(f"missing {gm} - build the editor first")
    world.get_world_settings().set_editor_property("default_game_mode", cls)
    world.get_world_settings().set_editor_property("force_no_precomputed_lighting", True)
    if not [a for a in eas.get_all_level_actors() if isinstance(a, unreal.CameraActor)]:
        cam = eas.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(0, 0, 120), unreal.Rotator(roll=0, pitch=0, yaw=0))
        cam.set_actor_label("HW_FrontEndCamera")
    les.save_current_level()
    unreal.log(f"[HWOnline] {path} <- {gm}")
