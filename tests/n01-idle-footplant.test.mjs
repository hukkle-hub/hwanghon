import test from 'node:test';import assert from 'node:assert/strict';
import {measureIdlePlant,assertIdlePlant} from '../tools/monsters/measure-idle-plant.mjs';
const root=process.env.N01_PLANT_CANDIDATES?new URL('../../../output/monster-bodies-v11/',import.meta.url):new URL('../art/3d/monsters/n01-candidates/',import.meta.url);
const file=(k,suffix)=>new URL((process.env.N01_PLANT_CANDIDATES?k+'-idle-plant-v1/':'')+'g5_'+k+suffix+'.glb',root);
test('all six high/mobile idle clips plant actual skinned soles within1mm without floor penetration',async()=>{
 for(const k of ['walker','runner','breaker','stalker','armored','resonator'])for(const suffix of ['','_mobile']){const result=await measureIdlePlant(file(k,suffix));const expectedSeconds=!process.env.N01_PLANT_CANDIDATES?({walker:2.5,runner:88/30}[k]||4):4;assert(Math.abs(result.duration-expectedSeconds)<1e-5,k+suffix+' idle duration');assert.equal(result.frames,Math.round(expectedSeconds*30)+1);assert.equal(assertIdlePlant(result),true,k+suffix);}
});
test('idle sole guard rejects deliberate3cm last-frame drift (negative control)',async()=>{
 const result=await measureIdlePlant(file('walker','_mobile'),{injectEndDrift:.03});assert.throws(()=>assertIdlePlant(result),/foot drift/);
});
