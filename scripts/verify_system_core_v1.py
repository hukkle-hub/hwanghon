from pathlib import Path
import ast

root=Path(__file__).resolve().parents[1]
pub=root/"ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System"
pri=root/"ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System"

required=[
"HWSystemTypes","HWSystemRulesLibrary","HWCharacterKitComponent",
"HWCoopCombatSubsystem","HWCoopLifeComponent","HWCombatTargetInterface",
"HWBossSystemComponent","HWBossPartTarget","HWDungeonDirector",
"HWDungeonEnemy","HWDungeonObjectiveNode","HWPlayableCharacterVariants",
]
for n in required:
    assert (pub/(n+".h")).exists(),n
    if n not in {"HWCombatTargetInterface","HWSystemTypes"}:
        assert (pri/(n+".cpp")).exists(),n

for p in list(pub.glob("*.h"))+list(pri.glob("*.cpp")):
    s=p.read_text(encoding="utf-8")
    assert s.count("{")==s.count("}"),p
    assert "SwitchToIndex" not in s,p
    assert "LinkGauge" not in s,p
    assert "EntryMultiplier" not in s,p
    assert "ExitMultiplier" not in s,p

for p in [
    root/"tools/ue/apply-system-core-v1.py",
    root/"tools/ue/apply-system-core-v1-part2.py"
]:
    ast.parse(p.read_text(encoding="utf-8"))

print("SYSTEM CORE V1 STATIC VERIFY: PASS")
