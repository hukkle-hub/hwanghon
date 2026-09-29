"""Part 1 story worlds EP02-EP28 (docs/design/150) — graybox, built from Content/Data/story_episodes.json.

One World Partition world per episode: /Game/Hwanghon/Story/EPnn/EPnn_World (game mode HWStoryGameMode).
Each fight of the episode gets its own arena along +X (B1_ at x=0, B2_ at x=12000 ...), with
  markers  <P>BossSpawn, <P>AinStart, <P><Member>Start (party of that fight), <P>Exit / <P>Cover / <P>InnerPins
  camera   <P>CAM_Entry_Wide (the novel cards of the arena's scenes are shown over it)
  layers   DL_<P>Pre / DL_<P>Fight / DL_<P>After — what the text destroys ("destroy" in the config) is intact
           before and broken after; the story director switches them per scene (doc 137).
Episodes without a fight get a dark card stage. EP01 has its own hand-built world (ue_ep01_arena_graybox.py).
Sizes and props are graybox design values (TBD_CANON); only what the config says the text has is placed.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_story_world.py" -unattended -nullrhi
  env HW_EPISODES=EP02,EP03 builds only those.
"""
import json
import math
import os

import unreal

COMMON = "/Game/Hwanghon/Story/Common"
MAT_DIR = f"{COMMON}/Materials"
CUBE = "/Engine/BasicShapes/Cube.Cube"
CYL = "/Engine/BasicShapes/Cylinder.Cylinder"
SPHERE = "/Engine/BasicShapes/Sphere.Sphere"
PLANE = "/Engine/BasicShapes/Plane.Plane"
BASIC = "/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"
SPACING = 12000.0

tools = unreal.AssetToolsHelpers.get_asset_tools()
lib = unreal.EditorAssetLibrary
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
dls = unreal.get_editor_subsystem(unreal.DataLayerEditorSubsystem)

LAYER_ACTORS = {}
MATS = {}


def log(msg):
    unreal.log(f"[HWStoryWorld] {msg}")


def mat(name, rgb):
    if name in MATS:
        return MATS[name]
    path = f"{MAT_DIR}/MI_SW_{name}"
    mi = unreal.load_asset(path) if lib.does_asset_exist(path) else tools.create_asset(
        f"MI_SW_{name}", MAT_DIR, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    mi.set_editor_property("parent", unreal.load_asset(BASIC))
    unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(mi, "Color", unreal.LinearColor(*rgb, 1.0))
    lib.save_loaded_asset(mi)
    MATS[name] = mi
    return mi


PALETTE = {
    "Ground": (0.16, 0.16, 0.17), "Asphalt": (0.07, 0.07, 0.08), "Concrete": (0.30, 0.30, 0.29),
    "Wall": (0.26, 0.25, 0.24), "Ceiling": (0.18, 0.18, 0.18), "Metal": (0.35, 0.36, 0.38),
    "Rust": (0.30, 0.16, 0.08), "Water": (0.03, 0.07, 0.10), "Sea": (0.02, 0.05, 0.09),
    "Glass": (0.20, 0.28, 0.32), "Grass": (0.08, 0.12, 0.07), "Broken": (0.10, 0.09, 0.08),
    "Crystal": (0.95, 0.45, 0.10), "Boss": (0.12, 0.10, 0.10), "Gold": (0.9, 0.6, 0.1), "Stage": (0.05, 0.05, 0.06),
}


def M(name):
    return mat(name, PALETTE[name])


def box(label, mesh, loc, scale, material, rot=(0, 0, 0), layer="DL_Base", tags=()):
    a = eas.spawn_actor_from_object(unreal.load_asset(mesh), unreal.Vector(*loc),
                                    unreal.Rotator(roll=rot[2], pitch=rot[0], yaw=rot[1]))
    a.set_actor_label(label)
    a.set_actor_scale3d(unreal.Vector(*scale))
    a.static_mesh_component.set_material(0, material)
    if tags:
        a.tags = list(tags)
    LAYER_ACTORS.setdefault(layer, []).append(a)
    return a


def marker(tag, loc, yaw=0.0, layer="DL_Base"):
    a = eas.spawn_actor_from_class(unreal.TargetPoint, unreal.Vector(*loc), unreal.Rotator(roll=0, pitch=0, yaw=yaw))
    a.set_actor_label(tag)
    a.tags = [tag]
    LAYER_ACTORS.setdefault(layer, []).append(a)
    return a


def point_light(label, loc, intensity, color, radius=1800.0, layer="DL_Base", shadows=True):
    a = eas.spawn_actor_from_class(unreal.PointLight, unreal.Vector(*loc), unreal.Rotator(0, 0, 0))
    a.set_actor_label(label)
    c = a.point_light_component
    c.set_intensity(intensity)
    c.set_light_color(unreal.LinearColor(*color, 1))
    c.set_attenuation_radius(radius)
    c.set_cast_shadows(shadows)
    LAYER_ACTORS.setdefault(layer, []).append(a)
    return a


def camera(tag, loc, look_at, fov=60.0):
    rot = unreal.MathLibrary.find_look_at_rotation(unreal.Vector(*loc), unreal.Vector(*look_at))
    a = eas.spawn_actor_from_class(unreal.CineCameraActor, unreal.Vector(*loc), rot)
    a.set_actor_label(tag)
    a.tags = [tag]
    a.get_cine_camera_component().set_editor_property("current_focal_length", 35.0 * 40.0 / fov)
    LAYER_ACTORS.setdefault("DL_Base", []).append(a)
    return a


def member_tag(prefix, member):
    return f"{prefix}{member[0].upper()}{member[1:]}Start"


# ---------------------------------------------------------------- arenas by kind
def arena_size(kind, scale):
    base = {"outdoor": (4400, 3400), "indoor": (2000, 1500), "underground": (3200, 2400), "water": (4200, 1300)}[kind]
    k = max(1.0, scale / 1.6)
    return base[0] * k, base[1] * k


def shell(p, cx, kind, sx, sy, spec):
    """Floor, walls, ceiling for the kind; the text's features as simple props."""
    hx, hy = sx / 2, sy / 2
    feats = " ".join(spec.get("features", []))
    floor_mat = "Asphalt" if ("도로" in feats or "아스팔트" in feats or "활주로" in feats) else (
        "Grass" if ("수풀" in feats or "골짜기" in feats) else "Ground")
    box(f"{p}Floor", CUBE, (cx, 0, -50), (sx / 100 + 20, sy / 100 + 20, 1), M(floor_mat))
    if kind in ("indoor", "underground", "water"):
        h = spec.get("ceiling_cm") or {"indoor": 400, "underground": 900, "water": 600}[kind]
        wall = "Concrete" if kind != "indoor" else "Wall"
        for side in (-1, 1):
            box(f"{p}Wall_Y{side}", CUBE, (cx, side * (hy + 50), h / 2), (sx / 100, 1, h / 100), M(wall))
            box(f"{p}Wall_X{side}", CUBE, (cx + side * (hx + 50), 0, h / 2), (1, sy / 100, h / 100), M(wall))
        box(f"{p}Ceiling", CUBE, (cx, 0, h + 50), (sx / 100, sy / 100, 1), M("Ceiling"))
        for i in range(-2, 3):   # a light down the middle; the room is otherwise dark
            point_light(f"{p}Lamp_{i}", (cx + i * sx / 5, 0, h - 60), 40.0 if kind != "indoor" else 25.0,
                        (1.0, 0.82, 0.62) if kind != "water" else (0.75, 0.9, 1.0), radius=max(sx, sy) * 0.6)
        if kind == "underground":
            for i in (-1, 1):
                for j in (-1, 1):
                    box(f"{p}Pillar_{i}{j}", CUBE, (cx + i * hx * 0.6, j * hy * 0.42, h / 2), (1.2, 1.2, h / 100), M("Concrete"))
    else:
        # outdoor: city blocks / ridges around the open ground
        for k in range(10):
            a = 2 * math.pi * k / 10
            r = max(hx, hy) * 1.25
            height = 600 + (k * 373) % 1600
            mat_name = "Concrete" if floor_mat != "Grass" else "Broken"
            box(f"{p}Block_{k}", CUBE, (cx + r * math.cos(a), r * math.sin(a) * 0.9, height / 2),
                (8 + k % 3 * 3, 8 + (k + 1) % 3 * 3, height / 100), M(mat_name), rot=(0, k * 17, 0))
    water = spec.get("water_cm")
    if water:
        surf = box(f"{p}WaterSurface", PLANE, (cx, 0, water), (sx / 100, sy / 100, 1), M("Water"))
        surf.static_mesh_component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
        surf.static_mesh_component.set_collision_profile_name("NoCollision")
        surf.set_actor_enable_collision(False)   # wading, not a floor
    if spec.get("sea"):
        sea = box(f"{p}Sea", PLANE, (cx + hx + 4000, 0, -120), (60, 80, 1), M("Sea"))
        sea.static_mesh_component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
        sea.static_mesh_component.set_collision_profile_name("NoCollision")
        sea.set_actor_enable_collision(False)
    # feature props (named in the text)
    if "셔터" in feats:
        box(f"{p}Shutter", CUBE, (cx - hx * 0.6, hy * 0.7, 150), (4, 0.2, 3), M("Metal"))
    if "차량" in feats or "장갑차" in feats or "수레" in feats:
        for k in range(4):
            box(f"{p}Vehicle_{k}", CUBE, (cx - hx * 0.5 + k * hx * 0.35, (-1) ** k * hy * 0.55, 90),
                (4.5, 2.0, 1.8), M("Rust"), rot=(0, k * 23, 0), tags=("HW_Cover",))
    if "가드레일" in feats or "난간" in feats:
        box(f"{p}Rail", CUBE, (cx, -hy * 0.85, 50), (sx / 100 * 0.9, 0.1, 1.0), M("Metal"))
    if "계단" in feats:
        for k in range(8):
            box(f"{p}Step_{k}", CUBE, (cx - hx * 0.8 + k * 45, hy * 0.5, k * 20 + 10), (0.45, 3.0, 0.2 + k * 0.4), M("Concrete"))
    if "매대" in feats or "진열대" in feats or "식당" in feats or "파티션" in feats:
        for k in range(5):
            box(f"{p}Stall_{k}", CUBE, (cx - hx * 0.4 + k * 260, hy * 0.6, 55), (1.8, 0.8, 1.1), M("Wall"))
    if "LED" in feats or "빌딩" in feats:
        for k in range(3):
            box(f"{p}LED_{k}", CUBE, (cx - hx * 0.6 + k * hx * 0.6, hy * 1.05, 950), (6, 0.2, 3), M("Glass"))
    if "결정 산" in feats and not spec.get("_body"):   # the built body IS the mountain (doc 156)
        box(f"{p}CrystalMountain", SPHERE, (cx + hx * 0.35, 0, 200), (14, 14, 9), M("Crystal"))
    if "탑" in feats:
        for k, (i, j) in enumerate(((-1, -1), (-1, 1), (1, -1), (1, 1))):
            box(f"{p}TowerLeg_{k}", CUBE, (cx + 900 + i * 500, j * 500, 1500), (1.2, 1.2, 30), M("Metal"), rot=(j * 4, 0, i * 4))


def destroy_props(p, cx, sx, sy, items):
    """What the text breaks: intact before it, broken after (duplicated per layer - an actor in several runtime
    data layers loads only when every one of them is active)."""
    hx, hy = sx / 2, sy / 2
    for k, d in enumerate(items):
        at = (cx + (k - len(items) / 2) * 420, hy * 0.35, 0)
        intact = ["Pre"] if d["when"] == "fight" else ["Pre", "Fight"]
        broken = ["Fight", "After"] if d["when"] == "fight" else ["After"]
        for L in intact:
            box(f"{p}{L}_Intact_{k}", CUBE, (at[0], at[1], 150), (1.4, 1.4, 3.0), M("Concrete"),
                layer=f"DL_{p}{L}", tags=(f"SRC:{d['src']}",))
        for L in broken:
            for j in range(5):
                box(f"{p}{L}_Rubble_{k}_{j}", CUBE, (at[0] + (j - 2) * 60, at[1] + (j % 2) * 70, 20),
                    (0.6, 0.5, 0.35), M("Broken"), rot=(j * 11, j * 37, j * 7), layer=f"DL_{p}{L}")


def build_battle(ep, i, b):
    p = b["prefix"]
    spec = b.get("arena", {"kind": "outdoor"})
    kind = spec.get("kind", "outdoor")
    scale = b.get("boss_scale", 1.0)
    sx, sy = arena_size(kind, scale)
    cx = i * SPACING
    shell(p, cx, kind, sx, sy, dict(spec, _body=bool(b.get("body") or b.get("body_static"))))
    boss_x = cx + 300 + 180 * max(0.0, scale - 1.0)
    marker(f"{p}BossSpawn", (boss_x, 0, 5), 180)
    marker(f"{p}AinStart", (cx - 350, 0, 5), 0)
    spots = [(-470, 140), (-430, -230), (-560, 240), (-640, -120), (-700, 300), (-720, -300)]
    for k, m in enumerate(b.get("party", [])):
        dx, dy = spots[k % len(spots)]
        marker(member_tag(p, m), (cx + dx, dy, 5), 0)
    hx, hy = sx / 2, sy / 2
    marker(f"{p}Exit", (cx - hx + 250, hy - 250, 5))
    marker(f"{p}Cover", (cx - hx * 0.3, -hy * 0.55, 5))
    marker(f"{p}InnerPins", (boss_x + 500, hy - 250, 5))
    # the body as the cards show it before the fight; hidden once the fight's boss spawns (doc 137)
    h = 190 * scale
    box(f"{p}BossStandIn", CYL, (boss_x, 0, h / 2), (0.7 * scale, 0.7 * scale, h / 100), M("Boss"),
        layer=f"DL_{p}Pre", tags=("HW_BossStandIn",))
    destroy_props(p, cx, sx, sy, spec.get("destroy", []))
    look = (boss_x - 150, 0, 120 * max(1.0, scale * 0.6))
    enclosed = kind != "outdoor"
    cam = (cx - min(1100 + 120 * scale, hx * 0.8), -min(620 + 80 * scale, hy * 0.75),
           min(380 + 90 * scale, 330 if kind == "indoor" else 520) if enclosed else 380 + 90 * scale)
    camera(f"{p}CAM_Entry_Wide", cam, look, 60)
    if kind == "outdoor":
        point_light(f"{p}Fill", (cx, 0, 1200), 40.0, (1.0, 0.75, 0.55), radius=max(sx, sy), shadows=False)
    return cx


def environment(ep, e):
    kinds = {b.get("arena", {}).get("kind", "outdoor") for b in e.get("battles", [])}
    any_outdoor = "outdoor" in kinds
    sun = eas.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 3000), unreal.Rotator(roll=0, pitch=-18, yaw=35))
    sun.set_actor_label("Sun_Dusk")
    sun.light_component.set_intensity(3.2 if any_outdoor else 0.4)
    sun.light_component.set_light_color(unreal.LinearColor(1.0, 0.55, 0.32, 1))   # 황혼
    sky = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 2000), unreal.Rotator(0, 0, 0))
    sky.set_actor_label("SkyLight")
    sky.light_component.set_intensity(1.3 if any_outdoor else 0.35)   # fill: the low dusk sun backlights the party
    fog = eas.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    fog.set_actor_label("Fog")
    dense = any(b.get("arena", {}).get("fog") == "dense" for b in e.get("battles", []))
    fog.component.set_editor_property("fog_density", 0.12 if dense else 0.008)   # thin haze: 0.02 greyed every outdoor frame
    fog.component.set_editor_property("fog_inscattering_luminance", unreal.LinearColor(0.35, 0.25, 0.2, 1))
    # Exposure: auto exposure lifted the dim dusk to flat grey (mean 140-156 of 255, doc 150 §7). A full stop down made
    # silhouettes (mean 43-67); -0.4 with more sky fill.
    ppv = eas.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
    ppv.set_actor_label("Exposure")
    ppv.set_editor_property("unbound", True)
    st = ppv.get_editor_property("settings")
    st.set_editor_property("override_auto_exposure_bias", True)
    st.set_editor_property("auto_exposure_bias", -0.4)
    ppv.set_editor_property("settings", st)
    for a in (sun, sky, fog, ppv):
        LAYER_ACTORS.setdefault("DL_Base", []).append(a)


def card_stage():
    box("Stage_Floor", CUBE, (0, 0, -50), (30, 30, 1), M("Stage"))
    point_light("Stage_Lamp", (0, 0, 500), 400.0, (1.0, 0.6, 0.35), radius=1500)
    camera("CAM_Entry_Wide", (-800, -400, 300), (0, 0, 80), 60)


def data_layers(ep, names):
    dl_dir = f"/Game/Hwanghon/Story/{ep}/DataLayers"
    lib.make_directory(dl_dir)
    for name in names:
        path = f"{dl_dir}/{name}"
        asset = unreal.load_asset(path) if lib.does_asset_exist(path) else tools.create_asset(
            name, dl_dir, unreal.DataLayerAsset, unreal.DataLayerFactory())
        asset.set_editor_property("data_layer_type", unreal.DataLayerType.RUNTIME)
        lib.save_loaded_asset(asset)
        params = unreal.DataLayerCreationParameters()
        params.data_layer_asset = asset
        inst = dls.create_data_layer_instance(params)
        on = name == "DL_Base" or name.endswith("Pre")
        dls.set_data_layer_initial_runtime_state(
            inst, unreal.DataLayerRuntimeState.ACTIVATED if on else unreal.DataLayerRuntimeState.UNLOADED)
        actors = LAYER_ACTORS.get(name, [])
        if actors:
            dls.add_actors_to_data_layer(actors, inst)


def build_episode(ep, e):
    LAYER_ACTORS.clear()
    root = f"/Game/Hwanghon/Story/{ep}"
    world_path = e["world"]
    lib.make_directory(root)
    if lib.does_asset_exist(world_path):
        les.load_level("/Game/Maps/HW_Frontend")
        lib.delete_asset(world_path)
        dl_dir = f"{root}/DataLayers"
        if lib.does_directory_exist(dl_dir):
            lib.delete_directory(dl_dir)
    les.new_level(world_path, True)
    ws = unreal.EditorLevelLibrary.get_editor_world().get_world_settings()
    ws.set_editor_property("default_game_mode", unreal.load_class(None, "/Script/HwanghonCombatUE.HWStoryGameMode"))
    environment(ep, e)
    battles = e.get("battles", [])
    names = ["DL_Base"]
    if battles:
        for i, b in enumerate(battles):
            build_battle(ep, i, b)
            names += [f"DL_{b['prefix']}Pre", f"DL_{b['prefix']}Fight", f"DL_{b['prefix']}After"]
        first = battles[0]["prefix"]
        start = eas.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(-350, 0, 100), unreal.Rotator(0, 0, 0))
        start.set_actor_label("PlayerStart")
        LAYER_ACTORS["DL_Base"].append(start)
        # fallback camera for scenes the director shows with no fight of their own
        camera("CAM_Entry_Wide", (-1100, -620, 380), (150, 0, 120), 60)
    else:
        card_stage()
        start = eas.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(0, 0, 100), unreal.Rotator(0, 0, 0))
        start.set_actor_label("PlayerStart")
        LAYER_ACTORS["DL_Base"].append(start)
    data_layers(ep, names)
    les.save_current_level()
    log(f"{ep}: saved {world_path}, {len(battles)} fights, actors " +
        ", ".join(f"{k}={len(v)}" for k, v in LAYER_ACTORS.items()))


def main():
    lib.make_directory(MAT_DIR)
    content = unreal.Paths.project_content_dir()
    cfg = json.load(open(os.path.join(content, "Data", "story_episodes.json"), encoding="utf-8"))["episodes"]
    only = [x for x in os.environ.get("HW_EPISODES", "").split(",") if x]
    for ep in sorted(cfg):
        e = cfg[ep]
        if e.get("hand_built") or (only and ep not in only):
            continue
        build_episode(ep, e)
    log("done")


main()
