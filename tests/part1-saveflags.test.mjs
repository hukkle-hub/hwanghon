import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Part 1 SaveFlags extracted from the production master (tools/story/build_part1_saveflags.py, docs/design/143).
const data = JSON.parse(fs.readFileSync('ue/HwanghonCombatUE/Content/Data/part1_saveflags.json', 'utf8'));
const master = fs.readFileSync(data.source, 'utf8');

test('every episode EP01-EP28 has end-of-episode flags, and each chains to the next', () => {
  const eps = Object.keys(data.episodes);
  assert.equal(eps.length, 28);
  eps.forEach((ep, i) => {
    const f = data.episodes[ep];
    assert.equal(f[`SF_${ep}_COMPLETE`], 'true', ep);
    const next = i === 27 ? 'END_PART1' : String(i + 2);
    assert.equal(f.SF_CurrentEpisode, next, ep);
    for (const [k, v] of Object.entries(f)) { assert.match(k, /^SF_/); assert.ok(v.length > 0, k); }
  });
});

test('EP01 flags are exactly the master block', () => {
  assert.deepEqual(data.episodes.EP01, {
    SF_EP01_COMPLETE: 'true', SF_Rank_Ain: 'C', SF_Rank_Kain: 'C',
    SF_Boss_TrainingDummy_State: 'Destroyed', SF_Archive_FirstCrystal: 'true', SF_CurrentEpisode: '2',
  });
});

test('every flag appears verbatim in the master, except those the novel added (docs/design/144)', () => {
  for (const [ep, f] of Object.entries(data.episodes))
    for (const [k, v] of Object.entries(f)) {
      const added = data.canon_fixes[ep]?.add?.[k] === v;
      assert.ok(added || master.includes(`${k}=${v}`), `${ep} ${k}=${v}`);
    }
});

test('the novel wins where the master contradicts it', () => {
  const e = data.episodes;
  assert.equal(e.EP07.SF_Party_RyuJoined, undefined, 'EP07: Ryu refuses registration (L7151-L7218)');
  assert.equal(e.EP10.SF_Party_RyuJoined, 'true', 'EP10: party of four incl. Ryu (L8283)');
  assert.equal(e.EP04.SF_Archive_CelestialReleasedAin, undefined, 'EP04: no release (L4380-L4550)');
  assert.equal(e.EP11.SF_Kain_KneeInjury, 'true');
  assert.equal(e.EP14.SF_NPC_MinkyungAlive, 'false');
});

test('the Part 1 end is locked: SS for the four and Part1_Complete in EP28', () => {
  const f = data.episodes.EP28;
  for (const who of ['Ain', 'Kain', 'Ryu', 'Sera']) assert.equal(f[`SF_Rank_${who}`], 'SS');
  assert.equal(f.SF_Part1_Complete, 'true');
});
