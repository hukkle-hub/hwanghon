"""황혼 네이티브 실행 흐름 생성기

Game runtime:
L_Loading -> L_CharacterSelect -> dedicated shelter server

실행:
Tools > Execute Python Script
Plugins/HwanghonShelter/Content/Python/build_hwanghon_frontend_flow.py

주의:
- 기존 game3d.html은 게임 시작점으로 쓰지 않는다.
- 이 스크립트는 네이티브 Unreal 맵 2개를 만든다.
"""

import unreal

LOADING = "/Game/Hwanghon/Frontend/L_Loading"
CHAR_SELECT = "/Game/Hwanghon/Frontend/L_CharacterSelect"

level_lib = unreal.EditorLevelLibrary

loading_gm = unreal.load_class(None, "/Script/HwanghonShelter.HHLoadingGameMode")
select_gm = unreal.load_class(None, "/Script/HwanghonShelter.HHCharacterSelectGameMode")

if not loading_gm or not select_gm:
    raise RuntimeError("HwanghonShelter plugin C++ classes missing. Build and enable plugin first.")


def make_level(path, gm_class):
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        level_lib.load_level(path)
    else:
        level_lib.new_level(path)

    world = level_lib.get_editor_world()
    settings = world.get_world_settings()
    settings.set_editor_property("default_game_mode", gm_class)

    # A camera is useful for native front-end maps even though HUD carries most of the UI.
    actor_sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    cams = [a for a in actor_sub.get_all_level_actors() if isinstance(a, unreal.CameraActor)]
    if not cams:
        cam = actor_sub.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(0,0,120), unreal.Rotator(roll=0, pitch=0, yaw=0))
        cam.set_actor_label("HH_FrontEndCamera")

    level_lib.save_current_level()
    unreal.log("[HH Flow] ready: " + path)


make_level(LOADING, loading_gm)
make_level(CHAR_SELECT, select_gm)

unreal.log("[HH Flow] COMPLETE")
unreal.log("[HH Flow] Project Settings > Maps & Modes > Game Default Map = /Game/Hwanghon/Frontend/L_Loading")
unreal.log("[HH Flow] Dedicated Server Default Map = your B-1 shelter map")
