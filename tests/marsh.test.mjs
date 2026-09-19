import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {prepareMarshMotion,detachBossPiece,bossAttackSpec,bossPartPieces} from '../js/marsh-motion.js';
const bytes=fs.readFileSync(new URL('../art/3d/boss_marsh.glb',import.meta.url));
const raw=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const asset=prepareMarshMotion(raw);
const v2bytes=fs.readFileSync(new URL('../art/3d/boss_marsh_v2.glb',import.meta.url));
const v2raw=await new GLTFLoader().parseAsync(v2bytes.buffer.slice(v2bytes.byteOffset,v2bytes.byteOffset+v2bytes.byteLength),'');
const v2=prepareMarshMotion(v2raw);
test('Morbus GLB has all combat bones, detachable parts and finite animation poses',()=>{
 for(const name of ['Head','Spine1','FR_Low','Tail2','Spine','Spine2','piece_back','piece_legf','piece_tail'])
   assert.ok(asset.scene.getObjectByName(name),name);
 const mixer=new T.AnimationMixer(asset.scene);
 for(const name of ['idle','walk','atk_bolt','atk_flame','atk_hammer','atk_scythe','atk_drop','hit','stagger','down','up','death']){
   const clip=asset.animations.find(c=>c.name===name);assert.ok(clip,name);
   mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();action.paused=true;
   for(let i=0;i<=30;i++){action.time=clip.duration*i/30;mixer.update(0);asset.scene.updateMatrixWorld(true);
     asset.scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),name));
   }
 }
 mixer.stopAllAction();
});
test('charge is in-place horizontally without mutating the original asset',()=>{
 const before=raw.animations.find(c=>c.name==='atk_bolt').tracks.find(t=>t.name==='Hips.position');
 const after=asset.animations.find(c=>c.name==='atk_bolt').tracks.find(t=>t.name==='Hips.position');
 assert.ok(before&&after);
 assert.ok(before.values.some((v,i)=>i%3===2&&Math.abs(v-before.values[2])>.01));
 for(let i=0;i<after.values.length;i+=3){
   assert.equal(after.values[i],after.values[0]);assert.equal(after.values[i+2],after.values[2]);
   assert.equal(after.values[i+1],before.values[i+1]);
 }
 assert.equal(prepareMarshMotion(raw),asset);
});
test('rage clip contains only the first strike with a midpoint impact',()=>{
 const source=raw.animations.find(c=>c.name==='atk_drop');
 const clip=asset.animations.find(c=>c.name==='atk_drop');
 assert.equal(clip.duration,.65);assert.equal(source.duration>clip.duration,true);
 for(let i=0;i<clip.tracks.length;i++){
   const actual=clip.tracks[i].createInterpolant().evaluate(.325);
   const expected=source.tracks[i].createInterpolant().evaluate(source.duration*.175);
   actual.forEach((v,j)=>assert.ok(Math.abs(v-expected[j])<1e-5));
 }
});
test('detaching a scaled boss part preserves its complete world transform',()=>{
 const scene=new T.Scene(),root=new T.Group(),bone=new T.Group(),piece=new T.Group();
 scene.add(root);root.add(bone);bone.add(piece);root.scale.setScalar(.85);
 root.position.set(4,0,7);root.rotation.y=.7;bone.rotation.x=.3;piece.position.set(1,2,3);
 scene.updateMatrixWorld(true);const before=piece.matrixWorld.clone();
 detachBossPiece(piece,scene);scene.updateMatrixWorld(true);
 assert.equal(piece.parent,scene);
 piece.matrixWorld.elements.forEach((v,i)=>assert.ok(Math.abs(v-before.elements[i])<1e-8));
});
test('solo and server one-based beats select right, left, finishing strikes',()=>{
 const arena={id:'marsh',atk:{drop:{clip:'atk_drop',hitFrac:.5}}};
 const source=raw.animations.find(c=>c.name==='atk_drop');
 for(let beat=1;beat<=3;beat++){
  const spec=bossAttackSpec(arena,'drop',beat);
  const clip=asset.animations.find(c=>c.name===spec.clip);
  assert.ok(clip);assert.equal(spec.hitFrac,.5);
  for(let i=0;i<clip.tracks.length;i++){
   const actual=clip.tracks[i].createInterpolant().evaluate(.325);
   const expected=source.tracks[i].createInterpolant().evaluate(source.duration*(.175+(beat-1)*.25));
   actual.forEach((v,j)=>assert.ok(Math.abs(v-expected[j])<1e-5));
  }
 }
 assert.equal(bossAttackSpec(arena,'drop',1).clip,'atk_drop');
 assert.equal(bossAttackSpec(arena,'drop',2).clip,'atk_drop_left');
 assert.equal(bossAttackSpec(arena,'drop',3).clip,'atk_drop_finish');
 assert.equal(bossAttackSpec({...arena,id:'tutorial'},'drop',2),arena.atk.drop);
});
test('V2 is a bounded three-material rig with separately attached left/right armor',()=>{
 const materials=new Set();let triangles=0;
 v2.scene.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);
 triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
 assert.equal(materials.size,3);assert.ok(triangles<90000);assert.ok(v2bytes.length<1024*1024);
 const legs=bossPartPieces(v2.scene,'legf');assert.equal(legs.length,2);
 assert.notEqual(legs[0].parent,legs[1].parent);
 assert.equal(v2.animations.length,14);
 const mixer=new T.AnimationMixer(v2.scene);
 for(const clip of v2.animations){
  mixer.stopAllAction();const action=mixer.clipAction(clip);action.play();action.paused=true;
  for(let i=0;i<=24;i++){
   action.time=clip.duration*i/24;mixer.update(0);v2.scene.updateMatrixWorld(true);
   v2.scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),clip.name));
  }
 }
 mixer.stopAllAction();
 console.log('Morbus V2: '+triangles+' triangles, '+materials.size+' materials, '+v2bytes.length+' bytes');
});
