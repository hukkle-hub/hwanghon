// Extract exact baked morph/rotation tracks and only the six required vertices.
// Output is review data, not live registration. No original GLB is modified.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {GILL_SOCKETS} from './leviathan-gill-sockets.mjs';
import {bindBossSurfaceEmitter} from '../../js/mmo/boss-emitter.js';
import contract from '../../server/field-boss-emitter.cjs';
import contact from '../../server/field-surface-contact.cjs';
const source=new URL('../../art/review/part1/leviathan-gill-candidate.glb',import.meta.url);
const output=new URL('../../art/review/part1/leviathan-gill-contact.json',import.meta.url);
export async function bakeGillContactProfile(bytes=fs.readFileSync(source)) {
 const loader=new GLTFLoader();loader.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const gl=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const mesh=gl.scene.getObjectByName('Boss_Mesh'),parent=mesh?.parent,clip=gl.animations.find(a=>a.name==='atk_gill');
 const identity=o=>o.position.length()===0 && o.scale.equals(new T.Vector3(1,1,1)) && o.quaternion.equals(new T.Quaternion());
 if(!mesh?.isMesh||mesh.isSkinnedMesh||!mesh.geometry.morphTargetsRelative||!parent||parent.parent!==gl.scene||
    ![mesh,parent,gl.scene].every(identity)||!clip||clip.tracks.length!==2)throw Error('Unsupported candidate rig');
 const rotation=clip.tracks.find(t=>t.name===parent.name+'.quaternion'),weights=clip.tracks.find(t=>t.name===mesh.name+'.morphTargetInfluences');
 if(!rotation||!weights||rotation.getInterpolation()!==T.InterpolateLinear||weights.getInterpolation()!==T.InterpolateLinear)throw Error('Unsupported baked tracks');
 const box=new T.Box3().setFromObject(gl.scene),scale=contract.LEVIATHAN.height/(box.max.y-box.min.y);
 const pack=tr=>({times:Array.from(tr.times,t=>t*1000),values:Array.from(tr.values)});
 const profile={version:1,reviewOnly:true,source:'art/review/part1/leviathan-gill-candidate.glb',
  sha256:crypto.createHash('sha256').update(bytes).digest('hex'),clip:clip.name,duration:clip.duration*1000,
  scale,offset:[-(box.min.x+box.max.x)/2*scale,-box.min.y*scale,-(box.min.z+box.max.z)/2*scale],
  morphCount:mesh.geometry.morphAttributes.position.length,rotation:pack(rotation),weights:pack(weights),
  surfaces:GILL_SOCKETS.map(s=>{
   if(!bindBossSurfaceEmitter(gl.scene,s))throw Error('Stale socket '+s.name);
   const array=(attribute,id)=>new T.Vector3().fromBufferAttribute(attribute,id).toArray();
   return{name:s.name,barycentric:[...s.surface.weights],vertices:s.surface.vertices.map(id=>({
    rest:array(mesh.geometry.attributes.position,id),deltas:mesh.geometry.morphAttributes.position.map(a=>array(a,id))}))};
  })};
 if(!contact.bindSurfaceContactProfile(profile))throw Error('Invalid extracted profile');
 return profile;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const profile=await bakeGillContactProfile();fs.writeFileSync(output,JSON.stringify(profile,null,2)+'\n');
 console.log(JSON.stringify({output:output.pathname,sha256:profile.sha256,reviewOnly:true}));
}
