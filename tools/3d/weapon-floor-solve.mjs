// Offline authoring constraint. Rotate a whole forearm/hand/weapon chain about
// the elbow; never translate the character or detach the grip. A clear floor
// is not evidence of natural elbow limits, body clearance or visual approval.
import * as T from '../../vendor/three/three.module.js';
export function clearWeaponFloor({joint,weapon,extraLocalPoints=[],groundY=.015,maxAngle=110*Math.PI/180}){
 if(!joint||!weapon||!Number.isFinite(groundY)||!(maxAngle>0&&maxAngle<=Math.PI))throw Error('Invalid weapon-floor constraint');
 let ancestor=weapon;while(ancestor&&ancestor!==joint)ancestor=ancestor.parent;if(!ancestor)throw Error('Weapon must descend from joint');
 let root=joint;while(root.parent)root=root.parent;
 const update=()=>root.updateMatrixWorld(true);update();
 const meshes=[];weapon.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)meshes.push(o);});if(!meshes.length)throw Error('No rigid weapon geometry');
 if(!extraLocalPoints.every(p=>p.isVector3&&p.toArray().every(Number.isFinite)))throw Error('Invalid attached surface');
 const p=new T.Vector3(),minimum=()=>{let y=Infinity;for(const m of meshes){const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);y=Math.min(y,p.y);}}for(const v of extraLocalPoints)y=Math.min(y,p.copy(v).applyMatrix4(joint.matrixWorld).y);return y;};
 const before=minimum();if(before>=groundY)return {before,after:before,angle:0,cleared:true};
 const original=joint.quaternion.clone(),world=joint.getWorldQuaternion(new T.Quaternion()),parentInv=joint.parent.getWorldQuaternion(new T.Quaternion()).invert();
 const forward=new T.Vector3(0,0,1).applyQuaternion(weapon.getWorldQuaternion(new T.Quaternion()));
 const axis=new T.Vector3().crossVectors(forward,new T.Vector3(0,1,0));if(axis.lengthSq()<1e-8)axis.set(1,0,0);axis.normalize();
 const pose=angle=>{joint.quaternion.copy(parentInv).multiply(new T.Quaternion().setFromAxisAngle(axis,angle)).multiply(world);update();return minimum();};
 let previous=0,best=before,bestAngle=0;
 for(let i=1;i<=44;i++){
  const angle=maxAngle*i/44,y=pose(angle);if(y>best){best=y;bestAngle=angle;}
  if(y>=groundY){let low=previous,high=angle;for(let k=0;k<18;k++){const mid=(low+high)/2;if(pose(mid)>=groundY)high=mid;else low=mid;}const after=pose(high);return {before,after,angle:high,cleared:true};}
  previous=angle;
 }
 // Keep the best bounded correction, flag failure instead of raising root.
 if(bestAngle)pose(bestAngle);else {joint.quaternion.copy(original);update();}
 return {before,after:minimum(),angle:bestAngle,cleared:false};
}
