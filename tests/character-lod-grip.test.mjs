import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import * as T from '../vendor/three/three.module.js';import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {gripHands,fitHandGrip,HAND_GRIP,thumbWeight} from '../js/hand-grip.js';import {CHARACTER_GRIP_REFERENCES,characterGripReference} from '../js/character-grip-reference.js';
async function load(file){const b=fs.readFileSync(file),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
function freshFit(model,ch,side){const bones={},meshes=[];model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;if(o.isSkinnedMesh)meshes.push(o);});const verts=[];for(const m of meshes){const j=m.skeleton.bones.indexOf(bones[side+'Hand']);if(j<0)continue;const M=m.skeleton.boneInverses[j].clone().multiply(m.bindMatrix),{position:P,skinIndex:I,skinWeight:W}=m.geometry.attributes;for(let i=0;i<P.count;i++){let w=0;for(let k=0;k<4;k++)if(I.getComponent(i,k)===j)w+=W.getComponent(i,k);if(w>=.6)verts.push(new T.Vector3().fromBufferAttribute(P,i).applyMatrix4(M));}}return fitHandGrip(verts,bones[side+'HandSlot'].quaternion,side,HAND_GRIP[ch][side].web,HAND_GRIP[ch].r);}
test('Ryu/Sera mobile grip preserves original palm AND thumb, rejecting sparse re-fit',async t=>{
 assert.match(fs.readFileSync('sw.js','utf8'),/ASSETS\.push\('js\/character-grip-reference\.js'/);
 for(const ch of ['ryu','sera']){const file='art/3d/'+ch+'_anim.glb';assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),CHARACTER_GRIP_REFERENCES[ch].sha256,'source changed: recalibrate and render the hands');
  const fullAsset=await load(file),lodAsset=await load('art/3d/lod/'+ch+'_anim.glb'),raw={};for(const side of ['Right','Left'])raw[side]=freshFit(lodAsset.scene,ch,side);
  const expected={};for(const side of ['Right','Left'])expected[side]=freshFit(fullAsset.scene,ch,side);
  const full=gripHands(fullAsset.scene,ch),lod=gripHands(lodAsset.scene,ch);
  for(const side of ['Right','Left']){assert.deepEqual(full.grips[side],expected[side]);assert.deepEqual(lod.grips[side],expected[side]);assert.equal(characterGripReference(ch,side,new T.Matrix4(),new T.Quaternion()),null,'unrelated rig must not inherit this frame');}
  const same=g=>assert.ok(new T.Vector3(...g.c).distanceTo(new T.Vector3(...expected.Right.c))<.001,'mobile grip moved out of original palm');same(lod.grips.Right);assert.throws(()=>same(raw.Right),/moved out/);
  for(const target of lod.targets)for(const side of ['Right','Left']){const G=target.mesh.geometry,P=G.attributes.position,I=G.index,D=G.morphAttributes.position[target.index[side]],region=target.regions.find(r=>r.side===side),grip=lod.grips[side];assert.ok(D.array.every(Number.isFinite));
   const local=(i,amount)=>new T.Vector3().fromBufferAttribute(P,i).addScaledVector(new T.Vector3().fromBufferAttribute(D,i),amount).applyMatrix4(region.M);let finger=0,thumb=0;
   for(let k=0;k<I.count;k+=3)for(let j=0;j<3;j++){const a=I.getX(k+j),b=I.getX(k+(j+1)%3),a0=local(a,0),b0=local(b,0),increase=local(a,1).distanceTo(local(b,1))-a0.distanceTo(b0);if(thumbWeight(a0,grip)>0||thumbWeight(b0,grip)>0)thumb=Math.max(thumb,increase);else finger=Math.max(finger,increase);}
   assert.ok(finger<.008,`${ch} ${side}: finger edge tears ${finger}m`);assert.ok(thumb<.02,`${ch} ${side}: thumb edge tears ${thumb}m`);t.diagnostic(`${ch} ${side}: finger/thumb edge increase ${(finger*1000).toFixed(2)}/${(thumb*1000).toFixed(2)}mm`);
  }
  t.diagnostic(`${ch}: former right-palm shift ${(new T.Vector3(...raw.Right.c).distanceTo(new T.Vector3(...expected.Right.c))*1000).toFixed(2)}mm, corrected 0mm`);
 }
});
