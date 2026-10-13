const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { KITS } = require('../server/field-boss-kit.cjs');
const sources = [
  ['leviathan', 'leviathan_static', 2900988, 'bc77dcd04130e38cf2474d5feadead0ffb6e36eae0c08df58d0f308250edce6d'],
  ['aegis', 'aegis_07_static', 2392584, 'f6c187c847aff82ce0744eb3625cd8b9f3d43b33b3adace3edcacea4fc2a4948'],
  ['celestial2', 'celestial_static', 2863180, '9d06dd4724b806e69952e56c9bdda90c39a7be276f7779b5cc5705c5d5416dd2'],
  ['arsenal', 'arsenal_overlord_static', 2899976, '5ac5322a1fca79066390d4501935e97ceedd6adaf5993af3a1609464ce32fa8d'],
];
function glb(name) {
  const b = fs.readFileSync(path.join(__dirname, '../art/3d/part1', name + '.glb'));
  assert.equal(b.readUInt32LE(8), b.length);
  const n = b.readUInt32LE(12);
  return { j: JSON.parse(b.subarray(20, 20 + n)), bin: b.subarray(28 + n) };
}
for (const [id, name, size, hash] of sources) test(id + ': original geometry binary preserved and every skill has a motion clip', () => {
  const { j, bin } = glb(name);
  assert.equal(crypto.createHash('sha256').update(bin.subarray(0, size)).digest('hex'), hash);
  const pivot = j.nodes.findIndex(n => n.name === 'KitMechanicalMotion'); assert.ok(pivot >= 0);
  for (const s of Object.values(KITS[id].skills)) {
    const c = j.animations.find(c => c.name === s.clip); assert.ok(c, s.clip);
    assert.ok(c.channels.every(c => c.target.node === pivot && c.target.path === 'rotation'));
    const a = j.accessors[c.samplers[0].input]; assert.equal(a.max[0], s.duration / 1000);
  }
});
test('nova reuses existing rig and native skill clips', () => {
  const { j } = glb('nano_nova_core'); assert.ok(j.skins.length > 0);
  for (const s of Object.values(KITS.nova.skills)) assert.ok(j.animations.some(c => c.name === s.clip), s.clip);
});
