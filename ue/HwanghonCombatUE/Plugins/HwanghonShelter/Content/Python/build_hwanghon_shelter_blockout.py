"""황혼 강남 벙커 B-1 허브 생성기 v2 (UE 5.8)

기준:
- 기존 'EP01 벙커 기지 디자인 시트'의 중앙 코어 + 분기 통로 구조.
- 지하 3층 / 낡은 산업 시설 / 낮은 천장 / 노출 배관 / 방폭 셔터.
- 거대한 쇼핑몰형 오픈 로비가 아니라 '던전처럼 연결된 작은 기능실'로 구성.

생성:
01 인력사무소        NPC 마태오
02 등급측정소        NPC 유진
03 장인 공방         NPC 한 장인
04 훈련소            NPC 오정길
05 의뢰소            NPC 두호
06 치료실            NPC 닥터 진
07 배급소            NPC 수희
+ 마태오 직무실 / 중앙 코어 / 외부 통로 / 벙커 연결 통로 / 출격 방폭 셔터

NPC Blueprint 또는 디자인시트 Texture가 /Game 안에 존재하면 이름 별칭으로 찾아 자동 연결한다.
없으면 런타임 프록시가 표시되므로, 이후 해당 NPC BP/Texture만 연결하면 된다.
"""

import unreal

# NOTE (HwanghonCombatUE, doc 152): unreal.Rotator(a, b, c) is (roll, pitch, yaw) positionally - every
# "Rotator(0, yaw, 0)" here pitched corridors upright (a wall across the PlayerStart) and stood NPCs on their heads.
# Keyword form below.

TAG = "HH_SHELTER_V2"
CUBE = unreal.load_asset("/Engine/BasicShapes/Cube.Cube")
CYLINDER = unreal.load_asset("/Engine/BasicShapes/Cylinder.Cylinder")
actor_sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def mark(actor, label):
    actor.tags = list(actor.tags) + [unreal.Name(TAG), unreal.Name("AI_CREATED"), unreal.Name("SAFE_TO_REMOVE")]
    actor.set_actor_label(label)
    return actor


def clear_previous():
    old = [a for a in actor_sub.get_all_level_actors() if TAG in [str(x) for x in a.tags]]
    if old:
        actor_sub.destroy_actors(old)
        unreal.log(f"[HH Shelter v2] removed {len(old)} actors")


def cube(label, location, size_cm, yaw=0.0):
    a = actor_sub.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(*location), unreal.Rotator(roll=0, pitch=0, yaw=yaw))
    mark(a, label)
    a.static_mesh_component.set_static_mesh(CUBE)
    a.set_actor_scale3d(unreal.Vector(size_cm[0]/100.0, size_cm[1]/100.0, size_cm[2]/100.0))
    a.static_mesh_component.set_collision_enabled(unreal.CollisionEnabled.QUERY_AND_PHYSICS)
    return a


def cylinder(label, location, radius=45, height=180):
    a = actor_sub.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(*location), unreal.Rotator())
    mark(a, label)
    a.static_mesh_component.set_static_mesh(CYLINDER)
    a.set_actor_scale3d(unreal.Vector(radius/50.0, radius/50.0, height/100.0))
    a.static_mesh_component.set_collision_enabled(unreal.CollisionEnabled.QUERY_AND_PHYSICS)
    return a


def corridor(prefix, start, end, width=360, height=320):
    sx, sy, z = start
    ex, ey, _ = end
    mx, my = (sx+ex)/2, (sy+ey)/2
    dx, dy = ex-sx, ey-sy
    length = (dx*dx + dy*dy) ** 0.5
    yaw = unreal.MathLibrary.atan2(dy, dx) * 57.2957795

    # Local X = corridor length, local Y = corridor width.
    cube(prefix+"_Floor", (mx,my,z-12), (length,width,24), yaw)
    cube(prefix+"_Ceiling", (mx,my,z+height), (length,width,24), yaw)

    # side walls from local perpendicular vector
    if length > 1:
        nx, ny = -dy/length, dx/length
        offset = width/2
        cube(prefix+"_WallL", (mx+nx*offset,my+ny*offset,z+height/2), (length,24,height), yaw)
        cube(prefix+"_WallR", (mx-nx*offset,my-ny*offset,z+height/2), (length,24,height), yaw)


def room(prefix, center, size=(760,620,340)):
    x,y,z = center
    w,d,h = size
    t=24
    cube(prefix+"_Floor",(x,y,z-12),(w,d,t))
    cube(prefix+"_Ceiling",(x,y,z+h),(w,d,t))
    cube(prefix+"_Back",(x,y+d/2,z+h/2),(w,t,h))
    cube(prefix+"_Left",(x-w/2,y,z+h/2),(t,d,h))
    cube(prefix+"_Right",(x+w/2,y,z+h/2),(t,d,h))


def light(label, location, intensity=900.0, radius=480.0, color=(1.0,0.45,0.15,1.0)):
    a = actor_sub.spawn_actor_from_class(unreal.PointLight, unreal.Vector(*location), unreal.Rotator())
    mark(a,label)
    c = a.point_light_component
    c.set_editor_property("intensity", intensity)
    c.set_editor_property("attenuation_radius", radius)
    c.set_editor_property("light_color", unreal.LinearColor(*color).to_color(True))
    return a


def station(station_id, number, location, yaw):
    cls = unreal.load_class(None, "/Script/HwanghonShelter.HHShelterStation")
    if not cls:
        raise RuntimeError("HHShelterStation class not found. Compile/enable plugin first.")
    a = actor_sub.spawn_actor_from_class(cls, unreal.Vector(*location), unreal.Rotator(roll=0, pitch=0, yaw=yaw))
    mark(a, f"HH_Station_{number:02d}_{station_id}")
    a.set_editor_property("station_id", unreal.Name(station_id))
    a.set_editor_property("station_number", number)
    try: a.rerun_construction_scripts()
    except Exception: pass
    return a


def all_assets():
    try:
        return unreal.EditorAssetLibrary.list_assets("/Game", recursive=True, include_folder=False)
    except Exception:
        return []


ASSET_CACHE = None


def find_blueprint_class(aliases):
    global ASSET_CACHE
    if ASSET_CACHE is None:
        ASSET_CACHE = all_assets()
    low_alias = [a.lower() for a in aliases]
    for path in ASSET_CACHE:
        lp = path.lower()
        if any(a in lp for a in low_alias):
            try:
                cls = unreal.EditorAssetLibrary.load_blueprint_class(path)
                if cls:
                    return cls, path
            except Exception:
                pass
    return None, None


def find_texture(aliases):
    global ASSET_CACHE
    if ASSET_CACHE is None:
        ASSET_CACHE = all_assets()
    low_alias = [a.lower() for a in aliases]
    for path in ASSET_CACHE:
        lp = path.lower()
        if any(a in lp for a in low_alias):
            try:
                obj = unreal.load_asset(path)
                if isinstance(obj, unreal.Texture2D):
                    return obj, path
            except Exception:
                pass
    return None, None


NPC_INFO = {
    "Matteo": ("PartyOffice", ["matteo","마태오"], "BP_Matteo / 마태오 디자인시트"),
    "Yujin": ("RankAssessment", ["yujin","유진"], "BP_Yujin / 유진 디자인시트"),
    "HanJangin": ("Crafting", ["hanjangin","han_jangin","한장인","한_장인"], "BP_HanJangin / 한 장인 디자인시트"),
    "OJeonggil": ("Training", ["ojeonggil","o_jeonggil","오정길"], "BP_OJeonggil / 오정길 디자인시트"),
    "Duho": ("RequestBoard", ["duho","두호"], "BP_Duho / 두호 디자인시트"),
    "DrJin": ("MedicalBay", ["drjin","dr_jin","doctorjin","닥터진","닥터_진"], "BP_DrJin / 닥터 진 디자인시트"),
    "Suhui": ("RationKitchen", ["suhui","suhee","수희"], "BP_Suhui / 수희 디자인시트"),
}


def npc(npc_id, location, yaw):
    cls = unreal.load_class(None, "/Script/HwanghonShelter.HHShelterNPC")
    if not cls:
        raise RuntimeError("HHShelterNPC class not found. Compile/enable plugin first.")

    bound_station, aliases, hint = NPC_INFO[npc_id]
    a = actor_sub.spawn_actor_from_class(cls, unreal.Vector(*location), unreal.Rotator(roll=0, pitch=0, yaw=yaw))
    mark(a, f"HH_NPC_{npc_id}")
    a.set_editor_property("npc_id", unreal.Name(npc_id))
    a.set_editor_property("bound_station_id", unreal.Name(bound_station))
    a.set_editor_property("design_asset_hint", unreal.Text(hint))

    bp_cls, bp_path = find_blueprint_class(aliases)
    if bp_cls:
        try:
            a.set_editor_property("visual_actor_class", bp_cls)
            unreal.log(f"[HH Shelter v2] {npc_id} visual -> {bp_path}")
        except Exception as exc:
            unreal.log_warning(f"[HH Shelter v2] could not bind BP for {npc_id}: {exc}")

    tex, tex_path = find_texture(aliases)
    if tex:
        try:
            a.set_editor_property("portrait_texture", tex)
            unreal.log(f"[HH Shelter v2] {npc_id} portrait -> {tex_path}")
        except Exception as exc:
            unreal.log_warning(f"[HH Shelter v2] could not bind portrait for {npc_id}: {exc}")

    try: a.rerun_construction_scripts()
    except Exception: pass
    return a


def desk(prefix, loc, yaw=0):
    cube(prefix+"_Desk", loc, (210,80,80), yaw)


def bench(prefix, loc, yaw=0):
    cube(prefix+"_Seat", loc, (160,45,45), yaw)


def training_dummy(loc):
    x,y,z=loc
    cylinder("HH_TrainingDummy_Body",(x,y,z+100),42,200)
    cube("HH_TrainingDummy_Arms",(x,y,z+170),(230,28,28))


def build():
    clear_previous()

    # ===== CENTRAL CORE =====
    room("HH_CentralCore",(0,0,0),(950,950,360))
    cube("HH_CentralCore_OpenFloor",(0,-80,-10),(900,900,20))
    light("HH_CoreLight",(0,0,245),800,620,(0.85,0.36,0.10,1))

    # ===== EXISTING DESIGN-SHEET AXES =====
    # Top: Matteo office / Party office
    corridor("HH_Corr_North",(0,420,0),(0,1100,0),340,310)
    room("HH_Room_01_PartyOffice",(0,1450,0),(900,650,340))
    room("HH_MatteoPrivateOffice",(0,2050,0),(610,430,310))
    corridor("HH_Corr_MatteoBack",(0,1740,0),(0,1850,0),240,290)

    # Left: rank + crafting, continuing toward outside/service corridor.
    corridor("HH_Corr_West",(-420,0,0),(-1120,0,0),340,310)
    room("HH_Room_02_Rank",(-1480,420,0),(760,580,340))
    room("HH_Room_03_Crafting",(-1480,-420,0),(760,580,340))

    # Right: training + request board, like the original training wing.
    corridor("HH_Corr_East",(420,0,0),(1120,0,0),340,310)
    room("HH_Room_04_Training",(1480,420,0),(900,650,360))
    room("HH_Room_05_Request",(1480,-420,0),(760,580,340))

    # South branch: living support spaces.
    corridor("HH_Corr_South",(0,-420,0),(0,-1180,0),340,310)
    room("HH_Room_06_Medical",(-520,-1500,0),(800,620,340))
    room("HH_Room_07_Ration",(520,-1500,0),(800,620,340))

    # External / deployment corridor from design sheet.
    corridor("HH_Corr_External",(0,-1750,0),(0,-2750,0),330,310)
    cube("HH_RollupShutter",(0,-2860,145),(650,34,290))
    cube("HH_ShutterTopHousing",(0,-2860,310),(690,70,90))

    # Bunker-to-bunker connector, blocked for later expansion.
    corridor("HH_Corr_BunkerLink",(1760,-420,0),(2460,-420,0),300,300)
    cube("HH_BunkerLinkBlocker",(2570,-420,140),(35,590,280))

    # ===== STATIONS + NPCs =====
    station("PartyOffice",1,(0,1190,85),0)
    npc("Matteo",(0,1490,0),180)

    station("RankAssessment",2,(-1190,420,85),90)
    npc("Yujin",(-1480,400,0),0)

    station("Crafting",3,(-1190,-420,85),90)
    npc("HanJangin",(-1480,-400,0),0)

    station("Training",4,(1190,420,85),-90)
    npc("OJeonggil",(1450,300,0),180)

    station("RequestBoard",5,(1190,-420,85),-90)
    npc("Duho",(1480,-400,0),180)

    station("MedicalBay",6,(-300,-1210,85),0)
    npc("DrJin",(-520,-1490,0),90)

    station("RationKitchen",7,(300,-1210,85),0)
    npc("Suhui",(520,-1490,0),-90)

    # ===== FUNCTION PROPS =====
    # Party office: queue benches + desks + old CRT proxy.
    desk("HH_PartyDeskA",(-220,1540,40),0)
    desk("HH_PartyDeskB",(220,1540,40),0)
    bench("HH_PartyBenchA",(-250,1280,25),0)
    bench("HH_PartyBenchB",(250,1280,25),0)
    cube("HH_CRT_Proxy",(250,1600,130),(55,40,45))

    # Rank: platform + console + numbered-wall proxy.
    cylinder("HH_RankPlatform",(-1480,420,8),110,16)
    desk("HH_RankConsole",(-1650,520,40),90)
    cube("HH_RankNumberWall",(-1480,705,170),(520,20,260))

    # Crafting: workbench, forge, weapon rack.
    desk("HH_CraftBench",(-1490,-330,40),0)
    cube("HH_Forge",(-1690,-570,70),(170,150,140))
    cube("HH_WeaponRack",(-1260,-675,150),(300,25,280))

    # Training: central dummy + target marks.
    training_dummy((1500,480,0))
    cylinder("HH_TrainingRing",(1500,420,5),250,10)

    # Request: board + desk.
    cube("HH_RequestBoard",(1480,-705,170),(560,24,260))
    desk("HH_RequestDesk",(1480,-470,40),0)

    # Medical: beds + cabinet.
    for i,x in enumerate((-700,-480,-260)):
        cube(f"HH_MedBed_{i}",(x,-1600,35),(170,70,50))
    cube("HH_MedCabinet",(-760,-1740,120),(120,50,230))

    # Ration: counter, shelves, prep table.
    desk("HH_RationCounter",(520,-1370,45),0)
    cube("HH_RationShelf",(760,-1740,140),(260,45,260))
    desk("HH_RationPrep",(300,-1660,40),0)

    # ===== LIGHTING =====
    for label,loc,col in [
        ("HH_L_Party",(0,1450,245),(1.0,0.48,0.16,1)),
        ("HH_L_Rank",(-1480,420,245),(0.55,0.75,1.0,1)),
        ("HH_L_Craft",(-1480,-420,245),(1.0,0.30,0.08,1)),
        ("HH_L_Training",(1480,420,255),(0.95,0.78,0.55,1)),
        ("HH_L_Request",(1480,-420,245),(0.85,0.60,0.28,1)),
        ("HH_L_Medical",(-520,-1500,245),(0.45,0.85,0.86,1)),
        ("HH_L_Ration",(520,-1500,245),(1.0,0.65,0.24,1)),
    ]:
        light(label,loc,900,500,col)

    # ===== PLAYER + MANAGER =====
    ps = actor_sub.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(0,-650,90), unreal.Rotator(roll=0, pitch=0, yaw=90))
    mark(ps,"HH_PlayerStart")

    mgr_cls = unreal.load_class(None, "/Script/HwanghonShelter.HHShelterHubManager")
    if not mgr_cls:
        raise RuntimeError("HHShelterHubManager class not found.")
    mark(actor_sub.spawn_actor_from_class(mgr_cls, unreal.Vector(0,0,0), unreal.Rotator()), "HH_HubManager")

    try:
        gm_cls = unreal.load_class(None, "/Script/HwanghonShelter.HHShelterDemoGameMode")
        world = unreal.EditorLevelLibrary.get_editor_world()
        if gm_cls and world:
            world.get_world_settings().set_editor_property("default_game_mode", gm_cls)
    except Exception as exc:
        unreal.log_warning(f"[HH Shelter v2] GameMode assignment skipped: {exc}")

    unreal.log("[HH Shelter v2] COMPLETE")
    unreal.log("[HH Shelter v2] F/Enter dialogue · E station service · ESC close")
    unreal.log("[HH Shelter v2] If imported NPC BP/portrait names matched, they were bound automatically.")


build()
