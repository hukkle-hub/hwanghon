import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bossDeathTiming} from '../js/mmo/boss-death-timing.js';
test('short legacy deaths retain their original pacing and removal time',()=>{
 const t=bossDeathTiming(2.1);assert.equal(t.speed,.7);assert.ok(Math.abs(t.sinkAt-3.8)<1e-8);assert.ok(Math.abs(t.finishAt-4.9)<1e-8);
});
test('long deaths finish before sinking, removal or unlocking the shot',()=>{
 for(const d of [3.1,5.2,8,12]){const t=bossDeathTiming(d);assert.equal(t.speed,1);assert.ok(t.sinkAt>d);assert.ok(t.finishAt>t.sinkAt+.9);assert.ok(t.shotDuration>d);assert.ok(t.cardAt>=d*.85);}
});
test('missing or invalid animation duration has finite legacy fallback',()=>{
 for(const d of [undefined,null,NaN,Infinity,-1,0]){const t=bossDeathTiming(d);assert.ok(Object.values(t).every(Number.isFinite));assert.equal(t.motion,0);}
});
test('negative check: deliberately restoring the old fixed sink fails the long-death invariant',async()=>{
 const source=fs.readFileSync('js/mmo/boss-death-timing.js','utf8');
 const broken=source.replace('Math.max(3.8, motion + .25)','3.8');assert.notEqual(source,broken);
 const mutant=await import('data:text/javascript;base64,'+Buffer.from(broken).toString('base64'));
 const t=mutant.bossDeathTiming(5.2);assert.throws(()=>assert.ok(t.sinkAt>t.motion));
});
