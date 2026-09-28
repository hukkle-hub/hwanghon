"""Story episodes config -> ue/HwanghonCombatUE/Content/Data/story_episodes.json (docs/design/150).

The novel is the source of truth. Each fight here is written from its canon extraction doc
(138 EP01, 142 Clave, 145 EP04-05/16-17, 146 EP06-09, 147 EP10-15, 148 EP18-23, 149 EP24-28);
every callout carries its novel line. The story director reads this per episode; the world builder
(ue/HwanghonCombatUE/Scripts/ue_story_world.py) builds each episode's graybox world from the same file.

Run: python tools/story/build_story_episodes.py
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "ue", "HwanghonCombatUE", "Content", "Data", "story_episodes.json")
SCENES = os.path.join(ROOT, "docs", "story", "_scenes")


def world(ep):
    return f"/Game/Hwanghon/Story/{ep}/{ep}_World"


EPISODES = {
    # ------------------------------------------------------------------ EP01 (docs/design/136-143)
    "EP01": {
        "world": "/Game/Hwanghon/Story/EP01/EP01_TrainingRoom_World",
        "hand_built": True,   # Scripts/ue_ep01_arena_graybox.py
        "arena_locations": ["loc_heosuabi_training_ground"],
        "card_camera": "CAM_Entry_Wide",
        "battles": [{
            "first_scene": "EP01_SC016",
            "rules": "HWHeosuabiRules",
            "boss_ko": "훈련용 짚단 허수아비",
            "boss_scale": 1.0,
            "party": ["kain"],
            "prefix": "",
            "recover": "crystal",
            "crystal_scale": 0.035,
            "recover_line": "…아직 따뜻했다",
            "layers": {"pre": ["DL_Story_PreBattle"], "fight": ["DL_Phase1"], "after": ["DL_Aftermath"]},
            "callouts": {
                "deflect": "…거리. 너무 붙었어.",          # 마감본 L493
                "too_far": "너무 멀면 닿지 않는다",          # L499
                "intercept": "비켜!",                       # L509
                "rebound": "내 뒤로는… 못 지난다!",          # L523
                "sever": "걸었다… 스위트 스폿!",            # L557
            },
        }],
    },
}


def main():
    eps = sorted(EPISODES)
    for i, ep in enumerate(eps):
        e = EPISODES[ep]
        e.setdefault("world", world(ep))
        nxt = f"EP{int(ep[2:]) + 1:02d}"
        e.setdefault("next_world", world(nxt) if int(ep[2:]) < 28 else "")
        # every first_scene must exist in that episode's scene list
        scenes = json.load(open(os.path.join(SCENES, f"{ep}.json"), encoding="utf-8"))["Scenes"]
        ids = {s["SceneId"] for s in scenes}
        for b in e.get("battles", []):
            if b["first_scene"] not in ids:
                sys.exit(f"{ep}: battle scene {b['first_scene']} not in _scenes/{ep}.json")
    out = {"schema": "hwanghon-story-episodes-v1", "episodes": EPISODES}
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{len(EPISODES)} episodes, {sum(len(e.get('battles', [])) for e in EPISODES.values())} battles -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
