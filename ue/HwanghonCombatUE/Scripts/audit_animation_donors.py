import csv
import json
import re
from pathlib import Path
import unreal

MANIFEST = Path(unreal.Paths.project_content_dir()) / "Data" / "animation_donor_manifest.json"
OUT_DIR = Path(unreal.Paths.project_saved_dir()) / "HwanghonAnimationDonorAudit"

ANIM_CLASSES = {
    "AnimSequence",
    "AnimMontage",
    "PoseAsset",
}

def norm(text):
    return re.sub(r"[^a-z0-9]+", " ", str(text).lower()).strip()

def asset_class_name(asset_data):
    try:
        return str(asset_data.asset_class_path.asset_name)
    except Exception:
        try:
            return str(asset_data.asset_class)
        except Exception:
            return ""

def package_text(asset):
    try:
        return f"{asset.package_name} {asset.asset_name}"
    except Exception:
        return str(asset)

def source_score(asset_text, source_id, root_hints):
    text=norm(asset_text)
    score=0
    for hint in root_hints.get(source_id, []):
        h=norm(hint)
        if h and h in text:
            score += 60 if "/" in str(hint) else 35
    for token in norm(source_id).split():
        if len(token)>=4 and token in text:
            score += 8
    return score

def keyword_score(asset_text, keywords):
    text=norm(asset_text)
    score=0
    matched=[]
    for kw in keywords:
        parts=norm(kw).split()
        if not parts:
            continue
        if all(p in text for p in parts):
            score += 25 + max(0,len(parts)-1)*6
            matched.append(kw)
        else:
            for p in parts:
                if len(p)>=4 and p in text:
                    score += 5
    return score, matched

def collect_assets():
    registry=unreal.AssetRegistryHelpers.get_asset_registry()
    assets=registry.get_all_assets()
    out=[]
    for a in assets:
        cls=asset_class_name(a)
        if cls in ANIM_CLASSES or "AnimSequence" in cls or "AnimMontage" in cls:
            out.append(a)
    unreal.log(f"[HwanghonDonorAudit] animation-like assets: {len(out)}")
    return out

def flatten_slots(manifest):
    rows=[]
    for char_id,char in manifest.get("characters",{}).items():
        for slot,spec in char.get("slots",{}).items():
            rows.append({
                "owner":char_id,
                "slot":slot,
                "keywords":spec.get("keywords",[]),
                "donors":spec.get("donors",[]),
                "edit":spec.get("edit",""),
            })
    for slot,spec in manifest.get("boss",{}).get("slots",{}).items():
        rows.append({
            "owner":"boss",
            "slot":slot,
            "keywords":spec.get("keywords",[]),
            "donors":spec.get("donors",[]),
            "edit":spec.get("edit",""),
        })
    return rows

def rank_slot(slot, assets, roots, max_results=12):
    ranked=[]
    for a in assets:
        text=package_text(a)
        donor_scores=[]
        for donor in slot["donors"]:
            sc=source_score(text,donor,roots)
            if sc>0:
                donor_scores.append((donor,sc))
        if not donor_scores:
            continue
        donor,ds=max(donor_scores,key=lambda x:x[1])
        ks,matched=keyword_score(text,slot["keywords"])
        total=ds+ks
        if total<=0:
            continue
        ranked.append({
            "score":total,
            "donor":donor,
            "asset":str(a.object_path),
            "package":str(a.package_name),
            "name":str(a.asset_name),
            "class":asset_class_name(a),
            "matched_keywords":matched,
        })
    ranked.sort(key=lambda x:(-x["score"],x["name"].lower()))
    return ranked[:max_results]

def ensure_workspace():
    folders=[
        "/Game/Hwanghon/Animation/Retargeted/Ain",
        "/Game/Hwanghon/Animation/Retargeted/Kain",
        "/Game/Hwanghon/Animation/Retargeted/Ryu",
        "/Game/Hwanghon/Animation/Retargeted/Sera",
        "/Game/Hwanghon/Animation/Retargeted/Boss",
        "/Game/Hwanghon/Animation/ControlRig",
        "/Game/Hwanghon/Animation/IK",
        "/Game/Hwanghon/Animation/Montages",
        "/Game/Hwanghon/Animation/QA",
    ]
    for folder in folders:
        unreal.EditorAssetLibrary.make_directory(folder)

def main():
    if not MANIFEST.exists():
        raise RuntimeError(f"manifest missing: {MANIFEST}")

    manifest=json.loads(MANIFEST.read_text(encoding="utf-8"))
    roots=manifest.get("workspace",{}).get("source_root_hints",{})
    slots=flatten_slots(manifest)
    assets=collect_assets()

    OUT_DIR.mkdir(parents=True,exist_ok=True)
    ensure_workspace()

    report={
        "schema":"hwanghon-animation-donor-audit-v1",
        "animation_asset_count":len(assets),
        "slots":[],
        "missing_donor_sources":[],
    }

    all_asset_text="\n".join(package_text(a) for a in assets)
    for source_id,hints in roots.items():
        if not any(norm(h) in norm(all_asset_text) for h in hints if h):
            report["missing_donor_sources"].append(source_id)

    csv_rows=[]
    for slot in slots:
        candidates=rank_slot(slot,assets,roots)
        entry={
            "owner":slot["owner"],
            "slot":slot["slot"],
            "donors":slot["donors"],
            "keywords":slot["keywords"],
            "edit":slot["edit"],
            "candidates":candidates,
        }
        report["slots"].append(entry)
        for rank,c in enumerate(candidates,1):
            csv_rows.append({
                "owner":slot["owner"],
                "slot":slot["slot"],
                "rank":rank,
                "score":c["score"],
                "donor":c["donor"],
                "asset":c["asset"],
                "matched_keywords":";".join(c["matched_keywords"]),
                "edit":slot["edit"],
            })

    (OUT_DIR/"donor_candidates.json").write_text(
        json.dumps(report,ensure_ascii=False,indent=2),
        encoding="utf-8")

    with (OUT_DIR/"donor_candidates.csv").open("w",newline="",encoding="utf-8-sig") as f:
        fields=["owner","slot","rank","score","donor","asset","matched_keywords","edit"]
        writer=csv.DictWriter(f,fieldnames=fields)
        writer.writeheader()
        writer.writerows(csv_rows)

    missing_slots=[
        f'{s["owner"]}:{s["slot"]}'
        for s in report["slots"]
        if not s["candidates"]
    ]

    unreal.log(
        f"[HwanghonDonorAudit] slots={len(report['slots'])} "
        f"candidate_rows={len(csv_rows)} missing_slots={len(missing_slots)}")
    if report["missing_donor_sources"]:
        unreal.log_warning(
            "[HwanghonDonorAudit] source packages not detected: "
            + ", ".join(report["missing_donor_sources"]))
    if missing_slots:
        unreal.log_warning(
            "[HwanghonDonorAudit] no candidates: "
            + ", ".join(missing_slots))

    unreal.log(f"[HwanghonDonorAudit] output: {OUT_DIR}")

if __name__=="__main__":
    main()
