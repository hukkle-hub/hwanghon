"""Gangnam bunker (강남 벙커) starting town - built from the EP01 bunker design sheet and the novel (docs/design/155).

Layout = design sheet §06 «주요 구역 연결도»: an octagonal common core (공용 코어 / 메인 통로) with an arm on each face.
Facilities = the novel's (배급 줄 L277, 실종자 벽보 L285, 한 장인의 작업대 «통로 한쪽» L295, 각인 평가소 L393,
인력사무소 CRT 벽 L576, 지하 훈련장 «낡은 매트와 깨진 형광등» L658, 의무실 L4624, 관제실 계측기 L7368, 출격문 L3966).
Look = the sheet's materials (노후 콘크리트, 도장 철판, 녹슨 금속, 고무 바닥, 거친 천) and details (산업용 조명, 중후한 철제 문,
배선 & 파이프, 경고 표시, 핸드페인팅 표식, 임시 보수 구조물).

    N   마태오 직무실 (CRT wall, armchair, the control-room needle recorder)      - no station
    NW  인력사무소 (counter, boards)             01 PartyOffice / Matteo, 05 RequestBoard / Duho, return spawn
    NE  지하 훈련장 (mats, broken tubes, the scarecrow) 04 Training / OJeonggil
    E   각인 평가소 (the platform, the queue)     02 RankAssessment / Yujin
    SE  보급고 (ration counter, shelves, drum fire) 07 RationKitchen / Suhui
    S   비상 탈출구 corridor + side room 의무실   06 MedicalBay / DrJin
    SW  외부 통로 -> 출격문 (deployment gate)     first spawn HH_TownStart, missing-person wall
    W   B-2 연결 통로 (sealed; bedrolls - people live in the corridors)
    core                                          03 Crafting / HanJangin (a workbench on the way in), drum fires,
                                                  laundry lines, tables, the wall drawings

Every arm is built in its own frame (u = out of the core, v = across) and rotated onto its face, so openings are
built in, not carved. Map: /Game/Hwanghon/Maps/Hub/L_GangnamBunker_B1 (rebuilt in place; any other world refused).
python tools/shelter/make_textures.py; UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_shelter_materials.py"
UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_shelter_b1.py" -unattended -nullrhi
"""
import math
import os

import unreal

MAP = "/Game/Hwanghon/Maps/Hub/L_GangnamBunker_B1"
TAG = "HW_B1"
lib = unreal.EditorAssetLibrary
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
CUBE = unreal.load_asset("/Engine/BasicShapes/Cube.Cube")
CYL = unreal.load_asset("/Engine/BasicShapes/Cylinder.Cylinder")
CONE = unreal.load_asset("/Engine/BasicShapes/Cone.Cone")
SPHERE = unreal.load_asset("/Engine/BasicShapes/Sphere.Sphere")
SCARECROW = "/Game/Bosses/Training/boss_anim/SkeletalMeshes/boss_anim"   # the EP01 training scarecrow's body

T = 30.0            # wall thickness
R = 900.0           # core apothem (centre to face)
CORE_H = 700.0
FACE = 2 * R * math.tan(math.radians(22.5))   # 745
DOOR_H = 380.0
BAND_H = 150.0      # steel wainscot on the inside of every wall
# where the lit/dead glass sits on the Hi3D CRT model (across, forward from the back, height, width, height) - measured
CRT_GLASS = (0.0, 45.0, 17.0, 70.0, 48.0)   # the 70 cm model: glass 70 x 48, 45 cm in front of its centre
WARM = (1.0, 0.72, 0.45)
COOL = (0.62, 0.76, 1.0)
COUNT = {"actors": 0, "lights": 0, "flicker": 0}

# ------------------------------------------------------------------ materials (Scripts/ue_shelter_materials.py)
MAT_DIR = "/Game/Hwanghon/Shelter/Materials"
_mats = {}


def mat(name):
    if name not in _mats:
        path = f"{MAT_DIR}/MI_HW_B1_{name}"
        if not lib.does_asset_exist(path):
            raise RuntimeError(f"{path} missing - run Scripts/ue_shelter_materials.py first")
        _mats[name] = unreal.load_asset(path)
    return _mats[name]


# ------------------------------------------------------------------ frames and primitives
def mark(a, label):
    a.tags = [unreal.Name(TAG)]
    a.set_actor_label(label)
    COUNT["actors"] += 1
    return a


# UE is left-handed: seen from above with +X to the right, +Y points DOWN. The layout below is written like the sheet's
# map (+Y = up = north); MIRROR turns it into the world so the plan seen from above matches the sheet (and the room
# interiors keep their own left/right). The first build had it mirrored - the top-down shot showed it.
MIRROR = True


class Frame:
    """Local frame: origin o, u = forward (out of the core), v = across (to the right looking out), yaw of u."""

    def __init__(self, ox, oy, yaw, world=False):
        if MIRROR and not world:
            oy, yaw = -oy, -yaw
        self.o = (ox, oy)
        self.yaw = yaw
        r = math.radians(yaw)
        self.u = (math.cos(r), math.sin(r))
        self.v = (math.sin(r), -math.cos(r))

    def at(self, a, b):   # a across (v), b forward (u)
        return (self.o[0] + a * self.v[0] + b * self.u[0], self.o[1] + a * self.v[1] + b * self.u[1])

    def sub(self, a, b, dyaw=0.0):
        x, y = self.at(a, b)
        return Frame(x, y, self.yaw + dyaw, world=True)


def _mesh(mesh, loc, rot, scale, m, collide, label, shadow=True):
    act = eas.spawn_actor_from_object(mesh, loc, rot)
    act.set_actor_scale3d(scale)
    c = act.static_mesh_component
    c.set_material(0, mat(m) if isinstance(m, str) else m)
    if not collide:
        c.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
    c.set_editor_property("cast_shadow", shadow)
    return mark(act, label)


def box(label, f, a, b, z, across, along, height, m="concrete", collide=True, dyaw=0.0, roll=0.0, pitch=0.0):
    """Box centred at (a, b) in frame f, bottom at z. across = size on v, along = size on u."""
    x, y = f.at(a, b)
    return _mesh(CUBE, unreal.Vector(x, y, z + height / 2), unreal.Rotator(roll=roll, pitch=pitch, yaw=f.yaw + dyaw),
                 unreal.Vector(along / 100.0, across / 100.0, height / 100.0), m, collide, label, shadow=height > 40)


def vcyl(label, x, y, z, radius, height, m="rust", collide=True):
    return _mesh(CYL, unreal.Vector(x, y, z + height / 2), unreal.Rotator(roll=0, pitch=0, yaw=0),
                 unreal.Vector(radius / 50.0, radius / 50.0, height / 100.0), m, collide, label)


def hbar(label, f, a, b0, b1, z, radius, m="steel"):
    """A horizontal pipe/cable along u from b0 to b1, at across a, centre height z (no collision - it is overhead)."""
    x, y = f.at(a, (b0 + b1) / 2)
    return _mesh(CYL, unreal.Vector(x, y, z), unreal.Rotator(roll=0, pitch=90, yaw=f.yaw),
                 unreal.Vector(radius / 50.0, radius / 50.0, abs(b1 - b0) / 100.0), m, False, label, shadow=False)


def sign(label, f, a, b, z, key, width, height, facing=-1):
    """A painted plate on a wall across f at forward b; facing = -1 reads from the -u side (the core side)."""
    g = f if facing < 0 else f.sub(0, 0, 180)
    bb = b if facing < 0 else -b
    aa = a if facing < 0 else -a
    return box(label, g, aa, bb, z, width, 4, height, f"sign_{key}", collide=False)


def light(label, x, y, z, intensity=5000.0, radius=900.0, color=WARM, ceil=None, fixture="cage", shadows=False,
          flicker=False):
    """A point light (candela = intensity x 0.05) and, unless fixture is None, the lamp that makes it: a cable from the
    ceiling, a steel shade, an emissive bulb (산업용 조명 - the sheet's cage lamps). flicker: tagged HW_Flicker, so
    UHWLampFlickerSubsystem dips it at a steady interval (통합본 L253 «조명이 일정 간격으로 명멸했다. 발전기가 늙었다»)."""
    a = eas.spawn_actor_from_class(unreal.PointLight, unreal.Vector(x, y, z), unreal.Rotator(roll=0, pitch=0, yaw=0))
    c = a.point_light_component
    c.set_mobility(unreal.ComponentMobility.MOVABLE)
    c.set_editor_property("intensity", intensity * 0.05)
    c.set_editor_property("attenuation_radius", radius)
    c.set_editor_property("light_color", unreal.LinearColor(*color, 1).to_color(True))
    c.set_editor_property("cast_shadows", shadows)
    mark(a, label)
    if flicker:
        a.tags = [unreal.Name(TAG), unreal.Name("HW_Flicker")]
        COUNT["flicker"] += 1
    COUNT["lights"] += 1
    if fixture and ceil:
        _mesh(CYL, unreal.Vector(x, y, (z + 30 + ceil) / 2), unreal.Rotator(roll=0, pitch=0, yaw=0),
              unreal.Vector(0.03, 0.03, max(ceil - z - 30, 1) / 100.0), "dark", False, label + "_Cable", shadow=False)
        _mesh(CONE, unreal.Vector(x, y, z + 18), unreal.Rotator(roll=0, pitch=0, yaw=0), unreal.Vector(0.45, 0.45, 0.28),
              "steel", False, label + "_Shade", shadow=False)
        _mesh(SPHERE, unreal.Vector(x, y, z + 2), unreal.Rotator(roll=0, pitch=0, yaw=0), unreal.Vector(0.16, 0.16, 0.16),
              "lamp", False, label + "_Bulb", shadow=False)
    return a


def wall_with_openings(label, f, b, span, height, openings, m="concrete", thick=T, bands=(), frames=(), band_h=BAND_H):
    """A wall across frame f at forward distance b, from a=-span/2..span/2, with openings [(a_centre, width, top)].
    bands: sides (-1 = the -u face, +1 = the +u face) that get the steel wainscot; frames: sides that get door frames."""
    cuts = sorted(openings)
    x0 = -span / 2
    for i, (ac, w, top) in enumerate(cuts + [(span / 2 + 1e6, 0, 0)]):
        x1 = min(ac - w / 2, span / 2)
        if x1 - x0 > 2:
            box(f"{label}_{i}", f, (x0 + x1) / 2, b, 0, x1 - x0, thick, height, m)
            for s in bands:
                box(f"{label}_{i}_Band{s:+d}", f, (x0 + x1) / 2, b + s * (thick / 2 + 2), 0, x1 - x0 - 2, 4, band_h, "steel", collide=False)
        if w and top < height:
            box(f"{label}_{i}_Lintel", f, ac, b, top, w, thick, height - top, m)
        if w and ac < span / 2:
            for s in frames:   # heavy steel frame round the opening (중후한 철제 문 / door frames)
                for e in (-1, 1):
                    box(f"{label}_{i}_Post{s:+d}{e:+d}", f, ac + e * (w / 2 + 8), b + s * (thick / 2 + 6), 0, 18, 12, top, "steel", collide=False)
                box(f"{label}_{i}_Head{s:+d}", f, ac, b + s * (thick / 2 + 6), top, w + 34, 12, 22, "hazard" if top > 420 else "steel", collide=False)
        x0 = ac + w / 2


def side_wall(label, f, a, b0, b1, height, openings, m="concrete", inner=0, frames=False):
    """A wall along u at across-offset a, from b0 to b1, with openings [(b_centre, width, top)].
    inner: +1 if the room lies on the +v side of the wall, -1 on the -v side (gets the wainscot)."""
    g = f.sub(a, (b0 + b1) / 2, 90)   # g.u = -f.v, g.v = f.u
    ops = [(bc - (b0 + b1) / 2, w, top) for bc, w, top in openings]
    bands = (-inner,) if inner else ()
    wall_with_openings(label, g, 0, b1 - b0, height, ops, m, bands=bands, frames=((-inner, inner) if frames else ()))


# ------------------------------------------------------------------ the plugin's actors
def station(station_id, number, x, y, yaw):
    cls = unreal.load_class(None, "/Script/HwanghonShelter.HHShelterStation")
    a = eas.spawn_actor_from_class(cls, unreal.Vector(x, y, 85), unreal.Rotator(roll=0, pitch=0, yaw=yaw))
    a.set_editor_property("station_id", unreal.Name(station_id))
    a.set_editor_property("station_number", number)
    # the spawn already filled the names from the default id (SetIfEmpty never replaces them): empty them so the
    # construction that each edit triggers fills this station's own
    for k in ("display_name", "english_name", "interaction_label"):
        a.set_editor_property(k, unreal.Text(""))
    hide_text(a)
    return mark(a, f"HH_Station_{number:02d}_{station_id}")


def hide_text(a):
    """The plugin's TextRender name plates use a font without Hangul (the Korean line is boxes): hidden - the HUD
    prompt and the painted signs carry the names."""
    for c in a.get_components_by_class(unreal.TextRenderComponent):
        c.set_visibility(False)


NPC_STATION = {"Matteo": "PartyOffice", "Yujin": "RankAssessment", "HanJangin": "Crafting", "OJeonggil": "Training",
               "Duho": "RequestBoard", "DrJin": "MedicalBay", "Suhui": "RationKitchen"}


def npc(npc_id, x, y, yaw):
    cls = unreal.load_class(None, "/Script/HwanghonShelter.HHShelterNPC")
    a = eas.spawn_actor_from_class(cls, unreal.Vector(x, y, 0), unreal.Rotator(roll=0, pitch=0, yaw=yaw))
    a.set_editor_property("npc_id", unreal.Name(npc_id))
    a.set_editor_property("bound_station_id", unreal.Name(NPC_STATION[npc_id]))
    tex = f"/Game/Hwanghon/UI/NPC/T_{npc_id}_Portrait"
    if lib.does_asset_exist(tex):
        a.set_editor_property("portrait_texture", unreal.load_asset(tex))
    hide_text(a)
    return mark(a, f"HH_NPC_{npc_id}")


def player_start(label, tag, x, y, yaw):
    a = eas.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(x, y, 110), unreal.Rotator(roll=0, pitch=0, yaw=yaw))
    a.set_editor_property("player_start_tag", unreal.Name(tag))
    return mark(a, label)


def face_yaw(f, a, b, ta, tb):
    """Yaw at (a, b) in f looking toward (ta, tb) in f."""
    x0, y0 = f.at(a, b)
    x1, y1 = f.at(ta, tb)
    return math.degrees(math.atan2(y1 - y0, x1 - x0))


def view(name, f, a, b, ta, tb, z=170.0, pitch=-4.0):
    """A QA camera spot (-HWQA=sheltertour): a TargetPoint tagged HW_View / View_<name>."""
    x, y = f.at(a, b)
    t = eas.spawn_actor_from_class(unreal.TargetPoint, unreal.Vector(x, y, z), unreal.Rotator(roll=0, pitch=pitch, yaw=face_yaw(f, a, b, ta, tb)))
    t.tags = [unreal.Name(TAG), unreal.Name("HW_View"), unreal.Name(f"View_{name}")]
    t.set_actor_label(f"HW_View_{name}")
    return t


# ------------------------------------------------------------------ Hi3D hero props (Scripts/ue_shelter_props.py)
PROP_DIR = "/Game/Hwanghon/Shelter/Props"
# yaw that turns each model's own front to +u of the frame it is placed in (measured from the preview renders)
# every model's front is its GLB's -Y (Blender preview), which UE imports as +Y - the boss bodies turn -90 for the same
# reason (DefaultGame.ini MeshYaw=-90)
PROP_YAW = {"armchair": -90.0, "recorder": -90.0, "workbench": -90.0, "crt": -90.0, "drum": -90.0, "vault": -90.0}
_props = {}


def prop_mesh(pid):
    if pid not in _props:
        folder = f"{PROP_DIR}/{pid}"
        mesh = None
        if lib.does_directory_exist(folder):
            for path in lib.list_assets(folder, recursive=True, include_folder=False):
                a = unreal.load_asset(path)
                if isinstance(a, unreal.StaticMesh):
                    mesh = a
                    break
        _props[pid] = mesh
    return _props[pid]


def hero(pid, label, f, a, b, z=0.0, face=0.0, collide=True):
    """The Hi3D prop pid at (a, b) in f, its front turned to f's u + face degrees. None if it is not imported yet
    (the caller then builds its graybox stand-in)."""
    mesh = prop_mesh(pid)
    if not mesh:
        return None
    x, y = f.at(a, b)
    act = eas.spawn_actor_from_object(mesh, unreal.Vector(x, y, z), unreal.Rotator(roll=0, pitch=0, yaw=f.yaw + face + PROP_YAW[pid]))
    if not collide:
        act.static_mesh_component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
    return mark(act, label)


# ------------------------------------------------------------------ props (graybox-kit, material-dressed)
def crate(label, f, a, b, z=0, s=110, h=None, dyaw=0):
    box(label, f, a, b, z, s, s, h or s, "wood", dyaw=dyaw)
    box(label + "_Band", f, a, b, z + (h or s) * 0.45, s + 4, s + 4, 10, "rust", collide=False, dyaw=dyaw)


def drum(label, x, y, fire=False):
    if not hero("drum", label, Frame(x, y, (x * 7 + y * 3) % 360, world=True), 0, 0):
        vcyl(label, x, y, 0, 30, 90, "rust")
        for zz in (20, 68):
            vcyl(label + f"_Rib{zz}", x, y, zz, 31.5, 4, "steel", collide=False)
    if fire:   # 드럼통에 지핀 불 (L261)
        vcyl(label + "_Embers", x, y, 86, 26, 5, "lamp", collide=False)
        light(label + "_Glow", x, y, 150, 3000, 650, color=(1.0, 0.45, 0.14), fixture=None)


def table(label, f, a, b, w=240, d=100, m="wood"):
    box(label + "_Top", f, a, b, 72, w, d, 6, m)
    for ea in (-1, 1):
        for eb in (-1, 1):
            box(label + f"_Leg{ea}{eb}", f, a + ea * (w / 2 - 8), b + eb * (d / 2 - 8), 0, 6, 6, 72, "steel", collide=False)


def bench(label, f, a, b, w=200):
    box(label, f, a, b, 0, w, 40, 45, "wood")


def shelf(label, f, a, b, w=200, d=50, h=220, full=True):
    for ea in (-1, 1):
        for eb in (-1, 1):
            box(label + f"_Post{ea}{eb}", f, a + ea * (w / 2 - 3), b + eb * (d / 2 - 3), 0, 5, 5, h, "steel", collide=False)
    for k, zz in enumerate((15, 80, 145, 210)):
        box(label + f"_Board{k}", f, a, b, zz, w, d, 4, "steel", collide=k == 0)
        if full and zz < 200:
            for j in range(int(w // 60)):
                box(label + f"_Box{k}_{j}", f, a - w / 2 + 35 + j * 60, b, zz + 4, 50, d - 12, 40 + (j * 7 + k * 11) % 20, "canvas" if (j + k) % 3 else "wood", collide=False)


def bedroll(label, f, a, b, dyaw=0):
    box(label, f, a, b, 0, 80, 190, 10, "canvas", collide=False, dyaw=dyaw)
    box(label + "_Pillow", f, a, b + 80, 10, 50, 25, 10, "canvas", collide=False, dyaw=dyaw)


def cot(label, f, a, b):
    box(label + "_Mattress", f, a, b, 45, 85, 195, 12, "canvas")
    for eb in (-1, 1):
        box(label + f"_Rail{eb}", f, a, b + eb * 95, 0, 85, 5, 55, "steel", collide=False)


def post_rope(label, f, a, b0, b1, n=4):
    """Queue posts with a rope (the lines in front of the ration counter and the assessment office)."""
    for k in range(n):
        b = b0 + (b1 - b0) * k / (n - 1)
        x, y = f.at(a, b)
        vcyl(f"{label}_Post{k}", x, y, 0, 5, 95, "steel", collide=False)
    hbar(label + "_Rope", f, a, b0, b1, 88, 1.5, "canvas")


def laundry(label, f, a, b0, b1, z=320):
    hbar(label + "_Line", f, a, b0, b1, z, 1.2, "dark")
    k = 0
    b = b0 + 40
    while b < b1 - 60:
        w = 30 + (k * 37) % 30
        h = 40 + (k * 17) % 35
        box(f"{label}_Cloth{k}", f, a, b + w / 2, z - h, 2, w, h, ("cloth_a", "cloth_b", "cloth_c")[k % 3], collide=False)
        b += w + 45 + (k * 29) % 60
        k += 1


def girders(label, f, b0, b1, width, ceil, step=300):
    b = b0 + step / 2
    k = 0
    while b < b1:
        box(f"{label}_Girder{k}", f, 0, b, ceil - 28, width, 18, 28, "girder", collide=False)
        b += step
        k += 1


def pipes(label, f, b0, b1, across, ceil):
    """배선 & 파이프: two pipes on one wall, a cable tray on the other."""
    hbar(label + "_PipeA", f, across - 25, b0, b1, ceil - 45, 11, "rust")
    hbar(label + "_PipeB", f, across - 55, b0, b1, ceil - 38, 6, "steel")
    hbar(label + "_Cable1", f, -across + 18, b0, b1, ceil - 30, 2.5, "dark")
    hbar(label + "_Cable2", f, -across + 24, b0, b1, ceil - 36, 2.0, "dark")
    hbar(label + "_Cable3", f, -across + 14, b0, b1, ceil - 40, 3.0, "dark")


# ------------------------------------------------------------------ layout
# arm: face angle (deg, 0 = +X east, 90 = +Y north), corridor length/width/height, room width (across)/depth/height
ARMS = {
    "Matteo":    dict(angle=90,  L=300,  W=360, H=DOOR_H, room=(1000, 800, 420), sign=None),
    "Manpower":  dict(angle=135, L=300,  W=360, H=DOOR_H, room=(1200, 1000, 420), sign="manpower"),
    "Training":  dict(angle=45,  L=300,  W=360, H=DOOR_H, room=(1600, 1400, 600), sign="training"),
    "Rank":      dict(angle=0,   L=300,  W=320, H=DOOR_H, room=(900, 800, 400), sign="rank"),
    "Supply":    dict(angle=315, L=300,  W=360, H=DOOR_H, room=(1300, 1000, 450), sign="supply"),
    "Emergency": dict(angle=270, L=1500, W=300, H=340,    room=(500, 500, 900), sign="exit",
                      side=dict(at=700, side=+1, W=900, D=800, H=380, door=200)),
    "External":  dict(angle=225, L=2200, W=420, H=460,    room=None, sign="b1"),
    "B2Link":    dict(angle=180, L=1800, W=360, H=400,    room=None, sign="b2"),
}


def arm_frames():
    out = {}
    for name, arm in ARMS.items():
        ang = math.radians(arm["angle"])
        out[name] = Frame(R * math.cos(ang), R * math.sin(ang), arm["angle"])
    return out


def build_core():
    c = Frame(0, 0, 0)
    # the octagon = a square and the same square turned 45 deg (apothem R each); same material, so the overlap is invisible
    for k, cf in enumerate((c, Frame(0, 0, 45))):
        box(f"Core_Floor_{k}", cf, 0, 0, -24, 2 * R, 2 * R, 24, "floor")
        box(f"Core_Ceiling_{k}", cf, 0, 0, CORE_H, 2 * R, 2 * R, 24, "concrete")
    by_angle = {arm["angle"]: (name, arm) for name, arm in ARMS.items()}
    for i in range(8):
        ang = i * 45
        f = Frame(R * math.cos(math.radians(ang)), R * math.sin(math.radians(ang)), ang)
        name, arm = by_angle.get(ang, (None, None))
        openings = [(0, arm["W"], arm["H"])] if arm else []
        wall_with_openings(f"Core_Face{ang:03d}", f, T / 2, FACE + 40, CORE_H, openings, "concrete", bands=(-1,), frames=(-1,), band_h=420)
        # a pipe run along every face, high up (the sheet's hall is full of them)
        g = f.sub(0, -20, -90)   # g.u runs along the face
        hbar(f"Core_Face{ang:03d}_Pipe", g, 0, -FACE / 2 - 20, FACE / 2 + 20, CORE_H - 90, 14, "rust")
        hbar(f"Core_Face{ang:03d}_Pipe2", g, 0, -FACE / 2 - 20, FACE / 2 + 20, CORE_H - 130, 7, "steel")
        if arm and arm.get("sign"):
            sign(f"Core_Sign_{name}", f, 0, -6, arm["H"] + 60, arm["sign"], min(arm["W"] + 80, 460), 110)
    # ceiling grid of girders
    for k in range(-3, 4):
        box(f"Core_GirderX{k}", c, 0, k * 280, CORE_H - 34, 2 * R, 22, 34, "girder", collide=False)
        box(f"Core_GirderY{k}", c, k * 280, 0, CORE_H - 34, 22, 2 * R, 34, "girder", collide=False)
    light("Core_Light_C", 0, 0, CORE_H - 160, 9000, 1700, ceil=CORE_H - 34)
    for i in range(4):
        a = math.radians(45 + 90 * i)
        light(f"Core_Light_{i}", 560 * math.cos(a), 560 * math.sin(a), CORE_H - 200, 3500, 900, ceil=CORE_H - 34)


def build_arm(name, arm):
    ang = math.radians(arm["angle"])
    f = Frame(R * math.cos(ang), R * math.sin(ang), arm["angle"])
    L, W, H = arm["L"], arm["W"], arm["H"]
    box(f"{name}_Corr_Floor", f, 0, L / 2, -24, W + 2 * T, L + T, 24, "floor")
    box(f"{name}_Corr_Ceiling", f, 0, L / 2, H, W + 2 * T, L + T, 24, "concrete")
    side = arm.get("side")
    for s in (-1, +1):
        ops = [(side["at"], side["door"], 260)] if side and side["side"] == s else []
        side_wall(f"{name}_Corr_Wall{'R' if s > 0 else 'L'}", f, s * (W / 2 + T / 2), 0, L, H, ops, inner=-s, frames=bool(ops))
    girders(f"{name}_Corr", f, 0, L, W, H)
    pipes(f"{name}_Corr", f, 0, L, W / 2, H)
    for k in range(max(1, int(L // 600))):
        b = min(300 + 600 * k, L - 100)
        x, y = f.at(0, b)
        light(f"{name}_Corr_Light_{k}", x, y, H - 90, 2500, 750, ceil=H - 28, flicker=True)   # the passages, not the rooms
    room = arm.get("room")
    if room:
        rw, rd, rh = room
        box(f"{name}_Floor", f, 0, L + rd / 2, -24, rw + 2 * T, rd + T, 24, "floor")
        box(f"{name}_Ceiling", f, 0, L + rd / 2, rh, rw + 2 * T, rd + T, 24, "concrete")
        wall_with_openings(f"{name}_Front", f, L + T / 2, rw + 2 * T, rh, [(0, W, H)], "concrete", bands=(1,), frames=(1,))
        wall_with_openings(f"{name}_Back", f, L + rd + T / 2, rw + 2 * T, rh, [], "concrete", bands=(-1,))
        for s in (-1, +1):
            side_wall(f"{name}_Side{'R' if s > 0 else 'L'}", f, s * (rw / 2 + T / 2), L, L + rd, rh, [], inner=-s)
        girders(f"{name}_Room", f, L, L + rd, rw, rh, 350)
        pipes(f"{name}_Room", f, L, L + rd, rw / 2, rh)
        x, y = f.at(0, L + rd / 2)
        light(f"{name}_Light", x, y, rh - 110, 6000, max(rw, rd) * 1.1, ceil=rh - 28)
    if side:
        g = f.sub(side["side"] * (W / 2 + T), side["at"], -90 * side["side"])   # u of g points out of the corridor side
        sw, sd, sh = side["W"], side["D"], side["H"]
        box(f"{name}_SideRoom_Floor", g, 0, sd / 2, -24, sw + 2 * T, sd + T, 24, "floor")
        box(f"{name}_SideRoom_Ceiling", g, 0, sd / 2, sh, sw + 2 * T, sd + T, 24, "concrete")
        wall_with_openings(f"{name}_SideRoom_Back", g, sd + T / 2, sw + 2 * T, sh, [], "concrete", bands=(-1,))
        for s in (-1, +1):
            side_wall(f"{name}_SideRoom_Side{'R' if s > 0 else 'L'}", g, s * (sw / 2 + T / 2), 0, sd, sh, [], inner=-s)
        pipes(f"{name}_SideRoom", g, 0, sd, sw / 2, sh)
        x, y = g.at(0, sd / 2)
        light(f"{name}_SideRoom_Light", x, y, sh - 100, 5000, max(sw, sd) * 1.1, color=COOL, ceil=sh - 28)
    else:
        g = None
    if not room:   # a corridor that ends: an end wall (the gate or a sealed door goes on it)
        wall_with_openings(f"{name}_End", f, L + T / 2, W + 2 * T, H, [], "steel")
    return f, g


def build_places(F, side_frames):
    # ---- 인력사무소 (NW) «STAFFING OFFICE»: counter across the room, Matteo behind it; boards on the walls
    # (sheet 02: 게시판과 기록 보관함이 벽면을 가득 채우고 있다); the return spawn faces Matteo (v6)
    f, L = F["Manpower"], ARMS["Manpower"]["L"]
    rw, rd, _ = ARMS["Manpower"]["room"]
    box("Manpower_Counter", f, 0, L + 520, 0, 700, 70, 100, "steel")
    box("Manpower_CounterTop", f, 0, L + 520, 100, 720, 84, 6, "wood")
    x, y = f.at(0, L + 420)
    station("PartyOffice", 1, x, y, face_yaw(f, 0, L + 420, 0, 0))
    x, y = f.at(0, L + 700)
    npc("Matteo", x, y, face_yaw(f, 0, L + 700, 0, 0))
    x, y = f.at(-560, L + 450)
    station("RequestBoard", 5, x, y, face_yaw(f, -560, L + 450, 0, L + 450))
    for k, bb in enumerate((L + 250, L + 520, L + 790)):
        box(f"Manpower_BoardL{k}", f, -rw / 2 + 6, bb, 90, 8, 240, 180, "paper", collide=False)
        box(f"Manpower_BoardR{k}", f, rw / 2 - 6, bb, 90, 8, 240, 180, "paper", collide=False)
    for k in range(4):   # 기록 보관함 - filing cabinets along the back wall
        box(f"Manpower_Cabinet{k}", f, -450 + k * 120, L + rd - 35, 0, 100, 60, 180, "steel")
    table("Manpower_Desk", f, 250, L + 800, 200, 90)
    x, y = f.at(-420, L + 300)
    npc("Duho", x, y, face_yaw(f, -420, L + 300, 0, L + 300))
    for k, a in enumerate((0, -120, 120, -240)):   # a party of up to four comes back together
        x, y = f.at(a, L + 160)
        player_start(f"HH_PlayerStart_ManpowerOfficeReturn{k}", "HH_ManpowerOffice_Return", x, y, face_yaw(f, a, L + 160, 0, L + 700))
    x, y = f.at(250, L + 800)
    light("Manpower_DeskLamp", x, y, 110, 400, 300, fixture=None)

    # ---- 마태오 직무실 (N): CRT wall on the back wall - half dead (L579), one at the lower right loops the same
    # clip (L583, sheet 01 «반복 재생 영상»); his armchair with its back to the screens (L596); the needle recorder
    f, L = F["Matteo"], ARMS["Matteo"]["L"]
    for r in range(3):
        for k in range(7):
            live = (r * 7 + k) % 2 == 0
            loop = (r == 0 and k == 6)
            a, zz = -390 + k * 130, 80 + r * 95
            if hero("crt", f"Matteo_CRT_{r}_{k}", f, a, L + 745, zz, face=180, collide=False):   # screens face into the room
                box(f"Matteo_CRT_{r}_{k}_Glass", f, a + CRT_GLASS[0], L + 745 - CRT_GLASS[1], zz + CRT_GLASS[2], CRT_GLASS[3], 2, CRT_GLASS[4],
                    "lamp" if loop else ("screen" if live else "dark"), collide=False)
            else:
                box(f"Matteo_CRT_{r}_{k}", f, a, L + 745, zz, 115, 70, 88, "dark", collide=False)
                box(f"Matteo_CRT_{r}_{k}_Glass", f, a, L + 708, zz + 10, 92, 3, 68, "lamp" if loop else ("screen" if live else "dark"), collide=False)
    box("Matteo_Desk", f, 0, L + 560, 0, 520, 110, 78, "wood")
    # his back to the screens (L596 «마태오는 그 화면을 등지고 앉아 있었다»): the chair faces the door
    if not hero("armchair", "Matteo_Armchair", f, 0, L + 420, face=180):
        box("Matteo_Armchair_Seat", f, 0, L + 420, 0, 90, 85, 45, "canvas")
        box("Matteo_Armchair_Back", f, 0, L + 460, 45, 90, 18, 70, "canvas")
        for e in (-1, 1):
            box(f"Matteo_Armchair_Arm{e}", f, e * 50, L + 420, 45, 12, 80, 25, "canvas", collide=False)
    if not hero("recorder", "Matteo_Recorder", f, 380, L + 200, face=90):   # its paper faces the room
        box("Matteo_Recorder", f, 380, L + 200, 0, 90, 70, 120, "steel")
        vcyl("Matteo_Recorder_Roll", *f.at(380, L + 200), 122, 18, 25, "canvas", collide=False)
    box("Matteo_Map", f, -498, L + 400, 110, 6, 420, 200, "paper", collide=False)
    light("Matteo_ScreenGlow", *f.at(0, L + 600), 180, 1200, 700, color=(0.55, 1.0, 0.7), fixture=None)

    # ---- 지하 훈련장 (NE): «낡은 매트와 깨진 형광등이 전부» (L658); the scarecrow (sheet 03, EP01's boss)
    f, L = F["Training"], ARMS["Training"]["L"]
    rw, rd, rh = ARMS["Training"]["room"]
    for i in range(3):
        for j in range(2):
            box(f"Training_Mat_{i}_{j}", f, -400 + i * 400, L + 450 + j * 450, 0, 380, 420, 6, "mat", collide=False)
    for k in range(4):   # fluorescent tubes on chains: two work, one flickers dark, one hangs broken
        a, bb = -450 + k * 300, L + 700
        broken = k == 2
        box(f"Training_Tube{k}", f, a, bb, rh - 150 - (60 if broken else 0), 20, 140, 8,
            "dark" if broken or k == 3 else "lamp", collide=False, pitch=25 if broken else 0)
        if not broken and k != 3:
            x, y = f.at(a, bb)
            light(f"Training_TubeLight{k}", x, y, rh - 170, 3000, 900, color=(0.85, 0.95, 1.0), fixture=None)
    if lib.does_asset_exist(SCARECROW):
        x, y = f.at(0, L + 1000)
        sk = eas.spawn_actor_from_class(unreal.SkeletalMeshActor, unreal.Vector(x, y, 0), unreal.Rotator(roll=0, pitch=0, yaw=face_yaw(f, 0, L + 1000, 0, 0) - 90))
        sk.skeletal_mesh_component.set_skinned_asset_and_update(unreal.load_asset(SCARECROW))
        sk.set_actor_scale3d(unreal.Vector(0.85, 0.85, 0.85))
        mark(sk, "Training_Scarecrow")
        vcyl("Training_Scarecrow_Collider", x, y, 0, 45, 230, "wood").static_mesh_component.set_visibility(False)
    for k in range(3):   # weapon racks on the side wall
        box(f"Training_Rack{k}", f, rw / 2 - 30, L + 300 + k * 300, 0, 40, 200, 160, "wood")
    x, y = f.at(560, L + 250)
    station("Training", 4, x, y, face_yaw(f, 560, L + 250, 0, L + 700))
    x, y = f.at(420, L + 420)
    npc("OJeonggil", x, y, face_yaw(f, 420, L + 420, 0, L + 700))

    # ---- 각인 평가소 (E): the platform (L425 «발판 위로»), Yujin's desk; the queue in front (L8777)
    f, L = F["Rank"], ARMS["Rank"]["L"]
    x, y = f.at(0, L + 380)
    vcyl("Rank_Platform", x, y, 0, 110, 14, "steel", collide=False)
    vcyl("Rank_PlatformRing", x, y, 14, 90, 2, "hazard", collide=False)
    box("Rank_Instrument", f, 180, L + 380, 0, 50, 50, 170, "steel")
    box("Rank_Desk", f, 0, L + 620, 0, 360, 90, 85, "steel")
    box("Rank_Ledger", f, -60, L + 620, 85, 50, 35, 6, "paper", collide=False)
    x, y = f.at(-250, L + 250)
    station("RankAssessment", 2, x, y, face_yaw(f, -250, L + 250, 0, L + 400))
    x, y = f.at(0, L + 700)
    npc("Yujin", x, y, face_yaw(f, 0, L + 700, 0, 0))
    post_rope("Rank_Queue", f, 110, 20, 260, 4)

    # ---- 보급고 (SE): the ration counter (L277), shelves and crates, the line and its drum fire
    f, L = F["Supply"], ARMS["Supply"]["L"]
    rw, rd, _ = ARMS["Supply"]["room"]
    box("Supply_Counter", f, 0, L + 480, 0, 800, 80, 100, "steel")
    box("Supply_CounterTop", f, 0, L + 480, 100, 820, 90, 5, "wood")
    for k in range(4):
        shelf(f"Supply_Shelf{k}", f, -480 + k * 320, L + 930, 260, 50, 220)
    for k in range(3):
        crate(f"Supply_Crate{k}", f, rw / 2 - 90, L + 620 + k * 125, 0, 110)
    crate("Supply_CrateTop", f, rw / 2 - 90, L + 620, 110, 100)
    x, y = f.at(0, L + 380)
    station("RationKitchen", 7, x, y, face_yaw(f, 0, L + 380, 0, 0))
    x, y = f.at(0, L + 620)
    npc("Suhui", x, y, face_yaw(f, 0, L + 620, 0, 0))
    drum("Supply_Drum", *f.at(-480, L + 180), fire=True)
    post_rope("Supply_Line", f, -200, -100, 280, 5)

    # ---- 의무실 (S corridor side room): cots, a medicine cabinet, a curtain; cool light
    g = side_frames["Emergency"]
    for k in range(3):
        cot(f"Medical_Cot{k}", g, -300 + k * 300, 560)
    box("Medical_Cabinet", g, 380, 150, 0, 60, 120, 190, "steel")
    hbar("Medical_CurtainRail", g, 150, 280, 560, 215, 1.5, "steel")
    for k in range(5):   # a curtain in folds, not a board
        box(f"Medical_Curtain{k}", g, 150 + (k % 2) * 6, 300 + k * 55, 30, 3, 50, 180, "cloth_c", collide=False, dyaw=(k % 2) * 14 - 7)
    x, y = g.at(-300, 200)
    station("MedicalBay", 6, x, y, face_yaw(g, -300, 200, 0, 400))
    x, y = g.at(150, 330)
    npc("DrJin", x, y, face_yaw(g, 150, 330, 0, 0))
    f, L = F["Emergency"], ARMS["Emergency"]["L"]
    for k in range(18):   # the ladder up the shaft
        box(f"Emergency_Rung{k}", f, 0, L + 470, 20 + k * 45, 60, 6, 4, "rust", collide=False)
    for e in (-1, 1):
        box(f"Emergency_Rail{e}", f, e * 32, L + 470, 0, 5, 6, 850, "rust", collide=False)
    box("Emergency_Hatch", f, 0, L + 250, 880, 180, 180, 10, "hazard", collide=False)

    # ---- 외부 통로 (SW) -> 출격문. The gate's party volume lies toward the core (its local +Y).
    f, L = F["External"], ARMS["External"]["L"]
    W = ARMS["External"]["W"]
    gx, gy = f.at(0, L - 60)
    gate_cls = unreal.load_class(None, "/Script/HwanghonShelter.HHDeploymentGate")
    gate = eas.spawn_actor_from_class(gate_cls, unreal.Vector(gx, gy, 0), unreal.Rotator(roll=0, pitch=0, yaw=f.yaw + 90))
    mark(gate, "HH_DeploymentGate")
    sign("External_GateSign", f.sub(0, 0, 0), 0, L - 12, 330, "gate", 260, 70)
    for e in (-1, 1):   # hazard posts either side of the shutter
        box(f"External_GatePost{e}", f, e * (W / 2 - 20), L - 60, 0, 30, 40, 330, "hazard", collide=False)
    for k, (a, bb) in enumerate(((0, L - 1100), (-110, L - 1100), (110, L - 1100), (0, L - 1220))):
        x, y = f.at(a, bb)
        player_start(f"HH_PlayerStart_TownStart{k}", "HH_TownStart", x, y, face_yaw(f, a, bb, 0, 0))
    # the missing-person wall right inside (L285: «벽 한 면은 실종자 벽보로 덮여»)
    box("External_MissingPosters", f, -(W / 2 - 8), 700, 60, 10, 1100, 250, "paper", collide=False)
    for k in range(4):   # sandbags and rubble by the gate: the outside is close (sheet 04 «낙석 위험 구간»)
        box(f"External_Sandbag{k}", f, W / 2 - 40, L - 900 + k * 70, 0, 50, 60, 40 + (k % 2) * 25, "canvas")   # hugs the wall: the gate walk is x +-80
    for k in range(3):
        box(f"External_Rubble{k}", f, -W / 2 + 38, L - 450 - k * 60, 0, 45, 50, 35, "concrete", dyaw=17 * k)
    for k in range(3):
        x, y = f.at(0, 400 + k * 700)
        light(f"External_Light_{k}", x, y, 360, 1600 if k < 2 else 700, 700, color=(0.9, 0.95, 1.0), ceil=432, flicker=True)
    # the sheet's main passage: a steel stair up the wall beside the way in to a landing and a shut door (sheet «메인 통로»,
    # left of the B-1 door as the sheet looks in). Clear of the town-start spots (L-1100) and the gate walk.
    sa = W / 2 - 55
    N = 8   # 8 x 24 cm: landing at 1.92 m, so the door (2.0 m) clears the 4.6 m ceiling's pipes - 10 steps ran it into them
    for k in range(N):
        box(f"External_Stair{k}", f, sa, 220 + k * 50, 0, 110, 50, 24 * (k + 1), "steel")
    lb = 220 + (N - 1) * 50 + 25 + 125   # landing centre: it starts where the top step ends (no gap)
    box("External_Landing", f, sa, lb, 24 * N - 14, 110, 250, 14, "steel")
    top = 24 * N + 110   # rail height on the landing; on the stair the rail runs 110 cm over each step
    for k, bb in enumerate((lb - 85, lb + 85)):   # stanchions: floor through the landing up to its rail
        box(f"External_LandingPost{k}", f, sa - 50, bb, 0, 8, 8, top, "rust", collide=False)
    for k in range(N):   # a post standing on each step (the first build had them 20 cm in the air)
        box(f"External_StairRail{k}", f, sa - 58, 220 + k * 50, 24 * (k + 1), 4, 4, 110, "rust", collide=False)
    run = (N - 1) * 50
    box("External_StairHandrail", f, sa - 58, 220 + run / 2, 24 * (N + 1) / 2 + 110 - 2.5, 5, run / math.cos(math.radians(25.6)), 5,
        "rust", collide=False, pitch=25.6)
    b0, b1 = 220 + run, lb + 125   # from the top step's post to the landing's end
    box("External_LandingRail", f, sa - 58, (b0 + b1) / 2, top - 5, 5, b1 - b0, 5, "rust", collide=False)
    box("External_LandingDoor", f, W / 2 - 6, lb + 25, 24 * N, 6, 110, 200, "dark", collide=False)   # in front of its frame
    box("External_LandingDoorFrame", f, W / 2 - 2, lb + 25, 24 * N, 6, 130, 212, "hazard", collide=False)

    # ---- B-2 link: people sleep along the corridor; sealed at the end (sheet 05 «B-2»)
    f, L = F["B2Link"], ARMS["B2Link"]["L"]
    W = ARMS["B2Link"]["W"]
    for k in range(7):
        bedroll(f"B2Link_Bedroll{k}", f, -W / 2 + 55, 200 + k * 220)
    laundry("B2Link_Laundry", f, W / 2 - 40, 150, L - 300, 300)
    box("B2Link_SealedDoor", f, 0, L - 20, 0, 300, 30, 320, "rust")
    for e in (-1, 1):
        box(f"B2Link_Brace{e}", f, 0, L - 45, 60 + (e + 1) * 90, 320, 12, 18, "steel", collide=False, roll=12 * e)
    sign("B2Link_Sign", f, 0, L - 38, 330, "b2", 200, 60)

    # ---- core: Han's workbench on the way in from the gate (L295 «통로 한쪽에 작업대»), drum fires, tables,
    # laundry, crates; the drawings on the wall (L6632 «벙커 통로 벽에 도면이 붙어 있었다»)
    c = Frame(0, 0, 202.5)
    if not hero("workbench", "Core_HanWorkbench", c, 0, R - 120, face=180):   # its front faces the hall
        box("Core_HanWorkbench", c, 0, R - 120, 0, 260, 90, 90, "steel")
        box("Core_HanWorkbenchTop", c, 0, R - 120, 90, 270, 100, 6, "wood")
        vcyl("Core_HanAnvil", *c.at(-150, R - 260), 0, 25, 70, "rust")
    x, y = c.at(0, R - 300)
    station("Crafting", 3, x, y, face_yaw(c, 0, R - 300, 0, 0))
    x, y = c.at(160, R - 190)
    npc("HanJangin", x, y, face_yaw(c, 160, R - 190, 0, 0))
    light("Core_HanLamp", *c.at(0, R - 140), 260, 1200, 500, ceil=CORE_H - 34)
    drum("Core_DrumA", *Frame(0, 0, 262).at(0, 560), fire=True)
    drum("Core_DrumB", *Frame(0, 0, 20).at(0, 480), fire=True)
    t = Frame(0, 0, 112.5)
    table("Core_Table", t, 0, R - 230, 360, 110)
    bench("Core_BenchA", t, 0, R - 330, 320)
    bench("Core_BenchB", t, 0, R - 130, 320)
    box("Core_Drawings", Frame(0, 0, 67.5), 0, R - 60, 150, 320, 6, 190, "paper", collide=False)
    laundry("Core_Laundry", Frame(0, 0, 0), -300, -600, 600, 330)
    for k, ang in enumerate((22.5, 292.5, 337.5)):
        cf = Frame(0, 0, ang)
        crate(f"Core_Crate{k}a", cf, 0, R - 110, 0, 110)
        crate(f"Core_Crate{k}b", cf, 30, R - 110, 110, 90, dyaw=20)
        crate(f"Core_Crate{k}c", cf, -120, R - 150, 0, 90, dyaw=-15)


def bundle(label, x0, y0, x1, y1, z, radii=(12, 8, 5), hanger_ceiling=None, m=("rust", "steel", "dark")):
    """A bundle of parallel pipes from (x0, y0) to (x1, y1) at height z, hung from the ceiling every 3 m."""
    L = math.hypot(x1 - x0, y1 - y0)
    fr = Frame(x0, y0, math.degrees(math.atan2(y1 - y0, x1 - x0)), world=True)
    off = 0.0
    for k, r in enumerate(radii):
        hbar(f"{label}_P{k}", fr, off, 0, L, z - (k % 2) * 6, r, m[k % len(m)])
        off += r * 2 + 6
    if hanger_ceiling:
        b = 150.0
        while b < L:
            box(f"{label}_Hanger{int(b)}", fr, off / 2 - radii[0], b, z + radii[0], 4, 4, hanger_ceiling - z - radii[0], "steel", collide=False)
            box(f"{label}_Strap{int(b)}", fr, off / 2 - radii[0], b, z - radii[0] - 4, off + 10, 5, 4, "steel", collide=False)
            b += 300.0


def panel(label, f, a, b, z, face=-1, top=CORE_H):
    """An electrical box on a wall with indicator lights and a conduit to the ceiling (the sheet's wall clutter)."""
    box(label, f, a, b + face * 12, z, 50, 22, 70, "steel", collide=False)
    for k, m in enumerate(("led_red", "led_green", "led_green")):
        x, y = f.at(a - 14 + k * 14, b + face * 24)
        _mesh(SPHERE, unreal.Vector(x, y, z + 55), unreal.Rotator(roll=0, pitch=0, yaw=0), unreal.Vector(0.035, 0.035, 0.035), m, False, f"{label}_Led{k}", shadow=False)
    x, y = f.at(a + 18, b + face * 12)
    vcyl(label + "_Conduit", x, y, z + 70, 3, top - z - 110, "dark", collide=False)


def lantern(label, x, y, z):
    box(label, Frame(x, y, 0, world=True), 0, 0, z, 16, 16, 24, "lamp", collide=False)


def dress_density(F, side_frames):
    # ---- the hall: pipe bundles across the ceiling, steel to 4.2 m, pipes down every corner, electrical boxes,
    # the painted floor circle, the B-1 vault door standing open, the map
    zc = CORE_H - 34
    for k, d in enumerate((-260, 260)):
        bundle(f"Core_BundleEW{k}", -R + 40, d, R - 40, d, zc - 70, (13, 9, 6, 4), zc)
        bundle(f"Core_BundleNS{k}", d, -R + 40, d, R - 40, zc - 110, (11, 7, 5), zc)
    bundle("Core_BundleDiag", -560, -560, 560, 560, zc - 150, (16, 10), zc)
    for k in range(8):
        a = math.radians(22.5 + 45 * k)
        d = R / math.cos(math.radians(22.5)) - 45
        vcyl(f"Core_Downpipe{k}a", d * math.cos(a), d * math.sin(a), 0, 11, CORE_H, "rust", collide=False)
        d2 = d - 28
        vcyl(f"Core_Downpipe{k}b", d2 * math.cos(a) + 18 * math.sin(a), d2 * math.sin(a) - 18 * math.cos(a), 0, 6, CORE_H, "steel", collide=False)
    by_angle = {arm["angle"]: arm for arm in ARMS.values()}
    for i in range(8):
        ang = i * 45
        f = Frame(R * math.cos(math.radians(ang)), R * math.sin(math.radians(ang)), ang)
        panel(f"Core_Panel{ang:03d}", f, -(by_angle[ang]["W"] / 2 + 95), 0, 130 + (i % 3) * 25)
    box("Core_FloorEmblem", Frame(0, 0, 22.5), 0, 0, 0.2, 900, 900, 0.6, "sign_emblem", collide=False)
    # B-1: a round vault door, swung open into the hall beside the way in from the outer passage (sheet hero «B-1»)
    f = Frame(R * math.cos(math.radians(225)), R * math.sin(math.radians(225)), 225)
    for k in range(20):
        t = 2 * math.pi * k / 20
        a, z = 300 * math.cos(t), 290 + 300 * math.sin(t)
        if z < 5:
            continue
        box(f"Core_VaultRing{k}", f, a, -10, z - 25, 100, 34, 50, "steel", collide=False, roll=-math.degrees(t))
    # the leaf swung open into the hall, hinged at the wall (sheet hero: the round B-1 door)
    if not hero("vault", "Core_VaultLeaf", f, -300, -250, face=90):   # hinges (model left) to the wall
        x, y = f.at(-300, -250)
        _mesh(CYL, unreal.Vector(x, y, 250), unreal.Rotator(roll=90, pitch=0, yaw=f.yaw), unreal.Vector(4.8, 4.8, 0.42), "steel", True, "Core_VaultLeaf")
        for k, (r, th, m) in enumerate(((110, 0.5, "dark"), (40, 0.9, "rust"))):
            x2, y2 = f.at(-300 + 25 + th * 10, -250)
            _mesh(CYL, unreal.Vector(x2, y2, 250), unreal.Rotator(roll=90, pitch=0, yaw=f.yaw), unreal.Vector(r / 50.0, r / 50.0, th * 0.2), m, False, f"Core_VaultWheel{k}")
        for k in range(4):   # the wheel's spokes
            box(f"Core_VaultSpoke{k}", f, -300 + 32, -250, 245, 6, 200, 10, "rust", collide=False, pitch=45 * k)
    # the map (sheet: a whole wall of it by the big table)
    mf = Frame(0, 0, 157.5)
    box("Core_MapBoard", mf, 0, R - 70, 110, 360, 6, 220, "sign_map", collide=False)
    for e in (-1, 1):
        box(f"Core_MapLeg{e}", mf, e * 170, R - 66, 0, 8, 8, 330, "steel", collide=False)
    # life in the hall
    vcyl("Core_WaterTank", *Frame(0, 0, 67.5).at(-230, R - 140), 0, 70, 210, "steel")
    for k in range(4):
        vcyl(f"Core_GasBottle{k}", *Frame(0, 0, 292.5).at(-120 + k * 30, R - 260 - (k % 2) * 28), 0, 13, 120, "hazard" if k % 2 else "steel", collide=False)
    box("Core_Tarp", Frame(0, 0, 337.5), 110, R - 280, 0, 180, 140, 90, "canvas")
    lantern("Core_TableLantern", *Frame(0, 0, 112.5).at(-60, R - 230), 78)
    # ---- walkway lines in every corridor (worn yellow paint along both edges); long corridors get more
    for name, arm in ARMS.items():
        f, L, W = F[name], arm["L"], arm["W"]
        for e in (-1, 1):
            box(f"{name}_PaintLine{e:+d}", f, e * (W / 2 - 28), L / 2, 0.2, 8, L - 20, 0.6, "paint_yellow", collide=False)
        if L >= 1000:
            x0, y0 = f.at(-40, 50)
            x1, y1 = f.at(-40, L - 50)
            bundle(f"{name}_Bundle", x0, y0, x1, y1, arm["H"] - 70, (9, 6, 4), arm["H"] - 28)
            for k in range(int(L // 800)):
                panel(f"{name}_Panel{k}", f.sub(W / 2, 400 + k * 800, -90), 0, 0, 130, face=-1, top=arm["H"])

    # ---- rooms
    f, L = F["Manpower"], ARMS["Manpower"]["L"]
    for k in range(5):
        box(f"Manpower_Papers{k}", f, -300 + k * 150, L + 520, 106, 30, 22, 4 + (k * 3) % 9, "paper", collide=False, dyaw=k * 11)
    for k in range(3):
        box(f"Manpower_Chair{k}", f, -200 + k * 200, L + 330, 0, 45, 45, 45, "wood")
    lantern("Manpower_CounterLantern", *f.at(280, L + 520), 106)
    f, L = F["Matteo"], ARMS["Matteo"]["L"]
    box("Matteo_Ashtray", f, 120, L + 560, 78, 14, 14, 4, "steel", collide=False)
    vcyl("Matteo_Bottle", *f.at(-160, L + 560), 78, 4, 26, "dark", collide=False)
    f, L = F["Training"], ARMS["Training"]["L"]
    rw, rd, rh = ARMS["Training"]["room"]
    for k in range(3):   # heavy bags hanging on chains
        x, y = f.at(-rw / 2 + 160, L + 300 + k * 350)
        vcyl(f"Training_Bag{k}", x, y, 60, 28, 120, "canvas")
        vcyl(f"Training_Chain{k}", x, y, 180, 2, rh - 208, "dark", collide=False)
    for k in range(5):
        vcyl(f"Training_Weight{k}", *f.at(rw / 2 - 160, L + 1150 + (k % 2) * 40), k * 9, 22, 9, "dark", collide=False)
    f, L = F["Rank"], ARMS["Rank"]["L"]
    bench("Rank_QueueBench", f.sub(-120, 150, 90), 0, 0, 220)
    f, L = F["Supply"], ARMS["Supply"]["L"]
    for k in range(4):
        box(f"Supply_Sack{k}", f, -560 + (k % 2) * 60, L + 700 + (k // 2) * 90, 0, 55, 80, 35, "canvas", dyaw=k * 23)
    for k in range(3):
        drum(f"Supply_Barrel{k}", *f.at(560 - (k % 2) * 60, L + 150 + k * 70))
    lantern("Supply_CounterLantern", *f.at(-300, L + 480), 105)
    g = side_frames["Emergency"]
    shelf("Medical_Shelf", g, -350, 740, 220, 45, 200)
    for k in range(2):
        x, y = g.at(-150 + k * 300, 640)
        vcyl(f"Medical_IV{k}", x, y, 0, 2, 180, "steel", collide=False)
        box(f"Medical_IVBag{k}", Frame(x, y, 0, world=True), 0, 0, 165, 10, 5, 16, "cloth_c", collide=False)
    f, L = F["External"], ARMS["External"]["L"]
    W = ARMS["External"]["W"]
    hbar("External_FallenPipe", f.sub(-W / 2 + 70, L - 1500, 8), 0, 0, 380, 14, 13, "rust")
    for k in range(3):   # puddles (sheet 04: a wet, broken passage) - flat glossy ellipses
        x, y = f.at((k - 1) * 90, 600 + k * 520)
        _mesh(CYL, unreal.Vector(x, y, 0.3), unreal.Rotator(roll=0, pitch=0, yaw=f.yaw + k * 35), unreal.Vector((150 + k * 40) / 100.0, (90 + k * 20) / 100.0, 0.005),
              "water", False, f"External_Puddle{k}", shadow=False)


def main():
    lib.make_directory("/Game/Hwanghon/Maps/Hub")
    if lib.does_asset_exist(MAP):
        les.load_level(MAP)
    elif not les.new_level(MAP, False):
        raise RuntimeError(f"could not create {MAP}")
    world = unreal.EditorLevelLibrary.get_editor_world()
    if not world.get_path_name().startswith(MAP):
        raise RuntimeError(f"refusing to build into {world.get_path_name()}")
    # the map holds nothing but generated content: clear every generated kind (earlier builds tagged differently)
    kinds = (unreal.StaticMeshActor, unreal.PointLight, unreal.SpotLight, unreal.PlayerStart, unreal.TextRenderActor,
             unreal.TargetPoint, unreal.PostProcessVolume, unreal.SkeletalMeshActor, unreal.ExponentialHeightFog)
    hh = ("HHShelterStation", "HHShelterNPC", "HHShelterHubManager", "HHDeploymentGate")
    old = [a for a in eas.get_all_level_actors() if isinstance(a, kinds) or a.get_class().get_name() in hh]
    eas.destroy_actors(old)
    unreal.log(f"[HWShelterB1] cleared {len(old)} actors")

    build_core()
    side_frames = {}
    for name, arm in ARMS.items():
        f, g = build_arm(name, arm)
        if g:
            side_frames[name] = g
    F = arm_frames()
    build_places(F, side_frames)
    dress_density(F, side_frames)

    # QA camera spots, ordered like a walk in from the gate (novel order: gate, posters, ration, Han, Yujin, Matteo)
    fe, Le = F["External"], ARMS["External"]["L"]
    view("01_External_ToGate", fe, 0, 600, 0, Le)
    view("02_External_Inward", fe, 0, Le - 900, 0, 0)
    view("02b_External_Stair", fe, -(ARMS["External"]["W"] / 2 - 50), 330, ARMS["External"]["W"] / 2 - 55, 700, z=160, pitch=6)   # the main-passage stair and its door
    view("03_Core_FromSW", Frame(0, 0, 225), 0, R - 150, 0, -R, z=190)
    view("04_Core_FromNE", Frame(0, 0, 45), 0, R - 150, 0, -R, z=190)
    for name, key in (("05_Manpower", "Manpower"), ("06_Matteo", "Matteo"), ("07_Training", "Training"), ("08_Rank", "Rank"), ("09_Supply", "Supply")):
        f, L = F[key], ARMS[key]["L"]
        view(name, f, 0, L - 150, 0, L + ARMS[key]["room"][1])
    view("10_Medical", side_frames["Emergency"], -350, 100, 200, 700)
    fb, Lb = F["B2Link"], ARMS["B2Link"]["L"]
    view("11_B2Link", fb, 0, 200, 0, Lb)
    view("12_Core_High", Frame(0, 0, 250), 0, R - 200, 0, 0, z=430, pitch=-22)
    view("13_Core_ToVault", Frame(0, 0, 225), 0, -200, 0, R, z=180, pitch=2)
    # overviews: the tour hides everything that hangs above 3.3 m (ceilings, girders, pipes) for the spots tagged HW_ViewTop
    for name, (x, y, z, yaw, pitch) in (("00_Top", (0, 0, 6800, -90, -90)), ("00b_Bird", (-3400, 3900, 3600, -52, -38))):
        t = eas.spawn_actor_from_class(unreal.TargetPoint, unreal.Vector(x, y, z), unreal.Rotator(roll=0, pitch=pitch, yaw=yaw))
        t.tags = [unreal.Name(TAG), unreal.Name("HW_View"), unreal.Name("HW_ViewTop"), unreal.Name(f"View_{name}")]
        t.set_actor_label(f"HW_View_{name}")
    c = Frame(0, 0, 202.5)
    view("14_Workbench", c, -60, R - 470, 0, R - 120, z=165, pitch=-14)
    fm, Lm = F["Matteo"], ARMS["Matteo"]["L"]
    view("15_Matteo_Close", fm, -200, Lm + 150, 150, Lm + 450, z=160, pitch=-10)

    mgr = eas.spawn_actor_from_class(unreal.load_class(None, "/Script/HwanghonShelter.HHShelterHubManager"), unreal.Vector(0, 0, 0), unreal.Rotator(roll=0, pitch=0, yaw=0))
    mark(mgr, "HH_HubManager")

    # exposure: a dim bunker - pools of lamp light, not a hall auto-brightened to noon (the sheet's look)
    ppv = eas.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 300), unreal.Rotator(roll=0, pitch=0, yaw=0))
    ppv.set_editor_property("unbound", True)
    st = ppv.get_editor_property("settings")
    for k, v in (("override_auto_exposure_method", True), ("auto_exposure_method", unreal.AutoExposureMethod.AEM_HISTOGRAM),
                 ("override_auto_exposure_min_brightness", True), ("auto_exposure_min_brightness", 2.0),
                 ("override_auto_exposure_max_brightness", True), ("auto_exposure_max_brightness", 5.0),
                 ("override_auto_exposure_bias", True), ("auto_exposure_bias", -0.8),
                 ("override_vignette_intensity", True), ("vignette_intensity", 0.55),
                 ("override_bloom_intensity", True), ("bloom_intensity", 0.9)):
        st.set_editor_property(k, v)
    ppv.set_editor_property("settings", st)
    mark(ppv, "HW_B1_Exposure")
    fog = eas.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0), unreal.Rotator(roll=0, pitch=0, yaw=0))
    fc = fog.component
    fc.set_editor_property("fog_density", 0.012)
    fc.set_editor_property("fog_height_falloff", 0.6)
    fc.set_editor_property("fog_inscattering_luminance", unreal.LinearColor(0.035, 0.03, 0.025, 1))
    mark(fog, "HW_B1_Haze")

    ws = world.get_world_settings()
    ws.set_editor_property("force_no_precomputed_lighting", True)
    ws.set_editor_property("default_game_mode", unreal.load_class(None, "/Script/HwanghonCombatUE.HWShelterGameMode"))
    les.save_current_level()
    unreal.log(f"[HWShelterB1] built {COUNT['actors']} actors ({COUNT['lights']} lights, {COUNT['flicker']} flicker), saved {MAP}")


main()
