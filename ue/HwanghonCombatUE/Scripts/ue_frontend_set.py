"""The title set (docs/design/158): L_CharacterSelect becomes a small B-1 ops room the camera actually moves through.

v7 (GPT handoff): «실제 B-1 작전실/쉘터 일부를 3D로 구성하고, 같은 구도를 카메라로 재현» - the director's selected
concept (02_VISUAL_REFERENCES/01_Selected_TitleScreen.png): a far corridor in the middle, a CCTV wall on the left, a steel
wall with the B-1 plate on the right, a table in the foreground with the B-1 plan on it. Built from the shelter's own
materials (MI_HW_B1_*, Scripts/ue_shelter_materials.py) and Hi3D props; the CCTV feeds are real shots of our shelter.

  title     (-400, 0, 160) FOV 50, pitch -8 - the concept's framing: CCTV wall left, steel wall right, the table and
                                              its plan across the bottom, the corridor in the middle
  selection (-1130, 0, 150) FOV 55          - pulled back; the stand (v9) shows one hero at (-700, 0) - ‹ › to change
  (v7 baseline was 34 -> 58 on a proxy set; the concept is a wide shot, so the title starts wider here)
  connect   (-40, PLAN_Y, 395) pitch -86 FOV 74 - down on the plan: the route 외부 통로 -> 코어 -> 인력사무소 draws

Also: textures from art/frontend (tools/frontend/make_frontend_tex.py), MPC_HW_FrontEnd (HH_Reveal, HH_Route),
M_HW_FE_Plan (draws with those), M_HW_FE_Screen + a MI per feed.
Only /Game/Hwanghon/Frontend/L_CharacterSelect is written; actors this script placed carry the tag HW_FE and are replaced.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_frontend_set.py" -unattended -nullrhi
"""
import math
import os

import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, "..", "..", "..", "art", "frontend"))
DIR = "/Game/Hwanghon/Frontend"
MAP = f"{DIR}/L_CharacterSelect"
TAG = "HW_FE"
lib = unreal.EditorAssetLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()
mel = unreal.MaterialEditingLibrary
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
CUBE = unreal.load_asset("/Engine/BasicShapes/Cube.Cube")
CYL = unreal.load_asset("/Engine/BasicShapes/Cylinder.Cylinder")
CONE = unreal.load_asset("/Engine/BasicShapes/Cone.Cone")
SPHERE = unreal.load_asset("/Engine/BasicShapes/Sphere.Sphere")
PROPS = "/Game/Hwanghon/Shelter/Props"
WARM = (1.0, 0.72, 0.45)
COOL = (0.62, 0.76, 1.0)
HEROES = {   # Config/DefaultGame.ini Characters (the project's current bodies for the four)
    "ain": "/Game/ParagonCountess/Characters/Heroes/Countess/Meshes/SM_Countess.SM_Countess",
    "kain": "/Game/ParagonCountess/Characters/Heroes/Countess/Skins/Tier2/Shogun/Meshes/SM_Countess_Shogun.SM_Countess_Shogun",
    "ryu": "/Game/ParagonCountess/Characters/Heroes/Countess/Skins/Tier1/Count_RedRevo/Meshes/SM_Countess_RedRevo.SM_Countess_RedRevo",
    "sera": "/Game/ParagonCountess/Characters/Heroes/Countess/Skins/Tier1/Count_Gold/Meshes/SM_CountessGilded.SM_CountessGilded",
}
IDLE = "/Game/ParagonCountess/Characters/Heroes/Countess/Animations/Idle_Relaxed.Idle_Relaxed"
COUNT = {"actors": 0, "lights": 0}


def log(m):
    unreal.log(f"[HWFrontEndSet] {m}")


# ------------------------------------------------------------------ assets
def import_textures():
    kinds = {"T_HW_FE_Plan_C": "color", "T_HW_FE_Plan_M": "mask", "T_HW_FE_Logo": "ui"}
    tasks = []
    for f in sorted(os.listdir(SRC)):
        if f.startswith("T_HW_FE_") and f.endswith(".png"):
            t = unreal.AssetImportTask()
            t.filename = os.path.join(SRC, f)
            t.destination_path = DIR
            t.automated = True
            t.replace_existing = True
            t.save = False
            tasks.append(t)
    tools.import_asset_tasks(tasks)
    for t in tasks:
        name = os.path.basename(t.filename)[:-4]
        tx = unreal.load_asset(f"{DIR}/{name}")
        kind = kinds.get(name, "color")
        if kind == "mask":
            tx.set_editor_property("srgb", False)
            tx.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_VECTOR_DISPLACEMENTMAP)
        elif kind == "ui":
            tx.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_EDITOR_ICON)
            tx.set_editor_property("lod_group", unreal.TextureGroup.TEXTUREGROUP_UI)
            tx.set_editor_property("mip_gen_settings", unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
        lib.save_loaded_asset(tx)
    log(f"{len(tasks)} textures")


def tex(name):
    return unreal.load_asset(f"{DIR}/{name}")


def fresh(name, cls, factory):
    path = f"{DIR}/{name}"
    if lib.does_asset_exist(path):
        lib.delete_asset(path)
    return tools.create_asset(name, DIR, cls, factory)


def build_mpc():
    path = f"{DIR}/MPC_HW_FrontEnd"
    mpc = unreal.load_asset(path) if lib.does_asset_exist(path) else tools.create_asset(
        "MPC_HW_FrontEnd", DIR, unreal.MaterialParameterCollection, unreal.MaterialParameterCollectionFactoryNew())
    params = []
    for n in ("HH_Reveal", "HH_Route"):
        p = unreal.CollectionScalarParameter()
        p.set_editor_property("parameter_name", n)
        p.set_editor_property("default_value", 0.0)
        params.append(p)
    mpc.set_editor_property("scalar_parameters", params)
    lib.save_loaded_asset(mpc)
    return mpc


def expr(m, cls, x, y, **props):
    e = mel.create_material_expression(m, cls, x, y)
    for k, v in props.items():
        e.set_editor_property(k, v)
    return e


def gate(m, mpc, pname, order_node, order_pin, x, y, sharp=12.0, bias=0.0):
    """saturate((param + bias - order) * sharp): 0 before the draw front passes this texel, 1 after."""
    p = expr(m, unreal.MaterialExpressionCollectionParameter, x, y, collection=mpc, parameter_name=pname)
    add = expr(m, unreal.MaterialExpressionAdd, x + 150, y, const_b=bias)
    mel.connect_material_expressions(p, "", add, "A")
    sub = expr(m, unreal.MaterialExpressionSubtract, x + 300, y)
    mel.connect_material_expressions(add, "", sub, "A")
    mel.connect_material_expressions(order_node, order_pin, sub, "B")
    mul = expr(m, unreal.MaterialExpressionMultiply, x + 450, y, const_b=sharp)
    mel.connect_material_expressions(sub, "", mul, "A")
    sat = expr(m, unreal.MaterialExpressionSaturate, x + 600, y)
    mel.connect_material_expressions(mul, "", sat, "")
    return sat


def build_plan_material(mpc):
    """The table plan: paper (base colour); emissive = lines + pins where HH_Reveal has passed their order (G),
    + the route where HH_Route has passed its along-path progress (A, 0.2..1 on the line)."""
    m = fresh("M_HW_FE_Plan", unreal.Material, unreal.MaterialFactoryNew())
    c = expr(m, unreal.MaterialExpressionTextureSample, -1400, -300, texture=tex("T_HW_FE_Plan_C"))
    mel.connect_material_property(c, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
    mk = expr(m, unreal.MaterialExpressionTextureSample, -1400, 200, texture=tex("T_HW_FE_Plan_M"),
              sampler_type=unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_COLOR)
    g_reveal = gate(m, mpc, "HH_Reveal", mk, "G", -1200, 500)
    lines = expr(m, unreal.MaterialExpressionMultiply, -400, 150)
    mel.connect_material_expressions(mk, "R", lines, "A")
    mel.connect_material_expressions(g_reveal, "", lines, "B")
    pins = expr(m, unreal.MaterialExpressionMultiply, -400, 300)
    mel.connect_material_expressions(mk, "B", pins, "A")
    mel.connect_material_expressions(g_reveal, "", pins, "B")
    amber_l = expr(m, unreal.MaterialExpressionMultiply, -200, 150, const_b=1.6)
    mel.connect_material_expressions(lines, "", amber_l, "A")
    amber_p = expr(m, unreal.MaterialExpressionMultiply, -200, 300, const_b=6.0)
    mel.connect_material_expressions(pins, "", amber_p, "A")
    glow = expr(m, unreal.MaterialExpressionAdd, 0, 220)
    mel.connect_material_expressions(amber_l, "", glow, "A")
    mel.connect_material_expressions(amber_p, "", glow, "B")
    amber = expr(m, unreal.MaterialExpressionConstant3Vector, 0, 400, constant=unreal.LinearColor(1.0, 0.55, 0.18, 1))
    col = expr(m, unreal.MaterialExpressionMultiply, 200, 250)
    mel.connect_material_expressions(glow, "", col, "A")
    mel.connect_material_expressions(amber, "", col, "B")
    # the route: on the line (A > 0) and already drawn (0.2 + 0.8 * HH_Route >= A)
    on = expr(m, unreal.MaterialExpressionMultiply, -1000, 900, const_b=40.0)
    mel.connect_material_expressions(mk, "A", on, "A")
    on_s = expr(m, unreal.MaterialExpressionSaturate, -850, 900)
    mel.connect_material_expressions(on, "", on_s, "")
    route_p = expr(m, unreal.MaterialExpressionCollectionParameter, -1200, 1050, collection=mpc, parameter_name="HH_Route")
    scaled = expr(m, unreal.MaterialExpressionMultiply, -1050, 1050, const_b=0.8)
    mel.connect_material_expressions(route_p, "", scaled, "A")
    shifted = expr(m, unreal.MaterialExpressionAdd, -900, 1050, const_b=0.2)
    mel.connect_material_expressions(scaled, "", shifted, "A")
    sub = expr(m, unreal.MaterialExpressionSubtract, -750, 1050)
    mel.connect_material_expressions(shifted, "", sub, "A")
    mel.connect_material_expressions(mk, "A", sub, "B")
    sharp = expr(m, unreal.MaterialExpressionMultiply, -600, 1050, const_b=30.0)
    mel.connect_material_expressions(sub, "", sharp, "A")
    drawn = expr(m, unreal.MaterialExpressionSaturate, -450, 1050)
    mel.connect_material_expressions(sharp, "", drawn, "")
    started = expr(m, unreal.MaterialExpressionMultiply, -1050, 1250, const_b=50.0)   # nothing at all before HH_Route moves
    mel.connect_material_expressions(route_p, "", started, "A")
    started_s = expr(m, unreal.MaterialExpressionSaturate, -900, 1250)
    mel.connect_material_expressions(started, "", started_s, "")
    drawn2 = expr(m, unreal.MaterialExpressionMultiply, -300, 1150)
    mel.connect_material_expressions(drawn, "", drawn2, "A")
    mel.connect_material_expressions(started_s, "", drawn2, "B")
    rt = expr(m, unreal.MaterialExpressionMultiply, -300, 950)
    mel.connect_material_expressions(on_s, "", rt, "A")
    mel.connect_material_expressions(drawn2, "", rt, "B")
    red = expr(m, unreal.MaterialExpressionConstant3Vector, -300, 1150, constant=unreal.LinearColor(9.0, 2.2, 0.5, 1))
    rt_c = expr(m, unreal.MaterialExpressionMultiply, -100, 1000)
    mel.connect_material_expressions(rt, "", rt_c, "A")
    mel.connect_material_expressions(red, "", rt_c, "B")
    em = expr(m, unreal.MaterialExpressionAdd, 400, 500)
    mel.connect_material_expressions(col, "", em, "A")
    mel.connect_material_expressions(rt_c, "", em, "B")
    mel.connect_material_property(em, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    r = expr(m, unreal.MaterialExpressionConstant, 200, -100, r=0.8)
    mel.connect_material_property(r, "", unreal.MaterialProperty.MP_ROUGHNESS)
    mel.recompile_material(m)
    lib.save_loaded_asset(m)
    return m


def build_screens():
    m = fresh("M_HW_FE_Screen", unreal.Material, unreal.MaterialFactoryNew())
    t = expr(m, unreal.MaterialExpressionTextureSampleParameter2D, -600, 0, parameter_name="Feed", texture=tex("T_HW_FE_Feed_0"))
    k = expr(m, unreal.MaterialExpressionMultiply, -300, 0, const_b=2.2)
    mel.connect_material_expressions(t, "RGB", k, "A")
    mel.connect_material_property(k, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    black = expr(m, unreal.MaterialExpressionConstant3Vector, -300, -200, constant=unreal.LinearColor(0.01, 0.01, 0.01, 1))
    mel.connect_material_property(black, "", unreal.MaterialProperty.MP_BASE_COLOR)
    r = expr(m, unreal.MaterialExpressionConstant, -300, 200, r=0.15)
    mel.connect_material_property(r, "", unreal.MaterialProperty.MP_ROUGHNESS)
    mel.recompile_material(m)
    lib.save_loaded_asset(m)
    out = []
    for i in range(4):
        mi = fresh(f"MI_HW_FE_Feed_{i}", unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
        mi.set_editor_property("parent", m)
        mel.set_material_instance_texture_parameter_value(mi, "Feed", tex(f"T_HW_FE_Feed_{i}"))
        lib.save_loaded_asset(mi)
        out.append(mi)
    return out


# ------------------------------------------------------------------ the set
_mats = {}


def mat(name):
    if not isinstance(name, str):
        return name
    if name not in _mats:
        _mats[name] = unreal.load_asset(f"/Game/Hwanghon/Shelter/Materials/MI_HW_B1_{name}")
        if not _mats[name]:
            raise RuntimeError(f"MI_HW_B1_{name} missing - run Scripts/ue_shelter_materials.py first")
    return _mats[name]


def mark(a, label):
    a.tags = [unreal.Name(TAG)]
    a.set_actor_label(label)
    COUNT["actors"] += 1
    return a


def mesh(m, loc, rot, scale, material, label, collide=False, shadow=True):
    a = eas.spawn_actor_from_object(m, unreal.Vector(*loc), rot)
    a.set_actor_scale3d(unreal.Vector(*scale))
    c = a.static_mesh_component
    if material is not None:
        c.set_material(0, mat(material))
    if not collide:
        c.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
    c.set_editor_property("cast_shadow", shadow)
    return mark(a, label)


def box(label, x0, x1, y0, y1, z0, z1, m="concrete", yaw=0.0, shadow=True):
    return mesh(CUBE, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), unreal.Rotator(roll=0, pitch=0, yaw=yaw),
                ((x1 - x0) / 100, (y1 - y0) / 100, (z1 - z0) / 100), m, label, shadow=shadow)


def pipe_x(label, x0, x1, y, z, r, m="rust"):
    return mesh(CYL, ((x0 + x1) / 2, y, z), unreal.Rotator(roll=0, pitch=90, yaw=0), (r / 50, r / 50, (x1 - x0) / 100), m, label, shadow=False)


def pipe_z(label, x, y, z0, z1, r, m="rust"):
    return mesh(CYL, (x, y, (z0 + z1) / 2), unreal.Rotator(0, 0, 0), (r / 50, r / 50, (z1 - z0) / 100), m, label, shadow=False)


def light(label, x, y, z, cd, radius, color=WARM, fixture=True, ceil=None, cls=unreal.PointLight, rot=None, tags=()):
    a = eas.spawn_actor_from_class(cls, unreal.Vector(x, y, z), rot or unreal.Rotator(0, 0, 0))
    comp = a.get_component_by_class(unreal.LightComponent)
    comp.set_mobility(unreal.ComponentMobility.MOVABLE)
    comp.set_editor_property("intensity", cd)
    comp.set_editor_property("attenuation_radius", radius)
    comp.set_editor_property("light_color", unreal.LinearColor(*color, 1).to_color(True))
    comp.set_editor_property("cast_shadows", False)
    mark(a, label)
    a.tags = [unreal.Name(TAG)] + [unreal.Name(t) for t in tags]
    COUNT["lights"] += 1
    if fixture:
        if ceil:
            mesh(CYL, (x, y, (z + 25 + ceil) / 2), unreal.Rotator(0, 0, 0), (0.03, 0.03, max(ceil - z - 25, 1) / 100), "dark", label + "_Cable", shadow=False)
        mesh(CONE, (x, y, z + 16), unreal.Rotator(0, 0, 0), (0.4, 0.4, 0.25), "steel", label + "_Shade", shadow=False)
        mesh(SPHERE, (x, y, z + 2), unreal.Rotator(0, 0, 0), (0.14, 0.14, 0.14), "lamp", label + "_Bulb", shadow=False)
    return a


def prop(pid, label, loc, yaw, scale=1.0):
    folder = f"{PROPS}/{pid}"
    for p in lib.list_assets(folder, recursive=True, include_folder=False) if lib.does_directory_exist(folder) else []:
        a = unreal.load_asset(p)
        if isinstance(a, unreal.StaticMesh):
            act = eas.spawn_actor_from_object(a, unreal.Vector(*loc), unreal.Rotator(roll=0, pitch=0, yaw=yaw - 90.0))   # Hi3D -Y front
            act.set_actor_scale3d(unreal.Vector(scale, scale, scale))
            act.static_mesh_component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
            return mark(act, label)
    return None


CEIL = 440.0
PLAN_Y = -280 + 560 * (60 + 500) / 2048   # centre of the plan square on the plate (make_frontend_tex.py CX)
X0, X1, YW = -1500.0, 1700.0, 640.0


def build_room(feeds, plan_mat):
    # shell: floor, low ceiling with girders and pipes (sheet «낮은 천장 / 노출 배관»), concrete walls with a steel band
    box("FE_Floor", X0, X1 + 2300, -YW, YW, -20, 0, "floor", shadow=False)
    box("FE_Ceiling", X0, X1, -YW, YW, CEIL, CEIL + 30, "concrete", shadow=False)
    for side in (-1, 1):
        box(f"FE_Wall_{side}", X0, X1, side * YW - 15, side * YW + 15, 0, CEIL, "concrete")
        box(f"FE_Band_{side}", X0, X1, side * (YW - 18) - 3, side * (YW - 18) + 3, 0, 150, "steel", shadow=False)
    box("FE_WallBack", X0 - 30, X0, -YW, YW, 0, CEIL, "concrete")
    # the back wall with the corridor mouth in the middle (the concept's deep centre)
    for side in (-1, 1):
        box(f"FE_Front_{side}", X1, X1 + 40, side * 190, side * YW, 0, CEIL, "concrete")
    box("FE_Front_Lintel", X1, X1 + 40, -190, 190, 330, CEIL, "concrete")
    for side in (-1, 1):
        box(f"FE_DoorFrame_{side}", X1 - 10, X1 + 50, side * 190 - 12, side * 190 + 12, 0, 330, "hazard")
    # the corridor beyond: dark, lamps receding, the B-1 vault door at its end
    CX1 = X1 + 2300
    box("FE_Corr_Ceil", X1, CX1, -200, 200, 330, 350, "concrete", shadow=False)
    for side in (-1, 1):
        box(f"FE_Corr_Wall_{side}", X1, CX1, side * 200 - 10, side * 200 + 10, 0, 330, "concrete")
        pipe_x(f"FE_Corr_Pipe_{side}", X1, CX1, side * 170, 300, 9, "rust")
    box("FE_Corr_End", CX1, CX1 + 30, -200, 200, 0, 330, "steel")
    prop("vault", "FE_Corr_Vault", (CX1 - 40, 0, -40), 180, 0.62)
    for k in range(4):
        light(f"FE_Corr_Lamp_{k}", X1 + 400 + k * 520, 0, 300, 22.0 - k * 3, 520, WARM, ceil=330)
    # ceiling: girders across, a pipe bundle along
    for k in range(7):
        x = X0 + 200 + k * 440
        box(f"FE_Girder_{k}", x - 12, x + 12, -YW, YW, CEIL - 38, CEIL, "girder", shadow=False)
    for j, (y, r, m) in enumerate(((-430, 14, "rust"), (-395, 9, "steel"), (-370, 6, "dark"), (420, 12, "rust"), (450, 7, "steel"))):
        pipe_x(f"FE_Pipe_{j}", X0, X1, y, CEIL - 60 - j * 6, r, m)
    for k, x in enumerate((-700, 250, 1250)):
        pipe_z(f"FE_Riser_L{k}", x, -YW + 30, 0, CEIL, 10, "rust")
        pipe_z(f"FE_Riser_R{k}", x + 90, YW - 30, 0, CEIL, 8, "steel")

    # left: the CCTV wall (concept: 2 x 2 feeds in a steel frame) - our shelter's corridor, training, medical, core
    wy = -YW + 20
    box("FE_CCTV_Back", 420, 1260, wy, wy + 25, 110, 360, "dark")
    for i in range(4):
        cx = 630 + (i % 2) * 420
        cz = 295 - (i // 2) * 115
        box(f"FE_CCTV_Bezel_{i}", cx - 195, cx + 195, wy + 22, wy + 34, cz - 52, cz + 52, "steel", shadow=False)
        s = box(f"FE_CCTV_Screen_{i}", cx - 180, cx + 180, wy + 34, wy + 37, cz - 44, cz + 44, feeds[i], shadow=False)
        s.static_mesh_component.set_editor_property("cast_shadow", False)
    light("FE_CCTV_Glow", 840, wy + 160, 240, 35.0, 700, COOL, fixture=False)
    # desk and consoles under the feeds
    box("FE_Console", 420, 1260, wy, wy + 110, 0, 90, "dark")
    box("FE_ConsoleTop", 410, 1270, wy, wy + 120, 90, 96, "steel", shadow=False)
    prop("crt", "FE_Console_CRT0", (560, wy + 60, 96), 90, 0.8)
    prop("recorder", "FE_Console_Recorder", (1180, wy + 55, 0), 90, 0.9)

    # right: the steel wall with the B-1 plate and the sector board (sign textures from the shelter set)
    box("FE_SteelWall", 300, 1500, YW - 40, YW - 18, 0, CEIL - 40, "girder")
    for k in range(6):
        x = 320 + k * 220
        box(f"FE_SteelRib_{k}", x - 8, x + 8, YW - 55, YW - 40, 0, CEIL - 40, "steel", shadow=False)
    box("FE_B1Plate", 820, 1100, YW - 58, YW - 54, 170, 330, "sign_b1", shadow=False)
    prop("drum", "FE_Drum_0", (1350, YW - 130, 0), 0)
    prop("drum", "FE_Drum_1", (1420, YW - 220, 0), 40)
    light("FE_Right_Lamp", 950, YW - 150, 360, 22.0, 700, WARM, ceil=CEIL)

    # the table in the foreground with the B-1 plan (M_HW_FE_Plan: draws with HH_Reveal / HH_Route)
    box("FE_TableTop", -180, 100, -340, 340, 84, 92, "wood")   # right under the title camera: the concept's foreground
    for ix in (-165, 85):
        for iy in (-320, 320):
            box(f"FE_TableLeg_{ix}_{iy}", ix - 6, ix + 6, iy - 6, iy + 6, 0, 84, "steel", shadow=False)
    # the plate: the cube's top face carries the texture across the whole face; the plan is 2:1 on a 2:1 plate
    plate = mesh(CUBE, (-40, 0, 92.6), unreal.Rotator(roll=0, pitch=0, yaw=90), (5.6, 2.8, 0.012), None, "FE_Plan", shadow=False)
    plate.static_mesh_component.set_material(0, plan_mat)
    prop("crt", "FE_Table_CRT", (-110, 290, 92), 200, 0.75)
    for k, (x, y) in enumerate(((-130, -300), (70, -250))):
        box(f"FE_TableBox_{k}", x - 25, x + 25, y - 18, y + 18, 92, 110 + k * 8, "canvas")
    light("FE_Table_Lamp", 60, 215, 150, 14.0, 380, WARM, fixture=True)
    mesh(CYL, (60, 215, 118), unreal.Rotator(0, 0, 0), (0.02, 0.02, 0.5), "dark", "FE_Table_LampStem", shadow=False)
    # clutter near the camera (the concept's crates and cases at the frame edges)
    for k, (x, y, s) in enumerate(((-40, -520, 90), (60, 540, 110), (-300, 560, 80), (-520, -560, 100))):
        box(f"FE_Crate_{k}", x - s / 2, x + s / 2, y - s / 2, y + s / 2, 0, s * 0.8, "wood")
    # the room's own light: warm and low, the corridor mouth darker than the lamps
    for k, x in enumerate((-1100, -250, 600, 1300)):
        light(f"FE_Ceil_Lamp_{k}", x, 0, CEIL - 70, 30.0, 850, WARM, ceil=CEIL)


ANIM = "/Game/ParagonCountess/Characters/Heroes/Countess/Animations/"
# v9 (docs 159): one hero on the stand, the project's own clips for the three beats - reuse before new montages.
# Picked by the v9 motion language: 아인 controlled (walks in, stops; weapon-ready), 카인 the heaviest (lands; the most
# static idle), 류 the quickest (the same entrance faster, a quicker idle), 세라 the steadiest (a still idle; weapon-ready).
BEATS = {
    "ain":  dict(intro=("Jog_Fwd_Stop", 1.0), idle=("Idle_Relaxed", 1.0), confirm=("Ability_Q_target_transition", 1.0)),
    "kain": dict(intro=("Respawn", 0.9), idle=("Idle_Straight", 0.8), confirm=("Ability_E_target_transition", 0.85)),
    "ryu":  dict(intro=("Jog_Fwd_Stop", 1.45), idle=("Idle_Relaxed", 1.3), confirm=("Ability_R_target_transition", 1.2)),
    "sera": dict(intro=("Jog_Fwd_Stop", 0.9), idle=("Idle_Pose", 1.0), confirm=("Ability_E_target_transition", 0.9)),   # Cast raised the arm high - v9 «마법사/성녀식 포즈 금지»
}
STAND_X = -700.0


def build_stand():
    """AHHCharacterSelectStand (v9) where the four stood: hidden through the title, it shows the chosen hero when the
    pull-back ends. Key and rim light on it."""
    cls = unreal.load_class(None, "/Script/HwanghonShelter.HHCharacterSelectStand")
    st = eas.spawn_actor_from_class(cls, unreal.Vector(STAND_X, 0, 0), unreal.Rotator(roll=0, pitch=0, yaw=180))
    mark(st, "FE_Stand")
    for hid, path in HEROES.items():
        body = unreal.HHSelectionBody()
        body.set_editor_property("mesh", unreal.load_asset(path))
        for beat in ("intro", "idle", "confirm"):
            clip, rate = BEATS[hid][beat]
            body.set_editor_property(beat, unreal.load_asset(ANIM + clip))
            body.set_editor_property(f"{beat}_rate", rate)
        st.set_editor_property(f"{hid}_body", body)
    light("FE_Stand_Key", STAND_X - 230, -120, 300, 260.0, 700, (1.0, 0.82, 0.62), fixture=False, cls=unreal.SpotLight,
          rot=unreal.Rotator(roll=0, pitch=-40, yaw=25))
    light("FE_Stand_Rim", STAND_X + 220, 90, 260, 180.0, 600, (1.0, 0.6, 0.3), fixture=False, cls=unreal.SpotLight,
          rot=unreal.Rotator(roll=0, pitch=-35, yaw=200))
    return st


def build_director():
    cls = unreal.load_class(None, "/Script/HwanghonShelter.HHFrontEndCinematicDirector")
    d = eas.spawn_actor_from_class(cls, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    mark(d, "FE_Director")
    d.set_editor_property("title_location", unreal.Vector(-400, 0, 160))
    d.set_editor_property("title_rotation", unreal.Rotator(roll=0, pitch=-8, yaw=0))
    d.set_editor_property("title_fov", 50.0)
    d.set_editor_property("selection_location", unreal.Vector(STAND_X - 430, 0, 150))   # the hero fills ~3/4 of the height
    d.set_editor_property("selection_rotation", unreal.Rotator(roll=0, pitch=-12, yaw=0))   # the hero in the upper 3/4, the name below the feet
    d.set_editor_property("selection_fov", 55.0)
    d.set_editor_property("connect_location", unreal.Vector(-40, PLAN_Y, 395))   # under the 440 ceiling (the first try sat on its roof)
    d.set_editor_property("connect_rotation", unreal.Rotator(roll=0, pitch=-86, yaw=0))
    d.set_editor_property("connect_fov", 74.0)
    return d


def build_post():
    ppv = eas.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    mark(ppv, "FE_Post")
    ppv.set_editor_property("unbound", True)
    st = ppv.get_editor_property("settings")
    for k, v in (("auto_exposure_min_brightness", 1.0), ("auto_exposure_max_brightness", 1.0), ("auto_exposure_bias", 0.0),
                 ("bloom_intensity", 0.9), ("vignette_intensity", 0.55), ("film_grain_intensity", 0.18)):
        st.set_editor_property(f"override_{k}", True)
        st.set_editor_property(k, v)
    ppv.set_editor_property("settings", st)
    fog = eas.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    mark(fog, "FE_Fog")
    fog.component.set_editor_property("fog_density", 0.02)
    fog.component.set_editor_property("fog_inscattering_luminance", unreal.LinearColor(0.06, 0.045, 0.035, 1))
    sky = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 300), unreal.Rotator(0, 0, 0))
    mark(sky, "FE_Sky")
    sky.light_component.set_intensity(0.08)
    sky.light_component.set_mobility(unreal.ComponentMobility.MOVABLE)


def main():
    import_textures()
    mpc = build_mpc()
    plan_mat = build_plan_material(mpc)
    feeds = build_screens()
    les.load_level(MAP)
    world = unreal.EditorLevelLibrary.get_editor_world()
    if not world.get_path_name().startswith(MAP):
        raise RuntimeError(f"refusing to write into {world.get_path_name()}")
    old = [a for a in eas.get_all_level_actors() if unreal.Name(TAG) in a.tags or a.get_actor_label() == "HW_FrontEndCamera"]
    for a in old:
        eas.destroy_actor(a)
    build_room(feeds, plan_mat)
    build_stand()
    build_director()
    build_post()
    les.save_current_level()
    log(f"{MAP}: removed {len(old)}, placed {COUNT['actors']} actors, {COUNT['lights']} lights")


main()
