"""EP01 scarecrow awakening, in the engine (docs/design/164 §3.3): a Level Sequence in the dressed training set.

Canon (마감본 EP01):
  L425  «갈라진 짚단 안쪽에서, 붉은 빛이 새어 나오고 있었다. 문양이었다. 균열을 따라 번지고 있었다.»
  L427  «카인! 물러나!»   L429 «…뭐?»
  L431-433  «키이이이— 콰아아아앙—!!! 섬광이 시야를 삼켰다. 검은 연기와 주황색 파티클이 폭포처럼 쏟아졌고,
             철사슬이 차강—! 끊어져 튕겨 나갔다. 충격파에 두 사람이 매트 위를 굴렀다.»
  L435-439  «연기 속에서, 붉은 안광 두 점이 켜졌다. 그드득… 짚단 사이를 뚫고 나온 나노 강선이 근육처럼 뒤엉켜 …
             팔은 비정상적으로 길었고, 키는 3미터에 달했다.»

The body inside the straw is the fight's own body (boss_anim): hidden in the straw shell, it rises with its "up" clip
in the smoke. Ain and Kain are the game's current bodies (Countess skins) - placeholders until the MetaHuman track.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_ep01_awakening_seq.py" -unattended -nullrhi
"""
import unreal

MAP = "/Game/Hwanghon/Story/EP01/Set/EP01_TrainingSet"
SEQ_DIR = "/Game/Hwanghon/Story/EP01/Set"
SEQ = "LS_EP01_Awakening"
FPS = 30
TAG = "HW_Awakening"
BOSS_ANIM = "/Game/Bosses/Training/boss_anim/SkeletalMeshes/"
COUNTESS = "/Game/ParagonCountess/Characters/Heroes/Countess/"
STRAW_TEX_SRC = r"C:\w\hwanghon\art\env\straw.png"   # webp does not import
WOOD = "/Game/DerelictCorridor/Assets/Fab/Megascans/3D/Ind_Mine_Beam_Square_Wood_Worn_01/SM_Ind_Mine_Beam_Square_Wood_Worn_01"
BURST = COUNTESS + "FX/P_Countess_RD_CastBurst"
BOSS = unreal.Vector(1050, 0, 0)
AIN = unreal.Vector(430, 40, 0)
KAIN = unreal.Vector(560, -150, 0)

eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
lib = unreal.EditorAssetLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()
mel = unreal.MaterialEditingLibrary


def log(m):
    unreal.log(f"[HWAwake] {m}")


def rot(yaw=0.0, pitch=0.0, roll=0.0):
    return unreal.Rotator(roll=roll, pitch=pitch, yaw=yaw)


def tagged(a, label):
    a.tags = [unreal.Name(TAG)]
    a.set_actor_label(label)
    return a


# ------------------------------------------------------------------ straw material and the ordinary dummy
def straw_material():
    path = f"{SEQ_DIR}/M_Straw"
    if lib.does_asset_exist(path):
        return unreal.load_asset(path)
    task = unreal.AssetImportTask()
    task.filename = STRAW_TEX_SRC
    task.destination_path = SEQ_DIR
    task.destination_name = "T_Straw"
    task.automated = True
    task.save = True
    tools.import_asset_tasks([task])
    tex = unreal.load_asset(f"{SEQ_DIR}/T_Straw")
    m = tools.create_asset("M_Straw", SEQ_DIR, unreal.Material, unreal.MaterialFactoryNew())
    ts = mel.create_material_expression(m, unreal.MaterialExpressionTextureSample, -400, 0)
    ts.texture = tex
    mel.connect_material_property(ts, "RGB", unreal.MaterialProperty.MP_BASE_COLOR)
    rough = mel.create_material_expression(m, unreal.MaterialExpressionConstant, -400, 200)
    rough.r = 0.9
    mel.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    mel.recompile_material(m)
    lib.save_loaded_asset(m)
    return m


def dummy():
    """«철사슬에 묶인 낡은 훈련용 짚단 허수아비 … 짚이 삐져나왔고, 나무 뼈대가 한쪽으로 기울어 있었다» (L373)."""
    straw = straw_material()
    parts = []
    tilt = 7.0
    beam = unreal.load_asset(WOOD)
    post = eas.spawn_actor_from_object(beam, BOSS, rot(pitch=90 - tilt))
    o, e = post.get_actor_bounds(False)
    k = 190.0 / max(1.0, 2 * max(e.x, e.y, e.z))
    post.set_actor_scale3d(unreal.Vector(k, k * 0.6, k * 0.6))
    parts.append(tagged(post, "Dummy_Post"))
    bar = eas.spawn_actor_from_object(beam, BOSS + unreal.Vector(-10, 0, 135), rot(yaw=90))
    bar.set_actor_scale3d(unreal.Vector(k * 0.55, k * 0.45, k * 0.45))
    parts.append(tagged(bar, "Dummy_Bar"))
    cyl = unreal.load_asset("/Engine/BasicShapes/Cylinder.Cylinder")
    for label, off, sc in (("Dummy_Body", (-8, 0, 110), (0.62, 0.55, 0.85)),
                           ("Dummy_Head", (-14, 0, 172), (0.36, 0.34, 0.36)),
                           ("Dummy_Waist", (-4, 0, 62), (0.5, 0.45, 0.3))):
        a = eas.spawn_actor_from_object(cyl, BOSS + unreal.Vector(*off), rot(pitch=-tilt))
        a.set_actor_scale3d(unreal.Vector(*sc))
        a.static_mesh_component.set_material(0, straw)
        parts.append(tagged(a, label))
    return parts


# ------------------------------------------------------------------ cast and lights
def skel(label, mesh, loc, yaw, scale=1.0):
    a = eas.spawn_actor_from_class(unreal.SkeletalMeshActor, loc, rot(yaw=yaw))
    a.skeletal_mesh_component.set_skinned_asset_and_update(unreal.load_asset(mesh))
    a.set_actor_scale3d(unreal.Vector(scale, scale, scale))
    return tagged(a, label)


def point(label, loc, color, radius=600.0):
    a = eas.spawn_actor_from_class(unreal.PointLight, loc, rot())
    c = a.point_light_component
    c.set_editor_property("intensity", 0.0)
    # unreal.Color's positional order is B, G, R, A: the first render lit the ember and the eyes blue
    c.set_editor_property("light_color", unreal.Color(r=color[0], g=color[1], b=color[2], a=255))
    c.set_editor_property("attenuation_radius", radius)
    c.set_editor_property("use_inverse_squared_falloff", True)
    return tagged(a, label)


def cine(label, loc, look, focal):
    a = eas.spawn_actor_from_class(unreal.CineCameraActor, unreal.Vector(*loc),
                                   unreal.MathLibrary.find_look_at_rotation(unreal.Vector(*loc), unreal.Vector(*look)))
    cc = a.get_cine_camera_component()
    cc.current_focal_length = focal
    fs = cc.focus_settings
    fs.focus_method = unreal.CameraFocusMethod.MANUAL
    fs.manual_focus_distance = (unreal.Vector(*look) - unreal.Vector(*loc)).length()
    cc.focus_settings = fs
    return tagged(a, label)


# ------------------------------------------------------------------ sequencer helpers
TICKS = 24000   # the sequence's tick resolution (set below); section ranges are set in seconds


def f(t):
    # channel add_key() takes DISPLAY-rate frames by default: tick-rate keys all landed past the end (2026-09-30)
    return unreal.FrameNumber(int(round(t * FPS)))


def keys(section, channel_index, pts):
    ch = section.get_all_channels()[channel_index]
    for t, v in pts:
        ch.add_key(f(t), float(v))


def light_track(seq, actor, pts):
    b = seq.add_possessable(actor)
    comp = actor.get_component_by_class(unreal.LocalLightComponent)
    cb = seq.add_possessable(comp)
    cb.set_parent(b)
    tr = cb.add_track(unreal.MovieSceneFloatTrack)
    tr.set_property_name_and_path("Intensity", "Intensity")
    s = tr.add_section()
    s.set_range_seconds(0.0, TOTAL)
    keys(s, 0, pts)


def visible(seq, actor, pts):
    """pts: (t, shown) - drives the actor's bHiddenInGame (the sequence's visibility track)."""
    b = seq.add_possessable(actor)
    tr = b.add_track(unreal.MovieSceneVisibilityTrack)
    tr.set_property_name_and_path("bHiddenInGame", "bHiddenInGame")
    s = tr.add_section()
    s.set_range_seconds(0.0, TOTAL)
    ch = s.get_all_channels()[0]
    for t, shown in pts:
        ch.add_key(f(t), bool(shown))   # the visibility channel stores "visible" (the first render had it inverted)


def anim(seq, actor, clips):
    """clips: (start s, end s, AnimSequence path, play rate)."""
    b = seq.add_possessable(actor)
    tr = b.add_track(unreal.MovieSceneSkeletalAnimationTrack)
    for a, e, path, rate in clips:
        s = tr.add_section()
        s.set_range_seconds(a, e)
        p = s.params
        p.animation = unreal.load_asset(path)
        s.params = p   # play rate is a time-warp struct in 5.8: clips play at their own speed, ranges fit them


def cam_move(seq, cam, t0, t1, start, end):
    """start/end: ((x, y, z), (pitch, yaw, roll)) world transforms."""
    b = seq.add_possessable(cam)
    tr = b.add_track(unreal.MovieScene3DTransformTrack)
    s = tr.add_section()
    s.set_range_seconds(0.0, TOTAL)
    for t, (loc, r) in ((t0, start), (t1, end)):
        for i, v in enumerate(loc):
            keys(s, i, [(t, v)])
        keys(s, 3, [(t, r[2])])   # roll
        keys(s, 4, [(t, r[0])])   # pitch
        keys(s, 5, [(t, r[1])])   # yaw
    return b


def look(frm, to):
    r = unreal.MathLibrary.find_look_at_rotation(unreal.Vector(*frm), unreal.Vector(*to))
    return (tuple(frm), (r.pitch, r.yaw, r.roll))


TOTAL = 11.0


def main():
    les.load_level(MAP)
    old = [a for a in eas.get_all_level_actors() if TAG in [str(t) for t in a.tags]]
    eas.destroy_actors(old)
    # the fight's body faces the door (MeshYaw -90 in DefaultGame.ini: the mesh looks down +Y)
    for a in eas.get_all_level_actors():
        if a.get_actor_label() == "Scarecrow_3m":
            eas.destroy_actor(a)
    boss = skel("Awake_Boss", BOSS_ANIM + "boss_anim", BOSS, 90.0, 0.98)
    ain = skel("Awake_Ain", COUNTESS + "Meshes/SM_Countess", AIN, 0.0)
    kain = skel("Awake_Kain", COUNTESS + "Skins/Tier2/Shogun/Meshes/SM_Countess_Shogun", KAIN, 10.0, 1.1)
    straw = dummy()
    core = point("Awake_CoreRed", BOSS + unreal.Vector(-20, 0, 110), (255, 40, 10), 500)
    flash = point("Awake_Flash", BOSS + unreal.Vector(-60, 0, 120), (255, 230, 200), 2500)
    ember = point("Awake_Ember", BOSS + unreal.Vector(-120, 0, 15), (255, 110, 30), 700)
    eye_l = point("Awake_EyeL", BOSS + unreal.Vector(-18, -9, 283), (255, 20, 5), 120)
    eye_r = point("Awake_EyeR", BOSS + unreal.Vector(-18, 9, 283), (255, 20, 5), 120)
    burst = eas.spawn_actor_from_class(unreal.Emitter, BOSS + unreal.Vector(0, 0, 100), rot())
    burst.particle_system_component.set_template(unreal.load_asset(BURST))
    burst.particle_system_component.set_editor_property("auto_activate", False)
    tagged(burst, "Awake_Burst")

    # cameras (world space); BOSS at x=1050 faces -X toward Ain
    c1 = cine("Awake_CAM1_StrawCU", (880, -60, 120), (1050, 0, 110), 50)
    c2 = cine("Awake_CAM2_AinCU", (560, 150, 160), (430, 40, 158), 85)
    c3 = cine("Awake_CAM3_OverShoulders", (300, 120, 170), (1050, 0, 110), 35)
    c4 = cine("Awake_CAM4_WideSide", (760, -470, 150), (900, 0, 90), 24)
    c5 = cine("Awake_CAM5_EyesInSmoke", (760, 40, 250), (1040, 0, 282), 85)
    c6 = cine("Awake_CAM6_LowReveal", (600, -250, 45), (1050, 0, 90), 20)

    if lib.does_asset_exist(f"{SEQ_DIR}/{SEQ}"):
        lib.delete_asset(f"{SEQ_DIR}/{SEQ}")
    seq = tools.create_asset(SEQ, SEQ_DIR, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    seq.set_display_rate(unreal.FrameRate(FPS, 1))
    seq.set_tick_resolution(unreal.FrameRate(TICKS, 1))
    seq.set_playback_start(0)
    seq.set_playback_end(int(TOTAL * FPS))

    cuts = seq.add_track(unreal.MovieSceneCameraCutTrack)
    for cam, a, b in ((c1, 0.0, 2.4), (c2, 2.4, 3.4), (c3, 3.4, 4.8), (c4, 4.8, 6.6), (c5, 6.6, 8.0), (c6, 8.0, TOTAL)):
        bind = seq.add_possessable(cam)
        s = cuts.add_section()
        s.set_range_seconds(a, b)
        s.set_camera_binding_id(seq.get_binding_id(bind))
    # slow push-in on the straw, and the low reveal tilting up the 3 m body
    cam_move(seq, c1, 0.0, 2.4, look((880, -60, 120), (1050, 0, 110)), look((960, -30, 118), (1050, 0, 110)))
    cam_move(seq, c6, 8.0, TOTAL, look((600, -250, 45), (1050, 0, 90)), look((590, -262, 40), (1050, 0, 290)))

    # «붉은 빛이 새어 나오고» → «키이이이—» (a point tightening) → the flash
    light_track(seq, core, [(0.0, 0), (0.6, 8), (2.4, 40), (3.9, 80), (4.25, 900), (4.35, 0)])
    light_track(seq, flash, [(0.0, 0), (4.28, 0), (4.33, 60000), (4.7, 3000), (5.4, 0)])
    light_track(seq, ember, [(0.0, 0), (4.4, 0), (4.6, 900), (6.6, 150), (8.0, 400), (TOTAL, 700)])
    for eye in (eye_l, eye_r):
        light_track(seq, eye, [(0.0, 0), (6.95, 0), (7.1, 60), (7.3, 25), (TOTAL, 30)])
    # the straw is gone in the flash; the body is there after it
    for p in straw:
        visible(seq, p, [(0.0, True), (4.33, False)])
    # the body is only there once the smoke is (the lie/up clips floated a metre off the floor on this rig)
    visible(seq, boss, [(0.0, False), (6.4, True)])
    # explosion particles
    bb = seq.add_possessable(burst)
    ptr = bb.add_track(unreal.MovieSceneParticleTrack)
    ps = ptr.add_section()
    ps.set_range_seconds(0.0, TOTAL)
    ch = ps.get_all_channels()[0]
    pk = getattr(unreal, "ParticleKey", None)   # EParticleKey: Activate=0, Deactivate=1, Trigger=2
    for t, name, raw in ((0.0, "DEACTIVATE", 1), (4.33, "ACTIVATE", 0)):
        try:
            ch.add_key(f(t), getattr(pk, name) if pk else raw)
        except Exception as e:
            log(f"particle key {name}: {e}")
    # «검은 연기»: the room's dust fog swells at the blast and thins as the body is revealed
    fog = [a for a in eas.get_all_level_actors() if isinstance(a, unreal.ExponentialHeightFog)]
    if fog:
        fb = seq.add_possessable(fog[0])
        cb = seq.add_possessable(fog[0].component)
        cb.set_parent(fb)
        tr = cb.add_track(unreal.MovieSceneFloatTrack)
        tr.set_property_name_and_path("FogDensity", "FogDensity")
        s_ = tr.add_section()
        s_.set_range_seconds(0.0, TOTAL)
        keys(s_, 0, [(0.0, 0.035), (4.3, 0.035), (4.6, 0.9), (6.6, 0.45), (8.5, 0.18), (TOTAL, 0.12)])
        fc = fog[0].component   # «검은 연기»: a dark fog, not the white-out of v3
        for name, val in (("fog_inscattering_luminance", unreal.LinearColor(0.004, 0.003, 0.003, 1)),
                          ("volumetric_fog_albedo", unreal.Color(r=40, g=34, b=30, a=255)),
                          ("volumetric_fog_extinction_scale", 2.5)):
            try:
                fc.set_editor_property(name, val)
            except Exception as e:
                log(f"fog {name}: {e}")
    # white-out: «섬광이 시야를 삼켰다»
    fade = seq.add_track(unreal.MovieSceneFadeTrack)
    fs = fade.add_section()
    fs.set_range_seconds(0.0, TOTAL)
    fs.set_editor_property("fade_color", unreal.LinearColor(1.0, 0.95, 0.9, 1.0))
    keys(fs, 0, [(0.0, 0), (4.28, 0), (4.36, 1.0), (4.55, 1.0), (4.95, 0.0)])
    # bodies: idle, then thrown back (L433); the scarecrow lies in the smoke, then rises (L435-439)
    up = unreal.load_asset(BOSS_ANIM + "boss_animup")
    up_len = up.get_play_length() if up else 2.5
    rise_rate = 1.0
    rise_end = min(TOTAL - 0.5, 6.6 + up_len)
    anim(seq, boss, [(6.4, TOTAL, BOSS_ANIM + "boss_animidle", 1.0)])
    for who in (ain, kain):
        anim(seq, who, [(0.0, 4.4, COUNTESS + "Animations/Idle_Relaxed", 1.0), (4.4, 6.2, COUNTESS + "Animations/Knock_Bwd", 1.0),
                        (6.2, TOTAL, COUNTESS + "Animations/Stun_Loop", 1.0)])
    lib.save_loaded_asset(seq)
    les.save_current_level()
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    log(f"{SEQ}: {TOTAL}s, up clip {up_len:.2f}s at rate {rise_rate:.2f}")


main()
