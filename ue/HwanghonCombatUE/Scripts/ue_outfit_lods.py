"""Reduced LODs for the hero outfits (docs/design/184 §7).

The outfits came over from the MetaHuman lab with one LOD of ~500k triangles; on the tablet that alone cost ~5 ms of
GPU. Give them LOD1-3 by the engine's skeletal mesh reduction. The outfit follows the body's LOD through leader pose,
and phones never draw below LOD1 (mobile_min_lod), so LOD1 is the phone outfit.
Run: UnrealEditor-Cmd <uproject> -ExecutePythonScript=Scripts/ue_outfit_lods.py -unattended -nullrhi
"""
import unreal

OUTFITS = ["/Game/Outfit/Ain/ain_v108m", "/Game/Outfit/Sera/sera_v108m"]
SETTINGS = "/Game/Outfit/LODS_HeroOutfit"
PERCENT = [1.0, 0.12, 0.06, 0.03]   # LOD1 ~60k triangles: the phone outfit

sub = unreal.get_editor_subsystem(unreal.SkeletalMeshEditorSubsystem)


def make_settings():
    s = unreal.load_asset(SETTINGS)
    if not s:
        tools = unreal.AssetToolsHelpers.get_asset_tools()
        f = unreal.DataAssetFactory()
        f.set_editor_property("data_asset_class", unreal.SkeletalMeshLODSettings)
        s = tools.create_asset("LODS_HeroOutfit", "/Game/Outfit", unreal.SkeletalMeshLODSettings, f)
    groups = []
    for i, pct in enumerate(PERCENT):
        g = unreal.SkeletalMeshLODGroupSettings()
        r = g.get_editor_property("reduction_settings")
        r.set_editor_property("num_of_triangles_percentage", pct)
        r.set_editor_property("termination_criterion", unreal.SkeletalMeshTerminationCriterion.SMTC_NUM_OF_TRIANGLES)
        g.set_editor_property("reduction_settings", r)
        g.set_editor_property("screen_size", unreal.PerPlatformFloat(default=[1.0, 0.5, 0.25, 0.12][i]))
        groups.append(g)
    s.set_editor_property("lod_groups", groups)
    unreal.EditorAssetLibrary.save_loaded_asset(s)
    return s


settings = make_settings()
for path in OUTFITS:
    sk = unreal.load_asset(path)
    if not sk:
        unreal.log_warning("[HWOutfitLOD] missing %s" % path)
        continue
    before = sub.get_lod_count(sk)
    sk.set_editor_property("lod_settings", settings)
    ok = sub.regenerate_lod(sk, len(PERCENT), True, False)
    unreal.EditorAssetLibrary.save_loaded_asset(sk)
    unreal.log("[HWOutfitLOD] %s lods %d -> %d ok %s" % (path, before, sub.get_lod_count(sk), ok))
