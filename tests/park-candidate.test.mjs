/* Asset integrity only. Passing does not certify anatomy or full-motion quality. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {PARK}=createRequire(import.meta.url)('../server/field-boss-canon.cjs');
const read=file=>{const b=fs.readFileSync(file),n=b.readUInt32LE(12);return {j:JSON.parse(b.toString('utf8',20,20+n)),bin:b.subarray(28+n,28+n+b.readUInt32LE(20+n))};};
const source=read('art/review/part1/park-recovered.glb'),candidate=read('art/review/part1/park-combat-candidate.glb');
test('Park candidate preserves immutable original mesh/UV/texture bytes',()=>{
 assert.ok(candidate.bin.subarray(0,source.bin.length).equals(source.bin));
 const a=source.j.meshes[0].primitives[0],b=candidate.j.meshes[0].primitives[0];
 for(const k of ['POSITION','NORMAL','TEXCOORD_0'])assert.equal(b.attributes[k],a.attributes[k]);
 assert.equal(a.indices,b.indices);
});
test('all seven canonical skills have exact authored durations and lifecycle clips',()=>{
 const clips=new Map(candidate.j.animations.map(c=>[c.name,c]));
 for(const s of Object.values(PARK.skills)){const c=clips.get(s.clip);assert.ok(c,s.clip);const duration=candidate.j.accessors[c.samplers[0].input].max[0];assert.ok(Math.abs(duration-s.duration/1000)<1e-5,s.clip);}
 for(const n of ['idle_park','walk','stagger','cancel_park','death_park_salute'])assert.ok(clips.has(n),n);
});
test('candidate uses deform bones, one hand-parented rigid sword, and release tracks only for death',()=>{
 const nodes=candidate.j.nodes,hand=nodes.find(n=>n.name==='RHand'),sword=nodes.findIndex(n=>n.name==='ParkDanjoe');
 assert.equal(candidate.j.skins[0].joints.length,26);assert.ok(candidate.j.skins[0].joints.every(i=>!/^ik_/i.test(nodes[i].name)));
 assert.ok(hand.children.includes(sword));assert.equal(nodes.filter(n=>n.name==='ParkDanjoe').length,1);
 for(const c of candidate.j.animations){const channels=c.channels.filter(c=>c.target.node===sword);assert.equal(channels.length,2);}
 const zones=fs.readFileSync('js/mmo/zones.js','utf8');assert.ok(!zones.includes('park-combat-candidate'),'unapproved skin must not be enabled');
});
