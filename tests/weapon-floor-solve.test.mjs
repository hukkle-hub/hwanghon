import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {clearWeaponFloor} from '../tools/3d/weapon-floor-solve.mjs';
import fs from 'node:fs';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makePoser} from '../tools/3d/pose-eval.mjs';
test('armed support lifts coupled chain, preserving root and hand/weapon local grip',()=>{
 const root=new T.Group(),joint=new T.Bone(),hand=new T.Bone(),weapon=new T.Group();root.add(joint);joint.position.y=.3;joint.add(hand);hand.position.z=.2;hand.add(weapon);
 weapon.add(new T.Mesh(new T.BoxGeometry(.02,.02,.8).translate(0,0,.4)));joint.rotation.x=Math.PI/2;root.updateMatrixWorld(true);
 const local=weapon.matrix.clone(),handLocal=hand.matrix.clone(),rootLocal=root.matrix.clone();
 const r=clearWeaponFloor({joint,weapon});assert.ok(r.before<-.5);assert.ok(r.cleared&&r.after>=.015);assert.ok(r.angle>0&&r.angle<Math.PI/2);
 assert.deepEqual(weapon.matrix.elements,local.elements);assert.deepEqual(hand.matrix.elements,handLocal.elements);assert.deepEqual(root.matrix.elements,rootLocal.elements);
 assert.equal(clearWeaponFloor({joint,weapon}).angle,0);
 joint.rotation.x=Math.PI/2;const broken=clearWeaponFloor({joint,weapon,maxAngle:.01});assert.equal(broken.cleared,false);assert.ok(broken.after<0,'bounded negative control must still detect penetration');
 assert.throws(()=>clearWeaponFloor({joint:new T.Bone(),weapon}),/descend/);
});
test('armed recovery keeps all rigid weapon vertices above floor between authored frames',async()=>{
 const load=async name=>{const l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));const b=fs.readFileSync(new URL('../art/review/part1/'+name,import.meta.url));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
 const g=await load('park-armed-recovery-study.glb'),old=await load('park-mocap-leg-study.glb'),point=new T.Vector3(),meshes=[];
 g.scene.getObjectByName('ParkDanjoe').traverse(o=>{if(o.isMesh)meshes.push(o);});
 let skin;g.scene.traverse(o=>{if(o.isSkinnedMesh&&!skin)skin=o;});const attached=[];
 const si=skin.geometry.attributes.skinIndex,sw=skin.geometry.attributes.skinWeight;
 for(let i=0;i<si.count;i++){let w=0;for(let k=0;k<4;k++)if(['RForearm','RHand','RFingers'].includes(skin.skeleton.bones[si.getComponent(i,k)].name))w+=sw.getComponent(i,k);if(w>.9999)attached.push(i);}
 assert.ok(attached.length>100,'actual attached skin must be inspected');
 for(const clip of g.animations.slice(12)){
  const prev=old.animations.find(a=>a.name===clip.name);
  // Root, hip, fingers, hand and weapon locals must remain unchanged. Only
  // the entire forearm chain may move; root raising cannot fake clearance.
  for(const track of clip.tracks)if(track.name!=='RForearm.quaternion')assert.deepEqual(track.values,prev.tracks.find(t=>t.name===track.name).values,track.name);
  const pose=makePoser(g.scene,clip);for(let i=0;i<=Math.ceil(clip.duration*60);i++){
   const t=Math.min(clip.duration,i/60);pose(t);
   for(const m of meshes){const p=m.geometry.attributes.position;for(let k=0;k<p.count;k++){point.fromBufferAttribute(p,k).applyMatrix4(m.matrixWorld);assert.ok(point.y>=0,`${clip.name} ${t} ${m.name} y=${point.y}`);}}
   for(const i of attached){skin.getVertexPosition(i,point).applyMatrix4(skin.matrixWorld);assert.ok(point.y>=0,`${clip.name} ${t} attached skin ${i} y=${point.y}`);}
  }
 }
 const pose=makePoser(old.scene,old.animations.find(c=>c.name==='getup_back_park_mocap'));pose(2.5);
 const blade=old.scene.getObjectByName('DanjoeBlade');point.fromBufferAttribute(blade.geometry.attributes.position,3).applyMatrix4(blade.matrixWorld);
 assert.ok(point.y<-.5,'uncorrected asset negative control must retain known floor failure');
});
