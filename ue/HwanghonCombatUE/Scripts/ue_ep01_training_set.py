"""EP01 underground training room, dressed with the Derelict Corridor Megascans kit (docs/design/164 §3.2).

Canon (황혼_1부_소설판_제01화_마감본.txt):
  L381  «낡은 매트와 깨진 형광등이 전부인 공간이었다. 천장이 낮아 대검을 세우면 끝이 닿았고»
  L373  «철사슬에 묶인 낡은 훈련용 짚단 허수아비 … 발밑, 흙 속에 반쯤 묻힌 채, 미세한 문양»
  L439  «키는 3미터»   L457 관측창 너머 마태오
Kit grid is 512 cm, walls 384 cm, ceiling underside 368 cm: the 3 m body's head nearly touches it (as the novel wants).
Room 3 x 2 cells = 15.4 x 10.2 m (the graybox's 16 x 12 m design value, TBD_CANON).

A test level first (not the story world): /Game/Hwanghon/Story/EP01/Set/EP01_TrainingSet, with review cameras.
UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_ep01_training_set.py" -unattended -nullrhi
"""
import math

import unreal

MAP = "/Game/Hwanghon/Story/EP01/Set/EP01_TrainingSet"
K = "/Game/DerelictCorridor/Assets"
M = {
    "floor": f"{K}/Custom/Modules/Floor/Floor_01/SM_Floor_01",
    "ceiling": f"{K}/Custom/Modules/Ceiling/SM_Ceiling_01",
    "wall": f"{K}/Custom/Modules/Walls/SM_Wall_Center_01",
    "door": f"{K}/Custom/Modules/Door/DoubleDoor_01/SM_DoubleDoor_Center",
    "window": f"{K}/Custom/Modules/Door/Door_Window_01/SM_Door_Window_01",
    "pillar": f"{K}/Custom/Modules/Pillars/SM_Pillar_01",
    "lamp": f"{K}/Fab/Megascans/3D/Ind_Ware_Light_Ceiling_Metal_Hanging_04/SM_Ind_Ware_Light_Ceiling_Metal_Hanging_04",
    "rubble1": f"{K}/Fab/Megascans/3D/Ind_Rubble_Pile_Concrete_M_01/SM_Ind_Rubble_Pile_Concrete_M_01",
    "rubble2": f"{K}/Fab/Megascans/3D/Ind_Rubble_Pile_Concrete_M_02/SM_Ind_Rubble_Pile_Concrete_M_02",
    "ebox1": f"{K}/Fab/Megascans/3D/Urb_Street_ElectricalBox_Metal_Worn_01/SM_Urb_Street_ElectricalBox_Metal_Worn_01",
    "ebox2": f"{K}/Fab/Megascans/3D/Ind_Fact_Panel_ElectricalBox_Metal_Worn_01/SM_Ind_Fact_Panel_ElectricalBox_Metal_Worn_01",
    "cabinet": f"{K}/Fab/Megascans/3D/Ind_Ware_Cabinet_Electric_Metal_Dirty_01/SM_Ind_Ware_Cabinet_Electric_Metal_Dirty_01",
    "heater": f"{K}/Fab/Megascans/3D/Urb_Office_Heater_White_Old_01/SM_Urb_Office_Heater_White_Old_01",
    "chair": f"{K}/Fab/Megascans/3D/Res_Furn_Chair_Metal_Armless_01/SM_Res_Furn_Chair_Metal_Armless_01",
    "stool": f"{K}/Fab/Megascans/3D/Res_Furn_Stool_Metal_Worn_01/SM_Res_Furn_Stool_Metal_Worn_01",
    "table": f"{K}/Fab/Megascans/3D/Ind_Ware_Furn_Table_Wood_Worn_01/SM_Ind_Ware_Furn_Table_Wood_Worn_01_A",
    "pallet": f"{K}/Fab/Megascans/3D/Ind_Ware_Storage_Pallet_Wood_Worn_01/SM_Ind_Ware_Storage_Pallet_Wood_Worn_01",
    "crate": f"{K}/Fab/Megascans/3D/Ind_Ware_Storage_Crate_Plastic_White_01/SM_Ind_Ware_Storage_Crate_Plastic_White_01",
    "tarp": f"{K}/Fab/Megascans/3D/Ind_AbaFact_Tarp_Wrinkled_01/SM_Ind_AbaFact_Tarp_Wrinkled_01",
    "cables": f"{K}/Custom/Cables/SM_Cables_01_Cables_Wall_Big",
    "tube": f"{K}/Custom/LightFixture/SM_Lightbulbs_Fluerescent_01",
    "debris": f"{K}/Fab/Megascans/3D/Ind_Rubble_Debris_Concrete_Pack_01/SM_Ind_Rubble_Debris_Concrete_Pack_01_A",
    "broken_c": f"{K}/Custom/Modules/Floor/Floor_Addon_Broken_01/SM_TileGroup_03_C",
    "broken_e": f"{K}/Custom/Modules/Floor/Floor_Addon_Broken_01/SM_TileGroup_03_E",
    "broken_i": f"{K}/Custom/Modules/Floor/Floor_Addon_Broken_01/SM_TileGroup_03_I",
    "hanging": f"{K}/Custom/Cables/SM_Cables_01_Cables_Hanging_04",
}
BOSS_BODY = "/Game/Bosses/Training/boss_anim/SkeletalMeshes/boss_anim"
CELL, NX, NY = 512.0, 3, 2
X0, Y0 = 0.0, -CELL          # room spans x 0..1536, y -512..512
CEIL = 368.0
BOSS = unreal.Vector(1050, 0, 0)
AIN = unreal.Vector(420, 0, 0)

eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
lib = unreal.EditorAssetLibrary


def log(m):
    unreal.log(f"[HWSet] {m}")


def rot(yaw=0.0, pitch=0.0, roll=0.0):
    return unreal.Rotator(roll=roll, pitch=pitch, yaw=yaw)


def place(key, loc, yaw=0.0, scale=1.0, label=None, align=None):
    """Spawn a kit mesh. align=(x, y, z) puts the mesh's bounding-box min corner there instead of its pivot."""
    mesh = unreal.load_asset(M[key])
    a = eas.spawn_actor_from_object(mesh, unreal.Vector(*loc), rot(yaw))
    a.set_actor_scale3d(unreal.Vector(scale, scale, scale))
    if align is not None:
        o, e = a.get_actor_bounds(False)
        mn = o - e
        a.set_actor_location(a.get_actor_location() + unreal.Vector(align[0] - mn.x, align[1] - mn.y, align[2] - mn.z),
                             False, False)
    a.set_actor_label(label or key)
    return a


def rect_light(label, loc, intensity, temp, w, h, rot_=rot(pitch=-90), tint=(1, 1, 1)):
    a = eas.spawn_actor_from_class(unreal.RectLight, unreal.Vector(*loc), rot_)
    c = a.rect_light_component
    c.set_editor_property("intensity", intensity)
    c.set_editor_property("use_temperature", True)
    c.set_editor_property("temperature", temp)
    c.set_editor_property("source_width", w)
    c.set_editor_property("source_height", h)
    c.set_editor_property("attenuation_radius", 1400.0)
    c.set_editor_property("light_color", unreal.Color(r=int(255 * tint[0]), g=int(255 * tint[1]), b=int(255 * tint[2]), a=255))
    a.set_actor_label(label)
    return a


def camera(label, loc, look, fov):
    a = eas.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(*loc),
                                   unreal.MathLibrary.find_look_at_rotation(unreal.Vector(*loc), unreal.Vector(*look)))
    a.camera_component.set_editor_property("field_of_view", float(fov))
    a.camera_component.set_editor_property("constrain_aspect_ratio", False)
    a.set_actor_label(label)
    return a


def shell():
    for i in range(NX):
        for j in range(NY):
            x, y = X0 + i * CELL, Y0 + j * CELL
            place("floor", (0, 0, 0), label=f"Floor_{i}{j}", align=(x, y, -32))
            place("ceiling", (0, 0, 0), label=f"Ceiling_{i}{j}", align=(x, y, CEIL))
    # long walls (y = -512 and +512); the +y wall's middle cell is the observation window (L457)
    for i in range(NX):
        x = X0 + i * CELL
        place("wall", (0, 0, 0), label=f"Wall_S{i}", align=(x, Y0 - 16, 0))
        place("window" if i == 1 else "wall", (0, 0, 0), yaw=180, label=f"Wall_N{i}", align=(x, Y0 + NY * CELL, 0))
    # short walls: the entrance double door at x = 0 (players come in behind Ain), a wall behind the boss
    for j in range(NY):
        y = Y0 + j * CELL
        place("door" if j == 0 else "wall", (0, 0, 0), yaw=90, label=f"Wall_W{j}", align=(X0 - 16, y, 0))
        place("wall", (0, 0, 0), yaw=-90, label=f"Wall_E{j}", align=(X0 + NX * CELL, y, 0))
    for i in range(NX + 1):
        for y in (Y0 + 16, Y0 + NY * CELL - 16):
            place("pillar", (X0 + i * CELL, y, 0), label=f"Pillar_{i}_{int(y)}")
    # where the scarecrow stood for two years the tiles are cracked and lifted (L373 «발밑 … 문양»)
    place("broken_e", (0, 0, 0), label="Broken_Boss_S", align=(1030, -500, 0))
    place("broken_c", (0, 0, 0), yaw=90, label="Broken_Boss_N", align=(1040, 20, 0))
    place("broken_i", (0, 0, 0), label="Broken_Mid", align=(560, -180, 0))
    # the observation room behind the window (L457 마태오): a dark box, one dim lamp - not the outside world
    for k in range(NX):
        place("wall", (0, 0, 0), yaw=180, label=f"ObsBack_{k}", align=(X0 + k * CELL, Y0 + NY * CELL + 400, 0))
        place("floor", (0, 0, 0), label=f"ObsFloor_{k}", align=(X0 + k * CELL, Y0 + NY * CELL, -32))
        place("ceiling", (0, 0, 0), label=f"ObsCeil_{k}", align=(X0 + k * CELL, Y0 + NY * CELL, CEIL))
    for x in (X0 - 16, X0 + NX * CELL):
        place("wall", (0, 0, 0), yaw=90, label=f"ObsSide_{int(x)}", align=(x, Y0 + NY * CELL, 0))


def dressing():
    # corners: rubble where the ceiling gave; the entrance side is kept clear
    place("rubble1", (1440, -400, 0), yaw=30, label="Rubble_NE")
    place("rubble2", (1450, 390, 0), yaw=-70, label="Rubble_SE")
    place("rubble2", (120, 420, 0), yaw=150, scale=0.7, label="Rubble_W")
    # the room was a gym: benches, a table, stacked pallets under a tarp, a heater that no longer works
    place("table", (300, -440, 0), yaw=0, label="Table")
    place("chair", (360, -380, 0), yaw=200, label="Chair")
    place("stool", (560, -450, 0), yaw=40, label="Stool")
    place("pallet", (1300, 450, 0), yaw=5, label="Pallet")
    place("tarp", (1300, 440, 12), yaw=10, label="Tarp")
    place("crate", (1180, 470, 0), yaw=-20, label="Crate")
    place("heater", (60, 300, 0), yaw=90, label="Heater")
    # the power that still feeds the lamps: boxes and cables on the south wall
    place("ebox1", (700, -500, 150), yaw=0, label="EBox1")
    place("ebox2", (820, -500, 170), yaw=0, label="EBox2")
    place("cabinet", (1500, -250, 0), yaw=-90, label="Cabinet")
    place("cables", (1024, -500, 300), yaw=0, label="Cables_S")
    place("hanging", (700, 150, CEIL), yaw=90, label="Cables_Hang")
    # «낡은 매트»: training mats - tarps laid flat, edges curling
    for k, (x, y, yaw) in enumerate([(520, -60, 3), (720, 130, -8), (760, -220, 12), (420, 220, -3)]):
        place("tarp", (x, y, 1), yaw=yaw, label=f"Mat_{k}").set_actor_scale3d(unreal.Vector(1.3, 1.0, 0.12))
    # concrete crumbs and tile shards over the floor, thicker near the corners and the scarecrow
    import random
    rnd = random.Random(7)
    for k in range(60):
        near = k < 25
        x = rnd.uniform(900, 1300) if near else rnd.uniform(60, 1480)
        y = rnd.uniform(-300, 300) if near else rnd.uniform(-480, 480)
        a = place("debris", (x, y, 0), yaw=rnd.uniform(0, 360), scale=rnd.uniform(0.6, 1.4), label=f"Debris_{k}")


def lights():
    # «깨진 형광등»: five hanging tubes down the middle; one dead, one weak (the flicker is added in code later)
    spots = [(260, -200), (260, 200), (768, 0), (1280, -200), (1280, 200)]
    for k, (x, y) in enumerate(spots):
        place("lamp", (x, y, CEIL - 2), yaw=90, label=f"Lamp_{k}")
        if k == 1:
            continue   # dead tube
        place("tube", (x, y, CEIL - 22), yaw=90, label=f"Tube_{k}")
        rect_light(f"LampLight_{k}", (x, y, CEIL - 30), 90.0 if k != 3 else 30.0, 5600, 150, 14, tint=(0.92, 1.0, 0.94))
    rect_light("ObsLamp", (768, Y0 + NY * CELL + 200, CEIL - 40), 6.0, 3200, 60, 20, tint=(1.0, 0.8, 0.6))
    # the room's only other light spills in from the corridor through the door
    rect_light("DoorSpill", (-60, -256, 220), 4.0, 3400, 200, 300, rot_=rot(yaw=0), tint=(1.0, 0.85, 0.7))
    fog = eas.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(700, 0, 0))
    f = fog.component
    f.set_editor_property("fog_density", 0.035)
    f.set_editor_property("fog_height_falloff", 0.6)
    for name in ("enable_volumetric_fog", "volumetric_fog"):
        try:
            f.set_editor_property(name, True)
            break
        except Exception:
            pass
    f.set_editor_property("fog_inscattering_luminance", unreal.LinearColor(0.02, 0.025, 0.03, 1))
    fog.set_actor_label("DustFog")
    ppv = eas.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(700, 0, 180))
    ppv.set_editor_property("unbound", True)
    s = ppv.settings
    s.set_editor_property("override_auto_exposure_method", True)
    s.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    s.set_editor_property("override_auto_exposure_bias", True)
    s.set_editor_property("auto_exposure_bias", 6.0)   # manual EV: in the render higher was BRIGHTER (8.5, 10.5 washed out)
    s.set_editor_property("override_bloom_intensity", True)
    s.set_editor_property("bloom_intensity", 0.35)
    s.set_editor_property("override_vignette_intensity", True)
    s.set_editor_property("vignette_intensity", 0.55)
    s.set_editor_property("override_film_grain_intensity", True)
    s.set_editor_property("film_grain_intensity", 0.15)
    ppv.set_editor_property("settings", s)
    ppv.set_actor_label("PP_Training")
    sky = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(700, 0, 300))
    sky.light_component.set_editor_property("intensity", 0.05)
    sky.set_actor_label("AmbientLow")


def figures():
    body = unreal.load_asset(BOSS_BODY)
    a = eas.spawn_actor_from_class(unreal.SkeletalMeshActor, BOSS, rot(yaw=180))
    a.skeletal_mesh_component.set_skinned_asset_and_update(body)
    o, e = a.get_actor_bounds(False)
    k = 300.0 / max(1.0, 2 * e.z)   # the text's 3 m
    a.set_actor_scale3d(unreal.Vector(k, k, k))
    o, e = a.get_actor_bounds(False)
    a.set_actor_location(a.get_actor_location() + unreal.Vector(0, 0, -(o.z - e.z)), False, False)
    a.set_actor_label("Scarecrow_3m")
    log(f"scarecrow scaled x{k:.2f} to 3 m")


def cameras():
    camera("CAM_A_Entrance", (90, -430, 210), (1150, 120, 140), 82)
    camera("CAM_B_BehindAin", (230, 70, 185), (BOSS.x, 0, 170), 65)
    camera("CAM_C_LowOnBoss", (760, -170, 35), (BOSS.x, 0, 250), 72)
    camera("CAM_D_Window", (650, -380, 160), (800, 512, 230), 78)


def main():
    if lib.does_asset_exist(MAP):
        lib.delete_asset(MAP)
    les.new_level(MAP, False)
    # new_level() gave the open-world template (landscape, sun, sky - a desert showed through the window): clear it
    keep = ("WorldSettings", "WorldDataLayers", "WorldPartitionMiniMap", "Brush", "DefaultPhysicsVolume")
    junk = [a for a in eas.get_all_level_actors() if a.get_class().get_name() not in keep]
    log(f"clearing {len(junk)} template actors")
    eas.destroy_actors(junk)
    shell()
    dressing()
    lights()
    figures()
    cameras()
    log(f"{len(eas.get_all_level_actors())} actors in {unreal.EditorLevelLibrary.get_editor_world().get_name()}")
    # new_level() left an "Untitled" world here and the named map stayed empty (2026-09-30): save the world as the map
    ok = unreal.EditorLoadingAndSavingUtils.save_map(unreal.EditorLevelLibrary.get_editor_world(), MAP)
    log(f"save_map {ok}")
    log(f"saved {MAP}")


main()
