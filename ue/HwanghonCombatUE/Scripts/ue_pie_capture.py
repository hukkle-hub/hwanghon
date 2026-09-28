"""
Scripted PIE capture of the graybox fight (docs/design/125).

  UnrealEditor.exe HwanghonCombatUE.uproject /Game/Maps/Seohan_Combat_VS01 ^
      -ExecutePythonScript=<abs>/Scripts/ue_pie_capture.py -benchmark -fps=30 ^
      -ini:EditorPerProjectUserSettings:[/Script/UnrealEd.EditorPerformanceSettings]:bThrottleCPUWhenNotForeground=False

-benchmark -fps=30 fixes the step at 1/30 s, so game time does not depend on how
long each screenshot takes. The bot plays through the same public calls the input
bindings use (UHWCombatComponent::Request*, UHWLockOnComponent::ToggleLockOn):
lock on, walk in, 1->2->3 then smash, and answer boss strikes with counter
(Slam, HookCombo beat 3), jump (GroundWave, jumpOnly) or dodge (Charge, Spin,
HookCombo opening). Every SHOT_EVERY-th frame is saved with HighResShot and
each frame's state goes to Saved/Capture/pie_log_<view>.json.
Screenshots land in Saved/Screenshots/WindowsEditor (cleared at PIE start).
"""
from __future__ import annotations

import json
import math
import os
import time
from pathlib import Path
import unreal

DURATION = float(os.environ.get("HW_CAPTURE_SECONDS", "22"))
SHOT_EVERY = int(os.environ.get("HW_CAPTURE_SHOT_EVERY", "2"))
RES = os.environ.get("HW_CAPTURE_RES", "1280x720")
WARM_WALL_SECONDS = float(os.environ.get("HW_CAPTURE_WARM", "20"))
# "game" = the lock-on camera as played. "side" = review camera beside the two
# fighters (full bodies, feet visible); gameplay is identical, only the view target changes.
VIEW = os.environ.get("HW_CAPTURE_VIEW", "game")

PROJECT = Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
OUT = PROJECT / "Saved/Capture"
SHOTS = PROJECT / "Saved/Screenshots/WindowsEditor"

# Tell durations (HWCombatTuningAsset.cpp); offense only starts when the swing fits.
TELL = {"HookCombo": 0.75, "Charge": 1.00, "Slam": 1.25, "Spin": 1.45, "GroundWave": 1.15}
# Seconds after Strike entry at which to answer, per pattern.
DEFENSE = {
    "Slam": [(0.00, "counter")],                       # counterable beat at 0.12
    "HookCombo": [(0.00, "dodge"), (1.03, "counter")],  # beat 3 counterable at 1.15
    "GroundWave": [(0.00, "jump")],                     # jumpOnly
    "Charge": [(0.00, "dodge")],
    "Spin": [(0.00, "dodge")],
}
SWING = 0.70
CANCEL_AT = 0.48   # attack1/2/3 cancel point (combo handoff)
DEF_CANCEL = 0.39  # dodge/jump may cancel an attack only after this

les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
ues = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
GS = unreal.GameplayStatics
A = unreal.HWActionType
B = unreal.HWBossState

S = {
    "phase": "boot", "wall0": time.time(), "frame": 0, "shots": 0, "t0": None,
    "boss_state": None, "strike_t0": None, "tell_t0": None, "pattern": "",
    "answered": set(), "plan": "combo", "pressed_for": None, "rows": [], "events": [],
    "handle": None, "end_frames": 0,
}


def name(e) -> str:
    return str(e).split(".")[-1].split(":")[0].strip("<> ")


def ev(t, what, ok=None, **kw):
    S["events"].append({"t": round(t, 4), "frame": S["frame"], "what": what, "ok": ok, **kw})


def drive(world, t):
    pawn = GS.get_player_character(world, 0)
    boss = GS.get_actor_of_class(world, unreal.HWBossCharacter)
    if not pawn or not boss:
        return None
    combat = pawn.get_combat()
    lock = pawn.get_lock_on()
    pres = pawn.get_presentation()

    bs = boss.get_boss_state()
    pattern = str(boss.get_current_pattern_id())
    if bs != S["boss_state"]:
        ev(t, f"boss:{name(bs)}", pattern=pattern)
        if bs == B.TELL:
            S["tell_t0"] = t
        if bs == B.STRIKE:
            S["strike_t0"] = t
            S["answered"] = set()
        S["boss_state"] = bs
        S["pattern"] = pattern

    pl = pawn.get_actor_location()
    bl = boss.get_actor_location()
    dx, dy = bl.x - pl.x, bl.y - pl.y
    dist = math.hypot(dx, dy)
    if VIEW == "side":
        side_camera(world, pl, bl, dist)
    action = combat.get_current_action()
    elapsed = combat.get_action_elapsed()

    if t >= 1.0 and not lock.is_locked():
        lock.toggle_lock_on()
        ev(t, "lockon", lock.is_locked())

    # Defense first.
    if bs == B.STRIKE and S["strike_t0"] is not None:
        r = t - S["strike_t0"]
        for i, (at, what) in enumerate(DEFENSE.get(pattern, [])):
            if r >= at and i not in S["answered"]:
                S["answered"].add(i)
                ok = {"counter": combat.request_counter, "dodge": combat.request_dodge,
                      "jump": combat.request_jump}[what]()
                ev(t, what, ok, pattern=pattern, strike_r=round(r, 3))

    # Offense. Seconds until the boss strikes (inf when it is not winding up).
    if bs == B.STRIKE:
        to_strike = 0.0
    elif bs == B.TELL and S["tell_t0"] is not None:
        to_strike = TELL.get(pattern, 1.0) - (t - S["tell_t0"])
    else:
        to_strike = math.inf
    can_start = to_strike > SWING
    if action == A.NONE:
        S["pressed_for"] = None
        if dist > 200.0:
            if t >= 1.0:
                pawn.add_movement_input(unreal.Vector(dx / dist, dy / dist, 0.0), 1.0)
        elif can_start and t >= 1.2:
            if S["plan"] == "smash":
                ok = combat.request_smash()
                ev(t, "smash", ok)
                if ok:
                    S["plan"] = "combo"
            else:
                ok = combat.request_attack()
                ev(t, "attack", ok, into="Attack1")
    elif action in (A.ATTACK1, A.ATTACK2) and elapsed >= 0.36 and S["pressed_for"] != action:
        S["pressed_for"] = action
        # The next swing starts at this one's cancel point and can only be
        # defensively cancelled DEF_CANCEL later; stop the chain if the strike lands first.
        if to_strike > (CANCEL_AT - elapsed) + DEF_CANCEL + 0.05:
            ok = combat.request_attack()
            ev(t, "attack", ok, into="Attack2" if action == A.ATTACK1 else "Attack3")
        else:
            ev(t, "hold-combo", None, to_strike=round(to_strike, 3))
    elif action == A.ATTACK3:
        S["plan"] = "smash"

    return {
        "t": round(t, 4), "frame": S["frame"], "action": name(action), "elapsed": round(elapsed, 4),
        "hp": round(combat.get_health(), 1), "st": round(combat.get_stamina(), 1),
        "boss": name(bs), "pattern": pattern, "boss_hp": round(boss.get_health(), 1),
        "dist": round(dist, 1), "locked": lock.is_locked(),
        "src_norm": round(pres.get_active_source_normalized(), 4),
        "src_seq": pres.get_active_sequence().get_name() if pres.get_active_sequence() else "",
        "counter_active": combat.is_counter_active(), "invuln": combat.is_invulnerable(),
        "montage": anim_state(pawn),
    }


def side_camera(world, pl, bl, dist):
    cam = S.get("cam")
    if cam is None:
        # Placed by ue_graybox_anim_setup.py (Python cannot spawn into the PIE world).
        cams = [c for c in GS.get_all_actors_of_class(world, unreal.CameraActor)
                if c.get_actor_label() == "ReviewCamera"]
        if not cams:
            raise RuntimeError("ReviewCamera not in map; rerun ue_graybox_anim_setup.py")
        cam = cams[0]
        cam.camera_component.set_field_of_view(50.0)
        GS.get_player_controller(world, 0).set_view_target_with_blend(cam, 0.0)
        S["cam"] = cam
        S["cam_side"] = None
    mid = unreal.Vector((pl.x + bl.x) * 0.5, (pl.y + bl.y) * 0.5, 0.0)
    fx, fy = ((bl.x - pl.x) / dist, (bl.y - pl.y) / dist) if dist > 1.0 else (1.0, 0.0)
    # Stay on one side of the fight line; flipping would mirror the image.
    px, py = -fy, fx
    if S["cam_side"] is None:
        S["cam_side"] = 1.0
    px, py = px * S["cam_side"], py * S["cam_side"]
    back = max(620.0, dist * 1.4 + 380.0)
    loc = unreal.Vector(mid.x + px * back, mid.y + py * back, 170.0)
    look = unreal.Vector(mid.x, mid.y, 105.0)
    cam.set_actor_location_and_rotation(loc, unreal.MathLibrary.find_look_at_rotation(loc, look), False, True)


def anim_state(pawn):
    """Whether the body is actually playing the presentation montage (slot must be in the AnimBP output)."""
    ai = pawn.get_editor_property("mesh").get_anim_instance()
    if not ai:
        return "no-anim-instance"
    slots = [s for s in ("FullBody", "UpperBody", "DefaultSlot") if ai.is_slot_active(s)]
    return ("playing:" + "+".join(slots)) if ai.montage_is_playing(None) else "-"


def finish():
    OUT.mkdir(parents=True, exist_ok=True)
    log_path = OUT / f"pie_log_{VIEW}.json"
    log_path.write_text(json.dumps({
        "view": VIEW, "shot_every": SHOT_EVERY,
        "res": RES, "duration": DURATION, "rows": S["rows"], "events": S["events"],
    }, indent=1), encoding="utf-8")
    unreal.log(f"[HwanghonCapture] wrote {log_path} rows={len(S['rows'])} shots={S['shots']}")


def tick(dt):
    try:
        _tick(dt)
    except Exception as ex:  # never leave the editor running headless-forever
        unreal.log_error(f"[HwanghonCapture] {ex!r}")
        S["phase"] = "ending"


def _tick(dt):
    phase = S["phase"]
    if phase == "boot":
        if time.time() - S["wall0"] >= WARM_WALL_SECONDS:
            if SHOTS.exists():
                for p in SHOTS.glob("HighresScreenshot*.png"):
                    p.unlink()
            les.editor_request_begin_play()
            S["phase"] = "starting"
    elif phase == "starting":
        world = ues.get_game_world()
        if world:
            S["world"] = world
            S["t0"] = GS.get_time_seconds(world)
            S["phase"] = "run"
            unreal.log("[HwanghonCapture] PIE running")
    elif phase == "run":
        world = ues.get_game_world()
        if not world:
            S["phase"] = "ending"
            return
        t = GS.get_time_seconds(world) - S["t0"]
        # Slate ticks many times per game frame here; act once per game frame.
        if S.get("last_t") is not None and t <= S["last_t"]:
            return
        S["last_t"] = t
        row = drive(world, t)
        if row:
            if S["frame"] % SHOT_EVERY == 0:
                unreal.SystemLibrary.execute_console_command(world, f"HighResShot {RES}")
                row["shot"] = S["shots"]
                S["shots"] += 1
            S["rows"].append(row)
        S["frame"] += 1
        if t >= DURATION:
            finish()
            les.editor_request_end_play()
            S["phase"] = "ending"
    elif phase == "ending":
        S["end_frames"] += 1
        if S["end_frames"] == 30:
            if S["handle"] is not None:
                unreal.unregister_slate_post_tick_callback(S["handle"])
            unreal.SystemLibrary.quit_editor()


S["handle"] = unreal.register_slate_post_tick_callback(tick)
unreal.log("[HwanghonCapture] armed")
