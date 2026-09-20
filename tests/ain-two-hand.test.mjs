import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {repairAinBind,repairAinClips} from '../js/ain-bind-repair.js';
import {makeAinRigAdapter as makeAinTwoHand} from '../js/ain-two-hand.js';
async function asset(){const b=await readFile('art/3d/ain_anim.glb'),l=new GLTFLoader();l.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('Ain bind repair preserves rest mesh, source clips, UVs and shared geometry',async t=>{
 const g=await asset(),original=g.animations.map(c=>c.toJSON());let mesh;g.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
 const oldGeometry=mesh.geometry,oldWeights=oldGeometry.attributes.skinWeight.array.slice(),oldInverse=mesh.skeleton.boneInverses.map(m=>m.clone());
 const report=repairAinBind(g.scene);assert.ok(report.vertices>100);assert.ok(report.handVertices>50);
 assert.equal(mesh.geometry.morphAttributes.position.length,2);
 for(const morph of mesh.geometry.morphAttributes.position){let changed=0;for(let i=0;i<morph.count;i++){const delta=new T.Vector3().fromBufferAttribute(morph,i);assert.ok(delta.toArray().every(Number.isFinite));assert.ok(delta.length()<.12);if(delta.length()>1e-6)changed++;}assert.ok(changed>20,'grip shape has no distal hand vertices');}
 assert.notEqual(mesh.geometry,oldGeometry);assert.deepEqual(oldGeometry.attributes.skinWeight.array,oldWeights);
 assert.deepEqual(mesh.geometry.attributes.position.array,oldGeometry.attributes.position.array);assert.deepEqual(mesh.geometry.attributes.uv.array,oldGeometry.attributes.uv.array);
 assert.deepEqual(mesh.geometry.index.array,oldGeometry.index.array);assert.ok(mesh.geometry.index.count/3<=60000,'Android triangle budget');
 assert.ok(report.surfaceAdjustment<.015,'surface correction must remain local');
 const clips=repairAinClips(g.animations,report);assert.deepEqual(g.animations.map(c=>c.toJSON()),original);assert.equal(clips.length,g.animations.length);
 mesh.skeleton.update();let max=0;for(let i=0;i<mesh.geometry.attributes.position.count;i+=13){const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);max=Math.max(max,mesh.applyBoneTransform(i,p.clone()).distanceTo(p));}assert.ok(max<1e-5,`bind deformation ${max}`);
 assert.ok(mesh.skeleton.boneInverses.some((m,i)=>!m.equals(oldInverse[i])));
 t.diagnostic(`reweighted ${report.vertices} sleeve/hand vertices, ${report.handVertices} distal hand vertices; bind residual ${max}`);
 t.diagnostic(`triangles ${oldGeometry.index.count/3} -> ${mesh.geometry.index.count/3}`);
});
test('repaired Ain: two palm contacts, bounded wrists, fixed limb lengths and continuous swings',async t=>{
 const g=await asset(),root=new T.Group();root.add(g.scene);const report=repairAinBind(g.scene);g.animations=repairAinClips(g.animations,report);
 let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});const rig=makeAinTwoHand(g.scene,root,slot),mixer=new T.AnimationMixer(g.scene);
 let grip=0,step=0,peak='',wrist=0;
 const positions=new Map(Object.entries(rig.bones).filter(([n])=>/Arm$|Hand$/.test(n)).map(([n,b])=>[n,b.position.clone()]));
 for(const variant of ['idle','run','guard','attack1','attack2','attack3','smash','ult','skill1','skill2','skill3','skill4','counter','counterPerfect','exec','skill1Target','skill3Target','ultTarget']){
  const name=variant==='counterPerfect'?'counter':variant.replace('Target','');
  rig.restore();mixer.stopAllAction();const c=g.animations.find(x=>x.name===name),act=mixer.clipAction(c);act.setLoop(T.LoopOnce,1).play();act.paused=true;const previous={};
  for(let i=0;i<=240;i++){
   rig.restore();act.time=c.duration*i/240;mixer.update(0);
   const a=/attack|smash|ult|skill|counter|exec/.test(name)?{id:name,clip:name,kind:'attack',elapsed:c.duration*i/240,duration:c.duration,hitAt:c.duration*.42}:null;
   if(a)a.opt={perfect:variant==='counterPerfect'};
   const target=variant.endsWith('Target')?new T.Vector3(.11+.05*Math.sin(i/30),2.58+.04*Math.sin(i/24),.58+.08*Math.cos(i/30)):null;
   rig.apply(a,name==='run',name==='guard',c.duration/240,name,target);grip=Math.max(grip,rig.diagnostics.gripError);
   assert.ok(rig.diagnostics.rightGripError<.001);
   for(const side of ['Left','Right']){
    const hand=rig.bones[side+'Hand'];
    const shaft=new T.Vector3(0,1,0).applyQuaternion(slot.getWorldQuaternion(new T.Quaternion()));
    const across=new T.Vector3(0,0,1).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()));
    assert.ok(Math.abs(across.dot(shaft))>.9999,'actual finger-spread axis must align with shaft');
    const forearm=hand.getWorldPosition(new T.Vector3()).sub(hand.parent.getWorldPosition(new T.Vector3())).normalize();
    const fingers=new T.Vector3(0,1,0).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion()));
    wrist=Math.max(wrist,forearm.angleTo(fingers));
   }
   for(const n of ['LeftArm','LeftForeArm','RightArm','RightForeArm','LeftHand','RightHand']){const b=rig.bones[n];assert.ok(b.matrixWorld.elements.every(Number.isFinite));assert.ok(b.position.distanceTo(positions.get(n))<1e-6,'joint length changed: '+n);if(previous[n]){const jump=previous[n].angleTo(b.quaternion);if(jump>step){step=jump;peak=`${name} ${n} sample ${i}/240`;}}previous[n]=b.quaternion.clone();}
  }
 }
 t.diagnostic(`maximum palm residual ${(grip*1000).toFixed(4)} mm; maximum adjacent joint step ${T.MathUtils.radToDeg(step).toFixed(3)} degrees at ${peak}`);
 t.diagnostic(`maximum wrist direction bend ${T.MathUtils.radToDeg(wrist).toFixed(2)} degrees`);
 assert.ok(wrist<T.MathUtils.degToRad(15),'wrist hyperextension regression');
 assert.ok(grip<.003,`palm slip ${grip}m`);assert.ok(step<T.MathUtils.degToRad(8),`joint spike ${T.MathUtils.radToDeg(step)}`);
});
test('scaled, translated and yawed game avatar keeps both contacts; death remains authored',async()=>{
 const g=await asset(),root=new T.Group();root.position.set(4,0,-7);root.rotation.y=1.2;g.scene.scale.setScalar(1.14);root.add(g.scene);
 const report=repairAinBind(g.scene),clips=repairAinClips(g.animations,report);let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});
 const rig=makeAinTwoHand(g.scene,root,slot),mixer=new T.AnimationMixer(g.scene),c=clips.find(c=>c.name==='attack1'),a=mixer.clipAction(c);a.play();a.paused=true;
 for(let i=0;i<120;i++){rig.restore();a.time=c.duration*i/120;mixer.update(0);rig.apply({id:1,clip:'attack1',kind:'attack',elapsed:i/120,duration:1,hitAt:.42},true,false,1/120,'attack1');assert.ok(rig.diagnostics.gripError<.003);}
 const lastCombat=rig.bones.LeftArm.quaternion.clone();
 rig.restore();mixer.stopAllAction();const death=mixer.clipAction(clips.find(c=>c.name==='death'));death.play();death.paused=true;death.time=.3;mixer.update(0);
 const before=rig.bones.LeftArm.quaternion.clone();
 rig.apply(null,false,false,.001,'death');assert.ok(lastCombat.angleTo(rig.bones.LeftArm.quaternion)<.001,'release must begin at previous pose, not snap to death');
 for(let i=0;i<10;i++){rig.restore();mixer.update(0);rig.apply(null,false,false,.016,'death');}
 assert.ok(before.angleTo(rig.bones.LeftArm.quaternion)<.001,'authored death must resume after the release blend');
});
