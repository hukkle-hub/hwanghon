/* Add small rigid-body anticipation/recoil clips without rewriting original mesh,
   material, texture, node or accessor data. Mandatory source backup outside checkout.
   node tools/3d/bake-static-boss-kits.mjs --backup <immutable directory>
   These are minimum mechanical motion clips, not articulated replacement rigs. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { Quaternion, Euler } from '../../vendor/three/three.module.js';
const { KITS } = createRequire(import.meta.url)('../../server/field-boss-kit.cjs');
const arg = process.argv.indexOf('--backup'), backup = arg >= 0 && process.argv[arg + 1];
if (!backup) throw Error('An immutable --backup directory is required');
fs.mkdirSync(backup, { recursive: true });
const names = { leviathan: 'leviathan_static', aegis: 'aegis_07_static', celestial2: 'celestial_static', arsenal: 'arsenal_overlord_static' };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const report = [];
for (const [id, name] of Object.entries(names)) {
  const file = `art/3d/part1/${name}.glb`, original = path.join(backup, name + '.glb');
  if (!fs.existsSync(original)) fs.copyFileSync(file, original, fs.constants.COPYFILE_EXCL);
  const bytes = fs.readFileSync(original), jsonN = bytes.readUInt32LE(12), j = JSON.parse(bytes.subarray(20, 20 + jsonN));
  if (j.animations?.length || j.buffers.length !== 1) throw Error('Unexpected source ' + name);
  const binN = bytes.readUInt32LE(20 + jsonN), binary = bytes.subarray(28 + jsonN, 28 + jsonN + binN);
  let length = binary.length; const chunks = [binary];
  const add = (values, type) => {
    const data = Buffer.from(new Float32Array(values).buffer), view = j.bufferViews.length;
    j.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.length }); chunks.push(data); length += data.length;
    const n = type === 'SCALAR' ? 1 : 4, index = j.accessors.length;
    j.accessors.push({ bufferView: view, componentType: 5126, count: values.length / n, type, ...(n === 1 ? { min: [Math.min(...values)], max: [Math.max(...values)] } : {}) }); return index;
  };
  const roots = j.scenes[j.scene || 0].nodes.slice(), pivot = j.nodes.length;
  j.nodes.push({ name: 'KitMechanicalMotion', children: roots }); j.scenes[j.scene || 0].nodes = [pivot];
  j.animations = [];
  const clip = (name, keys) => {
    const input = add(keys.map(k => k[0] / 1000), 'SCALAR');
    const output = add(keys.flatMap(k => new Quaternion().setFromEuler(new Euler(k[1], k[2], k[3] || 0)).toArray()), 'VEC4');
    j.animations.push({ name, samplers: [{ input, output, interpolation: 'LINEAR' }], channels: [{ sampler: 0, target: { node: pivot, path: 'rotation' } }] });
  };
  clip('idle', [[0, 0, 0], [2200, 0, 0]]);
  clip('stagger', [[0, 0, 0], [130, .018, 0], [400, -.008, 0], [1350, 0, 0]]);
  for (const skill of Object.values(KITS[id].skills)) {
    const keys = new Map([[0, [0, 0, 0]], [skill.duration, [skill.duration, 0, 0]]]);
    const pitch = id === 'celestial2' ? .13 : id === 'arsenal' ? .008 : .018;
    for (const [i, h] of skill.hits.entries()) {
      const from = Math.max(i ? skill.hits[i - 1].at + 320 : 0, h.at - 850);
      for (const k of [[from, 0, 0], [h.at - 300, -pitch, 0], [h.at - 100, -pitch, 0], [h.at + 100, pitch * .6, 0], [h.at + 320, 0, 0]]) keys.set(k[0], k);
    }
    clip(skill.clip, [...keys.values()].sort((a, b) => a[0] - b[0]));
  }
  j.buffers[0].byteLength = length;
  let json = Buffer.from(JSON.stringify(j)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const head = Buffer.alloc(20); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + json.length + length, 8); head.writeUInt32LE(json.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  const binHead = Buffer.alloc(8); binHead.writeUInt32LE(length, 0); binHead.writeUInt32LE(0x004e4942, 4);
  const output = Buffer.concat([head, json, binHead, ...chunks]); fs.writeFileSync(file, output);
  report.push({ id, file, original, sourceSha256: sha(bytes), outputSha256: sha(output), addedBytes: output.length - bytes.length, clips: j.animations.map(a => a.name), originalBinaryPrefixUnchanged: Buffer.concat(chunks).subarray(0, binary.length).equals(binary), visualApproval: false });
}
fs.writeFileSync(path.join(backup, 'bake-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
