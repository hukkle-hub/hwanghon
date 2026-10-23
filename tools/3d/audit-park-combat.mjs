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
const feet=base.map((p,i)=>({p,i})).filter(({p})=>p.y<.17&&Math.abs(p.x)>.06);
const hands=base.map((p,i)=>({p,i})).filter(({p})=>Math.abs(p.x)>.39&&p.y>.77&&p.y<1.0);
const weaponMeshes=[];g.scene.getObjectByName('ParkDanjoe')?.traverse(o=>{if(o.isMesh)weaponMeshes.push(o);});
const boneCoverage=Object.fromEntries(mesh.skeleton.bones.map(o=>[o.name,{vertices:0,totalWeight:0}]));
const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
for(let i=0;i<si.count;i++)for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(w>.00001){const entry=boneCoverage[mesh.skeleton.bones[si.getComponent(i,k)].name];entry.vertices++;entry.totalWeight+=w;}}
for(const c of g.animations){
 for(const[o,p,q,s]of rest){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}g.scene.updateMatrixWorld(true);
 const pose=makePoser(g.scene,c);let maxStretch=0,worst=null,groundMin=Infinity,maxFloorGap=-Infinity,endFloorGap=0,headStretch=0,gripMax=0,samples=0;
 let minimumWeaponY=Infinity,weaponWorst=null,maxFeetSurfaceGap=-Infinity,maxHandFootSupportGap=-Infinity,supportWorst=null;
 for(let t=0;t<=c.duration+.05;t+=.1){pose(Math.min(t,c.duration));samples++;
  let floor=Infinity;for(let i=0;i<points.length;i++){mesh.getVertexPosition(i,points[i]).applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,points[i].y);}
  groundMin=Math.min(groundMin,floor);maxFloorGap=Math.max(maxFloorGap,floor);endFloorGap=floor;
  const footY=Math.min(...feet.map(({i})=>points[i].y)),handY=Math.min(...hands.map(({i})=>points[i].y)),supportY=Math.min(footY,handY);
  maxFeetSurfaceGap=Math.max(maxFeetSurfaceGap,footY);if(supportY>maxHandFootSupportGap){maxHandFootSupportGap=supportY;supportWorst={t:+t.toFixed(2),footY,handY,bodyFloor:floor};}
  for(const wm of weaponMeshes){const p=wm.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(wm.matrixWorld);if(v.y<minimumWeaponY){minimumWeaponY=v.y;weaponWorst={t:+t.toFixed(2),mesh:wm.name,vertex:i,position:v.toArray()};}}}
  for(const[a,b,d]of edges){const ratio=points[a].distanceTo(points[b])/d,stretch=Math.abs(ratio-1);if(stretch>maxStretch){maxStretch=stretch;worst={t:+t.toFixed(2),rest:base[a].toArray(),posed:points[a].toArray(),ratio};}if(base[a].y>1.62&&base[b].y>1.62)headStretch=Math.max(headStretch,stretch);}
  if(c.name!=='death_park_salute'){
   const center=g.scene.getObjectByName('ParkDanjoe').getWorldPosition(v);let d=Infinity;for(const{i}of hand)d=Math.min(d,points[i].distanceTo(center));gripMax=Math.max(gripMax,d);
  }
 }
 results.push({clip:c.name,duration:c.duration,samples,maxEdgeChange:maxStretch,worst,headEdgeChange:headStretch,minimumSurfaceY:groundMin,maximumFloorGap:maxFloorGap,endFloorGap,maxGripToHandSurface:gripMax,minimumWeaponY,weaponWorst,maxFeetSurfaceGap,maxHandFootSupportGap,supportWorst});
}
const result={file,method:'makePoser; all skinned vertices/triangle edges >= 2mm; 10Hz including end; rigid weapon vertices; rest-space hand/foot surface regions',visualApproved:false,boneCoverage,supportCaveat:'Hand/foot gaps are diagnostics, not a pass rule: grounded back/hip/knee can support a getup. Whole-mesh minY alone never proves support or weapon clearance.',results};
if(report)fs.writeFileSync(report,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
