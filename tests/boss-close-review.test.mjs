import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {collectBosses,createReviewPoser,surfaceBounds,fitDistance,hitFrames,skillClipTime} from '../tools/3d/boss-close-review.mjs';
import {ZONES} from '../js/mmo/zones.js';
import FM from '../server/field-monsters.cjs';
test('close review covers zone bosses and never substitutes missing bodies',()=>{
 const rows=collectBosses(ZONES,FM.FIELD_MONSTERS);for(const id of ['clave','clave2','shadowfang','subject09','jeong','leviathan','aegis','celestial2','arsenal','nova','dropper','park',...Object.keys(FM.FIELD_MONSTERS)])assert.ok(rows.some(b=>b.id===id),id);
 assert.equal(rows.length,17);
 assert.equal(rows.find(b=>b.id==='dropper').model,null);assert.equal(rows.find(b=>b.id==='park').model,null);
 assert.equal(new Set(rows.map(b=>b.id)).size,rows.length);
});
test('seeking restores unkeyed joints and computes actual skinned bounds',()=>{
 const root=new T.Group(),bone=new T.Bone();bone.name='arm';root.add(bone);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Array(12).fill(0),4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
 const mesh=new T.SkinnedMesh(geo,new T.MeshBasicMaterial());root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton([bone]));
 const move=new T.AnimationClip('move',1,[new T.VectorKeyframeTrack('arm.position',[0,1],[0,0,0,0,3,0])]),idle=new T.AnimationClip('idle',1,[]),pose=createReviewPoser(root,[move,idle]);
 pose('move',1);assert.equal(surfaceBounds(root).min.y,3);assert.equal(mesh.boundingBox.max.y,4);
 pose('idle',0);assert.equal(surfaceBounds(root).min.y,0);assert.equal(bone.position.y,0);
 pose('move',1);pose('move',1);assert.equal(surfaceBounds(root).min.y,3);
});
test('portrait fit honors narrow axis and hit review is 30fps exact',()=>{
 assert.ok(fitDistance(1,35,.45)>fitDistance(1,35,2));assert.throws(()=>fitDistance(1,35,0));
 const times=hitFrames({hits:[{at:650},{at:1200}]});assert.equal(times.length,6);assert.equal(times[1].time,.65);assert.ok(Math.abs(times[1].time-times[0].time-1/30)<1e-8);
 assert.deepEqual(hitFrames(null),[]);
 const skill={hits:[{at:1000}],cue:[[0,0],[500,.2],[1000,.2],[2000,1]]};assert.equal(skillClipTime(skill,1000,4),.8);assert.equal(hitFrames(skill,4)[1].time,.8);assert.notEqual(hitFrames(skill,4)[1].time,1);
});
