"""Gangnam bunker hub NPCs (docs/design/152) -> ue/HwanghonCombatUE/Content/Data/shelter_npcs.json.

The director's HwanghonShelter plugin (v2) ships station NPCs with written dialogue; the novel is the source of
truth, so the hub speaks the novel's own lines (each with its line in 제1부_통합본_EP01-28.md, speaker checked in
context). AHWShelterGameMode puts these over the plugin's defaults. Names: 「한 장인」 is Han, the smith - 장인 is
what he is, not his name (director 2026-09-29). He dies in EP18 (SF_NPC_HanJanginAlive=false): the smithy is then
without him.

Run: python tools/story/build_shelter_npcs.py
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "ue", "HwanghonCombatUE", "Content", "Data", "shelter_npcs.json")
NOVEL = os.path.join(ROOT, "docs", "story", "source", "제1부_통합본_EP01-28.md")

NPCS = {
    "Matteo": dict(name="마태오", role="인력사무소", src_role="L223 «지하 인력사무소»", portrait="matteo", lines=[
        ("그거 잉크값은 누가 대냐.", "L541"),
        ("얼마 드는데.", "L545"),
        ("…적어.", "L11678"),
    ]),
    "Yujin": dict(name="유진", role="등급 측정", src_role="L391-L509", portrait="yujin", lines=[
        ("…무등록이시네요.", "L399"),
        ("…발판 위로.", "L425"),
        ("대검 무게는 등급에 반영되지 않습니다.", "L505"),
        ("다음 분.", "L509"),
    ]),
    "HanJangin": dict(name="한", role="장인", src_role="L297 «한 장인. … 하루 종일 쇠를 두드린다.»", portrait="hanjangin",
                      alive_flag="SF_NPC_HanJanginAlive", lines=[
        ("지구 쇠라서 그래. 이 쇠에 한번 물린 상처는 지구 쇠로는 안 물러. — 이걸로 치면 다르지.", "L11550"),
    ]),
    "OJeonggil": dict(name="오정길", role="길잡이", src_role="EP02-EP10", portrait=None, lines=[
        ("케이블 길이가 팔십입니다. 그 이상은 못 당깁니다.", "L7412"),
        ("…경보기입니다. 조잡하지만, 묶은 솜씨는 조잡하지 않습니다.", "L8333"),
        ("저는 각인자가 아니라서.", "L4732"),
    ]),
    "Duho": dict(name="두호", role="두나의 오빠", src_role="L1544-L1550", portrait=None, lines=[
        ("…동생 약이요. 여덟 살이요. 두나요.", "L1550"),
        ("아무도 안 믿었던 얘긴데.", "L9357"),
        ("…정말 왔네.", "L11592"),
    ]),
    "DrJin": dict(name="닥터 진", role="의무실", src_role="L1311, L8265, L9706", portrait="drjin", lines=[
        ("…다음 건, 없을 수도 있습니다.", "L8265"),
        ("지금 있는 걸로는 넉 달입니다. 그 안에 이 중에 세 개만 구하면 여섯 달이 되고, 여섯 개면 일 년이 됩니다.", "L9706"),
    ]),
    "Suhui": dict(name="수희", role="배급", src_role="L277", portrait="suhui", lines=[
        ("한 사람당 두 통! 더는 없어요! 어제 두 통 받아 간 사람은 오늘 한 통!", "L279"),
    ]),
}


def main():
    novel = open(NOVEL, encoding="utf-8").read().replace("**", "").split("\n")
    for nid, n in NPCS.items():
        for text, src in n["lines"]:
            ln = int(src[1:])
            if text not in novel[ln - 1]:
                sys.exit(f"{nid}: «{text}» is not on {src}")
    out = {"schema": "hwanghon-shelter-npcs-v1", "novel": os.path.relpath(NOVEL, ROOT).replace(os.sep, "/"),
           "npcs": {k: dict(v, lines=[{"text": t, "src": s} for t, s in v["lines"]]) for k, v in NPCS.items()}}
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{len(NPCS)} NPCs, {sum(len(v['lines']) for v in NPCS.values())} lines -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
