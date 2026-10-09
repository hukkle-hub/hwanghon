import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../../js/mmo/monster-catalog.js';
import { buildRoster, validateRoster, placementEvidence, productionQueue, DOMINATORS, OUTPUT_ROOT } from './canon-v10.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { FIELD_MONSTERS } = createRequire(import.meta.url)('../../server/field-monsters.cjs');
const read = f => fs.readFileSync(path.join(root, f));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const originalPath = 'docs/design/ref/monster-catalog-v09/MonsterRoster_v09.json';
const original = read(originalPath), v09 = JSON.parse(original);
const maps = fs.readdirSync(path.join(root, 'maps/2d')).sort().filter(z => fs.existsSync(path.join(root, 'maps/2d', z, 'map.json')))
  .map(z => [z, JSON.parse(read('maps/2d/' + z + '/map.json'))]);
const roster = buildRoster(v09, CATALOG, FIELD_MONSTERS);
const validation = validateRoster(roster, v09, CATALOG, FIELD_MONSTERS);
const references = DOMINATORS.map(([MonsterId, FieldId]) => {
  const f = FIELD_MONSTERS[FieldId];
  return { MonsterId, FieldId, Grade: 2, NameStatus: 'draft', CombatStatus: 'provisional-from-existing-web-table',
    VisualReference: f.ref, ReferenceSHA256: sha(read(f.ref)), ReinterpretationAllowed: false, ApprovedAppearanceDescription: f.look,
    ExistingBody: { ...f.body, Status: 'hero-placeholder-not-approved-monster' },
    UnapprovedExistingBalance: { HP: f.hp, Cycle: f.cycle },
    PendingDirectorDecisions: ['final-name', 'strength-without-hp-sponge', 'encounter-frequency'] };
});
const files = {
  'MonsterRoster_v10.json': roster,
  'MonsterPlacementEvidence_v10.json': placementEvidence(roster, maps, FIELD_MONSTERS),
  'MonsterProductionQueue_v10.json': productionQueue(maps),
  'MonsterDelivery_v10.json': { Version: 'v10', Status: 'canon-only-local-not-deployed', Validation: validation,
    PreservedSource: { Path: originalPath, SHA256: sha(original) },
    GeneratedWebTableChanged: false, MapsChanged: false, RuntimeImplemented: false, GLBValidated: false,
    Consumer: 'Claude regenerates js/mmo/monster-catalog.js and patch-areas from this source.',
    SchemaCompatibility: 'Original PascalCase fields and string arrays preserved; NameDraft/CombatDraft flags only on new species.',
    Dominators: references }
};
const check = process.argv.includes('--check');
for (const [name, data] of Object.entries(files)) {
  const target = path.join(root, OUTPUT_ROOT, name), bytes = JSON.stringify(data, null, 2) + '\n';
  if (fs.existsSync(target)) {
    if (fs.readFileSync(target, 'utf8') !== bytes) throw Error(name + ' differs: inspect changes; refusing silent overwrite');
  } else {
    if (check) throw Error('Missing output: ' + name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: 'wx' });
  }
}
if (sha(read(originalPath)) !== sha(original)) throw Error('Original v09 changed');
console.log(JSON.stringify({ ...validation, outputs: Object.keys(files), mode: check ? 'check' : 'build' }));
