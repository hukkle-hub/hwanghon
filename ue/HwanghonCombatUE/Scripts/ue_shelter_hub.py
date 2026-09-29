"""Gangnam bunker B-1 hub (docs/design/152) from the director's HwanghonShelter plugin v2 blockout.

1. NPC portraits (art/ui/npc/*_portrait.png, cropped from the design sheets) -> /Game/Hwanghon/UI/NPC/T_<Id>_Portrait
2. /Game/Hwanghon/Maps/Hub/L_GangnamBunker_B1: the plugin's own builder
   (Plugins/HwanghonShelter/Content/Python/build_hwanghon_shelter_blockout.py) runs in it, kept as delivered
3. our fixes on top: movable lights, no precomputed lighting (a graybox with no lightmaps showed
   "LIGHTING NEEDS TO BE REBUILT"), game mode HWShelterGameMode (Ain, the novel's NPC lines)

The map is rebuilt in place (the builder removes its own previous actors). Deleting and re-creating a map once
failed silently and the blockout landed in the frontend map, so a build into any other world is refused.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_shelter_hub.py" -unattended -nullrhi
"""
import os

import unreal

MAP = "/Game/Hwanghon/Maps/Hub/L_GangnamBunker_B1"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
BUILDER = os.path.join(HERE, "..", "Plugins", "HwanghonShelter", "Content", "Python", "build_hwanghon_shelter_blockout.py")
PORTRAITS = {"matteo": "Matteo", "yujin": "Yujin", "hanjangin": "HanJangin", "drjin": "DrJin", "suhui": "Suhui"}
lib = unreal.EditorAssetLibrary
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def import_portraits():
    lib.make_directory("/Game/Hwanghon/UI/NPC")
    tasks = []
    for src, npc in PORTRAITS.items():
        path = os.path.join(REPO, "art", "ui", "npc", f"{src}_portrait.png")
        if not os.path.exists(path):
            continue
        t = unreal.AssetImportTask()
        t.filename = path
        t.destination_path = "/Game/Hwanghon/UI/NPC"
        t.destination_name = f"T_{npc}_Portrait"
        t.automated = True
        t.replace_existing = True
        t.save = True
        tasks.append(t)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks(tasks)
    for t in tasks:
        for p in t.imported_object_paths:
            tex = unreal.load_asset(p)
            if isinstance(tex, unreal.Texture2D):
                tex.set_editor_property("lod_group", unreal.TextureGroup.TEXTUREGROUP_UI)
                tex.set_editor_property("mip_gen_settings", unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
                lib.save_loaded_asset(tex)
    unreal.log(f"[HWShelter] portraits: {len(tasks)}")


import_portraits()
lib.make_directory("/Game/Hwanghon/Maps/Hub")
if lib.does_asset_exist(MAP):
    les.load_level(MAP)
elif not les.new_level(MAP, False):
    raise RuntimeError(f"could not create {MAP}")
world_name = unreal.EditorLevelLibrary.get_editor_world().get_path_name()
if not world_name.startswith(MAP):
    raise RuntimeError(f"refusing to build into {world_name}")

exec(open(BUILDER, encoding="utf-8").read(), {"__name__": "__main__"})

# ---- walkthrough fixes for the v2 layout (doc 152 §3) - measured with the sheltershow reach map:
# the central core is a closed room (its walls cut every corridor but the south), corridor ends stop short of the
# rooms, rooms 03/05/06/07 turn their back wall to the corridor and open onto the void. The plugin's builder is kept;
# this carves doors and lays short vestibules so the layout of B1_SHELTER_LAYOUT_V2.md is walkable.
CUBE = unreal.load_asset("/Engine/BasicShapes/Cube.Cube")
WALL_KEYS = ("_Back", "_Left", "_Right", "_Front", "_WallL", "_WallR", "_WallA", "_WallB", "FrontWall")   # walls only - never floors or ceilings
FIX_TAG = unreal.Name("HW_WALKTHROUGH_FIX")


def slab(label, cx, cy, cz, sx, sy, sz):
    a = eas.spawn_actor_from_object(CUBE, unreal.Vector(cx, cy, cz), unreal.Rotator(roll=0, pitch=0, yaw=0))
    a.set_actor_label(label)
    a.tags = [unreal.Name("HH_SHELTER_V2"), FIX_TAG]
    a.set_actor_scale3d(unreal.Vector(sx / 100.0, sy / 100.0, sz / 100.0))
    return a


def walls():
    return [a for a in eas.get_all_level_actors()
            if isinstance(a, unreal.StaticMeshActor) and "HH_SHELTER_V2" in [str(t) for t in a.tags]
            and any(k in a.get_actor_label() for k in WALL_KEYS)]


def carve(label, cx, cy, half_x, half_y):
    """A door: every wall crossing the box is split around it (axis-aligned walls only)."""
    n = 0
    for w in walls():
        o, e = w.get_actor_bounds(False)
        if o.x + e.x <= cx - half_x or o.x - e.x >= cx + half_x or o.y + e.y <= cy - half_y or o.y - e.y >= cy + half_y:
            continue
        along_x = e.x >= e.y
        a0, a1 = (o.x - e.x, o.x + e.x) if along_x else (o.y - e.y, o.y + e.y)
        b0, b1 = (cx - half_x, cx + half_x) if along_x else (cy - half_y, cy + half_y)
        thick, height, z = (e.y if along_x else e.x) * 2, e.z * 2, o.z
        name = w.get_actor_label()
        for i, (p0, p1) in enumerate(((a0, b0), (b1, a1))):
            if p1 - p0 < 5:
                continue
            mid = (p0 + p1) / 2
            if along_x:
                slab(f"{name}_{label}_{i}", mid, o.y, z, p1 - p0, thick, height)
            else:
                slab(f"{name}_{label}_{i}", o.x, mid, z, thick, p1 - p0, height)
        w.destroy_actor()
        n += 1
    return n


def vestibule(label, x0, y0, x1, y1, height=310):
    """Floor between two points (axis-aligned box) with walls on its two long sides."""
    cx, cy, sx, sy = (x0 + x1) / 2, (y0 + y1) / 2, abs(x1 - x0), abs(y1 - y0)
    slab(f"HW_Vest_{label}_Floor", cx, cy, -12, sx, sy, 24)
    slab(f"HW_Vest_{label}_Ceiling", cx, cy, height, sx, sy, 24)
    if sx >= sy:
        slab(f"HW_Vest_{label}_WallA", cx, y0, height / 2, sx, 24, height)
        slab(f"HW_Vest_{label}_WallB", cx, y1, height / 2, sx, 24, height)
    else:
        slab(f"HW_Vest_{label}_WallA", x0, cy, height / 2, 24, sy, height)
        slab(f"HW_Vest_{label}_WallB", x1, cy, height / 2, 24, sy, height)


# vestibules where the corridors end short of the rooms
vestibule("West", -1860, -130, -1100, 130)
vestibule("East", 1030, -130, 1930, 95)
vestibule("South", -120, -1810, 120, -1180)
slab("HW_Vest_North_Floor", 0, 1112, -12, 340, 40, 24)
# the open sides of rooms that face the void get a wall
slab("HW_Room03_FrontWall", -1480, -710, 170, 760, 24, 340)
slab("HW_Room05_FrontWall", 1480, -710, 170, 760, 24, 340)
slab("HW_Room06_FrontWall", -520, -1810, 170, 800, 24, 340)
slab("HW_Room07_FrontWall", 520, -1810, 170, 800, 24, 340)
# doors (after the vestibules so their walls are carved too)
doors = [("CoreN", 0, 475, 170, 60), ("CoreW", -475, 0, 60, 170), ("CoreE", 475, 0, 60, 170),
         ("Room01Back", 0, 1775, 130, 60),
         ("Room02", -1480, 130, 130, 60), ("Room03", -1480, -130, 130, 60), ("WestIn", -1100, 0, 60, 120),
         ("Room04", 1480, 95, 130, 60), ("Room05", 1480, -130, 130, 60), ("EastIn", 1030, -17, 60, 100),
         ("Room06", -120, -1500, 60, 130), ("Room07", 120, -1500, 60, 130),
         ("SouthIn", 0, -1180, 110, 60), ("SouthOut", 0, -1810, 110, 60)]
cut = sum(carve(n, x, y, hx, hy) for n, x, y, hx, hy in doors)
unreal.log(f"[HWShelter] walkthrough: 3 vestibules, 4 room walls, {len(doors)} doors ({cut} wall pieces split)")

for a in eas.get_all_level_actors():
    if isinstance(a, unreal.PointLight):
        a.point_light_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    if isinstance(a, unreal.PlayerStart):
        # v2 puts it at z 90: Ain's capsule (half height 92) sinks into the floor and no pawn spawns at all
        loc = a.get_actor_location()
        a.set_actor_location(unreal.Vector(loc.x, loc.y, max(loc.z, 110.0)), False, False)
ws = unreal.EditorLevelLibrary.get_editor_world().get_world_settings()
ws.set_editor_property("force_no_precomputed_lighting", True)
ws.set_editor_property("default_game_mode", unreal.load_class(None, "/Script/HwanghonCombatUE.HWShelterGameMode"))
les.save_current_level()
unreal.log(f"[HWShelter] saved {MAP}")
