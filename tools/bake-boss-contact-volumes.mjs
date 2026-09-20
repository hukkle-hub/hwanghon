// Emits measured bind-pose part centres in model metres. No source GLB writes.
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {createPumpBoss} from '../js/pump-boss.js';
import {createRelayBoss} from '../js/relay-boss.js';
import {createRootBoss} from '../js/root-boss.js';
import {createHaulerBoss} from '../js/hauler-boss.js';
import {createWardBoss} from '../js/ward-boss.js';
import C from '../server/content.cjs';
const factories={pump:createPumpBoss,relay:createRelayBoss,root:createRootBoss,hauler:createHaulerBoss,ward:createWardBoss};
async function load(path){const b=await readFile(path),l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const output={};
for(const A of Object.values(C.arenas)){
 const asset=factories[A.procedural]?factories[A.procedural]():await load(A.model||'art/3d/boss_anim.glb');
 asset.scene.updateMatrixWorld(true);const bones={};asset.scene.traverse(o=>{bones[o.name.replace(/^mixamorig:?/,'')]=o;});
 output[A.id]={};
 for(const [id,part]of Object.entries(A.parts3d||{})){
  const bone=bones[part.bone];if(!bone)throw Error(A.id+':'+id+' missing '+part.bone);
  output[A.id][id]=bone.getWorldPosition(new T.Vector3()).add(new T.Vector3(...part.off)).toArray().map(x=>+x.toFixed(5));
 }
}
console.log(JSON.stringify(output));
