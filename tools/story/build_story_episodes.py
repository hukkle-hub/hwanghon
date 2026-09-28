"""Story episodes config -> ue/HwanghonCombatUE/Content/Data/story_episodes.json (docs/design/150).

The novel is the source of truth. Each fight here is written from its canon extraction doc
(138 EP01, 142 Clave, 145 EP04-05/16-17, 146 EP06-09, 147 EP10-15, 148 EP18-23, 149 EP24-28);
every callout carries its novel line ("src"). The story director reads this per episode; the world builder
(ue/HwanghonCombatUE/Scripts/ue_story_world.py) builds each episode's graybox world from the same file.

Grammar (UHWScriptedCanonRules, doc 150): someone - Kain, Ryu, Sera, an NPC, the place itself - opens a
moment; Ain lands the decisive cut from one scythe length inside it. Timings and reach are design values;
who opens, what ends the fight and every spoken line come from the text.

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


def pat(ko, clip, src, **kw):
    """A boss move: the novel's name, the stand-in body clip, design timing/reach."""
    return dict(ko=ko, clip=clip, src=src, **kw)


def step(sid, src, **kw):
    """One stage of the fight as the text stages it (doc 150 §2)."""
    return dict(id=sid, src=src, **kw)


def move(who, to, dist=175):
    return {"who": who, "to": to, "dist": dist}


def battle(first_scene, boss_ko, party, script, *, scale=1.0, recover=None, crystal_scale=0.05,
           recover_line=None, callouts=None, arena=None, result="", src=""):
    b = {
        "first_scene": first_scene,
        "rules": "HWScriptedCanonRules",
        "boss_ko": boss_ko,
        "boss_scale": scale,
        "party": party,
        "result": result,   # the text's outcome: kill / retreat / contained / win / defend / destroyed
        "src": src,
        "script": script,
        "callouts": dict(callouts or {}),
        "arena": arena or {"kind": "outdoor"},
    }
    if recover:
        b["recover"] = recover
        b["crystal_scale"] = crystal_scale
        if recover_line:
            b["recover_line"] = recover_line
    return b


SHIELD = "틱—"   # the scythe glancing off a shutter / barrier (EP02 L1880s, EP06 L6279)

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
            "recover_line": "아직 따뜻했고, 손안에서 희미하게 뛰고 있었다.",   # L565
            "layers": {"pre": ["DL_Story_PreBattle"], "fight": ["DL_Phase1"], "after": ["DL_Aftermath"]},
            "callouts": {
                "deflect": "…거리. 너무 붙었어.",          # 마감본 L493
                "too_far": "너무 멀면 닿지 않고, 너무 가까우면 돌지 않는다.",   # L501
                "intercept": "비켜!",                       # L509
                "rebound": "내 뒤로는… 못 지난다!",          # L523
                "sever": "걸었다… 스위트 스폿!",            # L557
            },
        }],
    },

    # ------------------------------------------------------------------ EP02 클레이브 조우 (doc 142 §1 EP02)
    "EP02": {"battles": [
        battle("EP02_SC014", "클레이브", ["kain", "ojeonggil"], result="retreat", scale=1.3, src="L1774-L1936",
               arena={"kind": "underground", "features": ["지하상가 광장", "배수로 격자(퇴로)"],
                      "destroy": [{"what": "바닥 균열", "src": "L1908", "when": "after"}]},
               callouts={"guarded": SHIELD},
               script={
                   "guard": "deflect", "end_after_s": 60,
                   "patterns": [pat("셔터 밀어내기", "Charge", "L1854-L1868", lunge_cm=240, tell=0.8, damage=1800),
                                pat("장검 내려찍기", "Slam", "L1908", tell=1.2, damage=3200, range=300)],
                   "steps": [
                       step("pass", "L1800-L1852", callout="벌레 같은 생존자들이여… 황혼의 종말을 맞아라.",
                            advance_after_s=4),
                       step("front", "L1854-L1904", moves=[move("kain", "front", 170), move("ojeonggil", "behind")],
                            advance_after_s=10),
                       step("slam", "L1908-L1936", moves=[move("kain", "behind"), move("ojeonggil", "marker:B1_Exit")],
                            advance_after_s=5, advance_beat="retreat", advance_then="end"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP03 광장 → 선로 (doc 142 §1 EP03)
    "EP03": {"battles": [
        battle("EP03_SC009", "클레이브", ["kain", "ojeonggil"], result="phase", scale=1.3, src="L2672-L3346",
               arena={"kind": "underground", "features": ["지하 광장", "매대(발판)", "진열대", "중앙 기둥"],
                      "destroy": [{"what": "진열대 3개", "src": "L2830", "when": "fight"},
                                  {"what": "중앙 기둥·천장", "src": "L3326-L3346", "when": "after"}]},
               callouts={"guarded": SHIELD},
               script={
                   "guard": "deflect",
                   "patterns": [pat("셔터 밀어내기", "Charge", "L2672-L2700", lunge_cm=240, tell=0.8, damage=1800),
                                pat("배트 스윙", "Spin", "L2804-L2830", tell=1.1, damage=2600, range=280)],
                   "steps": [
                       step("hinge", "L2463-L2499", callout="아래쪽이 먼저 나가요",
                            moves=[move("kain", "front", 170), move("ojeonggil", "side_r", 420)], advance_after_s=8),
                       step("brace", "L2894-L3006", callout="밀지 마. 버텨.",
                            moves=[move("kain", "front", 160), move("ojeonggil", "side_r", 420)], advance_after_s=8),
                       step("barehand", "L3090-L3276", callout="…맨손으로 한다.",
                            moves=[move("kain", "front", 150), move("ojeonggil", "behind")],
                            open="ready", opener="kain", open_s=3.0, needs=1, decisive_beat="socket_cut", then="end"),
                   ]}),
        battle("EP03_SC015", "클레이브", ["kain"], result="kill", scale=1.3, src="L3346-L3418",
               arena={"kind": "underground", "features": ["2호선 침수 선로", "레일"], "water_cm": 30},
               recover="crystal", crystal_scale=0.08, recover_line="아인이 그것을 두 손으로 받았다. 뜨거웠다.",   # 어른 주먹만 L3414-L3418
               script={
                   "guard": "cut",
                   "patterns": [pat("장검 양손 베기", "Slam", "L3326-L3346", tell=1.0, damage=3000, range=300)],
                   "steps": [
                       step("grab", "L3364-L3398", callout="목 아래 왼쪽",
                            moves=[move("kain", "grab", 110)], open="ready", opener="kain", open_s=3.0, needs=1,
                            then="kill"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP04 셀레스티얼 1차 (doc 145)
    "EP04": {"battles": [
        battle("EP04_SC010", "셀레스티얼", ["kain", "ojeonggil"], result="retreat", scale=2.0, src="L4400-L4546",
               arena={"kind": "outdoor", "features": ["반파된 전망대", "사랑의 자물쇠", "40m 낙하 지점(붉은 안개)"],
                      "destroy": [{"what": "전망대 난간 2구간", "src": "L4406-L4410, L4488-L4494", "when": "after"}]},
               callouts={"retreat": "놈은 거기 산다."},   # L4546
               script={
                   "guard": "cut",   # 닿을 수단이 없다 - 베여도 끝나지 않는다
                   "patterns": [pat("난간 급강하", "Charge", "L4406-L4410", lunge_cm=500, tell=0.6, damage=2200),
                                pat("급강하 할퀴기", "HookCombo", "L4476-L4484", tell=0.7, damage=2600)],
                   "steps": [
                       step("circle", "L4400-L4402", advance_after_s=5),
                       step("rail", "L4406-L4494", callout="…난간을 부수고 있어. 왜? 떨어뜨리려고.",
                            moves=[move("kain", "front", 180), move("ojeonggil", "behind")], advance_after_s=12),
                       step("wire", "L4540-L4546", moves=[move("kain", "behind")], advance_after_s=4,
                            advance_beat="retreat", advance_then="end"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP05 케이블카 드로퍼 (doc 145)
    # 전투 장면에 BOSS 태그가 없다: 원문 위치로 장면을 고른다 (SC005 L5047-L5102, SC011 L5394-L5467).
    "EP05": {"battles": [
        battle("EP05_SC005", "케이블카 드로퍼", ["kain", "ojeonggil"], result="retreat", scale=0.9, src="L5047-L5102",
               arena={"kind": "indoor", "features": ["옛 식당·기념품점 잔해", "깨진 유리", "천장 배관(낙하 경로)"],
                      "destroy": [{"what": "천장 배관·바닥 일부", "src": "L5017-L5025", "when": "fight"}]},
               callouts={"retreat": "여긴 위가 열려 있어요. 아래로 내려가요."},   # L5091
               script={
                   "guard": "cut",
                   "patterns": [pat("천장 낙하", "Slam", "L5047-L5067", tell=0.25, damage=2400, range=260)],
                   "steps": [
                       step("drop", "L5013-L5067", callout="…발톱이 넷이야.",
                            moves=[move("kain", "side", 220), move("ojeonggil", "behind")],
                            advance_after_s=10, advance_beat="retreat", advance_then="end"),
                   ]}),
        battle("EP05_SC011", "케이블카 드로퍼", ["kain", "ojeonggil"], result="win", scale=0.9, src="L5394-L5428",
               arena={"kind": "indoor", "features": ["계단참", "드로퍼 넷"]},
               callouts={"decisive": "한 바퀴가 다 돌았다."},   # L5408
               script={
                   "guard": "cut",
                   "patterns": [pat("천장 낙하", "Slam", "L5394-L5428", tell=0.25, damage=2400, range=260)],
                   "steps": [
                       step("k3", "L5394-L5428", moves=[move("kain", "side", 240), move("ojeonggil", "behind")],
                            open="pattern:천장 낙하", open_s=2.5, needs=1, then="kill"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP06 에이지스-07 조우 (doc 146)
    "EP06": {"battles": [
        battle("EP06_SC008", "에이지스-07", ["kain", "ojeonggil"], result="retreat", scale=2.0, src="L6215-L6444",
               arena={"kind": "outdoor", "fog": "dense", "features": ["빌딩 협곡", "젖은 아스팔트", "LED 광고판"],
                      "destroy": [{"what": "다리 1개", "src": "L6417-L6421", "when": "after"}]},
               callouts={"guarded": SHIELD, "now": "…지금.", "leg_cut": "빠져요!"},   # L6279, L6407, L6429
               script={
                   "guard": "deflect",
                   "patterns": [pat("포문 개방", "Slam", "L6307-L6331", tell=1.1, damage=2800, range=320),
                                pat("다리 휩쓸기", "Spin", "L6367-L6371", tell=0.4, damage=2200, range=300)],
                   "steps": [
                       step("barrier", "L6247-L6301", callout="셔터는 보였다. 이건 안 보인다.",
                            moves=[move("ojeonggil", "behind")], advance_after_s=8),
                       step("cannon", "L6305-L6334", moves=[move("kain", "front", 180)], advance_after_s=8),
                       step("fog", "L6335-L6374", moves=[move("kain", "side", 300)], advance_after_s=6),
                       # 등의 불꽃은 정체불명의 누군가(후일의 류) - 파티가 여는 게 아니라 제3자가 연다
                       step("spark", "L6375-L6429", moves=[move("kain", "side", 300)], open="after:1.5", open_s=2.5,
                            open_beat="now", needs=1, decisive_beat="leg_cut", then="end"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP07 에이지스-07 격파 (doc 146)
    "EP07": {"battles": [
        battle("EP07_SC005", "에이지스-07", ["kain", "ojeonggil"], result="phase", scale=2.0, src="L6802-L6890",
               arena={"kind": "outdoor", "fog": "light", "features": ["빌딩 협곡", "LED 광고판"]},
               callouts={"guarded": SHIELD, "short": "셋이 필요했다. 둘밖에 없었다."},   # L6880-L6882
               script={
                   "guard": "deflect",
                   "patterns": [pat("포문 개방", "Slam", "L6802-L6863", tell=1.1, damage=2800, range=320),
                                pat("측면 회전", "Spin", "L6866-L6888", tell=0.6, damage=2200, range=300)],
                   "steps": [
                       step("bias", "L6802-L6863", callout="아니요. 이번엔 치세요.",
                            moves=[move("kain", "front", 180), move("ojeonggil", "behind")], advance_after_s=8),
                       step("flank", "L6864-L6890", moves=[move("kain", "front", 180)], advance_after_s=6,
                            advance_beat="short", advance_then="end"),
                   ]}),
        battle("EP07_SC008", "에이지스-07", ["kain", "ryu", "ojeonggil"], result="win", scale=2.0, src="L6991-L7099",
               arena={"kind": "outdoor", "fog": "light", "features": ["빌딩 협곡"],
                      "destroy": [{"what": "에이지스-07 전신 붕괴", "src": "L7097-L7111", "when": "after"}]},
               callouts={"guarded": SHIELD, "barrier_off": "꺼졌어요!", "decisive": "4미터짜리가 무너졌다."},  # L7049, L7097
               script={
                   "guard": "deflect",
                   "patterns": [pat("포문 개방", "Slam", "L6991-L7052", tell=1.1, damage=2800, range=320)],
                   "steps": [
                       step("three", "L6903", callout="…셋이면 되겠네.",
                            moves=[move("kain", "front", 180), move("ryu", "side", 300), move("ojeonggil", "behind")],
                            advance_after_s=4),
                       step("stab", "L7029-L7097", moves=[move("kain", "front", 180), move("ryu", "back", 140)],
                            open="ready", opener="ryu", open_s=3.0, open_beat="barrier_off", needs=1, then="kill"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP08 한강 침수 터널 (doc 146)
    "EP08": {"battles": [
        battle("EP08_SC005", "레비아탄", ["kain", "ryu", "kang"], result="retreat", scale=2.2, src="L7446-L7531",
               arena={"kind": "water", "water_cm": 110, "features": ["수몰 터널", "윈치 케이블", "벽 이음매"]},
               callouts={"out": "…나가야 해요. 지금요. 잠복했어요."},   # L7498-L7502
               script={
                   "guard": "cut",
                   "patterns": [pat("측면 돌진", "Charge", "L7448-L7468", lunge_cm=420, tell=0.5, damage=2400),
                                pat("흡입", "GroundWave", "L7482-L7490", tell=0.9, damage=1800, range=420)],
                   "steps": [
                       step("side", "L7446-L7479", callout="방향이 안 잡혀요.",
                            moves=[move("kain", "behind"), move("ryu", "side", 260), move("kang", "side_r", 320)],
                            advance_after_s=8),
                       step("suction", "L7480-L7490", callout="흡입이에요!", advance_after_s=6),
                       step("still", "L7492-L7531", advance_after_s=4, advance_beat="out", advance_then="end"),
                   ]}),
        battle("EP08_SC007", "현 중위", ["kain", "ryu", "ojeonggil"], result="kill", scale=1.0, src="L7537-L7561",
               arena={"kind": "outdoor", "features": ["터널 입구 물가", "헤드램프"]},
               callouts={"decisive": "한 번이었다."},   # L7559
               script={
                   "guard": "cut", "walk_in_cm": 260,
                   "patterns": [],   # 공격하지 않고 걸어 나온다 (L7545-L7557)
                   "steps": [
                       step("walk", "L7545-L7559", callout="…현.",
                            moves=[move("kain", "behind"), move("ryu", "side", 500), move("ojeonggil", "side_r", 520)],
                            open="after:2", open_s=3.0, needs=1, then="kill"),
                   ]}),
        battle("EP08_SC010", "레비아탄", ["kain", "ryu"], result="retreat", scale=2.2, src="L7635-L7723",
               arena={"kind": "water", "water_cm": 110, "features": ["수몰 터널", "부유물"]},
               callouts={"gill_cut": "아니요. 근데 하나 뜯었어요."},   # L7713-L7717
               script={
                   "guard": "cut",
                   "patterns": [pat("아가미 펼침", "Spin", "L7679-L7691", tell=0.8, damage=2000, range=280),
                                pat("측면 돌진", "Charge", "L7649-L7658", lunge_cm=380, tell=0.6, damage=2400)],
                   "steps": [
                       step("float", "L7635-L7658", moves=[move("kain", "behind"), move("ryu", "side", 280)],
                            advance_after_s=6),
                       step("gill", "L7661-L7693", callout="아가미입니다!", moves=[move("kain", "front", 170)],
                            open="pattern:아가미 펼침", opener="kain", open_s=2.5, needs=1, decisive_beat="gill_cut",
                            then="end"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP09 레비아탄 봉쇄 (doc 146)
    "EP09": {"battles": [
        battle("EP09_SC010", "레비아탄", ["kain", "ryu", "ojeonggil"], result="contained", scale=2.2, src="L7940-L8125",
               arena={"kind": "water", "water_cm": 130, "features": ["내측·외측 차수문", "고정핀", "벽 배관(신호)"],
                      "destroy": [{"what": "내측 차수문 낙하", "src": "L8025-L8031", "when": "fight"},
                                  {"what": "외측 차수문 낙하", "src": "L8099-L8113", "when": "after"}]},
               callouts={"inner_gate": "한 번이면 대기. 두 번이면 낙하.", "gate_cut": "낫이 못 한 것을 문이 했다."},  # L7912, L8109
               script={
                   "guard": "cut",
                   "patterns": [pat("해일 역류", "Charge", "L8039-L8063", lunge_cm=420, tell=0.8, damage=2000)],
                   "steps": [
                       step("lure", "L7940-L7973", callout="…미끼가 제일 편해. 생각을 안 해도 되거든.",
                            moves=[move("kain", "front", 260), move("ryu", "marker:B1_InnerPins"),
                                   move("ojeonggil", "marker:B1_Exit")], advance_after_s=6),
                       step("inner", "L7974-L8034", moves=[move("kain", "front", 260), move("ryu", "marker:B1_InnerPins")],
                            advance_after_s=5, advance_beat="inner_gate"),
                       step("surge", "L8035-L8066", moves=[move("kain", "marker:B1_Exit")], advance_after_s=5),
                       step("outer", "L8067-L8109", callout="아인의 눈은 감기지 않았다. 뜬 채로.",
                            moves=[move("kain", "marker:B1_Exit")], open="after:1", open_s=3.0, needs=1,
                            decisive_beat="gate_cut", then="end"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP10 클레이브 두 기 (doc 147) - BOSS 태그 없음
    "EP10": {"battles": [
        battle("EP10_SC005", "클레이브 두 기", ["kain", "ryu", "ojeonggil"], result="win", scale=1.3, src="L8357-L8407",
               recover="crystal", crystal_scale=0.03,
               recover_line="부위를 부순 자리에서만 나오는, 아직 따뜻한 조각이었다.",   # L8407
               arena={"kind": "outdoor", "features": ["8차선 도로", "정차된 차량", "가드레일", "건물 그늘"]},
               callouts={"guarded": SHIELD, "first_down": "지금."},   # L8379
               script={
                   "guard": "deflect",
                   "patterns": [pat("정면 돌진", "Charge", "L8381", lunge_cm=300, tell=0.7, damage=2600)],
                   "steps": [
                       step("signal", "L8365-L8369", callout="여섯 걸음마다 한 번. 그 사이에 끊어야 해요.",
                            moves=[move("kain", "front", 180), move("ryu", "side", 360), move("ojeonggil", "behind")],
                            advance_after_s=4),
                       step("first", "L8379-L8385", moves=[move("kain", "front", 170), move("ryu", "side", 360)],
                            open="pattern:정면 돌진", opener="kain", open_s=2.5, needs=1, decisive_beat="first_down",
                            then="next"),
                       # 둘째 기는 류가 그늘에서 무릎+목을 동시에 친다 (L8389-L8393)
                       step("second", "L8389-L8393", moves=[move("ryu", "back", 120)], advance_after_s=3,
                            advance_beat="ryu_finish", advance_then="kill"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP11 수거대 경비 클레이브 (doc 147)
    "EP11": {"battles": [
        battle("EP11_SC009", "클레이브", ["kain", "ryu"], result="win", scale=1.3, src="L8854-L8878",
               arena={"kind": "outdoor", "features": ["폐차장 공터", "잔해 더미"]},
               callouts={"guarded": SHIELD, "retreat_order": "…계속해."},   # L8876
               script={
                   "guard": "deflect",
                   "patterns": [pat("수직 강타", "Slam", "L8862-L8868", tell=0.35, damage=3400, range=300)],
                   "steps": [
                       step("hold", "L8862-L8870", moves=[move("kain", "front", 165), move("ryu", "side_r", 320)],
                            open="pattern:수직 강타", opener="kain", open_s=3.0, needs=1, then="kill"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP14 실험체 09호 (doc 147)
    "EP14": {"battles": [
        battle("EP14_SC005", "실험체 09호", ["kain", "ryu", "ojeonggil", "minkyung"], result="phase", scale=1.2,
               src="L9844-L9895",
               arena={"kind": "underground", "features": ["폭 2인분 계단", "콘크리트 봉인 파손부", "난간"]},
               script={
                   "guard": "cut",
                   "patterns": [pat("휘감기", "HookCombo", "L9844-L9895", tell=0.8, damage=2000)],
                   # 코어 절단은 임시 격파 - 30/35/40초 뒤 재생 (L9844-L9895)
                   "steps": [s for n, t in ((1, 30), (2, 35), (3, 40)) for s in (
                       step(f"cut{n}", "L9844-L9895", moves=[move("kain", "side", 260), move("ryu", "side_r", 300)],
                            open="after:1.5", open_s=2.0, needs=1, decisive_beat="core_cut", then="next"),
                       step(f"regen{n}", "L9844-L9895", advance_after_s=t, advance_beat="regen",
                            advance_then="end" if n == 3 else "next"),
                   )]}),
        battle("EP14_SC007", "실험체 09호", ["kain", "ryu", "ojeonggil", "minkyung"], result="contained", scale=1.2,
               src="L9935-L10126",
               arena={"kind": "underground", "features": ["계단 병목", "고정액 병"],
                      "destroy": [{"what": "계단 이음매 고정액 봉쇄", "src": "L10005-L10021", "when": "after"}]},
               callouts={"sealed": "두 번 칠게요."},   # L10126
               script={
                   "guard": "cut",
                   "patterns": [pat("벌어져 감싸기", "HookCombo", "L9985-L10005", tell=0.9, damage=2400),
                                pat("잘린 팔 휘감기", "Charge", "L9963-L9971", lunge_cm=260, tell=0.4, damage=1600)],
                   "steps": [
                       step("split", "L9935-L9955", moves=[move("kain", "front", 190), move("ryu", "side", 280)],
                            advance_after_s=6),
                       step("stair", "L9957-L10005", moves=[move("ryu", "front", 190), move("ojeonggil", "behind")],
                            advance_after_s=8),
                       step("fix", "L10005-L10072", callout="굳은 데는 안 붙어요!", open="after:1", open_s=3.0,
                            needs=0, then="end", advance_after_s=6, advance_beat="sealed", advance_then="end"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP15 로비 결전 (doc 147)
    "EP15": {"battles": [
        battle("EP15_SC004", "실험체 09호", ["kain", "ryu", "sera", "ojeonggil"], result="win", scale=1.4,
               src="L10275-L10469",
               arena={"kind": "indoor", "features": ["1층 로비", "파티션", "유리창"],
                      "destroy": [{"what": "로비 파티션", "src": "L10315", "when": "fight"},
                                  {"what": "로비 유리창", "src": "L10355", "when": "fight"}]},
               script={
                   "guard": "cut",
                   "patterns": [pat("벌어져 감싸기", "HookCombo", "L10333-L10352", tell=0.9, damage=2400),
                                pat("무기 억류", "Slam", "L10291-L10297", tell=0.8, damage=2000)],
                   "steps": [
                       step("grip", "L10275-L10309", moves=[move("kain", "front", 180), move("ryu", "side", 250)],
                            advance_after_s=6),
                       step("hold", "L10313-L10352", moves=[move("kain", "front", 180), move("ojeonggil", "side_r", 300)],
                            advance_after_s=6),
                       step("sera", "L10355-L10371", callout="…잘라도 안 죽는 걸, 왜 계속 자르고 있어.",
                            moves=[move("sera", "side", 320)], advance_after_s=4),
                   ] + [
                       # 봉쇄 3초 창 안에 같은 자리 2연타, 여덟 세트 (L10380-L10469)
                       step(f"seal{n}", "L10380-L10469",
                            callout={1: "신호를 막으면 코어가 있어도 못 찾아.", 2: "삼 초 안에 끊어."}.get(n, ""),
                            moves=[move("sera", "side", 300), move("kain", "front", 190)],
                            open="ready", opener="sera", open_s=3.0, needs=2, decisive_beat="set",
                            then="kill" if n == 8 else "next")
                       for n in range(1, 9)
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP16 섀도우 팽 (doc 145)
    "EP16": {"battles": [
        battle("EP16_SC003", "섀도우 팽", ["kain", "ryu", "ojeonggil"], result="phase", scale=1.5, src="L10697-L10830",
               arena={"kind": "outdoor", "silent": True,
                      "features": ["무음 지대", "수풀 그늘", "뒤집힌 수레·빈 방호복", "폐허 능선"]},
               callouts={"shallow": "…베였다. 저거."},   # L10806
               script={
                   "guard": "deflect",   # 코어 발화를 읽고 피한다 (L10717-L10731)
                   "patterns": [pat("무음 돌진", "Charge", "L10697-L10715", lunge_cm=600, tell=0.15, damage=2600),
                                pat("가장 밝은 쪽", "HookCombo", "L10735-L10771", tell=0.5, damage=2200)],
                   "steps": [
                       step("ambush", "L10697-L10715", moves=[move("ryu", "front", 150)], advance_after_s=5),
                       step("read", "L10717-L10731", callout="칼이 아니라 — 빛을. 휘두르기 전에, 목이 먼저 켜져요.",
                            moves=[move("ryu", "side", 260), move("kain", "behind")], advance_after_s=8),
                       step("dim", "L10735-L10771", moves=[move("kain", "front", 180)], advance_after_s=6),
                       step("decoy", "L10780-L10830", moves=[move("kain", "front", 180), move("ojeonggil", "side_r", 260)],
                            open="ready", opener="ojeonggil", open_s=2.0, needs=1, decisive_beat="shallow", then="end"),
                   ]}),
        battle("EP16_SC010", "섀도우 팽", ["kain", "ryu", "ojeonggil"], result="phase", scale=1.5, src="L10834-L10843",
               arena={"kind": "outdoor", "silent": True, "features": ["무음 지대"]},
               script={
                   "guard": "deflect",
                   "patterns": [pat("광폭 연타", "HookCombo", "L10834-L10843", tell=0.3, damage=2200)],
                   "steps": [
                       step("rage", "L10834-L10843", moves=[move("kain", "front", 170), move("ryu", "side", 260)],
                            advance_after_s=9, advance_beat="light_pillar", advance_then="end"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP17 섀도우 팽 → 셀레스티얼 (doc 145)
    "EP17": {"battles": [
        battle("EP17_SC001", "섀도우 팽", ["kain", "ryu", "sera", "ojeonggil"], result="phase", scale=1.5,
               src="L10959-L11000",
               arena={"kind": "outdoor", "silent": True, "features": ["무음 지대", "골짜기"]},
               callouts={"deep_cut": "네 사람. 네 개의 조건. 하나의 반 박자. 공식은, 성립했다."},   # L10995-L10997
               script={
                   "guard": "deflect",
                   "patterns": [pat("무음 돌진", "Charge", "L10959-L10978", lunge_cm=500, tell=0.2, damage=2600)],
                   "steps": [
                       step("barrier", "L10959-L10978", moves=[move("sera", "side", 320), move("kain", "front", 180)],
                            advance_after_s=4),
                       step("formula", "L10979-L10997",
                            moves=[move("kain", "front", 170), move("ryu", "back", 130), move("sera", "side", 320)],
                            open="ready", opener="ryu", open_s=2.0, needs=1, decisive_beat="deep_cut", then="end"),
                   ]}),
        battle("EP17_SC004", "섀도우 팽", ["kain", "ryu", "sera", "ojeonggil"], result="kill", scale=1.5,
               src="L11025-L11042",
               arena={"kind": "outdoor", "features": ["골짜기", "소리가 돌아온 전장"]},
               script={
                   "guard": "cut",
                   "patterns": [pat("난투", "HookCombo", "L11025-L11039", tell=0.5, damage=2200)],
                   "steps": [
                       step("third", "L11025-L11039", open="after:1.5", open_s=2.5, needs=1, then="kill"),
                   ]}),
        battle("EP17_SC005", "셀레스티얼", ["kain", "ryu", "sera"], result="phase", scale=2.2, src="L11043-L11072",
               arena={"kind": "outdoor", "features": ["골짜기 바닥과 벽", "고도 상한 15m"]},
               script={
                   "guard": "cut",
                   "patterns": [pat("공간 접기 급강하", "Charge", "L11057-L11065", lunge_cm=600, tell=0.4, damage=2800)],
                   "steps": [
                       step("low", "L11043-L11065", callout="오늘이 아니면 못 잡아. 원래는 너희 넷으론 평생 못 잡았어. — 하늘이잖아.",
                            moves=[move("sera", "side", 280), move("kain", "behind")],
                            open="pattern:공간 접기 급강하", opener="sera", open_s=2.5, needs=1, decisive_beat="wing_hook",
                            then="end"),
                   ]}),
        battle("EP17_SC007", "셀레스티얼", ["kain", "ryu", "sera"], result="phase", scale=2.6, src="L11102-L11115",
               arena={"kind": "outdoor", "features": ["골짜기 벽(등을 지고 몰림)"]},
               script={
                   "guard": "cut",
                   "patterns": [pat("세 방향 강하", "Spin", "L11102-L11113", tell=0.4, damage=2600, range=360)],
                   "steps": [
                       step("triple", "L11102-L11115",
                            moves=[move("sera", "side", 260), move("kain", "front", 190), move("ryu", "side_r", 260)],
                            advance_after_s=8, advance_then="end"),
                   ]}),
        battle("EP17_SC009", "셀레스티얼", ["kain", "ryu", "sera"], result="kill", scale=2.6, src="L11146-L11193",
               arena={"kind": "outdoor", "features": ["골짜기"],
                      "destroy": [{"what": "카인의 대검(완전 파단)", "src": "L11172-L11180", "when": "after"}]},
               callouts={"decisive": "하늘의 왕이, 땅에서 죽었다."},   # L11190
               script={
                   "guard": "cut",
                   "patterns": [pat("유인 강하", "Slam", "L11166-L11180", tell=0.9, damage=3000, range=320)],
                   "steps": [
                       step("decoy", "L11146-L11190",
                            moves=[move("kain", "front", 170), move("sera", "side_r", 320), move("ryu", "side", 300)],
                            open="ready", opener="kain", open_s=2.5, open_beat="anvil", needs=1, then="kill"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP18 강남 벙커 습격 (doc 148) - BOSS 태그 없음
    "EP18": {"battles": [
        battle("EP18_SC009", "군 표식 집행관", ["duho", "duna"], result="defend", scale=1.1, src="L11438-L11483",
               arena={"kind": "indoor", "features": ["저천장", "배관", "셔터", "아이들 구역"]},
               callouts={"freeze": "집행관의 일격이 — 멈췄다."},   # L11476
               script={
                   "guard": "cut",
                   "patterns": [pat("내려치기", "Slam", "L11460-L11482", tell=0.9, damage=3000, range=280)],
                   "steps": [
                       step("vent", "L11438-L11460", moves=[move("duho", "side_r", 300), move("duna", "side", 220)],
                            advance_after_s=4),
                       step("executioner", "L11460-L11483", moves=[move("duna", "side", 220)],
                            open="pattern:내려치기", opener="duna", open_s=1.5, open_beat="freeze", needs=1, then="kill"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP21 아스널 오버로드 1차 (doc 148)
    "EP21": {"battles": [
        battle("EP21_SC007", "아스널 오버로드", ["kain", "ryu", "sera", "guide"], result="retreat", scale=3.0,
               src="L12663-L12759",
               arena={"kind": "underground", "features": ["주 격납고", "장갑차·자주포 엄폐물", "출구 1개", "유도등"],
                      "destroy": [{"what": "엄폐물(장갑차) 소멸", "src": "L12717", "when": "fight"},
                                  {"what": "콘크리트 그릇형 파임", "src": "L12671", "when": "fight"}]},
               callouts={"barrage": "…흩어져요!"},   # L12751
               script={
                   "guard": "cut", "band": [200, 300], "walk_in_cm": 100000,   # 포탑 - 움직이지 않는다
                   "patterns": [pat("사출", "GroundWave", "L12669-L12671", tell=0.5, damage=2200, range=900),
                                pat("전탄 제압", "Spin", "L12743-L12759", tell=1.4, damage=3000, range=900)],
                   "steps": [
                       step("burst", "L12652-L12671", callout="…아스널 오버로드.",
                            moves=[move("kain", "marker:B1_Cover"), move("sera", "marker:B1_Cover"),
                                   move("guide", "marker:B1_Exit")], advance_after_s=6),
                       step("flank", "L12685-L12699", callout="뒤가 없다고요!", moves=[move("ryu", "back", 420)],
                            advance_after_s=6),
                       step("barrage", "L12743-L12759", moves=[move("ryu", "marker:B1_Cover")], advance_after_s=5,
                            advance_beat="barrage", advance_then="end"),
                   ]}),
        battle("EP21_SC012", "아스널 오버로드", ["kain", "ryu", "sera"], result="retreat", scale=3.0, src="L12777-L12796",
               arena={"kind": "underground", "features": ["부포탑", "급탄로", "출구"],
                      "destroy": [{"what": "부포탑 내부 폭발", "src": "L12777", "when": "after"}]},
               script={
                   "guard": "cut", "band": [200, 300], "walk_in_cm": 100000,
                   "patterns": [pat("사출", "GroundWave", "L12669-L12671", tell=0.5, damage=2200, range=900)],
                   "steps": [
                       step("feed", "L12777", moves=[move("kain", "marker:B2_Exit"), move("sera", "marker:B2_Exit")],
                            open="after:2", open_s=3.0, needs=1, decisive_beat="feed_line", then="end"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP22 아스널 오버로드 결전 (doc 148)
    "EP22": {"battles": [
        battle("EP22_SC004", "아스널 오버로드", ["kain", "ryu", "sera"], result="win", scale=3.0, src="L12939-L13191",
               arena={"kind": "underground", "features": ["주 격납고", "주포탑 선회 관절 6", "코어(7m)"],
                      "destroy": [{"what": "천장 콘크리트 낙하", "src": "L13173", "when": "after"}]},
               callouts={"decisive": "서걱."},   # L13189
               script={
                   "guard": "cut", "band": [200, 300], "walk_in_cm": 100000,
                   "patterns": [pat("일제 꺾임", "Slam", "L13035-L13043", tell=1.0, damage=2600, range=320),
                                pat("사출", "GroundWave", "L12939-L13078", tell=0.5, damage=2200, range=900, min=400)],
                   "steps": [
                       step(f"joint{n}", "L12939-L13167",
                            callout={1: "관절.", 4: "삼 초면 돼요!"}.get(n, ""),
                            moves=[move("kain", "front", 230)] + ([move("sera", "side", 320)] if n >= 4 else []),
                            open="pattern:일제 꺾임", opener="kain", open_s=2.0, needs=1, decisive_beat=f"joint_{n}",
                            then="next")
                       for n in range(1, 7)
                   ] + [
                       step("core", "L13169-L13191", moves=[move("kain", "front", 230)],
                            open="ready", opener="kain", open_s=2.5, needs=1, then="kill"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP23 박 준장 (doc 148)
    "EP23": {"battles": [
        battle("EP23_SC001", "박 준장", ["kain", "ryu", "sera"], result="win", scale=1.0, src="L13322-L13373",
               arena={"kind": "indoor", "features": ["소독약 냄새 복도", "관측창"]},
               callouts={"decisive": "두 번 치지 않는다 — 스승의 원칙이었다. 아인은 오늘 두 번 쳤다."},   # L13364
               script={
                   "guard": "deflect",   # 출력이 실리는 순간을 읽고 받아친다 (L13326-L13334)
                   "patterns": [pat("카운터", "HookCombo", "L13326-L13347", tell=0.4, damage=2600)],
                   "steps": [
                       step("read", "L13322-L13347", callout="각인자를 잡으라고 지은 몸이야.",
                            moves=[move("kain", "front", 170), move("ryu", "side", 240)], advance_after_s=8),
                       step("dark", "L13344-L13362", callout="골짜기 반대로 해요. — 저를 꺼 주세요.",
                            moves=[move("kain", "front", 170), move("sera", "behind")],
                            open="ready", opener="kain", open_s=2.0, needs=1, decisive_beat="shallow", then="next"),
                       step("relit", "L13362-L13364", open="after:0.5", open_s=2.0, needs=1, then="kill"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP26 정 장관 (doc 149)
    "EP26": {"battles": [
        battle("EP26_SC002", "정 장관", ["kain", "ryu", "sera"], result="kill", scale=1.0, src="L14271-L14419",
               arena={"kind": "outdoor", "features": ["발사장 활주로", "의장대 도열", "점거 차량"]},
               callouts={"decisive": "…미안—", "fake": "가짜 명령을 내리지!"},   # L14419, L14316
               script={
                   "guard": "cut",
                   "patterns": [pat("군도 원", "Spin", "L14340-L14344", tell=0.9, damage=2600, range=280)],
                   "steps": [
                       step("command", "L14271-L14293", callout="현 시각부로. 전 구역. 경계 태세 격상.",
                            moves=[move("sera", "side", 360), move("kain", "behind")], advance_after_s=6),
                       step("fake", "L14306-L14322", moves=[move("sera", "side", 360)], advance_after_s=5,
                            advance_beat="fake"),
                       # 세 합을 외우고 네 번째 원의 끝에서 받아넘긴다 (L14376, L14393-L14406)
                       step("memorize", "L14376-L14408", callout="세 합만 받아 주세요. 놈의 원을 외울게요.",
                            moves=[move("kain", "front", 170)], open="pattern:군도 원", open_on=4, opener="kain",
                            open_s=2.0, needs=1, then="kill"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP27 나노-노바 코어 (doc 149)
    "EP27": {"battles": [
        battle("EP27_SC008", "나노-노바 코어", ["kain", "ryu", "sera"], result="kill", scale=3.0, src="L14724-L14875",
               arena={"kind": "underground", "features": ["결정 산(수백 코어)", "캡슐 잔해", "견인 레일"],
                      "destroy": [{"what": "결정 산의 팔 붕괴", "src": "L14869", "when": "after"}]},
               callouts={"guarded": SHIELD, "ryu_elbow": "지금……", "kain_port": "지금……", "now": "지금—!",
                         "decisive": "서걱. 한 번이었다. 두 번은 필요 없었다."},   # L14801-L14811, L14857
               script={
                   "guard": "deflect", "band": [200, 300], "walk_in_cm": 100000,
                   "patterns": [pat("셔터 팔", "Charge", "L14730", lunge_cm=200, tell=0.8, damage=2200),
                                pat("거대한 원", "Spin", "L14760-L14785", tell=1.0, damage=3000, range=420),
                                pat("코어 사출", "GroundWave", "L14785", tell=0.6, damage=2400, range=800)],
                   "steps": [
                       step("arms", "L14724-L14794", callout="오지…… 마라…… 늦기 전에……",
                            moves=[move("kain", "front", 240), move("sera", "side", 380), move("ryu", "side_r", 380)],
                            advance_after_s=8),
                       step("circle", "L14795-L14800", advance_after_s=5),
                       step("stop1", "L14801-L14807", moves=[move("ryu", "side_r", 240)], advance_after_s=3,
                            advance_beat="ryu_elbow"),
                       step("stop2", "L14809-L14811", moves=[move("kain", "front", 240)], advance_after_s=3,
                            advance_beat="kain_port"),
                       step("converge", "L14819-L14833",
                            moves=[move("kain", "front", 230), move("sera", "side", 320), move("ryu", "side_r", 260)],
                            advance_after_s=5),
                       step("bloom", "L14847-L14861", open="after:1", open_s=2.0, open_beat="now", needs=1, then="kill"),
                   ]}),
    ]},

    # ------------------------------------------------------------------ EP28 발사대 탑 (doc 149)
    "EP28": {"battles": [
        battle("EP28_SC002", "발사대 탑", ["kain", "ryu", "sera"], result="destroyed", scale=4.0, src="L15008-L15043",
               arena={"kind": "outdoor", "sea": True, "features": ["발사대 탑", "주각 4개", "트러스", "케이블 다발", "바다"],
                      "destroy": [{"what": "탑 전체 바다로 붕괴", "src": "L15038-L15042", "when": "after"}]},
               callouts={"anvil": "모루.", "decisive": "한 번. 두 번은 필요 없었다."},   # L15020, L15032
               script={
                   "guard": "cut", "band": [200, 300], "walk_in_cm": 100000,
                   "patterns": [],   # 능동 공격 없음 (doc 149 EP28)
                   "steps": [
                       step("sockets", "L15010-L15018", callout="주각 둘을 같은 쪽에서 끊으면 자중으로 넘어가.",
                            moves=[move("ryu", "back", 300)], advance_after_s=5),
                       step("mark", "L15018", moves=[move("sera", "side", 320)], advance_after_s=4),
                       step("anvil", "L15020-L15022", moves=[move("kain", "front", 260)],
                            open="ready", opener="kain", open_s=3.0, open_beat="anvil", needs=1, decisive_beat="leg1",
                            then="next"),
                       step("leg2", "L15024-L15032", open="after:1", open_s=3.0, needs=1, then="kill"),
                   ]}),
    ]},
}

# 원문 보스 몸 (docs/design/151): 디자인 시트 id, 키(m), 뼈대 종류. 키는 원문 수치가 있으면 원문, 없으면 설계값(TBD_CANON).
# art/3d/part1/<id>.glb (사람 뼈대) 또는 <id>_static.glb (정적) 가 있으면 그 보스의 모든 전투가 그 몸을 입는다.
BODIES = {
    "클레이브": dict(id="clave", height=2.5, kind="rig", src="L1774"),
    "클레이브 두 기": dict(id="clave", height=2.5, kind="rig", src="L1774"),
    "에이지스-07": dict(id="aegis_07", height=4.0, kind="static", src="L7097"),
    "레비아탄": dict(id="leviathan", height=2.2, kind="static", src="TBD_CANON"),
    "셀레스티얼": dict(id="celestial", height=4.0, kind="static", src="L11001-L11024"),
    "실험체 09호": dict(id="subject_09", height=2.4, kind="rig", src="TBD_CANON"),
    "섀도우 팽": dict(id="shadow_fang", height=2.6, kind="rig", src="TBD_CANON"),
    "아스널 오버로드": dict(id="arsenal_overlord", height=8.0, kind="static", src="코어 7 m L13171-L13189"),
    "발사대 탑": dict(id="amplifier_tower", height=16.0, kind="static", src="TBD_CANON"),
    "정 장관": dict(id="minister_jeong_candidate", height=1.8, kind="rig", src="TBD_CANON"),
}
BODY_DIR = os.path.join(ROOT, "art", "3d", "part1")


def wear(b):
    body = BODIES.get(b.get("boss_ko"))
    if not body:
        return
    bid = body["id"]
    if os.path.exists(os.path.join(BODY_DIR, f"{bid}.glb")):
        b["body"] = f"boss_{bid}"
    elif os.path.exists(os.path.join(BODY_DIR, f"{bid}_static.glb")):
        n = f"{bid}_static"
        b["body_static"] = f"/Game/Bosses/Part1/{n}/StaticMeshes/{n}.{n}"


# 전투 없는 화 (원문에 보스전이 없다): 카드로만 진행한다.
for _ep in ("EP12", "EP13", "EP19", "EP20", "EP24", "EP25"):
    EPISODES[_ep] = {"battles": []}


def finish_battle(ep, i, b):
    b.setdefault("prefix", f"B{i + 1}_")
    p = b["prefix"]
    b.setdefault("layers", {"pre": [f"DL_{p}Pre"], "fight": [f"DL_{p}Fight"], "after": [f"DL_{p}After"]})
    script = b.get("script")
    if script:
        for s in script["steps"]:
            if not s.get("callout"):
                s.pop("callout", None)
            else:
                b["callouts"].setdefault(f"step_{s['id']}", s["callout"])
            # marker moves name the battle's own markers (B1_Exit ...)
            for m in s.get("moves", []):
                if m["to"].startswith("marker:B1_") and p != "B1_":
                    m["to"] = "marker:" + p + m["to"][len("marker:B1_"):]


def main():
    eps = sorted(EPISODES)
    for ep in eps:
        e = EPISODES[ep]
        e.setdefault("world", world(ep))
        n = int(ep[2:])
        e.setdefault("next_world", world(f"EP{n + 1:02d}") if n < 28 else "")
        e.setdefault("card_camera", "CAM_Entry_Wide")
        scenes = json.load(open(os.path.join(SCENES, f"{ep}.json"), encoding="utf-8"))["Scenes"]
        by_id = {s["SceneId"]: s for s in scenes}
        order = [s["SceneId"] for s in scenes]
        last = -1
        for i, b in enumerate(e.get("battles", [])):
            if b["first_scene"] not in by_id:
                sys.exit(f"{ep}: battle scene {b['first_scene']} not in _scenes/{ep}.json")
            at = order.index(b["first_scene"])
            if at <= last:
                sys.exit(f"{ep}: battles must be in scene order ({b['first_scene']})")
            last = at
            wear(b)
            if "script" in b:
                finish_battle(ep, i, b)
                for s in b["script"]["steps"]:
                    if s.get("open", "").startswith("pattern:"):
                        want = s["open"][8:]
                        if not any(p["ko"] == want or p["clip"] == want for p in b["script"]["patterns"]):
                            sys.exit(f"{ep} {b['first_scene']}: step {s['id']} opens on unknown move {want}")
                    if s.get("opener") and s["opener"] not in b["party"]:
                        sys.exit(f"{ep} {b['first_scene']}: opener {s['opener']} not in the party")
                    for m in s.get("moves", []):
                        if m["who"] not in b["party"]:
                            sys.exit(f"{ep} {b['first_scene']}: {m['who']} moves but is not in the party")
                    if s.get("needs", 1 if s.get("open") else 0) and s.get("open_s", 2.0) < 0.8 * s.get("needs", 1) + 0.6:
                        sys.exit(f"{ep} {b['first_scene']}: step {s['id']} opening too short for {s.get('needs')} hits")
        # the arena is where the fights happen: their scenes, entries and results
        if "arena_locations" not in e:
            locs = []
            for s in scenes:
                modes = set(s.get("GameMode", []))
                if modes & {"BOSS_ENTRY", "BOSS_BATTLE", "BOSS_RESULT"} or s["SceneId"] in {
                        b["first_scene"] for b in e.get("battles", [])}:
                    if s["Location"] not in locs:
                        locs.append(s["Location"])
            e["arena_locations"] = locs if e.get("battles") else []
    out = {"schema": "hwanghon-story-episodes-v1", "bodies": BODIES, "episodes": {k: EPISODES[k] for k in eps}}
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{len(EPISODES)} episodes, {sum(len(e.get('battles', [])) for e in EPISODES.values())} battles -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
