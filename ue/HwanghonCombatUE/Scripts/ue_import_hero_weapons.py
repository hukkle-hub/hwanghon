"""Hero weapons (docs/design/175): the gear GLBs from art/3d (doc 160's picks) -> /Game/Weapons/Heroes/<id>.
Ain: reaper's scythe (ain_scythe_tex), Kain: anvil greatsword, Ryu: twin fangs (both hands), Sera: vial (thrown).
Attached in game by UHWCharacterVisualSettings::ApplyTo (Config/DefaultGame.ini WeaponR/WeaponL, grip in cm).

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_import_hero_weapons.py" -unattended -nullrhi
"""
import json
import os

import unreal

ART = os.path.normpath(os.path.join(unreal.Paths.project_dir(), "..", "..", "art", "3d"))
OUT = "/Game/Weapons/Heroes"
# trail sockets in the mesh's own space (cm; +Z up the blade): the trail and the tell's glint follow the weapon -
# the body's FX_WeaponBase/Tip sockets sit on the hidden blade bones and collapse with them
SOCKETS = {
    "ain_scythe": ((0, 0, 118), (-44, 0, 158)),     # upper shaft -> the blade's point
    "kain_greatsword": ((0, 0, 95), (0, 0, 212)),   # guard -> tip
    "ryu_twinfang": ((0, 0, 14), (0, 0, 41)),
}
WEAPONS = {
    "ain_scythe": "ain_scythe_tex.glb",
    "kain_greatsword": "gear/w_kain_greatsword.glb",
    "ryu_twinfang": "gear/w_ryu_twinfang.glb",
    "sera_vial": "gear/w_sera_vial.glb",
}
eal = unreal.EditorAssetLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()
report = {}
ONLY = [x for x in os.environ.get("HW_WEAPONS", "").split(",") if x]
for name, rel in WEAPONS.items():
    if ONLY and name not in ONLY:
        continue
    dst = f"{OUT}/{name}"
    if eal.does_directory_exist(dst):
        eal.delete_directory(dst)
    t = unreal.AssetImportTask()
    for k, v in (("filename", os.path.join(ART, rel)), ("destination_path", dst), ("automated", True),
                 ("save", True), ("replace_existing", True)):
        t.set_editor_property(k, v)
    tools.import_asset_tasks([t])
    eal.save_directory(dst)
    meshes = [a for a in eal.list_assets(dst, recursive=True, include_folder=False)
              if isinstance(unreal.load_asset(a), unreal.StaticMesh)]
    row = {"meshes": meshes}
    if meshes:
        sm = unreal.load_asset(meshes[0])
        b = sm.get_bounds()
        row["origin"] = [round(b.origin.x, 1), round(b.origin.y, 1), round(b.origin.z, 1)]
        row["extent"] = [round(b.box_extent.x, 1), round(b.box_extent.y, 1), round(b.box_extent.z, 1)]
        sm.set_editor_property("light_map_resolution", 16)
        for sock_name, at in zip(("TrailBase", "TrailTip"), SOCKETS.get(name, ())):
            sock = unreal.StaticMeshSocket(sm)
            sock.set_editor_property("socket_name", sock_name)
            sock.set_editor_property("relative_location", unreal.Vector(*at))
            sm.add_socket(sock)
        row["sockets"] = [n for n in ("TrailBase", "TrailTip") if sm.find_socket(n)]
        eal.save_loaded_asset(sm)
    report[name] = row
with open(os.path.join(unreal.Paths.project_saved_dir(), "hero_weapons.json"), "a" if ONLY else "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=1)
