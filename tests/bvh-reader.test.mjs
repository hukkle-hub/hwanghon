import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {readBVH} from '../tools/3d/read-bvh.mjs';
const source=`HIERARCHY ROOT base { OFFSET 0 0 0 CHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation JOINT tip { OFFSET 1 0 0 CHANNELS 3 Zrotation Yrotation Xrotation End Site { OFFSET 1 0 0 } } } MOTION Frames: 2 Frame Time: 1 0 1 0 0 0 0 0 0 0 0 1 0 90 0 0 0 0 0`;
test('BVH evaluates declared channels, parent space and interpolation',()=>{
 const b=readBVH(source),v=new T.Vector3();b.pose(1);assert.ok(b.byName.tip.getWorldPosition(v).distanceTo(new T.Vector3(0,2,0))<1e-6);
 b.pose(.5);assert.ok(b.byName.tip.getWorldPosition(v).distanceTo(new T.Vector3(Math.SQRT1_2,1+Math.SQRT1_2,0))<1e-6);
 b.pose(1);b.pose(1);assert.ok(b.byName.tip.getWorldPosition(v).distanceTo(new T.Vector3(0,2,0))<1e-6,'held samples reapply the pose');
 assert.throws(()=>readBVH(source.replace('Frames: 2','Frames: 3')));assert.throws(()=>readBVH(source.replace('90','NaN')));
 const wrong=readBVH(source.replaceAll('Zrotation Yrotation Xrotation','Xrotation Yrotation Zrotation'));wrong.pose(1);assert.throws(()=>assert.ok(wrong.byName.tip.getWorldPosition(v).distanceTo(new T.Vector3(0,2,0))<1e-6),'channel-order negative control');
});
test('existing local getup and duck sources remain finite without time compression',()=>{
 for(const name of ['mo_getup_back','mo_getup_face','mo_duck']){
  const b=readBVH(fs.readFileSync(new URL('../art/3d/mocap/'+name+'.bvh',import.meta.url),'utf8'));
  assert.ok(b.duration>1);for(let t=0;t<=b.duration;t+=.1){b.pose(t);for(const n of b.nodes)assert.ok(n.bone.matrixWorld.elements.every(Number.isFinite));}
 }
});
