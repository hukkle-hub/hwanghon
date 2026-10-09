/* Document 208: preserve v09 species, append the five director-approved dominators.
   This produces source JSON, NOT the generated web table or maps owned by Claude. */
import assert from 'node:assert/strict';

export const DOMINATORS = Object.freeze([
  ['G2_DOM_THORNCROWN', 't2_dominator_f', 'grade1-reference.png'],
  ['G2_DOM_BLACKCOAT', 't2_dominator_m', 'grade2-reference.png'],
  ['G2_DOM_SILENCE', 't2_dominator_silence', 'grade2-silence-reference.png'],
  ['G2_DOM_CRIMSON', 't2_dominator_crimson', 'grade2-crimson-blade-reference.png'],
  ['G2_DOM_BLOODFLOWER', 't2_dominator_bloodflower', 'grade2-blood-flower-reference.png'],
]);
export const REFERENCE_ROOT = 'docs/design/ref/field-monsters-grade12/';
export const OUTPUT_ROOT = 'docs/design/ref/monster-catalog-v10/';
const keys = ['MonsterId', 'Grade', 'Name', 'Archetype', 'CombatRole', 'Skills', 'Traits', 'SpawnContext', 'RegionAffinity', 'PartyRecommendation'];

export function fromWeb(m) {
  return { MonsterId: m.id, Grade: m.grade, Name: m.name, Archetype: m.archetype,
    CombatRole: m.role, Skills: [...m.skills], Traits: [...m.traits],
    SpawnContext: [...m.contexts], RegionAffinity: [...m.regions], PartyRecommendation: m.party };
}

function checkInputs(v09, web, field) {
  assert.equal(v09.Version, 'v09');
  assert.equal(v09.Count, 63);
  assert.equal(v09.Monsters.length, 63);
  assert.equal(new Set(v09.Monsters.map(m => m.MonsterId)).size, 63);
  assert.equal(web.length, 68, 'Unexpected web species: review the new source before rebuilding');
  assert.equal(new Set(web.map(m => m.id)).size, 68, 'Duplicate web MonsterId');
  for (const old of v09.Monsters) {
    const m = web.find(m => m.id === old.MonsterId);
    assert.ok(m, 'Missing v09 MonsterId: ' + old.MonsterId);
    assert.equal(m.src, 'gpt-v09');
    assert.deepEqual(fromWeb(m), old, 'Web table differs from v09: ' + old.MonsterId);
  }
  assert.deepEqual(Object.keys(field).sort(), DOMINATORS.map(d => d[1]).sort());
  for (const [id, fieldId, file] of DOMINATORS) {
    const m = web.find(m => m.id === id), f = field[fieldId];
    assert.ok(m && f, 'Missing approved dominator: ' + id);
    assert.equal(m.grade, 2, id + ': sheet heading is not authoritative');
    assert.equal(f.grade, 2);
    assert.equal(m.src, 'director-sheet');
    assert.equal(m.field, fieldId);
    assert.equal(m.ref, REFERENCE_ROOT + file);
    assert.equal(f.ref, m.ref);
    assert.equal(m.nameDraft, true);
    assert.equal(f.nameDraft, true);
    assert.equal(f.title, m.name + ' (가안)');
    assert.equal(m.archetype, 'Dominator');
  }
}

export function buildRoster(v09, web, field) {
  checkInputs(v09, web, field);
  const additions = DOMINATORS.map(([id]) => ({ ...fromWeb(web.find(m => m.id === id)), NameDraft: true, CombatDraft: true }));
  return { Version: 'v10', Count: 68, Monsters: [...structuredClone(v09.Monsters), ...additions] };
}

export function validateRoster(v10, v09, web, field) {
  const expected = buildRoster(v09, web, field);
  assert.equal(v10.Version, 'v10');
  assert.equal(v10.Count, 68);
  assert.equal(v10.Monsters.length, 68);
  assert.equal(new Set(v10.Monsters.map(m => m.MonsterId)).size, 68);
  for (const m of v10.Monsters) {
    for (const k of keys) assert.ok(Object.hasOwn(m, k), m.MonsterId + ': missing ' + k);
    for (const k of ['Skills', 'Traits', 'SpawnContext', 'RegionAffinity']) {
      assert.ok(Array.isArray(m[k]) && m[k].length > 0 && m[k].every(s => typeof s === 'string' && s.length > 0), m.MonsterId + ': invalid ' + k);
    }
    assert.ok([5, 4, 3, 2, 1, '특급'].includes(m.Grade));
    assert.ok(['Solo', 'Party', 'Raid'].includes(m.PartyRecommendation));
  }
  assert.deepEqual(v10, expected, 'v10 must preserve original species and explicitly mark all five new combat definitions as provisional');
  const counts = [5, 4, 3, 2, 1, '특급'].map(g => v10.Monsters.filter(m => m.Grade === g).length);
  assert.deepEqual(counts, [20, 15, 10, 15, 5, 3]);
  return { species: 68, preserved: 63, added: 5, gradeCounts: counts };
}

/* Observed placements, not invented balance recommendations. A species without
   a current placement has null, never an arbitrary level band derived from grade. */
export function placementEvidence(v10, maps, field) {
  const species = v10.Monsters.map(m => ({ MonsterId: m.MonsterId, CurrentPlacementLevelBand: null, Placements: [] }));
  const byId = new Map(species.map(m => [m.MonsterId, m]));
  const add = (id, source) => {
    assert.ok(byId.has(id), 'Unknown placement MonsterId: ' + id);
    const lv = source.LevelBand;
    assert.ok(Array.isArray(lv) && lv.length === 2 && lv.every(n => Number.isInteger(n) && n >= 1) && lv[0] <= lv[1], 'Invalid placement level band');
    byId.get(id).Placements.push(source);
  };
  for (const [zoneId, map] of maps) for (const a of map.areas || []) {
    if (a.kind !== 'hunt' || !a.pool) continue;
    for (const rarity of ['common', 'rare']) for (const id of a.pool[rarity] || []) {
      add(id, { Source: 'map-pool', Zone: zoneId, Area: a.id, Rarity: rarity, LevelBand: [...a.lv] });
    }
  }
  for (const [id, fieldId] of DOMINATORS) {
    const f = field[fieldId];
    add(id, { Source: 'field-monsters', FieldId: fieldId, Zone: f.zone, Area: f.area, LevelBand: [...f.lv] });
  }
  for (const m of species) {
    m.Placements.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
    if (m.Placements.length) m.CurrentPlacementLevelBand = [Math.min(...m.Placements.map(p => p.LevelBand[0])), Math.max(...m.Placements.map(p => p.LevelBand[1]))];
    m.RecommendedLevelBand = null;
    m.RecommendationStatus = 'pending-balance-review';
  }
  return { Version: 'v10', Meaning: 'Current map/server placements only; not director-approved recommended levels.', Species: species };
}

export function productionQueue(maps) {
  const slots = new Map();
  for (const [, map] of maps) for (const a of map.areas || []) if (a.kind === 'hunt') {
    for (const id of a.pool?.common || []) slots.set(id, (slots.get(id) || 0) + 1);
  }
  const total = [...slots.values()].reduce((a, b) => a + b, 0);
  let cumulative = 0;
  const ranked = [...slots].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en')).map(([MonsterId, CommonSlots]) => {
    cumulative += CommonSlots;
    return { MonsterId, CommonSlots, CumulativeSlots: cumulative, CumulativeCoverage: Number((cumulative / total).toFixed(4)), AssetStatus: 'not-validated' };
  });
  return { TotalCommonSlots: total, Ranked: ranked, RequiredClips: ['idle', 'walk', 'attack', 'hit', 'die'], VisualApprovalRequired: true };
}
