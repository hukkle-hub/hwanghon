import test from 'node:test';import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {aimScytheBlade,AIN_SKILL_PATHS} from '../js/ain-two-hand.js';
test('scythe blade projects forward, shaft remains unchanged, no broadside strike',()=>{
 const v=(...x)=>new T.Vector3(...x),forward=v(0,0,1);
 for(const keys of Object.values(AIN_SKILL_PATHS))for(const [,p]of keys){
  const axis=v(...p.slice(3)).normalize(),q=aimScytheBlade(axis),blade=v(-1,0,0).applyQuaternion(q),normal=v(0,0,1).applyQuaternion(q);
  assert.ok(v(0,1,0).applyQuaternion(q).distanceTo(axis)<1e-6);
  assert.ok(blade.dot(forward)>.65,'blade must point ahead, not down/behind');
  assert.ok(Math.abs(normal.dot(forward))<1e-6,'forward motion must be in blade plane');
 }
 const axis=v(-.98,.05,.18).normalize(),old=new T.Quaternion().setFromUnitVectors(v(0,1,0),axis);
 assert.ok(v(-1,0,0).applyQuaternion(old).dot(forward)<.3,'negative control: old shaft-only orientation');
 assert.throws(()=>aimScytheBlade(forward),/singularity/);
});
