import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';import {clone} from '../vendor/three/SkeletonUtils.js';
import {createMobView} from '../js/mmo/field-mobs.js';
async function fixture(){
 const geometry=new THREE.BoxGeometry(.3,1.8,.2),n=geometry.attributes.position.count;
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(n*4),4));
 const weights=new Float32Array(n*4);for(let i=0;i<n;i++)weights[i*4]=1;
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const material=new THREE.MeshStandardMaterial(),mesh=new THREE.SkinnedMesh(geometry,material),bone=new THREE.Bone();bone.name='bone';mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));
 const scene=new THREE.Group();scene.add(mesh);const asset={scene,animations:['idle','walk','attack1','hit','death'].map(name=>new THREE.AnimationClip(name,1,[]))};
 const element=()=>({style:{},firstChild:{style:{}},appendChild(){},remove(){},innerHTML:''});
 const oldDocument=globalThis.document;globalThis.document={createElement:element};
 const world=new THREE.Scene(),view=createMobView({THREE,clone,scene:world,loadBody:async()=>asset,hud:element(),tagAt(){},catalog:[{id:'G5_WALKER',name:'보행자',grade:5}]});
 await Promise.resolve();view.update([{id:'g:m:0',catalogId:'G5_WALKER',x:0,z:0,alive:true,generation:1,anim:'idle'}],.016);
 const v=view.views.get('g:m:0'),counts={bones:0,effects:0,shared:0};assert(v);
 v.model.traverse(o=>{if(o.skeleton)o.skeleton.boneTexture={dispose(){counts.bones++;}};});
 geometry.addEventListener('dispose',()=>counts.shared++);material.addEventListener('dispose',()=>counts.shared++);
 v.warn=new THREE.Mesh(new THREE.RingGeometry(),new THREE.MeshBasicMaterial());v.warn.material.addEventListener('dispose',()=>counts.effects++);
 v.aura=new THREE.Mesh(new THREE.RingGeometry(),new THREE.MeshBasicMaterial());v.aura.material.addEventListener('dispose',()=>counts.effects++);v.aura.geometry.addEventListener('dispose',()=>counts.effects++);
 return {view,v,counts,restore(){globalThis.document=oldDocument;}};
}
test('AOI drop frees cloned bone textures and per-mob effects, never shared body geometry/materials',async()=>{
 const f=await fixture();try{f.view.update([],.016);assert.equal(f.view.count,0);assert.deepEqual(f.counts,{bones:1,effects:3,shared:0});f.view.update([],.016);assert.deepEqual(f.counts,{bones:1,effects:3,shared:0});}finally{f.restore();}
});
test('negative control catches a skipped skeleton cleanup, rather than reporting mobile memory QA passed',async()=>{
 const f=await fixture();try{f.v.model.traverse=()=>{};f.view.update([],.016);assert.throws(()=>assert.deepEqual(f.counts,{bones:1,effects:3,shared:0}));assert.equal(f.counts.bones,0);}finally{f.restore();}
});
