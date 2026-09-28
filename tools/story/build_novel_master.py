"""Novel -> Game master build (docs/story, doc 135).

Reads docs/story/_scenes/EPxx.json (one per episode, schema docs/story/_scenes/SCHEMA.md) and writes:
  ue/HwanghonCombatUE/Content/Data/novel_game_master.json   machine-readable master
  docs/story/HWANGHON_NOVEL_TO_GAME_MASTER.md                 indices: episodes, scenes, locations, characters, bosses
  docs/story/HWANGHON_ASSET_REQUIREMENTS.md                   merged asset needs, reuse counts
  docs/dungeons/<BossId>_DUNGEON_SPEC.md                      per-boss dungeon spec skeleton (novel facts + TBD_CANON)

python tools/story/build_novel_master.py [--check]   (--check: validate only, exit 1 on schema/coverage errors)
"""
import collections
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCENES = os.path.join(ROOT, "docs", "story", "_scenes")
OUT_JSON = os.path.join(ROOT, "ue", "HwanghonCombatUE", "Content", "Data", "novel_game_master.json")
OUT_MD = os.path.join(ROOT, "docs", "story", "HWANGHON_NOVEL_TO_GAME_MASTER.md")
OUT_ASSETS = os.path.join(ROOT, "docs", "story", "HWANGHON_ASSET_REQUIREMENTS.md")
OUT_DUNGEONS = os.path.join(ROOT, "docs", "dungeons")
NOVEL = {"file": "제1부_통합본_EP01-28.md", "sha256": "117d02a391165e09d5acc619548095321d5498bccd3792e97c250a691e018c2d",
         "location": "docs/story/source/",
         "ep01": "docs/story/source/황혼_1부_소설판_제01화_마감본.txt (EP01 canon: the finalized episode overrides the compiled text)"}
FIELDS = ["EpisodeId", "SceneId", "NovelSource", "NovelSummary", "Location", "TimeOfDay", "Characters", "RequiredCostumes",
          "RequiredEquipment", "StoryBeat", "PlayerCharacter", "NPCs", "Dialogue", "GameMode", "PlayerGoal", "Interaction",
          "BossId", "BossPhase", "EnvironmentState", "Props", "VFX", "SFX", "Music", "GameplayEntry", "GameplayExit",
          "AnimationRequired", "CinematicRequired", "SaveFlags", "Prerequisites", "NextScene", "RequiredAssets", "CanonStatus"]
# Canonical boss table: novel boss -> design sheet (UEIntroProject Content/Twilight/UI/BossArt) and the UEIntroProject
# boss catalog id (HwanghonBossData.cpp). Agents named some bosses differently per episode; aliases fold them.
CANON_BOSSES = [
    ("boss_training_heosuabi", "훈련용 짚단 허수아비", "T_BossArt_Scarecrow.png", "TestBoss", []),
    ("boss_clave", "클레이브", "T_BossArt_Clave.png", "Cleave", ["boss_cleave"]),
    ("boss_celestial", "셀레스티얼", "T_BossArt_Celestial.png", "Celestial", []),
    ("boss_aegis_07", "에이지스-07", "T_BossArt_Aegis07.png", "Aegis07", []),
    ("boss_leviathan", "레비아탄 (원문 EP27 L14590 «터널의 레비아탄», 시트 «레비아탄 나노»)", "T_BossArt_Leviathan.png", "LeviathanNano",
     ["boss_hangang_tunnel_creature", "boss_hangang_tunnel_nom"]),
    ("boss_subject_09", "실험체 09호", "T_BossArt_Subject09.png", "Subject09", ["boss_silheomche_09"]),
    ("boss_shadow_fang", "섀도우 팽", "T_BossArt_ShadowFang.png", "ShadowFang", []),
    ("boss_arsenal_overlord", "아스널 오버로드", "T_BossArt_Arsenal.png", "ArsenalOverlord", []),
    ("boss_general_park", "박 준장", "T_BossArt_GeneralPark.png", "GeneralPark", ["boss_bak_junjang"]),
    ("boss_minister_jeong", "정 장관", "", "MinisterJeong", ["boss_jeong_janggwan"]),
    ("boss_nano_nova_core", "나노-노바 코어", "", "NanoNovaCore", []),
    ("boss_amplifier_tower", "발사대 탑 (증폭기)", "", "NanoNovaCore phase 2 «증폭 탑 앵커» (TBD_CANON: 별도 보스?)", ["boss_balsadae_tap"]),
]
DESIGN_ONLY = [("아이언 워든", "T_BossArt_IronWarden.png", "IronWarden"), ("이 중장", "T_BossArt_GeneralLee.png", "GeneralLee")]
BOSS_ALIAS = {a: c[0] for c in CANON_BOSSES for a in [c[0]] + c[4]}
BOSS_INFO = {c[0]: c for c in CANON_BOSSES}


MODES = {"STORY_CINEMATIC", "STORY_WALK", "STORY_DIALOGUE", "INVESTIGATION", "TRANSITION", "BOSS_ENTRY", "BOSS_BATTLE",
         "BOSS_RESULT", "FLASHBACK", "ANIMATION_ONLY"}


def load():
    eps = []
    for name in sorted(os.listdir(SCENES)):
        if re.fullmatch(r"EP\d\d\.json", name):
            with open(os.path.join(SCENES, name), encoding="utf-8") as f:
                eps.append(json.load(f))
    return eps


def check(eps):
    errors = []
    for ep in eps:
        prev_end = None
        for sc in ep.get("Scenes", []):
            missing = [k for k in FIELDS if k not in sc]
            if missing:
                errors.append(f"{sc.get('SceneId')}: missing {missing}")
            bad = [m for m in (sc.get("GameMode") or []) if m not in MODES]
            if bad:
                errors.append(f"{sc.get('SceneId')}: unknown GameMode {bad}")
            m = re.search(r"L(\d+)\s*-\s*L?(\d+)", str(sc.get("NovelSource", "")))
            if not m:
                errors.append(f"{sc.get('SceneId')}: NovelSource has no line range")
                continue
            a, b = int(m.group(1)), int(m.group(2))
            # Tiling within one source file: a gap of more than 3 lines means prose was skipped.
            if prev_end is not None and a > prev_end + 4 and "마감본" not in str(sc.get("NovelSource")):
                errors.append(f"{sc.get('SceneId')}: gap after L{prev_end} (starts L{a})")
            prev_end = b
    return errors


def norm_ko(s):
    return re.sub(r"[\s·().,\-]+", "", str(s or ""))


def merge(eps):
    locs, chars, bosses, anims, props = {}, {}, {}, {}, {}
    vfx, sfx, music, costumes, equipment = (collections.Counter() for _ in range(5))
    cinematics, tbd, modes = [], [], collections.Counter()
    for ep in eps:
        eid = ep["EpisodeId"]
        for l in ep.get("Locations", []):
            key = norm_ko(l.get("NameKo")) or l.get("LocationId")
            e = locs.setdefault(key, {"LocationId": l.get("LocationId"), "NameKo": l.get("NameKo"), "Descriptions": [], "Episodes": [], "Scenes": []})
            e["Descriptions"].append(f"{eid}: {l.get('DescriptionKo', '')}")
            e["Episodes"].append(eid)
            e["Scenes"] += l.get("Scenes", [])
        for c in ep.get("Characters", []):
            key = c.get("CharacterId")
            e = chars.setdefault(key, {"CharacterId": key, "NameKo": c.get("NameKo"), "Roles": [], "Episodes": [], "Scenes": [], "StateChanges": []})
            e["Roles"].append(f"{eid}: {c.get('RoleKo', '')}")
            e["Episodes"].append(eid)
            e["Scenes"] += c.get("Scenes", [])
            e["StateChanges"] += c.get("StateChangesKo", [])
        for b in ep.get("Bosses", []):
            key = BOSS_ALIAS.get(b.get("BossId"), b.get("BossId"))
            info = BOSS_INFO.get(key)
            e = bosses.setdefault(key, {"BossId": key, "NameKo": info[1] if info else b.get("NameKo"),
                                        "DesignSheet": info[2] if info else "", "UEIntroCatalog": info[3] if info else "",
                                        "Episodes": [], "Entries": []})
            e["Episodes"].append(eid)
            e["Entries"].append(dict(b, EpisodeId=eid))
        for a in ep.get("AnimationRequirements", []):
            key = a.get("Action")
            e = anims.setdefault(key, {"Action": key, "Category": a.get("Category"), "Characters": set(), "Episodes": set(), "Scenes": [], "DonorLikely": a.get("DonorLikely")})
            e["Characters"].update(a.get("Characters", []))
            e["Episodes"].add(eid)
            e["Scenes"] += a.get("Scenes", [])
        for p in ep.get("Props", []):
            key = norm_ko(p.get("NameKo")) or p.get("PropId")
            e = props.setdefault(key, {"PropId": p.get("PropId"), "NameKo": p.get("NameKo"), "Episodes": set(), "Scenes": []})
            e["Episodes"].add(eid)
            e["Scenes"] += p.get("Scenes", [])
        for sc in ep.get("Scenes", []):
            for m in sc.get("GameMode") or []:
                modes[m] += 1
            vfx.update(sc.get("VFX") or [])
            sfx.update(sc.get("SFX") or [])
            if sc.get("Music"):
                music[sc["Music"]] += 1
            costumes.update(sc.get("RequiredCostumes") or [])
            equipment.update(sc.get("RequiredEquipment") or [])
            cr = sc.get("CinematicRequired")
            if cr is True or (isinstance(cr, str) and cr.lower().startswith("true")):
                cinematics.append(sc["SceneId"])
        for t in ep.get("TBD_CANON", []):
            tbd.append(dict(t, EpisodeId=eid))
    for e in anims.values():
        e["Characters"] = sorted(e["Characters"])
        e["Episodes"] = sorted(e["Episodes"])
        e["Shared"] = len(e["Episodes"]) >= 2 or len(e["Characters"]) >= 2
    for e in props.values():
        e["Episodes"] = sorted(e["Episodes"])
    return dict(locations=locs, characters=chars, bosses=bosses, animations=anims, props=props, vfx=vfx, sfx=sfx,
                music=music, costumes=costumes, equipment=equipment, cinematics=cinematics, tbd=tbd, modes=modes)


def table(rows, head):
    out = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    out += ["| " + " | ".join(str(c).replace("|", "/").replace("\n", " ") for c in r) + " |" for r in rows]
    return "\n".join(out)


def write_md(eps, m):
    total = sum(len(ep.get("Scenes", [])) for ep in eps)
    lines = ["# 황혼 Novel → Game 마스터 (자동 생성 — `python tools/story/build_novel_master.py`)", "",
             f"- 원문: `{NOVEL['file']}` (sha256 `{NOVEL['sha256'][:16]}…`, {NOVEL['location']})",
             f"- EP01: {NOVEL['ep01']}",
             "- 우선순위: 확정 소설 > 디자인 시트 > 이 마스터 > 게임 시스템 > UI. 원문에 없는 것은 `TBD_CANON`.", "",
             f"## 요약\n\n- 에피소드 {len(eps)} · 장면 {total} · 장소 {len(m['locations'])} · 인물 {len(m['characters'])} · 보스 {len(m['bosses'])}"
             f" · 시네마틱 필요 장면 {len(m['cinematics'])} · TBD_CANON {len(m['tbd'])}", "",
             "- GameMode 분포: " + ", ".join(f"{k} {v}" for k, v in m["modes"].most_common()), "",
             "## 1. 에피소드", "",
             table([(ep["EpisodeId"], ep.get("TitleKo", ""), len(ep.get("Scenes", [])),
                     ", ".join(b.get("NameKo", "") for b in ep.get("Bosses", [])) or "—",
                     ep.get("NovelSource", {}).get("lines", "")) for ep in eps],
                   ["EP", "제목", "장면", "보스", "원문 줄"]), "",
             "## 2. 보스 (디자인 시트 대조 포함 — 시트: UEIntroProject `Content/Twilight/UI/BossArt`)", "",
             table([(b["NameKo"], b["DesignSheet"] or "**시트 없음**", b["UEIntroCatalog"]) for b in m["bosses"].values()]
                   + [(n + " (**1부 원문 등장 없음**)", f, c) for n, f, c in DESIGN_ONLY], ["보스", "디자인 시트", "UEIntroProject 카탈로그"]), "",
             table([(b["NameKo"], b["BossId"], ", ".join(sorted(set(b["Episodes"]))),
                     "; ".join((x.get("NovelReasonForBattle") or "")[:80] for x in b["Entries"]),
                     ", ".join(sorted({s for x in b["Entries"] for s in x.get("Scenes", [])}))[:120])
                    for b in m["bosses"].values()], ["보스", "ID", "EP", "전투 이유(원문)", "장면"]), "",
             "## 3. 장소", "",
             table([(l["NameKo"], l["LocationId"], ", ".join(sorted(set(l["Episodes"]))), len(set(l["Scenes"])))
                    for l in sorted(m["locations"].values(), key=lambda x: -len(set(x["Scenes"])))],
                   ["장소", "ID", "EP", "장면 수"]), "",
             "## 4. 인물 등장표", "",
             table([(c["NameKo"], c["CharacterId"], ", ".join(sorted(set(c["Episodes"]))), len(set(c["Scenes"])))
                    for c in sorted(m["characters"].values(), key=lambda x: -len(set(x["Scenes"])))],
                   ["인물", "ID", "EP", "장면 수"]), "",
             "## 5. 장면 목록", ""]
    for ep in eps:
        lines.append(f"### {ep['EpisodeId']} {ep.get('TitleKo', '')}\n")
        lines.append(table([(s["SceneId"], s.get("Location"), "/".join(s.get("GameMode") or []), s.get("BossId") or "",
                             (s.get("NovelSummary") or "")[:70], s.get("CanonStatus"), s.get("NovelSource"))
                            for s in ep.get("Scenes", [])], ["Scene", "장소", "GameMode", "보스", "요약", "Canon", "원문"]))
        lines.append("")
    lines += ["## 6. TBD_CANON (작가 확인 필요)", "",
              table([(t["EpisodeId"], t.get("Scene", ""), t.get("QuestionKo", "")) for t in m["tbd"]], ["EP", "Scene", "질문"])]
    os.makedirs(os.path.dirname(OUT_MD), exist_ok=True)
    open(OUT_MD, "w", encoding="utf-8").write("\n".join(lines) + "\n")


def write_assets(m):
    an = sorted(m["animations"].values(), key=lambda a: (-len(a["Episodes"]), a["Action"]))
    shared = sum(1 for a in an if a["Shared"])
    donor = sum(1 for a in an if a.get("DonorLikely"))
    lines = ["# 황혼 자산 요구표 (소설에서 자동 집계 — `python tools/story/build_novel_master.py`)", "",
             f"- 애니메이션 {len(an)} 종 · 공통(2개 EP 이상 또는 2명 이상) {shared} · donor 후보 {donor}", "",
             "## Environment (장소)", "",
             table([(l["NameKo"], l["LocationId"], ", ".join(sorted(set(l["Episodes"]))), len(set(l["Scenes"])))
                    for l in sorted(m["locations"].values(), key=lambda x: -len(set(x["Scenes"])))], ["장소", "ID", "EP", "재사용 장면"]), "",
             "## Character", "",
             table([(c["NameKo"], c["CharacterId"], len(set(c["Episodes"])), "; ".join(c["StateChanges"])[:160])
                    for c in sorted(m["characters"].values(), key=lambda x: -len(set(x["Episodes"])))], ["인물", "ID", "EP 수", "상태 변화"]), "",
             "## Costume", "", table(m["costumes"].most_common(), ["복장", "장면 수"]), "",
             "## Equipment", "", table(m["equipment"].most_common(), ["장비", "장면 수"]), "",
             "## Props", "", table([(p["NameKo"], p["PropId"], ", ".join(p["Episodes"]), len(p["Scenes"]))
                                    for p in sorted(m["props"].values(), key=lambda x: -len(x["Scenes"]))], ["소품", "ID", "EP", "장면"]), "",
             "## Animation", "", table([(a["Action"], a["Category"], ", ".join(a["Characters"]), ", ".join(a["Episodes"]),
                                        "공통" if a["Shared"] else "", "donor" if a.get("DonorLikely") else "") for a in an],
                                      ["동작", "분류", "인물", "EP", "공통", "donor"]), "",
             "## Boss", "", table([(b["NameKo"], b["BossId"], ", ".join(sorted(set(b["Episodes"])))) for b in m["bosses"].values()], ["보스", "ID", "EP"]), "",
             "## VFX", "", table(m["vfx"].most_common(), ["VFX", "장면 수"]), "",
             "## Audio — SFX", "", table(m["sfx"].most_common(), ["SFX", "장면 수"]), "",
             "## Audio — Music", "", table(m["music"].most_common(), ["음악(분위기)", "장면 수"]), "",
             "## Cinematic", "", ", ".join(m["cinematics"]) or "—"]
    open(OUT_ASSETS, "w", encoding="utf-8").write("\n".join(lines) + "\n")


def write_dungeons(m):
    os.makedirs(OUT_DUNGEONS, exist_ok=True)
    for b in m["bosses"].values():
        e0 = b["Entries"][0]
        fields = [
            ("BossId", b["BossId"]), ("EpisodeId", ", ".join(sorted(set(b["Episodes"])))),
            ("SceneRange", ", ".join(sorted({s for x in b["Entries"] for s in x.get("Scenes", [])}))),
            ("NovelReasonForBattle", " / ".join(x.get("NovelReasonForBattle") or "TBD_CANON" for x in b["Entries"])),
            ("ArenaLocation", e0.get("ArenaLocationId") or "TBD_CANON"),
            ("PhasesInNovel", "; ".join(p for x in b["Entries"] for p in x.get("PhasesInNovel", [])) or "TBD_CANON"),
            ("PatternsInNovel", "; ".join(p for x in b["Entries"] for p in x.get("PatternsInNovel", [])) or "TBD_CANON"),
            ("PartBreak/Weakpoints", "; ".join(p for x in b["Entries"] for p in x.get("PartsOrWeakpointsInNovel", [])) or "TBD_CANON"),
            ("Break/Counter", "; ".join(p for x in b["Entries"] for p in x.get("BreakCounterInNovel", [])) or "TBD_CANON"),
            ("EnvironmentInBattle", "; ".join(p for x in b["Entries"] for p in x.get("EnvironmentInBattle", [])) or "TBD_CANON"),
            ("Outcome", " / ".join(x.get("Outcome") or "TBD_CANON" for x in b["Entries"])),
            ("Source", ", ".join(f"{x['EpisodeId']} {x.get('Source', '')}" for x in b["Entries"]))]
        body = [f"# {b['NameKo']} — Boss Dungeon Spec (소설 기반 초안, 자동 생성)", "",
                "> 공식: Story → Boss Entry → Boss Arena → Boss Battle → Boss Result → Story. 잡몹 방 없음.",
                "> 아래 «소설에서 온 것» 은 원문 사실. «게임 설계» 는 원문과 충돌하지 않게 채울 칸이며, 비어 있으면 TBD.", "",
                "## 소설에서 온 것", "", table(fields, ["필드", "내용"]), "",
                "## 게임 설계 (TBD — 원문 근거를 달아 채운다)", "",
                table([(k, "TBD") for k in ("ArenaBeforeBattle", "ArenaPhase1", "ArenaPhase2", "ArenaPhase3", "ArenaAfterBattle",
                                            "PlayerCharacter", "SupportingCharacters", "Phase1Patterns", "Phase2Patterns",
                                            "Phase3Patterns", "BreakRules", "CounterRules", "PartBreakRules", "StoryMechanics",
                                            "EnvironmentalMechanics", "BossEntryCinematic", "PhaseTransitionCinematics",
                                            "BossDeathCinematic", "PostBattleScene", "AnimationAssets", "AudioAssets",
                                            "VFXAssets", "RequiredStoryFlags")], ["필드", "값"])]
        path = os.path.join(OUT_DUNGEONS, f"{b['BossId']}_DUNGEON_SPEC.md")
        if os.path.exists(path) and "<!-- MANUAL -->" in open(path, encoding="utf-8").read():
            continue   # a hand-written spec (episode in production) is never overwritten
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(body) + "\n")


def main():
    eps = load()
    errors = check(eps)
    for e in errors:
        print("CHECK", e)
    if "--check" in sys.argv:
        sys.exit(1 if errors else 0)
    m = merge(eps)
    master = {"schema": "hwanghon.novel_game_master.v1", "novel": NOVEL,
              "episodes": [{k: v for k, v in ep.items() if k != "Scenes"} | {"SceneIds": [s["SceneId"] for s in ep.get("Scenes", [])]} for ep in eps],
              "scenes": [dict(s, BossId=BOSS_ALIAS.get(s.get("BossId"), s.get("BossId"))) for ep in eps for s in ep.get("Scenes", [])],
              "design_only_bosses": [{"NameKo": n, "DesignSheet": f, "UEIntroCatalog": c, "CanonStatus": "TBD_CANON — 1부 원문 등장 없음"} for n, f, c in DESIGN_ONLY],
              "bosses": list(m["bosses"].values()), "locations": list(m["locations"].values()),
              "characters": list(m["characters"].values()), "animations": list(m["animations"].values()),
              "props": list(m["props"].values()), "tbd_canon": m["tbd"], "check_errors": errors}
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(master, f, ensure_ascii=False, indent=1, default=list)
    write_md(eps, m)
    write_assets(m)
    write_dungeons(m)
    print(f"episodes {len(eps)} scenes {len(master['scenes'])} locations {len(m['locations'])} characters {len(m['characters'])}"
          f" bosses {len(m['bosses'])} animations {len(m['animations'])} (shared {sum(1 for a in m['animations'].values() if a['Shared'])})"
          f" tbd {len(m['tbd'])} check_errors {len(errors)}")


main()
