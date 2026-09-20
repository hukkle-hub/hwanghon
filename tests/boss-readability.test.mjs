import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createBossReadability} from '../js/boss-motion.js';
import {createTrainingParts} from '../js/training-presentation.js';
function fixture(){const model=new T.Group(),bones={};for(const n of ['Spine','Spine1','Spine2','LeftArm','RightArm']){const b=new T.Bone();b.name='mixamorig:'+n;model.add(b);bones[n]=b;}return {model,bones};}
test('three tells have distinct silhouettes, return to authored contact and never accumulate',()=>{
 const {model,bones}=fixture(),view=createBossReadability(model),poses=[];
 for(const patIcon of ['hammer','bolt','scythe']){const s={state:'telegraph',patIcon,windup:.4};view.restore();view.apply(s);const q=bones.Spine.quaternion.clone();poses.push(Object.values(bones).flatMap(b=>b.quaternion.toArray()));for(let i=0;i<100;i++){view.restore();view.apply(s);assert.ok(q.angleTo(bones.Spine.quaternion)<1e-7);}view.restore();view.apply({...s,windup:1});for(const b of Object.values(bones))assert.ok(b.quaternion.angleTo(new T.Quaternion())<1e-7);}
 assert.notDeepEqual(poses[0],poses[1]);assert.notDeepEqual(poses[1],poses[2]);
});
test('broken shoulder droops at rest; phase reset restores it and exposed core only lights after both guards break',()=>{
 const {model,bones}=fixture(),view=createBossReadability(model),parts=createTrainingParts(model);
 view.apply({state:'idle',parts:[{id:'shl',broken:true}]});assert.ok(bones.LeftArm.quaternion.angleTo(new T.Quaternion())>.2);
 view.restore();view.apply({state:'idle',parts:[{id:'shl',broken:false}]});assert.equal(bones.LeftArm.quaternion.angleTo(new T.Quaternion()),0);
 const stage=[{id:'core',weak:true,guardedBy:['shl','shr']},{id:'shl',broken:true},{id:'shr',broken:false}];parts.sync(stage);assert.equal(parts.core.visible,false);stage[2].broken=true;parts.sync(stage);assert.equal(parts.core.visible,true);parts.sync([],{restore:true});assert.equal(parts.core.visible,false);
});
