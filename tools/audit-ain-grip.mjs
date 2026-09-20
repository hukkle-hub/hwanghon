import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {repairAinBind,repairAinClips} from '../js/ain-bind-repair.js';
import {makeAinTwoHand} from '../js/ain-two-hand.js';
const bytes=await readFile('art/3d/ain_anim.glb'),loader=new GLTFLoader();loader.register(()=>({name:'no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));
const g=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const report=repairAinBind(g.scene),clips=repairAinClips(g.animations,report);let slot;g.scene.traverse(o=>{if(o.name.endsWith('RightHandSlot'))slot=o;});
const rig=makeAinTwoHand(g.scene,g.scene,slot),mixer=new T.AnimationMixer(g.scene),clip=clips.find(c=>c.name===(process.argv[2]||'attack2')),action=mixer.clipAction(clip);action.play();action.paused=true;
for(let i=80;i<=90;i++){
 rig.restore();action.time=clip.duration*i/240;mixer.update(0);rig.apply({clip:clip.name,elapsed:action.time,duration:clip.duration},false,false,0);
 const result={i};for(const side of ['Left','Right'])for(const part of ['Arm','ForeArm','Hand']){const b=rig.bones[side+part];result[side+part]={p:b.getWorldPosition(new T.Vector3()).toArray().map(n=>+n.toFixed(3)),q:b.quaternion.toArray().map(n=>+n.toFixed(3))};}
 console.log(JSON.stringify(result));
}
