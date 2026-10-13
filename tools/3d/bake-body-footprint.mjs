// Bake a conservative review envelope from EVERY vertex, not bone positions.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {createInterruptPoseStudy} from './interrupt-pose-study.mjs';
import api from './body-footprint.cjs';
const source=new URL('../../art/review/part1/leviathan-gill-candidate.glb',import.meta.url),bytes=fs.readFileSync(source);
const normalization=JSON.parse(fs.readFileSync(new URL('../../art/review/part1/leviathan-gill-contact.json',import.meta.url)));
const loader=new GLTFLoader();loader.register(()=>({name:'skipTextures',loadTexture:()=>Promise.resolve(new T.Texture())}));
const gl=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const study=createInterruptPoseStudy(gl.scene,gl.animations),mesh=gl.scene.getObjectByName('Boss_Mesh'),v=new T.Vector3();
let hull=[],poses=0;
function sample(clip,t,cancel=Infinity){
 study.pose(clip,t,cancel);gl.scene.updateMatrixWorld(true);
 const points=[...hull];
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){
  mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);
  points.push({x:v.x*normalization.scale+normalization.offset[0],z:v.z*normalization.scale+normalization.offset[2]});
 }
 hull=api.convexHull(points);poses++;
}
for(const c of gl.animations){for(let t=0;t<c.duration;t+=1/30)sample(c.name,t);sample(c.name,c.duration)}
for(const cancel of [0,.65,1.42,1.7,1.82,2.4])for(let age=0;age<=1.6;age+=1/60)sample('atk_gill',cancel+age,cancel);
const profile={reviewOnly:true,method:'convex XZ union of all vertices across sampled authored clips and interruption poses; vertical column; not swept collision',sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),poseCodeSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL('./interrupt-pose-study.mjs',import.meta.url))).digest('hex'),scale:normalization.scale,offset:normalization.offset,poses,verticesPerPose:mesh.geometry.attributes.position.count,hull};
fs.writeFileSync(new URL('../../art/review/part1/leviathan-body-footprint.json',import.meta.url),JSON.stringify(profile,null,2)+'\n');
console.log(JSON.stringify({poses,verticesPerPose:profile.verticesPerPose,hullVertices:hull.length}));
