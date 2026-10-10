import test from 'node:test';import assert from 'node:assert/strict';
import {report} from '../tools/3d/audit-kain-transitions.mjs';
test('Kain original/mobile: ready, all 11 complete actions and recovery keep coupled grip without entry snaps',()=>{
 const accept=r=>{
  assert.ok(r.maxArmRate<20,'arm connection snap: '+r.peak);
  assert.ok(r.stages.recovery.maxArmRate<12,'recovery snap');
  // The strike itself is intentionally faster than ready/entry/recovery.
  // Separate clip-boundary discontinuity from legitimate mid-swing velocity.
  assert.ok(r.maxSwordRate<20&&r.maxSwordSpeed<10,'excessive rigid sword speed');
  for(const boundary of [r.actionBoundary,r.recoveryBoundary])assert.ok(boundary.maxArmRate<12&&boundary.maxSwordRate<12&&boundary.maxSwordSpeed<6,'rigid sword connection snap');
  assert.ok(r.gripGap<.001&&r.rightGripGap<.001,'detached hand');
 };
 for(const clips of Object.values(report.models)){assert.equal(Object.keys(clips).length,11);for(const row of Object.values(clips))accept(row);}
 // Measured deployed 1e190a4 skill1 baseline, complete identical 60 Hz sequence.
 // Isolated skill contact tests had passed this actual broken connection.
 const current=report.models.original.skill1;
 assert.throws(()=>accept({...current,maxArmRate:121.82503693496277,maxSwordRate:90.07267338487283,maxSwordSpeed:21.358660962322876,peak:'RightArm action@0.000'}));
 assert.throws(()=>accept({...current,gripGap:.2}));
});
