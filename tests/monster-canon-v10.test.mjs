import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { CATALOG } from '../js/mmo/monster-catalog.js';
import { buildRoster, validateRoster, placementEvidence, productionQueue, DOMINATORS, OUTPUT_ROOT } from '../tools/monsters/canon-v10.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { FIELD_MONSTERS: field } = createRequire(import.meta.url)('../server/field-monsters.cjs');
const read = p => fs.readFileSync(path.join(root, p));
const json = p => JSON.parse(read(p));
const v09 = json('docs/design/ref/monster-catalog-v09/MonsterRoster_v09.json');
const v10 = json(OUTPUT_ROOT + 'MonsterRoster_v10.json');
const maps = fs.readdirSync(path.join(root, 'maps/2d')).sort().filter(z => fs.existsSync(path.join(root, 'maps/2d', z, 'map.json'))).map(z => [z, json('maps/2d/' + z + '/map.json')]);

test('v10 preserves all 63 original objects, appends exactly five approved grade-2 species', () => {
  assert.deepEqual(v10.Monsters.slice(0, 63), v09.Monsters);
  assert.deepEqual(v10.Monsters.slice(63).map(m => m.MonsterId), DOMINATORS.map(d => d[0]));
  assert.deepEqual(buildRoster(v09, CATALOG, field), v10);
  assert.deepEqual(validateRoster(v10, v09, CATALOG, field).gradeCounts, [20, 15, 10, 15, 5, 3]);
  for (const m of v10.Monsters.slice(63)) { assert.equal(m.NameDraft, true); assert.equal(m.CombatDraft, true); }
});

test('negative controls reject original edits, duplicates, missing species, wrong grades, and falsely approved combat', () => {
  for (const corrupt of [
    v => { v.Monsters[0].Skills[0] = 'changed'; },
    v => { v.Monsters[1].MonsterId = v.Monsters[0].MonsterId; },
    v => { v.Monsters.pop(); },
    v => { v.Monsters[63].Grade = 1; },
    v => { v.Monsters[64].CombatDraft = false; },
    v => { v.Monsters[65].NameDraft = false; },
    v => { v.Monsters[66].Skills = [{ SkillId: 'incompatible-schema' }]; },
  ]) {
    const broken = structuredClone(v10); corrupt(broken);
    assert.throws(() => validateRoster(broken, v09, CATALOG, field));
  }
});

test('negative controls reject swapped sheets, field IDs, names, and unreviewed extra web species', () => {
  for (const corrupt of [
    w => { w[63].ref = w[64].ref; },
    w => { w[64].field = w[63].field; },
    w => { w[65].name = 'unapproved-name'; },
    w => { w[66].grade = 3; },
    w => { w[0].traits.push('changed-original'); },
    w => { w.push({ ...w[0], id: 'EXTRA' }); },
  ]) { const broken = structuredClone(CATALOG); corrupt(broken); assert.throws(() => buildRoster(v09, broken, field)); }
});

test('approved references retain exact content hashes and hero placeholders never pass visual QA', () => {
  const delivery = json(OUTPUT_ROOT + 'MonsterDelivery_v10.json');
  const sha = b => crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(sha(read(delivery.PreservedSource.Path)), delivery.PreservedSource.SHA256);
  for (const [i, m] of delivery.Dominators.entries()) {
    assert.equal(m.MonsterId, DOMINATORS[i][0]); assert.equal(m.FieldId, DOMINATORS[i][1]);
    assert.equal(m.ReferenceSHA256, sha(read(m.VisualReference)));
    assert.equal(m.ReinterpretationAllowed, false);
    assert.equal(m.ExistingBody.Status, 'hero-placeholder-not-approved-monster');
    assert.equal(m.PendingDirectorDecisions.length, 3);
  }
  assert.equal(delivery.GLBValidated, false); assert.equal(delivery.RuntimeImplemented, false);
});

test('level bands are observed placement evidence for all 68 species, never invented grade-to-level balance', () => {
  const evidence = placementEvidence(v10, maps, field);
  assert.deepEqual(json(OUTPUT_ROOT + 'MonsterPlacementEvidence_v10.json'), evidence);
  assert.equal(evidence.Species.length, 68);
  assert.ok(evidence.Species.some(m => m.CurrentPlacementLevelBand === null));
  for (const m of evidence.Species) {
    assert.equal(m.RecommendedLevelBand, null);
    assert.equal(m.RecommendationStatus, 'pending-balance-review');
    if (m.Placements.length) assert.deepEqual(m.CurrentPlacementLevelBand, [Math.min(...m.Placements.map(p => p.LevelBand[0])), Math.max(...m.Placements.map(p => p.LevelBand[1]))]);
  }
  const broken = structuredClone(maps); broken.find(([, m]) => m.areas.some(a => a.pool))[1].areas.find(a => a.pool).pool.common.push('UNKNOWN');
  assert.throws(() => placementEvidence(v10, broken, field), /Unknown placement/);
});

test('production queue is derived from actual maps, and deterministic rebuild leaves original files untouched', () => {
  const queue = productionQueue(maps);
  assert.deepEqual(json(OUTPUT_ROOT + 'MonsterProductionQueue_v10.json'), queue);
  assert.equal(queue.TotalCommonSlots, 131);
  assert.equal(queue.Ranked[0].MonsterId, 'G5_HOOKHAND'); assert.equal(queue.Ranked[0].CommonSlots, 18);
  assert.equal(queue.Ranked[1].MonsterId, 'G5_CAPTOR'); assert.equal(queue.Ranked[1].CommonSlots, 16);
  assert.equal(queue.Ranked.at(-1).CumulativeCoverage, 1);
  const files = ['docs/design/ref/monster-catalog-v09/MonsterRoster_v09.json', 'js/mmo/monster-catalog.js', ...maps.map(([z]) => 'maps/2d/' + z + '/map.json')];
  const before = files.map(read);
  execFileSync(process.execPath, ['tools/monsters/build-canon-v10.mjs', '--check'], { cwd: root });
  for (const [i, f] of files.entries()) assert.deepEqual(read(f), before[i], f + ' changed');
});
