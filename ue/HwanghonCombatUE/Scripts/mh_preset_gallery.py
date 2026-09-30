"""Face gallery of every MetaHuman Creator preset (docs/design/164): pick the base face for a hero by looking, not by
its name (Aoi turned out to be an older man, 2026-09-30).

  UnrealEditor.exe <uproject> -ExecCmds="py Scripts/mh_preset_gallery.py" -HWMHShots=<dir> [-HWMHWait=90]
Writes <dir>/preset_<Name>.png (face, front) and quits. Copies go to /Game/Heroes/_presets (safe to delete).
"""
import os
import sys

import unreal

SRC = "/MetaHumanCharacter/Optional/Presets"
DST = "/Game/Heroes/_presets"
lib = unreal.EditorAssetLibrary
mhs = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def log(m):
    unreal.log(f"[HWMHG] {m}")


def arg(name, default=None):
    for a in sys.argv + unreal.SystemLibrary.get_command_line().split():
        if a.startswith(f"-{name}="):
            return a.split("=", 1)[1].strip('"')
    return default


out = arg("HWMHShots")
os.makedirs(out, exist_ok=True)
names = sorted({str(a).split(".")[-1] for a in lib.list_assets(SRC, recursive=False)})
aes = unreal.get_editor_subsystem(unreal.AssetEditorSubsystem)
actors = []
for i, n in enumerate(names):
    dst = f"{DST}/{n}"
    c = unreal.load_asset(dst) if lib.does_asset_exist(dst) else lib.duplicate_asset(f"{SRC}/{n}", dst)
    if not c:
        log(f"{n}: no copy")
        continue
    aes.open_editor_for_assets(assets=[c])
    a = mhs.spawn_meta_human_actor(character=c)
    if not a:
        log(f"{n}: no actor")
        continue
    a.set_actor_location(unreal.Vector(0, i * 400.0, 0), False, False)
    a.set_actor_rotation(unreal.Rotator(0, 0, 90), False)
    actors.append((n, a, i * 400.0))
log(f"{len(actors)} presets spawned")

world = unreal.EditorLevelLibrary.get_editor_world()
cap = eas.spawn_actor_from_class(unreal.SceneCapture2D, unreal.Vector(0, 0, 0))
comp = cap.capture_component2d
rt = unreal.RenderingLibrary.create_render_target2d(world, 512, 640, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
comp.texture_target = rt
comp.capture_source = unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR
comp.fov_angle = 30
unreal.SystemLibrary.execute_console_command(None, "r.Streaming.FullyLoadUsedTextures 1")
state = {"t": 0.0, "done": False}


def tick(dt):
    state["t"] += dt
    if state["done"] or state["t"] < float(arg("HWMHWait", "90")):
        return
    state["done"] = True
    for n, a, y in actors:
        # the head height differs per preset: aim at the head bone if there is one
        z = 160.0
        for comp_ in a.get_components_by_class(unreal.SkeletalMeshComponent):
            if comp_.does_socket_exist("head"):
                z = comp_.get_socket_location("head").z + 8
                break
        L = unreal.Vector(-62, y, z)
        cap.set_actor_location(L, False, False)
        cap.set_actor_rotation(unreal.MathLibrary.find_look_at_rotation(L, unreal.Vector(0, y, z - 2)), False)
        comp.capture_scene()
        unreal.RenderingLibrary.export_render_target(world, rt, out, f"preset_{n}.png")
    log(f"shot {len(actors)}")
    unreal.unregister_slate_post_tick_callback(handle)
    unreal.SystemLibrary.quit_editor()


handle = unreal.register_slate_post_tick_callback(tick)
