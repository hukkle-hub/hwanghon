"""Shelter hero props (docs/design/155 §2.2): art/shelter/props/<id>.glb (tools/shelter/prep_prop.py) ->
/Game/Hwanghon/Shelter/Props/<id>, a simple box collision each (work order P9: props get Box/Convex, not per-poly),
Nanite off (Android). The builder (Scripts/ue_shelter_b1.py) places them where their graybox stand-ins stood.

UnrealEditor-Cmd <uproject> -ExecutePythonScript="Scripts/ue_shelter_props.py" -unattended -nullrhi
"""
import os

import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, "..", "..", "..", "art", "shelter", "props"))
DEST = "/Game/Hwanghon/Shelter/Props"
lib = unreal.EditorAssetLibrary
sms = unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem)

tasks = []
for f in sorted(os.listdir(SRC)):
    if f.endswith(".glb"):
        t = unreal.AssetImportTask()
        t.filename = os.path.join(SRC, f)
        t.destination_path = f"{DEST}/{f[:-4]}"
        t.automated = True
        t.replace_existing = True
        t.save = True
        tasks.append(t)
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks(tasks)
for t in tasks:
    pid = os.path.basename(t.filename)[:-4]
    meshes = [p for p in t.imported_object_paths if isinstance(unreal.load_asset(p), unreal.StaticMesh)]
    for p in meshes:
        m = unreal.load_asset(p)
        sms.remove_collisions(m)
        sms.add_simple_collisions(m, unreal.ScriptingCollisionShapeType.BOX)
        ns = m.get_editor_property("nanite_settings")
        ns.enabled = False
        m.set_editor_property("nanite_settings", ns)
        lib.save_loaded_asset(m)
    unreal.log(f"[HWShelterProps] {pid}: {[os.path.basename(p) for p in meshes]}")
unreal.log(f"[HWShelterProps] {len(tasks)} props")
