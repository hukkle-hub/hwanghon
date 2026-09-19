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
 assert.notEqual(mesh.geometry,oldGeometry);assert.deepEqual(oldGeometry.attributes.skinWeight.array,oldWeights);assert.deepEqual(mesh.geometry.attributes.position.array,oldGeometry.attributes.position.array);assert.deepEqual(mesh.geometry.attributes.uv.array,oldGeometry.attributes.uv.array);
 const clips=repairAinClips(g.animations,report);assert.deepEqual(g.animations.map(c=>c.toJSON()),original);assert.equal(clips.length,g.animations.length);
 mesh.skeleton.update();let max=0;for(let i=0;i<mesh.geometry.attributes.position.count;i+=13){const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);max=Math.max(max,mesh.applyBoneTransform(i,p.clone()).distanceTo(p));}assert.ok(max<1e-5,`bind deformation ${max}`);
 assert.ok(mesh.skeleton.boneInverses.some((m,i)=>!m.equals(oldInverse[i])));
 t.diagnostic(`reweighted ${report.vertices} sleeve/hand vertices, ${report.handVertices} distal hand vertices; bind residual ${max}`);
});
test('repaired Ain: two palm contacts, neutral wrists, fixed limb lengths and continuous swings',async t=>{
 const g=await asset(),root=new T.Group();root.add(g.scene);const report=repairAinBind(g.scene);g.animations=repairAinClips(g.animations,report);
 let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});const rig=makeAinTwoHand(g.scene,root,slot),mixer=new T.AnimationMixer(g.scene);
 let grip=0,step=0;
 const positions=new Map(Object.entries(rig.bones).filter(([n])=>/Arm$|Hand$/.test(n)).map(([n,b])=>[n,b.position.clone()]));
 for(const name of ['idle','run','guard','attack1','attack2','attack3','smash','ult']){
  rig.restore();mixer.stopAllAction();const c=g.animations.find(x=>x.name===name),act=mixer.clipAction(c);act.setLoop(T.LoopOnce,1).play();act.paused=true;const previous={};
  for(let i=0;i<=240;i++){
   rig.restore();act.time=c.duration*i/240;mixer.update(0);
   const a=/attack|smash|ult/.test(name)?{id:name,clip:name,kind:'attack',elapsed:c.duration*i/240,duration:c.duration,hitAt:c.duration*.42}:null;
   rig.apply(a,name==='run',name==='guard',c.duration/240,name);grip=Math.max(grip,rig.diagnostics.gripError);
   assert.ok(rig.diagnostics.rightGripError<.001);
   for(const n of ['LeftArm','LeftForeArm','RightArm','RightForeArm','LeftHand','RightHand']){const b=rig.bones[n];assert.ok(b.matrixWorld.elements.every(Number.isFinite));assert.ok(b.position.distanceTo(positions.get(n))<1e-6,'joint length changed: '+n);if(previous[n])step=Math.max(step,previous[n].angleTo(b.quaternion));previous[n]=b.quaternion.clone();}
  }
 }
 t.diagnostic(`maximum palm residual ${(grip*1000).toFixed(4)} mm; maximum adjacent joint step ${T.MathUtils.radToDeg(step).toFixed(3)} degrees at 241 samples/clip`);
 assert.ok(grip<.003,`palm slip ${grip}m`);assert.ok(step<T.MathUtils.degToRad(12),`joint spike ${T.MathUtils.radToDeg(step)}`);
});
test('scaled, translated and yawed game avatar keeps both contacts; death remains authored',async()=>{
 const g=await asset(),root=new T.Group();root.position.set(4,0,-7);root.rotation.y=1.2;g.scene.scale.setScalar(1.14);root.add(g.scene);
 const report=repairAinBind(g.scene),clips=repairAinClips(g.animations,report);let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});
 const rig=makeAinTwoHand(g.scene,root,slot),mixer=new T.AnimationMixer(g.scene),c=clips.find(c=>c.name==='attack1'),a=mixer.clipAction(c);a.play();a.paused=true;
 for(let i=0;i<120;i++){rig.restore();a.time=c.duration*i/120;mixer.update(0);rig.apply({id:1,clip:'attack1',kind:'attack',elapsed:i/120,duration:1,hitAt:.42},true,false,1/120,'attack1');assert.ok(rig.diagnostics.gripError<.003);}
 rig.restore();mixer.stopAllAction();const death=mixer.clipAction(clips.find(c=>c.name==='death'));death.play();death.paused=true;death.time=.3;mixer.update(0);
 const before=rig.bones.LeftArm.quaternion.clone();rig.apply(null,false,false,.016,'death');assert.ok(before.angleTo(rig.bones.LeftArm.quaternion)<.001);
});
