#!/usr/bin/env python3
from pathlib import Path
import ast
import sys

ROOT=Path.cwd()

def read(path):
    p=ROOT/path
    if not p.exists():
        raise SystemExit(f'MISSING required file: {path}')
    return p.read_text(encoding='utf-8')

def recognized(path, old_markers, new_markers):
    s=read(path)
    old=all(x in s for x in old_markers)
    new=all(x in s for x in new_markers)
    if not (old or new):
        raise SystemExit(f'UNRECOGNIZED context: {path}')
    print(('READY' if old else 'ALREADY'), path)

# Require the real v2.3 base that Claude already compiled/QA'd.
base_markers={
 'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWSystemTypes.h':[
   'Skill4','Ultimate','FHWCharacterSystemProfile'],
 'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCharacterKitComponent.cpp':[
   'RequestSkill4','UHWCoopCombatSubsystem','UHWRaidNetworkSubsystem'],
 'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidWorldBridge.cpp':[
   'PlayServerClip','ApplyAuthoritativeVitals','ReconcileBoss'],
 'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Tests/HWSystemQASubsystem.cpp':[
   'HWQA'],
 'tools/ue/system-core-qa.cjs':['1P','2P','4P'],
}
for path,markers in base_markers.items():
    s=read(path)
    for marker in markers:
        if marker not in s:
            raise SystemExit(f'v2.3 base marker missing: {path}: {marker}')

recognized(
 'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Combat/HWCombatComponent.h',
 ['RequestSystemDodge(float StaminaCost)','DamageReductionFraction'],
 ['ConfigureCharacterStats(','ResolveOutgoingDamage'])
recognized(
 'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Combat/HWCombatComponent.cpp',
 ['ActionElapsed += DeltaTime;','OnContact.Broadcast(CurrentAction, Spec.Tier, Spec.Damage);'],
 ['ActionClockScale','ResolveOutgoingDamage(Spec.Damage)'])
recognized(
 'server/store.cjs',
 ['defense=0','return {hp,atk:base.atk+(level-1)*15,aspd:base.aspd,defense};'],
 ['defense=base.def||0','critChance:(base.crit||0)/100','moveMult:(base.mspd||100)/100'])
recognized(
 'server/raid.cjs',
 ['p.damage+=amount;p.threat+=amount;','else if(k.buff){p.buffT=k.buff.dur'],
 ['p.threat+=amount*(p.stats.threatMult||1);','p.character===\'sera\''])
recognized(
 'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWRaidNetworkSubsystem.h',
 ['float Windup = 0.f;','bPatternCounterable'],
 ['TelegraphProgress','RecoveryRemaining'])
recognized(
 'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Boss/HWBossCharacter.h',
 ['ApplyAuthoritativeSnapshot(float NewHealth, float NewMaxHealth, float NewPosture, FName StateName, bool bRaidClear);'],
 ['AuthoritativeMaxHealth','AuthoritativePosture'])

# Package scripts must parse before anything is touched.
for rel in [
 'tools/ue/apply-system-core-v2-4.py',
 'tools/ue/preflight-system-core-v2-4.py',
]:
    ast.parse(read(rel))

print('SYSTEM CORE v2.4 PREFLIGHT: PASS')
