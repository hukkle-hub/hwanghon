import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const r=p=>fs.readFileSync(p,'utf8');

test('selected character is persisted as one save field and schema migrates to v3',()=>{
  const a=r('tools/ue/apply-system-core-v2-1-selection.py');
  assert.match(a,/CurrentVersion = 3/);
  assert.match(a,/SelectedCharacter/);
  assert.match(a,/Version == 2/);
  for(const id of ['ain','kain','ryu','sera']) assert.match(a,new RegExp(id));
  assert.ok(!a.includes('TArray<FName> SelectedCharacters'));
});

test('frontend character tabs save system selection instead of cosmetic-only assignment',()=>{
  const a=r('tools/ue/apply-system-core-v2-1-selection.py');
  assert.match(a,/F->SelectCharacter\(Id\)/);
  assert.match(a,/Profile->SelectCharacter\(CharacterId\)/);
  assert.match(a,/GetSelectedCharacter/);
});

test('combat game mode spawns exactly one selected pawn and online profile wins online',()=>{
  const a=r('tools/ue/apply-system-core-v2-1-selection.py');
  assert.match(a,/GetDefaultPawnClassForController_Implementation/);
  assert.match(a,/AHWKainCharacter::StaticClass/);
  assert.match(a,/AHWRyuCharacter::StaticClass/);
  assert.match(a,/AHWSeraCharacter::StaticClass/);
  assert.match(a,/Network->GetRoom\(\)\.bHasRaid/);
  assert.match(a,/NetProfile\.Character/);
  assert.ok(!a.includes('SwitchToIndex'));
});

test('UE automation covers valid single characters and rejects party-slot IDs',()=>{
  const c=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Tests/HWSystemCharacterSelectionTest.cpp');
  assert.match(c,/SaveContract/);
  assert.match(c,/MigrateV2/);
  assert.match(c,/party_slot_2/);
});

test('connected server profile prevents cosmetic local character divergence',()=>{
  const a=r('tools/ue/apply-system-core-v2-1-selection.py');
  assert.match(a,/Network->IsConnected\(\)/);
  assert.match(a,/NetProfile\.bCharacterCreated/);
  assert.match(a,/NetProfile\.Character != CharacterId/);
  assert.match(a,/OnlineCharacterLocked/);
});
