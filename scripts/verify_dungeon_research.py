from pathlib import Path
import json, ast
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'ue/HwanghonCombatUE/Content/Data/dungeon_research_sources.json').read_text(encoding='utf-8'))
assert manifest['schema']=='hwanghon-dungeon-research-v1'
ids={x['id'] for x in manifest['samples']}
for required in ['derelict_corridor','dark_ruins','electric_dreams','valley_ancient','content_examples']:
    assert required in ids, required
assert manifest['rules']['dungeon_formula']==['story','boss_entry','boss_arena','boss_battle','boss_result','story']
for rel in [
    'ue/HwanghonCombatUE/Scripts/setup_story_dungeon_workspace.py',
    'ue/HwanghonCombatUE/Scripts/dungeon_asset_audit.py',
]:
    ast.parse((root/rel).read_text(encoding='utf-8'))
claude=(root/'CLAUDE_STORY_DUNGEON_IMPLEMENTATION_V1.md').read_text(encoding='utf-8')
for needle in ['소설','Boss Arena','Data Layers','Chaos','Sequencer','PCG']:
    assert needle in claude, needle
print('DUNGEON RESEARCH V1 VERIFY: PASS')
