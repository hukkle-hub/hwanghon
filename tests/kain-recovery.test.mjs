import test from 'node:test';import assert from 'node:assert/strict';
import {report} from '../tools/3d/audit-kain-recovery.mjs';
test('Kain six recoveries retain the rigid grip without the old 25+ rad/s arm snap',()=>{
 const accept=r=>assert.ok(r.maxArmRate<12&&r.gripGap<.001,'recovery snap or detached support hand');
 for(const r of Object.values(report))accept(r);
 assert.throws(()=>accept({maxArmRate:25,gripGap:0}));
});
