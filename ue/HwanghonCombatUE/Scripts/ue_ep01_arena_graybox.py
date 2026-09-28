"""EP01 boss arena graybox — 지하 훈련장 (docs/dungeons/boss_training_heosuabi_DUNGEON_SPEC.md, doc 136).

Canon (docs/story/source/황혼_1부_소설판_제01화_마감본.txt):
  L381  낡은 매트와 깨진 형광등, 천장이 낮아 대검을 세우면 끝이 닿는다 (카인은 여기서만 검을 눕혀 든다)
  L373  철사슬에 묶인 짚단 허수아비, 발밑 흙 속 문양
  L433  폭발: 검은 연기, 주황 파티클, 철사슬 끊김, 두 사람이 매트 위를 구른다
  L439  나노 강선체, 팔이 비정상적으로 길고 키 3 m
  L457  관측창 너머 마태오
  L613  잔해·끊어진 철사슬·매트에 팬 자국 / L573 회색 가루
Design values not in the text (room 16 x 12 m, ceiling 3.2 m, positions) are TBD_CANON design choices.

Builds /Game/Hwanghon/Story/EP01/EP01_TrainingRoom_World (World Partition) with runtime Data Layers
  DL_Arena_Base, DL_Story_PreBattle, DL_Phase1, DL_Phase2_Damaged (empty — the text has no arena change),
  DL_Phase3_Critical (empty), DL_Aftermath, DL_Cinematic
and Level Sequences (shared world, cinematic cameras) for Boss Entry / transitions / Death.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_ep01_arena_graybox.py" -unattended -nullrhi
"""
import math

import unreal

ROOT = "/Game/Hwanghon/Story/EP01"
MAP = f"{ROOT}/EP01_TrainingRoom_World"
DL_DIR = f"{ROOT}/DataLayers"
SEQ_DIR = f"{ROOT}/Sequences"
MAT_DIR = f"{ROOT}/Materials"
CUBE = "/Engine/BasicShapes/Cube.Cube"
CYL = "/Engine/BasicShapes/Cylinder.Cylinder"
SPHERE = "/Engine/BasicShapes/Sphere.Sphere"
PLANE = "/Engine/BasicShapes/Plane.Plane"
BASIC = "/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"
ROOM_X, ROOM_Y, CEIL = 1600.0, 1200.0, 320.0   # TBD_CANON: size not in the text; ceiling low (L381)
BOSS = unreal.Vector(300, 0, 0)
FPS = 30

tools = unreal.AssetToolsHelpers.get_asset_tools()
lib = unreal.EditorAssetLibrary
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
dls = unreal.get_editor_subsystem(unreal.DataLayerEditorSubsystem)


def log(msg):
    unreal.log(f"[HWArena] {msg}")


def mat(name, rgb):
    path = f"{MAT_DIR}/{name}"
    mi = unreal.load_asset(path) if lib.does_asset_exist(path) else tools.create_asset(
        name, MAT_DIR, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    mi.set_editor_property("parent", unreal.load_asset(BASIC))
    unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(mi, "Color", unreal.LinearColor(*rgb, 1.0))
    lib.save_loaded_asset(mi)
    return mi


def box(label, mesh, loc, scale, material, rot=(0, 0, 0), layer=None):
    # rot is (pitch, yaw, roll); unreal.Rotator's positional order is (roll, pitch, yaw)
    a = eas.spawn_actor_from_object(unreal.load_asset(mesh), unreal.Vector(*loc),
                                    unreal.Rotator(roll=rot[2], pitch=rot[0], yaw=rot[1]))
    a.set_actor_label(label)
    a.set_actor_scale3d(unreal.Vector(*scale))
    a.static_mesh_component.set_material(0, material)
    LAYER_ACTORS.setdefault(layer or "DL_Arena_Base", []).append(a)
    return a


def marker(label, loc, rot=(0, 0, 0), tag=None, layer="DL_Arena_Base"):
    a = eas.spawn_actor_from_class(unreal.TargetPoint, unreal.Vector(*loc), unreal.Rotator(roll=rot[2], pitch=rot[0], yaw=rot[1]))
    a.set_actor_label(label)
    if tag:
        a.tags = [tag]
    LAYER_ACTORS.setdefault(layer, []).append(a)
    return a


def light(label, loc, intensity, color, layer="DL_Arena_Base", radius=900.0):
    a = eas.spawn_actor_from_class(unreal.PointLight, unreal.Vector(*loc), unreal.Rotator(0, 0, 0))
    a.set_actor_label(label)
    c = a.point_light_component
    c.set_intensity(intensity)
    c.set_light_color(unreal.LinearColor(*color, 1))
    c.set_attenuation_radius(radius)
    LAYER_ACTORS.setdefault(layer, []).append(a)
    return a


def camera(label, loc, look_at, fov=40.0):
    rot = unreal.MathLibrary.find_look_at_rotation(unreal.Vector(*loc), unreal.Vector(*look_at))
    a = eas.spawn_actor_from_class(unreal.CineCameraActor, unreal.Vector(*loc), rot)
    a.set_actor_label(label)
    a.tags = [label]
    a.get_cine_camera_component().set_editor_property("current_focal_length", 35.0 * 40.0 / fov)
    LAYER_ACTORS.setdefault("DL_Cinematic", []).append(a)
    return a


LAYER_ACTORS = {}


def build_geometry():
    M = {k: mat(f"MI_GB_{k}", v) for k, v in {
        "Floor": (0.18, 0.18, 0.19), "Wall": (0.32, 0.31, 0.30), "Ceiling": (0.22, 0.22, 0.22),
        "Mat": (0.10, 0.20, 0.16), "Straw": (0.55, 0.43, 0.20), "Wood": (0.35, 0.24, 0.14),
        "Chain": (0.45, 0.45, 0.48), "Rune": (0.90, 0.10, 0.05), "Debris": (0.08, 0.08, 0.08),
        "Dust": (0.62, 0.62, 0.60), "Boss": (0.12, 0.10, 0.10), "Tube": (0.85, 0.90, 0.95),
        "Marker": (0.95, 0.60, 0.10), "Band": (0.20, 0.70, 0.30), "Window": (0.15, 0.25, 0.30)}.items()}
    hx, hy = ROOM_X / 2, ROOM_Y / 2
    # --- DL_Arena_Base: shell (1 m cube = scale 1)
    box("GB_Floor", CUBE, (0, 0, -10), (ROOM_X / 100, ROOM_Y / 100, 0.2), M["Floor"])
    box("GB_Ceiling", CUBE, (0, 0, CEIL + 10), (ROOM_X / 100, ROOM_Y / 100, 0.2), M["Ceiling"])
    box("GB_Wall_W", CUBE, (-hx - 10, 0, CEIL / 2), (0.2, ROOM_Y / 100, CEIL / 100), M["Wall"])
    box("GB_Wall_E", CUBE, (hx + 10, 0, CEIL / 2), (0.2, ROOM_Y / 100, CEIL / 100), M["Wall"])
    # south wall with a 2 m door to the office corridor (TBD_CANON: 사무소-훈련장 공간 관계)
    box("GB_Wall_S_a", CUBE, (-hx + 100, -hy - 10, CEIL / 2), (2.0, 0.2, CEIL / 100), M["Wall"])
    box("GB_Wall_S_b", CUBE, (100 + 50, -hy - 10, CEIL / 2), ((ROOM_X - 400) / 100, 0.2, CEIL / 100), M["Wall"])
    box("GB_Door_Lintel", CUBE, (-hx + 300, -hy - 10, 260), (2.0, 0.2, 1.2), M["Wall"])
    # north wall with the observation window (L457) into Mateo's booth
    box("GB_Wall_N_low", CUBE, (0, hy + 10, 50), (ROOM_X / 100, 0.2, 1.0), M["Wall"])
    box("GB_Wall_N_high", CUBE, (0, hy + 10, 260), (ROOM_X / 100, 0.2, 1.2), M["Wall"])
    box("GB_Wall_N_left", CUBE, (-450, hy + 10, 150), (7.0, 0.2, 1.0), M["Wall"])
    box("GB_Wall_N_right", CUBE, (550, hy + 10, 150), (5.0, 0.2, 1.0), M["Wall"])
    box("GB_ObservationWindow_Sill", CUBE, (0, hy + 10, 102), (3.0, 0.3, 0.04), M["Window"])
    light("GB_BoothLight", (0, hy + 250, CEIL - 40), 60.0, (1.0, 0.8, 0.6), radius=500.0)
    box("GB_Booth_Floor", CUBE, (0, hy + 200, -10), (6.0, 3.6, 0.2), M["Floor"])
    box("GB_Booth_Back", CUBE, (0, hy + 390, CEIL / 2), (6.0, 0.2, CEIL / 100), M["Wall"])
    box("GB_Booth_Ceiling", CUBE, (0, hy + 200, CEIL + 10), (6.0, 3.6, 0.2), M["Ceiling"])
    # worn mats (L381): 4 x 3 grid of 2 m mats around the fight
    for i in range(4):
        for j in range(3):
            box(f"GB_Mat_{i}{j}", CUBE, (-300 + i * 205, -205 + j * 205, 3), (2.0, 2.0, 0.06), M["Mat"])
    # fluorescent fixtures (L381 깨진 형광등): 6 tubes, two broken (hanging) — lights on the working ones
    for i, (x, y) in enumerate([(-500, -250), (-500, 250), (0, -250), (0, 250), (500, -250), (500, 250)]):
        broken = i in (2, 5)
        box(f"GB_Tube_{i}{'_broken' if broken else ''}", CUBE, (x, y, CEIL - (40 if broken else 8)),
            (1.2, 0.12, 0.06), M["Tube"], rot=(0, 0, 28 if broken else 0))
        if not broken:
            light(f"GB_TubeLight_{i}", (x, y, CEIL - 30), 120.0, (0.85, 0.92, 1.0))
    ppv = eas.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 150), unreal.Rotator())
    ppv.set_actor_label("GB_PostProcess_FixedExposure")
    ppv.set_editor_property("unbound", True)
    pp = ppv.get_editor_property("settings")
    for k, v in (("auto_exposure_min_brightness", 1.0), ("auto_exposure_max_brightness", 1.0), ("auto_exposure_bias", 0.0)):
        pp.set_editor_property("override_" + k, True)
        pp.set_editor_property(k, v)
    ppv.set_editor_property("settings", pp)
    LAYER_ACTORS.setdefault("DL_Arena_Base", []).append(ppv)
    # gameplay markers placed by hand (132: spawn / lanes / safe zones are never procedural)
    marker("GP_BossSpawn", (BOSS.x, BOSS.y, 5), (0, 180, 0), "BossSpawn")
    marker("GP_AinStart", (-250, 0, 5), (0, 0, 0), "AinStart")
    marker("GP_KainStart_HalfStepBehind", (-310, -45, 5), (0, 0, 0), "KainStart")   # L107 반보 뒤
    marker("GP_MateoWindow", (0, hy + 150, 5), (0, -90, 0), "MateoWindow")
    # scythe band (L499-L501): too close / reach band / too far around the boss — design reference rings
    for r, name, m in ((150, "TooClose", M["Marker"]), (230, "ScytheBandOuter", M["Band"]), (260, "SpinReach", M["Marker"])):
        for k in range(24):
            a = 2 * math.pi * k / 24
            box(f"GP_Ring_{name}_{k:02d}", CUBE, (BOSS.x + r * math.cos(a), BOSS.y + r * math.sin(a), 6),
                (0.08, 0.08, 0.02), m)
    # --- DL_Story_PreBattle: the chained straw dummy (L373) and the rune at its feet
    box("SP_Dummy_Pole", CYL, (BOSS.x, BOSS.y, 100), (0.15, 0.15, 2.0), M["Wood"], layer="DL_Story_PreBattle")
    box("SP_Dummy_Body", CYL, (BOSS.x, BOSS.y, 120), (0.8, 0.8, 1.3), M["Straw"], layer="DL_Story_PreBattle")
    box("SP_Dummy_Head", CUBE, (BOSS.x, BOSS.y, 200), (0.45, 0.45, 0.5), M["Straw"], rot=(0, 0, 12), layer="DL_Story_PreBattle")
    box("SP_Dummy_Arms", CUBE, (BOSS.x, BOSS.y, 160), (0.2, 1.4, 0.15), M["Wood"], rot=(0, 0, 0), layer="DL_Story_PreBattle")
    for k in range(6):   # 【서】 L11: 여섯 바퀴 감긴 사슬
        box(f"SP_Chain_Wrap_{k}", CYL, (BOSS.x, BOSS.y, 80 + k * 18), (0.86, 0.86, 0.03), M["Chain"], layer="DL_Story_PreBattle")
    for k, (dx, dy) in enumerate(((-1, 1), (1, 1))):
        box(f"SP_Chain_Anchor_{k}", CYL, (BOSS.x + dx * 150, BOSS.y + dy * 150, 150), (0.04, 0.04, 4.2), M["Chain"],
            rot=(0, 45 * dx, 60), layer="DL_Story_PreBattle")
    box("SP_Rune", PLANE, (BOSS.x, BOSS.y, 7), (1.1, 1.1, 1), M["Rune"], layer="DL_Story_PreBattle")
    # --- DL_Phase1: after the blast (L433-L439) — 3 m strand body, snapped chains, straw debris, dimmed light
    box("P1_BossBody_3m", CYL, (BOSS.x, BOSS.y, 150), (0.9, 0.9, 3.0), M["Boss"], layer="DL_Phase1")
    box("P1_BossArm_L", CYL, (BOSS.x, BOSS.y + 120, 170), (0.25, 0.25, 2.2), M["Boss"], rot=(0, 0, -60), layer="DL_Phase1")
    box("P1_BossArm_R", CYL, (BOSS.x, BOSS.y - 120, 170), (0.25, 0.25, 2.2), M["Boss"], rot=(0, 0, 60), layer="DL_Phase1")
    for k in range(28):
        a = 2 * math.pi * k / 28
        r = 180 + (k * 37) % 220
        box(f"P1_StrawDebris_{k:02d}", CUBE, (BOSS.x + r * math.cos(a), BOSS.y + r * math.sin(a), 6),
            (0.25, 0.12, 0.05), M["Straw"], rot=(0, 0, k * 23), layer="DL_Phase1")
    for k in range(4):
        box(f"P1_ChainSnapped_{k}", CYL, (BOSS.x - 150 + k * 90, BOSS.y + (-1) ** k * 180, 5), (0.04, 0.04, 1.4),
            M["Chain"], rot=(90, k * 40, 0), layer="DL_Phase1")
    light("P1_EmberGlow", (BOSS.x, BOSS.y, 120), 80.0, (1.0, 0.45, 0.1), layer="DL_Phase1", radius=600.0)
    # --- DL_Phase2_Damaged / DL_Phase3_Critical: intentionally empty (the text has no arena change for this boss)
    # --- DL_Aftermath (L613, L573): dented mats, debris, the grey dust where the body collapsed
    box("AF_DustPile", SPHERE, (BOSS.x, BOSS.y, 0), (1.6, 1.6, 0.25), M["Dust"], layer="DL_Aftermath")
    for k in range(3):
        box(f"AF_MatDent_{k}", CUBE, (BOSS.x - 250 + k * 60, BOSS.y - 60 + k * 40, 5), (0.9, 0.4, 0.02), M["Debris"],
            rot=(0, 0, k * 30), layer="DL_Aftermath")
    for k in range(16):
        a = 2 * math.pi * k / 16
        box(f"AF_Debris_{k:02d}", CUBE, (BOSS.x + 220 * math.cos(a), BOSS.y + 220 * math.sin(a), 6),
            (0.2, 0.1, 0.05), M["Straw"], rot=(0, 0, k * 31), layer="DL_Aftermath")
    # --- DL_Cinematic: cameras shared with the game world (entry / rebound / sever / death / Mateo POV)
    cams = {
        "CAM_Entry_Close": camera("CAM_Entry_Close", (BOSS.x - 380, BOSS.y - 160, 45), (BOSS.x, BOSS.y, 150), 45),
        "CAM_Entry_Wide": camera("CAM_Entry_Wide", (-hx + 120, -hy + 120, 250), (BOSS.x - 100, 0, 90), 60),
        "CAM_Observation": camera("CAM_Observation", (0, hy + 160, 170), (BOSS.x, 0, 120), 45),
        "CAM_Rebound": camera("CAM_Rebound", (BOSS.x - 150, -330, 110), (BOSS.x - 150, 0, 110), 45),
        "CAM_Sever": camera("CAM_Sever", (BOSS.x - 120, 420, 70), (BOSS.x, BOSS.y + 80, 170), 45),
        "CAM_Death": camera("CAM_Death", (BOSS.x - 300, -150, 170), (BOSS.x - 40, 0, 60), 40),
        "CAM_Gameplay_Ref": camera("CAM_Gameplay_Ref", (-620, 0, 260), (BOSS.x, 0, 90), 60),
    }
    return cams


def data_layers():
    lib.make_directory(DL_DIR)
    out = {}
    initial = {"DL_Arena_Base": True, "DL_Story_PreBattle": True, "DL_Cinematic": True}
    for name in ("DL_Arena_Base", "DL_Story_PreBattle", "DL_Phase1", "DL_Phase2_Damaged", "DL_Phase3_Critical",
                 "DL_Aftermath", "DL_Cinematic"):
        path = f"{DL_DIR}/{name}"
        asset = unreal.load_asset(path) if lib.does_asset_exist(path) else tools.create_asset(
            name, DL_DIR, unreal.DataLayerAsset, unreal.DataLayerFactory())
        asset.set_editor_property("data_layer_type", unreal.DataLayerType.RUNTIME)
        lib.save_loaded_asset(asset)
        params = unreal.DataLayerCreationParameters()
        params.data_layer_asset = asset
        inst = dls.create_data_layer_instance(params)
        state = unreal.DataLayerRuntimeState.ACTIVATED if initial.get(name) else unreal.DataLayerRuntimeState.UNLOADED
        dls.set_data_layer_initial_runtime_state(inst, state)
        actors = LAYER_ACTORS.get(name, [])
        if actors:
            dls.add_actors_to_data_layer(actors, inst)
        out[name] = (asset, inst)
        log(f"{name}: {len(actors)} actors, initial {state}")
    return out


def sequence(name, seconds, cuts, marks, layer_events=()):
    lib.make_directory(SEQ_DIR)
    path = f"{SEQ_DIR}/{name}"
    if lib.does_asset_exist(path):
        lib.delete_asset(path)
    seq = tools.create_asset(name, SEQ_DIR, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    seq.set_display_rate(unreal.FrameRate(FPS, 1))
    seq.set_playback_start(0)
    seq.set_playback_end(int(seconds * FPS))
    cut_track = seq.add_track(unreal.MovieSceneCameraCutTrack)
    for cam, a, b in cuts:
        binding = seq.add_possessable(cam)
        sec = cut_track.add_section()
        sec.set_range_seconds(a, b)
        try:
            sec.set_camera_binding_id(seq.get_binding_id(binding))
        except Exception as e:
            log(f"{name}: camera binding {e}")
    for t, label in marks:
        mf = unreal.MovieSceneMarkedFrame()
        mf.set_editor_property("frame_number", unreal.FrameNumber(int(t * FPS * 800)))   # tick resolution 24000/30
        mf.set_editor_property("label", label)
        seq.add_marked_frame(mf)
    for t, activate, deactivate in layer_events:
        try:
            track = seq.add_track(unreal.MovieSceneDataLayerTrack)
            for assets, st in ((activate, unreal.DataLayerRuntimeState.ACTIVATED), (deactivate, unreal.DataLayerRuntimeState.UNLOADED)):
                if not assets:
                    continue
                s = track.add_section()
                s.set_range_seconds(t, seconds)
                s.set_editor_property("data_layer_assets", assets)
                s.set_editor_property("desired_state", st)
        except Exception as e:
            log(f"{name}: data layer track {e}")
    lib.save_loaded_asset(seq)
    log(f"sequence {name}: {seconds}s, {len(cuts)} cuts, {len(marks)} marks")
    return seq


def main():
    lib.make_directory(ROOT)
    lib.make_directory(MAT_DIR)
    if lib.does_asset_exist(MAP):
        lib.delete_asset(MAP)
    les.new_level(MAP, True)   # World Partition: Data Layers switch the phase state at runtime
    ws = unreal.EditorLevelLibrary.get_editor_world().get_world_settings()
    ws.set_editor_property("default_game_mode", unreal.GameModeBase.static_class())
    cams = build_geometry()
    layers = data_layers()
    A = lambda n: layers[n][0]
    # Boss Entry (EP01_SC015, L415-L459)
    sequence("LS_EP01_SC015_BossEntry", 8.0,
             [(cams["CAM_Entry_Close"], 0, 2), (cams["CAM_Entry_Wide"], 2, 4.5), (cams["CAM_Entry_Close"], 4.5, 6.5),
              (cams["CAM_Observation"], 6.5, 8)],
             [(0.0, "L417 문양이 균열을 따라 번짐"), (1.8, "L419 카인! 물러나! / L421 …뭐?"), (3.0, "L427-429 섬광·폭발"),
              (4.5, "L435-439 붉은 안광·3m 강선체"), (5.8, "L451 이중 음성 / L455 목소리가 두 개"), (6.8, "L457 마태오 담배")],
             layer_events=[(3.0, [A("DL_Phase1")], [A("DL_Story_PreBattle")])])
    # Transition: too close -> rebound (EP01_SC016 -> SC017, L505-L529)
    sequence("LS_EP01_SC016_SC017_Rebound", 4.0, [(cams["CAM_Rebound"], 0, 4)],
             [(0.0, "L505 회전이 풀림"), (0.5, "L509 비켜!"), (1.2, "L513 대검 수직 꽂기"), (2.2, "L519-521 되돌림"),
              (3.0, "L523 내 뒤로는… 못 지난다!"), (3.5, "L525-529 자세 붕괴 — 숨 한 번")])
    # Transition: sever (EP01_SC018, L533-L563)
    sequence("LS_EP01_SC018_Sever", 3.0, [(cams["CAM_Sever"], 0, 3)],
             [(0.0, "L537-541 뛰지 않는다 — 낫 하나 길이"), (0.8, "L545 이번엔—"), (1.2, "L547-549 세상이 늘어짐"),
              (2.2, "L553-557 원의 가장 바깥 / 걸었다… 스위트 스폿!"), (2.8, "L561-563 콰드득 — 관절")])
    # Boss death / result (EP01_SC019, L565-L581)
    sequence("LS_EP01_SC019_BossDeath", 6.0, [(cams["CAM_Sever"], 0, 2), (cams["CAM_Death"], 2, 6)],
             [(0.0, "L563 관절이 뜯겨 나감"), (1.0, "L565 주황 결정이 굴러떨어짐 — 손바닥에"), (3.0, "L571 …또 가루야"),
              (4.0, "L575-579 결정 역류 → 회색 가루 → 칩")],
             layer_events=[(3.0, [A("DL_Aftermath")], [A("DL_Phase1")])])
    les.save_current_level()
    log(f"saved {MAP}: layers {', '.join(f'{k}={len(LAYER_ACTORS.get(k, []))}' for k in layers)}")


main()
