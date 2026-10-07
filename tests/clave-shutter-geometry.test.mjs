import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import {brokenShutterGeometry,prepareBossMotion} from '../js/mmo/boss-motion.js';
import C from '../server/field-boss-combat.cjs';

test('정지 클립의 추가 팔 회전은 다음 mixer 전에 원복되어 누적되지 않는다',()=>{
 const bone=new THREE.Bone(),base=bone.quaternion.clone(),pose={bone,base,dirty:false},o={fx:{overlayPose:[pose]}};
 for(let i=0;i<200;i++){
  bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.02));pose.dirty=true;
  prepareBossMotion(o);assert.ok(bone.quaternion.angleTo(base)<1e-7);assert.equal(pose.dirty,false);
 }
});

test('셔터 파괴는 원본을 보존하며 실제 삼각형 약 45%를 제거한다',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(.6,2.5,.5,6,20,6));
 const original=Array.from(mesh.geometry.index.array),broken=brokenShutterGeometry(mesh);
 assert.ok(broken.index.count>original.length*.35&&broken.index.count<original.length*.72);
 assert.deepEqual(Array.from(mesh.geometry.index.array),original);
 assert.ok(broken.index.count%3===0);
 assert.equal(brokenShutterGeometry(null),null);
 broken.dispose();mesh.geometry.dispose();mesh.material.dispose();
});

test('배포 GLB는 몸과 셔터를 나누고 전용 공격 클립·동일 스킨을 유지한다',()=>{
 const b=fs.readFileSync(new URL('../art/3d/part1/clave.glb',import.meta.url));
 const doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 const held=doc.nodes.find(n=>n.name==='Boss_HeldPart'),body=doc.nodes.find(n=>n.name==='Boss_Mesh');
 assert.ok(held&&body);assert.equal(held.skin,body.skin);assert.notEqual(held.mesh,body.mesh);
 const names=doc.animations.map(a=>a.name);
 for(const name of ['idle','walk','atk_claveshut','atk_clavestorm','atk_slam','stagger'])assert.ok(names.includes(name),name);
 const count=n=>doc.accessors[doc.meshes[n.mesh].primitives[0].indices].count;
 assert.equal(count(held)+count(body),59999*3,'삼각형 손실·중복 없음');
 assert.ok(count(held)>count(body)*.2&&count(held)<count(body)*.5);
 const primitive=doc.meshes[held.mesh].primitives[0],a=doc.accessors[primitive.attributes.POSITION],v=doc.bufferViews[a.bufferView];
 const start=28+b.readUInt32LE(12)+v.byteOffset+(a.byteOffset||0);
 let meanX=0;for(let i=0;i<a.count;i++)meanX+=b.readFloatLE(start+i*12);meanX/=a.count;
 assert.ok(meanX>0,'실제 셔터는 모델 +X 측면에 있다');
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const boss={yaw,x:0,z:0},left={x:2*Math.cos(yaw),z:-2*Math.sin(yaw)},right={x:-left.x,z:-left.z};
  assert.equal(C.shutterExposure(boss,left),C.SHUTTER.left,'약점은 셔터와 같이 회전한다');
  assert.equal(C.shutterExposure(boss,right),C.SHUTTER.otherSide);
 }
});
