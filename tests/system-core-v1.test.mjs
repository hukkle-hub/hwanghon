import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const r=p=>fs.readFileSync(p,'utf8');

test('one player controls one character: no switch-party combat system exists',()=>{
  const types=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWSystemTypes.h');
  const kit=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWCharacterKitComponent.h')
           +r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCharacterKitComponent.cpp');
  for(const forbidden of ['SwitchToIndex','EntryMultiplier','ExitMultiplier','LinkGauge','LinkGainOnHit'])
    assert.ok(!types.includes(forbidden)&&!kit.includes(forbidden),forbidden);
  assert.match(types,/Skill1/);
  assert.match(types,/Skill2/);
  assert.match(types,/Ultimate/);
});

test('co-op runtime is capped at four independent combatants',()=>{
  const s=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCoopCombatSubsystem.cpp');
  assert.match(s,/Combatants\.Num\(\) >= 4/);
  assert.match(s,/SelectHighestThreatTarget/);
  assert.match(s,/BossHealthScale/);
  assert.match(s,/BossPostureScale/);
  assert.match(s,/EnemyCountScale/);
});

test('character kit has unique gauge skills ultimate but no character switching',()=>{
  const h=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWCharacterKitComponent.h');
  const c=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCharacterKitComponent.cpp');
  for(const k of ['UniqueGauge','UltimateGauge','RequestSkill1','RequestSkill2','RequestUltimate'])
    assert.match(h,new RegExp(k));
  assert.match(c,/sera/);
  assert.match(c,/kain/);
  assert.ok(!c.includes('SwitchTo'));
});

test('co-op life supports down bleedout channel revive and full defeat',()=>{
  const s=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCoopLifeComponent.cpp');
  for(const k of ['BleedoutRemaining','StartRevive','ReviveElapsed','Combat->Revive','ReportPartyWipe'])
    assert.ok(s.includes(k),k);
});

test('boss system includes party scaling phase posture break parts aggro and enrage',()=>{
  const h=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWBossSystemComponent.h');
  const c=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWBossSystemComponent.cpp');
  for(const k of ['Phase','Posture','BreakCount','Parts','bEnraged','OnPartBroken','OnBreakTriggered'])
    assert.match(h,new RegExp(k));
  assert.match(c,/BossHealthScale/);
  assert.match(c,/BossPostureScale/);
  assert.match(c,/DamagePart/);
  assert.match(c,/EnterSystemBreak/);
  assert.match(c,/GetDifficultyHealthScale/);
});

test('boss parts are direct lock-on combat targets',()=>{
  const c=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWBossPartTarget.cpp');
  assert.match(c,/LockOnTarget/);
  assert.match(c,/DamagePart/);
  assert.match(c,/Boss->ReceivePlayerHit/);
});

test('dungeon director includes rooms waves objective checkpoint retry difficulty and boss',()=>{
  const h=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWDungeonDirector.h');
  const c=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWDungeonDirector.cpp');
  for(const k of ['ReportEnemyDefeated','ReportObjectiveProgress','ReportBossDefeated','RetryFromCheckpoint','CheckpointRoomIndex','ReviveTokens'])
    assert.match(h,new RegExp(k));
  for(const k of ['SpawnFallbackRoom','AHWDungeonEnemy','AHWDungeonObjectiveNode','AHWBossCharacter','EnemyCountScale'])
    assert.match(c,new RegExp(k));
});

test('generic combat target lets mobs and boss share one damage path',()=>{
  const i=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWCombatTargetInterface.h');
  const e=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWDungeonEnemy.h');
  const a=r('tools/ue/apply-system-core-v1.py');
  assert.match(i,/ReceiveSystemHit/);
  assert.match(e,/IHWCombatTargetInterface/);
  assert.match(a,/Execute_ReceiveSystemHit/);
});

test('existing multiplayer server already models max-4 independent characters',()=>{
  if(!fs.existsSync('server/index.cjs')||!fs.existsSync('server/raid.cjs')) return;
  const server=r('server/index.cjs');
  const raid=r('server/raid.cjs');
  assert.match(server,/room\.members\.size>=4/);
  assert.match(server,/character:character\|\|'ain'/);
  assert.match(raid,/One world, one boss, independent players/);
  assert.match(raid,/members\.length-1/);
  assert.match(raid,/reviveHeld/);
  assert.match(raid,/threat/);
  assert.match(raid,/parts:/);
});

test('integration patch adds skills revive generic targets boss system and authored dungeon lifecycle',()=>{
  const p1=r('tools/ue/apply-system-core-v1.py');
  const p2=r('tools/ue/apply-system-core-v1-part2.py');
  for(const k of ['Heal','Revive','CharacterKit','CoopLife','Skill1','Skill2','Ultimate'])
    assert.match(p1,new RegExp(k));
  for(const k of ['BossSystem','HandleDungeonCompleted','ReportPartyWipe','GetAliveCount'])
    assert.match(p2,new RegExp(k));
});
