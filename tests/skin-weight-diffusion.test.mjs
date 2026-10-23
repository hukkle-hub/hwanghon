import test from 'node:test';
import assert from 'node:assert/strict';
import {diffuseWeights} from '../tools/3d/skin-weight-diffusion.mjs';
const points=[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[1,0,0]];
const triangles=[0,1,2,4,3,2],weights=[[[0,1]],[[0,1]],[[1,1]],[[1,1]],[[1,1]]];
test('UV-split copies share solved weights while pinned vertices stay fixed',()=>{
 const input=JSON.stringify({points,triangles,weights});
 const out=diffuseWeights(points,triangles,weights,[0,1,1,0,1],24);
 assert.deepEqual(out[1],out[4]);assert.deepEqual(out[0],weights[0]);assert.deepEqual(out[3],weights[3]);
 assert.ok(out[1].some(([j,w])=>j===1&&w>0&&w<1));
 for(const list of out){assert.ok(list.length<=4);assert.ok(Math.abs(list.reduce((s,[,w])=>s+w,0)-1)<1e-8);}
 assert.equal(JSON.stringify({points,triangles,weights}),input);
 assert.throws(()=>assert.deepEqual(weights[1],weights[4]),'unrepaired seam negative control');
});
test('invalid influence/triangle/mask data are rejected instead of producing NaN skinning',()=>{
 assert.throws(()=>diffuseWeights(points,triangles,weights,[1]));
 assert.throws(()=>diffuseWeights(points,[99,1,2],weights,[1,1,1,1,1]));
 assert.throws(()=>diffuseWeights(points,triangles,weights,[1,1,1,NaN,1]));
 assert.throws(()=>diffuseWeights(points,triangles,weights.map(()=>[[0,NaN]]),[1,1,1,1,1]));
 assert.throws(()=>diffuseWeights(points,triangles,weights,[1,1,1,1,1],201));
});
