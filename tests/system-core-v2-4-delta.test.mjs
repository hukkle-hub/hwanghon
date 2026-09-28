import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const r=p=>fs.readFileSync(p,'utf8');
const patch=r('tools/ue/apply-system-core-v2-4.py');

test('delta targets current v2.3 instead of reinstalling the old core',()=>{
  assert.ok(!patch.includes('apply-system-core-v1.py'));
  assert.ok(!patch.includes('apply-system-core-v1-part2.py'));
  assert.match(patch,/SYSTEM CORE v2\.4 DELTA applied/);
});

test('sheet stats are carried into UE runtime profiles',()=>{
  for(const tuple of [
    ['ain','24450.f','2980.f','1780.f','112.5f','105.f'],
    ['kain','38200.f','3410.f','2960.f','96.f','98.f'],
    ['ryu','21800.f','2640.f','1520.f','124.f','112.f'],
    ['sera','19600.f','1480.f','1610.f','100.f','104.f'],
  ]){
    for(const value of tuple.slice(1)) assert.ok(patch.includes(value),`${tuple[0]} ${value}`);
  }
  assert.match(patch,/ConfigureCharacterStats/);
  assert.match(patch,/MaxWalkSpeed/);
  assert.match(patch,/AttackSpeedMultiplier/);
});

test('local incoming damage mirrors authoritative defense formula',()=>{
  assert.match(patch,/Defense \/ FMath::Max\(1\.f, Defense \+ 5000\.f\)/);
  assert.ok(patch.includes('FMath::Min(\n        0.25f') || patch.includes('FMath::Min(\\n        0.25f'));
});

test('local outgoing damage has crit and forced-next-crit semantics',()=>{
  assert.match(patch,/ResolveOutgoingDamage/);
  assert.match(patch,/FMath::FRand\(\)/);
  assert.match(patch,/ArmGuaranteedCritical/);
  assert.match(patch,/bGuaranteedCritical/);
});

test('skill parity includes delayed projectile and multi-hit contacts',()=>{
  for(const marker of [
    'QueueHit(0.55f, AbilityMultiplier * 0.55f',
    'QueueHit(0.80f, AbilityMultiplier * 0.45f',
    'QueueHit(0.37f, AbilityMultiplier * 0.30f',
    'QueueHit(0.47f, AbilityMultiplier * 0.30f',
    'QueueHit(0.65f, AbilityMultiplier * 0.40f',
    'QueueHit(0.57f, AbilityMultiplier',
    'QueueHit(0.46f, AbilityMultiplier * 0.50f',
    'QueueHit(0.66f, AbilityMultiplier * 0.50f',
  ]) assert.ok(patch.includes(marker),marker);
  assert.match(patch,/SourceAtSeconds[\s\S]*GetAttackSpeedMultiplier/);
});

test('Kain and Sera role identities exist on both local and authoritative paths',()=>{
  assert.match(patch,/CharacterId == TEXT\("kain"\) \? 1\.25f : 1\.f/);
  assert.match(patch,/threatMult:p\.character==='kain'\?1\.25:1/);
  assert.match(patch,/SupportRadiusCm = 520\.f/);
  assert.match(patch,/p\.character==='sera'/);
  assert.match(patch,/this\.event\('heal',\{player:q\.id,by:id,amount:h\}\)/);
});

test('authoritative store carries DEF crit crit damage and movement',()=>{
  assert.match(patch,/defense=base\.def\|\|0/);
  assert.match(patch,/critChance:\(base\.crit\|\|0\)\/100/);
  assert.match(patch,/critDamage:\(base\.critDmg\|\|100\)\/100/);
  assert.match(patch,/moveMult:\(base\.mspd\|\|100\)\/100/);
});

test('online boss snapshot carries max HP posture pattern and state progress',()=>{
  assert.match(patch,/TelegraphProgress/);
  assert.match(patch,/RecoveryRemaining/);
  assert.match(patch,/AuthoritativeMaxHealth/);
  assert.match(patch,/AuthoritativePosture/);
  assert.match(patch,/PatternId/);
  assert.match(patch,/StateProgress/);
  assert.match(patch,/PreviousPattern != PatternId/);
  assert.match(patch,/Boss->GetMaxHealth\(\)/);
});

test('one player still equals one character; switching remains absent',()=>{
  assert.ok(!patch.includes('SwitchToIndex'));
  assert.ok(!patch.includes('LinkGauge'));
  assert.ok(!patch.includes('EntryMultiplier'));
  assert.ok(!patch.includes('ExitMultiplier'));
});
