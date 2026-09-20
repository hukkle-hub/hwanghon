import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
function read(file){const b=fs.readFileSync(new URL(file,root));return JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));}
test('modular experimental body retains existing 28 animation names and 24 joints',()=>{
 const g=read('art/3d/base/ain_modular_rig_candidate.glb'),ref=read('art/3d/ain_body.glb');
 assert.deepEqual(g.animations.map(a=>a.name).sort(),ref.animations.map(a=>a.name).sort());
 assert.equal(g.skins[0].joints.length,24);
 for(const m of g.meshes)for(const p of m.primitives){assert.ok(p.attributes.JOINTS_0!==undefined);assert.ok(p.attributes.WEIGHTS_0!==undefined);}
 assert.ok(!g.extensionsUsed?.includes('KHR_draco_mesh_compression'));
});
test('experimental body is explicitly NOT approved for runtime',()=>{
 const r=JSON.parse(fs.readFileSync(new URL('art/review/ain_modular/rig_report.json',root)));
 assert.equal(r.status,'EXPERIMENT_NOT_RUNTIME_APPROVED');assert.equal(r.unweighted_vertices,0);
 assert.equal(r.evidence.length,4);
});
