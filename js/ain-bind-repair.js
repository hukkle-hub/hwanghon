import * as T from '../vendor/three/three.module.js';
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
  if(slot){slot.position.copy(hand.worldToLocal(model.localToWorld(V(sg*.318,.93,.04))));changed.set(slot.name,slot.position.clone());}
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
   if(v.y<.855||v.y>1.38||Math.abs(v.x)<.19||Math.abs(v.z)>.13)continue;
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
     let w=0;for(let k=0;k<4;k++)if(si.getComponent(i,k)===j)w+=sw.getComponent(i,k);
     if(w<.8)continue;
     const original=V().fromBufferAttribute(p,i),v=original.clone().applyMatrix4(inv);
     if(v.y<.045||v.y>.15||Math.abs(v.x)>.065||Math.abs(v.z)>.055)continue;
     const angle=Math.min(2.6,(v.y-.045)/.025);
     v.y=.045+.025*Math.sin(angle);v.z-=.025*(1-Math.cos(angle));
     v.applyMatrix4(forward).sub(original);delta.set(v.toArray(),i*3);
    }
    const attr=new T.BufferAttribute(delta,3);attr.name='ain_grip_'+side.toLowerCase();g.morphAttributes.position.push(attr);
    const temp=g.clone(),positions=p.array.slice();for(let i=0;i<positions.length;i++)positions[i]+=delta[i];temp.setAttribute('position',new T.BufferAttribute(positions,3));temp.computeVertexNormals();
    const normals=temp.attributes.normal.array.slice();for(let i=0;i<normals.length;i++)normals[i]-=g.attributes.normal.array[i];g.morphAttributes.normal.push(new T.BufferAttribute(normals,3));temp.dispose();
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
