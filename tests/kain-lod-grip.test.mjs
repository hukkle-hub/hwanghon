import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {Animated} from '../js/party-avatar.js';
import {fitHandGrip,gripHands} from '../js/hand-grip.js';
import {KAIN_GRIP_SOURCE_SHA256,kainGripReference} from '../js/kain-grip-reference.js';
globalThis.window=globalThis;
vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));
async function load(file){
 const b=fs.readFileSync(file),l=new GLTFLoader();
 for(const name of ['no-render-textures','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));
 return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
}
const V=()=>new T.Vector3();
function hands(model){const b={};model.traverse(n=>{if(n.isBone)b[n.name.replace(/^mixamorig:?/,'')]=n;});return b;}
function fit(model,side){
 const b=hands(model),hand=b[side+'Hand'],verts=[];
 model.traverse(m=>{if(!m.isSkinnedMesh)return;const bi=m.skeleton.bones.indexOf(hand);if(bi<0)return;
  const mat=m.skeleton.boneInverses[bi].clone().multiply(m.bindMatrix),{position:P,skinIndex:SI,skinWeight:SW}=m.geometry.attributes;
  for(let i=0;i<P.count;i++){let w=0;for(let k=0;k<4;k++)if(SI.getComponent(i,k)===bi)w+=SW.getComponent(i,k);if(w>=.6)verts.push(V().fromBufferAttribute(P,i).applyMatrix4(mat));}
 });return fitHandGrip(verts,b[side+'HandSlot'].quaternion,side,side==='Right'?.190:.188,.032);
}
test('Kain source calibration is current, and rejects a different rig',async()=>{
 assert.match(fs.readFileSync('sw.js','utf8'),/ASSETS\.push\([^;]*['"]js\/kain-grip-reference\.js['"]/,'offline code cache must include the new dependency');
 assert.equal(createHash('sha256').update(fs.readFileSync('art/3d/kain_anim.glb')).digest('hex'),KAIN_GRIP_SOURCE_SHA256,'Kain source changed: regenerate and visually review hand calibration');
 const g=await load('art/3d/kain_anim.glb'),original={Right:fit(g.scene,'Right'),Left:fit(g.scene,'Left')},api=gripHands(g.scene,'kain');
 for(const side of ['Right','Left']){
  assert.ok(V().fromArray(original[side].c).distanceTo(V().fromArray(api.grips[side].c))<1e-6,'reference must match source mesh, not a guessed offset');
  for(const [key,value] of Object.entries(original[side].thumb)){
   const expected=Array.isArray(value)?value:[value],actual=Array.isArray(value)?api.grips[side].thumb[key]:[api.grips[side].thumb[key]];
   expected.forEach((v,i)=>assert.ok(Math.abs(v-actual[i])<1e-9,`${side} thumb ${key}: calibration drift`));
  }
 }
 assert.equal(kainGripReference('Right',new T.Matrix4(),new T.Quaternion()),null);
});
test('Kain mobile LOD retains source palm AND thumb instead of re-fitting sparse bins',async()=>{
 const full=gripHands((await load('art/3d/kain_anim.glb')).scene,'kain'),g=await load('art/3d/lod/kain_anim.glb');
 const sparse={Right:fit(g.scene,'Right'),Left:fit(g.scene,'Left')},lod=gripHands(g.scene,'kain');
 for(const side of ['Right','Left']){
  const same=p=>assert.ok(V().fromArray(p.c).distanceTo(V().fromArray(full.grips[side].c))<.001,`${side}: LOD grip moved outside the source palm`);
  same(lod.grips[side]);assert.deepEqual(lod.grips[side].thumb,full.grips[side].thumb,'LOD must not lose thumb closure');
  // Deliberate negative: the previous sparse re-fit passes joint/axis tests,
  // but moves the weapon > 5 cm outside the original fist. Our check rejects it.
  assert.ok(V().fromArray(sparse[side].c).distanceTo(V().fromArray(full.grips[side].c))>.05);
  assert.throws(()=>same(sparse[side]),/LOD grip moved/);
 }
 for(const t of lod.targets){assert.equal(t.mesh.morphTargetInfluences[t.index.Right],1);assert.ok(t.mesh.geometry.morphAttributes.position[t.index.Right].array.every(Number.isFinite));}
});
test('actual Animated field mounting: full and mobile grips agree through idle/run/combat',async()=>{
 const poses=[];
 for(const lod of [false,true]){
  const base=lod?'art/3d/lod/':'art/3d/',g=await load(base+'kain_anim.glb'),w=await load(base+'gear/w_kain_greatsword.glb'),scene=new T.Scene(),h=new Animated(g,scene,true,false,w,'kain'),b=hands(h.model);
  const metrics=[];
  for(const clip of ['idle','run','attack1','attack2','attack3','smash','skill1','counter','ult']){
   h.armBlend.restore();h.rig.restore();h.mixer.stopAllAction();h.armBlend.reset();const c=h.clips[clip],a=h.mixer.clipAction(c);a.reset().play();
   for(let i=0;i<=90;i++){
    h.armBlend.restore();h.rig.restore();a.time=c.duration*.4*Math.min(1,i/60);h.mixer.update(0);
    h.rig.apply(['idle','run'].includes(clip)?null:{id:clip,clip,kind:'attack',duration:c.duration,elapsed:a.time,hitAt:c.duration*.42},clip==='run',false,1/60,clip,null);h.armBlend.apply(1/60);
   }
   h.root.updateMatrixWorld(true);
   const origin=h.weapon.getWorldPosition(V()),palm=b.RightHand.localToWorld(b.RightHand.userData.gripPoint.clone());
   assert.ok(origin.distanceTo(palm)<1e-6,`${lod} ${clip}: mounting detached from palm`);
   assert.equal(h.weapon.parent.parent,b.RightHand);
   metrics.push({clip,right:palm.toArray(),left:b.LeftHand.localToWorld(b.LeftHand.userData.gripPoint.clone()).toArray()});
  }
  poses.push(metrics);h.dispose(scene);
 }
 for(let i=0;i<poses[0].length;i++)for(const side of ['right','left'])assert.ok(V().fromArray(poses[0][i][side]).distanceTo(V().fromArray(poses[1][i][side]))<.001,`${poses[0][i].clip} ${side}: LOD and source mounting/IK differ`);
});
