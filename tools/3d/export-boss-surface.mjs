// Export actual makePoser-evaluated vertices for offline clay inspection.
// No animation retargeting, bind-pose boxes or browser wall-clock sampling.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {createReviewPoser} from './boss-close-review.mjs';
const [source,output,clipName='death',sampling='30']=process.argv.slice(2);
if(!source||!output)throw Error('Usage: node export-boss-surface.mjs source.glb output-directory clip fps|times=0,1,2');
const bytes=fs.readFileSync(source),loader=new GLTFLoader();loader.register(()=>({name:'clay-no-textures',loadTexture:()=>Promise.resolve(new T.Texture())}));
const gl=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),clip=gl.animations.find(c=>c.name===clipName);
if(!clip)throw Error('Missing clip: '+clipName);
const fps=Number(sampling),times=sampling.startsWith('times=')?sampling.slice(6).split(',').map(Number):Number.isFinite(fps)&&fps>0?Array.from({length:Math.ceil(clip.duration*fps)+1},(_,i)=>Math.min(i/fps,clip.duration)):[];
if(!times.length||times.some(t=>!Number.isFinite(t)||t<0||t>clip.duration+1e-6))throw Error('Invalid sample times');
const out=path.resolve(output);if(fs.existsSync(path.join(out,'manifest.json')))throw Error('Refusing to overwrite a completed surface export');fs.mkdirSync(out,{recursive:true});
const pose=createReviewPoser(gl.scene,gl.animations),meshes=[],indices=[];let count=0;
gl.scene.traverse(o=>{if(!o.isMesh||!o.geometry.attributes.position)return;meshes.push(o);const p=o.geometry.attributes.position,ix=o.geometry.index;for(let i=0;i<(ix?.count||p.count);i++)indices.push(count+(ix?ix.getX(i):i));count+=p.count;});
fs.writeFileSync(path.join(out,'indices.bin'),Buffer.from(new Uint32Array(indices).buffer),{flag:'wx'});
const allBounds=new T.Box3(),point=new T.Vector3(),frames=[];
for(let frame=0;frame<times.length;frame++){
 const time=times[frame];pose(clipName,time);gl.scene.updateMatrixWorld(true);const positions=new Float32Array(count*3),bounds=new T.Box3();let n=0;
 for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);positions[n++]=point.x;positions[n++]=-point.z;positions[n++]=point.y;bounds.expandByPoint(point);}
 allBounds.union(bounds);const file=`frame-${String(frame).padStart(3,'0')}.bin`;fs.writeFileSync(path.join(out,file),Buffer.from(positions.buffer),{flag:'wx'});frames.push({file,time,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}});
}
const manifest={source:path.resolve(source),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),clip:clipName,fps:Number.isFinite(fps)?fps:null,vertexCount:count,triangleCount:indices.length/3,indexFile:'indices.bin',frames,bounds:{min:allBounds.min.toArray(),max:allBounds.max.toArray()},coordinateConversion:'Three x,y,z -> Blender x,-z,y',method:'actual getVertexPosition with makePoser; clay-only surface export, not live game/AI/camera/timing acceptance',approved:false};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});console.log(JSON.stringify({manifest:path.join(out,'manifest.json'),frames:frames.length,vertices:count,triangles:indices.length/3,sha256:manifest.sha256,approved:false}));
