import csv
import json
from pathlib import Path
import unreal

KEYWORDS = {
    "concrete": ["concrete", "cement", "wall", "floor"],
    "industrial": ["pipe", "cable", "duct", "vent", "industrial"],
    "rubble": ["rubble", "debris", "broken", "trash", "junk"],
    "hospital": ["hospital", "medical", "clinic", "bed"],
    "research": ["lab", "research", "facility", "terminal", "machine"],
    "lighting": ["light", "lamp", "emergency", "fluorescent"],
    "chaos": ["geometrycollection", "fracture", "chaos"],
    "niagara": ["niagara", "fx", "vfx", "smoke", "spark", "fire"],
}

ROOT_HINTS = [
    "Derelict", "DarkRuins", "ElectricDreams", "Ancient", "Megascans",
    "Quixel", "ContentExamples"
]

def score(path_l, name_l, keys):
    score=0
    hits=[]
    for key in keys:
        if key in name_l:
            score += 12; hits.append(key)
        elif key in path_l:
            score += 6; hits.append(key)
    for hint in ROOT_HINTS:
        if hint.lower() in path_l:
            score += 20; hits.append("source:"+hint)
    return score,hits

def main():
    assets = unreal.EditorAssetLibrary.list_assets("/Game", recursive=True, include_folder=False)
    rows=[]
    for idx,path in enumerate(assets):
        if idx % 500 == 0:
            unreal.log(f"[HwanghonDungeon] scan {idx}/{len(assets)}")
        name=path.rsplit('/',1)[-1]
        pl=path.lower(); nl=name.lower()
        for category,keys in KEYWORDS.items():
            sc,hits=score(pl,nl,keys)
            if sc>0:
                rows.append({"category":category,"score":sc,"asset_path":path,"asset_name":name,"reasons":";".join(hits)})
    rows.sort(key=lambda r:(r["category"],-r["score"],r["asset_path"]))
    saved=Path(unreal.Paths.project_saved_dir())/"DungeonAssetAudit"
    saved.mkdir(parents=True,exist_ok=True)
    with (saved/"asset_candidates.csv").open("w",encoding="utf-8-sig",newline="") as fp:
        writer=csv.DictWriter(fp,fieldnames=["category","score","asset_path","asset_name","reasons"])
        writer.writeheader(); writer.writerows(rows)
    (saved/"asset_candidates.json").write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding="utf-8")
    unreal.log(f"[HwanghonDungeon] wrote {saved/'asset_candidates.csv'}")

if __name__ == "__main__":
    main()
