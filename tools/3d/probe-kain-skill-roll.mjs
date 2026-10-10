// Local geometry probe: humeral roll with exact inverse forearm compensation.
// Joint positions, forearm world orientation and rigid hand contacts stay fixed.
import fs from 'node:fs';import vm from 'node:vm';import * as T from '../../vendor/three/three.module.js';import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {Animated} from '../../js/party-avatar.js';import {makePoser} from './pose-eval.mjs';import {fieldHeroAction} from '../../js/mmo/hero-motion.js';import {prepareArmSurface,armSurfaceNow} from './arm-surface-audit.mjs';
globalThis.window=globalThis;for(const f of ['looks','dungeons'])vm.runInThisContext(fs.readFileSync('js/'+f+'.js','utf8'));
const load=async f=>{const b=fs.readFileSync(f),l=new GLTFLoader();for(const name of ['nr','EXT_texture_webp'])l.register(()=>({name,loadTexture:()=>Promise.resolve(new T.Texture())}));return l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const side=process.argv.includes('--left-ult')?'Left':'Right',samples=side==='Left'?[['ult',.30],['ult',.315],['ult',.33],['ult',.35]]:[['skill1',2/3],['skill4',5/6]];
for(const lod of [false,true]){
 const scene=new T.Scene(),prefix=lod?'lod/':'',h=new Animated(await load('art/3d/'+prefix+'kain_anim.glb'),scene,true,false,await load('art/3d/'+prefix+'gear/w_kain_greatsword.glb'),'kain'),bones={};h.model.traverse(b=>{if(b.isBone)bones[b.name.replace(/^mixamorig:?/,'')]=b;});const surface=prepareArmSurface(h.model,{side,boundary:true});
 for(const[name,phase]of samples){
  const clip=h.clips[name],pose=makePoser(h.model,clip),dt=clip.duration/240;for(let i=0;i<=Math.round(phase*240);i++){h.rig.restore();pose(i*dt);h.rig.apply(fieldHeroAction('kain',clip,i*dt,name),false,false,dt,name);}h.root.updateMatrixWorld(true);
  const upper=bones[side+'Arm'].quaternion.clone(),fore=bones[side+'ForeArm'].quaternion.clone(),axis=bones[side+'ForeArm'].position.clone().normalize();
  for(let k=-8;k<=8;k++){const roll=new T.Quaternion().setFromAxisAngle(axis,k*.1);bones[side+'Arm'].quaternion.copy(upper).multiply(roll);bones[side+'ForeArm'].quaternion.copy(roll.clone().invert()).multiply(fore);h.root.updateMatrixWorld(true);console.log(lod?'mobile':'original',name,phase,(k*.1).toFixed(1),JSON.stringify(armSurfaceNow(surface)));}
 }h.dispose(scene);
}
