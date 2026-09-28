import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const r=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(r('ue/HwanghonCombatUE/Content/Data/dungeon_research_sources.json'));

test('boss dungeon formula is story centered and has no filler rooms',()=>{
  assert.deepEqual(manifest.rules.dungeon_formula,['story','boss_entry','boss_arena','boss_battle','boss_result','story']);
  const raw=JSON.stringify(manifest);
  assert.ok(!raw.includes('elite_room'));
});

test('free sample research covers modern facility, arena, pcg, boss sample and feature examples',()=>{
  const ids=new Set(manifest.samples.map(x=>x.id));
  for(const id of ['derelict_corridor','dark_ruins','electric_dreams','valley_ancient','content_examples']) assert.ok(ids.has(id),id);
});

test('PCG is restricted to dressing and never combat layout',()=>{
  assert.ok(manifest.rules.pcg_allowed.includes('rubble'));
  for(const x of ['player_spawn','boss_spawn','charge_lane','dodge_space','camera_readability']) assert.ok(manifest.rules.manual_layout.includes(x),x);
});

test('phase data layer template exists',()=>{
  for(const x of ['DL_Arena_Base','DL_Phase1','DL_Phase2_Damaged','DL_Phase3_Critical','DL_Aftermath','DL_Cinematic']) assert.ok(manifest.rules.data_layers.includes(x),x);
});

test('asset audit scans installed project assets instead of downloading content',()=>{
  const s=r('ue/HwanghonCombatUE/Scripts/dungeon_asset_audit.py');
  assert.match(s,/list_assets\("\/Game"/);
  assert.match(s,/asset_candidates\.csv/);
  assert.ok(!s.includes('requests.get'));
  assert.ok(!s.includes('download'));
});

test('Claude instruction makes novel canon higher priority than dungeon systems',()=>{
  const s=r('CLAUDE_STORY_DUNGEON_IMPLEMENTATION_V1.md');
  assert.match(s,/소설 전체가 게임과 애니메이션의 Source of Truth/);
  assert.match(s,/Combat Room -> Elite Room -> Objective Room -> Boss/);
  assert.match(s,/Story -> Boss Entry -> Boss Arena -> Boss Battle -> Boss Result -> Story/);
});
