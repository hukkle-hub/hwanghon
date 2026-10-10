import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createCoupledPoseBridge} from '../js/coupled-pose-bridge.js';

function fixture(){const model=new T.Group(),bone=new T.Bone();model.add(bone);model.userData.heroSkillMotion={attack1:{coupledReady:true}};return {model,bone,bridge:createCoupledPoseBridge(model)};}
test('coupled pose bridge does not alter heroes without authored ready connections',()=>{
 assert.equal(createCoupledPoseBridge(new T.Group()),null);
 const model=new T.Group();model.userData.heroSkillMotion={attack1:{}};assert.equal(createCoupledPoseBridge(model),null);
});
test('coupled pose bridge starts from last visible pose, restores source and never aliases frozen transition',()=>{
 const {bone,bridge}=fixture();bridge.apply(1/60,'idle');bridge.capture();const reused=bridge.presentedPose;
 bone.position.x=10;bridge.apply(1/60,'attack');assert.ok(bone.position.x>0&&bone.position.x<.1);
 const frozen=bridge.transition.pose;assert.notEqual(frozen,bridge.presentedPose);assert.equal(frozen[0][1].x,0);
 bridge.capture();assert.equal(bridge.presentedPose,reused);assert.equal(frozen[0][1].x,0);
 bridge.restore();assert.equal(bone.position.x,10);
 // Cancellation must start from what was displayed, not previous action's
 // unblended source, otherwise a short roll creates a large shoulder snap.
 const visible=bridge.presentedPose[0][1].x;bone.position.x=-10;bridge.apply(1/60,'roll');
 assert.equal(bridge.transition.pose[0][1].x,visible);assert.ok(Math.abs(bone.position.x-visible)<.1);
 for(let i=0;i<15;i++){bridge.capture();bridge.restore();bone.position.x=-10;bridge.apply(1/60,'roll');}
 assert.equal(bridge.transition,null);assert.equal(bone.position.x,-10);
});
