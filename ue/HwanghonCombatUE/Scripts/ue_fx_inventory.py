"""Inventory of the Paragon particle systems copied into the project (docs/design/167).

Loads every ParticleSystem under the Paragon FX folders and reports which load, their emitter count and
any missing dependencies, into Saved/fx_inventory.json.
"""
import json
import os

import unreal

ROOTS = ["/Game/ParagonGrux/FX", "/Game/ParagonSevarog/FX", "/Game/ParagonCountess/FX"]
reg = unreal.AssetRegistryHelpers.get_asset_registry()
out = []
for root in ROOTS:
    for path in unreal.EditorAssetLibrary.list_assets(root, recursive=True, include_folder=False):
        name = path.split(".")[-1]
        if not name.lower().startswith("p_"):
            continue
        asset = unreal.EditorAssetLibrary.load_asset(path)
        row = {"path": path.split(".")[0], "class": asset.get_class().get_name() if asset else None}
        pkg = path.split(".")[0]
        deps = reg.get_dependencies(pkg, unreal.AssetRegistryDependencyOptions()) or []
        missing = [str(d) for d in deps if str(d).startswith("/Game") and not unreal.EditorAssetLibrary.does_asset_exist(str(d))]
        row["missing"] = missing
        if asset and isinstance(asset, unreal.ParticleSystem):
            try:
                row["emitters"] = len(asset.get_editor_property("emitters"))
            except Exception:
                row["emitters"] = -1
        out.append(row)

dst = os.path.join(unreal.Paths.project_saved_dir(), "fx_inventory.json")
with open(dst, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1)
ok = sum(1 for r in out if r["class"] == "ParticleSystem")
miss = sum(1 for r in out if r["missing"])
unreal.log(f"[HWFX] {ok}/{len(out)} particle systems load, {miss} with missing deps -> {dst}")
