import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
const data=await readFile('art/3d/boss_anim.glb'),loader=new GLTFLoader();
loader.register(()=>({name:'audit-no-raster',loadTexture:()=>Promise.resolve(new T.Texture())}));
const g=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const bones={};g.scene.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;});
const mixer=new T.AnimationMixer(g.scene);
g.scene.updateMatrixWorld(true);
console.log(JSON.stringify({boneScales:Object.fromEntries(['Spine1','LeftArm','RightArm'].map(n=>[n,bones[n].getWorldScale(new T.Vector3()).toArray()]))}));
for(const name of ['atk_hammer','atk_bolt','atk_scythe']){
 const clip=g.animations.find(c=>c.name===name);mixer.stopAllAction();
 const action=mixer.clipAction(clip);action.play();action.paused=true;
 const rows=[];
 for(let i=0;i<=20;i++){
  action.time=clip.duration*i/20;mixer.update(0);g.scene.updateMatrixWorld(true);
  const positions={};
  for(const n of ['Hips','LeftHand','RightHand'])positions[n]=bones[n].getWorldPosition(new T.Vector3()).toArray().map(v=>+v.toFixed(3));
  rows.push({t:i/20,...positions});
 }
 console.log(JSON.stringify({name,duration:clip.duration,rows}));
}
