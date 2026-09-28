from pathlib import Path
import ast
import re
root=Path(__file__).resolve().parents[1]
required=[
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWRaidNetworkSubsystem.h',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidNetworkSubsystem.cpp',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWNetworkCombatBridgeComponent.h',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWNetworkCombatBridgeComponent.cpp',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWRaidRemoteAvatar.h',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidRemoteAvatar.cpp',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWRaidWorldBridge.h',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidWorldBridge.cpp',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWRaidHazardProxy.h',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidHazardProxy.cpp',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWRaidExpeditionProxy.h',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidExpeditionProxy.cpp',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWRaidTravelSubsystem.h',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidTravelSubsystem.cpp',
'ue/HwanghonCombatUE/Scripts/build_online_raid_graybox.py',
'tools/ue/apply-system-core-v2-current.py',
'tools/ue/apply-system-core-v2-1-selection.py',
'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Tests/HWSystemCharacterSelectionTest.cpp',
]
for rel in required: assert (root/rel).exists(),rel
for p in list((root/'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public').rglob('*.h'))+list((root/'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private').rglob('*.cpp')):
    s=p.read_text(encoding='utf-8')
    # Count braces in code only: JSON fixtures in string literals (e.g. HWGameContentTest.cpp) are not structure.
    code=re.sub(r'R"\((.*?)\)"','""',s,flags=re.S)
    code=re.sub(r'//[^\n]*|/\*.*?\*/','',code,flags=re.S)
    code=re.sub(r'"(?:\\.|[^"\\\n])*"|''(?:\\.|[^''\\\n])*''','""',code)
    assert code.count('{')==code.count('}'),p
    assert 'SwitchToIndex' not in s,p
    assert 'LinkGauge' not in s,p
ast.parse((root/'tools/ue/apply-system-core-v2-current.py').read_text(encoding='utf-8'))
ast.parse((root/'tools/ue/apply-system-core-v2-1-selection.py').read_text(encoding='utf-8'))
ast.parse((root/'ue/HwanghonCombatUE/Scripts/build_online_raid_graybox.py').read_text(encoding='utf-8'))
print('SYSTEM CORE V2 STATIC VERIFY: PASS')
