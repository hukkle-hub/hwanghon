// Actual exported skin vertices, not bone positions. Read-only diagnostics.
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
export async function measureIdlePlant(file,{injectEndDrift=0}={}){
 const bytes=fs.readFileSync(file),loader=new GLTFLoader();loader.register(()=>({name:'no_texture_decode',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const g=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');g.scene.updateMatrixWorld(true);
 const sets={left:[],right:[]},skeletons=new Set();g.scene.traverse(o=>{if(!o.isSkinnedMesh)return;skeletons.add(o.skeleton);const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.y<.018&&Math.abs(v.x)>.09)sets[v.x>0?'left':'right'].push({mesh:o,index:i});}});
 const clip=g.animations.find(a=>a.name==='idle');if(!clip)throw Error('Missing idle');const mixer=new T.AnimationMixer(g.scene),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
 const rows=[],n=Math.round(clip.duration*30),v=new T.Vector3();
 for(let i=0;i<=n;i++){action.time=Math.min(clip.duration,i/30);mixer.update(0);g.scene.position.x=i===n?injectEndDrift:0;g.scene.updateMatrixWorld(true);for(const s of skeletons)s.update();const row={};
  for(const [name,set]of Object.entries(sets)){if(!set.length)throw Error('No native sole vertices');const mean=new T.Vector3();let minY=Infinity;for(const p of set){v.fromBufferAttribute(p.mesh.geometry.attributes.position,p.index);p.mesh.applyBoneTransform(p.index,v);v.applyMatrix4(p.mesh.matrixWorld);mean.add(v);minY=Math.min(minY,v.y);}mean.multiplyScalar(1/set.length);row[name]={centre:mean.toArray(),minY};}rows.push(row);
 }
 const result={frames:n+1,duration:clip.duration,feet:{}};for(const name of Object.keys(sets)){const xx=rows.map(r=>r[name].centre[0]),zz=rows.map(r=>r[name].centre[2]);result.feet[name]={vertices:sets[name].length,horizontalSpanM:Math.hypot(Math.max(...xx)-Math.min(...xx),Math.max(...zz)-Math.min(...zz)),floorMinM:Math.min(...rows.map(r=>r[name].minY))};}
 mixer.stopAllAction();mixer.uncacheRoot(g.scene);return result;
}
export function assertIdlePlant(result,toleranceM=.001){for(const foot of Object.values(result.feet)){if(foot.horizontalSpanM>toleranceM)throw Error('Idle foot drift '+foot.horizontalSpanM+'m');if(foot.floorMinM<-.002)throw Error('Sole penetrates floor >2mm');}return true;}
