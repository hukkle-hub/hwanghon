import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const r=p=>fs.readFileSync(p,'utf8');

test('four character profiles keep the design-sheet HP ATK DEF ASPD MSPD identities',()=>{
  const c=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWSystemRulesLibrary.cpp');

  const expected={
    ain:['24450.f','2980.f','1780.f','112.5f','105.f'],
    kain:['38200.f','3410.f','2960.f','96.f','98.f'],
    ryu:['21800.f','2640.f','1520.f','124.f','112.f'],
    sera:['19600.f','1480.f','1610.f','100.f','104.f'],
  };
  for(const [id,values] of Object.entries(expected)){
    const start=c.indexOf(`TEXT("${id}")`);
    assert.ok(start>=0,id);
    const block=c.slice(start,start+1300);
    for(const value of values) assert.ok(block.includes(value),`${id}:${value}`);
  }
});

test('local pawn applies character stats to combat and movement, not cosmetic labels only',()=>{
  const c=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCharacterKitComponent.cpp');
  assert.match(c,/ConfigureCharacterStats/);
  assert.match(c,/Profile\.BaseHealth/);
  assert.match(c,/Profile\.BaseAttack/);
  assert.match(c,/Profile\.BaseDefense/);
  assert.match(c,/Profile\.AttackSpeedPercent/);
  assert.match(c,/Profile\.MoveSpeedPercent/);
  assert.match(c,/MaxWalkSpeed/);
  assert.match(c,/GetBaseAttack/);
});

test('current-main patch isolates runtime tuning and makes attack clock scale with ASPD',()=>{
  const a=r('tools/ue/apply-system-core-v2-current.py');
  assert.match(a,/DuplicateObject<UHWCombatTuningAsset>\(Tuning, this\)/);
  assert.match(a,/AttackSpeedMultiplier/);
  assert.match(a,/ActionElapsed \+= DeltaTime \* ActionClockScale/);
  assert.match(a,/ConfigureCharacterStats/);
  assert.match(a,/Attack1\.Damage = BaseAttack \* 0\.386f/);
  assert.match(a,/Smash\.Damage = BaseAttack \* 0\.872f/);
});

test('local defense formula mirrors authoritative Raid cap and denominator',()=>{
  const a=r('tools/ue/apply-system-core-v2-current.py');
  assert.match(a,/Defense \/ FMath::Max\(1\.f, Defense \+ 5000\.f\)/);
  assert.match(a,/FMath::Min\(0\.25f/);
});

test('authoritative server stats preserve base defense crit crit damage and movement identity',()=>{
  const a=r('tools/ue/apply-system-core-v2-current.py');
  assert.match(a,/defense=base\.def\|\|0/);
  assert.match(a,/critChance:\(base\.crit\|\|0\)\/100/);
  assert.match(a,/critDamage:\(base\.critDmg\|\|100\)\/100/);
  assert.match(a,/moveMult:\(base\.mspd\|\|100\)\/100/);

  if(fs.existsSync('server/store.cjs')){
    const store=r('server/store.cjs');
    assert.match(store,/defense=base\.def\|\|0/);
    assert.match(store,/critChance:\(base\.crit\|\|0\)\/100/);
    assert.match(store,/critDamage:\(base\.critDmg\|\|100\)\/100/);
    assert.match(store,/moveMult:\(base\.mspd\|\|100\)\/100/);
  }
});

test('combat switching remains forbidden after stat differentiation',()=>{
  for(const file of [
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWSystemTypes.h',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCharacterKitComponent.cpp',
    'tools/ue/apply-system-core-v2-current.py',
  ]){
    const s=r(file);
    assert.ok(!s.includes('SwitchToIndex'),file);
    assert.ok(!s.includes('LinkGauge'),file);
  }
});
