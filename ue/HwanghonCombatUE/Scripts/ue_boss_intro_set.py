"""v10 boss intros (docs/design/162): per arena one AHHBossIntroDirector (tag <Prefix>BossIntro, the story director
finds it) and its five AHHBossIntroAnchor cameras, placed from the arena's own markers (<Prefix>BossSpawn,
<Prefix>AinStart). Re-runnable: it first removes what it placed before (tag HW_BossIntro).

The shots follow the novel's entrance of each boss, told in v10's five beats (PlayerEntry, Silhouette, ScaleReveal,
SignatureMotion, Handback). Where v10's shot notes differ from the novel, the novel wins (docs/design/162 §2).

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_boss_intro_set.py" -unattended -nullrhi
"""
import math
import os

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

def big(h):
    """The lock-on camera backs off for a big body (docs/design/150 §7.1: +260 cm arm, +90 cm height per multiple of
    the 3.2 m scarecrow); the handback anchor waits where that camera will be so the last blend stays short."""
    m = min(4.0, max(1.0, h / 320.0))
    return (BEAT.HANDBACK, ("ain", 206 + 260 * (m - 1), -128, 100 + 90 * (m - 1)), ("ain", -150, 54, 149 + 60 * (m - 1)), 70)


# Bosses 02-12 (docs/design/163): each a function of the body height h (cm). Quotes: 제1부_통합본_EP01-28.md.
# The novel wins over v10's places (BOSS_CANON_INDEX §1-2): no Ironwarden, no General Lee, and the tower is its own boss.
SHOTS.update({
    # EP04 L4382-L4402: «위에서 바람 소리가 바뀌었다 ... 하늘에서 그림자가 지나갔다 ... 인간형이 아니었다 ... 펼치면 4미터쯤
    # ... 날갯짓을 하지 않았다 ... 내려오지 않았다». The sky over the broken observatory first, the shape against it,
    # under the membrane looking up, then its dive line from above it down onto the party.
    "CELESTIAL_NAMSAN": lambda h: [
        (BEAT.PLAYER_ENTRY, ("ain", 60, 140, 120), (0, -300, h * 1.7), 62),   # the sky it came out of: the body at the top edge
        (BEAT.SILHOUETTE, ("ain", 150, -300, 50), (0, 0, h * 0.7), 32),       # long lens, low: the shape against the sky
        # (v -60 put Ain's back over the left third of the frame, QA 2026-09-30)
        (BEAT.SCALE_REVEAL, (240, 480, 70), (0, 0, h * 0.62), 62),            # under the wing, looking up its 4 m
        (BEAT.SIGNATURE_MOTION, (-220, 260, h * 1.45), (520, 0, 60), 55),     # «난간 급강하»: over it, down its dive line
        big(h),
    ],
    # EP06 L6217-L6247: «안개 속에서 낮은 구동음이 왔다 ... 옆에서 왔다 ... 쿵. ... 4미터였다. 다각 보행이었고, 상체가 통째로
    # 무기였다. 어깨에 부대 마크 ... 놈이 정지했다. 그리고 아무것도 안 했다». The fog at her side (the LED billboards were
    # the false shape, L6064-L6084), the legs, the shoulder mark over the weapon body, the cannon it opens (L6309).
    "AEGIS07_SDC": lambda h: [
        (BEAT.PLAYER_ENTRY, ("ain", 120, 0, 170), ("ain", -500, -900, 420), 60),   # «옆에서 왔다»: the fog at her side
        (BEAT.SILHOUETTE, (520, 260, 40), (0, 0, h * 0.25), 45),                   # the many legs in the fog
        (BEAT.SCALE_REVEAL, (300, -360, 90), (0, 0, h * 0.85), 58),                # up to the shoulder mark
        (BEAT.SIGNATURE_MOTION, (460, 130, h * 0.72), (0, 0, h * 0.75), 40),       # «상체 포문을 열었다»: the weapon front
        big(h),
    ],
    # EP08 L7448-L7490: «물결이 한 번 크게 흔들렸다 ... 오른쪽이었다 ... 왼쪽에서 왔다 ... 거대한 것이 옆구리를 스치고 지나갔다
    # ... 길었다. 끝이 안 보일 만큼 ... 머리 앞쪽에 격자 같은 것이 있었고, 그것이 열리면서 물이 빨려 들어갔다».
    # The water, the pass from the LEFT at water height, along its flank (never the whole length), the head's grille.
    "LEVIATHAN_HANRIVER": lambda h: [
        (BEAT.PLAYER_ENTRY, ("ain", 80, -170, 130), ("ain", -520, 520, 70), 60),  # the water to the LEFT, the body not yet
        (BEAT.SILHOUETTE, (260, 360, 118), (0, 0, 120), 40),                  # skimming the water, from the left
        (BEAT.SCALE_REVEAL, (160, -240, 140), (-320, 0, 110), 72),            # along the flank: its end out of frame
        (BEAT.SIGNATURE_MOTION, (600, 90, 200), (0, 0, h * 0.5), 40),         # «흡입»: the grille at its head
        # (QA 2026-09-30: the first cut showed the whole body with Ain over it; the signature at 3.3 m sat inside its spines)
        big(h),
    ],
    # EP14 L9816-L9846 / L9985-L9991: «그것은 계단 아래 어둠에 있었다 ... 회백색 덩어리 ... 사람 키 두 배쯤 ... 그것이 몸을
    # 세웠다 ... 가슴에서부터 양옆으로 몸통이 갈라졌고 ... 감싸려는 것이었다». Headlamps looking down into the dark,
    # the grey mass, beside it up its two man-heights, the chest opening (the wrap's wind-up).
    "EXPERIMENT09_PANGYO": lambda h: [
        (BEAT.PLAYER_ENTRY, ("ain", 40, 0, 270), ("ain", -420, -330, 0), 50), # headlamp height, down into the dark floor
        (BEAT.SILHOUETTE, (500, 180, 60), (0, 0, h * 0.4), 35),               # the grey mass, far
        (BEAT.SCALE_REVEAL, (270, -250, 40), (0, 70, h * 0.72), 66),          # two man-heights from its feet
        # (QA 2026-09-30: the first cut showed all of it lit; at 2.85 m its reaching arms were cut at the frame's left)
        (BEAT.SIGNATURE_MOTION, (330, 150, h * 0.55), (0, 0, h * 0.55), 45),  # the chest opening to wrap
        big(h),
    ],
    # EP16 L10663-L10707: «목덜미의 코어가 도려내진 채 ... 뒤집힌 수레. 흩어진 방호복 — 속이 비어 있었다 ... 수풀 그늘 속
    # 움직임 ... 낮고, 길고, 이음매 없는 검은 것 ... 꽃잎처럼 벌어진 감각기 ... 천천히 아인을 향해 정렬했다 ... 예비 동작이
    # 그늘에 녹아 있어 시작이 보이지 않는 돌진». Never centre-front (v10 too): the yard, the edge of a shadow, its low
    # length from the side, then over its sensor toward Ain - the aim is the only tell.
    "SHADOWFANG_GWANAK": lambda h: [
        (BEAT.PLAYER_ENTRY, ("ain", 60, -120, 90), (300, -420, 20), 58),      # the empty suits on the asphalt
        (BEAT.SILHOUETTE, (460, -380, 50), (0, 260, 70), 40),                 # at the frame's edge, in the shade
        (BEAT.SCALE_REVEAL, (60, -420, 35), (0, 0, 60), 55),                  # side-on at the ground: low and long
        (BEAT.SIGNATURE_MOTION, (-320, 220, h * 0.95), ("ain", 0, 0, 100), 50),  # over its sensor, aligning on Ain
        # (at 1.8 m behind it the camera sat inside the stand-in body, QA 2026-09-30)
        big(h),
    ],
    # EP21 L12630-L12671: «장갑차, 자주포, 견인 트레일러. 전부 죽어 있었다 ... 그 죽은 강철의 도열 한가운데에, 죽지 않은 것이
    # 있었다 ... 처음에는 건물인 줄 알았다 ... 포탑과 포탑과 포탑이 탑처럼 얹히고 ... 세라가 그것을 올려다보며 ... 탑의
    # 꼭대기에서 첫 번째 포탑이 다섯을 향해 천천히 돌아갔다». The dead hangar, a building-sized mass, up its stacked
    # turrets, the top turret (the ejection it fires first).
    "ARSENAL_GYERYONG": lambda h: [
        (BEAT.PLAYER_ENTRY, ("ain", 260, 230, 180), (220, 0, 150), 66),       # from the one door: the dead steel in rows
        (BEAT.SILHOUETTE, ("ain", 100, -520, 120), (0, 0, h * 0.5), 58),      # «건물인 줄 알았다»
        (BEAT.SCALE_REVEAL, (760, 260, 40), (0, 0, h * 0.9), 80),             # from its foot up the turret stack
        (BEAT.SIGNATURE_MOTION, ("ain", 0, -380, h * 0.55), (0, 0, h * 0.86), 34),  # the top turret coming round
        # (QA 2026-09-30: its body spreads about 6 m from the centre - at 2.6 m and 5.2 m the camera was inside it)
        big(h),
    ],
    # EP22 L13229-L13283 / EP23 L13326: «소독약 냄새 ... 그 문 앞에, 무언가가 서 있었다 ... 문을 등진 채 부동자세로 서 있는
    # 실루엣 ... 목덜미의 결정이 대답처럼 빛났다 ... 박(朴). 계급장은 준장의 별 ... 원의 끝자락이 도착할 자리에 팔을 세워
    # 기다리고 있었다 ... 카운터야». A man's size at eye level (v10 too: no low angle), the name tag and the star,
    # the counter stance.
    "PARK_GYERYONG": lambda h: [
        (BEAT.PLAYER_ENTRY, ("ain", 80, -120, 150), (0, 0, 150), 45),         # down the corridor: a figure at its end
        # (on the player line Ain's head filled the frame, QA 2026-09-30)
        (BEAT.SILHOUETTE, (460, 60, 150), (0, 0, 120), 30),                   # at attention, the door at his back
        (BEAT.SCALE_REVEAL, (170, -60, 150), (0, 0, h * 0.76), 35),           # the name tag and the star
        (BEAT.SIGNATURE_MOTION, (280, 170, 140), (0, 0, h * 0.62), 45),       # the arm set for the counter
        big(h),
    ],
    # EP25 L14218-L14228 / EP26 L14273-L14287: «대열이 갈라졌다 ... 그 열린 길의 저편에서, 무언가가 걸어오고 있었다 ... 사람의
    # 걸음 ... 서두르지 않는, 지휘하는 자 특유의 속도 ... 정복 ... 별 넷 ... 대열의 끝에서 멈췄다 ... 허리의 군도를 뽑았다».
    # He walks in (like Clave), the uniform and four stars, the draw - the circle his fight is.
    "MINISTERJEONG_GOHEUNG": lambda h: [
        (BEAT.PLAYER_ENTRY, ("ain", 60, 80, 160), (0, 0, 120), 40),           # down the parted road, a man walking
        (BEAT.SILHOUETTE, (420, -90, 30), (40, 0, 100), 38),                  # road level: the pace of the steps
        (BEAT.SCALE_REVEAL, (300, 90, 170), (80, 0, h * 0.85), 38),           # the uniform, four stars
        (BEAT.SIGNATURE_MOTION, (420, -260, 120), (110, 0, h * 0.6), 45),     # the sabre drawn for the circle
        # (QA 2026-09-30: at Clave's pace he came 3.4 m and walked past the last two cameras - now slower, see IntroChoreoFor)
        big(h),
    ],
    # EP27 L14512-L14544 / L14720-L14730: «벽 자체가 결정이었다 ... 견인 레일 ... 처음에는 크기가 보였다 ... 지하 공간의 절반을
    # 채운 결정의 산 ... 얼굴만은 — 잔인할 만큼 온전한 얼굴 ... 산이, 눈을 떴다 ... 산이 일어섰다 ... 첫 번째 팔이 셔터를
    # 방패처럼 세웠다». Rails to its foot, the size (cropped - never the whole giant), the face, the first arm's shutter.
    "NANONOVA_GOHEUNG": lambda h: [
        (BEAT.PLAYER_ENTRY, ("ain", 100, -150, 110), (500, 0, 20), 60),       # the rails running in to its foot
        (BEAT.SILHOUETTE, ("ain", 200, 480, 230), (0, 0, h * 0.45), 38),      # «처음에는 크기가 보였다»
        (BEAT.SCALE_REVEAL, (360, 0, h * 0.45), (0, 0, h * 0.5), 35),         # the face in the mountain
        (BEAT.SIGNATURE_MOTION, (620, 120, h * 0.35), (0, 320, h * 0.75), 50),  # the shutter arm set like a shield
        # (QA 2026-09-30: Ain's head in the silhouette's corner; the shutter arm stands high on its right, out of the first frame)
        big(h),
    ],
    # EP25 L14060 / EP28 L14988-L15016 / L15040: «발사대의 탑 위로, 하늘이 비어 있었다 ... 발사대는 노래하고 있었다 ...
    # 주각(主脚) 넷, 그것을 잇는 트러스 ... 결정이 신경처럼 타고 오른 케이블 다발 ... 이 년 동안 이 반도에서 가장 높았던 것».
    # It does not move and has no attack: the empty sky, its outline, up a leg and the truss, the singing cables.
    "AMPLIFIER_TOWER_GOHEUNG": lambda h: [
        (BEAT.PLAYER_ENTRY, ("ain", 100, 0, 150), (0, 0, h * 1.1), 55),       # «하늘이 비어 있었다»
        (BEAT.SILHOUETTE, ("ain", 500, -750, 40), (0, 0, h * 0.6), 35),       # against the dawn, from far and low
        (BEAT.SCALE_REVEAL, (1000, 320, 30), (0, 0, h * 0.8), 70),            # up the leg and the truss
        (BEAT.SIGNATURE_MOTION, (1050, -420, h * 0.3), (0, 0, h * 0.5), 32),  # the crystal-veined cables that sing
        # (QA 2026-09-30: the party stood in the silhouette; its base spreads ~6 m, so 2-5 m cameras were inside it)
        big(h),
    ],
})

# world, marker prefix, v10 boss id, short version (a boss met before), base data layer, body height (cm).
# Only the novel's bosses (BOSS_CANON_INDEX §1): the first fight with a boss in an episode opens with it, a boss met in an
# earlier episode gets the short version. The non-boss fights (droppers, Lt. Hyun, the executioner, EP10-11 Claves) have none.
ARENAS = [
    ("/Game/Hwanghon/Story/EP01/EP01_TrainingRoom_World", "", "TUTORIAL_SCARECROW", False, "DL_Arena_Base", 320),
    ("/Game/Hwanghon/Story/EP02/EP02_World", "B1_", "CLAVE_GANGNAM", False, "DL_Base", 250),
    ("/Game/Hwanghon/Story/EP03/EP03_World", "B1_", "CLAVE_GANGNAM", True, "DL_Base", 250),
    ("/Game/Hwanghon/Story/EP03/EP03_World", "B2_", "CLAVE_GANGNAM", True, "DL_Base", 250),
    ("/Game/Hwanghon/Story/EP04/EP04_World", "B1_", "CELESTIAL_NAMSAN", False, "DL_Base", 400),
    ("/Game/Hwanghon/Story/EP06/EP06_World", "B1_", "AEGIS07_SDC", False, "DL_Base", 400),
    ("/Game/Hwanghon/Story/EP07/EP07_World", "B1_", "AEGIS07_SDC", True, "DL_Base", 400),
    ("/Game/Hwanghon/Story/EP08/EP08_World", "B1_", "LEVIATHAN_HANRIVER", False, "DL_Base", 220),
    ("/Game/Hwanghon/Story/EP09/EP09_World", "B1_", "LEVIATHAN_HANRIVER", True, "DL_Base", 220),
    ("/Game/Hwanghon/Story/EP14/EP14_World", "B1_", "EXPERIMENT09_PANGYO", False, "DL_Base", 240),
    ("/Game/Hwanghon/Story/EP15/EP15_World", "B1_", "EXPERIMENT09_PANGYO", True, "DL_Base", 240),
    ("/Game/Hwanghon/Story/EP16/EP16_World", "B1_", "SHADOWFANG_GWANAK", False, "DL_Base", 260),
    ("/Game/Hwanghon/Story/EP17/EP17_World", "B1_", "SHADOWFANG_GWANAK", True, "DL_Base", 260),
    ("/Game/Hwanghon/Story/EP17/EP17_World", "B3_", "CELESTIAL_NAMSAN", True, "DL_Base", 400),
    ("/Game/Hwanghon/Story/EP21/EP21_World", "B1_", "ARSENAL_GYERYONG", False, "DL_Base", 800),
    ("/Game/Hwanghon/Story/EP22/EP22_World", "B1_", "ARSENAL_GYERYONG", True, "DL_Base", 800),
    ("/Game/Hwanghon/Story/EP23/EP23_World", "B1_", "PARK_GYERYONG", False, "DL_Base", 190),
    ("/Game/Hwanghon/Story/EP26/EP26_World", "B1_", "MINISTERJEONG_GOHEUNG", False, "DL_Base", 180),
    ("/Game/Hwanghon/Story/EP27/EP27_World", "B1_", "NANONOVA_GOHEUNG", False, "DL_Base", 890),
    ("/Game/Hwanghon/Story/EP28/EP28_World", "B1_", "AMPLIFIER_TOWER_GOHEUNG", False, "DL_Base", 1600),
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


def place(prefix, boss_id, short, layer_name, h):
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
    shots = spec(h) if callable(spec) else spec["shots"]
    anchor_cls = unreal.load_class(None, "/Script/HwanghonShelter.HHBossIntroAnchor")
    anchors = []
    placed = []
    for beat, cam, look, fov in shots:
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
        if os.environ.get("HW_INTRO_CLEAR") == "1":   # director 2026-09-30: camera-cut intros out of the game (doc 163)
            les.save_current_level()
            log(f"cleared {w} (removed {len(old)})")
            continue
        for world, prefix, boss_id, short, layer, h in ARENAS:
            if world == w:
                place(prefix, boss_id, short, layer, h)
        les.save_current_level()
        log(f"saved {w} (removed {len(old)})")


main()
