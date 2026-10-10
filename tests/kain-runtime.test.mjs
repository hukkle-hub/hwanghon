import test from 'node:test';import assert from 'node:assert/strict';
import {report} from '../tools/3d/audit-kain-runtime.mjs';
function accept(r,lod){
 assert.ok(r.frames>0&&Number.isFinite(r.maxArmRate),'valid finite actual playback');
 assert.ok(r.maxArmRate<20,'actual arm snap '+r.peak);
 assert.ok(r.maxGripGap<.001&&r.maxRightGripGap<.001,'actual detached grip');
 assert.ok(r.maxWristBend<Math.PI/6,'actual bent wrist');
 assert.ok(r.minUpperClearance>.18&&r.minForeClearance>.18,'actual torso penetration');
 assert.ok(r.maxCollapsedFraction<.006&&r.maxStretchedFraction<(lod==='mobile'?.015:.018),'actual pooled skin');
 assert.ok(r.maxSeamCollapse<.01&&r.maxSeamStretch<.025,'actual shoulder seam');
 assert.ok(r.maxBodyTrackError<.005&&r.maxSourceArmError<.005,'source drift after transition');
 assert.ok(r.visibleBufferReused&&!r.transitionAliased&&r.transitionSnapshotMutations===0,'pose buffer alias/allocation regression');
 assert.ok(r.maxFootSink<.005,'actual skinned boots below floor');
}
test('Kain actual game update: 60 Hz actions, carry, guard, roll and cancelled skill retain skin and rigid sword',()=>{
 for(const[lod,rows]of Object.entries(report.models))for(const[name,r]of Object.entries(rows))assert.doesNotThrow(()=>accept(r,lod),lod+' '+name);
});
test('Kain runtime gate rejects measured old run/guard gaps and cancelled skill snaps',()=>{
 const good=report.models.original['run-23'];assert.ok(good);
 // Measurements from runtime-candidate8-valid-clock and candidate9 audits.
 for(const bad of [{...good,maxGripGap:1.18},{...good,maxGripGap:.83},{...good,maxArmRate:140},{...good,maxFootSink:.0583933748632985}])assert.throws(()=>accept(bad,'original'));
});
