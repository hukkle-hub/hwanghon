import * as T from '../vendor/three/three.module.js';
import {ainGripCenter,closeAinHandPoint,resolveAinGripSurface} from './ain-grip-shape.js';
const V=(...v)=>new T.Vector3(...v);
function distance(p,a,b){const d=b.clone().sub(a),t=T.MathUtils.clamp(p.clone().sub(a).dot(d)/d.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(d,t));}
// Ain-specific measured landmarks, metres, in the existing mesh's bind space.
// Geometry is cloned: original GLB, shared avatar geometries, UVs and textures
// are never overwritten. Must run before animation starts.
export function repairAinBind(model){
 if(model.userData.ainBindRepair)return model.userData.ainBindRepair;
 const bones={},meshes=[];model.updateWorldMatrix(true,true);
 model.traverse(o=>{if(o.isBone)bones[o.name.replace(/^mixamorig:?/,'')]=o;if(o.isSkinnedMesh)meshes.push(o);});
 const changed=new Map(),report={vertices:0,handVertices:0,geometries:[],grips:[]};
 for(const [side,sg]of [['Left',1],['Right',-1]]){
  for(const [name,p]of [['ForeArm',V(sg*.245,1.16,.012)],['Hand',V(sg*.30,.98,.022)]]){
   const b=bones[side+name],world=model.localToWorld(p.clone());b.position.copy(b.parent.worldToLocal(world));changed.set(b.name,b.position.clone());b.updateWorldMatrix(false,true);
  }
  const hand=bones[side+'Hand'],slot=bones[side+'HandSlot'];
  if(slot){slot.position.copy(ainGripCenter(side));changed.set(slot.name,slot.position.clone());}
 }
 model.updateWorldMatrix(true,true);
 for(const mesh of meshes){
  mesh.geometry=mesh.geometry.clone();report.geometries.push(mesh.geometry);
  // Bind inverses operate in mesh bind coordinates, not avatar world scale/yaw.
  mesh.skeleton.boneInverses=mesh.skeleton.bones.map(b=>b.matrixWorld.clone().premultiply(model.matrixWorld.clone().invert()).invert());
  const g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
  for(let i=0;i<p.count;i++){
   const v=V().fromBufferAttribute(p,i),sg=v.x>=0?1:-1,side=sg>0?'Left':'Right';
   // Sleeve/hand only. Do not reweight hanging coat tails near the hips.
   if(v.y<.83||v.y>1.38||Math.abs(v.x)<.19||Math.abs(v.z)>.13)continue;
   const start=V(sg*.1543,1.3843,.0215),elbow=V(sg*.245,1.16,.012),wrist=V(sg*.30,.98,.022),tip=V(sg*.327,.875,.035);
   const d=[distance(v,start,elbow),distance(v,elbow,wrist),distance(v,wrist,tip)];
   if(Math.min(...d)>.075)continue;
   const indices=['Arm','ForeArm','Hand'].map(n=>mesh.skeleton.bones.indexOf(bones[side+n]));
   const weights=d.map((x,j)=>Math.exp(-Math.pow(x/(j===2?.032:.048),2)));
   // Sleeve cuffs belong to the forearm; distal fingers move rigidly with hand.
   const grip=T.MathUtils.smoothstep(.99-v.y,0,.055);
   if(v.y<.99){weights[0]*=1-grip;weights[1]*=1-grip;weights[2]=Math.max(weights[2],grip);}
   const total=weights.reduce((a,b)=>a+b,0);
   for(let j=0;j<4;j++){si.setComponent(i,j,j<3?indices[j]:0);sw.setComponent(i,j,j<3?weights[j]/total:0);}
   report.vertices++;if(v.y<.96)report.handVertices++;
  }
  si.needsUpdate=true;sw.needsUpdate=true;
  // Corrective grip shapes for this fingerless rig. Curl only distal hand
  // geometry; keep a reversible open-hand base and never invent finger bones.
  if(!g.morphAttributes.position?.length){
   g.morphTargetsRelative=true;g.morphAttributes.position=[];g.morphAttributes.normal=[];
   for(const side of ['Left','Right']){
    const j=mesh.skeleton.bones.indexOf(bones[side+'Hand']),inv=mesh.skeleton.boneInverses[j],forward=inv.clone().invert(),delta=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){
     const original=V().fromBufferAttribute(p,i),v=original.clone().applyMatrix4(inv);
     const sg=side==='Left'?1:-1;
     if(original.x*sg<.26||original.x*sg>.40||original.y<.75||original.y>1.01||Math.abs(original.z)>.12)continue;
     // Finger spread is local Z, palm thickness is local X on this asset.
     // Bend the whole connected distal region, not only high-weight vertices:
     // partial vertex selection previously left spikes across triangle edges.
     v.copy(closeAinHandPoint(v,side));
     v.applyMatrix4(forward).sub(original);delta.set(v.toArray(),i*3);
    }
    report.surfaceAdjustment=Math.max(report.surfaceAdjustment||0,resolveAinGripSurface(g,delta,inv,forward,side));
    const attr=new T.BufferAttribute(delta,3);attr.name='ain_grip_'+side.toLowerCase();g.morphAttributes.position.push(attr);
    const temp=g.clone(),positions=p.array.slice();for(let i=0;i<positions.length;i++)positions[i]+=delta[i];temp.setAttribute('position',new T.BufferAttribute(positions,3));temp.computeVertexNormals();
    const affected=new Set();for(let i=0;i<g.index.count;i+=3){const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];if(ids.some(k=>Math.abs(delta[k*3])+Math.abs(delta[k*3+1])+Math.abs(delta[k*3+2])>1e-7))ids.forEach(k=>affected.add(k));}
    const normals=new Float32Array(p.count*3),welded=new Map();
    for(const i of affected){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');let group=welded.get(key);if(!group){group={ids:[],normal:V(0,0,0)};welded.set(key,group);}group.ids.push(i);group.normal.add(V().fromBufferAttribute(temp.attributes.normal,i));}
    for(const group of welded.values()){group.normal.normalize();for(const i of group.ids)normals.set(group.normal.clone().sub(V().fromBufferAttribute(g.attributes.normal,i)).toArray(),i*3);}
    g.morphAttributes.normal.push(new T.BufferAttribute(normals,3));temp.dispose();
   }
   mesh.updateMorphTargets();report.grips.push(mesh);
  }
 }
 report.changed=changed;model.userData.ainBindRepair=report;return report;
}
export function repairAinClips(clips,report){return clips.map(clip=>{
 const result=clip.clone();result.tracks=result.tracks.map(track=>{
  if(!track.name.endsWith('.position'))return track;
  const p=report.changed.get(track.name.slice(0,-9));if(!p)return track;
  return new T.VectorKeyframeTrack(track.name,[0,clip.duration],[...p.toArray(),...p.toArray()]);
 });return result;
});}
