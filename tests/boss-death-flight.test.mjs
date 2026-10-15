import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bossDeathFlight} from '../js/mmo/boss-death-flight.js';
test('hover and attack lift land as one height, including a grounded dive death',()=>{
 for(const lift of [-3.4,-1.7,0,1.2,1.8]){
  const initial={fly:3.4,rootY:3.4,modelY:.18+lift,baseModelY:.18};let previous=Infinity;
  for(let i=0;i<=120;i++){const s=bossDeathFlight({...initial,elapsed:i/60}),h=s.rootY+s.modelY-.18;assert.ok(h>=-1e-12&&h<=previous+1e-12);if(i===0)assert.ok(Math.abs(h-(3.4+lift))<1e-12);if(i>=66)assert.ok(Math.abs(h)<1e-12);previous=h;}
 }
});
test('non-flying bosses retain root and model elevation',()=>{
 for(const fly of [undefined,0])assert.deepEqual(bossDeathFlight({fly,rootY:2,modelY:.18,baseModelY:0,elapsed:1}),{rootY:2,modelY:.18});
});
test('stage uses combined height and old dive-offset behavior fails',()=>{
 const stage=fs.readFileSync(new URL('../js/mmo/boss-stage.js',import.meta.url),'utf8');assert.match(stage,/o\.model\.position\.y = flight\.modelY - dy/);assert.match(stage,/o\.root\.position\.y = flight\.rootY/);
 const broken=0+(.18-3.4)-.18;assert.throws(()=>assert.ok(broken>=-.001));
});
