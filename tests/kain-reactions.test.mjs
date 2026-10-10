import test from 'node:test';import assert from 'node:assert/strict';
import {report} from '../tools/3d/audit-kain-reactions.mjs';
function check(r){
 assert.equal(r.frames,732);assert.ok(r.maxGap<.001,'palms must remain on one rigid handle');
 assert.ok(r.maxWristBend<Math.PI/6,'no wrist sacrifice for contact');
 assert.ok(r.minClearance>.18,'no forearm through torso');assert.ok(r.minSole>=-.00001,'actual skinned boot grounding');
 assert.deepEqual(r.bad,[]);
}
for(const [model,r]of Object.entries(report.models))test('Kain '+model+' full-body hit/guard reaction keeps rigid palms, wrists and soles',()=>check(r));
test('reaction gates reject contact-only wrist sacrifice, floating palms, torso and ground penetration',()=>{
 const r=report.models.original;
 for(const bad of [{maxGap:.0125078},{maxWristBend:2.29},{minClearance:.101},{minSole:-.0864},{bad:[{gap:.002}]}])assert.throws(()=>check({...r,...bad}));
});
