import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const r=p=>fs.readFileSync(p,'utf8');

test('one player owns one character; no combat switching grammar',()=>{
  const files=[
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWSystemTypes.h',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWCharacterKitComponent.h',
    'ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCharacterKitComponent.cpp'
  ];
  for(const f of files){const s=r(f);for(const x of ['SwitchToIndex','LinkGauge','EntryMultiplier','ExitMultiplier'])assert.ok(!s.includes(x),`${f}: ${x}`);}
});

test('local character kit exposes skill1-4 plus ultimate',()=>{
  const h=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWCharacterKitComponent.h');
  const t=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWSystemTypes.h');
  for(const x of ['Skill1','Skill2','Skill3','Skill4','Ultimate'])assert.match(t,new RegExp(x));
  for(const x of ['RequestSkill1','RequestSkill2','RequestSkill3','RequestSkill4','RequestUltimate'])assert.match(h,new RegExp(x));
});

test('local fallback matches authoritative revive and party HP scaling',()=>{
  const lifeH=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/System/HWCoopLifeComponent.h');
  const lifeC=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCoopLifeComponent.cpp');
  const coop=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/System/HWCoopCombatSubsystem.cpp');
  assert.match(lifeH,/BleedoutDuration = 20\.f/);
  assert.match(lifeH,/ReviveDuration = 3\.f/);
  assert.match(lifeC,/Combat->Revive\(0\.30f\)/);
  assert.match(coop,/case 2: return 1\.65f/);
  assert.match(coop,/case 3: return 2\.30f/);
  assert.match(coop,/case 4: return 2\.95f/);
  assert.match(coop,/BossPostureScale\(\) const[\s\S]*return 1\.f/);
});

test('network subsystem speaks existing party websocket protocol',()=>{
  const c=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidNetworkSubsystem.cpp');
  for(const x of ['party-socket','hello','create','join','ready','start','retry','lobby','attack','smash','dodge','jump','counter','guard','revive','interact','skill','ult','execute','opening'])assert.match(c,new RegExp(x));
  assert.match(c,/\+\+Sequence/);
  assert.match(c,/\$array/);
  assert.match(c,/\$unset/);
  assert.match(c,/ScheduleReconnect/);
  assert.match(c,/HWServer=/);
});

test('online client consumes authoritative players boss parts hazards expedition and events',()=>{
  const h=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWRaidNetworkSubsystem.h');
  for(const x of ['FHWRaidNetPlayer','FHWRaidNetBoss','FHWRaidNetBossPart','FHWRaidNetHazard','FHWRaidNetExpedition','FHWRaidNetExpeditionNode','FHWRaidNetGate','FHWRaidNetEvent'])assert.match(h,new RegExp(x));
  const w=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidWorldBridge.cpp');
  for(const x of ['ApplyAuthoritativeVitals','ApplyAuthoritativeSnapshot','AHWRaidRemoteAvatar','AHWBossPartTarget','AHWRaidHazardProxy','AHWRaidExpeditionNodeProxy','WorldOriginOffset'])assert.match(w,new RegExp(x));
});

test('online client sends intents but does not own contact damage',()=>{
  const a=r('tools/ue/apply-system-core-v2-current.py');
  assert.match(a,/NetworkBridge && NetworkBridge->IsAuthoritativeRaid\(\)/);
  assert.match(a,/NetworkBridge && NetworkBridge->IsAuthoritativeRaid\(\)\) return/);
  const bridge=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWNetworkCombatBridgeComponent.cpp');
  assert.match(bridge,/SendAttack/);
  assert.match(a,/NetworkBridge->\{send\}/);
  assert.match(a,/Combat->RequestAttack/); // presentation prediction remains
  assert.match(a,/bNetworkAuthoritative/);
});

test('online map is server-authority presentation map only',()=>{
  const py=r('ue/HwanghonCombatUE/Scripts/build_online_raid_graybox.py');
  assert.match(py,/OnlineRaid_Floor/);
  assert.ok(!py.includes('Wall'));
  const travel=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidTravelSubsystem.cpp');
  assert.match(travel,/OnRoomStateChanged/);
  assert.match(travel,/DoesPackageExist/);
  const a=r('tools/ue/apply-system-core-v2-current.py');
  assert.match(a,/!bOnlineRaid && !DungeonId\.IsNone/);
  assert.match(a,/Hwanghon_OnlineRaid/);
});

test('server-side snapshot extension is presentation-only',()=>{
  const a=r('tools/ue/apply-system-core-v2-current.py');
  assert.match(a,/nodes:this\.expedition\.nodes\.map/);
  assert.match(a,/gate:\{x:this\.gate\.x/);
  if(fs.existsSync('server/raid.cjs')){
    const raid=r('server/raid.cjs');
    assert.match(raid,/msg\.type==='interact'/);
    assert.doesNotMatch(raid,/msg\.type==='objectiveComplete'/);
  }
});

test('existing server remains max-4 independent players when present',()=>{
  if(!fs.existsSync('server/index.cjs')||!fs.existsSync('server/raid.cjs')) return;
  const server=r('server/index.cjs'), raid=r('server/raid.cjs');
  assert.match(server,/room\.members\.size>=4/);
  assert.match(raid,/One world, one boss, independent players/);
  assert.match(raid,/character:m\.character\|\|'ain'/);
  assert.match(raid,/reviveHeld/);
  assert.match(raid,/threat/);
});

test('UE can create exactly one server profile character before joining co-op',()=>{
  const h=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWRaidNetworkSubsystem.h');
  const c=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Private/Network/HWRaidNetworkSubsystem.cpp');
  assert.match(h,/CreateCharacter/);
  assert.match(h,/FHWNetProfile/);
  assert.match(c,/TEXT\("character"\)/);
  assert.match(c,/characterCreated/);
  assert.match(c,/HWCharacter=/);
  assert.match(c,/HWCharacterName=/);
  assert.match(c,/Profile\.bCharacterCreated/);
  assert.ok(!c.includes('SwitchToIndex'));
});

test('pending online character creation state belongs to the network subsystem, never raid events',()=>{
  const h=r('ue/HwanghonCombatUE/Source/HwanghonCombatUE/Public/Network/HWRaidNetworkSubsystem.h');
  const eventStart=h.indexOf('struct FHWRaidNetEvent');
  const eventEnd=h.indexOf('struct FHWRaidNetSnapshot',eventStart);
  const eventBody=h.slice(eventStart,eventEnd);
  assert.ok(!eventBody.includes('PendingCharacterName'));
  assert.ok(!eventBody.includes('PendingCharacterId'));

  const subsystemStart=h.indexOf('class HWANGHONCOMBATUE_API UHWRaidNetworkSubsystem');
  const subsystemBody=h.slice(subsystemStart);
  assert.match(subsystemBody,/FString PendingCharacterName/);
  assert.match(subsystemBody,/FName PendingCharacterId/);
  assert.match(h,/SetPendingCharacterCreation/);
});
