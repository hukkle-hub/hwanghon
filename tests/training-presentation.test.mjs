import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {createTrainingParts} from '../js/training-presentation.js';
import {Animated} from '../js/party-avatar.js';
import {createFrameMetrics} from '../js/frame-metrics.js';
function rig(){const root=new T.Group();for(const name of ['Spine1','LeftArm','RightArm']){const bone=new T.Bone();bone.name='mixamorig:'+name;root.add(bone);}return root;}
test('training GLB exposes the bones required by the shared attachments',()=>{
 const bytes=fs.readFileSync('art/3d/boss_anim.glb');
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 for(const name of ['Spine1','LeftArm','RightArm'])
  assert.ok(json.nodes.some(n=>n.name?.replace(/^mixamorig:?/,'')===name),name);
});
test('same stage parts in solo and online, hidden until enabled and absent after break',()=>{
 const solo=createTrainingParts(rig()),online=createTrainingParts(rig());
 for(const stage of [[{id:'core'}],[{id:'shl'},{id:'shr'}],[{id:'chain'}],[{id:'chain',broken:true}]]){
  solo.sync(stage,{restore:true});online.sync(stage);
  for(const id of ['chain','shl','shr'])assert.equal(solo.parts[id].visible,online.parts[id].visible);
 }
 assert.equal(online.parts.chain.visible,false);
});
test('new phase restores a detached part to its original bone and transform',()=>{
 const model=rig(),view=createTrainingParts(model),piece=view.parts.shl,parent=piece.parent;
 const scene=new T.Scene();scene.add(model);scene.attach(piece);
 piece.position.set(8,9,10);piece.rotation.y=2;piece.scale.setScalar(.3);
 view.sync([{id:'shl'}],{restore:true});
 assert.equal(piece.parent,parent);assert.deepEqual(piece.position.toArray(),[0,0,0]);
 assert.deepEqual(piece.scale.toArray(),[1,1,1]);assert.equal(piece.rotation.y,0);
});
test('online attachment geometry/material ownership is tracked for disposal',()=>{
 const owned=new Set(),view=createTrainingParts(rig(),{owned});
 for(const part of Object.values(view.parts))part.traverse(o=>{if(o.isMesh){assert.ok(owned.has(o.geometry));assert.ok(owned.has(o.material));}});
 for(const resource of owned)resource.dispose();
});
test('online character enlargement never scales the training boss',()=>{
 const scene=new T.Scene(),asset={scene:new T.Group(),animations:[]};
 const boss=new Animated(asset,scene,false),player=new Animated(asset,scene,true);
 assert.equal(boss.model.scale.x,1);assert.equal(player.model.scale.x,1.14);
 boss.dispose(scene);player.dispose(scene);
});
test('frame metrics exclude warmup/inactive frames and report exact mean, tails and trends',()=>{
 const m=createFrameMetrics({warmup:2,windowMs:100});
 m.add(1000,false);m.add(16);m.add(16);m.add(16);
 for(let i=0;i<99;i++)m.add(10);m.add(110);
 const r=m.report();assert.equal(r.samples,100);assert.equal(r.fps,90.9);
 assert.equal(r.p95Ms,10);assert.equal(r.p99Ms,10);assert.equal(r.maxMs,110);
 assert.equal(r.over50ms,1);assert.ok(r.windows.length>0);
 const before=r.samples;m.add(NaN);m.add(-1);assert.equal(m.report().samples,before);
 r.windows[0].fps=-1;assert.notEqual(m.report().windows[0].fps,-1);
 m.add(1,false);m.add(20000);assert.equal(m.report().samples,before);
});
