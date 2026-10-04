"""Is the baked head texture what the face renders? Reimport MH_TEX over T_Head_LOD*_BC, spawn the built BP, capture."""
import os, traceback
import unreal
NAME = os.environ.get("MH_NAME", "Sera"); PNG = os.environ.get("MH_TEX", "")
LOG = "C:/w/mhlab/probe_tex_log.txt"; open(LOG, "w").close()
def log(*a):
    open(LOG, "a").write(" ".join(str(x) for x in a) + "\n")
eal = unreal.EditorAssetLibrary; eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem); st = {}
try:
    bdir = f"/Game/Heroes/Built/{NAME}/MH_{NAME}/Face/Baked"
    for lod in (("T_Head_LOD1_BC", "T_Head_LOD3_BC", "T_Head_LOD5to7_BC") if PNG else ()):
        old = unreal.load_asset(f"{bdir}/{lod}")
        log(lod, "before vt", old.get_editor_property("virtual_texture_streaming"), "srgb", old.get_editor_property("srgb"), "comp", old.get_editor_property("compression_settings"))
        t = unreal.AssetImportTask()
        for k, v in (("filename", PNG), ("destination_path", bdir), ("destination_name", lod), ("automated", True), ("save", True), ("replace_existing", True)):
            t.set_editor_property(k, v)
        unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
        new = unreal.load_asset(f"{bdir}/{lod}")
        log(lod, "after vt", new.get_editor_property("virtual_texture_streaming"), "srgb", new.get_editor_property("srgb"), new.get_path_name())
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).new_level("/Game/ProbeTex")
    eas.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 300, 400), unreal.Rotator(pitch=-35, yaw=-110, roll=0))
    sky = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 300), unreal.Rotator())
    sky.light_component.set_editor_property("source_type", unreal.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP)
    sky.light_component.set_editor_property("cubemap", unreal.load_asset("/Engine/MapTemplates/Sky/SunsetAmbientCubemap"))
    bp = unreal.load_asset(f"/Game/Heroes/Built/{NAME}/MH_{NAME}/BP_MH_{NAME}")
    st["a"] = eas.spawn_actor_from_object(bp, unreal.Vector(0, 0, 0), unreal.Rotator())
except Exception:
    log("ERROR", traceback.format_exc())
ticks = {"n": 0, "lods": [int(x) for x in os.environ.get("MH_LODS", "0").split(",")], "i": 0}
def on_tick(dt):
    ticks["n"] += 1
    n = ticks["n"]
    if n < 1500 or n % 300:
        return
    try:
        if ticks["i"] >= len(ticks["lods"]) * 2:
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
            return
        lod = ticks["lods"][ticks["i"] // 2]
        if ticks["i"] % 2 == 0:
            for c in st["a"].get_components_by_class(unreal.SkinnedMeshComponent):
                c.set_forced_lod(lod + 1)
            for t in unreal.EditorAssetLibrary.list_assets(f"/Game/Heroes/Built/{NAME}/MH_{NAME}/Face/Baked", recursive=False):
                if "_BC" in t:
                    tx = unreal.load_asset(t)
                    tx.set_force_mip_levels_to_be_resident(30.0, 0)
        else:
            world = unreal.EditorLevelLibrary.get_editor_world()
            for tag, loc, fov in (("far", unreal.Vector(0, 260, 163), 8.5), ("near", unreal.Vector(0, 60, 163), 30.0)):
                rt = unreal.RenderingLibrary.create_render_target2d(world, 1024, 1024, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
                cap = eas.spawn_actor_from_class(unreal.SceneCapture2D, loc, unreal.Rotator(pitch=0, yaw=-90, roll=0))
                cc = cap.capture_component2d
                cc.set_editor_property("texture_target", rt); cc.set_editor_property("fov_angle", fov)
                cc.set_editor_property("capture_source", unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
                cc.capture_scene()
                unreal.RenderingLibrary.export_render_target(world, rt, "C:/w/mhlab/shots", f"probetex_{NAME}_lod{lod}_{tag}.png")
                cap.destroy_actor()
            log("shot lod", lod)
        ticks["i"] += 1
    except Exception:
        log("ERROR shot", traceback.format_exc())
        ticks["i"] += 1


handle = unreal.register_slate_post_tick_callback(on_tick)
