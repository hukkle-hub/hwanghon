"""Read-only recovery of the existing GeneralPark assets. Never saves UE packages.
Run with UnrealEditor-Cmd <original.uproject> -run=pythonscript -script=<this>.
HW_PARK_EXPORT_DIR must point to a separate evidence directory.
"""
import os
import json
import unreal

out = os.environ["HW_PARK_EXPORT_DIR"]
os.makedirs(out, exist_ok=True)
assets = {
    "park-original-skeletal": "/Game/Twilight/Bosses/SM_Boss_GeneralPark/SkeletalMeshes/SKM_Boss_GeneralPark",
    "park-original-static": "/Game/Twilight/Bosses/SM_Boss_GeneralPark/GeneralPark/StaticMeshes/GeneralPark",
}
report = {"readOnlySource": True, "assets": [], "matchingAssets": []}
registry = unreal.AssetRegistryHelpers.get_asset_registry()
registry.wait_for_completion()
for entry in registry.get_all_assets():
    name = str(entry.asset_name)
    if any(s in name.lower() for s in ("generalpark", "dropper", "junjang")):
        report["matchingAssets"].append({"name": name, "package": str(entry.package_name), "type": str(entry.asset_class_path)})
for name, path in assets.items():
    mesh = unreal.load_asset(path)
    assert mesh, path
    dest = os.path.join(out, name + ".glb")
    if os.path.exists(dest):
        report["assets"].append({"asset": path, "file": dest, "ok": True, "existing": True, "bytes": os.path.getsize(dest)})
        continue
    options = unreal.GLTFExportOptions()
    options.set_editor_property("export_vertex_skin_weights", True)
    options.set_editor_property("export_vertex_colors", False)
    options.set_editor_property("bake_material_inputs", unreal.GLTFMaterialBakeMode.DISABLED)
    ok = unreal.GLTFExporter.export_to_gltf(mesh, dest, options, set())
    row = {"asset": path, "file": dest, "ok": bool(ok), "bytes": os.path.getsize(dest) if os.path.exists(dest) else 0}
    report["assets"].append(row)
    unreal.log("PARK_RECOVERY " + json.dumps(row))
texture_path = "/Game/Twilight/Bosses/SM_Boss_GeneralPark/GeneralPark/Textures/GeneralPark_texture_0"
texture_file = os.path.join(out, "park-original-color.png")
if not os.path.exists(texture_file):
    task = unreal.AssetExportTask()
    task.object = unreal.load_asset(texture_path)
    assert task.object, texture_path
    task.filename = texture_file
    task.automated = True
    task.prompt = False
    task.replace_identical = False
    task.exporter = unreal.TextureExporterPNG()
    assert unreal.Exporter.run_asset_export_task(task), "Texture recovery failed"
report["texture"] = {"asset": texture_path, "file": texture_file, "bytes": os.path.getsize(texture_file)}
with open(os.path.join(out, "ue-recovery.json"), "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
assert all(a["ok"] and a["bytes"] > 0 for a in report["assets"])
