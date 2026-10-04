"""Designed boss skills as one baked clip on the boss rig (docs/design/181 §8), called by rig_boss_template.py when
HW_RIG_TAKES names them (comma list, e.g. HW_RIG_TAKES=sf_flurry).

Each skill lays Kimodo takes (art/anim/kimodo/hw_kmd_*.fbx, retargeted by tools/vfx/kimodo_retarget.py) on NLA strips
on the same timeline as the animatic (tools/vfx/shadowfang_animatic.py) and bakes them into one action, time 0 = the
tell's start. UE plays it through Content/Data/boss_skills.json (anim.clip): the contacts are the beat times over
the clip length. Height: only the hips' drop below standing is in the clip (crouch, landing); the rise is the game's lift keys.
"""
import os
import sys

import bpy
from mathutils import Quaternion

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
KD = os.path.join(ROOT, "art", "anim", "kimodo")
sys.path.append(os.path.join(ROOT, "tools", "vfx"))
from kimodo_retarget import retarget  # noqa: E402

FPS = 30


def _flurry():
    """«그림자 난무» 6.6 s: crouch/spring, 3 sets of clawing (5/5/7) with breaths, dive and stuck (motion study tab 1)."""
    s = [("sf_rise", 0.0, 1.25, (0.0, 0.55))]
    t = 1.25
    for set_i, (n, gap) in enumerate(((5, .14), (5, .14), (7, .12))):
        s.append(("sf_flurry", t, n * gap, (0.3, 0.75)))
        t += n * gap
        if set_i < 2:
            s.append(("sf_rise", t, 0.6, (0.45, 0.6)))
            t += 0.6
    s.append(("sf_dive", 4.75, 1.85, (0.35, 1.0)))
    return "atk_sfflurry", 6.6, s, None


def _s09_frenzy():
    """실험체 09호 «폭주 연타» 4.0 s: 2 quick hits (0.55, 0.85), a dead pause, 3 heavy ones (1.95, 2.2, 2.5) with the long
    arms swung wide by hand keys (tools/vfx/boss_skill_animatic.py s09_frenzy v2)."""
    s = [("s09_combo", 0.0, 1.0, (0.0, 0.35)), ("s09_combo", 1.0, 0.8, (0.35, 0.42)),
         ("s09_combo", 1.8, 1.2, (0.42, 0.85)), ("s09_combo", 3.0, 1.0, (0.85, 1.0))]
    over = ({1.95: ((1, -0.4, 0.2), (0.8, -0.9, -0.1)), 2.2: ((-0.2, -1, 0.1), (-0.6, -0.8, -0.2)),
             2.5: ((0.3, -0.6, 1), (0.2, -1, 0.3))}, [(0, 0), (1.8, 0), (1.95, 1), (2.6, 1), (3.0, 0)])
    return "atk_s09frenzy", 4.0, s, over


def _clave_shut():
    """클레이브 «셔터 붕괴» 4.0 s: vanish 0.3 / reappear 0.5 (the game moves him), raise the shutter and hold it 0.8 s,
    crash at 2.05 (tools/vfx/boss_skill_animatic.py clave_shut v2)."""
    s = [("clave_tele", 0.5, 1.4, (0.0, 0.55)), ("clave_tele", 1.9, 0.15, (0.55, 0.7)), ("clave_tele", 2.05, 1.95, (0.7, 1.0))]
    # the shutter (2.5 m, held at its middle, its long axis = minus the hand bone's) is the third key: the hand bone
    # direction. Overhead it lies across (hand pointing out to the side), at the crash it lies forward on the ground
    # (hand pointing back). Without it the slab stayed upright beside the raised arm (measured, doc 181 §9).
    over = ({1.2: ((0.15, 0.1, 1), (0.05, 0.1, 1), (1, 0, 0.1)), 1.9: ((0.15, 0.15, 1), (0.05, 0.15, 1), (1, 0, 0.1)),
             2.05: ((0.15, -0.75, -0.65), (0.05, -0.7, -0.7), (0, 1, 0.35)),
             2.6: ((0.2, -0.5, -0.85), (0.1, -0.4, -0.9), (0, 0.8, 0.6))},
            [(0, 0), (0.9, 0), (1.2, 1), (2.6, 1), (3.2, 0)])
    return "atk_claveshut", 4.0, s, over


SKILLS = {"sf_flurry": _flurry, "s09_frenzy": _s09_frenzy, "clave_shut": _clave_shut}


def _overlay(arm, poses, ramp):
    """Hand keys on both arms over the stacked strips (doc 178 §6): poses {t: (upper arm dir, forearm dir[, hand dir])}
    in world space for the left arm (the right mirrored in x), blended in by the ramp [(t, influence)]."""
    from mathutils import Matrix, Vector
    sc = bpy.context.scene
    AW = arm.matrix_world.copy()
    cache = {}
    for tt, dirs in poses.items():
        du, df = dirs[0], dirs[1]
        dh = dirs[2] if len(dirs) > 2 else None
        f = int(round(tt * FPS)) + 1
        arm.animation_data.action = None
        sc.frame_set(f)
        bpy.context.view_layer.update()
        for side in ("Left", "Right"):
            sg = 1 if side == "Left" else -1
            chain = [(f"mixamorig:{side}Arm", du), (f"mixamorig:{side}ForeArm", df)] + ([(f"mixamorig:{side}Hand", dh)] if dh else [])
            for bn, dv in chain:
                pb = arm.pose.bones[bn]
                d_ = (AW.inverted().to_3x3() @ Vector((dv[0] * sg, dv[1], dv[2])).normalized()).normalized()
                q = (pb.tail - pb.head).normalized().rotation_difference(d_)
                h = pb.head.copy()
                pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
                bpy.context.view_layer.update()
                cache[(f, bn)] = pb.matrix_basis.to_quaternion().copy()
        for pb in arm.pose.bones:
            pb.matrix_basis = Matrix.Identity(4)
    over = bpy.data.actions.new("tmp_overlay")
    arm.animation_data.action = over
    for (f, bn), q in cache.items():
        pb = arm.pose.bones[bn]
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = q
        pb.keyframe_insert("rotation_quaternion", frame=f)
    for tt, v in ramp:
        arm.animation_data.action_influence = v
        arm.animation_data.keyframe_insert("action_influence", frame=int(round(tt * FPS)) + 1)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    return over


def bake(arm, key):
    name, dur, strips, overlay = SKILLS[key]()
    sc = bpy.context.scene
    sc.render.fps = FPS
    acts = {}
    for take in sorted({s[0] for s in strips}):
        acts[take] = retarget(arm, os.path.join(KD, f"hw_kmd_{take}.fbx"), "tmp_" + take, hips_down=True)
    arm.animation_data_create()
    keep = arm.animation_data.action
    arm.animation_data.action = None
    tracks = []
    for take, t0, d, (p0, p1) in strips:
        a = acts[take]
        f0, f1 = a.frame_range
        f0, f1 = f0 + (f1 - f0) * p0, f0 + (f1 - f0) * p1
        trk = arm.animation_data.nla_tracks.new()   # one track per strip: a fresh strip spans the clip before scaling
        st = trk.strips.new(f"{take}_{t0:.2f}", int(round(t0 * FPS)) + 1, a)
        st.extrapolation = "HOLD_FORWARD" if t0 + d >= dur - 1e-3 else "NOTHING"
        if hasattr(st, "action_slot") and len(a.slots):
            st.action_slot = a.slots[0]
        st.action_frame_start, st.action_frame_end = f0, f1
        st.scale = max(0.05, d * FPS / max(1.0, f1 - f0))
        st.frame_end = st.frame_start + d * FPS
        st.blend_in = st.blend_out = 0
        tracks.append(trk)
    over = _overlay(arm, *overlay) if overlay else None
    # sample the stacked strips (and the hand-key overlay on top), key one action
    n = int(round(dur * FPS))
    poses = []
    for f in range(1, n + 2):
        sc.frame_set(f)
        poses.append({pb.name: (pb.matrix_basis.to_quaternion(), pb.location.copy()) for pb in arm.pose.bones})
    arm.animation_data.action = None
    arm.animation_data.action_influence = 1.0
    if over:
        bpy.data.actions.remove(over)
    for trk in tracks:
        arm.animation_data.nla_tracks.remove(trk)
    for a in acts.values():
        bpy.data.actions.remove(a)
    out = bpy.data.actions.new(name)
    arm.animation_data.action = out
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        last = None
        for i, pose in enumerate(poses):
            q, loc = pose[pb.name]
            if last is not None and last.dot(q) < 0:
                q = Quaternion((-q.w, -q.x, -q.y, -q.z))
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=i + 1)
            if pb.name.endswith("Hips"):   # the crouch / landing drop (kimodo_retarget hips_down)
                pb.location = loc
                pb.keyframe_insert("location", frame=i + 1)
            last = q
    arm.animation_data.action = keep
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
    drops = [loc.length for pose in poses for nm, (_, loc) in pose.items() if nm.endswith("Hips")]
    print(f"[rig] baked {name}: {len(strips)} strips, {n + 1} frames ({dur} s), hips drop max {max(drops or [0]):.2f}")
    return out
