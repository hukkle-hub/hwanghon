import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {bindBossEmitter} from '../js/mmo/boss-emitter.js';
import {createRequire} from 'node:module';
const {LEVIATHAN}=createRequire(import.meta.url)('../server/field-boss-emitter.cjs');
import {createStaticBossFX} from '../js/mmo/static-boss-fx.js';
import fs from 'node:fs';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {makePoser} from '../tools/3d/pose-eval.mjs';
const KIT=createRequire(import.meta.url)('../server/field-boss-kit.cjs');
const {emitterPosition,contactLine}=createRequire(import.meta.url)('../server/field-boss-emitter.cjs');

function fixture(){
 const scene=new T.Scene(),root=new T.Group(),model=new T.Group(),pivot=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry());
 mesh.name='Boss_Mesh';scene.add(root);root.add(model);model.add(pivot);pivot.add(mesh);
 root.position.set(7,3,-2);root.rotation.y=.7;model.scale.setScalar(1.589);model.position.set(-.02,.3,.01);
 const skill={hits:[{at:1000,shape:'line',range:33,width:3.2}],tells:[{from:0,at:1000}]};
 const o={b:{id:'leviathan'},h:3.5,root,model,kfx:{baseY:.3,kit:{emitter:LEVIATHAN,skills:{pressure:skill}}}};
 return {scene,root,model,pivot,mesh,skill,o};
}
const close=(a,b)=>assert.ok(a.distanceTo(b)<1e-8,`${a.toArray()} != ${b.toArray()}`);
test('measured mouth follows normalization, parent yaw, lift and same-frame recoil',()=>{
 const f=fixture(),em=bindBossEmitter(f.model,LEVIATHAN),point=new T.Vector3(...LEVIATHAN.point);
 for(const t of [0,.1,.7,1.5]){
  f.root.rotation.y+=.2;f.root.position.x+=.4;f.model.position.y=t+.3;f.pivot.rotation.x=-.018+t*.01;
  const actual=em.worldPosition(new T.Vector3());
  const expected=point.clone().applyEuler(f.mesh.rotation).add(f.mesh.position).applyEuler(f.pivot.rotation).multiplyScalar(1.589).add(f.model.position).applyEuler(f.root.rotation).add(f.root.position);
  close(actual,expected);
 }
});
test('charge and beam start at mouth; locked direction and range start there too',()=>{
 const f=fixture(),fx=createStaticBossFX(f.o,f.scene,0,false),a={yaw:.2};
 f.pivot.rotation.x=-.018;fx.update(a,f.skill,800);
 const mouth=fx.emitter.worldPosition(new T.Vector3());close(fx.core.position,mouth);
 const beam=fx.pool[0].beam,half=new T.Vector3(0,beam.scale.y/2,0).applyQuaternion(beam.quaternion);
 close(beam.position.clone().sub(half),mouth);
 close(beam.position.clone().add(half),new T.Vector3(mouth.x+Math.sin(.2)*33,.65,mouth.z+Math.cos(.2)*33));
 // Negative control: the old height-centre origin is metres from the mouth.
 assert.throws(()=>close(fx.core.position,new T.Vector3(7,3.5*.55,-2)));
 f.o.stage={dying:true};fx.update(a,f.skill,900);assert.ok(fx.group.children.every(m=>!m.visible));fx.dispose();assert.equal(fx.group.parent,null);
});
test('unknown asset or non-mesh node is not silently treated as a mouth',()=>{
 const f=fixture();assert.equal(bindBossEmitter(f.model,null),null);
 f.mesh.name='ChangedMesh';assert.equal(bindBossEmitter(f.model,LEVIATHAN),null);
 const fake=new T.Group();fake.name='Boss_Mesh';f.model.add(fake);assert.equal(bindBossEmitter(f.model,LEVIATHAN),null);
});
test('actual asset: every recoil sample and hit-frame emitter agrees with the pure server contract',async()=>{
 const bytes=fs.readFileSync(new URL('../art/3d/part1/leviathan_static.glb',import.meta.url));
 const loader=new GLTFLoader();loader.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const gl=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const model=gl.scene,box=new T.Box3().setFromObject(model),k=LEVIATHAN.height/(box.max.y-box.min.y);
 assert.deepEqual(box.min.toArray(),LEVIATHAN.min);assert.deepEqual(box.max.toArray(),LEVIATHAN.max);
 model.scale.setScalar(k);box.setFromObject(model);model.position.set(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);
 const root=new T.Group();root.position.set(17,0,-11);root.add(model);const emitter=bindBossEmitter(model,LEVIATHAN);
 let samples=0,maxError=0;
 for(const skill of Object.values(KIT.KITS.leviathan.skills)){
  const pose=makePoser(model,gl.animations.find(c=>c.name===skill.clip));
  for(const t of [...Array.from({length:Math.ceil(skill.duration/25)},(_,i)=>i*25),...skill.hits.map(h=>h.at),skill.duration]){
   pose(t/1000);const actual=emitter.worldPosition(new T.Vector3()),expected=emitterPosition(LEVIATHAN,skill,t,17,-11);
   const err=actual.distanceTo(new T.Vector3(expected.x,expected.y,expected.z));maxError=Math.max(err,maxError);samples++;
   assert.ok(err<.00001,`${skill.clip} ${t}ms ${err}m`);
  }
 }
 assert.ok(samples>450);assert.ok(maxError<.00001);
 // Stale centre binding must fail an actual model assertion, not just a mock.
 assert.throws(()=>close(emitter.worldPosition(new T.Vector3()),root.position));
});
test('new line footprint follows mouth to locked endpoint; centre/rear and side are no longer invisible hits',()=>{
 const skill=KIT.KITS.leviathan.skills.pressure,h=skill.hits[0];
 for(const yaw of [0,.4,1.2,-.8,Math.PI]){
  const path=contactLine(LEVIATHAN,skill,h,10,20,yaw),hit={...h,range:path.range},a=path.origin;
  const dx=Math.sin(a.yaw),dz=Math.cos(a.yaw),p={x:a.x+dx*path.range*.5,z:a.z+dz*path.range*.5};
  assert.equal(KIT.inShape(a,p,hit),true);
  assert.equal(KIT.inShape(a,{x:p.x+dz*(h.width/2+.01),z:p.z-dx*(h.width/2+.01)},hit),false);
  assert.equal(KIT.inShape(a,{x:a.x-dx*.01,z:a.z-dz*.01},hit),false);
  assert.equal(KIT.inShape(a,{x:a.x+dx*(path.range+.01),z:a.z+dz*(path.range+.01)},hit),false);
 }
 const path=contactLine(LEVIATHAN,skill,h,0,0,0),p={x:0,z:5};
 assert.equal(KIT.inShape(path.origin,p,{...h,range:path.range}),false);
 assert.throws(()=>assert.equal(KIT.inShape({x:0,z:0,yaw:0},p,h),false),'old centre-origin mutation must fail');
});
