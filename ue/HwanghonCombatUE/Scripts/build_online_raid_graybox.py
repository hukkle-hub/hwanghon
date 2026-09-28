import unreal
MAP="/Game/Maps/Hwanghon_OnlineRaid"

# The server world is mapped 1 px = 2 cm with the spawn at the PlayerStart (AHWRaidWorldBridge).
# The widest level (d06: 52 x 64 px) reaches ~6.3 m east of the spawn and ~3.5 m north/south, so the
# old 80 m floor let a pawn walk off the east edge and fall out of the world. 240 x 120 m covers d01-d07.
FLOOR_SCALE=unreal.Vector(240,120,0.25)

def ensure_floor(actors):
    for actor in actors.get_all_level_actors():
        if actor.get_actor_label()=="OnlineRaid_Floor":
            actor.set_actor_scale3d(FLOOR_SCALE)
            return True
    return False

def main():
    unreal.EditorAssetLibrary.make_directory("/Game/Maps")
    level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if unreal.EditorAssetLibrary.does_asset_exist(MAP):
        # Maps are not committed; bring an older generated map up to the current floor.
        level.load_level(MAP)
        if ensure_floor(actors):
            level.save_current_level()
            unreal.log("[HwanghonOnline] updated floor "+MAP)
        else:
            unreal.log_warning("[HwanghonOnline] floor actor missing in "+MAP)
        return
    if not level.new_level(MAP):
        raise RuntimeError("failed "+MAP)
    world=unreal.EditorLevelLibrary.get_editor_world()
    gm=unreal.load_class(None,"/Script/HwanghonCombatUE.HWCombatGameMode")
    if gm:
        world.get_world_settings().set_editor_property("default_game_mode",gm)

    # Only a floor: horizontal collision/progression comes from the authoritative server.
    floor=actors.spawn_actor_from_class(
        unreal.StaticMeshActor,unreal.Vector(0,0,-25),unreal.Rotator(0,0,0))
    floor.set_actor_label("OnlineRaid_Floor")
    mesh=unreal.load_asset("/Engine/BasicShapes/Cube.Cube")
    if mesh:
        floor.static_mesh_component.set_static_mesh(mesh)
        floor.set_actor_scale3d(FLOOR_SCALE)

    start=actors.spawn_actor_from_class(
        unreal.PlayerStart,unreal.Vector(0,0,96),unreal.Rotator(0,0,0))
    start.set_actor_label("OnlineRaid_PlayerStart")

    level.save_current_level()
    unreal.log("[HwanghonOnline] created "+MAP)

if __name__=="__main__":
    main()
