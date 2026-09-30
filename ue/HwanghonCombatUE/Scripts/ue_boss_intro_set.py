"""v10 boss intros (docs/design/162): per arena one AHHBossIntroDirector (tag <Prefix>BossIntro, the story director
finds it) and its five AHHBossIntroAnchor cameras, placed from the arena's own markers (<Prefix>BossSpawn,
<Prefix>AinStart). Re-runnable: it first removes what it placed before (tag HW_BossIntro).

The shots follow the novel's entrance of each boss, told in v10's five beats (PlayerEntry, Silhouette, ScaleReveal,
SignatureMotion, Handback). Where v10's shot notes differ from the novel, the novel wins (docs/design/162 §2).

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_boss_intro_set.py" -unattended -nullrhi
"""
import math

import unreal

eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
dls = unreal.get_editor_subsystem(unreal.DataLayerEditorSubsystem)
lib = unreal.EditorAssetLibrary
TAG = "HW_BossIntro"
BEAT = unreal.HHBossIntroBeat

# Shots in the boss frame: origin = the boss marker on the floor, u = toward the player's start, v = to the player's
# LEFT looking at the boss (the boss's right hand); z above the floor. (beat, camera (u, v, z), look-at (u, v, z), fov).
# A camera given as ("ain", du, dv, z) is placed from the player's start instead (the handback matches the fight camera:
# measured in EP02, 2.06 m behind Ain and 1.28 m to her right, yaw 27 deg off the boss line, pitch +7, fov 70).
# Beats cut, they do not glide: a blend is a straight line and it went through the boss (docs/design/162 §3).
HANDBACK = (BEAT.HANDBACK, ("ain", 206, -128, 100), ("ain", -150, 54, 149), 70)
SHOTS = {
    # EP01 L435-L439: «연기 속에서, 붉은 안광 두 점이 켜졌다. 그드득… 그드득. 짚단 사이를 뚫고 나온 나노 강선이
    # 근육처럼 뒤엉켜 있었다. 팔은 비정상적으로 길었고, 키는 3미터에 달했다.» - the room and its feet first, then the
    # eyes, then the height along the arm, then the wind-up its spin comes from.
    "TUTORIAL_SCARECROW": dict(shots=[
        (BEAT.PLAYER_ENTRY, (330, 150, 40), (0, 0, 25), 55),         # low from Ain's side: the mat, its feet
        (BEAT.SILHOUETTE, (260, 90, 185), (0, 0, 200), 38),          # «붉은 안광 두 점» - the head
        (BEAT.SCALE_REVEAL, (140, -150, 30), (0, 0, 175), 60),       # low by its feet looking up the long arm
        (BEAT.SIGNATURE_MOTION, (320, 190, 130), (0, 0, 125), 50),   # «그드득» - the spin's wind-up, three-quarter
        HANDBACK,
    ]),
    # EP02 (통합본 «셔터 끄는 놈»): «끼기기기긱— 소리가 왔다 ... 어둠 속에서 실루엣이 나왔다. 2.5미터. ... 오른손에
    # 장검. 칼날이 붉게 달아올라 있었다. 왼손에— 철제 셔터 한 장. ... 걸을 때마다 셔터 아래쪽이 바닥을 긁었다 ...
    # 그리고 놈이 멈췄다.» It walks in (about 2.1 m over the first three beats, measured), so later shots look further forward.
    "CLAVE_GANGNAM": dict(shots=[
        (BEAT.PLAYER_ENTRY, (230, -190, 22), (30, -90, 18), 50),     # the sound first: the shutter's edge on the floor
        (BEAT.SILHOUETTE, (660, -30, 40), (90, 0, 170), 36),         # low and far: the silhouette walking out
        (BEAT.SCALE_REVEAL, (380, 220, 50), (160, 0, 190), 50),      # its right side: the sword arm, 2.5 m
        (BEAT.SIGNATURE_MOTION, (600, -300, 125), (210, -60, 95), 46),  # the shutter side as it stops and sets it
        # (the charge wind-up crouches: its head drops to about 1.3 m - aimed at 1.45 m the first cut showed only its back)
        # (it walks about 2.1 m, measured: the first cut at 4.2 m cropped its head)
        HANDBACK,
    ]),
}

# world, marker prefix, v10 boss id, short version (a boss met before)
ARENAS = [
    ("/Game/Hwanghon/Story/EP01/EP01_TrainingRoom_World", "", "TUTORIAL_SCARECROW", False, "DL_Arena_Base"),
    ("/Game/Hwanghon/Story/EP02/EP02_World", "B1_", "CLAVE_GANGNAM", False, "DL_Base"),
    ("/Game/Hwanghon/Story/EP03/EP03_World", "B1_", "CLAVE_GANGNAM", True, "DL_Base"),
    ("/Game/Hwanghon/Story/EP03/EP03_World", "B2_", "CLAVE_GANGNAM", True, "DL_Base"),
]


def log(msg):
    unreal.log(f"[HWBossIntro] {msg}")


def load_markers():
    """World Partition: a commandlet editor loads no cells - load the markers and our old intro actors by descriptor."""
    wp = unreal.WorldPartitionBlueprintLibrary
    want = [d.guid for d in wp.get_actor_descs()
            if any(k in str(d.label) for k in ("BossSpawn", "AinStart", "BossIntro"))]
    if want:
        wp.load_actors(want)
    return len(want)


def find_tag(tag):
    for a in eas.get_all_level_actors():
        if tag in [str(t) for t in a.tags]:
            return a
    return None


def base_layer(name):
    for inst in dls.get_all_data_layers():
        asset = inst.get_editor_property("data_layer_asset") if hasattr(inst, "get_editor_property") else None
        if asset and asset.get_name() == name:
            return inst
    return None


def place(prefix, boss_id, short, layer_name):
    boss = find_tag(prefix + "BossSpawn")
    ain = find_tag(prefix + "AinStart")
    if not boss or not ain:
        raise RuntimeError(f"markers {prefix}BossSpawn / {prefix}AinStart missing")
    o = boss.get_actor_location()
    d = ain.get_actor_location() - o
    n = math.hypot(d.x, d.y)
    u = (d.x / n, d.y / n)
    v = (-u[1], u[0])
    floor = o.z

    ain_u = n   # the player's start on the u axis

    def at(p):
        if p[0] == "ain":
            p = (ain_u + p[1], p[2], p[3])
        return unreal.Vector(o.x + p[0] * u[0] + p[1] * v[0], o.y + p[0] * u[1] + p[1] * v[1], floor + p[2])

    spec = SHOTS[boss_id]
    anchor_cls = unreal.load_class(None, "/Script/HwanghonShelter.HHBossIntroAnchor")
    anchors = []
    placed = []
    for beat, cam, look, fov in spec["shots"]:
        c, t = at(cam), at(look)
        rot = unreal.MathLibrary.find_look_at_rotation(c, t)
        a = eas.spawn_actor_from_class(anchor_cls, c, rot)
        a.set_editor_property("boss_id", unreal.Name(boss_id))
        a.set_editor_property("beat", beat)
        a.set_editor_property("blend_override", 0.0)   # cut
        cc = a.get_editor_property("camera_component")
        cc.set_editor_property("field_of_view", float(fov))
        cc.set_editor_property("constrain_aspect_ratio", False)
        a.tags = [unreal.Name(TAG)]
        a.set_actor_label(f"{prefix}BossIntro_{str(beat).split('.')[-1]}")
        anchors.append(a)
    director = eas.spawn_actor_from_class(unreal.load_class(None, "/Script/HwanghonShelter.HHBossIntroDirector"),
                                          at((0, 0, 0)), unreal.Rotator(0, 0, 0))
    director.set_editor_property("boss_id", unreal.Name(boss_id))
    director.set_editor_property("explicit_anchors", anchors)   # EP03 holds two Clave arenas: never mix their cameras
    director.set_editor_property("auto_discover_anchors", False)
    tags = [unreal.Name(TAG), unreal.Name(prefix + "BossIntro")]
    if short:
        tags.append(unreal.Name("HW_IntroShort"))
    director.tags = tags
    director.set_actor_label(f"{prefix}BossIntroDirector")
    placed = anchors + [director]
    for a in placed:
        try:
            a.set_editor_property("is_spatially_loaded", False)
        except Exception:
            pass
    inst = base_layer(layer_name)
    if inst:
        dls.add_actors_to_data_layer(placed, inst)
    log(f"{prefix or '(none)'} {boss_id}{' short' if short else ''}: director + {len(anchors)} anchors, layer {layer_name if inst else '-'}")


def main():
    worlds = []
    for w, *_ in ARENAS:
        if w not in worlds:
            worlds.append(w)
    for w in worlds:
        les.load_level(w)
        log(f"{w}: loaded {load_markers()} marker/intro actors")
        old = [a for a in eas.get_all_level_actors() if TAG in [str(t) for t in a.tags]]
        if old:
            eas.destroy_actors(old)
        for world, prefix, boss_id, short, layer in ARENAS:
            if world == w:
                place(prefix, boss_id, short, layer)
        les.save_current_level()
        log(f"saved {w} (removed {len(old)})")


main()
