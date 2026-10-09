// Actual evaluated exported skin edges over every frame. No file mutation.
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
export async function measureCoatSkin(file,{region='back',injectLastFrameSpike=0}={}){
 const bytes=fs.readFileSync(file),loader=new GLTFLoader();
 loader.register(()=>({name:'no_texture_decode',loadTexture:()=>Promise.resolve(new T.Texture())}));
 const g=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');g.scene.updateMatrixWorld(true);
 const meshes=[];g.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 const body=meshes.sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count)[0];if(!body)throw Error('No native skin');
 const pos=body.geometry.attributes.position,index=body.geometry.index,rest=Array.from({length:pos.count},(_,i)=>new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(body.matrixWorld));
 const unique=new Set(),edges=[];
 for(let i=0;i<index.count;i+=3){const t=[index.getX(i),index.getX(i+1),index.getX(i+2)];for(const [a,b]of [[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]]){const key=Math.min(a,b)+':'+Math.max(a,b);if(unique.has(key))continue;unique.add(key);const centre=rest[a].clone().add(rest[b]).multiplyScalar(.5),len=rest[a].distanceTo(rest[b]);
  if(len>.003&&centre.y>(region==='back'?1.24:1.12)&&centre.y<(region==='back'?1.60:1.65)&&Math.abs(centre.x)<(region==='back'?.23:.4)&&(region!=='back'||centre.z<-.035))edges.push({a,b,len});}}
 if(!edges.length)throw Error('No coat edges');const ids=[...new Set(edges.flatMap(e=>[e.a,e.b]))],posed=new Map(ids.map(i=>[i,new T.Vector3()]));
 const mixer=new T.AnimationMixer(g.scene),results={};
 for(const name of ['idle','walk','tracking_strike','hit','die']){
  const clip=g.animations.find(a=>a.name===name);if(!clip)throw Error('Missing '+name);mixer.stopAllAction();
  const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
  const n=Math.round(clip.duration*30);let worst=0,p99=0,worstFrame=0;
  for(let f=0;f<=n;f++){action.time=Math.min(clip.duration,f/30);mixer.update(0);g.scene.updateMatrixWorld(true);body.skeleton.update();
   for(const i of ids){const v=posed.get(i);v.fromBufferAttribute(pos,i);body.applyBoneTransform(i,v);v.applyMatrix4(body.matrixWorld);}
   if(f===n&&injectLastFrameSpike)posed.get(ids[0]).x+=injectLastFrameSpike;
   const ratios=edges.map(e=>posed.get(e.a).distanceTo(posed.get(e.b))/e.len).sort((a,b)=>a-b),max=ratios.at(-1);if(max>worst){worst=max;worstFrame=f;}p99=Math.max(p99,ratios[Math.floor((ratios.length-1)*.99)]);
  }
  results[name]={frames:n+1,worst,p99,worstFrame};
 }
 mixer.stopAllAction();mixer.uncacheRoot(g.scene);return {region,edges:edges.length,clips:results,visualApprovalNotImplied:true};
}
export function assertCoatSkin(result,limits){for(const [name,limit]of Object.entries(limits)){if(!result.clips[name])throw Error('Missing clip '+name);if(result.clips[name].worst>limit)throw Error('Coat skin spike '+name+': '+result.clips[name].worst+' > '+limit);}return true;}
