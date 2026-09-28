"""
Clean UI v1 editor setup (docs/design/123, 126). Run after the C++ compiles and
`python Scripts/prepare_ui_art.py` has written Saved/UIArtSrc/*.png:

  UnrealEditor-Cmd.exe HwanghonCombatUE.uproject -ExecutePythonScript=<abs>/Scripts/ue_ui_setup.py -unattended

Creates (nothing binary is committed):
  /Game/UI/Art/T_*            web art as UI textures (no mips, UI group)
  /Game/UI/Fonts/NotoSansKR_* font faces from Assets/Fonts (OFL, Regular/Medium/Bold)
  /Game/UI/Screens/WBP_*      14 widget blueprints parented to the native Clean UI classes.
                              An existing WBP is left alone (designer work is never overwritten);
                              an empty one renders the native token layout.
  /Game/Maps/HW_Frontend      title/lobby map, World Settings GameMode = HWFrontendGameMode
"""
from pathlib import Path
import unreal

PROJECT = Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
ART_SRC = PROJECT / "Saved" / "UIArtSrc"
FONT_SRC = PROJECT / "Assets" / "Fonts"

WBPS = [
    ("WBP_Title", "HWTitleScreen"),
    ("WBP_Lobby", "HWLobbyScreen"),
    ("WBP_OfficeQuest", "HWOfficeQuestScreen"),
    ("WBP_Character", "HWCharacterScreen"),
    ("WBP_Inventory", "HWInventoryScreen"),
    ("WBP_Skills", "HWSkillsScreen"),
    ("WBP_Forge", "HWForgeScreen"),
    ("WBP_Shop", "HWShopScreen"),
    ("WBP_Looks", "HWLooksScreen"),
    ("WBP_Profile", "HWProfileScreen"),
    ("WBP_Recruit", "HWRecruitDrawer"),
    ("WBP_CombatHUD", "HWCombatHUDWidget"),
    ("WBP_Result", "HWResultModal"),
    ("WBP_StoryDialogue", "HWStoryModal"),
]


def log(msg):
    unreal.log(f"[HwanghonUISetup] {msg}")


def import_files(files, dest, names):
    tasks = []
    for src, name in zip(files, names):
        task = unreal.AssetImportTask()
        task.filename = str(src)
        task.destination_path = dest
        task.destination_name = name
        task.automated = True
        task.replace_existing = True
        task.save = True
        tasks.append(task)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks(tasks)
    out = []
    for task in tasks:
        out.extend(task.imported_object_paths)
    return out


def import_art():
    pngs = sorted(ART_SRC.glob("*.png"))
    if not pngs:
        unreal.log_warning(f"[HwanghonUISetup] no art in {ART_SRC}; run Scripts/prepare_ui_art.py first")
        return
    names = ["T_" + p.stem.replace("-", "_") for p in pngs]
    for path in import_files(pngs, "/Game/UI/Art", names):
        tex = unreal.load_asset(path)
        if isinstance(tex, unreal.Texture2D):
            tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_EDITOR_ICON)
            tex.set_editor_property("lod_group", unreal.TextureGroup.TEXTUREGROUP_UI)
            tex.set_editor_property("mip_gen_settings", unreal.TextureMipGenSettings.TMGS_NO_MIPMAPS)
            tex.set_editor_property("never_stream", True)
            unreal.EditorAssetLibrary.save_loaded_asset(tex)
    log(f"art: {len(pngs)} textures")


def import_fonts():
    ttfs = [FONT_SRC / f"NotoSansKR-{w}.ttf" for w in ("Regular", "Medium", "Bold")]
    ttfs = [t for t in ttfs if t.exists()]
    names = [t.stem.replace("-", "_") for t in ttfs]
    paths = import_files(ttfs, "/Game/UI/Fonts", names)
    log(f"fonts: {paths}")


def make_wbps():
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    unreal.EditorAssetLibrary.make_directory("/Game/UI/Screens")
    made = 0
    for name, native in WBPS:
        path = f"/Game/UI/Screens/{name}"
        if unreal.EditorAssetLibrary.does_asset_exist(path):
            log(f"keep existing {path}")
            continue
        parent = unreal.load_class(None, f"/Script/HwanghonCombatUE.{native}")
        if not parent:
            raise RuntimeError(f"missing native class {native}")
        factory = unreal.WidgetBlueprintFactory()
        factory.set_editor_property("parent_class", parent)
        wbp = tools.create_asset(name, "/Game/UI/Screens", unreal.WidgetBlueprint, factory)
        if not wbp:
            raise RuntimeError(f"could not create {path}")
        unreal.BlueprintEditorLibrary.compile_blueprint(wbp)
        unreal.EditorAssetLibrary.save_loaded_asset(wbp)
        made += 1
    log(f"widget blueprints: {made} created, {len(WBPS) - made} kept")


def make_frontend_map():
    level = "/Game/Maps/HW_Frontend"
    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if unreal.EditorAssetLibrary.does_asset_exist(level):
        les.load_level(level)
    elif not les.new_level(level):
        raise RuntimeError(f"failed to create {level}")
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    gm = unreal.load_class(None, "/Script/HwanghonCombatUE.HWFrontendGameMode")
    world.get_world_settings().set_editor_property("default_game_mode", gm)
    les.save_current_level()
    log(f"{level}: GameMode={gm.get_name()}")


def main():
    import_art()
    import_fonts()
    make_wbps()
    make_frontend_map()
    log("done")


if __name__ == "__main__":
    main()
