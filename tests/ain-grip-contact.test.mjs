import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import * as T from '../vendor/three/three.module.js';import{GLTFLoader}from'../vendor/three/GLTFLoader.js';
import{repairAinBind,repairAinClips}from'../js/ain-bind-repair.js';import{ainGripCenter}from'../js/ain-grip-shape.js';
import{measureAinScythe,mountAinScythe}from'../js/ain-scythe-mount.js';import{makeAinRigAdapter}from'../js/ain-two-hand.js';
import{Animated}from'../js/party-avatar.js';
async function load(name){const b=await readFile('art/3d/'+name+'.glb'),loader=new GLTFLoader();loader.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('online repairs materials and pose before mixer without mutating cached assets',async()=>{
 const asset=await load('ain_anim'),weapon=await load('ain_scythe_tex'),scene=new T.Scene();
 const original=asset.animations.map(c=>c.toJSON());let source;asset.scene.traverse(o=>{if(o.isSkinnedMesh)source=o;});
 const normals=source.geometry.attributes.normal.array.slice();
 assert.equal(source.material.metalness,1,'negative control: source still has the bad material');
 const first=new Animated(asset,scene,true,false,weapon,'ain'),second=new Animated(asset,scene,true,false,weapon,'ain');
 try{
  let a,b;first.model.traverse(o=>{if(o.isSkinnedMesh)a=o;});second.model.traverse(o=>{if(o.isSkinnedMesh)b=o;});
  assert.equal(a.material.metalness,0);assert.equal(b.material.metalness,0);
  assert.notEqual(a.material,b.material);assert.notEqual(a.geometry,b.geometry);
  assert.equal(source.material.metalness,1);assert.deepEqual(source.geometry.attributes.normal.array,normals);
  assert.deepEqual(asset.animations.map(c=>c.toJSON()),original);
  for(const name of ['idle','run']){
   first.mixer.stopAllAction();first.mixer.clipAction(first.clips[name]).reset().play();first.mixer.setTime(0);first.model.updateMatrixWorld(true);
   assert.ok(first.rig.bones.RightHand.getWorldPosition(new T.Vector3()).x<0,name+' repaired before mixer');
  }
  let disposed=false;b.material.addEventListener('dispose',()=>{disposed=true;});first.dispose(scene);
  assert.equal(disposed,false,'disposing one player must not dispose another player material');
 }finally{if(first.root.parent)first.dispose(scene);second.dispose(scene);}
});
test('online Ain clones retain calibrated grip without altering the shared source',async()=>{
 const asset=await load('ain_anim'),weapon=await load('ain_scythe_tex'),scene=new T.Scene(),sourcePosition=weapon.scene.position.clone();
 const avatars=[new Animated(asset,scene,true,false,weapon,'ain'),new Animated(asset,scene,true,false,weapon,'ain')];
 try{for(const avatar of avatars){for(let i=0;i<20;i++)avatar.update({x:100,y:50,aim:.8,hp:100,moving:false,guard:false,rollT:0},1/60,0);assert.ok(avatar.rig.diagnostics.gripError<.003);let calibrated;avatar.weapon.traverse(o=>{if(o.name==='AinScytheCalibrated')calibrated=o;});assert.ok(calibrated);assert.ok(avatar.model.userData.ainBindRepair.grips[0].morphTargetInfluences[1]===1);}assert.ok(weapon.scene.position.equals(sourcePosition));assert.equal(weapon.scene.parent,null);assert.notEqual(avatars[0].model.userData.ainBindRepair.grips[0].geometry,avatars[1].model.userData.ainBindRepair.grips[0].geometry);}
 finally{avatars.forEach(a=>a.dispose(scene));}
});
function triangleRadius(points,center){
 const a=points.map(p=>new T.Vector2(p.x-center.x,p.y-center.y)),cross=(u,v)=>u.x*v.y-u.y*v.x;
 const signs=a.map((p,i)=>cross(a[(i+1)%3].clone().sub(p),p.clone().negate()));
 if(signs.every(v=>v>1e-12)||signs.every(v=>v< -1e-12))return 0;
 return Math.min(...a.map((p,i)=>{const d=a[(i+1)%3].clone().sub(p),t=d.lengthSq()?T.MathUtils.clamp(-p.dot(d)/d.lengthSq(),0,1):0;return p.clone().addScaledVector(d,t).length();}));
}
test('actual scythe handle is calibrated, not assumed to lie on the source Y axis',async t=>{
 const g=await load('ain_scythe_tex'),measurement=measureAinScythe(g.scene),positions=[];g.scene.traverse(o=>{if(o.isMesh)positions.push([o.geometry,o.geometry.attributes.position.array.slice()]);});
 assert.ok(measurement.anchor.x>.06,'negative control: obsolete mount must visibly miss the hand');
 const mount=mountAinScythe(g.scene);mount.updateMatrixWorld(true);
 assert.ok(measurement.anchor.clone().add(mount.children[0].position).applyQuaternion(mount.quaternion).length()<1e-8);
 assert.ok(measurement.axis.clone().applyQuaternion(mount.quaternion).distanceTo(new T.Vector3(0,1,0))<1e-8);
 assert.ok(measurement.residual<.001);
 for(const [geometry,original]of positions)assert.deepEqual(geometry.attributes.position.array,original);
 t.diagnostic(`source right-grip lateral offset ${(measurement.anchor.x*1000).toFixed(2)} mm; calibrated centreline residual ${(measurement.residual*1000).toFixed(3)} mm`);
});
test('closed hand triangles clear the shaft, thumb opposes, source topology stays under 60k',async t=>{
 const g=await load('ain_anim');repairAinBind(g.scene);let mesh;g.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
 const geo=mesh.geometry,p=geo.attributes.position,idx=geo.index;assert.ok(idx.count/3<=60000);
 for(const [m,side]of ['Left','Right'].entries()){
  const morph=geo.morphAttributes.position[m],j=mesh.skeleton.bones.findIndex(b=>b.name.endsWith(side+'Hand')),inverse=mesh.skeleton.boneInverses[j],center=ainGripCenter(side);
  const point=i=>new T.Vector3().fromBufferAttribute(p,i).add(new T.Vector3().fromBufferAttribute(morph,i)).applyMatrix4(inverse);
  let minimum=Infinity,faces=0,thumb=0;const angles=[];
  for(let i=0;i<p.count;i++){
   if(new T.Vector3().fromBufferAttribute(morph,i).length()<1e-6)continue;
   const original=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(inverse),v=point(i);
   if(original.y>.06&&original.z<-.032){thumb++;assert.ok(Math.hypot(v.x-center.x,v.y-center.y)<.030,'thumb remains extended');}
   if(original.y>.06&&original.z>-.02)angles.push(Math.atan2(v.y-center.y,(side==='Left'?1:-1)*(v.x-center.x)));
  }
  for(let i=0;i<idx.count;i+=3){const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];if(!ids.every(k=>new T.Vector3().fromBufferAttribute(morph,k).length()>1e-6))continue;minimum=Math.min(minimum,triangleRadius(ids.map(point),center));faces++;}
  angles.sort((a,b)=>a-b);let gap=angles[0]+Math.PI*2-angles.at(-1);for(let i=1;i<angles.length;i++)gap=Math.max(gap,angles[i]-angles[i-1]);
  assert.ok(faces>100&&thumb>5);assert.ok(minimum>.012,'hand triangle cuts through shaft');assert.ok(gap<Math.PI,'fingers must wrap more than halfway around shaft');
  // Negative control for the collision metric itself: a face crossing the axis.
  assert.equal(triangleRadius([new T.Vector3(center.x-.02,center.y-.02,0),new T.Vector3(center.x+.02,center.y-.02,0),new T.Vector3(center.x,center.y+.02,0)],center),0);
  t.diagnostic(`${side}: ${faces} corrected triangles; minimum surface radius ${(minimum*1000).toFixed(2)} mm`);
 }
});
test('right hand keeps the calibrated weapon through dodge, hit and return transitions',async()=>{
 const g=await load('ain_anim'),report=repairAinBind(g.scene),clips=repairAinClips(g.animations,report);let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});
 const rig=makeAinRigAdapter(g.scene,g.scene,slot),mixer=new T.AnimationMixer(g.scene);
 for(const name of ['idle','roll','hit','idle','dodgeL','attack1']){
  rig.restore();mixer.stopAllAction();const c=clips.find(c=>c.name===name),action=mixer.clipAction(c);action.play();action.paused=true;
  for(let i=0;i<60;i++){
   rig.restore();action.time=c.duration*i/60;mixer.update(0);rig.apply(name==='attack1'?{clip:name,duration:c.duration,elapsed:action.time}:null,false,false,1/60,name);
   const axis=new T.Vector3(0,1,0).applyQuaternion(slot.getWorldQuaternion(new T.Quaternion())),handAxis=new T.Vector3(0,0,-1).applyQuaternion(rig.bones.RightHand.getWorldQuaternion(new T.Quaternion()));
   assert.ok(axis.dot(handAxis)>.9999,`${name}: weapon rotated out of the right grip`);
   for(const mesh of report.grips)assert.equal(mesh.morphTargetInfluences[1],1,'right hand opened around held weapon');
  }
 }
});
