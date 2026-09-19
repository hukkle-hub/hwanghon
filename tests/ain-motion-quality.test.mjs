import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {smoothArmClip} from '../js/ain-motion-quality.js';
import {solveArm} from '../js/ain-rig-review.js';

test('review smoothing preserves source, duration, non-arm tracks and endpoints',()=>{
 const qs=[0,1,-1,0].flatMap(a=>new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),a).toArray());
 const source=new T.AnimationClip('attack1',1,[new T.QuaternionKeyframeTrack('LeftArm.quaternion',[0,.33,.66,1],qs),new T.VectorKeyframeTrack('Hips.position',[0,1],[0,0,0,0,1,0])]);
 const before=JSON.stringify(source.toJSON()),result=smoothArmClip(source);
 assert.equal(JSON.stringify(source.toJSON()),before);assert.equal(result.duration,source.duration);
 assert.equal(smoothArmClip(source),result);assert.deepEqual(result.tracks[1].values,source.tracks[1].values);
 const t=result.tracks[0];assert.deepEqual([...t.values.slice(0,4)],qs.slice(0,4));assert.deepEqual([...t.values.slice(-4)],qs.slice(-4));
 for(let i=0;i<t.values.length;i+=4)assert.ok(Math.abs(new T.Quaternion().fromArray(t.values,i).length()-1)<1e-6);
});
test('review solver cannot rotate upper arm past 25 degrees or elbow past 55; bones never scale',()=>{
 for(const p of [[-2,0,0],[0,2,0],[0,0,0],[1,-2,1]]){
  const root=new T.Group(),upper=new T.Bone(),lower=new T.Bone(),end=new T.Bone();root.add(upper);upper.add(lower);lower.add(end);lower.position.y=.3;end.position.y=.3;root.updateMatrixWorld(true);
  solveArm(upper,lower,end,new T.Vector3(...p));
  assert.ok(upper.quaternion.angleTo(new T.Quaternion())<=T.MathUtils.degToRad(25)+1e-6);
  assert.ok(lower.quaternion.angleTo(new T.Quaternion())<=T.MathUtils.degToRad(55)+1e-6);
  assert.equal(lower.position.y,.3);assert.equal(end.position.y,.3);
  for(const b of [upper,lower,end])assert.deepEqual(b.scale.toArray(),[1,1,1]);
 }
});
