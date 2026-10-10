// Inspect the SKINNED surface, not just hand targets or bone coordinates.
import * as T from '../../vendor/three/three.module.js';
export function prepareArmSurface(model,{side=null,boundary=false}={}){
 const meshes=[];model.updateMatrixWorld(true);
 model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,ids=new Set(mesh.skeleton.bones.map((b,i)=>/^(mixamorig:?)?(Right|Left)(Arm|ForeArm)$/.test(b.name)?i:-1).filter(i=>i>=0)),included=[];
  // Hand vertices with >= .3 hand weight are deliberately curled by hand-grip.
  // Keep those in the boundary audit, but do not count finger folds as biceps.
  const handIds=new Set(mesh.skeleton.bones.map((b,i)=>/(Right|Left)Hand$/.test(b.name)?i:-1).filter(i=>i>=0));
  for(let i=0;i<p.count;i++){let weight=0,handWeight=0;for(let k=0;k<4;k++){if(ids.has(si.getComponent(i,k)))weight+=sw.getComponent(i,k);if(handIds.has(si.getComponent(i,k)))handWeight+=sw.getComponent(i,k);}included[i]=weight>.5&&handWeight<.3;}
  if(side||boundary){const region=new RegExp('^(mixamorig:?)?'+(side||'(Right|Left)')+'(Shoulder|Arm|ForeArm)$'),regionIds=new Set(mesh.skeleton.bones.map((b,i)=>region.test(b.name)?i:-1).filter(i=>i>=0));for(let i=0;i<p.count;i++){let weight=0;for(let k=0;k<4;k++)if(regionIds.has(si.getComponent(i,k)))weight+=sw.getComponent(i,k);included[i]=weight>(boundary?.1:.5);}}
  const edges=new Map(),triangles=[],at=i=>new T.Vector3().fromBufferAttribute(p,i),idx=g.index;
  for(let i=0;i<(idx?.count||p.count);i+=3){const v=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);if(!(boundary?v.some(k=>included[k]):v.every(k=>included[k])))continue;const points=v.map(at),area=new T.Triangle(...points).getArea();if(area>1e-9)triangles.push([...v,area]);for(let k=0;k<3;k++){const a=v[k],b=v[(k+1)%3],key=[a,b].sort((a,b)=>a-b).join(':');const d=at(a).distanceTo(at(b));if(d>1e-5)edges.set(key,[a,b,d]);}}
  if(edges.size)meshes.push({mesh,edges:[...edges.values()],triangles});
 });return meshes;
}
export function armSurfaceNow(meshes){
 let edges=0,stretched=0,triangles=0,collapsed=0,worstStretch=0,bindArea=0,collapsedArea=0;
 for(const m of meshes){m.mesh.skeleton.update();const cache=new Map(),at=i=>{if(!cache.has(i))cache.set(i,m.mesh.getVertexPosition(i,new T.Vector3()).clone());return cache.get(i);};
  for(const[a,b,d]of m.edges){const r=at(a).distanceTo(at(b))/d;edges++;if(r>2)stretched++;worstStretch=Math.max(worstStretch,r);}
  for(const[a,b,c,area]of m.triangles){const r=new T.Triangle(at(a),at(b),at(c)).getArea()/area;triangles++;bindArea+=area;if(r<.15){collapsed++;collapsedArea+=area;}}
 }return{edges,triangles,stretchedFraction:stretched/edges,collapsedFraction:collapsed/triangles,collapsedAreaFraction:collapsedArea/bindArea,worstStretch};
}
