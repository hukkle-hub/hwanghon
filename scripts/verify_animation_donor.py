from pathlib import Path
import json, ast

root=Path(__file__).resolve().parents[1]
manifest_path=root/'ue/HwanghonCombatUE/Content/Data/animation_donor_manifest.json'
sources_path=root/'ue/HwanghonCombatUE/Content/Data/animation_donor_sources.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
sources=json.loads(sources_path.read_text(encoding='utf-8'))

assert manifest['schema']=='hwanghon-animation-donor-manifest-v1'
assert sources['schema']=='hwanghon-animation-donor-sources-v1'
assert manifest['rules']['no_character_switching'] is True
assert manifest['rules']['combat_timing_is_authoritative'] is True
assert manifest['rules']['paragon_ai_processing_forbidden'] is True
assert set(manifest['characters'])=={'ain','kain','ryu','sera'}
assert set(['paragon_sevarog','paragon_grux','paragon_rampage']).issubset(set(manifest['boss']['primary']))

source_ids={x['id'] for x in sources['sources']}
required={
 'epic_game_animation_sample','paragon_countess','paragon_kwang','paragon_greystone',
 'paragon_serath','paragon_morigesh','paragon_phase','paragon_dekker',
 'paragon_sevarog','paragon_grux','paragon_rampage','paragon_minions',
 'quaternius_ual1','quaternius_ual2','mixamo','rokoko_create','accurig'
}
assert required.issubset(source_ids), required-source_ids

for owner,body in manifest['characters'].items():
    for donor in body['primary']+body['secondary']+[body['locomotion']]:
        assert donor in source_ids,(owner,donor)
    for slot,spec in body['slots'].items():
        assert spec['donors'],(owner,slot)
        assert spec['keywords'],(owner,slot)
        for donor in spec['donors']:
            assert donor in source_ids,(owner,slot,donor)

for slot,spec in manifest['boss']['slots'].items():
    assert spec['donors'] and spec['keywords'],slot
    for donor in spec['donors']:
        assert donor in source_ids,(slot,donor)

for src in sources['sources']:
    if src['id'].startswith('paragon_'):
        assert src['ai_input_allowed'] is False,src['id']

raw=json.dumps(manifest,ensure_ascii=False)
for forbidden in ['SwitchToIndex','LinkGauge','three_character_party']:
    assert forbidden not in raw

t=manifest['rules']['timings']
assert t['basic']['duration']==0.66 and t['basic']['hit']==0.24
assert t['smash']['duration']==1.15 and t['smash']['hit']==0.48
assert t['counter']['duration']==0.56 and t['counter']['hit']==0.18

for rel in [
 'ue/HwanghonCombatUE/Scripts/setup_animation_donor_workspace.py',
 'ue/HwanghonCombatUE/Scripts/audit_animation_donors.py',
 'ue/HwanghonCombatUE/Scripts/animation_donor_audit.py',
]:
    ast.parse((root/rel).read_text(encoding='utf-8'))

print('ANIMATION DONOR V1 VERIFY: PASS')
