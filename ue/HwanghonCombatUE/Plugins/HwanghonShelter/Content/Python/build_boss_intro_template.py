"""황혼의 서울 — Boss Intro anchor template v10

USAGE
1. Open the actual boss-room level.
2. Select the actual boss actor/BP in the level.
3. Set BOSS_ID below to the matching production id.
4. Tools > Execute Python Script > this file.
5. Reposition every generated camera anchor by hand after blockout.

This script creates ONLY a reversible camera/trigger blockout.
It does not replace boss assets, AI, animation, or the arena.
"""

import unreal

BOSS_ID = "CLAVE_GANGNAM"

VALID_BOSS_IDS = {
    "TUTORIAL_SCARECROW",
    "CLAVE_GANGNAM",
    "CELESTIAL_NAMSAN",
    "AEGIS07_SDC",
    "LEVIATHAN_HANRIVER",
    "EXPERIMENT09_PANGYO",
    "SHADOWFANG_GWANAK",
    "ARSENAL_GYERYONG",
    "PARK_GYERYONG",
    "IRONWARDEN_YEOUIDO",
    "LEE_FINAL_LINE",
    "MINISTERJEONG_GOHEUNG",
    "NANONOVA_GOHEUNG",
}

if BOSS_ID not in VALID_BOSS_IDS:
    raise RuntimeError(f"Unknown BOSS_ID: {BOSS_ID}")

actor_sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
selected = actor_sub.get_selected_level_actors()

if not selected:
    raise RuntimeError("Select the actual boss actor first.")

boss = selected[0]

director_cls = unreal.load_class(None, "/Script/HwanghonShelter.HHBossIntroDirector")
anchor_cls = unreal.load_class(None, "/Script/HwanghonShelter.HHBossIntroAnchor")
trigger_cls = unreal.load_class(None, "/Script/HwanghonShelter.HHBossIntroTrigger")

if not director_cls or not anchor_cls or not trigger_cls:
    raise RuntimeError("Compile/enable HwanghonShelter v10 first.")

TAG = "HH_BOSS_INTRO_V10"


def mark(actor, label):
    actor.tags = list(actor.tags) + [
        unreal.Name(TAG),
        unreal.Name("AI_CREATED"),
        unreal.Name("SAFE_TO_REMOVE"),
    ]
    actor.set_actor_label(label)
    return actor


def vadd(a, b):
    return unreal.Vector(a.x+b.x, a.y+b.y, a.z+b.z)


boss_loc = boss.get_actor_location()

# Blockout offsets only. Reframe against the real arena.
offsets = {
    "PlayerEntry": unreal.Vector(-900, -220, 170),
    "Silhouette": unreal.Vector(-650, 0, 220),
    "ScaleReveal": unreal.Vector(-920, 320, 270),
    "SignatureMotion": unreal.Vector(-500, -180, 230),
    "Handback": unreal.Vector(-720, 0, 185),
}

fovs = {
    "PlayerEntry": 52.0,
    "Silhouette": 44.0,
    "ScaleReveal": 58.0,
    "SignatureMotion": 40.0,
    "Handback": 54.0,
}

enum_values = {
    "PlayerEntry": unreal.HHBossIntroBeat.PLAYER_ENTRY,
    "Silhouette": unreal.HHBossIntroBeat.SILHOUETTE,
    "ScaleReveal": unreal.HHBossIntroBeat.SCALE_REVEAL,
    "SignatureMotion": unreal.HHBossIntroBeat.SIGNATURE_MOTION,
    "Handback": unreal.HHBossIntroBeat.HANDBACK,
}

director = actor_sub.spawn_actor_from_class(
    director_cls,
    boss_loc,
    unreal.Rotator()
)
mark(director, f"HH_BossIntroDirector_{BOSS_ID}")
director.set_editor_property("boss_id", unreal.Name(BOSS_ID))
director.set_editor_property("boss_actor", boss)

anchors = []

for key in ["PlayerEntry","Silhouette","ScaleReveal","SignatureMotion","Handback"]:
    a = actor_sub.spawn_actor_from_class(
        anchor_cls,
        vadd(boss_loc, offsets[key]),
        unreal.Rotator(0,0,0)
    )
    mark(a, f"HH_{BOSS_ID}_{key}")
    a.set_editor_property("boss_id", unreal.Name(BOSS_ID))
    a.set_editor_property("beat", enum_values[key])

    try:
        a.camera_component.set_editor_property("field_of_view", fovs[key])
    except Exception:
        pass

    anchors.append(a)

director.set_editor_property("explicit_anchors", anchors)

trigger = actor_sub.spawn_actor_from_class(
    trigger_cls,
    vadd(boss_loc, unreal.Vector(-1150,0,100)),
    unreal.Rotator()
)
mark(trigger, f"HH_BossIntroTrigger_{BOSS_ID}")
trigger.set_editor_property("director", director)

unreal.log(f"[HH BossIntro v10] template created for {BOSS_ID}")
unreal.log("[HH BossIntro v10] IMPORTANT: manually reframe all five cameras against the real boss/arena.")
