import test from 'node:test';import assert from 'node:assert/strict';
import {measureCoatSkin,assertCoatSkin} from '../tools/monsters/measure-coat-skin.mjs';
const file=suffix=>new URL('../art/3d/monsters/n01-candidates/g5_stalker'+suffix+'.glb',import.meta.url);
// Regression ceilings for this approved local skin correction, not a visual
// quality guarantee. Head/hands/geometry/motion preservation is checked separately.
const back={idle:2.5,walk:3.8,tracking_strike:2.5,hit:7.2,die:6.3};
test('Stalker high/mobile: all native clip frames avoid former shoulder skin spikes',async()=>{
 for(const suffix of ['','_mobile']){const r=await measureCoatSkin(file(suffix));assert.equal(r.clips.idle.frames,121);assert.equal(r.clips.die.frames,61);assert.equal(assertCoatSkin(r,back),true);}
});
test('Stalker full upper garment remains below measured local regression ceilings',async()=>{
 for(const suffix of ['','_mobile'])assert.equal(assertCoatSkin(await measureCoatSkin(file(suffix),{region:'upper'}),{idle:3,walk:4.2,tracking_strike:4.5,hit:8.5,die:7.6}),true);
});
test('Coat skin guard rejects deliberate one-meter last-frame vertex spike',async()=>{
 const r=await measureCoatSkin(file('_mobile'),{injectLastFrameSpike:1});assert.throws(()=>assertCoatSkin(r,back),/skin spike/);
});
