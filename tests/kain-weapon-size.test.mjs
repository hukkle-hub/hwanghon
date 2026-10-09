import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {Animated} from '../js/party-avatar.js';
globalThis.window=globalThis;
vm.runInThisContext(fs.readFileSync('js/looks.js','utf8'));
const L=globalThis.TW_LOOKS,V=()=>new T.Vector3();
async function load(file){const b=fs.readFileSync(file),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
function projectedLength(root){root.updateWorldMatrix(true,true);const axis=V().set(0,1,0).applyQuaternion(root.getWorldQuaternion(new T.Quaternion())),origin=root.getWorldPosition(V()),a=[];root.traverse(m=>{if(!m.isMesh)return;const P=m.geometry.attributes.position;for(let i=0;i<P.count;i++)a.push(V().fromBufferAttribute(P,i).applyMatrix4(m.matrixWorld).sub(origin).dot(axis));});return Math.max(...a)-Math.min(...a);}
const checkLength=n=>assert.ok(Math.abs(n-1.9)<.001,`planned length 1.900m, got ${n}`);
test('standard greatsword is planned 190cm in full AND mobile actual avatars, not enlarged with the actor',async()=>{
 for(const base of ['art/3d/','art/3d/lod/']){
  const g=await load(base+'kain_anim.glb'),w=await load(base+'gear/w_kain_greatsword.glb');
  // Negative control: the old 160cm asset itself is not a 190cm delivered sword.
  assert.throws(()=>checkLength(projectedLength(w.scene)),/planned length/);
  const scene=new T.Scene(),h=new Animated(g,scene,true,false,w,'kain');
  for(const name of ['idle','attack1','attack3','smash','ult']){
   h.armBlend.restore();h.rig.restore();h.mixer.stopAllAction();h.mixer.clipAction(h.clips[name]).play();h.mixer.update(.3);h.root.updateMatrixWorld(true);
   checkLength(projectedLength(h.weapon));
  }
  [.130625,.2375].forEach((v,i)=>assert.ok(Math.abs(h.weapon.parent.userData.hand2[i]-v)<1e-10));
  h.dispose(scene);
 }
});
test('length correction keeps the ORIGINAL handle centre on the socket; X/Z thickness is not enlarged',async()=>{
 const g=await load('art/3d/gear/w_kain_greatsword.glb'),spec=L.WEAPON.w_kain_greatsword,frame=L.prepareWeapon(T,g.scene,spec);frame.updateMatrixWorld(true);
 const grip=g.scene.localToWorld(V().set(0,spec.grip,0));
 assert.ok(grip.length()<1e-7,'scaled source grip must remain at the origin');
 assert.equal(frame.scale.x,1);assert.equal(frame.scale.z,1);
 // Deliberate old-offset bug: length scaling without scaling the translation
 // displaces the hilt 14cm despite the weapon wrapper still sitting on the hand.
 frame.position.y=-spec.grip;frame.updateMatrixWorld(true);
 assert.throws(()=>assert.ok(g.scene.localToWorld(V().set(0,spec.grip,0)).length()<.001));
});
test('preview equipment builds the grip BEFORE mounting; raw body inspection stays raw',()=>{
 const s=fs.readFileSync('viewer.html','utf8');
 assert.match(s,/EQUIP&&!BARE&&!name&&CHARID==='kain'/);
 assert.ok(s.indexOf('handGrip=gripHands(charRoot,CHARID)')<s.indexOf('if(EQUIP) applyEquip()'));
 assert.match(s,/RightHandSlot\$\/\.test\(o\.name\)/,'namespaced skeleton slots must resolve');
 assert.match(s,/gripRig\.apply/);assert.match(s,/equippedWeapon=wr/);
 const omitted=s.replace('handGrip=gripHands(charRoot,CHARID)','handGrip=null');
 assert.throws(()=>assert.match(omitted,/handGrip=gripHands\(charRoot,CHARID\)/));
});
