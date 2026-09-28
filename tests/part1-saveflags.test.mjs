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

test('every extracted flag appears verbatim in the master', () => {
  for (const [ep, f] of Object.entries(data.episodes))
    for (const [k, v] of Object.entries(f)) assert.ok(master.includes(`${k}=${v}`), `${ep} ${k}=${v}`);
});

test('the Part 1 end is locked: SS for the four and Part1_Complete in EP28', () => {
  const f = data.episodes.EP28;
  for (const who of ['Ain', 'Kain', 'Ryu', 'Sera']) assert.equal(f[`SF_Rank_${who}`], 'SS');
  assert.equal(f.SF_Part1_Complete, 'true');
});
