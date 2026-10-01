"""Conform MH_<name>'s head to a face mesh cut from the Hi3D hero (docs/design/177).
Steps (on editor ticks): import the face FBX -> place at the origin -> capture it from 4 sides -> Epic's face tracker on
each (system python converts PNG -> BGRA) -> the side with the most landmarks is the front -> conform_to_target_meshes
(head mesh + landmarks + that camera) -> commit -> save. Log: conform_log.txt. Run with -ExecCmds="py conform.py".
"""
import json
import os
import subprocess
import traceback

import unreal

NAME = os.environ.get("MH_NAME", "Ain")
FBX = os.environ.get("MH_FACE", "C:/w/mhlab/ain_face.fbx")
LOG = "C:/w/mhlab/conform_log.txt"
SHOT = "C:/w/mhlab/conform"
os.makedirs(SHOT, exist_ok=True)
open(LOG, "w").close()


def log(*a):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(" ".join(str(x) for x in a) + "\n")


eal = unreal.EditorAssetLibrary
sub = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
state = {}
try:
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).new_level("/Game/ConformEmpty%d" % (os.getpid() % 10000))
    unreal.SystemLibrary.execute_console_command(None, "Interchange.FeatureFlags.Import.FBX False")
    ui = unreal.FbxImportUI()
    ui.set_editor_property("import_mesh", True)
    ui.set_editor_property("import_as_skeletal", False)
    ui.set_editor_property("import_materials", True)
    ui.set_editor_property("import_textures", True)
    ui.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_STATIC_MESH)
    sd = ui.get_editor_property("static_mesh_import_data")
    sd.set_editor_property("combine_meshes", True)
    t = unreal.AssetImportTask()
    for k, v in (("filename", FBX), ("destination_path", "/Game/Conform"), ("destination_name", f"SM_{NAME}_Face"),
                 ("automated", True), ("save", True), ("replace_existing", True), ("options", ui)):
        t.set_editor_property(k, v)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
    sm = unreal.load_asset(f"/Game/Conform/SM_{NAME}_Face")
    b = sm.get_bounds()
    log("face mesh", sm, "origin", b.origin, "extent", b.box_extent)
    actor = unreal.EditorLevelLibrary.spawn_actor_from_object(sm, unreal.Vector(0, 0, 0), unreal.Rotator(pitch=0, yaw=0, roll=0))
    unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 300), unreal.Rotator(pitch=0, yaw=0, roll=0))
    unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 300), unreal.Rotator(pitch=-30, yaw=60, roll=0))
    state.update(sm=sm, center=b.origin, size=max(b.box_extent.x, b.box_extent.y, b.box_extent.z) * 2.0)
    char = unreal.load_asset(f"/Game/Heroes/MH_{NAME}")
    log("character", char, "edit", sub.try_add_object_to_edit(char))
    state["char"] = char
except Exception:
    log("ERROR setup", traceback.format_exc())

SIDES = {"negY": (unreal.Vector(0, -1, 0), 90.0), "posY": (unreal.Vector(0, 1, 0), -90.0),
         "negX": (unreal.Vector(-1, 0, 0), 0.0), "posX": (unreal.Vector(1, 0, 0), 180.0)}
FOV = 30.0
RES = 512


def capture(side):
    d, yaw = SIDES[side]
    c = state["center"]
    dist = state["size"] * 0.5 / 0.2679 * 1.15     # tan(15 deg): the face fills the frame
    loc = unreal.Vector(c.x + d.x * dist, c.y + d.y * dist, c.z)
    rot = unreal.Rotator(pitch=0.0, yaw=yaw, roll=0.0)
    world = unreal.EditorLevelLibrary.get_editor_world()
    rt = unreal.RenderingLibrary.create_render_target2d(world, RES, RES, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
    cap = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.SceneCapture2D, loc, rot)
    cc = cap.capture_component2d
    cc.set_editor_property("texture_target", rt)
    cc.set_editor_property("fov_angle", FOV)
    # the texture's own colour: no light, no exposure (a lit capture came out black, then blown white)
    cc.set_editor_property("capture_source", unreal.SceneCaptureSource.SCS_BASE_COLOR)
    cc.capture_scene()
    unreal.RenderingLibrary.export_render_target(world, rt, SHOT, f"{side}.png")
    return loc, rot


def track(side):
    png, raw = f"{SHOT}/{side}.png", f"{SHOT}/{side}.bgra"
    # the capture comes out flipped vertically (seen in the lab sheets): flip back before tracking
    subprocess.run(["python", "-c", (
        "from PIL import Image, ImageOps;import sys;im=ImageOps.flip(Image.open(sys.argv[1]).convert('RGB')).resize((%d,%d));"
        "im.save(sys.argv[1].replace('.png','_up.png'));"
        "open(sys.argv[2],'wb').write(bytes(x for r,g,b in im.getdata() for x in (b,g,r,255)))") % (RES, RES), png, raw], check=True)
    data = open(raw, "rb").read()
    px = [unreal.Color(b=data[i], g=data[i + 1], r=data[i + 2], a=255) for i in range(0, len(data), 4)]
    return sub.track_face_landmarks_from_image(px, RES, RES)


ticks = {"n": 0, "phase": "wait", "results": {}}


def on_tick(dt):
    ticks["n"] += 1
    n = ticks["n"]
    if ticks.get("busy"):
        return      # a blocking call (tracker, conform) pumps the slate loop: no re-entry
    ticks["busy"] = True
    try:
        if ticks["phase"] == "wait" and n > 600:
            ticks["phase"] = "capture"
        elif ticks["phase"] == "capture":
            todo = [sd for sd in SIDES if sd not in ticks["results"]]
            if todo and n % 30 == 0:
                ticks["results"][todo[0]] = {"view": capture(todo[0])}
            if not todo:
                ticks["phase"] = "track"
                ticks["track_at"] = n + 60
        elif ticks["phase"] == "track" and n > ticks["track_at"]:
            best, best_n = None, -1
            for side, r in ticks["results"].items():
                lm = track(side)
                cnt = sum(1 for _ in lm.items()) if lm else 0
                r["lm"] = lm
                log("track", side, "curves", cnt, list(lm.keys())[:12] if lm else None)
                if cnt > best_n:
                    best, best_n = side, cnt
            log("front side", best, best_n)
            ticks["best"] = best
            ticks["phase"] = "conform"
        elif ticks["phase"] == "conform":
            r = ticks["results"][ticks["best"]]
            loc, rot = r["view"]
            char, sm = state["char"], state["sm"]
            verts, tris = sub.get_mesh_data_for_conforming(sm)
            log("mesh data", len(verts), len(tris) // 3)
            p = unreal.ConformTargetParams()
            tm = p.get_editor_property("conform_target_mesh")
            tm.set_editor_property("target_parts_type", unreal.TargetPartsType.HEAD_ONLY)
            tm.set_editor_property("head_vertices", verts)
            tm.set_editor_property("head_vertex_indices", tris)
            p.set_editor_property("conform_target_mesh", tm)
            chk = p.get_editor_property("conform_target_mesh")
            log("target check", chk.get_editor_property("target_parts_type"), len(chk.get_editor_property("head_vertices")), len(chk.get_editor_property("head_vertex_indices")))
            if r.get("lm"):
                p.set_editor_property("curve_tracking_points", r["lm"])
            vi = p.get_editor_property("camera_view_info")
            vi.set_editor_property("location", loc)
            vi.set_editor_property("rotation", rot)
            vi.set_editor_property("fov", FOV)
            vi.set_editor_property("aspect_ratio", 1.0)
            p.set_editor_property("camera_view_info", vi)
            key = unreal.MetaHumanCharacterTargetMeshKey()
            key.set_editor_property("head_mesh", sm)
            ok_align = sub.align_to_target_meshes(char, key, p)
            ok = sub.conform_to_target_meshes(char, key, p)
            log("align", ok_align, "conform", ok)
            sub.commit_face_state(char)
            eal.save_loaded_asset(char)
            log("saved")
            ticks["phase"] = "done"
            ticks["quit_at"] = n + 30
        elif ticks["phase"] == "done" and n > ticks["quit_at"]:
            log("done")
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
    except Exception:
        log("ERROR", ticks["phase"], traceback.format_exc())
        ticks["phase"] = "done"
        ticks["quit_at"] = n + 10
    finally:
        ticks["busy"] = False


handle = unreal.register_slate_post_tick_callback(on_tick)
