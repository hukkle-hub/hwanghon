"""Tablet cost of the HIGH MetaHuman heroes (doc 177 §5): three maps with the same light/floor/camera -
L_PerfEmpty (no heroes), L_PerfParty (Ain, Sera x2 = 4), L_PerfRaid (8). The player start looks at the row from 4 m.
Log perf_maps_log.txt. Run with -ExecCmds="py perf_maps.py".
"""
import traceback

import unreal

LOG = "C:/w/mhlab/perf_maps_log.txt"
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
BPS = {n: unreal.load_asset(f"/Game/Heroes/Built/{n}/MH_{n}/BP_MH_{n}") for n in ("Ain", "Sera")}
log("bps", BPS)


def make(name, count):
    path = f"/Game/Perf/{name}"
    les.new_level(path)
    eas.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 300, 400), unreal.Rotator(pitch=-35, yaw=-110, roll=0))
    sky = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 300), unreal.Rotator())
    sky.light_component.set_editor_property("source_type", unreal.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP)
    sky.light_component.set_editor_property("cubemap", unreal.load_asset("/Engine/MapTemplates/Sky/SunsetAmbientCubemap"))
    sky.light_component.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    floor = eas.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0, 0, 0), unreal.Rotator())
    floor.static_mesh_component.set_static_mesh(unreal.load_asset("/Engine/BasicShapes/Plane"))
    floor.set_actor_scale3d(unreal.Vector(20, 20, 1))
    # MetaHumans face +Y: the player start stands on +Y looking back (-90 yaw), chest height
    eas.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(0, 400, 120), unreal.Rotator(pitch=-5, yaw=-90, roll=0))
    for i in range(count):
        row, col = divmod(i, 4)
        x = (col - 1.5) * 90
        y = -row * 120
        bp = BPS["Ain" if i % 2 == 0 else "Sera"]
        eas.spawn_actor_from_object(bp, unreal.Vector(x, y, 0), unreal.Rotator())
    les.save_current_level()
    log("saved", path, "heroes", count)


try:
    make("L_PerfEmpty", 0)
    make("L_PerfParty", 4)
    make("L_PerfRaid", 8)
except Exception:
    log("ERROR", traceback.format_exc())
unreal.SystemLibrary.quit_editor()
