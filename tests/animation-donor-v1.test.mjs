import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest=JSON.parse(fs.readFileSync(
  'ue/HwanghonCombatUE/Content/Data/animation_donor_manifest.json','utf8'));
const sources=JSON.parse(fs.readFileSync(
  'ue/HwanghonCombatUE/Content/Data/animation_donor_sources.json','utf8'));
const source=Object.fromEntries(sources.sources.map(x=>[x.id,x]));

test('donor manifest covers four characters and boss',()=>{
  for(const id of ['ain','kain','ryu','sera'])
    assert.ok(manifest.characters[id],id);
  assert.ok(manifest.boss,'boss');
});

test('Ain and Kain use weapon-suitable primary donors',()=>{
  assert.ok(manifest.characters.ain.primary.includes('paragon_countess'));
  assert.ok(manifest.characters.ain.primary.includes('paragon_kwang'));
  assert.ok(manifest.characters.kain.primary.includes('paragon_greystone'));
  assert.ok(manifest.characters.kain.primary.includes('paragon_kwang'));
});

test('Ryu and Sera have distinct donor identities',()=>{
  assert.ok(manifest.characters.ryu.primary.includes('paragon_serath'));
  assert.ok(manifest.characters.sera.primary.includes('paragon_morigesh'));
  assert.ok(manifest.characters.sera.primary.includes('paragon_phase'));
  assert.ok(manifest.characters.sera.secondary.includes('paragon_dekker'));
});

test('boss has three complementary weight donors',()=>{
  const p=manifest.boss.primary;
  for(const id of ['paragon_sevarog','paragon_grux','paragon_rampage'])
    assert.ok(p.includes(id),id);
});

test('free fallback sources have explicit license notes',()=>{
  assert.match(source.quaternius_ual2.license_note,/CC0/);
  assert.match(source.mixamo.license_note,/commercial games/);
  assert.match(source.rokoko_create.license_note,/commercially/);
  assert.match(source.paragon_countess.license_note,/Unreal Engine projects/);
  assert.equal(source.paragon_countess.ai_input_allowed,false);
  assert.equal(source.paragon_minions.ai_input_allowed,false);
});

test('audit script ranks candidates from donor roots and slot keywords',()=>{
  const s=fs.readFileSync(
    'ue/HwanghonCombatUE/Scripts/audit_animation_donors.py','utf8');
  assert.match(s,/rank_slot/);
  assert.match(s,/source_score/);
  assert.match(s,/keyword_score/);
  assert.match(s,/source_root_hints/);
  assert.match(s,/donor_candidates\.csv/);
  assert.match(s,/max_results=12/);
});

test('pipeline keeps donor assets separate from retargeted and QA outputs',()=>{
  const s=fs.readFileSync(
    'ue/HwanghonCombatUE/Scripts/audit_animation_donors.py','utf8');
  for(const folder of ['/Retargeted/Ain','/Retargeted/Kain','/Retargeted/Ryu','/Retargeted/Sera','/Retargeted/Boss','/ControlRig','/IK','/QA'])
    assert.ok(s.includes(folder),folder);
});

test('no combat character switching is introduced',()=>{
  for(const file of [
    'ue/HwanghonCombatUE/Content/Data/animation_donor_manifest.json',
    'docs/design/130-animation-donor-map-v1.md',
    'docs/design/131-retarget-pipeline-v1.md'
  ]){
    const s=fs.readFileSync(file,'utf8');
    assert.ok(!s.includes('SwitchToIndex'),file);
    assert.ok(!s.includes('LinkGauge'),file);
  }
});
