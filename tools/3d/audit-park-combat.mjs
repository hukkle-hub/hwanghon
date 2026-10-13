/* Actual skinned vertices, not paused AnimationMixer. Produces measurements,
 * never visual approval. Source geometry/UV hashes stay separately recoverable. */
import fs from 'node:fs';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {makePoser} from './pose-eval.mjs';
const [file='art/review/part1/park-combat-candidate.glb',report]=process.argv.slice(2);
const l=new GLTFLoader();l.register(()=>({name:'skip',loadTexture:()=>Promise.resolve(new T.Texture())}));
const b=fs.readFileSync(file),g=await l.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.updateMatrixWorld(true);
let mesh;g.scene.traverse(o=>{if(o.isSkinnedMesh&&!mesh)mesh=o;});if(!mesh)throw Error('No skin');
const base=[],v=new T.Vector3(),rest=[];g.scene.traverse(o=>rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]));
for(let i=0;i<mesh.geometry.attributes.position.count;i++)base.push(mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
const edgeSet=new Map(),ix=mesh.geometry.index;
for(let i=0;i<ix.count;i+=3){const tri=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)];for(let k=0;k<3;k++){let a=Math.min(tri[k],tri[(k+1)%3]),b=Math.max(tri[k],tri[(k+1)%3]);const d=base[a].distanceTo(base[b]);if(d>.002)edgeSet.set(a+':'+b,[a,b,d]);}}
const edges=[...edgeSet.values()],points=base.map(()=>new T.Vector3()),results=[];
const hand=base.map((p,i)=>({p,i})).filter(({p})=>p.x<-.39&&p.y>.77&&p.y<.9);
for(const c of g.animations){
 for(const[o,p,q,s]of rest){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}g.scene.updateMatrixWorld(true);
 const pose=makePoser(g.scene,c);let maxStretch=0,worst=null,groundMin=Infinity,headStretch=0,gripMax=0,samples=0;
 for(let t=0;t<=c.duration+.05;t+=.1){pose(Math.min(t,c.duration));samples++;
  for(let i=0;i<points.length;i++){mesh.getVertexPosition(i,points[i]).applyMatrix4(mesh.matrixWorld);groundMin=Math.min(groundMin,points[i].y);}
  for(const[a,b,d]of edges){const ratio=points[a].distanceTo(points[b])/d,stretch=Math.abs(ratio-1);if(stretch>maxStretch){maxStretch=stretch;worst={t:+t.toFixed(2),rest:base[a].toArray(),posed:points[a].toArray(),ratio};}if(base[a].y>1.62&&base[b].y>1.62)headStretch=Math.max(headStretch,stretch);}
  if(c.name!=='death_park_salute'){
   const center=g.scene.getObjectByName('ParkDanjoe').getWorldPosition(v);let d=Infinity;for(const{i}of hand)d=Math.min(d,points[i].distanceTo(center));gripMax=Math.max(gripMax,d);
  }
 }
 results.push({clip:c.name,duration:c.duration,samples,maxEdgeChange:maxStretch,worst,headEdgeChange:headStretch,minimumSurfaceY:groundMin,maxGripToHandSurface:gripMax});
}
const result={file,method:'makePoser; all skinned vertices/triangle edges >= 2mm; 10Hz including end',visualApproved:false,results};
if(report)fs.writeFileSync(report,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
